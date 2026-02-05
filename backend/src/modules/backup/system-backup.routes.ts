import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { systemBackupController } from './system-backup.controller';
import { authenticate } from '../auth/jwt.middleware';
import { downloadTokenService } from '../../services/download-token.service';
import { validatePath } from '../../utils/shell-sanitizer';
import { rateLimiters } from '../../middlewares/rate-limit.middleware';

/**
 * Download authentication using secure short-lived tokens.
 * This replaces JWT tokens in URLs (which are a security risk).
 */
async function downloadAuth(
  request: FastifyRequest<{ Querystring: { token?: string } }>,
  reply: FastifyReply
) {
  const queryToken = request.query.token;

  if (!queryToken) {
    return reply.code(401).send({
      success: false,
      message: 'Token di download richiesto',
    });
  }

  // Validate and consume the download token
  const payload = await downloadTokenService.validateAndConsumeToken(queryToken);

  if (!payload) {
    return reply.code(401).send({
      success: false,
      message: 'Token di download non valido o scaduto',
    });
  }

  // Validate the file path
  if (!validatePath(payload.filePath, ['/var/backups'])) {
    return reply.code(400).send({
      success: false,
      message: 'Percorso file non valido',
    });
  }

  // Attach download info to request for controller use
  (request as { downloadPayload?: unknown }).downloadPayload = payload;
}

export default async function systemBackupRoutes(app: FastifyInstance) {
  // Create backup (system or full) - rate limited (5 per hour)
  app.post('/create', {
    preHandler: [authenticate, rateLimiters.backup],
    handler: systemBackupController.createBackup.bind(systemBackupController),
  });

  // List all backups
  app.get('/', { preHandler: authenticate }, systemBackupController.listBackups.bind(systemBackupController) as any);

  // Get backup details
  app.get('/:id', { preHandler: authenticate }, systemBackupController.getBackup.bind(systemBackupController) as any);

  // Generate download token for a backup (requires auth) - rate limited
  app.post('/:id/download-token', {
    preHandler: [authenticate, rateLimiters.download],
    handler: systemBackupController.generateDownloadToken.bind(systemBackupController),
  });

  // Download backup file using secure download token - rate limited
  app.get('/:id/download', {
    preHandler: [downloadAuth as any, rateLimiters.download],
    handler: systemBackupController.downloadBackup.bind(systemBackupController),
  });

  // Delete backup
  app.delete('/:id', { preHandler: authenticate }, systemBackupController.deleteBackup.bind(systemBackupController) as any);

  // Cleanup old backups - rate limited
  app.post('/cleanup', {
    preHandler: [authenticate, rateLimiters.backup],
    handler: systemBackupController.cleanupBackups.bind(systemBackupController),
  });
}
