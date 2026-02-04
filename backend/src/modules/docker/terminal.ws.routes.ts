import { FastifyInstance } from 'fastify';
import { terminalService } from './terminal.service';
import { verifyToken } from '../auth/jwt.middleware';
import Docker from 'dockerode';
import log from '../../services/logger.service';
import { COOKIE_NAMES } from '../../utils/cookies';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Verify that a container exists and is running
 */
async function verifyContainer(containerId: string): Promise<boolean> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Running === true;
  } catch {
    return false;
  }
}

/**
 * Extract JWT token from cookie header string
 */
function extractTokenFromCookies(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAMES.ACCESS_TOKEN}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * WebSocket routes for container terminal access
 */
export async function terminalWsRoutes(app: FastifyInstance) {
  app.get('/ws/terminal/:containerId', { websocket: true }, async (socket, req) => {
    const containerId = (req.params as any).containerId;

    // 1. Authenticate via JWT cookie
    const token = extractTokenFromCookies(req.headers.cookie);
    if (!token) {
      log.warn('[Terminal WS] No auth token in cookies');
      socket.close(4001, 'Authentication required');
      return;
    }

    let user: { userId: string; role: string };
    try {
      user = await verifyToken(token, app);
    } catch {
      log.warn('[Terminal WS] Invalid token');
      socket.close(4001, 'Invalid token');
      return;
    }

    // 2. Only ADMIN can access terminal
    if (user.role !== 'ADMIN') {
      log.warn(`[Terminal WS] Non-admin user ${user.userId} tried to access terminal`);
      socket.close(4003, 'Admin access required');
      return;
    }

    // 3. Verify container exists and is running
    const isRunning = await verifyContainer(containerId);
    if (!isRunning) {
      log.warn(`[Terminal WS] Container ${containerId} not found or not running`);
      socket.close(4004, 'Container not found or not running');
      return;
    }

    // 4. Create PTY session
    let sessionId: string;
    try {
      sessionId = terminalService.createSession(containerId, user.userId);
    } catch (err: any) {
      log.error(`[Terminal WS] Failed to create session:`, err);
      socket.close(4005, err.message || 'Failed to create terminal session');
      return;
    }

    const session = terminalService.getSession(sessionId);
    if (!session) {
      socket.close(4005, 'Session creation failed');
      return;
    }

    // Send session info
    socket.send(JSON.stringify({
      type: 'connected',
      sessionId,
      containerId,
    }));

    // 5. Pipe: pty.onData → ws.send
    session.ptyProcess.onData((data) => {
      try {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'data', data }));
        }
      } catch (err) {
        log.error(`[Terminal WS] Error sending data to client:`, err);
      }
    });

    // Handle PTY exit
    session.ptyProcess.onExit(({ exitCode }) => {
      try {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'exit',
            exitCode,
          }));
          socket.close(1000, 'Terminal process exited');
        }
      } catch {
        // Connection already closed
      }
      terminalService.destroy(sessionId);
    });

    // 6. Pipe: ws.message → pty.write / resize
    socket.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());

        if (msg.type === 'data' && typeof msg.data === 'string') {
          terminalService.write(sessionId, msg.data);
        } else if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
          terminalService.resize(sessionId, msg.cols, msg.rows);
        }
      } catch {
        // For raw data (non-JSON), write directly
        terminalService.write(sessionId, message.toString());
      }
    });

    // 7. Cleanup on disconnect
    socket.on('close', () => {
      log.info(`[Terminal WS] Client disconnected, destroying session ${sessionId}`);
      terminalService.destroy(sessionId);
    });

    socket.on('error', (err: Error) => {
      log.error(`[Terminal WS] Socket error for session ${sessionId}:`, err);
      terminalService.destroy(sessionId);
    });
  });
}
