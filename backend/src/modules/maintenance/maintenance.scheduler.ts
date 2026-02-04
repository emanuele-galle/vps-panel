import cron from 'node-cron';
import { maintenanceService } from './maintenance.service';
import { systemSettingsService } from '../system-settings/system-settings.service';
import log from '../../services/logger.service';

class MaintenanceSchedulerService {
  private maintenanceTask: ReturnType<typeof cron.schedule> | null = null;
  private currentSchedule: string = '0 3 * * 0'; // Default: domenica alle 3:00

  async start() {
    if (this.maintenanceTask) {
      log.info('[Maintenance Scheduler] Gia in esecuzione');
      return;
    }

    // Carica schedule dalle impostazioni
    const schedule = await systemSettingsService.getSettingValue('maintenance.schedule');
    const enabled = await systemSettingsService.getSettingValue('maintenance.enabled');

    if (enabled !== 'true') {
      log.info('[Maintenance Scheduler] Disabilitato nelle impostazioni');
      return;
    }

    this.currentSchedule = schedule || this.currentSchedule;

    if (!cron.validate(this.currentSchedule)) {
      log.error('[Maintenance Scheduler] Schedule non valido:', this.currentSchedule);
      return;
    }

    this.maintenanceTask = cron.schedule(this.currentSchedule, async () => {
      log.info('[Maintenance Scheduler] Avvio manutenzione programmata...');
      try {
        const report = await maintenanceService.runFullMaintenance();
        log.info({ freed: report.totalFreedSpace }, '[Maintenance Scheduler] Completata, spazio liberato');
      } catch (error) {
        log.error('[Maintenance Scheduler] Errore:', error);
      }
    });

    log.info('[Maintenance Scheduler] Avviato - schedule:', this.currentSchedule);
  }

  stop() {
    if (this.maintenanceTask) {
      this.maintenanceTask.stop();
      this.maintenanceTask = null;
      log.info('[Maintenance Scheduler] Fermato');
    }
  }

  async restart() {
    this.stop();
    await this.start();
  }

  async triggerNow() {
    log.info('[Maintenance Scheduler] Esecuzione manuale...');
    return maintenanceService.runFullMaintenance();
  }

  isRunning(): boolean {
    return this.maintenanceTask !== null;
  }

  getSchedule(): string {
    return this.currentSchedule;
  }
}

export const maintenanceSchedulerService = new MaintenanceSchedulerService();
