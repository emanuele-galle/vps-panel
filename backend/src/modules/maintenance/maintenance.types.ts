/**
 * Maintenance Module Types
 */

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  lastRun: Date | null;
  nextRun: Date | null;
  enabled: boolean;
  schedule: string; // cron expression
}

export interface MaintenanceResult {
  task: string;
  success: boolean;
  message: string;
  freedSpace?: string;
  itemsRemoved?: number;
  duration?: number;
  timestamp: Date;
}

export interface MaintenanceReport {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  results: MaintenanceResult[];
  totalFreedSpace: string;
}

export interface CleanupOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface N8NCleanupOptions extends CleanupOptions {
  olderThanDays?: number;
  status?: 'success' | 'error' | 'all';
}

export interface DockerCleanupOptions extends CleanupOptions {
  pruneImages?: boolean;
  pruneVolumes?: boolean;
  pruneBuildCache?: boolean;
  pruneNetworks?: boolean;
}

export interface LogsCleanupOptions extends CleanupOptions {
  maxSizeMB?: number;
  olderThanDays?: number;
}
