import { FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { safeExec } from '../../utils/shell-sanitizer';

const LOGS_DIR = '/opt/backups/logs';

// Max age for completed jobs before cleanup (1 hour)
const JOB_MAX_AGE_MS = 60 * 60 * 1000;

interface BackupJob {
  id: string;
  type: 'databases' | 'full-system';
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  pid?: number;
  error?: string;
}

const runningJobs: Map<string, BackupJob> = new Map();

// Cleanup old completed jobs periodically
function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of runningJobs) {
    if (job.status !== 'running' && job.completedAt) {
      const age = now - job.completedAt.getTime();
      if (age > JOB_MAX_AGE_MS) {
        runningJobs.delete(id);
      }
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldJobs, 10 * 60 * 1000);

// Valid folder pattern for GDrive paths (alphanumeric, dash, underscore, dot, slash)
const VALID_FOLDER_PATTERN = /^[a-zA-Z0-9._/-]*$/;

function validateGDriveFolder(folder: string): boolean {
  if (!folder || folder.length === 0) return true; // Empty is allowed (root)
  if (folder.length > 256) return false;
  if (folder.includes('..')) return false; // Path traversal
  return VALID_FOLDER_PATTERN.test(folder);
}

export class GDriveBackupController {
  async triggerDatabaseBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      for (const [id, job] of runningJobs) {
        if (job.type === 'databases' && job.status === 'running') {
          return reply.status(409).send({
            success: false,
            error: { code: 'BACKUP_IN_PROGRESS', message: 'Un backup database e gia in esecuzione', jobId: id },
          });
        }
      }

      const jobId = 'db-' + Date.now();

      // Execute backup using spawn with array args (no shell injection possible)
      const child = spawn('docker', [
        'run', '--rm', '-d',
        '--network', 'host',
        '--privileged',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', '/root/.config/rclone:/root/.config/rclone',
        '-v', '/opt/backups:/opt/backups',
        'alpine/curl',
        'sh', '-c', 'apk add --no-cache bash rclone && bash /opt/backups/scripts/backup-databases.sh'
      ], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const job: BackupJob = { id: jobId, type: 'databases', status: 'running', startedAt: new Date(), pid: child.pid };
      runningJobs.set(jobId, job);

      child.on('close', (code) => {
        const j = runningJobs.get(jobId);
        if (j) {
          j.status = code === 0 ? 'completed' : 'failed';
          j.completedAt = new Date();
          if (code !== 0) j.error = 'Exit code: ' + code;
        }
      });

      child.on('error', (err) => {
        const j = runningJobs.get(jobId);
        if (j) { j.status = 'failed'; j.completedAt = new Date(); j.error = err instanceof Error ? err.message : 'Unknown error'; }
      });

      child.unref();

      return reply.send({
        success: true,
        data: { jobId, message: 'Backup database avviato', status: 'running', checkStatusUrl: '/api/gdrive-backup/status/' + jobId },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Backup database failed');
      return reply.status(500).send({ success: false, error: { code: 'BACKUP_ERROR', message: error instanceof Error ? error.message : 'Unknown error' || 'Errore avvio backup' } });
    }
  }

  async triggerFullSystemBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      for (const [id, job] of runningJobs) {
        if (job.type === 'full-system' && job.status === 'running') {
          return reply.status(409).send({
            success: false,
            error: { code: 'BACKUP_IN_PROGRESS', message: 'Un backup completo e gia in esecuzione', jobId: id },
          });
        }
      }

      const jobId = 'full-' + Date.now();

      const child = spawn('docker', [
        'run', '--rm', '-d',
        '--network', 'host',
        '--privileged',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', '/root/.config/rclone:/root/.config/rclone',
        '-v', '/opt/backups:/opt/backups',
        '-v', '/var/www/projects:/var/www/projects:ro',
        '-v', '/home:/home:ro',
        '-v', '/root:/root_host:ro',
        '-v', '/opt:/opt_host:ro',
        '-v', '/etc:/etc_host:ro',
        '-v', '/var/spool/cron/crontabs:/var/spool/cron/crontabs:ro',
        'alpine/curl',
        'sh', '-c', 'apk add --no-cache bash rclone && bash /opt/backups/scripts/backup-full-system.sh'
      ], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const job: BackupJob = { id: jobId, type: 'full-system', status: 'running', startedAt: new Date(), pid: child.pid };
      runningJobs.set(jobId, job);

      child.on('close', (code) => {
        const j = runningJobs.get(jobId);
        if (j) {
          j.status = code === 0 ? 'completed' : 'failed';
          j.completedAt = new Date();
          if (code !== 0) j.error = 'Exit code: ' + code;
        }
      });

      child.on('error', (err) => {
        const j = runningJobs.get(jobId);
        if (j) { j.status = 'failed'; j.completedAt = new Date(); j.error = err instanceof Error ? err.message : 'Unknown error'; }
      });

      child.unref();

      return reply.send({
        success: true,
        data: { jobId, message: 'Backup completo avviato', status: 'running', checkStatusUrl: '/api/gdrive-backup/status/' + jobId },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Full system backup failed');
      return reply.status(500).send({ success: false, error: { code: 'BACKUP_ERROR', message: error instanceof Error ? error.message : 'Unknown error' || 'Errore avvio backup' } });
    }
  }

  async getJobStatus(request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) {
    try {
      const { jobId } = request.params;
      const job = runningJobs.get(jobId);

      if (!job) {
        return reply.status(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job non trovato' } });
      }

      return reply.send({
        success: true,
        data: {
          ...job,
          duration: job.completedAt
            ? Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000)
            : Math.round((Date.now() - job.startedAt.getTime()) / 1000),
        },
      });
    } catch (error) {
      return reply.status(500).send({ success: false, error: { code: 'STATUS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }

  async listJobs(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Clean up old jobs before listing
      cleanupOldJobs();

      const jobs = Array.from(runningJobs.values())
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 20);
      return reply.send({ success: true, data: jobs });
    } catch (error) {
      return reply.status(500).send({ success: false, error: { code: 'LIST_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }

  async getLogs(request: FastifyRequest<{ Querystring: { type?: string; lines?: string } }>, reply: FastifyReply) {
    try {
      const { type, lines = '100' } = request.query;
      const numLines = Math.min(parseInt(lines) || 100, 500);
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const logFiles: string[] = [];
      if (!type || type === 'databases') logFiles.push('backup-' + today + '.log');
      if (!type || type === 'full-system') { logFiles.push('backup-full-' + today + '.log'); logFiles.push('backup-full-system.log'); }
      const logs: { [key: string]: string[] } = {};
      for (const logFile of logFiles) {
        const logPath = path.join(LOGS_DIR, logFile);
        try {
          const content = await fs.readFile(logPath, 'utf-8');
          const allLines = content.split('\n').filter(Boolean);
          logs[logFile] = allLines.slice(-numLines);
        } catch { /* ignore */ }
      }
      return reply.send({ success: true, data: { logs, logsDir: LOGS_DIR } });
    } catch (error) {
      return reply.status(500).send({ success: false, error: { code: 'LOGS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }

  async getSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Execute systemctl commands via docker using safeExec (no shell injection)
      const getTimerStatus = async (timerName: string): Promise<any> => {
        try {
          const result = await safeExec('docker', [
            'run', '--rm', '--privileged', '--pid=host',
            'alpine',
            'nsenter', '-t', '1', '-m', '-u', '-n', '-i',
            'systemctl', 'status', timerName + '.timer'
          ], { timeout: 10000 });

          const stdout = result.stdout;
          const isActive = stdout.includes('Active: active');
          const nextRunMatch = stdout.match(/Trigger: (.+)/);
          return { name: timerName, active: isActive, nextRun: nextRunMatch ? nextRunMatch[1] : null };
        } catch {
          return { name: timerName, active: false, nextRun: null };
        }
      };

      const [dbTimer, fullTimer, configTimer] = await Promise.all([
        getTimerStatus('backup-databases'),
        getTimerStatus('backup-full-system'),
        getTimerStatus('backup-configs'),
      ]);

      return reply.send({
        success: true,
        data: {
          schedules: [
            { type: 'databases', description: 'Backup database PostgreSQL/MySQL', schedule: 'Giornaliero alle 03:00', destination: 'Google Drive: VPS-fodivps1-backups/databases/', ...dbTimer },
            { type: 'full-system', description: 'Backup completo sistema (progetti, config, home)', schedule: 'Domenica alle 05:00', destination: 'Google Drive: VPS-fodivps1-backups/full-system-backup/', ...fullTimer },
            { type: 'configs', description: 'Backup configurazioni sistema', schedule: 'Domenica alle 04:00', destination: 'Google Drive: VPS-fodivps1-backups/configs/', ...configTimer },
          ],
          retention: '30 giorni',
        },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to get backup schedule');
      return reply.status(500).send({ success: false, error: { code: 'SCHEDULE_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }

  async listGDriveBackups(request: FastifyRequest<{ Querystring: { folder?: string } }>, reply: FastifyReply) {
    try {
      const { folder = '' } = request.query;

      // Validate folder to prevent command injection
      if (!validateGDriveFolder(folder)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_FOLDER', message: 'Nome cartella non valido' }
        });
      }

      const remotePath = 'gdrive:VPS-fodivps1-backups/' + folder;

      // Use safeExec with array args instead of exec with string concatenation
      const result = await safeExec('docker', [
        'run', '--rm',
        '-v', '/root/.config/rclone:/root/.config/rclone',
        'rclone/rclone',
        'lsf', remotePath,
        '--format', 'pst'
      ], { timeout: 30000 });

      const files = result.stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [filePath, size, time] = line.split(';');
        return { name: filePath, size: parseInt(size) || 0, modified: time, isDir: filePath ? filePath.endsWith('/') : false };
      });

      return reply.send({ success: true, data: { folder: folder || '/', files } });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to list GDrive backups');
      return reply.status(500).send({ success: false, error: { code: 'LIST_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }
}

export const gdriveBackupController = new GDriveBackupController();
