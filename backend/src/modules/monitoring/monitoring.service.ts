import * as os from 'os';
import * as fs from 'fs/promises';
import Docker from 'dockerode';
import { prisma } from '../../services/prisma.service';
import {
  safeExec,
  safeDockerExec,
  safeDf,
  safeDu,
  validateDockerName,
  validatePath,
  validatePgIdentifier,
} from '../../utils/shell-sanitizer';
import log from '../../services/logger.service';

export class MonitoringService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics() {
    const [cpuUsage, memoryUsage, diskUsage, networkUsage, dockerStats] = await Promise.all([
      this.getCPUUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getNetworkUsage(),
      this.getDockerStats(),
    ]);

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage,
      docker: dockerStats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get memory usage
   */
  private async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total: total,
      used: used,
      free: free,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Get disk usage
   */
  private async getDiskUsage() {
    try {
      const df = await safeDf('/');
      return {
        total: df.total,
        used: df.used,
        free: df.free,
        percentage: Math.round(df.percentage * 100) / 100,
      };
    } catch (_error) {
      // Fallback
    }

    return {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0,
    };
  }

  /**
   * Get network usage (total bytes received/transmitted)
   */
  private async getNetworkUsage() {
    try {
      // Read directly from /proc/net/dev (no shell needed)
      const content = await fs.readFile('/proc/net/dev', 'utf8');
      const lines = content.split('\n').slice(2); // Skip headers

      let totalRx = 0;
      let totalTx = 0;

      lines.forEach((line) => {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10 && !parts[0].startsWith('lo:')) {
            // Skip loopback
            totalRx += parseInt(parts[1]) || 0;
            totalTx += parseInt(parts[9]) || 0;
          }
        }
      });

