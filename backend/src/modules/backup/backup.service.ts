import { Prisma, Project, Database, Domain, Container, ProjectMember } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { BackupStatus, ProjectStatus, ProjectTemplate, UserRole } from '@prisma/client';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, rm, readFile, writeFile, access, constants, stat } from 'fs/promises';
import { join } from 'path';
import { randomBytes, createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { ZipUtils } from '../../utils/zip.utils';
import { dockerService } from '../docker/docker.service';
import { safeExec, safePgDump } from '../../utils/shell-sanitizer';
import { downloadTokenService } from '../../services/download-token.service';
import log from '../../services/logger.service';
import { notificationService } from '../../services/notification.service';
import { backupExportService } from './backup-export.service';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/uploads';
const PROJECTS_DIR = '/var/www/projects';
const BACKUP_EXPIRY_HOURS = parseInt(process.env.BACKUP_EXPIRY_HOURS || '24');

// Helper to convert BigInt fields to Number for JSON serialization
function serializeBackup<T extends Record<string, unknown>>(backup: T | null): T | null {
  if (!backup) return backup;
  return {
    ...backup,
    size: typeof backup.size === 'bigint' ? Number(backup.size) : backup.size,
  };
}



class BackupService {
  /**
   * Salva un file ZIP caricato
   */
  async saveUpload(file: MultipartFile, userId: string): Promise<any> {
    // Genera nome file unico
    const hash = randomBytes(16).toString('hex');
    const filename = `${hash}.zip`;
    const filepath = join(UPLOADS_DIR, filename);

    // Assicura che la directory uploads esista
    await mkdir(UPLOADS_DIR, { recursive: true });

    // Salva il file
    const writeStream = createWriteStream(filepath);
    await pipeline(file.file, writeStream);

    // Ottieni la dimensione reale del file salvato
    const fileStats = await stat(filepath);
    const fileSize = BigInt(fileStats.size);

    // Calcola la data di scadenza (24 ore da ora)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + BACKUP_EXPIRY_HOURS);

    // Crea record nel database
    const backup = await prisma.backupUpload.create({
      data: {
        userId,
        filename,
        originalName: file.filename,
        filepath,
        size: fileSize,
        mimeType: file.mimetype,
        status: BackupStatus.UPLOADED,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Convert BigInt to Number for JSON serialization
    return serializeBackup(backup);
  }

  /**
   * Ottieni tutti i backup di un utente
   */
  async getUserBackups(userId: string, status?: BackupStatus) {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const backups = await prisma.backupUpload.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return backups.map(serializeBackup);
  }

  /**
   * Ottieni un backup specifico
   */
  async getBackup(backupId: string, userId: string) {
    const backup = await prisma.backupUpload.findFirst({
      where: {
        id: backupId,
        userId,
      },
      include: {
        project: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return serializeBackup(backup);
  }

  /**
   * Importa un backup come progetto
   */
  async importBackup(backupId: string, userId: string, projectName?: string) {
    // Ottieni il backup
    const backup = await this.getBackup(backupId, userId);
    if (!backup) {
      throw new Error('Backup non trovato');
    }

    if (backup.status !== BackupStatus.UPLOADED) {
      throw new Error('Backup già processato o non valido');
    }

    // Aggiorna status a PROCESSING
    await prisma.backupUpload.update({
      where: { id: backupId },
      data: { status: BackupStatus.PROCESSING },
    });

    let project: any | null = null;
    let extractDir: string = '';

    try {
      // Estrai lo ZIP
      extractDir = join(PROJECTS_DIR, `import-${backup.id}`);
      await ZipUtils.extractZip(backup.filepath, extractDir);

      // Analizza il contenuto
      const analysis = await ZipUtils.analyzeExtractedDir(extractDir);

      // Pulisci file non necessari
      if (analysis.filesToCleanup.length > 0) {
        await ZipUtils.cleanupExtractedDir(extractDir, analysis.filesToCleanup);
      }

      // Crea slug per il progetto
      const slug = this.generateSlug(projectName || backup.originalName.replace('.zip', ''));

      // Crea il progetto nel database
      project = await prisma.project.create({
        data: {
          name: projectName || backup.originalName.replace('.zip', ''),
          slug,
          userId,
          template: this.detectTemplate(analysis),
          status: ProjectStatus.ACTIVE,
          path: extractDir,
          tags: [],
          notes: `Importato da backup: ${backup.originalName}`,
        },
      });

      // === AUTOMATIC DEPLOYMENT ===
      await this.deployImportedProject(project, extractDir, analysis);

      // Aggiorna il backup
      await prisma.backupUpload.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.IMPORTED,
          projectId: project.id,
          projectPath: extractDir,
          processedAt: new Date(),
        },
      });

      // Notifica successo import
      try {
        await notificationService.create({
          userId,
          type: 'SUCCESS',
          title: `Import completato: ${project.name}`,
          message: `Il backup è stato importato e il progetto "${project.name}" è stato creato con successo.`,
          actionLabel: 'Vai al progetto',
          actionHref: `/dashboard/projects/${project.id}`,
          source: 'backup-import',
          sourceId: project.id,
        });
      } catch (notifErr) {
        log.error('[Backup Import] Errore invio notifica:', notifErr);
      }

      return project;
    } catch (error) {
      log.error('[Backup Import] Error:', error);

      // Aggiorna status a FAILED
      await prisma.backupUpload.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // If project was created, mark as FAILED
      if (project) {
        await prisma.project.update({
          where: { id: project.id },
          data: { status: ProjectStatus.ERROR },
        }).catch(() => {});
      }

      // Notifica fallimento import
      try {
        await notificationService.create({
          userId,
          type: 'ERROR',
          title: `Import fallito`,
          message: `L'import del backup è fallito: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
          priority: 'HIGH',
          source: 'backup-import',
          sourceId: backupId,
        });
      } catch (notifErr) {
        log.error('[Backup Import] Errore invio notifica fallimento:', notifErr);
      }

      throw error;
    }
  }

  /**
   * Elimina un backup
   */
  async deleteBackup(backupId: string, userId: string) {
    const backup = await this.getBackup(backupId, userId);
    if (!backup) {
      throw new Error('Backup non trovato');
    }

    // Elimina il file fisico
    try {
      await rm(backup.filepath, { force: true });
    } catch (error) {
      log.error('Errore eliminando file:', error);
    }

    // Elimina il record dal database
    await prisma.backupUpload.delete({
      where: { id: backupId },
    });

    return { success: true };
  }

  /**
   * Cleanup automatico backup scaduti
   */
  async cleanupExpiredBackups(): Promise<number> {
    const now = new Date();

    // Trova backup scaduti
    const expiredBackups = await prisma.backupUpload.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
        status: {
          in: [BackupStatus.UPLOADED, BackupStatus.FAILED],
        },
      },
    });

    let cleaned = 0;

    for (const backup of expiredBackups) {
      try {
        await rm(backup.filepath, { force: true });
        await prisma.backupUpload.update({
          where: { id: backup.id },
          data: {
            status: BackupStatus.EXPIRED,
            deletedAt: now,
          },
        });
        cleaned++;
      } catch (error) {
        log.error(`Errore cleanup backup ${backup.id}:`, error);
      }
    }

    log.info(`[Cleanup] Eliminati ${cleaned} backup scaduti`);
    return cleaned;
  }

  /**
   * Verifica se l'utente ha accesso al progetto
   */
  private async canAccessProject(projectId: string, userId: string, userRole: UserRole): Promise<boolean> {
    // Admin can access everything
    if (userRole === 'ADMIN') return true;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId } } }
    });

    if (!project) return false;

    // Owner O member
    return project.userId === userId || project.members.length > 0;
  }

  /**
   * Esporta un progetto come backup tar.gz
   * Delegates to BackupExportService for the actual export logic.
   */
  async exportProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
    notes?: string
  ): Promise<{
    backup: any;
    downloadToken: string;
    downloadUrl: string;
  }> {
    return backupExportService.exportProject(projectId, userId, userRole, notes);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + randomBytes(4).toString('hex');
  }

  private detectTemplate(analysis: Record<string, any>): ProjectTemplate {
    if (analysis.detectedFramework === 'nextjs') return 'NEXTJS' as ProjectTemplate;
    if (analysis.detectedFramework === 'nestjs') return 'NODEJS' as ProjectTemplate;
    if (analysis.detectedFramework === 'express') return 'NODEJS' as ProjectTemplate;
    if (analysis.detectedFramework === 'fastify') return 'NODEJS' as ProjectTemplate;
    if (analysis.detectedFramework === 'wordpress') return 'WORDPRESS' as ProjectTemplate;
    if (analysis.hasDockerCompose) return 'CUSTOM' as ProjectTemplate;
    return 'STATIC' as ProjectTemplate;
  }

  /**
   * Deploy an imported project automatically
   */
  private async deployImportedProject(
    project: any,
    projectPath: string,
    _analysis: any
  ): Promise<void> {
    log.info(`[Backup Import] Starting deployment for project ${project.slug}`);

    try {
      // Check if docker-compose.yml exists
      const dockerComposePath = join(projectPath, 'docker-compose.yml');
      const hasDockerCompose = await this.fileExists(dockerComposePath);

      if (!hasDockerCompose) {
        log.info('[Backup Import] No docker-compose.yml found, skipping deployment');
        log.info('[Backup Import] User must manually create docker-compose.yml');
        return;
      }

      // Check if .env exists, if not try to generate from .env.example
      const envPath = join(projectPath, '.env');
      const envExamplePath = join(projectPath, '.env.example');
      const hasEnv = await this.fileExists(envPath);

      if (!hasEnv) {
        const hasEnvExample = await this.fileExists(envExamplePath);

        if (hasEnvExample) {
          log.info('[Backup Import] Generating .env from .env.example');
          await this.generateEnvFromExample(envExamplePath, envPath);
        } else {
          log.info('[Backup Import] No .env or .env.example found, creating basic .env');
          await this.generateBasicEnv(envPath, project.slug);
        }
      }

      // Deploy with docker-compose
      log.info('[Backup Import] Deploying with docker-compose up -d');
      await dockerService.composeUp(projectPath);

      // Update project with deployment time
      await prisma.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.ACTIVE,
          lastDeployAt: new Date(),
        },
      });

      log.info(`[Backup Import] ✅ Deployment successful for ${project.slug}`);
    } catch (error) {
      log.error('[Backup Import] Deployment error:', error);

      // Update project status to FAILED
      await prisma.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.ERROR,
          notes: project.notes + `\n\nDeployment error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });

      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate .env from .env.example with secure passwords
   */
  private async generateEnvFromExample(
    examplePath: string,
    targetPath: string
  ): Promise<void> {
    const exampleContent = await readFile(examplePath, 'utf-8');

    // Replace placeholder values with secure generated ones
    let envContent = exampleContent;

    // Generate secure passwords for common placeholders
    const replacements: Record<string, string> = {
      'your-password-here': this.generatePassword(32),
      'change-this-password': this.generatePassword(32),
      'secret-key-here': this.generatePassword(64),
      'your-secret-here': this.generatePassword(64),
      'jwt-secret': this.generatePassword(64),
      'database-password': this.generatePassword(32),
      'db-password': this.generatePassword(32),
      'CHANGE_ME': this.generatePassword(32),
      'changeme': this.generatePassword(32),
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      envContent = envContent.replace(new RegExp(placeholder, 'gi'), value);
    }

    // Also handle empty values after = sign
    envContent = envContent.replace(/^([A-Z_]+)=\s*$/gm, (match, key) => {
      if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
        return `${key}=${this.generatePassword(32)}`;
      }
      return match;
    });

    await writeFile(targetPath, envContent);
    log.info('[Backup Import] Generated .env with secure passwords');
  }

  /**
   * Generate basic .env file with common variables
   */
  private async generateBasicEnv(envPath: string, projectSlug: string): Promise<void> {
    const content = `# Generated by VPS Control Panel
# Created: ${new Date().toISOString()}

NODE_ENV=production
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=${projectSlug.replace(/-/g, '_')}_db
DB_USER=postgres
DB_PASSWORD=${this.generatePassword(32)}

# Security
JWT_SECRET=${this.generatePassword(64)}
API_KEY=${this.generatePassword(32)}

# Application
APP_URL=http://${projectSlug}.preview.local
`;

    await writeFile(envPath, content);
    log.info('[Backup Import] Generated basic .env file');
  }

  /**
   * Generate secure random password
   */
  private generatePassword(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}

export const backupService = new BackupService();
