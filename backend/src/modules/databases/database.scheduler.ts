import cron from 'node-cron';
import { prisma } from '../../services/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from '../../services/logger.service';
import { config } from '../../config/env';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);
const POSTGRES_USER = process.env.POSTGRES_USER || 'panel_user';
const POSTGRES_DB = process.env.POSTGRES_DB || 'vps_panel';

/**
 * Database Sync Scheduler
 * Sincronizza automaticamente i database PostgreSQL con il database del VPS Panel
 * Legge la lista database da PostgreSQL e associa ai progetti tramite naming convention
 */
export class DatabaseSchedulerService {
  private syncTask: ReturnType<typeof cron.schedule> | null = null;
  private lastSyncResult: {
    timestamp: Date;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  } | null = null;

  /**
   * Avvia lo scheduler per la sincronizzazione database
   * Default: ogni 10 minuti
   */
  start(cronExpression = '*/10 * * * *') {
    if (this.syncTask) {
      log.info('[Database Scheduler] Già in esecuzione');
      return;
    }

    // Esegui subito una prima sincronizzazione all'avvio
    this.runSync();

    // Poi schedula le sincronizzazioni periodiche
    this.syncTask = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    log.info('[Database Scheduler] Avviato - sync ogni 10 minuti');
  }

  /**
   * Esegue la sincronizzazione dei database
   */
  private async runSync() {
    log.info('[Database Scheduler] Avvio sincronizzazione database...');

    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      // Ottieni lista database da PostgreSQL
      const { stdout } = await execAsync(
        `docker exec vps-panel-postgres psql -U ${POSTGRES_USER} -d postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', '${POSTGRES_DB}');"`
      );

      const databases = stdout
        .split('\n')
        .map((db) => db.trim())
        .filter((db) => db.length > 0);

      for (const dbName of databases) {
        try {
          // Estrai projectSlug dal nome database
          // Pattern: {slug}_db (es. barber_sergi_db -> barber-sergi, ecolive_db -> ecolive)
          const slugMatch = dbName.match(/^(.+?)_db$/);
          if (!slugMatch) continue;

          // Converti underscore in dash per lo slug base
          const baseSlug = slugMatch[1].replace(/_/g, '-');

          // Cerca il progetto con diverse varianti dello slug
          const project = await this.findProjectBySlugVariants(baseSlug);

          if (!project) {
            log.debug(`[Database Scheduler] Progetto non trovato per database: ${dbName} (slug base: ${baseSlug})`);
            continue;
          }

          // Cerca credenziali nel file .env.docker del progetto
          const credentials = await this.extractCredentialsFromEnv(project.path, dbName);

          // Cerca database esistente per questo progetto
          const existingDb = await prisma.database.findFirst({
            where: {
              OR: [
                { databaseName: dbName },
                { projectId: project.id },
              ],
            },
          });

          if (existingDb) {
            // Aggiorna database esistente
            const updateData: any = {
              databaseName: dbName,
              host: 'vps-panel-postgres',
              port: 5432,
              updatedAt: new Date(),
            };

            if (credentials) {
              updateData.username = credentials.username;
              updateData.password = credentials.password;
            }

            await prisma.database.update({
              where: { id: existingDb.id },
              data: updateData,
            });
            updated++;
          } else if (credentials) {
            // Crea nuovo database solo se abbiamo le credenziali
            await prisma.database.create({
              data: {
                id: `db_${baseSlug.replace(/-/g, '_')}_${Date.now()}`,
                name: `${project.name} PostgreSQL`,
                type: 'POSTGRESQL',
                databaseName: dbName,
                host: 'vps-panel-postgres',
                port: 5432,
                username: credentials.username,
                password: credentials.password,
                projectId: project.id,
              },
            });
            created++;
          }

          synced++;
        } catch (dbError) {
          log.error(`[Database Scheduler] Errore sync database ${dbName}:`, dbError);
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
        `[Database Scheduler] Sync completato: ${synced} database sincronizzati (${created} nuovi, ${updated} aggiornati, ${errors} errori)`
      );
    } catch (error) {
      log.error('[Database Scheduler] Errore durante sincronizzazione:', error);
    }
  }

  /**
   * Trova un progetto cercando diverse varianti dello slug
   * Gestisce suffissi comuni come -website, -app, -site, ecc.
   */
  private async findProjectBySlugVariants(baseSlug: string): Promise<{ id: string; name: string; path: string } | null> {
    // Lista di suffissi comuni da provare
    const suffixes = ['', '-website', '-app', '-site', '-web', '-frontend'];

    for (const suffix of suffixes) {
      const slug = baseSlug + suffix;
      const project = await prisma.project.findUnique({
        where: { slug },
        select: { id: true, name: true, path: true },
      });

      if (project) {
        return project;
      }
    }

    // Prova anche a cercare progetti che contengono lo slug base
    const projectByPartialMatch = await prisma.project.findFirst({
      where: {
        slug: {
          startsWith: baseSlug,
        },
      },
      select: { id: true, name: true, path: true },
    });

    return projectByPartialMatch;
  }

  /**
   * Estrae credenziali database dal file .env.docker del progetto
   */
  private async extractCredentialsFromEnv(
    projectPath: string,
    dbName: string
  ): Promise<{ username: string; password: string } | null> {
    try {
      // Prova prima .env.docker, poi .env
      const envFiles = ['.env.docker', '.env', '.env.local'];

      for (const envFile of envFiles) {
        try {
          const envPath = path.join(projectPath, envFile);
          const content = await fs.readFile(envPath, 'utf-8');

          // Cerca DATABASE_URL nel formato postgresql://user:pass@host:port/db
          const dbUrlMatch = content.match(
            /DATABASE_URL=postgresql:\/\/([^:]+):([^@]+)@[^/]+\/(\w+)/
          );

          if (dbUrlMatch) {
            return {
              username: dbUrlMatch[1],
              password: dbUrlMatch[2],
            };
          }

          // Cerca variabili separate
          const userMatch = content.match(/POSTGRES_USER(?:NAME)?=(\w+)/);
          const passMatch = content.match(/POSTGRES_PASSWORD=(.+)/);

          if (userMatch && passMatch) {
            return {
              username: userMatch[1],
              password: passMatch[1].trim(),
            };
          }
        } catch {
          // File non trovato, prova il prossimo
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Ferma lo scheduler
   */
  stop() {
    if (this.syncTask) {
      this.syncTask.stop();
      this.syncTask = null;
      log.info('[Database Scheduler] Fermato');
    }
  }

  /**
   * Esegui sincronizzazione manualmente
   */
  async triggerSync() {
    log.info('[Database Scheduler] Sincronizzazione manuale avviata...');
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

export const databaseSchedulerService = new DatabaseSchedulerService();
