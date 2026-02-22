import cron from 'node-cron';
import { prisma } from '../../services/prisma.service';
import { dockerService } from '../docker/docker.service';
import { config } from '../../config/env';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import log from '../../services/logger.service';

// Directory contenente le configurazioni dinamiche di Traefik
const TRAEFIK_DYNAMIC_DIR = '/root/vps-panel/traefik/dynamic';

interface TraefikConfig {
  http?: {
    routers?: Record<string, {
      rule?: string;
      tls?: {
        certResolver?: string;
      };
    }>;
  };
}

/**
 * Domain Sync Scheduler
 * Sincronizza automaticamente i domini da Traefik con il database del VPS Panel
 * Legge sia i file YAML che i labels Docker
 */
export class DomainSchedulerService {
  private syncTask: ReturnType<typeof cron.schedule> | null = null;
  private lastSyncResult: {
    timestamp: Date;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  } | null = null;

  /**
   * Avvia lo scheduler per la sincronizzazione domini
   * Default: ogni 10 minuti
   */
  start(cronExpression = '*/10 * * * *') {
    if (this.syncTask) {
      log.info('[Domain Scheduler] Già in esecuzione');
      return;
    }

    // Esegui subito una prima sincronizzazione all'avvio
    this.runSync();

    // Poi schedula le sincronizzazioni periodiche
    this.syncTask = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    log.info('[Domain Scheduler] Avviato - sync ogni 10 minuti');
  }

