import { FastifyInstance } from 'fastify';
import { getProjectsWebSocketHandler } from './projects.events';
import log from '../../services/logger.service';

/**
 * WebSocket routes for real-time project updates
 */
export async function projectsWsRoutes(app: FastifyInstance) {
  // WebSocket endpoint for all projects updates
  app.get('/ws/projects', { websocket: true }, (connection, _req) => {
    const wsHandler = getProjectsWebSocketHandler();
    
    if (!wsHandler) {
      connection.socket.close(1011, 'WebSocket handler not initialized');
      return;
    }

    log.info('[Projects WS] Global client connected');
    wsHandler.addGlobalClient(connection);

    // Handle incoming messages (for future use - subscriptions, filters, etc.)
    connection.socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription to specific project
        if (data.type === 'subscribe' && data.projectId) {
          wsHandler.addClient(data.projectId, connection);
          connection.socket.send(JSON.stringify({ 
            event: 'subscribed', 
            projectId: data.projectId 
          }));
        }
        
        // Handle unsubscription
        if (data.type === 'unsubscribe' && data.projectId) {
          wsHandler.removeClient(data.projectId, connection);
          connection.socket.send(JSON.stringify({ 
            event: 'unsubscribed', 
            projectId: data.projectId 
          }));
        }
      } catch (_error) {
        // Ignore parse errors for non-JSON messages
      }
    });

    // Handle disconnection
    connection.socket.on('close', () => {
      log.info('[Projects WS] Global client disconnected');
      wsHandler.removeClient(null, connection);
    });

    // Send initial connection confirmation
    connection.socket.send(JSON.stringify({ 
      event: 'connected', 
      timestamp: Date.now() 
    }));
  });

  // WebSocket endpoint for specific project updates
  app.get('/ws/projects/:projectId', { websocket: true }, (connection, _req) => {
    const wsHandler = getProjectsWebSocketHandler();
    const projectId = (_req.params as any)?.projectId;
    
    if (!wsHandler) {
      connection.socket.close(1011, 'WebSocket handler not initialized');
      return;
    }

    log.info(`[Projects WS] Client connected to project ${projectId}`);
    wsHandler.addClient(projectId, connection);

    connection.socket.on('close', () => {
      log.info(`[Projects WS] Client disconnected from project ${projectId}`);
      wsHandler.removeClient(projectId, connection);
    });

    // Send initial connection confirmation
    connection.socket.send(JSON.stringify({ 
      event: 'connected', 
      projectId,
      timestamp: Date.now() 
    }));
  });
}
