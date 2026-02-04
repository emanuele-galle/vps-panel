import { FastifyInstance } from 'fastify';
import { optimizationController } from './optimization.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function optimizationRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Analysis
  app.get('/analyze', optimizationController.analyze.bind(optimizationController));

  // Individual cleanup operations
  app.post('/clean/docker-cache', optimizationController.cleanDockerCache.bind(optimizationController));
  app.post('/clean/npm-cache', optimizationController.cleanNpmCache.bind(optimizationController));
  app.post('/clean/apt-cache', optimizationController.cleanAptCache.bind(optimizationController));
  app.post('/clean/logs', optimizationController.cleanLogs.bind(optimizationController));
  app.post('/clean/go-cache', optimizationController.cleanGoCache.bind(optimizationController));

  // Docker prune operations
  app.post('/prune/volumes', optimizationController.pruneVolumes.bind(optimizationController));
  app.post('/prune/images', optimizationController.pruneImages.bind(optimizationController));
  app.post('/prune/unused-images', optimizationController.pruneUnusedImages.bind(optimizationController));

  // Log operations
  app.post('/clean/container-logs', optimizationController.truncateLogs.bind(optimizationController));

  // Full cleanup (async)
  app.post('/clean-all', optimizationController.cleanAll.bind(optimizationController));
  app.get('/clean-all/status/:jobId', optimizationController.getCleanupStatus.bind(optimizationController));
}