  /**
   * Esegue la sincronizzazione dei domini
   */
  private async runSync() {
    log.info('[Domain Scheduler] Avvio sincronizzazione domini...');

    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Sync da file YAML
      const yamlResult = await this.syncFromYamlFiles();
      synced += yamlResult.synced;
      created += yamlResult.created;
      updated += yamlResult.updated;
      errors += yamlResult.errors;

      // Sync da Docker labels
      const dockerResult = await this.syncFromDockerLabels();
      synced += dockerResult.synced;
      created += dockerResult.created;
      updated += dockerResult.updated;
      errors += dockerResult.errors;

      this.lastSyncResult = {
        timestamp: new Date(),
        synced,
        created,
        updated,
        errors,
      };

      log.info(
        `[Domain Scheduler] Sync completato: ${synced} domini sincronizzati (${created} nuovi, ${updated} aggiornati, ${errors} errori)`
      );
    } catch (error) {
      log.error('[Domain Scheduler] Errore durante sincronizzazione:', error);
    }
  }

  /**
   * Sincronizza domini dai file YAML di Traefik
   */
  private async syncFromYamlFiles(): Promise<{ synced: number; created: number; updated: number; errors: number }> {
    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Leggi tutti i file YAML nella directory Traefik
      const files = await fs.readdir(TRAEFIK_DYNAMIC_DIR);
      const yamlFiles = files.filter(
        (f) => f.endsWith('.yml') || f.endsWith('.yaml')
      );

      // File di sistema da escludere
      const systemFiles = [
        'adminer.yml',
        'panel-backend.yml',
        'panel-frontend.yml',
        'middlewares.yml',
        'tls.yml',
      ];

      for (const file of yamlFiles) {
        // Salta file di sistema
        if (systemFiles.includes(file)) continue;

        try {
          const filePath = path.join(TRAEFIK_DYNAMIC_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const config = yaml.load(content) as TraefikConfig;

          if (!config?.http?.routers) continue;

          // Estrai projectSlug dal nome file (es. ecolive.yml -> ecolive)
          const projectSlug = file.replace(/\.(yml|yaml)$/, '');

          // Trova il progetto corrispondente
          const project = await this.findProjectBySlugVariants(projectSlug);

          if (!project) {
            log.debug(`[Domain Scheduler] Progetto non trovato per file: ${file}`);
            continue;
          }

          // Estrai domini da ogni router
          for (const [routerName, router] of Object.entries(config.http.routers)) {
            try {
              // Estrai tutti i domini dalla regola
              const domains = this.extractDomainsFromRule(router.rule || '');
              if (domains.length === 0) continue;

              // Determina se SSL è abilitato
              const sslEnabled = !!router.tls?.certResolver;

              for (const domain of domains) {
                const result = await this.upsertDomain(domain, project.id, sslEnabled, projectSlug);
                if (result === 'created') created++;
                else if (result === 'updated') updated++;
                synced++;
              }
            } catch (routerError) {
              log.error(`[Domain Scheduler] Errore sync router ${routerName}:`, routerError);
              errors++;
            }
          }
        } catch (fileError) {
          log.error(`[Domain Scheduler] Errore lettura file ${file}:`, fileError);
          errors++;
        }
      }
    } catch (error) {
      log.error('[Domain Scheduler] Errore lettura directory Traefik:', error);
    }

    return { synced, created, updated, errors };
  }

  /**
   * Sincronizza domini dai labels Docker
   */
  private async syncFromDockerLabels(): Promise<{ synced: number; created: number; updated: number; errors: number }> {
    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      const containers = await dockerService.listContainers(true);

      // Container di sistema da escludere
      const systemContainers = [
        'vps-panel-backend',
        'vps-panel-frontend',
        'vps-panel-postgres',
        'vps-panel-redis',
        'vps-panel-traefik',
        'vps-panel-filebrowser',
        'vps-panel-adminer',
        'vps-panel-minio',
        'vps-panel-n8n',
      ];

      for (const container of containers) {
        try {
          const containerName = container.Names[0]?.replace(/^\//, '') || '';

          // Salta container di sistema
          const isSystemContainer = systemContainers.some(
            (name) => containerName.toLowerCase().includes(name.toLowerCase())
          );
          if (isSystemContainer) continue;

          // Salta container vps-panel
          const composeProject = container.Labels?.['com.docker.compose.project'] || '';
          if (composeProject === 'vps-panel') continue;

          // Cerca labels Traefik per i domini
          const labels = container.Labels || {};
          
          for (const [key, value] of Object.entries(labels)) {
            // Cerca labels del tipo traefik.http.routers.*.rule
            const ruleMatch = key.match(/^traefik\.http\.routers\.([^.]+)\.rule$/);
            if (!ruleMatch) continue;

            const routerName = ruleMatch[1];
            const domains = this.extractDomainsFromRule(value as string);
            
            if (domains.length === 0) continue;

            // Estrai projectSlug dal nome container
            const slugMatch = containerName.match(/^(.+?)[-_]app$/);
            if (!slugMatch) continue;

            const projectSlug = slugMatch[1];
            const project = await this.findProjectBySlugVariants(projectSlug);

            if (!project) continue;

            // Verifica se SSL è abilitato
            const tlsKey = `traefik.http.routers.${routerName}.tls`;
            const sslEnabled = labels[tlsKey] === 'true' || !!labels[`${tlsKey}.certresolver`];

            for (const domain of domains) {
              const result = await this.upsertDomain(domain, project.id, sslEnabled, projectSlug);
              if (result === 'created') created++;
              else if (result === 'updated') updated++;
              synced++;
            }
          }
        } catch (containerError) {
          errors++;
        }
      }
    } catch (error) {
      log.error('[Domain Scheduler] Errore lettura Docker labels:', error);
    }

    return { synced, created, updated, errors };
  }

  /**
   * Estrae tutti i domini da una regola Traefik
   * Supporta Host(`domain`) e Host(`domain`) || Host(`domain2`)
   */
  private extractDomainsFromRule(rule: string): string[] {
    const domains: string[] = [];
    const hostMatches = rule.matchAll(/Host\(`([^`]+)`\)/g);

    for (const match of hostMatches) {
      domains.push(match[1]);
    }

    return domains;
  }

  /**
   * Inserisce o aggiorna un dominio nel database
   */
  private async upsertDomain(
    domain: string,
    projectId: string,
    sslEnabled: boolean,
    projectSlug: string
  ): Promise<'created' | 'updated' | 'unchanged'> {
    // Cerca dominio esistente
    const existingDomain = await prisma.domain.findFirst({
      where: { domain },
    });

    if (existingDomain) {
      // Aggiorna solo se necessario
      if (
        existingDomain.projectId !== projectId ||
        existingDomain.sslEnabled !== sslEnabled
      ) {
        await prisma.domain.update({
          where: { id: existingDomain.id },
          data: {
            projectId,
            sslEnabled,
            sslProvider: sslEnabled ? 'LETSENCRYPT' : undefined,
            status: 'ACTIVE',
            isActive: true,
            updatedAt: new Date(),
          },
        });
        return 'updated';
      }
      return 'unchanged';
    }

    // Crea nuovo dominio
    await prisma.domain.create({
      data: {
        id: `dom_${projectSlug.replace(/-/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        domain,
        type: domain.endsWith(`.${config.PREVIEW_DOMAIN}`) ? 'PREVIEW' : 'CUSTOM',
        status: 'ACTIVE',
        sslEnabled,
        sslProvider: sslEnabled ? 'LETSENCRYPT' : undefined,
        isActive: true,
        projectId,
      },
    });
    return 'created';
  }

  /**
   * Trova un progetto cercando diverse varianti dello slug
   */
  private async findProjectBySlugVariants(baseSlug: string): Promise<{ id: string } | null> {
    const suffixes = ['', '-website', '-app', '-site', '-web', '-frontend'];

    for (const suffix of suffixes) {
      const slug = baseSlug + suffix;
      const project = await prisma.project.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (project) {
        return project;
      }
    }

    // Prova match parziale
    const projectByPartialMatch = await prisma.project.findFirst({
      where: {
        slug: {
          startsWith: baseSlug,
        },
      },
      select: { id: true },
    });

    return projectByPartialMatch;
  }

  /**
   * Ferma lo scheduler
   */
  stop() {
    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask = null;
      log.info('[Domain Scheduler] Fermato');
    }
  }

  /**
   * Esegui sincronizzazione manualmente
   */
  async triggerSync() {
    log.info('[Domain Scheduler] Sincronizzazione manuale avviata...');
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

export const domainSchedulerService = new DomainSchedulerService();
