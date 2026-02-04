import cron from 'node-cron';
import { prisma } from '../../services/prisma.service';
import { projectsService } from './projects.service';
import { projectEvents, ProjectEventTypes } from './projects.service';
import log from '../../services/logger.service';

/**
 * Credentials Scheduler Service
 * Periodically syncs credentials from vps-credentials.json files to database
 * Ensures project credentials are always up-to-date
 */
export class CredentialsSchedulerService {
  private syncTask: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private lastSyncResult: {
    timestamp: Date;
    synced: number;
    failed: number;
    unchanged: number;
  } | null = null;

  /**
   * Start the credentials sync scheduler
   * Default: every 5 minutes
   */
  start(cronExpression = '*/5 * * * *') {
    if (this.syncTask) {
      log.info('[Credentials Scheduler] Already running');
      return;
    }

    // Run initial sync after 30 seconds (give time for app to fully start)
    setTimeout(() => this.runSync(), 30000);

    // Schedule periodic syncs
    this.syncTask = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    log.info('[Credentials Scheduler] Started - syncing every 5 minutes');
  }

  /**
   * Run credentials sync for all active projects
   */
  private async runSync() {
    if (this.isRunning) {
      log.info('[Credentials Scheduler] Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    log.info('[Credentials Scheduler] Starting credentials sync...');

    let synced = 0;
    let failed = 0;
    let unchanged = 0;

    try {
      // Get all active projects
      const projects = await prisma.project.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true, path: true }
      });

      for (const project of projects) {
        try {
          const result = await projectsService.syncCredentialsFromFile(
            project.id,
            'system', // System user ID
            'ADMIN'   // Use admin role for system sync
          );

          if (result.synced) {
            synced++;
            // Emit event for real-time update
            projectEvents.emit(ProjectEventTypes.PROJECT_CREDENTIALS_SYNCED, {
              projectId: project.id,
              automatic: true
            });
          } else {
            unchanged++;
          }
        } catch (error) {
          // File not found is expected for some projects - don't log as error
          if ((error as any).code !== 'ENOENT') {
            log.warn(`[Credentials Scheduler] Failed to sync ${project.slug}:`, error instanceof Error ? error.message : 'Unknown error');
            failed++;
          } else {
            unchanged++;
          }
        }
      }

      this.lastSyncResult = {
        timestamp: new Date(),
        synced,
        failed,
        unchanged
      };

      if (synced > 0 || failed > 0) {
        log.info(`[Credentials Scheduler] Sync complete: ${synced} synced, ${failed} failed, ${unchanged} unchanged`);
      }
    } catch (error) {
      log.error('[Credentials Scheduler] Error during sync:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Trigger manual sync
   */
  async triggerSync() {
    log.info('[Credentials Scheduler] Manual sync triggered');
    await this.runSync();
    return this.lastSyncResult;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask = null;
      log.info('[Credentials Scheduler] Stopped');
    }
  }

  /**
   * Get last sync result
   */
  getLastSyncResult() {
    return this.lastSyncResult;
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.syncTask !== null;
  }
}

export const credentialsSchedulerService = new CredentialsSchedulerService();
