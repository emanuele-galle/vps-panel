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

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/uploads';
const PROJECTS_DIR = '/var/www/projects';
const BACKUP_EXPIRY_HOURS = parseInt(process.env.BACKUP_EXPIRY_HOURS || '24');

// Helper to convert BigInt fields to Number for JSON serialization
function serializeBackup(backup: any): Record<string, any> {
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

      // 5. Export database associati
      log.info('[Backup Export] Exporting databases...');
      for (const db of project.databases) {
        try {
          await this.exportDatabaseForBackup(db, join(tempDir, 'databases'), project.slug);
        } catch (err) {
          log.error(`[Backup Export] Failed to export database ${db.name}:`, err instanceof Error ? err.message : 'Unknown error');
          // Continua con gli altri database
        }
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

    // Decrypt password se necessario
    let password = db.password;
    try {
      // Prova a decriptare usando il servizio di encryption esistente
      const { encryptionService } = await import('../../services/encryption.service');
      password = encryptionService.decrypt(db.password);
    } catch {
      // Se fallisce, usa la password come è (potrebbe essere già in chiaro)
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
          await safeExec('docker', [
            'exec', mysqlContainerName,
            'mysqldump', '-u', db.username, `-p${password}`, db.databaseName
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
