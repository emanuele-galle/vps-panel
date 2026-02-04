import cron from 'node-cron';
import { backupService } from './backup.service';
import log from '../../services/logger.service';

/**
 * Scheduler Service per backup automatici e cleanup
 */
export class SchedulerService {
  private cleanupTask: ReturnType<typeof cron.schedule> | null = null;

  /**
   * Avvia il scheduler per il cleanup automatico
   * Esegue ogni ora il controllo dei backup scaduti
   */
  start() {
    if (this.cleanupTask) {
      log.info('[Backup Scheduler] Già in esecuzione');
      return;
    }

    // Esegui ogni ora (minuto 0)
    this.cleanupTask = cron.schedule('0 * * * *', async () => {
      log.info('[Backup Scheduler] Avvio cleanup backup scaduti...');
      try {
        const count = await backupService.cleanupExpiredBackups();
        log.info(`[Backup Scheduler] Cleanup completato: ${count} backup eliminati`);
      } catch (error) {
        log.error('[Backup Scheduler] Errore durante cleanup:', error);
      }
    });

    log.info('[Backup Scheduler] Avviato - cleanup ogni ora');
  }

  /**
   * Ferma il scheduler
   */
  stop() {
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
      log.info('[Backup Scheduler] Fermato');
    }
  }

  /**
   * Esegui cleanup manualmente (per testing)
   */
  async triggerCleanup() {
    log.info('[Backup Scheduler] Cleanup manuale avviato...');
    try {
      const count = await backupService.cleanupExpiredBackups();
      log.info(`[Backup Scheduler] Cleanup manuale completato: ${count} backup eliminati`);
      return count;
    } catch (error) {
      log.error('[Backup Scheduler] Errore durante cleanup manuale:', error);
      throw error;
    }
  }

  /**
   * Verifica se lo scheduler è attivo
   */
  isRunning(): boolean {
    return this.cleanupTask !== null;
  }
}

export const schedulerService = new SchedulerService();
