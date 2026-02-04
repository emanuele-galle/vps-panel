import cron from 'node-cron';
import { discoveryService } from './discovery.service';
import { prisma } from '../../services/prisma.service';
import log from '../../services/logger.service';

/**
 * Scheduler Service per auto-discovery progetti
 * Scansiona periodicamente /var/www/projects per nuovi progetti non registrati
 */
export class DiscoverySchedulerService {
  private scanTask: ReturnType<typeof cron.schedule> | null = null;
  private lastScanResult: {
    timestamp: Date;
    discovered: number;
    alreadyRegistered: number;
    errors: number;
  } | null = null;

  /**
   * Avvia lo scheduler per il discovery automatico
   * Esegue ogni 30 minuti (default) o all'intervallo specificato
   */
  start(cronExpression = '*/30 * * * *') {
    if (this.scanTask) {
      log.info('[Discovery Scheduler] Già in esecuzione');
      return;
    }

    // Esegui subito una prima scansione all'avvio
    this.runScan();

    // Poi schedula le scansioni periodiche
    this.scanTask = cron.schedule(cronExpression, async () => {
      await this.runScan();
    });

    log.info('[Discovery Scheduler] Avviato - scansione ogni 30 minuti');
  }

  /**
   * Esegue la scansione e notifica se ci sono nuovi progetti
   */
  private async runScan() {
    log.info('[Discovery Scheduler] Avvio scansione progetti...');
    try {
      const result = await discoveryService.discoverProjects();

      this.lastScanResult = {
        timestamp: new Date(),
        discovered: result.discovered.length,
        alreadyRegistered: result.alreadyRegistered.length,
        errors: result.errors.length,
      };

      if (result.discovered.length > 0) {
        log.info(
          `[Discovery Scheduler] Trovati ${result.discovered.length} nuovi progetti non registrati:`
        );
        result.discovered.forEach((p) => {
          log.info(`  - ${p.folderName} (${p.template}): ${p.name}`);
        });

        // Crea una notifica nel sistema per l'admin
        await this.createDiscoveryNotification(result.discovered.length);
      } else {
        log.info('[Discovery Scheduler] Nessun nuovo progetto trovato');
      }

      if (result.errors.length > 0) {
        log.warn(`[Discovery Scheduler] ${result.errors.length} errori durante la scansione`);
      }
    } catch (error) {
      log.error('[Discovery Scheduler] Errore durante scansione:', error);
    }
  }

  /**
   * Crea una notifica per gli admin sui nuovi progetti scoperti
   */
  private async createDiscoveryNotification(count: number) {
    try {
      // Trova tutti gli admin
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      // Crea un log di attività per ogni admin
      for (const admin of admins) {
        await prisma.activityLog.create({
          data: {
            userId: admin.id,
            action: 'PROJECT_DISCOVERY',
            resource: 'PROJECT',
            resourceId: 'system', description: 'Discovery automatico progetti',
            metadata: {
              message: `Trovati ${count} nuovi progetti non registrati. Vai alla sezione Discovery per importarli.`,
              count,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    } catch (error) {
      log.error('[Discovery Scheduler] Errore creazione notifica:', error);
    }
  }

  /**
   * Ferma lo scheduler
   */
  stop() {
    if (this.scanTask) {
      this.scanTask.stop();
      this.scanTask = null;
      log.info('[Discovery Scheduler] Fermato');
    }
  }

  /**
   * Esegui scansione manualmente
   */
  async triggerScan() {
    log.info('[Discovery Scheduler] Scansione manuale avviata...');
    await this.runScan();
    return this.lastScanResult;
  }

  /**
   * Ottieni l'ultimo risultato della scansione
   */
  getLastScanResult() {
    return this.lastScanResult;
  }

  /**
   * Verifica se lo scheduler è attivo
   */
  isRunning(): boolean {
    return this.scanTask !== null;
  }
}

export const discoverySchedulerService = new DiscoverySchedulerService();
