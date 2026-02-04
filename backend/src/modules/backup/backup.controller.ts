import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as path from 'path';
import { backupService } from './backup.service';
import { BackupStatus } from '@prisma/client';
import { NotFoundError, ValidationError, InternalError, ForbiddenError } from '../../utils/errors';
import { downloadTokenService } from '../../services/download-token.service';

// Validation schemas
const importBackupSchema = z.object({
  projectName: z.string().min(2).max(100).optional(),
});

const exportProjectSchema = z.object({
  projectId: z.string().cuid(),
  notes: z.string().max(500).optional(),
});

const uploadToGoogleDriveSchema = z.object({
  backupId: z.string().cuid(),
  folderId: z.string().optional(),
});

export class BackupController {
  /**
   * POST /api/backups/upload
   * Upload a backup ZIP file
   */
  async uploadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;

    try {
      // Get the uploaded file from multipart
      const data = await request.file();

      if (!data) {
        throw new ValidationError('Nessun file caricato');
      }

      // Validate file type
      if (!data.mimetype.includes('zip') && !data.mimetype.includes('application/x-zip')) {
        throw new ValidationError('Solo file ZIP sono ammessi');
      }

      // Save upload
      const backup = await backupService.saveUpload(data, userId);

      return reply.status(201).send({
        success: true,
        data: backup,
        message: 'Backup caricato con successo',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error uploading backup');
      throw error;
    }
  }

  /**
   * GET /api/backups
   * Get all backups for the current user
   */
  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { status } = request.query as { status?: BackupStatus };

    const backups = await backupService.getUserBackups(userId, status);

    return reply.send({
      success: true,
      data: backups,
    });
  }

  /**
   * GET /api/backups/:id
   * Get a specific backup
   */
  async getBackup(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const backup = await backupService.getBackup(id, userId);

    if (!backup) {
      throw new NotFoundError('Backup non trovato');
    }

    return reply.send({
      success: true,
      data: backup,
    });
  }

  /**
   * POST /api/backups/:id/import
   * Import a backup as a new project
   */
  async importBackup(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = importBackupSchema.parse(request.body);

    try {
      const project = await backupService.importBackup(id, userId, body.projectName);

      return reply.status(201).send({
        success: true,
        data: project,
        message: 'Backup importato con successo come progetto',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error importing backup');

      if (error instanceof Error ? error.message : 'Unknown error'.includes('non trovato')) {
        throw new NotFoundError(error instanceof Error ? error.message : 'Unknown error');
      }
      if (error instanceof Error ? error.message : 'Unknown error'.includes('processato')) {
        throw new ValidationError(error instanceof Error ? error.message : 'Unknown error');
      }

      throw new InternalError('Errore durante l\'importazione del backup');
    }
  }

  /**
   * DELETE /api/backups/:id
   * Delete a backup
   */
  async deleteBackup(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    try {
      await backupService.deleteBackup(id, userId);

      return reply.send({
        success: true,
        message: 'Backup eliminato con successo',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error deleting backup');

      if (error instanceof Error ? error.message : 'Unknown error'.includes('non trovato')) {
        throw new NotFoundError(error instanceof Error ? error.message : 'Unknown error');
      }

      throw new InternalError('Errore durante l\'eliminazione del backup');
    }
  }

  /**
   * POST /api/backups/export
   * Export a project as a backup tar.gz file
   */
  async exportProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const body = exportProjectSchema.parse(request.body);

    try {
      const result = await backupService.exportProject(
        body.projectId,
        userId,
        role,
        body.notes
      );

      return reply.status(201).send({
        success: true,
        data: result,
        message: 'Backup del progetto creato con successo',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error exporting project');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('accesso') || errorMessage.includes('Non hai')) {
        throw new ForbiddenError(errorMessage);
      }
      if (errorMessage.includes('non trovato')) {
        throw new NotFoundError(errorMessage);
      }

      throw new InternalError('Errore durante l\'export del progetto');
    }
  }

  /**
   * GET /api/backups/download/:token
   * Download a backup file using a secure token
   */
  async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };

    try {
      // Validate download token (allow multiple use for backup files)
      const tokenData = await downloadTokenService.validateAndConsumeToken(token, true);

      if (!tokenData) {
        throw new NotFoundError('Token di download non valido o scaduto');
      }

      // Get file stats
      const fileStat = await stat(tokenData.filePath);
      if (!fileStat.isFile()) {
        throw new NotFoundError('File non trovato');
      }

      // Get backup info for filename
      const backup = await backupService.getBackup(tokenData.resourceId, tokenData.userId);
      const downloadName = backup?.filename || path.basename(tokenData.filePath);

      // Set headers for download
      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="${downloadName}"`);
      reply.header('Content-Length', fileStat.size);

      // Stream the file
      const stream = createReadStream(tokenData.filePath);
      return reply.send(stream);

    } catch (error) {
      request.log.error({ err: error }, 'Error downloading backup');

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalError('Errore durante il download del backup');
    }
  }

  /**
   * POST /api/backups/:id/upload-drive
   * Upload a backup to Google Drive
   */
  async uploadToGoogleDrive(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = uploadToGoogleDriveSchema.parse(request.body);

    try {
      // Verify backup exists and belongs to user
      const backup = await backupService.getBackup(id, userId);

      if (!backup) {
        throw new NotFoundError('Backup non trovato');
      }

      // Import Google Drive service here to avoid initialization errors
      const { googleDriveService } = await import('./google-drive.service');

      if (!googleDriveService.isConfigured()) {
        throw new ValidationError('Google Drive non configurato. Contatta l\'amministratore.');
      }

      // Upload to Google Drive
      const driveFileId = await googleDriveService.uploadBackup(id, body.folderId);

      return reply.send({
        success: true,
        data: { driveFileId },
        message: 'Backup caricato su Google Drive con successo',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error uploading to Google Drive');

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new InternalError('Errore durante upload su Google Drive');
    }
  }

  /**
   * GET /api/backups/cleanup
   * Manually trigger cleanup of expired backups
   * (Admin only - this would typically run via cron)
   */
  async cleanupExpired(request: FastifyRequest, reply: FastifyReply) {
    try {
      const count = await backupService.cleanupExpiredBackups();

      return reply.send({
        success: true,
        data: { cleaned: count },
        message: `${count} backup scaduti eliminati`,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Error cleaning up expired backups');
      throw new InternalError('Errore durante la pulizia dei backup scaduti');
    }
  }
}

export const backupController = new BackupController();
