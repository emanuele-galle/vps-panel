import { FastifyInstance } from 'fastify';
import { fileManagerController } from './filemanager.controller';
import { authenticate } from '../../middlewares/auth';
import { requireAdmin } from '../../middlewares/admin';

export async function fileManagerRoutes(fastify: FastifyInstance) {
  // Add authentication and admin middleware to all routes
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // System instance - ADMIN only
  fastify.get('/system', fileManagerController.getSystemInstance);

  // Get all FileBrowser instances
  fastify.get('/instances', fileManagerController.getAllInstances);

  // Get FileBrowser instance for a specific project
  fastify.get('/:projectId', fileManagerController.getInstance);

  // Start FileBrowser for a project
  fastify.post('/:projectId/start', fileManagerController.startFileBrowser);

  // Stop FileBrowser for a project
  fastify.post('/:projectId/stop', fileManagerController.stopFileBrowser);
}
