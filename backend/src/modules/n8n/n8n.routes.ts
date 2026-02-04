import type { FastifyInstance } from 'fastify';
import { n8nController } from './n8n.controller';
import { authenticate, requireAdmin } from '../auth/jwt.middleware';

export default async function n8nRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Status endpoint (all authenticated users)
  app.get('/status', n8nController.getStatus.bind(n8nController));

  // Stats endpoint (all authenticated users)
  app.get('/stats', n8nController.getStats.bind(n8nController));

  // SSO token (all authenticated users)
  app.get('/sso-token', n8nController.getSsoToken.bind(n8nController));

  // Config endpoints (admin only)
  app.get('/config', {
    preHandler: requireAdmin,
    handler: n8nController.getConfig.bind(n8nController),
  });

  app.put('/config', {
    preHandler: requireAdmin,
    handler: n8nController.updateConfig.bind(n8nController),
  });

  // Service control (admin only)
  app.post('/start', {
    preHandler: requireAdmin,
    handler: n8nController.start.bind(n8nController),
  });

  app.post('/stop', {
    preHandler: requireAdmin,
    handler: n8nController.stop.bind(n8nController),
  });

  app.post('/restart', {
    preHandler: requireAdmin,
    handler: n8nController.restart.bind(n8nController),
  });

  // Logs (admin only)
  app.get('/logs', {
    preHandler: requireAdmin,
    handler: n8nController.getLogs.bind(n8nController),
  });

  // Workflows (all authenticated users)
  app.get('/workflows', n8nController.getWorkflows.bind(n8nController));

  // Backup endpoints (admin only)
  app.get('/backups', {
    preHandler: requireAdmin,
    handler: n8nController.listBackups.bind(n8nController),
  });

  app.post('/backup', {
    preHandler: requireAdmin,
    handler: n8nController.createBackup.bind(n8nController),
  });

  app.post('/backups/:id/restore', {
    preHandler: requireAdmin,
    handler: n8nController.restoreBackup.bind(n8nController),
  });

  app.delete('/backups/:id', {
    preHandler: requireAdmin,
    handler: n8nController.deleteBackup.bind(n8nController),
  });

  // Cleanup (admin only)
  app.post('/cleanup', {
    preHandler: requireAdmin,
    handler: n8nController.cleanupBackups.bind(n8nController),
  });
}
