import { Database, UserRole } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { BackupStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { mkdir, rm, writeFile, stat, access, constants } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { safeExec, safePgDump } from '../../utils/shell-sanitizer';
import { downloadTokenService } from '../../services/download-token.service';
import log from '../../services/logger.service';
import { notificationService } from '../../services/notification.service';
import type { Domain, Container } from '@prisma/client';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/uploads';
const BACKUP_EXPIRY_HOURS = parseInt(process.env.BACKUP_EXPIRY_HOURS || '24');

// Helper to convert BigInt fields to Number for JSON serialization
function serializeBackup<T extends Record<string, unknown>>(backup: T | null): T | null {
  if (!backup) return backup;
  return {
    ...backup,
    size: typeof backup.size === 'bigint' ? Number(backup.size) : backup.size,
  };
}

class BackupExportService {
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
   * Esporta un progetto come backup tar.gz
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
    // 1. Verifica accesso
    const hasAccess = await this.canAccessProject(projectId, userId, userRole);
    if (!hasAccess) {
      throw new Error('Non hai accesso a questo progetto');
    }

    // 2. Ottieni progetto con relazioni
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        databases: true,
        containers: true,
        domains: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!project) {
      throw new Error('Progetto non trovato');
    }

    if (!project.path || !(await this.fileExists(project.path))) {
      throw new Error('Directory del progetto non trovata');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${project.slug}-backup-${timestamp}.tar.gz`;
    const filepath = join(UPLOADS_DIR, filename);
    const tempDir = join('/tmp', `export-${project.slug}-${Date.now()}`);

    log.info(`[Backup Export] Starting export for project ${project.slug}`);

    try {
      // 3. Crea directory temporanea
      await mkdir(tempDir, { recursive: true });
      await mkdir(join(tempDir, 'project'), { recursive: true });
      await mkdir(join(tempDir, 'databases'), { recursive: true });

      // 4. Copia file del progetto (escludendo node_modules, .next, etc.)
      log.info('[Backup Export] Copying project files...');
      await this.copyProjectFilesForExport(project.path, join(tempDir, 'project'));

      // 5. Export database associati (parallelizzato con concurrency limit)
      log.info('[Backup Export] Exporting databases...');
      const DB_EXPORT_CONCURRENCY = 3;
      for (let i = 0; i < project.databases.length; i += DB_EXPORT_CONCURRENCY) {
        const batch = project.databases.slice(i, i + DB_EXPORT_CONCURRENCY);
        await Promise.allSettled(
          batch.map(db =>
            this.exportDatabaseForBackup(db, join(tempDir, 'databases'), project.slug)
              .catch(err => {
                log.error(`[Backup Export] Failed to export database ${db.name}:`, err instanceof Error ? err.message : 'Unknown error');
              })
          )
        );
      }

      // 6. Genera manifest.json
      log.info('[Backup Export] Generating manifest...');
      await this.generateBackupManifest(project, tempDir);

      // 7. Crea archivio tar.gz
      log.info('[Backup Export] Creating archive...');
      await safeExec('tar', [
        'czf', filepath,
        '-C', tempDir,
        '.'
      ], { timeout: 600000 }); // 10 min

      // 8. Ottieni dimensione e checksum
      const stats = await stat(filepath);
      const checksum = await this.calculateChecksum(filepath);

      // 9. Pulisci temp directory
      await rm(tempDir, { recursive: true, force: true });

      // 10. Calcola scadenza (24h)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + BACKUP_EXPIRY_HOURS);

      // 11. Salva record nel database
      const backup = await prisma.backupUpload.create({
        data: {
          userId,
          filename,
          originalName: `${project.name} Backup`,
          filepath,
          size: BigInt(stats.size),
          mimeType: 'application/gzip',
          status: BackupStatus.EXPORTED,
          projectId: project.id,
          notes: notes || `Backup esportato: ${project.name}`,
          expiresAt,
        },
      });

      // 12. Genera token di download
      const { token } = await downloadTokenService.generateToken({
        userId,
        resourceType: 'backup',
        resourceId: backup.id,
        filePath: filepath,
      }, 30 * 60 * 1000); // 30 minuti

      log.info(`[Backup Export] ✅ Export completed: ${filename} (${this.formatBytes(stats.size)})`);

      // Notifica successo export
      try {
        await notificationService.create({
          userId,
          type: 'SUCCESS',
          title: `Backup completato: ${project.name}`,
          message: `Export backup completato (${this.formatBytes(stats.size)}). Download disponibile per 30 minuti.`,
          actionLabel: 'Vai ai backup',
          actionHref: `/dashboard/backup`,
          source: 'backup-export',
          sourceId: backup.id,
        });
      } catch (notifErr) {
        log.error('[Backup Export] Errore invio notifica:', notifErr);
      }

      return {
        backup: {
          ...serializeBackup(backup),
          checksum,
        },
        downloadToken: token,
        downloadUrl: `/backups/download/${token}`,
      };

    } catch (error) {
      log.error('[Backup Export] Error:', error);

      // Notifica fallimento export
      try {
        await notificationService.create({
          userId,
          type: 'ERROR',
          title: `Backup fallito: ${project.name}`,
          message: `Export backup fallito: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
          priority: 'HIGH',
          source: 'backup-export',
          sourceId: projectId,
        });
      } catch (notifErr) {
        log.error('[Backup Export] Errore invio notifica fallimento:', notifErr);
      }

      // Cleanup su errore
      try {
        await rm(tempDir, { recursive: true, force: true });
        await rm(filepath, { force: true });
      } catch (_e) {}

      throw error;
    }
  }

  /**
   * Copia file progetto escludendo directory pesanti
   */
  private async copyProjectFilesForExport(sourcePath: string, destPath: string): Promise<void> {
    // Prima copia tutto con cp -r
    await safeExec('cp', ['-r', `${sourcePath}/.`, destPath], { timeout: 300000 });

    // Poi rimuovi le directory non necessarie
    const excludeDirs = [
      'node_modules',
      '.next',
      '.git',
      'dist',
      'build',
      'vendor',
      '__pycache__',
      '.cache',
      'coverage',
    ];

    for (const dir of excludeDirs) {
      const targetPath = join(destPath, dir);
      try {
        await rm(targetPath, { recursive: true, force: true });
      } catch {
        // Directory might not exist, ignore
      }
    }

    // Rimuovi i file .log
    try {
      await safeExec('find', [destPath, '-name', '*.log', '-type', 'f', '-delete'], { timeout: 60000 });
    } catch {
      // Ignore find errors
    }
  }

  /**
   * Esporta un database per il backup
   */
  private async exportDatabaseForBackup(db: Database, destDir: string, projectSlug: string): Promise<void> {
    const dumpFile = join(destDir, `${db.name}-${db.type.toLowerCase()}.sql`);

    // Validate database name and username to prevent injection
    const DB_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    if (!DB_IDENTIFIER_PATTERN.test(db.databaseName)) {
      log.error(`[Backup Export] Invalid database name rejected: ${db.databaseName}`);
      return;
    }
    if (db.username && !DB_IDENTIFIER_PATTERN.test(db.username)) {
      log.error(`[Backup Export] Invalid database username rejected: ${db.username}`);
      return;
    }

    // Decrypt password using isEncrypted() check
    let password = db.password;
    try {
      const { encryptionService } = await import('../../services/encryption.service');
      if (encryptionService.isEncrypted(db.password)) {
        password = encryptionService.decrypt(db.password);
      } else {
        log.warn(`[Backup Export] Password for ${db.name} is not encrypted`);
      }
    } catch (decryptErr) {
      log.error(`[Backup Export] Failed to decrypt password for ${db.name}: ${decryptErr instanceof Error ? decryptErr.message : 'Unknown'}`);
      return;
    }

    switch (db.type) {
      case 'POSTGRESQL': {
        // Trova il container postgres del progetto
        const pgContainerName = `${projectSlug}-postgres`;
        try {
          // Prima prova via docker exec
          await safeExec('docker', [
            'exec', pgContainerName,
            'pg_dump', '-U', db.username, db.databaseName
          ], {
            timeout: 300000,
            env: { ...process.env }
          }).then(async (result) => {
            await writeFile(dumpFile, result.stdout);
          });
        } catch {
          // Fallback: connessione diretta se il container ha un nome diverso
          log.info(`[Backup Export] Docker exec failed, trying direct connection for ${db.name}`);
          try {
            await safePgDump({
              host: db.host || 'localhost',
              user: db.username,
              database: db.databaseName,
              password: password,
              outputFile: dumpFile,
            });
          } catch (e) {
            log.error(`[Backup Export] pg_dump failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
        break;
      }

      case 'MYSQL': {
        const mysqlContainerName = `${projectSlug}-mysql`;
        try {
          // Use MYSQL_PWD env var instead of -p flag to avoid password in process list
          await safeExec('docker', [
            'exec', '-e', `MYSQL_PWD=${password}`, mysqlContainerName,
            'mysqldump', '-u', db.username, db.databaseName
          ], { timeout: 300000 }).then(async (result) => {
            await writeFile(dumpFile, result.stdout);
          });
        } catch (e) {
          log.error(`[Backup Export] mysqldump failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        break;
      }

      case 'MONGODB': {
        const mongoContainerName = `${projectSlug}-mongo`;
        const mongoArchive = join(destDir, `${db.name}-mongodb.archive`);
        try {
          await safeExec('docker', [
            'exec', mongoContainerName,
            'mongodump', '--archive=/tmp/dump.archive', '--db', db.databaseName
          ], { timeout: 300000 });
          await safeExec('docker', [
            'cp', `${mongoContainerName}:/tmp/dump.archive`, mongoArchive
          ], { timeout: 60000 });
        } catch (e) {
          log.error(`[Backup Export] mongodump failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        break;
      }

      case 'REDIS': {
        const redisContainerName = `${projectSlug}-redis`;
        const rdbFile = join(destDir, `${db.name}-redis-dump.rdb`);
        try {
          await safeExec('docker', [
            'exec', redisContainerName,
            'redis-cli', 'BGSAVE'
          ], { timeout: 30000 });
          // Aspetta che il save sia completato
          await new Promise(resolve => setTimeout(resolve, 2000));
          await safeExec('docker', [
            'cp', `${redisContainerName}:/data/dump.rdb`, rdbFile
          ], { timeout: 60000 });
        } catch (e) {
          log.error(`[Backup Export] Redis dump failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        break;
      }

      default:
        log.info(`[Backup Export] Unsupported database type: ${db.type}`);
    }
  }

  /**
   * Genera il file manifest.json con metadati del backup
   */
  private async generateBackupManifest(project: any, destDir: string): Promise<void> {
    const manifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      panelVersion: process.env.npm_package_version || '1.0.0',
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        template: project.template,
        status: project.status,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        tags: project.tags,
        notes: project.notes,
      },
      databases: project.databases?.map((db: Database) => ({
        name: db.name,
        type: db.type,
        databaseName: db.databaseName,
        // Non includere password nel manifest
      })),
      domains: project.domains?.map((d: Domain) => ({
        domain: d.domain,
        type: d.type,
        sslEnabled: d.sslEnabled,
      })) || [],
      containers: project.containers?.map((c: Container) => ({
        name: c.name,
        image: c.image,
      })) || [],
      members: project.members?.map((m: any) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })) || [],
    };

    await writeFile(
      join(destDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  /**
   * Calcola checksum SHA256 del file
   */
  private async calculateChecksum(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filepath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Formatta bytes in formato leggibile
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const backupExportService = new BackupExportService();