      return {
        received: totalRx,
        transmitted: totalTx,
      };
    } catch (_error) {
      return {
        received: 0,
        transmitted: 0,
      };
    }
  }

  /**
   * Get Docker statistics
   */
  private async getDockerStats() {
    try {
      const containers = await this.docker.listContainers({ all: true });

      const running = containers.filter((c) => c.State === 'running').length;
      const stopped = containers.filter((c) => c.State !== 'running').length;

      const images = await this.docker.listImages();
      const volumes = await this.docker.listVolumes();

      return {
        containersRunning: running,
        containersStopped: stopped,
        imagesCount: images.length,
        volumesCount: volumes.Volumes?.length || 0,
      };
    } catch (_error) {
      return {
        containersRunning: 0,
        containersStopped: 0,
        imagesCount: 0,
        volumesCount: 0,
      };
    }
  }

  /**
   * Save metrics snapshot to database
   */
  async saveMetricsSnapshot() {
    const metrics = await this.getSystemMetrics();

    await prisma.metricsSnapshot.create({
      data: {
        cpuUsage: metrics.cpu,
        memoryUsed: BigInt(metrics.memory.used),
        memoryTotal: BigInt(metrics.memory.total),
        diskUsed: BigInt(metrics.disk.used),
        diskTotal: BigInt(metrics.disk.total),
        networkRx: BigInt(metrics.network.received),
        networkTx: BigInt(metrics.network.transmitted),
        containersRunning: metrics.docker.containersRunning,
        containersStopped: metrics.docker.containersStopped,
        imagesCount: metrics.docker.imagesCount,
        volumesCount: metrics.docker.volumesCount,
      },
    });

    return metrics;
  }

  /**
   * Get metrics history
   */
  async getMetricsHistory(hours: number = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const snapshots = await prisma.metricsSnapshot.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return snapshots.map((snapshot) => ({
      timestamp: snapshot.createdAt.toISOString(),
      cpu: snapshot.cpuUsage,
      memory: {
        used: Number(snapshot.memoryUsed),
        total: Number(snapshot.memoryTotal),
        percentage: (Number(snapshot.memoryUsed) / Number(snapshot.memoryTotal)) * 100,
      },
      disk: {
        used: Number(snapshot.diskUsed),
        total: Number(snapshot.diskTotal),
        percentage: (Number(snapshot.diskUsed) / Number(snapshot.diskTotal)) * 100,
      },
      network: {
        received: Number(snapshot.networkRx),
        transmitted: Number(snapshot.networkTx),
      },
      docker: {
        containersRunning: snapshot.containersRunning,
        containersStopped: snapshot.containersStopped,
        imagesCount: snapshot.imagesCount,
        volumesCount: snapshot.volumesCount,
      },
    }));
  }

  /**
   * Get container statistics
   */
  async getContainerStats(containerId: string) {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
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
    } catch (_error) {
      return null;
    }
  }

  /**
   * Cleanup old metrics (keep last N days)
   */
  async cleanupOldMetrics(days: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await prisma.metricsSnapshot.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    return result.count;
  }

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
   * Get Docker disk usage overview
   */
  async getDockerDiskUsage() {
    try {
      const execResult = await safeDockerExec(['system', 'df', '--format', '{{json .}}']);
      const lines = execResult.stdout.trim().split('\n');

      const result: any = {
        images: { count: 0, size: 0, sizeFormatted: '0 B', reclaimable: 0, reclaimableFormatted: '0 B' },
        containers: { count: 0, size: 0, sizeFormatted: '0 B', reclaimable: 0, reclaimableFormatted: '0 B' },
        volumes: { count: 0, size: 0, sizeFormatted: '0 B', reclaimable: 0, reclaimableFormatted: '0 B' },
        buildCache: { count: 0, size: 0, sizeFormatted: '0 B', reclaimable: 0, reclaimableFormatted: '0 B' },
        total: { size: 0, sizeFormatted: '0 B', reclaimable: 0, reclaimableFormatted: '0 B' },
      };

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const type = data.Type?.toLowerCase();
          const size = this.parseDockerSize(data.Size || '0B');
          const reclaimable = this.parseDockerSize(data.Reclaimable?.split(' ')[0] || '0B');
          const count = parseInt(data.TotalCount) || 0;

          if (type === 'images') {
            result.images = { count, size, sizeFormatted: this.formatBytes(size), reclaimable, reclaimableFormatted: this.formatBytes(reclaimable) };
          } else if (type === 'containers') {
            result.containers = { count, size, sizeFormatted: this.formatBytes(size), reclaimable, reclaimableFormatted: this.formatBytes(reclaimable) };
          } else if (type === 'local volumes') {
            result.volumes = { count, size, sizeFormatted: this.formatBytes(size), reclaimable, reclaimableFormatted: this.formatBytes(reclaimable) };
          } else if (type === 'build cache') {
            result.buildCache = { count, size, sizeFormatted: this.formatBytes(size), reclaimable, reclaimableFormatted: this.formatBytes(reclaimable) };
          }

          result.total.size += size;
          result.total.reclaimable += reclaimable;
        } catch (_e) {}
      }

      result.total.sizeFormatted = this.formatBytes(result.total.size);
      result.total.reclaimableFormatted = this.formatBytes(result.total.reclaimable);

      return result;
    } catch (error) {
      log.error('Error getting docker disk usage:', error);
      return null;
    }
  }

  /**
   * Parse Docker size string to bytes
   */
  private parseDockerSize(sizeStr: string): number {
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
   * Get Docker volumes with sizes
   */
  async getVolumesWithSize() {
    try {
      const volumes: any[] = [];

      // Get list of volumes safely
      const volumeListResult = await safeDockerExec(['volume', 'ls', '--format', '{{.Name}}']);
      const volumeNames = volumeListResult.stdout.trim().split('\n').filter(Boolean);

      for (const name of volumeNames) {
        try {
          // Validate volume name to prevent injection
          if (!validateDockerName(name)) {
            continue;
          }

          // Get volume inspect info
          const inspectResult = await safeDockerExec(['volume', 'inspect', name]);
          const inspect = JSON.parse(inspectResult.stdout)[0];

          // Calculate volume size using du
          let size = 0;
          let sizeFormatted = '0 B';
          try {
            // Validate mountpoint path before using it
            if (validatePath(inspect.Mountpoint)) {
              size = await safeDu(inspect.Mountpoint);
              sizeFormatted = this.formatBytes(size);
            }
          } catch (_e) {
            // Volume might not be accessible
          }

          // Determine project association
          let projectName = 'Sistema';
          let projectSlug = 'system';
          if (name.startsWith('vps-panel_')) {
            projectName = 'VPS Panel';
            projectSlug = 'vps-panel';
          } else if (name.startsWith('import-')) {
            const match = name.match(/^import-([^_]+)/);
            if (match) {
              projectSlug = match[1];
              projectName = `Progetto ${match[1].substring(0, 8)}`;
            }
          }

          volumes.push({
            name,
            driver: inspect.Driver,
            mountpoint: inspect.Mountpoint,
            size,
            sizeFormatted,
            projectName,
            projectSlug,
            createdAt: inspect.CreatedAt,
          });
        } catch (_e) {
          // Skip problematic volumes
        }
      }

      // Sort by size descending
      volumes.sort((a, b) => b.size - a.size);

      const totalSize = volumes.reduce((sum, v) => sum + v.size, 0);

      return {
        volumes,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        count: volumes.length,
      };
    } catch (error) {
      log.error('Error getting volumes with size:', error);
      return { volumes: [], totalSize: 0, totalSizeFormatted: '0 B', count: 0 };
    }
  }

  /**
   * Get container storage usage
   */
  async getContainersStorageUsage() {
    try {
      const result = await safeDockerExec(['ps', '-a', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Size}}\t{{.Status}}']);
      const lines = result.stdout.trim().split('\n').filter(Boolean);

      const containers: any[] = [];

      for (const line of lines) {
        const [id, name, image, sizeStr, ...statusParts] = line.split('\t');
        const status = statusParts.join(' ');

        // Parse size (format: "123MB (virtual 456MB)")
        let size = 0;
        let virtualSize = 0;
        const sizeMatch = sizeStr?.match(/^([\d.]+\s*[KMGT]?B)/i);
        const virtualMatch = sizeStr?.match(/\(virtual\s+([\d.]+\s*[KMGT]?B)\)/i);

        if (sizeMatch) {
          size = this.parseDockerSize(sizeMatch[1].replace(/\s/g, ''));
        }
        if (virtualMatch) {
          virtualSize = this.parseDockerSize(virtualMatch[1].replace(/\s/g, ''));
        }

        // Determine project association
        let projectName = 'Altro';
        let projectSlug = 'other';
        if (name?.startsWith('vps-panel-')) {
          projectName = 'VPS Panel';
          projectSlug = 'vps-panel';
        } else if (name?.startsWith('eccellenze-')) {
          projectName = 'Eccellenze Italiane TV';
          projectSlug = 'eccellenze-tv';
        } else if (name?.includes('postgres') || name?.includes('redis') || name?.includes('traefik')) {
          projectName = 'Sistema';
          projectSlug = 'system';
        }

        containers.push({
          id: id?.substring(0, 12),
          name,
          image,
          size,
          sizeFormatted: this.formatBytes(size),
          virtualSize,
          virtualSizeFormatted: this.formatBytes(virtualSize),
          status: status?.includes('Up') ? 'running' : 'stopped',
          projectName,
          projectSlug,
        });
      }

      // Sort by size descending
      containers.sort((a, b) => b.size - a.size);

      const totalSize = containers.reduce((sum, c) => sum + c.size, 0);
      const totalVirtualSize = containers.reduce((sum, c) => sum + c.virtualSize, 0);

      return {
        containers,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        totalVirtualSize,
        totalVirtualSizeFormatted: this.formatBytes(totalVirtualSize),
        count: containers.length,
      };
    } catch (error) {
      log.error('Error getting container storage:', error);
      return { containers: [], totalSize: 0, totalSizeFormatted: '0 B', totalVirtualSize: 0, totalVirtualSizeFormatted: '0 B', count: 0 };
    }
  }

  /**
   * Get Docker images storage
   */
  async getImagesStorageUsage() {
    try {
      const result = await safeDockerExec(['images', '--format', '{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}']);
      const lines = result.stdout.trim().split('\n').filter(Boolean);

      const images: any[] = [];

      for (const line of lines) {
        const [id, repo, tag, sizeStr, createdAt] = line.split('\t');

        const size = this.parseDockerSize(sizeStr?.replace(/\s/g, '') || '0B');

        images.push({
          id: id?.substring(0, 12),
          repository: repo,
          tag,
          size,
          sizeFormatted: sizeStr || this.formatBytes(size),
          createdAt,
        });
      }

      // Sort by size descending
      images.sort((a, b) => b.size - a.size);

      const totalSize = images.reduce((sum, i) => sum + i.size, 0);

      return {
        images,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        count: images.length,
      };
    } catch (error) {
      log.error('Error getting images storage:', error);
      return { images: [], totalSize: 0, totalSizeFormatted: '0 B', count: 0 };
    }
  }

  /**
   * Get database sizes (from registered databases in panel)
   * OPTIMIZED: Uses Promise.all with concurrency batching to avoid N+1 queries
   */
  async getDatabaseSizes() {
    try {
      const databases = await prisma.database.findMany({
        include: {
          project: {
            select: { name: true, slug: true }
          }
        }
      });

      // Process databases in parallel with concurrency limit
      const CONCURRENCY_LIMIT = 5;
      const dbSizes: any[] = [];

      // Split into batches for controlled concurrency
      for (let i = 0; i < databases.length; i += CONCURRENCY_LIMIT) {
        const batch = databases.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.all(
          batch.map(db => this.getSingleDatabaseSize(db))
        );
        dbSizes.push(...batchResults.filter(Boolean));
      }

      // Sort by size descending
      dbSizes.sort((a, b) => b.size - a.size);

      const totalSize = dbSizes.reduce((sum, d) => sum + d.size, 0);

      return {
        databases: dbSizes,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        count: dbSizes.length,
      };
    } catch (error) {
      log.error('Error getting database sizes:', error);
      return { databases: [], totalSize: 0, totalSizeFormatted: '0 B', count: 0 };
    }
  }

  /**
   * Get size info for a single database (helper for parallel processing)
   */
  private async getSingleDatabaseSize(db: any): Promise<any> {
    let size = 0;
    let sizeFormatted = 'N/A';
    let tablesCount = 0;

    try {
      // Validate host for all database types
      if (!validateDockerName(db.host)) {
        log.warn(`Invalid host name: ${db.host}`);
        return null;
      }

      // Redis doesn't require username/databaseName validation
      if (db.type === 'REDIS') {
        try {
          // Get Redis memory usage
          const result = await safeDockerExec([
            'exec', db.host, 'redis-cli', 'INFO', 'memory'
          ]);
          const match = result.stdout.match(/used_memory:(\d+)/);
          if (match) {
            size = parseInt(match[1]) || 0;
            sizeFormatted = this.formatBytes(size);
          }
          // Get key count
          const dbsizeResult = await safeDockerExec([
            'exec', db.host, 'redis-cli', 'DBSIZE'
          ]);
          const dbsizeMatch = dbsizeResult.stdout.match(/(\d+)/);
          if (dbsizeMatch) {
            tablesCount = parseInt(dbsizeMatch[1]) || 0;
          }
        } catch (_e) {
          // Redis might not be accessible
        }
      } else {
        // For PostgreSQL and MySQL, validate username and databaseName
        if (!validatePgIdentifier(db.username)) {
          // Silently skip - don't spam logs
          return null;
        }
        if (!validatePgIdentifier(db.databaseName)) {
          // Silently skip - don't spam logs
          return null;
        }
      }

      if (db.type === 'POSTGRESQL') {
        // Get PostgreSQL database size using safe exec with array args
        const query = `SELECT pg_database_size(current_database()) as size, (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as tables;`;
        const result = await safeDockerExec([
          'exec', db.host, 'psql',
          '-U', db.username,
          '-d', db.databaseName,
          '-t', '-c', query
        ]);
        const output = result.stdout.trim();
        const [sizeResult, tablesResult] = output.split('|').map(s => s.trim());
        size = parseInt(sizeResult) || 0;
        tablesCount = parseInt(tablesResult) || 0;
        sizeFormatted = this.formatBytes(size);
      } else if (db.type === 'MYSQL') {
        // Get MySQL database size - use environment variable for password
        const query = `SELECT SUM(data_length + index_length) as size FROM information_schema.tables WHERE table_schema = DATABASE();`;
        const result = await safeExec('docker', [
          'exec', '-e', `MYSQL_PWD=${db.password}`,
          db.host, 'mysql',
          `-u${db.username}`,
          db.databaseName,
          '-N', '-e', query
        ], { timeout: 30000 });
        const output = result.stdout.trim();
        size = parseInt(output) || 0;
        sizeFormatted = this.formatBytes(size);
      }
    } catch (_e) {
      // Database might not be accessible
    }

    return {
      id: db.id,
      name: db.name,
      type: db.type,
      host: db.host,
      databaseName: db.databaseName,
      size,
      sizeFormatted,
      tablesCount,
      projectName: db.project?.name || 'N/A',
      projectSlug: db.project?.slug || 'unknown',
    };
  }

  /**
   * Get dashboard summary: recent deployments + system health
   */
  async getDashboardSummary() {
    const [metrics, recentDeployments] = await Promise.all([
      this.getSystemMetrics(),
      prisma.deployment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Determine overall health status
    const cpuPercent = metrics.cpu;
    const memPercent = metrics.memory.percentage;
    const diskPercent = metrics.disk.percentage;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (cpuPercent >= 90 || memPercent >= 90 || diskPercent >= 95) {
      status = 'critical';
    } else if (cpuPercent >= 70 || memPercent >= 70 || diskPercent >= 85) {
      status = 'warning';
    }

    return {
      recentDeployments: recentDeployments.map((d) => ({
        id: d.id,
        projectName: d.project.name,
        projectId: d.project.id,
        status: d.status,
        duration: d.duration,
        commitAfter: d.commitAfter,
        createdAt: d.createdAt,
        userName: d.user?.name || d.user?.email || 'Sistema',
      })),
      systemHealth: {
        status,
        cpu: Math.round(cpuPercent * 10) / 10,
        memory: Math.round(memPercent * 10) / 10,
        disk: Math.round(diskPercent * 10) / 10,
        containersRunning: metrics.docker.containersRunning,
        containersTotal: metrics.docker.containersRunning + metrics.docker.containersStopped,
      },
    };
  }

  /**
   * Get comprehensive disk metrics
   */
  async getDiskMetrics() {
    const [dockerDisk, volumes, containers, images, databases] = await Promise.all([
      this.getDockerDiskUsage(),
      this.getVolumesWithSize(),
      this.getContainersStorageUsage(),
      this.getImagesStorageUsage(),
      this.getDatabaseSizes(),
    ]);

    return {
      overview: dockerDisk,
      volumes,
      containers,
      images,
      databases,
      timestamp: new Date().toISOString(),
    };
  }
}

export const monitoringService = new MonitoringService();
