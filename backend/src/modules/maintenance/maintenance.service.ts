import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../../services/prisma.service';
import { systemSettingsService } from '../system-settings/system-settings.service';
import {
  MaintenanceResult,
  MaintenanceReport,
  N8NCleanupOptions,
  DockerCleanupOptions,
  LogsCleanupOptions,
} from './maintenance.types';
import log from '../../services/logger.service';

const execAsync = promisify(exec);

class MaintenanceService {
  private lastReport: MaintenanceReport | null = null;

  async runFullMaintenance(): Promise<MaintenanceReport> {
    const startTime = new Date();
    const results: MaintenanceResult[] = [];

    log.info('[Maintenance] Avvio manutenzione completa...');

    // 1. Pulizia N8N
    try {
      const n8nResult = await this.cleanupN8N({ olderThanDays: 7 });
      results.push(n8nResult);
    } catch (error) {
      results.push({
        task: 'n8n_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        timestamp: new Date(),
      });
    }

    // 2. Pulizia Docker
    try {
      const dockerResult = await this.cleanupDocker({
        pruneImages: true,
        pruneBuildCache: true,
        pruneNetworks: true,
        pruneVolumes: false,
      });
      results.push(dockerResult);
    } catch (error) {
      results.push({
        task: 'docker_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        timestamp: new Date(),
      });
    }

    // 3. Pulizia Log Container
    try {
      const logsResult = await this.cleanupContainerLogs({ maxSizeMB: 50 });
      results.push(logsResult);
    } catch (error) {
      results.push({
        task: 'container_logs_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        timestamp: new Date(),
      });
    }

    // 4. Pulizia Activity Logs vecchi
    try {
      const activityResult = await this.cleanupActivityLogs();
      results.push(activityResult);
    } catch (error) {
      results.push({
        task: 'activity_logs_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        timestamp: new Date(),
      });
    }

    // 5. Pulizia Claude Code
    try {
      const claudeResult = await this.cleanupClaudeCode();
      results.push(claudeResult);
    } catch (error) {
      results.push({
        task: 'claude_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        timestamp: new Date(),
      });
    }

    const endTime = new Date();
    const totalFreedSpace = this.calculateTotalFreedSpace(results);

    this.lastReport = {
      startTime,
      endTime,
      totalDuration: endTime.getTime() - startTime.getTime(),
      results,
      totalFreedSpace,
    };

    await this.saveMaintenanceLog(this.lastReport);
    log.info(`[Maintenance] Completata in ${this.lastReport.totalDuration}ms - Spazio liberato: ${totalFreedSpace}`);

    return this.lastReport;
  }

  async cleanupN8N(options: N8NCleanupOptions = {}): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const olderThanDays = options.olderThanDays || 7;

    try {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - olderThanDays);
      const limitTimestamp = limitDate.toISOString();

      const { stdout } = await execAsync(
        `docker exec vps-panel-n8n-postgres psql -U n8n -d n8n -t -c "DELETE FROM execution_entity WHERE \\"stoppedAt\\" < '${limitTimestamp}' RETURNING id;" 2>/dev/null | wc -l`
      );

      const deletedCount = parseInt(stdout.trim()) || 0;

