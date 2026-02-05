import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { backupController } from './backup.controller';
import { authenticate, requireRole } from '../auth/jwt.middleware';
import { UserRole } from '@prisma/client';

// Custom auth middleware that skips authentication for specific routes
const conditionalAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // Skip auth for download route (uses download token instead of JWT)
  if (request.url.startsWith('/api/backups/download/')) {
    return;
  }
  return authenticate(request, reply);
};

export default async function backupRoutes(app: FastifyInstance) {
  // Apply conditional auth to all routes
  app.addHook('preHandler', conditionalAuth);

  // Download backup file (PUBLIC - uses download token, not JWT)
  app.get('/download/:token', backupController.downloadBackup.bind(backupController));

  // Upload a backup ZIP (500MB limit for large backups)
  app.post('/upload', { bodyLimit: 524288000 }, backupController.uploadBackup.bind(backupController));

  // Get all backups for current user
  app.get('/', backupController.getBackups.bind(backupController));

  // Get specific backup
  app.get('/:id', backupController.getBackup.bind(backupController));

  // Import backup as project
  app.post('/:id/import', backupController.importBackup.bind(backupController));

  // Delete backup
  app.delete('/:id', backupController.deleteBackup.bind(backupController));

  // Export project as backup
  app.post('/export', backupController.exportProject.bind(backupController));

  // Upload backup to Google Drive (TODO: implement)
  app.post('/:id/upload-drive', backupController.uploadToGoogleDrive.bind(backupController));

  // Cleanup expired backups - Admin only
  app.get(
    '/cleanup',
    { preHandler: requireRole(UserRole.ADMIN) },
    backupController.cleanupExpired.bind(backupController)
  );
}
