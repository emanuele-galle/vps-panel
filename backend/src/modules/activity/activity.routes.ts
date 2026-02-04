import { FastifyInstance } from 'fastify';
import { activityController } from './activity.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export default async function activityRoutes(fastify: FastifyInstance) {
  // Add authentication and admin middleware to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // Get all logs with filters
  fastify.get('/', activityController.getAllLogs);

  // Get statistics
  fastify.get('/stats', activityController.getLogStats);

  // Search logs
  fastify.get('/search', activityController.searchLogs);

  // Export logs
  fastify.get('/export', activityController.exportLogs);

  // Get logs by user
  fastify.get('/user/:userId', activityController.getLogsByUser);

  // Get logs by resource
  fastify.get('/resource/:resource/:resourceId?', activityController.getLogsByResource);

  // Get log by ID
  fastify.get('/:id', activityController.getLogById);
}
