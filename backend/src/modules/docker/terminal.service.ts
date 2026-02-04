import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import log from '../../services/logger.service';

interface TerminalSession {
  ptyProcess: pty.IPty;
  containerId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
}

const MAX_SESSIONS = 5;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup stale sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new terminal session for a container
   */
  createSession(containerId: string, userId: string, cols: number = 80, rows: number = 24): string {
    // Check max sessions
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`Limite massimo di ${MAX_SESSIONS} sessioni terminale raggiunto`);
    }

    const sessionId = uuidv4();

    const ptyProcess = pty.spawn('docker', ['exec', '-it', containerId, '/bin/sh'], {
      name: 'xterm-256color',
      cols,
      rows,
      env: {
        TERM: 'xterm-256color',
      },
    });

    this.sessions.set(sessionId, {
      ptyProcess,
      containerId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    log.info(`[Terminal] Session ${sessionId} created for container ${containerId} by user ${userId}`);

    return sessionId;
  }

  /**
   * Get a PTY session
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Write data to a PTY session
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sessione terminale non trovata');
    }
    session.lastActivity = new Date();
    session.ptyProcess.write(data);
  }

  /**
   * Resize a PTY session
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sessione terminale non trovata');
    }
    session.lastActivity = new Date();
    session.ptyProcess.resize(cols, rows);
  }

  /**
   * Destroy a PTY session
   */
  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.ptyProcess.kill();
    } catch (err) {
      log.warn(`[Terminal] Error killing PTY for session ${sessionId}:`, err);
    }

    this.sessions.delete(sessionId);
    log.info(`[Terminal] Session ${sessionId} destroyed`);
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup sessions that have been inactive for too long
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > INACTIVITY_TIMEOUT_MS) {
        log.info(`[Terminal] Cleaning up stale session ${sessionId} (inactive for 30min)`);
        this.destroy(sessionId);
      }
    }
  }

  /**
   * Destroy all sessions (for graceful shutdown)
   */
  destroyAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.destroy(sessionId);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const terminalService = new TerminalService();
