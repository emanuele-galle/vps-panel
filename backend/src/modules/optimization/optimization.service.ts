import { randomUUID } from 'crypto';
import {
  safeExec,
  safeDockerExec,
  safeDf,
  safeDu,
  validateDockerName,
  validatePath,
} from '../../utils/shell-sanitizer';
import log from '../../services/logger.service';

// Job tracking for async operations
interface CleanupJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  progress: number;
  currentStep: string;
  results?: CleanupResult[];
  totalFreed?: number;
  totalFreedFormatted?: string;
  error?: string;
  diskUsageBefore?: { used: number; percentage: number };
  diskUsageAfter?: { used: number; percentage: number };
}

// In-memory job store (jobs expire after 1 hour)
const cleanupJobs = new Map<string, CleanupJob>();

// Cleanup old jobs periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of cleanupJobs.entries()) {
    if (job.startedAt.getTime() < oneHourAgo) {
      cleanupJobs.delete(id);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

interface CleanupResult {
  success: boolean;
  freedSpace: number;
  freedSpaceFormatted: string;
  message: string;
  details?: string;
}

interface AnalysisResult {
  category: string;
  name: string;
  currentSize: number;
  currentSizeFormatted: string;
  reclaimable: number;
  reclaimableFormatted: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
}

export class OptimizationService {
  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };

    return num * (multipliers[unit] || 1);
  }

  /**
   * Get Docker build cache size
   */
  async getDockerBuildCacheSize(): Promise<{ size: number; reclaimable: number }> {
    try {
      const result = await safeDockerExec(['system', 'df', '--format', '{{json .}}']);
      const lines = result.stdout.trim().split('\n');

      for (const line of lines) {
        const data = JSON.parse(line);
        if (data.Type?.toLowerCase() === 'build cache') {
          const size = this.parseSize(data.Size?.replace(/\s/g, '') || '0B');
          const reclaimableMatch = data.Reclaimable?.match(/^([\d.]+\s*[KMGT]?B)/i);
          const reclaimable = reclaimableMatch ? this.parseSize(reclaimableMatch[1].replace(/\s/g, '')) : size;
          return { size, reclaimable };
        }
      }
    } catch (error) {
      log.error('Error getting docker build cache size:', error);
    }
    return { size: 0, reclaimable: 0 };
  }

  /**
   * Get npm cache size
   */
  async getNpmCacheSize(): Promise<number> {
    try {
      const npmCachePath = '/root/.npm';
      return await safeDu(npmCachePath);
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get apt cache size
   */
  async getAptCacheSize(): Promise<number> {
    try {
      return await safeDu('/var/cache/apt/archives');
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get journal logs size
   */
  async getJournalLogsSize(): Promise<number> {
    try {
      const result = await safeExec('journalctl', ['--disk-usage']);
      const match = result.stdout.match(/(\d+\.?\d*[KMGT]?)/i);
      return match ? this.parseSize(match[1] + 'B') : 0;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get dangling Docker images size
   */
  async getDanglingImagesSize(): Promise<number> {
    try {
      const result = await safeDockerExec(['images', '-f', 'dangling=true', '--format', '{{.Size}}']);
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      let total = 0;
      for (const line of lines) {
        total += this.parseSize(line.replace(/\s/g, ''));
      }
      return total;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get unused Docker images size (not associated with any container)
   */
  async getUnusedImagesSize(): Promise<{ size: number; percentage: number }> {
    try {
      const result = await safeDockerExec(['system', 'df', '--format', '{{json .}}']);
      const lines = result.stdout.trim().split('\n');

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.Type?.toLowerCase() === 'images') {
            const reclaimableMatch = data.Reclaimable?.match(/^([\d.]+\s*[KMGT]?B)/i);
            const reclaimable = reclaimableMatch ? this.parseSize(reclaimableMatch[1].replace(/\s/g, '')) : 0;
            const percentageMatch = data.Reclaimable?.match(/\((\d+)%\)/);
            const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;
            return { size: reclaimable, percentage };
          }
        } catch (_e) {
          // Skip invalid JSON lines
        }
      }
    } catch (error) {
      log.error('Error getting unused images size:', error);
    }
    return { size: 0, percentage: 0 };
  }

  /**
   * Get Docker container logs size
   */
  async getContainerLogsSize(): Promise<{ total: number; details: Array<{ name: string; size: number; sizeFormatted: string }> }> {
    try {
      const result = await safeDockerExec(['ps', '-a', '--format', '{{.ID}} {{.Names}}']);
      const containers = result.stdout.trim().split('\n').filter(Boolean);

      const details: Array<{ name: string; size: number; sizeFormatted: string }> = [];
      let total = 0;

      for (const line of containers) {
        const [id, name] = line.split(' ');
        if (!id || !validateDockerName(id)) continue;

        try {
          // Get log file path via inspect
          const inspectResult = await safeDockerExec(['inspect', id, '--format', '{{.LogPath}}']);
          const logPath = inspectResult.stdout.trim();

          if (logPath && validatePath(logPath)) {
            const sizeResult = await safeExec('stat', ['--format=%s', logPath]);
            const size = parseInt(sizeResult.stdout.trim()) || 0;

            if (size > 1024 * 1024) { // Only include logs > 1MB
              details.push({
                name: name || id,
                size,
                sizeFormatted: this.formatBytes(size),
              });
              total += size;
            }
          }
        } catch (_e) {
          // Log file might not exist
        }
      }

      // Sort by size descending
      details.sort((a, b) => b.size - a.size);

      return { total, details: details.slice(0, 10) }; // Top 10 largest
    } catch (error) {
      log.error('Error getting container logs size:', error);
      return { total: 0, details: [] };
    }
  }

  /**
   * Get orphan Docker volumes size
   */
  async getOrphanVolumesSize(): Promise<number> {
    try {
      const result = await safeDockerExec(['volume', 'ls', '-f', 'dangling=true', '-q']);
      const volumes = result.stdout.trim().split('\n').filter(Boolean);

      let total = 0;
      for (const vol of volumes) {
        try {
          // Validate volume name to prevent injection
          if (!validateDockerName(vol)) {
            continue;
          }
          const inspectResult = await safeDockerExec(['volume', 'inspect', vol, '--format', '{{.Mountpoint}}']);
          const mountpoint = inspectResult.stdout.trim();
          // Validate mountpoint to prevent path injection
          if (validatePath(mountpoint)) {
            total += await safeDu(mountpoint);
          }
        } catch (_e) {
          // Volume might not be accessible
        }
      }
      return total;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get tmp files size
   */
  async getTmpFilesSize(): Promise<number> {
    try {
      return await safeDu('/tmp');
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Get Go cache size
   */
  async getGoCacheSize(): Promise<number> {
    try {
      const goCachePath = '/root/go/pkg/mod/cache';
      return await safeDu(goCachePath);
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Analyze all cleanup opportunities (Docker-based only, works from container)
   */
  async analyzeCleanupOpportunities(): Promise<{
    items: AnalysisResult[];
    totalReclaimable: number;
    totalReclaimableFormatted: string;
    diskUsage: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    containerLogs?: {
      total: number;
      totalFormatted: string;
      details: Array<{ name: string; size: number; sizeFormatted: string }>;
    };
  }> {
    const [
      dockerBuildCache,
      danglingImagesSize,
      orphanVolumesSize,
      containerLogs,
    ] = await Promise.all([
      this.getDockerBuildCacheSize(),
      this.getDanglingImagesSize(),
      this.getOrphanVolumesSize(),
      this.getContainerLogsSize(),
    ]);

    // Get disk usage
    const diskUsage = await safeDf('/');

    const items: AnalysisResult[] = [
      {
        category: 'docker',
        name: 'Docker Build Cache',
        currentSize: dockerBuildCache.size,
        currentSizeFormatted: this.formatBytes(dockerBuildCache.size),
        reclaimable: dockerBuildCache.reclaimable,
        reclaimableFormatted: this.formatBytes(dockerBuildCache.reclaimable),
        description: 'Cache delle build Docker. Si accumula ad ogni docker build.',
        command: 'docker builder prune -a -f',
        risk: 'low',
      },
      {
        category: 'docker',
        name: 'Immagini Dangling',
        currentSize: danglingImagesSize,
        currentSizeFormatted: this.formatBytes(danglingImagesSize),
        reclaimable: danglingImagesSize,
        reclaimableFormatted: this.formatBytes(danglingImagesSize),
        description: 'Immagini Docker non taggate (senza tag <none>).',
        command: 'docker image prune -f',
        risk: 'low',
      },
      {
        category: 'docker',
        name: 'Volumi Orfani',
        currentSize: orphanVolumesSize,
        currentSizeFormatted: this.formatBytes(orphanVolumesSize),
        reclaimable: orphanVolumesSize,
        reclaimableFormatted: this.formatBytes(orphanVolumesSize),
        description: 'Volumi Docker non associati a nessun container.',
        command: 'docker volume prune -f',
        risk: 'medium',
      },
      {
        category: 'docker',
        name: 'Log Container',
        currentSize: containerLogs.total,
        currentSizeFormatted: this.formatBytes(containerLogs.total),
        reclaimable: containerLogs.total,
        reclaimableFormatted: this.formatBytes(containerLogs.total),
        description: 'Log dei container Docker >10MB. Verranno troncati.',
        command: 'truncate container logs',
        risk: 'low',
      },
    ];

    const totalReclaimable = items.reduce((sum, item) => sum + item.reclaimable, 0);

    return {
      items,
      totalReclaimable,
      totalReclaimableFormatted: this.formatBytes(totalReclaimable),
      diskUsage,
      containerLogs: containerLogs.total > 0 ? {
        total: containerLogs.total,
        totalFormatted: this.formatBytes(containerLogs.total),
        details: containerLogs.details,
      } : undefined,
    };
  }

  /**
   * Clean Docker build cache
   */
  async cleanDockerBuildCache(): Promise<CleanupResult> {
    try {
      const before = await this.getDockerBuildCacheSize();
      await safeExec('docker', ['builder', 'prune', '-a', '-f'], { timeout: 300000 });
      const after = await this.getDockerBuildCacheSize();
      const freed = before.size - after.size;

      return {
        success: true,
        freedSpace: freed,
        freedSpaceFormatted: this.formatBytes(freed),
        message: 'Docker build cache pulita con successo',
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante la pulizia della build cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean npm cache (skipped in containerized environment)
   */
  async cleanNpmCache(): Promise<CleanupResult> {
    // Skip - npm cache is inside container and doesn't affect host
    return {
      success: true,
      freedSpace: 0,
      freedSpaceFormatted: '0 B',
      message: 'npm cache - operazione ignorata (ambiente containerizzato)',
    };
  }

  /**
   * Clean apt cache (skipped in containerized environment)
   */
  async cleanAptCache(): Promise<CleanupResult> {
    // Skip - apt cache is inside container and doesn't affect host
    return {
      success: true,
      freedSpace: 0,
      freedSpaceFormatted: '0 B',
      message: 'apt cache - operazione ignorata (ambiente containerizzato)',
    };
  }

  /**
   * Clean journal logs (skipped in containerized environment)
   */
  async cleanJournalLogs(): Promise<CleanupResult> {
    // Skip - journalctl is not available in the container
    return {
      success: true,
      freedSpace: 0,
      freedSpaceFormatted: '0 B',
      message: 'Journal logs - operazione ignorata (ambiente containerizzato)',
    };
  }

  /**
   * Prune Docker volumes
   */
  async pruneDockerVolumes(): Promise<CleanupResult> {
    try {
      const before = await this.getOrphanVolumesSize();
      const result = await safeDockerExec(['volume', 'prune', '-f']);
      const after = await this.getOrphanVolumesSize();
      const freed = before - after;

      return {
        success: true,
        freedSpace: freed,
        freedSpaceFormatted: this.formatBytes(freed),
        message: 'Volumi Docker orfani rimossi con successo',
        details: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante il prune dei volumi Docker',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Prune Docker images (dangling only)
   */
  async pruneDockerImages(): Promise<CleanupResult> {
    try {
      const before = await this.getDanglingImagesSize();
      const result = await safeDockerExec(['image', 'prune', '-f']);
      const after = await this.getDanglingImagesSize();
      const freed = before - after;

      return {
        success: true,
        freedSpace: freed,
        freedSpaceFormatted: this.formatBytes(freed),
        message: 'Immagini Docker dangling rimosse con successo',
        details: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante il prune delle immagini Docker',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Prune all unused Docker images (not just dangling)
   */
  async pruneUnusedImages(): Promise<CleanupResult> {
    try {
      const before = await this.getUnusedImagesSize();
      const result = await safeDockerExec(['image', 'prune', '-a', '-f']);
      const after = await this.getUnusedImagesSize();
      const freed = before.size - after.size;

      // Parse reclaimed space from output
      const reclaimedMatch = result.stdout.match(/Total reclaimed space:\s*([\d.]+\s*[KMGT]?B)/i);
      const reclaimedFromOutput = reclaimedMatch ? this.parseSize(reclaimedMatch[1].replace(/\s/g, '')) : freed;

      return {
        success: true,
        freedSpace: Math.max(freed, reclaimedFromOutput),
        freedSpaceFormatted: this.formatBytes(Math.max(freed, reclaimedFromOutput)),
        message: 'Immagini Docker non utilizzate rimosse con successo',
        details: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante il prune delle immagini non utilizzate',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Truncate container logs
   */
  async truncateContainerLogs(): Promise<CleanupResult> {
    try {
      const _before = await this.getContainerLogsSize();
      let truncatedCount = 0;
      let totalFreed = 0;

      const result = await safeDockerExec(['ps', '-a', '--format', '{{.ID}}']);
      const containerIds = result.stdout.trim().split('\n').filter(Boolean);

      for (const id of containerIds) {
        if (!validateDockerName(id)) continue;

        try {
          const inspectResult = await safeDockerExec(['inspect', id, '--format', '{{.LogPath}}']);
          const logPath = inspectResult.stdout.trim();

          if (logPath && validatePath(logPath)) {
            // Get size before truncate
            const sizeResult = await safeExec('stat', ['--format=%s', logPath]);
            const sizeBefore = parseInt(sizeResult.stdout.trim()) || 0;

            if (sizeBefore > 10 * 1024 * 1024) { // Only truncate logs > 10MB
              await safeExec('truncate', ['-s', '0', logPath]);
              truncatedCount++;
              totalFreed += sizeBefore;
            }
          }
        } catch (_e) {
          // Skip if log file not accessible
        }
      }

      return {
        success: true,
        freedSpace: totalFreed,
        freedSpaceFormatted: this.formatBytes(totalFreed),
        message: `Log di ${truncatedCount} container troncati con successo`,
        details: `Spazio liberato: ${this.formatBytes(totalFreed)}`,
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante il troncamento dei log',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean Go module cache (skipped in containerized environment)
   */
  async cleanGoCache(): Promise<CleanupResult> {
    // Skip - Go is not installed in the container
    return {
      success: true,
      freedSpace: 0,
      freedSpaceFormatted: '0 B',
      message: 'Go cache - operazione ignorata (ambiente containerizzato)',
    };
  }

  /**
   * Prune Docker networks
   */
  async pruneDockerNetworks(): Promise<CleanupResult> {
    try {
      const result = await safeDockerExec(['network', 'prune', '-f']);
      const deletedMatch = result.stdout.match(/Deleted Networks:\s*([\s\S]*?)(?:\n\n|$)/);
      const deletedCount = deletedMatch ? deletedMatch[1].trim().split('\n').filter(Boolean).length : 0;

      return {
        success: true,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: `Network Docker orfani rimossi (${deletedCount} reti)`,
        details: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        freedSpace: 0,
        freedSpaceFormatted: '0 B',
        message: 'Errore durante il prune delle reti Docker',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run full cleanup
   */
  async runFullCleanup(): Promise<{
    success: boolean;
    results: CleanupResult[];
    totalFreed: number;
    totalFreedFormatted: string;
    diskUsageBefore: { used: number; percentage: number };
    diskUsageAfter: { used: number; percentage: number };
  }> {
    // Get disk usage before
    const dfBefore = await safeDf('/');
    const diskUsageBefore = {
      used: dfBefore.used,
      percentage: Math.round(dfBefore.percentage),
    };

    // Run all cleanups (Docker-based cleanups work via socket)
    // Note: pruneUnusedImages removed - it can break active containers
    const results = await Promise.all([
      this.cleanDockerBuildCache(),
      this.pruneDockerImages(),
      this.pruneDockerVolumes(),
      this.pruneDockerNetworks(),
      this.truncateContainerLogs(),
    ]);

    // Get disk usage after
    const dfAfter = await safeDf('/');
    const diskUsageAfter = {
      used: dfAfter.used,
      percentage: Math.round(dfAfter.percentage),
    };

    const totalFreed = diskUsageBefore.used - diskUsageAfter.used;

    return {
      success: results.every(r => r.success),
      results,
      totalFreed: Math.max(0, totalFreed),
      totalFreedFormatted: this.formatBytes(Math.max(0, totalFreed)),
      diskUsageBefore,
      diskUsageAfter,
    };
  }

  /**
   * Start full cleanup asynchronously - returns job ID immediately
   */
  startFullCleanupAsync(): string {
    const jobId = randomUUID();

    const job: CleanupJob = {
      id: jobId,
      status: 'pending',
      startedAt: new Date(),
      progress: 0,
      currentStep: 'Inizializzazione...',
    };

    cleanupJobs.set(jobId, job);

    // Execute cleanup in background
    this.executeCleanupJob(jobId).catch(error => {
      const job = cleanupJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.completedAt = new Date();
      }
    });

    return jobId;
  }

  /**
   * Get cleanup job status
   */
  getCleanupJobStatus(jobId: string): CleanupJob | null {
    return cleanupJobs.get(jobId) || null;
  }

  /**
   * Execute cleanup job in background
   */
  private async executeCleanupJob(jobId: string): Promise<void> {
    const job = cleanupJobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.currentStep = 'Analisi spazio disco...';
    job.progress = 5;

    try {
      // Get disk usage before
      const dfBefore = await safeDf('/');
      job.diskUsageBefore = {
        used: dfBefore.used,
        percentage: Math.round(dfBefore.percentage),
      };
      job.progress = 10;

      const results: CleanupResult[] = [];
      const steps = [
        { name: 'Pulizia Docker build cache...', fn: () => this.cleanDockerBuildCache() },
        { name: 'Rimozione immagini dangling...', fn: () => this.pruneDockerImages() },
        { name: 'Pulizia volumi orfani...', fn: () => this.pruneDockerVolumes() },
        { name: 'Pulizia network orfani...', fn: () => this.pruneDockerNetworks() },
        { name: 'Troncamento log container...', fn: () => this.truncateContainerLogs() },
      ];

      for (let i = 0; i < steps.length; i++) {
        job.currentStep = steps[i].name;
        job.progress = 10 + Math.round((i / steps.length) * 80);

        const result = await steps[i].fn();
        results.push(result);
      }

      job.results = results;
      job.progress = 95;
      job.currentStep = 'Calcolo spazio liberato...';

      // Get disk usage after
      const dfAfter = await safeDf('/');
      job.diskUsageAfter = {
        used: dfAfter.used,
        percentage: Math.round(dfAfter.percentage),
      };

      const totalFreed = job.diskUsageBefore.used - job.diskUsageAfter.used;
      job.totalFreed = Math.max(0, totalFreed);
      job.totalFreedFormatted = this.formatBytes(Math.max(0, totalFreed));

      job.status = 'completed';
      job.progress = 100;
      // Provide clear feedback based on whether space was freed
      job.currentStep = totalFreed > 0
        ? `Completato - Liberati ${job.totalFreedFormatted}`
        : 'Sistema già ottimizzato - nessuno spazio da liberare';
      job.completedAt = new Date();

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
    }
  }
}

export const optimizationService = new OptimizationService();
