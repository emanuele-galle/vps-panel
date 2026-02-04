/**
 * Resource Alerts Service
 * Monitors CPU, RAM, and Disk usage and sends alerts when thresholds are exceeded
 */

import os from 'os';
import { telegramService } from './telegram.service';
import { prisma } from './prisma.service';
import { safeExec } from '../utils/shell-sanitizer';
import log from '../services/logger.service';
import { notificationService } from './notification.service';

export interface AlertThresholds {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
}

export interface ResourceStatus {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
}

class ResourceAlertsService {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastAlerts: Map<string, number> = new Map();
  private alertCooldown = 5 * 60 * 1000; // 5 minutes between same alerts

  private defaultThresholds: AlertThresholds = {
    cpuPercent: 90,
    memoryPercent: 85,
    diskPercent: 90,
  };

  async start(intervalMs = 60000): Promise<void> {
    if (this.checkInterval) {
      log.info('[ResourceAlerts] Already running');
      return;
    }
    log.info('[ResourceAlerts] Starting resource monitoring...');
    await this.checkResources();
    this.checkInterval = setInterval(() => {
      this.checkResources().catch(err => {
        log.error('[ResourceAlerts] Check failed:', err.message);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('[ResourceAlerts] Stopped resource monitoring');
    }
  }

  async getResourceStatus(): Promise<ResourceStatus> {
    const [cpuUsage, diskInfo] = await Promise.all([
      this.getCpuUsage(),
      this.getDiskUsage(),
    ]);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      cpu: { usage: cpuUsage, cores: os.cpus().length, loadAverage: os.loadavg() },
      memory: { total: totalMem, used: usedMem, free: freeMem, usagePercent: (usedMem / totalMem) * 100 },
      disk: diskInfo,
    };
  }

  async checkResources(): Promise<void> {
    try {
      const thresholds = await this.getThresholds();
      const status = await this.getResourceStatus();
      if (status.cpu.usage >= thresholds.cpuPercent) {
        await this.sendAlert('cpu', status.cpu.usage, thresholds.cpuPercent, {
          cores: status.cpu.cores,
          loadAverage: status.cpu.loadAverage.map(l => l.toFixed(2)).join(', '),
        });
      }
      if (status.memory.usagePercent >= thresholds.memoryPercent) {
        await this.sendAlert('memory', status.memory.usagePercent, thresholds.memoryPercent, {
          used: this.formatBytes(status.memory.used),
          total: this.formatBytes(status.memory.total),
        });
      }
      if (status.disk.usagePercent >= thresholds.diskPercent) {
        await this.sendAlert('disk', status.disk.usagePercent, thresholds.diskPercent, {
          used: this.formatBytes(status.disk.used),
          total: this.formatBytes(status.disk.total),
          free: this.formatBytes(status.disk.free),
        });
      }
    } catch (error) {
      log.error('[ResourceAlerts] Error checking resources:', (error as Error).message);
    }
  }

  private async getThresholds(): Promise<AlertThresholds> {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: ['alert_cpu_threshold', 'alert_memory_threshold', 'alert_disk_threshold'] } },
      });
      const thresholds = { ...this.defaultThresholds };
      for (const setting of settings) {
        const value = parseInt(setting.value, 10);
        if (!isNaN(value) && value > 0 && value <= 100) {
          if (setting.key === 'alert_cpu_threshold') thresholds.cpuPercent = value;
          if (setting.key === 'alert_memory_threshold') thresholds.memoryPercent = value;
          if (setting.key === 'alert_disk_threshold') thresholds.diskPercent = value;
        }
      }
      return thresholds;
    } catch { return this.defaultThresholds; }
  }

  private async sendAlert(
    type: 'cpu' | 'memory' | 'disk',
    current: number,
    threshold: number,
    details: Record<string, string | number>
  ): Promise<void> {
    const alertKey = type + '_high';
    const lastAlert = this.lastAlerts.get(alertKey) || 0;
    if (Date.now() - lastAlert < this.alertCooldown) return;
    this.lastAlerts.set(alertKey, Date.now());

    const typeNames: Record<string, string> = { cpu: 'CPU', memory: 'Memoria', disk: 'Disco' };
    const currentStr = current.toFixed(1);
    const detailsStr = Object.entries(details).map(([k, v]) => k + ': ' + v).join('\n');
    const message = '\u26a0\ufe0f *ALERT: ' + typeNames[type] + ' Alto*\n\nUso attuale: *' + currentStr + '%*\nSoglia: ' + threshold + '%\n\n' + detailsStr;

    try { await telegramService.sendMessage(message); } catch (err) {
      log.error('[ResourceAlerts] Failed to send Telegram alert:', (err as Error).message);
    }
    try {
      await prisma.activityLog.create({
        data: { action: 'RESOURCE_ALERT', resource: 'system', description: 'Resource alert triggered', metadata: { type, current: currentStr, threshold, ...details } },
      });
    } catch (err) {
      log.error('[ResourceAlerts] Failed to log activity:', (err as Error).message);
    }
    // In-app notification for admins
    try {
      await notificationService.createForAdmins({
        type: 'WARNING',
        title: `${typeNames[type]} elevato: ${currentStr}%`,
        message: `Uso ${typeNames[type]} al ${currentStr}% (soglia: ${threshold}%). ${detailsStr.replace(/\n/g, ', ')}`,
        priority: 'HIGH',
        source: 'resource-alerts',
        sourceId: type,
        actionLabel: 'Monitoraggio',
        actionHref: '/dashboard/monitoring',
      });
    } catch (err) {
      log.error('[ResourceAlerts] Failed to create notification:', (err as Error).message);
    }
    log.info('[ResourceAlerts] Alert sent: ' + type + ' at ' + currentStr + '%');
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const cpus1 = os.cpus();
      setTimeout(() => {
        const cpus2 = os.cpus();
        let totalIdle = 0, totalTick = 0;
        for (let i = 0; i < cpus1.length; i++) {
          const idle1 = cpus1[i].times.idle, idle2 = cpus2[i].times.idle;
          const total1 = Object.values(cpus1[i].times).reduce((a, b) => a + b, 0);
          const total2 = Object.values(cpus2[i].times).reduce((a, b) => a + b, 0);
          totalIdle += idle2 - idle1;
          totalTick += total2 - total1;
        }
        resolve(totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0);
      }, 100);
    });
  }

  private async getDiskUsage(): Promise<{ total: number; used: number; free: number; usagePercent: number }> {
    try {
      const result = await safeExec('df', ['-B1', '/'], { timeout: 5000 });
      const lines = result.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1], 10), used = parseInt(parts[2], 10), free = parseInt(parts[3], 10);
        return { total, used, free, usagePercent: (used / total) * 100 };
      }
    } catch (err) { log.error('[ResourceAlerts] Failed to get disk usage:', (err as Error).message); }
    return { total: 0, used: 0, free: 0, usagePercent: 0 };
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(1) + ' ' + units[i];
  }
}

export const resourceAlertsService = new ResourceAlertsService();