      return {
        task: 'n8n_cleanup',
        success: true,
        message: `Eliminate ${deletedCount} esecuzioni N8N > ${olderThanDays} giorni`,
        itemsRemoved: deletedCount,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch {
      return {
        task: 'n8n_cleanup',
        success: true,
        message: 'Nessuna esecuzione N8N da pulire',
        itemsRemoved: 0,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  async cleanupDocker(options: DockerCleanupOptions = {}): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let totalFreed = 0;
    const messages: string[] = [];

    try {
      if (options.pruneImages !== false) {
        const { stdout } = await execAsync('docker image prune -af 2>&1 | tail -1');
        const match = stdout.match(/(\d+\.?\d*)\s*(GB|MB|KB|B)/i);
        if (match) {
          totalFreed += this.convertToBytes(parseFloat(match[1]), match[2].toUpperCase());
          messages.push(`Immagini: ${match[0]}`);
        }
      }

      if (options.pruneBuildCache !== false) {
        const { stdout } = await execAsync('docker builder prune -af 2>&1 | tail -1');
        const match = stdout.match(/(\d+\.?\d*)\s*(GB|MB|KB|B)/i);
        if (match) {
          totalFreed += this.convertToBytes(parseFloat(match[1]), match[2].toUpperCase());
          messages.push(`Build cache: ${match[0]}`);
        }
      }

      if (options.pruneNetworks !== false) {
        await execAsync('docker network prune -f 2>&1');
        messages.push('Network orfani rimossi');
      }

      if (options.pruneVolumes === true) {
        const { stdout } = await execAsync('docker volume prune -f 2>&1 | tail -1');
        const match = stdout.match(/(\d+\.?\d*)\s*(GB|MB|KB|B)/i);
        if (match) {
          totalFreed += this.convertToBytes(parseFloat(match[1]), match[2].toUpperCase());
          messages.push(`Volumi: ${match[0]}`);
        }
      }

      return {
        task: 'docker_cleanup',
        success: true,
        message: messages.length > 0 ? messages.join(', ') : 'Nessun elemento da pulire',
        freedSpace: this.formatBytes(totalFreed),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        task: 'docker_cleanup',
        success: false,
        message: `Errore Docker: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  async cleanupContainerLogs(options: LogsCleanupOptions = {}): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const maxSizeMB = options.maxSizeMB || 50;

    try {
      const { stdout: containers } = await execAsync('docker ps -q');
      const containerIds = containers.trim().split('\n').filter(Boolean);

      let truncatedCount = 0;
      let totalFreed = 0;

      for (const containerId of containerIds) {
        try {
          const { stdout: logPath } = await execAsync(
            `docker inspect --format='{{.LogPath}}' ${containerId} 2>/dev/null`
          );
          const path = logPath.trim();
          
          if (path && path !== '<nil>') {
            const { stdout: sizeOutput } = await execAsync(`stat -c%s "${path}" 2>/dev/null || echo 0`);
            const sizeBytes = parseInt(sizeOutput.trim()) || 0;
            const sizeMB = sizeBytes / (1024 * 1024);

            if (sizeMB > maxSizeMB) {
              await execAsync(`truncate -s 0 "${path}"`);
              truncatedCount++;
              totalFreed += sizeBytes;
            }
          }
        } catch {}
      }

      return {
        task: 'container_logs_cleanup',
        success: true,
        message: `Troncati ${truncatedCount} log container`,
        itemsRemoved: truncatedCount,
        freedSpace: this.formatBytes(totalFreed),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        task: 'container_logs_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  async cleanupJournal(options: LogsCleanupOptions = {}): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const maxSizeMB = options.maxSizeMB || 100;

    try {
      const { stdout } = await execAsync(`journalctl --vacuum-size=${maxSizeMB}M 2>&1`);
      const freedMatch = stdout.match(/freed\s+(\d+\.?\d*)\s*(GB|MB|KB|B)/i);
      const freedSpace = freedMatch ? `${freedMatch[1]} ${freedMatch[2]}` : '0B';

      return {
        task: 'journal_cleanup',
        success: true,
        message: `Journal ridotto a max ${maxSizeMB}MB`,
        freedSpace,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        task: 'journal_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  async cleanupActivityLogs(): Promise<MaintenanceResult> {
    const startTime = Date.now();

    try {
      const retentionSetting = await systemSettingsService.getSettingValue('system.log_retention_days');
      const retentionDays = parseInt(retentionSetting || '90');

      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - retentionDays);

      const result = await prisma.activityLog.deleteMany({
        where: { createdAt: { lt: limitDate } },
      });

      return {
        task: 'activity_logs_cleanup',
        success: true,
        message: `Eliminati ${result.count} log > ${retentionDays} giorni`,
        itemsRemoved: result.count,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        task: 'activity_logs_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  async cleanupClaudeCode(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    const claudeDir = '/home/sviluppatore/.claude';

    try {
      const commands = [
        `find ${claudeDir}/file-history -maxdepth 1 -type d -mtime +3 -exec rm -rf {} + 2>/dev/null || true`,
        `find ${claudeDir}/session-env -maxdepth 1 -type d -mtime +3 -exec rm -rf {} + 2>/dev/null || true`,
        `find ${claudeDir}/todos -type f -mtime +7 -delete 2>/dev/null || true`,
        `find ${claudeDir}/shell-snapshots -type f -mtime +3 -delete 2>/dev/null || true`,
        `find ${claudeDir}/plans -type f -mtime +14 -delete 2>/dev/null || true`,
        `rm -rf ${claudeDir}/debug/* 2>/dev/null || true`,
        `find ${claudeDir}/projects -name "*.jsonl" -mtime +7 -delete 2>/dev/null || true`,
      ];

      for (const cmd of commands) {
        await execAsync(cmd);
      }

      const { stdout: afterSize } = await execAsync(`du -sh ${claudeDir} 2>/dev/null | cut -f1`);

      return {
        task: 'claude_cleanup',
        success: true,
        message: `Claude Code pulito. Dimensione: ${afterSize.trim()}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        task: 'claude_cleanup',
        success: false,
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getLastReport(): MaintenanceReport | null {
    return this.lastReport;
  }

  async getMaintenanceStatus() {
    const settings = await systemSettingsService.getSettingsByCategory('maintenance');
    
    const lastLog = await prisma.activityLog.findFirst({
      where: { action: 'MAINTENANCE_RUN' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      enabled: settings.find(s => s.key === 'maintenance.enabled')?.value === 'true',
      schedule: settings.find(s => s.key === 'maintenance.schedule')?.value || '0 3 * * 0',
      lastRun: lastLog?.createdAt || null,
      lastReport: this.lastReport,
      tasks: [
        { id: 'n8n_cleanup', name: 'Pulizia N8N', description: 'Elimina esecuzioni workflow vecchie' },
        { id: 'docker_cleanup', name: 'Pulizia Docker', description: 'Rimuove immagini e cache non utilizzate' },
        { id: 'container_logs_cleanup', name: 'Pulizia Log Container', description: 'Tronca log container grandi' },
        { id: 'activity_logs_cleanup', name: 'Pulizia Activity Logs', description: 'Elimina log attività vecchi' },
        { id: 'claude_cleanup', name: 'Pulizia Claude Code', description: 'Pulisce cache e sessioni Claude' },
      ],
    };
  }

  async runSingleTask(taskId: string): Promise<MaintenanceResult> {
    switch (taskId) {
      case 'n8n_cleanup': return this.cleanupN8N({ olderThanDays: 7 });
      case 'docker_cleanup': return this.cleanupDocker({ pruneImages: true, pruneBuildCache: true });
      case 'container_logs_cleanup': return this.cleanupContainerLogs({ maxSizeMB: 50 });
      case 'activity_logs_cleanup': return this.cleanupActivityLogs();
      case 'claude_cleanup': return this.cleanupClaudeCode();
      default: throw new Error(`Task sconosciuta: ${taskId}`);
    }
  }

  private convertToBytes(size: number, unit: string): number {
    const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    return size * (units[unit] || 1);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private calculateTotalFreedSpace(results: MaintenanceResult[]): string {
    let totalBytes = 0;
    for (const result of results) {
      if (result.freedSpace) {
        const match = result.freedSpace.match(/(\d+\.?\d*)\s*(GB|MB|KB|B)/i);
        if (match) totalBytes += this.convertToBytes(parseFloat(match[1]), match[2].toUpperCase());
      }
    }
    return this.formatBytes(totalBytes);
  }

  private async saveMaintenanceLog(report: MaintenanceReport) {
    try {
      await prisma.activityLog.create({
        data: {
          action: 'MAINTENANCE_RUN',
          description: 'Manutenzione automatica sistema',
          resource: 'system',
          resourceId: 'maintenance',
          metadata: {
            duration: report.totalDuration,
            freedSpace: report.totalFreedSpace,
            tasksCompleted: report.results.filter(r => r.success).length,
            tasksFailed: report.results.filter(r => !r.success).length,
            results: report.results as unknown,
          } as any,
        },
      });
    } catch (error) {
      log.error('[Maintenance] Errore salvataggio log:', error);
    }
  }
}

export const maintenanceService = new MaintenanceService();
