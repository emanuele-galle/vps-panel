import { FastifyInstance } from 'fastify';

import { projectEvents, ProjectEventTypes } from './projects.service';
import log from '../../services/logger.service';

/**
 * Projects WebSocket Events Handler
 * Bridges internal EventEmitter events to WebSocket clients
 */
export class ProjectsWebSocketHandler {
  private clients: Map<string, Set<any>> = new Map(); // projectId -> Set of websocket connections
  private globalClients: Set<any> = new Set(); // Clients listening to all project events

  constructor(private app: FastifyInstance) {}

  /**
   * Initialize WebSocket handlers and event listeners
   */
  init() {
    // Listen to internal project events and broadcast to WebSocket clients
    this.setupEventListeners();
    log.info('[Projects WebSocket] Handler initialized');
  }

  /**
   * Setup listeners for internal project events
   */
  private setupEventListeners() {
    // Project created
    projectEvents.on(ProjectEventTypes.PROJECT_CREATED, (data) => {
      this.broadcast('project:created', data);
    });

    // Project updated
    projectEvents.on(ProjectEventTypes.PROJECT_UPDATED, (data) => {
      this.broadcast('project:updated', data, data.projectId);
    });

    // Project deleted
    projectEvents.on(ProjectEventTypes.PROJECT_DELETED, (data) => {
      this.broadcast('project:deleted', data, data.projectId);
    });

    // Project status changed
    projectEvents.on(ProjectEventTypes.PROJECT_STATUS_CHANGED, (data) => {
      this.broadcast('project:status', data, data.projectId);
    });

    // Credentials synced
    projectEvents.on(ProjectEventTypes.PROJECT_CREDENTIALS_SYNCED, (data) => {
      this.broadcast('project:credentials', data, data.projectId);
    });

    // Container status changed
    projectEvents.on(ProjectEventTypes.CONTAINER_STATUS_CHANGED, (data) => {
      this.broadcast('project:container:status', data, data.projectId);
    });
  }

  /**
   * Add a client to listen to a specific project
   */
  addClient(projectId: string, connection: any) {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId)!.add(connection);
  }

  /**
   * Add a client to listen to all project events
   */
  addGlobalClient(connection: any) {
    this.globalClients.add(connection);
  }

  /**
   * Remove a client
   */
  removeClient(projectId: string | null, connection: any) {
    if (projectId && this.clients.has(projectId)) {
      this.clients.get(projectId)!.delete(connection);
    }
    this.globalClients.delete(connection);
  }

  /**
   * Broadcast event to connected clients
   */
  private broadcast(event: string, data: unknown, projectId?: string) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    // Send to global clients
    this.globalClients.forEach((client) => {
      try {
        if (client.socket?.readyState === 1) { // WebSocket.OPEN
          client.socket.send(message);
        }
      } catch (error) {
        log.error('[Projects WebSocket] Error sending to global client:', error);
      }
    });

    // Send to project-specific clients
    if (projectId && this.clients.has(projectId)) {
      this.clients.get(projectId)!.forEach((client) => {
        try {
          if (client.socket?.readyState === 1) {
            client.socket.send(message);
          }
        } catch (error) {
          log.error(`[Projects WebSocket] Error sending to project ${projectId} client:`, error);
        }
      });
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): { global: number; byProject: Record<string, number> } {
    const byProject: Record<string, number> = {};
    this.clients.forEach((clients, projectId) => {
      byProject[projectId] = clients.size;
    });

    return {
      global: this.globalClients.size,
      byProject
    };
  }
}

// Singleton instance
let wsHandler: ProjectsWebSocketHandler | null = null;

export function initProjectsWebSocket(app: FastifyInstance) {
  wsHandler = new ProjectsWebSocketHandler(app);
  wsHandler.init();
  return wsHandler;
}

export function getProjectsWebSocketHandler() {
  return wsHandler;
}
