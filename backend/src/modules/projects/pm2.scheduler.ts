import cron from 'node-cron';
import { prisma } from '../../services/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from '../../services/logger.service';

const execAsync = promisify(exec);

interface PM2AppBasic {
  name: string;
  pm2_env: {
    status: string;
    PORT?: string;
    pm_uptime?: number;
  };
}

/**
 * PM2 Sync Scheduler
 * Sincronizza lo stato delle app PM2 con il database del VPS Panel.
 * Su VPS 1, i progetti client girano come processi PM2 (non Docker).
 *
 * Esegue `pm2 jlist` sull'host tramite nsenter (il container ha PID namespace access)
 * o tramite docker host exec.
 */
export class PM2SchedulerService {
  private syncTask: ReturnType<typeof cron.schedule> | null = null;
  private lastSyncResult: {
    timestamp: Date;
    synced: number;
    updated: number;
    errors: number;
  } | null = null;

  start(cronExpression = '*/5 * * * *') {
    if (this.syncTask) {
      log.info('[PM2 Scheduler] Già in esecuzione');
      return;
    }

    this.runSync();

    this.syncTask = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    log.info('[PM2 Scheduler] Avviato - sync ogni 5 minuti');
  }

  private async runSync() {
    let synced = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Execute pm2 jlist on the host via nsenter (container runs as root with host PID access)
      // Fallback chain: nsenter -> chroot -> direct exec
      let stdout: string;

      try {
        // Try nsenter to host namespace (requires --pid=host in docker)
        const result = await execAsync(
          'nsenter -t 1 -m -u -i -n -- su - sviluppatore -c "pm2 jlist" 2>/dev/null',
          { timeout: 15000 }
        );
        stdout = result.stdout;
      } catch {
        try {
          // Fallback: use chroot to host filesystem (if / is mounted)
          const result = await execAsync(
            'chroot /host su - sviluppatore -c "pm2 jlist" 2>/dev/null',
            { timeout: 15000 }
          );
          stdout = result.stdout;
        } catch {
          try {
            // Fallback: direct pm2 jlist (if pm2 is available in container)
            const result = await execAsync('pm2 jlist', {
              timeout: 15000,
              env: { ...process.env, HOME: '/home/sviluppatore', PM2_HOME: '/home/sviluppatore/.pm2' },
            });
            stdout = result.stdout;
          } catch {
            // PM2 not accessible from container - this is expected on first run
            log.debug('[PM2 Scheduler] PM2 non accessibile dal container - sync skip');
            return;
          }
        }
      }

      if (!stdout || stdout.trim() === '' || stdout.trim() === '[]') {
        return;
      }

      const apps: PM2AppBasic[] = JSON.parse(stdout);

      // Filtra moduli PM2
      const projectApps = apps.filter(
        (app) => !app.name.startsWith('pm2-') && !app.name.startsWith('@')
      );

      for (const app of projectApps) {
        try {
          const project = await prisma.project.findFirst({
            where: {
              OR: [
                { slug: app.name },
                { name: { equals: app.name, mode: 'insensitive' } },
              ],
            },
          });

          if (!project) {
            log.debug(`[PM2 Scheduler] Progetto non trovato per app PM2: ${app.name}`);
            continue;
          }

          const pm2Status = app.pm2_env.status;
          const isOnline = pm2Status === 'online';

          await prisma.project.update({
            where: { id: project.id },
            data: {
              status: isOnline ? 'ACTIVE' : pm2Status === 'stopped' ? 'INACTIVE' : 'ERROR',
              port: app.pm2_env.PORT ? parseInt(app.pm2_env.PORT, 10) : project.port,
              updatedAt: new Date(),
            },
          });

          updated++;
          synced++;
        } catch (appError) {
          log.error(`[PM2 Scheduler] Errore sync app ${app.name}:`, appError);
          errors++;
        }
      }

      this.lastSyncResult = {
        timestamp: new Date(),
        synced,
        updated,
        errors,
      };

      if (synced > 0 || errors > 0) {
        log.info(
          `[PM2 Scheduler] Sync completato: ${synced} app sincronizzate (${updated} aggiornate, ${errors} errori)`
        );
      }
    } catch (error) {
      log.warn('[PM2 Scheduler] PM2 sync non disponibile dal container');
    }
  }

  stop() {
    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask = null;
      log.info('[PM2 Scheduler] Fermato');
    }
  }

  async triggerSync() {
    await this.runSync();
    return this.lastSyncResult;
  }

  getLastSyncResult() {
    return this.lastSyncResult;
  }

  isRunning(): boolean {
    return this.syncTask !== null;
  }
}

export const pm2SchedulerService = new PM2SchedulerService();
