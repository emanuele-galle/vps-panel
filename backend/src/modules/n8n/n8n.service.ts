import Docker from 'dockerode';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHmac } from 'crypto';
import { config } from '../../config/env';
import { prisma } from '../../services/prisma.service';
import { validatePath } from '../../utils/shell-sanitizer';
import type {
  N8nStatus,
  N8nStats,
  N8nWorkflow,
  N8nBackupResult,
  N8nRestoreResult,
  N8nSsoToken,
} from './n8n.types';
import log from '../../services/logger.service';

const execAsync = promisify(exec);

const N8N_CONTAINER_NAME = 'vps-panel-n8n';
const N8N_POSTGRES_CONTAINER_NAME = 'vps-panel-n8n-postgres';
const N8N_INTERNAL_URL = 'http://vps-panel-n8n:5678';
const N8N_BACKUP_DIR = '/var/backups/vps-panel/n8n';

export class N8nService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: config.DOCKER_SOCKET });
  }

  /**
   * Get N8N container status
   */
  async getStatus(): Promise<N8nStatus> {
    const panelDomain = process.env.PANEL_DOMAIN || 'localhost';
    const n8nUrl = `https://n8n.${panelDomain}`;

    try {
      const containers = await this.docker.listContainers({ all: true });
      const n8nContainer = containers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        return {
          running: false,
          url: n8nUrl,
        };
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      const info = await container.inspect();

      const startedAt = info.State.StartedAt;
      let uptime = '';
      if (startedAt && info.State.Running) {
        const startTime = new Date(startedAt).getTime();
        const now = Date.now();
        const diff = now - startTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        uptime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      // Try to get N8N version from API
      let version = 'unknown';
      if (info.State.Running) {
        try {
          const response = await axios.get(`${N8N_INTERNAL_URL}/healthz`, {
            timeout: 3000,
          });
          if (response.status === 200) {
            version = response.data?.version || 'latest';
          }
        } catch {
          version = info.Config.Image?.split(':')[1] || 'latest';
        }
      }

      return {
        running: info.State.Running,
        containerId: n8nContainer.Id,
        containerName: N8N_CONTAINER_NAME,
        state: info.State.Status,
        health: info.State.Health?.Status || 'unknown',
        uptime,
        startedAt: info.State.StartedAt,
        version,
        url: n8nUrl,
      };
    } catch (_error) {
      return {
        running: false,
        url: n8nUrl,
      };
    }
  }

  /**
   * Start N8N containers
   */
  async start(): Promise<{ success: boolean; message: string }> {
    try {
      // Start n8n-postgres first
      const postgresContainers = await this.docker.listContainers({ all: true });
      const pgContainer = postgresContainers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_POSTGRES_CONTAINER_NAME
      );

      if (pgContainer) {
        const pg = this.docker.getContainer(pgContainer.Id);
        const pgInfo = await pg.inspect();
        if (!pgInfo.State.Running) {
          await pg.start();
          // Wait for postgres to be ready
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      // Start n8n container
      const n8nContainers = await this.docker.listContainers({ all: true });
      const n8nContainer = n8nContainers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        // Container doesn't exist, need to use docker compose
        await execAsync('docker compose up -d n8n-postgres n8n', {
          cwd: '/root/vps-panel',
        });
        return { success: true, message: 'N8N avviato con successo' };
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      const info = await container.inspect();

      if (info.State.Running) {
        return { success: true, message: 'N8N è già in esecuzione' };
      }

      await container.start();
      return { success: true, message: 'N8N avviato con successo' };
    } catch (error) {
      throw new Error(`Errore avvio N8N: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop N8N containers
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const n8nContainer = containers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        return { success: true, message: 'N8N non è in esecuzione' };
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      const info = await container.inspect();

      if (!info.State.Running) {
        return { success: true, message: 'N8N è già fermo' };
      }

      await container.stop();
      return { success: true, message: 'N8N fermato con successo' };
    } catch (error) {
      throw new Error(`Errore stop N8N: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restart N8N container
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const n8nContainer = containers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        return this.start();
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      await container.restart();
      return { success: true, message: 'N8N riavviato con successo' };
    } catch (error) {
      throw new Error(`Errore restart N8N: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get N8N container logs
   */
  async getLogs(tail: number = 200): Promise<string> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const n8nContainer = containers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        return 'Container N8N non trovato';
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      return logs.toString('utf-8');
    } catch (error) {
      throw new Error(`Errore lettura logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get N8N container stats
   */
  async getStats(): Promise<N8nStats> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const n8nContainer = containers.find(
        (c) => c.Names?.[0]?.replace(/^\//, '') === N8N_CONTAINER_NAME
      );

      if (!n8nContainer) {
        throw new Error('Container N8N non trovato');
      }

      const container = this.docker.getContainer(n8nContainer.Id);
      const info = await container.inspect();

      if (!info.State.Running) {
        return {
          cpu: 0,
          memory: { used: 0, limit: 0, percentage: 0 },
          network: { received: 0, transmitted: 0 },
        };
      }

      const stats = await container.stats({ stream: false });

      // Calculate CPU percentage
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        systemDelta > 0
          ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100
          : 0;

      // Calculate memory percentage
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 1;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: {
          used: memoryUsage,
          limit: memoryLimit,
          percentage: Math.round(memoryPercent * 100) / 100,
        },
        network: {
          received: stats.networks?.eth0?.rx_bytes || 0,
          transmitted: stats.networks?.eth0?.tx_bytes || 0,
        },
      };
    } catch (error) {
      throw new Error(`Errore lettura stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get workflows from N8N API
   */
  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const status = await this.getStatus();
      if (!status.running) {
        return [];
      }

      // N8N requires authentication, we use internal API
      const response = await axios.get(`${N8N_INTERNAL_URL}/api/v1/workflows`, {
        timeout: 10000,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.data?.data) {
        return response.data.data.map((w: any) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          nodes: w.nodes?.length || 0,
        }));
      }

      return [];
    } catch (error) {
      // N8N may require authentication for API access
      log.error('N8N API error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Create backup of N8N workflows and credentials
   */
  async createBackup(userId: string): Promise<N8nBackupResult> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(N8N_BACKUP_DIR, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `n8n-backup-${timestamp}.json`;
      const filePath = path.join(N8N_BACKUP_DIR, filename);

      const status = await this.getStatus();
      if (!status.running) {
        throw new Error('N8N non è in esecuzione. Avvialo prima di fare il backup.');
      }

      // Export workflows using docker exec
      const { stdout: workflowsJson } = await execAsync(
        `docker exec ${N8N_CONTAINER_NAME} n8n export:workflow --all --output=/dev/stdout 2>/dev/null || echo "[]"`,
        { maxBuffer: 50 * 1024 * 1024 }
      );

      // Export credentials (encrypted)
      const { stdout: credentialsJson } = await execAsync(
        `docker exec ${N8N_CONTAINER_NAME} n8n export:credentials --all --output=/dev/stdout 2>/dev/null || echo "[]"`,
        { maxBuffer: 50 * 1024 * 1024 }
      );

      let workflows = [];
      let credentials = [];

      try {
        workflows = JSON.parse(workflowsJson.trim() || '[]');
      } catch {
        workflows = [];
      }

      try {
        credentials = JSON.parse(credentialsJson.trim() || '[]');
      } catch {
        credentials = [];
      }

      const backupData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        createdBy: userId,
        workflows,
        credentials,
      };

      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));

      const stats = await fs.stat(filePath);

      // Save backup record to database
      await prisma.n8nBackup.create({
        data: {
          filename,
          path: filePath,
          size: BigInt(stats.size),
          workflows: Array.isArray(workflows) ? workflows.length : 0,
          credentials: Array.isArray(credentials) ? credentials.length : 0,
          createdBy: userId,
        },
      });

      return {
        success: true,
        filename,
        path: filePath,
        size: stats.size,
        workflows: Array.isArray(workflows) ? workflows.length : 0,
        credentials: Array.isArray(credentials) ? credentials.length : 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Errore backup N8N: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore N8N from backup
   */
  async restoreBackup(backupId: string): Promise<N8nRestoreResult> {
    try {
      const backup = await prisma.n8nBackup.findUnique({
        where: { id: backupId },
      });

      if (!backup) {
        throw new Error('Backup non trovato');
      }

      // SECURITY: Validate backup path is within allowed directory
      if (!validatePath(backup.path, [N8N_BACKUP_DIR])) {
        log.error(`[SECURITY] Invalid backup path detected: ${backup.path}`);
        throw new Error('Percorso backup non valido');
      }

      const status = await this.getStatus();
      if (!status.running) {
        throw new Error('N8N non è in esecuzione. Avvialo prima del restore.');
      }

      // Read backup file (path has been validated)
      const backupContent = await fs.readFile(backup.path, 'utf-8');
      const backupData = JSON.parse(backupContent);

      const errors: string[] = [];
      let workflowsRestored = 0;
      let credentialsRestored = 0;

      // Restore workflows
      if (backupData.workflows?.length > 0) {
        const workflowsFile = '/tmp/n8n-workflows-restore.json';
        await fs.writeFile(workflowsFile, JSON.stringify(backupData.workflows));

        try {
          await execAsync(
            `docker cp ${workflowsFile} ${N8N_CONTAINER_NAME}:/tmp/workflows.json && ` +
              `docker exec ${N8N_CONTAINER_NAME} n8n import:workflow --input=/tmp/workflows.json`
          );
          workflowsRestored = backupData.workflows.length;
        } catch (e) {
          errors.push(`Errore restore workflows: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }

      // Restore credentials
      if (backupData.credentials?.length > 0) {
        const credentialsFile = '/tmp/n8n-credentials-restore.json';
        await fs.writeFile(credentialsFile, JSON.stringify(backupData.credentials));

        try {
          await execAsync(
            `docker cp ${credentialsFile} ${N8N_CONTAINER_NAME}:/tmp/credentials.json && ` +
              `docker exec ${N8N_CONTAINER_NAME} n8n import:credentials --input=/tmp/credentials.json`
          );
          credentialsRestored = backupData.credentials.length;
        } catch (e) {
          errors.push(`Errore restore credentials: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        workflows: workflowsRestored,
        credentials: credentialsRestored,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      throw new Error(`Errore restore N8N: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all backups
   */
  async listBackups() {
    return prisma.n8nBackup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = await prisma.n8nBackup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new Error('Backup non trovato');
    }

    // SECURITY: Validate backup path before deletion
    if (!validatePath(backup.path, [N8N_BACKUP_DIR])) {
      log.error(`[SECURITY] Attempted to delete file outside backup dir: ${backup.path}`);
      throw new Error('Percorso backup non valido');
    }

    // Delete file (path has been validated)
    try {
      await fs.unlink(backup.path);
    } catch {
      // File may already be deleted
    }

    // Delete record
    await prisma.n8nBackup.delete({
      where: { id: backupId },
    });
  }

  /**
   * Generate SSO token for N8N access
   */
  async generateSsoToken(userId: string, userEmail: string): Promise<N8nSsoToken> {
    const panelDomain = process.env.PANEL_DOMAIN || 'localhost';
    const n8nUrl = `https://n8n.${panelDomain}`;

    // Generate JWT token compatible with N8N
    // N8N uses its own user management, so we redirect to the app
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 300; // 5 minutes
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: userId, email: userEmail, iat, exp })).toString('base64url');
    const signature = createHmac('sha256', config.JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    const token = `${header}.${payload}.${signature}`;

    return {
      token,
      url: n8nUrl,
      expiresIn: 300, // 5 minutes
    };
  }

  /**
   * Get N8N configuration from database
   */
  async getConfig() {
    let configRecord = await prisma.n8nConfig.findFirst();

    if (!configRecord) {
      configRecord = await prisma.n8nConfig.create({
        data: {
          enabled: true,
          autoStart: true,
          backupEnabled: true,
          backupSchedule: '0 3 * * *',
          retentionDays: 30,
        },
      });
    }

    return configRecord;
  }

  /**
   * Update N8N configuration
   */
  async updateConfig(data: {
    enabled?: boolean;
    autoStart?: boolean;
    backupEnabled?: boolean;
    backupSchedule?: string;
    retentionDays?: number;
  }) {
    let configRecord = await prisma.n8nConfig.findFirst();

    if (!configRecord) {
      configRecord = await prisma.n8nConfig.create({
        data: {
          enabled: data.enabled ?? true,
          autoStart: data.autoStart ?? true,
          backupEnabled: data.backupEnabled ?? true,
          backupSchedule: data.backupSchedule ?? '0 3 * * *',
          retentionDays: data.retentionDays ?? 30,
        },
      });
    } else {
      configRecord = await prisma.n8nConfig.update({
        where: { id: configRecord.id },
        data,
      });
    }

    return configRecord;
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    const configRecord = await this.getConfig();
    const retentionDays = configRecord.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackups = await prisma.n8nBackup.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    let deletedCount = 0;
    for (const backup of oldBackups) {
      try {
        // SECURITY: Validate path before deletion
        if (validatePath(backup.path, [N8N_BACKUP_DIR])) {
          await fs.unlink(backup.path);
          deletedCount++;
        } else {
          log.error(`[SECURITY] Skipping deletion of file outside backup dir: ${backup.path}`);
        }
      } catch {
        // File may already be deleted
      }
    }

    await prisma.n8nBackup.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return deletedCount;
  }
}

export const n8nService = new N8nService();
