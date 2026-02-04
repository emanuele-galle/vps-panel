import { FastifyInstance } from 'fastify';
import { gdriveBackupController } from './gdrive-backup.controller';
import { authenticate } from '../auth/jwt.middleware';
import { rateLimiters } from '../../middlewares/rate-limit.middleware';

export default async function gdriveBackupRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // Trigger database backup to Google Drive - rate limited
  app.post('/databases', {
    preHandler: rateLimiters.backup,
    handler: gdriveBackupController.triggerDatabaseBackup.bind(gdriveBackupController),
  });

  // Trigger full system backup to Google Drive - rate limited
  app.post('/full-system', {
    preHandler: rateLimiters.backup,
    handler: gdriveBackupController.triggerFullSystemBackup.bind(gdriveBackupController),
  });

  // Get backup job status
  app.get('/status/:jobId', gdriveBackupController.getJobStatus.bind(gdriveBackupController));

  // List all backup jobs
  app.get('/jobs', gdriveBackupController.listJobs.bind(gdriveBackupController));

  // Get backup logs
  app.get('/logs', gdriveBackupController.getLogs.bind(gdriveBackupController));

  // Get backup schedules
  app.get('/schedule', gdriveBackupController.getSchedule.bind(gdriveBackupController));

  // List files on Google Drive
  app.get('/gdrive', gdriveBackupController.listGDriveBackups.bind(gdriveBackupController));
}
