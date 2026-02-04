import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { systemBackupService } from './system-backup.service';
import { SystemBackupType } from '@prisma/client';
import * as fs from 'fs';
import { downloadTokenService } from '../../services/download-token.service';
import { idSchema } from '../../utils/validation';
import log from '../../services/logger.service';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const backupIdParamsSchema = z.object({
  id: idSchema,
});

const createBackupSchema = z.object({
  type: z.enum(['system', 'full'], { message: 'Tipo backup non valido. Usa "system" o "full"' }),
  notes: z.string().max(500).optional(),
});

const listBackupsQuerySchema = z.object({
  type: z.enum(['system', 'full']).optional(),
});

export class SystemBackupController {
  /**
   * Create a new backup
   * Backup is created asynchronously - returns immediately with backup ID
   * Client should poll /api/system-backup/:id to check status
   */
  async createBackup(
    request: FastifyRequest<{ Body: { type: string; notes?: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate body
      const { type, notes } = createBackupSchema.parse(request.body);

      if (type === 'system') {
        // System backups are small - wait for completion
        const result = await systemBackupService.createSystemTemplateBackup(notes);
        if (result.success) {
          return reply.send({
            success: true,
            data: {
              id: result.backupId,
              filename: result.filename,
              size: result.size,
              status: 'UPLOADED',
              message: 'Backup sistema creato con successo',
            },
          });
        } else {
          return reply.status(500).send({
            success: false,
            error: {
              code: 'BACKUP_FAILED',
              message: result.error,
            },
          });
        }
      } else {
        // Full backups are large - process asynchronously
        // Create record first, then process in background
        const backupRecord = await systemBackupService.createBackupRecord('FULL_DISASTER', notes);

        // Schedule backup to run after response is sent
        // Store the backup ID to process later
        const backupIdToProcess = backupRecord.id;

        // Register callback to run after response is sent
        reply.raw.on('finish', () => {
          systemBackupService.processFullBackup(backupIdToProcess)
            .then((result) => {
              if (result.success) {
                log.info(`Full backup completed: ${result.filename} (${result.size} bytes)`);
              } else {
                log.error(`Full backup failed: ${result.error}`);
              }
            })
            .catch((err) => {
              log.error('Full backup error:', err);
            });
        });

        // Return response immediately
        return reply.send({
          success: true,
          data: {
            id: backupRecord.id,
            filename: backupRecord.filename,
            status: 'PROCESSING',
            message: 'Backup completo avviato. Controlla lo stato nella lista backup.',
          },
        });
      }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'BACKUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * List all backups
   */
  async listBackups(
    request: FastifyRequest<{ Querystring: { type?: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate query
      const query = listBackupsQuerySchema.parse(request.query);
      const { type } = query;

      let backupType: SystemBackupType | undefined;
      if (type === 'system') backupType = 'SYSTEM_TEMPLATE';
      if (type === 'full') backupType = 'FULL_DISASTER';

      const backups = await systemBackupService.listBackups(backupType);

      return reply.send({
        success: true,
        data: backups,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'LIST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Get backup details
   */
  async getBackup(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = backupIdParamsSchema.parse(request.params);
      const backup = await systemBackupService.getBackup(params.id);

      if (!backup) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Backup non trovato',
          },
        });
      }

      return reply.send({
        success: true,
        data: backup,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Generate a secure download token for a backup
   * This token is short-lived (5 minutes) and single-use
   */
  async generateDownloadToken(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = backupIdParamsSchema.parse(request.params);
      const { id } = params;
      const user = (request.user as JwtPayload | undefined);

      if (!user?.userId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticazione richiesta',
          },
        });
      }

      // Verify backup exists and get file path
      const filepath = await systemBackupService.getBackupFilePath(id);

      if (!filepath) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Backup non trovato',
          },
        });
      }

      // Generate secure download token with extended expiration for backups (24 hours)
      // Backups are large files and may need multiple download attempts
      const BACKUP_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
      const { token, expiresAt } = await downloadTokenService.generateToken(
        {
          userId: user.userId,
          resourceType: 'backup',
          resourceId: id,
          filePath: filepath,
        },
        BACKUP_TOKEN_EXPIRATION_MS
      );

      return reply.send({
        success: true,
        data: {
          token,
          expiresAt: expiresAt.toISOString(),
          downloadUrl: `/api/system-backups/${id}/download?token=${token}`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TOKEN_GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Download backup file
   * Uses secure download tokens instead of JWT in URL
   */
  async downloadBackup(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = backupIdParamsSchema.parse(request.params);
      const { id } = params;

      // Download payload is set by the downloadAuth middleware
      const downloadPayload = (request as { downloadPayload?: any }).downloadPayload;

      if (!downloadPayload) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token di download non valido',
          },
        });
      }

      // Verify the token is for this resource
      if (downloadPayload.resourceId !== id) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Token non valido per questo backup',
          },
        });
      }

      // Verify file exists
      const filepath = downloadPayload.filePath;
      if (!fs.existsSync(filepath)) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'File backup non trovato',
          },
        });
      }

      const backup = await systemBackupService.getBackup(id);
      const filename = backup?.filename || 'backup.tar.gz';

      const stream = fs.createReadStream(filepath);

      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(stream);
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Validate params
      const params = backupIdParamsSchema.parse(request.params);
      const deleted = await systemBackupService.deleteBackup(params.id);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Backup non trovato',
          },
        });
      }

      return reply.send({
        success: true,
        message: 'Backup eliminato con successo',
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const deleted = await systemBackupService.cleanupOldBackups(30);

      return reply.send({
        success: true,
        data: {
          deletedCount: deleted,
          message: `${deleted} backup vecchi eliminati`,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export const systemBackupController = new SystemBackupController();
