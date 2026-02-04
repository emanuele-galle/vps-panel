import cron from 'node-cron';
import { prisma } from '../../services/prisma.service';
import { dockerService } from './docker.service';
import log from '../../services/logger.service';
import { ContainerStatus } from '@prisma/client';
import { notificationService } from '../../services/notification.service';

/**
 * Container Sync Scheduler
 * Sincronizza automaticamente i container Docker con il database del VPS Panel
 * Estrae projectSlug dal nome container e fa upsert nella tabella containers
 */
export class ContainerSchedulerService {
  private syncTask: ReturnType<typeof cron.schedule> | null = null;
  private lastSyncResult: {
    timestamp: Date;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  } | null = null;

  /**
   * Avvia lo scheduler per la sincronizzazione container
   * Default: ogni 5 minuti
   */
  start(cronExpression = '*/5 * * * *') {
    if (this.syncTask) {
      log.info('[Container Scheduler] Già in esecuzione');
      return;
    }

    // Esegui subito una prima sincronizzazione all'avvio
    this.runSync();

    // Poi schedula le sincronizzazioni periodiche
    this.syncTask = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    log.info('[Container Scheduler] Avviato - sync ogni 5 minuti');
  }

  /**
   * Esegue la sincronizzazione dei container
   */
  private async runSync() {
    log.info('[Container Scheduler] Avvio sincronizzazione container...');

    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Ottieni tutti i container Docker (esclusi quelli di sistema)
      const containers = await dockerService.listContainers(true);

      // Container di sistema da escludere
      const systemContainers = [
        'vps-panel-backend',
        'vps-panel-frontend',
        'vps-panel-postgres',
        'vps-panel-redis',
        'vps-panel-traefik',
        'vps-panel-filebrowser',
        'vps-panel-filebrowser-system',
        'vps-panel-adminer',
        'vps-panel-minio',
        'vps-panel-n8n',
        'traefik',
        'adminer',
      ];

      for (const container of containers) {
        try {
          const containerName = container.Names[0]?.replace(/^\//, '') || '';

          // Salta container di sistema
          const isSystemContainer = systemContainers.some(
            (name) => containerName.toLowerCase().includes(name.toLowerCase())
          );
          if (isSystemContainer) continue;

          // Salta container del progetto vps-panel
          const composeProject = container.Labels?.['com.docker.compose.project'] || '';
          if (composeProject === 'vps-panel') continue;

          // Estrai projectSlug dal nome container
          // Pattern: {slug}_app o {slug}-app
          const slugMatch = containerName.match(/^(.+?)[-_]app$/);
          if (!slugMatch) continue;

          const projectSlug = slugMatch[1];

          // Trova il progetto corrispondente
          const project = await prisma.project.findUnique({
            where: { slug: projectSlug },
          });

          if (!project) {
            log.debug(`[Container Scheduler] Progetto non trovato per container: ${containerName}`);
            continue;
          }

          // Mappa lo stato Docker al nostro enum
          const status = this.mapDockerStatus(container.State);

          // Estrai le porte
          const ports = container.Ports?.map((p) => ({
            internal: p.PrivatePort,
            external: p.PublicPort || null,
          })) || [];

          // Estrai networks
          const networks = Object.keys(container.NetworkSettings?.Networks || {});

          // Cerca container esistente per dockerId o nome
          const existingContainer = await prisma.container.findFirst({
            where: {
              OR: [
                { dockerId: container.Id.substring(0, 12) },
                { name: containerName },
              ],
            },
          });

          if (existingContainer) {
            const previousStatus = existingContainer.status;

            // Aggiorna container esistente
            await prisma.container.update({
              where: { id: existingContainer.id },
              data: {
                dockerId: container.Id.substring(0, 12),
                name: containerName,
                image: container.Image,
                status,
                ports: ports as any,
                networks,
                projectId: project.id,
                updatedAt: new Date(),
              },
            });

            // Notifica admin se il container è passato a EXITED o ERROR
            if (
              previousStatus === 'RUNNING' &&
              (status === 'EXITED' || status === 'ERROR')
            ) {
              const statusLabel = status === 'ERROR' ? 'crash' : 'fermato';
              try {
                await notificationService.createForAdmins({
                  type: 'ERROR',
                  title: `Container ${statusLabel}: ${containerName}`,
                  message: `Il container ${containerName} del progetto ${project.name} è passato da RUNNING a ${status}.`,
                  actionLabel: 'Vai al progetto',
                  actionHref: `/dashboard/projects/${project.id}`,
                  priority: 'HIGH',
                  source: 'container-scheduler',
                  sourceId: existingContainer.id,
                });
              } catch (notifErr) {
                log.error(`[Container Scheduler] Errore invio notifica:`, notifErr);
              }
            }

            updated++;
          } else {
            // Crea nuovo container
            await prisma.container.create({
              data: {
                id: `cnt_${projectSlug.replace(/-/g, '_')}_${Date.now()}`,
                dockerId: container.Id.substring(0, 12),
                name: containerName,
                image: container.Image,
                status,
                ports: ports as any,
                environment: {},
                volumes: {},
                networks,
                restartPolicy: 'unless-stopped',
                projectId: project.id,
              },
            });
            created++;
          }

          synced++;
        } catch (containerError) {
          log.error(`[Container Scheduler] Errore sync container:`, containerError);
          errors++;
        }
      }

      this.lastSyncResult = {
        timestamp: new Date(),
        synced,
        created,
        updated,
        errors,
      };

      log.info(
        `[Container Scheduler] Sync completato: ${synced} container sincronizzati (${created} nuovi, ${updated} aggiornati, ${errors} errori)`
      );
    } catch (error) {
      log.error('[Container Scheduler] Errore durante sincronizzazione:', error);
    }
  }

  /**
   * Mappa lo stato Docker al nostro enum ContainerStatus
   */
  private mapDockerStatus(dockerState: string): ContainerStatus {
    const stateMap: Record<string, ContainerStatus> = {
      running: 'RUNNING',
      created: 'CREATED',
      paused: 'PAUSED',
      restarting: 'RESTARTING',
      exited: 'EXITED',
      dead: 'ERROR',
    };

    return stateMap[dockerState.toLowerCase()] || 'STOPPED';
  }

  /**
   * Ferma lo scheduler
   */
  stop() {
    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask = null;
      log.info('[Container Scheduler] Fermato');
    }
  }

  /**
   * Esegui sincronizzazione manualmente
   */
  async triggerSync() {
    log.info('[Container Scheduler] Sincronizzazione manuale avviata...');
    await this.runSync();
    return this.lastSyncResult;
  }

  /**
   * Ottieni l'ultimo risultato della sincronizzazione
   */
  getLastSyncResult() {
    return this.lastSyncResult;
  }

  /**
   * Verifica se lo scheduler è attivo
   */
  isRunning(): boolean {
    return this.syncTask !== null;
  }
}

export const containerSchedulerService = new ContainerSchedulerService();
