import { FastifyInstance } from 'fastify';
import { dockerController } from './docker.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function dockerRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Container endpoints
  app.get('/containers', dockerController.listContainers.bind(dockerController));
  app.get('/containers/:id', dockerController.getContainer.bind(dockerController));
  app.post('/containers/:id/start', dockerController.startContainer.bind(dockerController));
  app.post('/containers/:id/stop', dockerController.stopContainer.bind(dockerController));
  app.post('/containers/:id/restart', dockerController.restartContainer.bind(dockerController));
  app.delete('/containers/:id', dockerController.removeContainer.bind(dockerController));
  app.get('/containers/:id/logs', dockerController.getContainerLogs.bind(dockerController));
  app.get('/containers/:id/stats', dockerController.getContainerStats.bind(dockerController));

  // Network endpoints
  app.get('/networks', dockerController.listNetworks.bind(dockerController));

  // Volume endpoints
  app.get('/volumes', dockerController.listVolumes.bind(dockerController));

  // Image endpoints
  app.get('/images', dockerController.listImages.bind(dockerController));
}
