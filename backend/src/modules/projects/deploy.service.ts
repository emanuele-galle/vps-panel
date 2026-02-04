import { spawn } from 'child_process';
import { prisma } from '../../services/prisma.service';
import { projectEvents, ProjectEventTypes } from './projects.service';
import log from '../../services/logger.service';
import { notificationService } from '../../services/notification.service';
import { DeploymentStatus } from '@prisma/client';

const DEPLOY_EVENT_TYPES = {
  DEPLOY_LOG: 'deploy:log',
  DEPLOY_STATUS: 'deploy:status',
  DEPLOY_COMPLETED: 'deploy:completed',
} as const;

export class DeployService {
  /**
   * Start a deploy: creates a deployment record and runs the pipeline async
   */
  async startDeploy(projectId: string, userId: string, branch?: string) {
    // Check no active deploy for this project
    const activeDeployment = await prisma.deployment.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'GIT_PULLING', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK'] },
      },
    });

    if (activeDeployment) {
      throw new Error('Un deploy è già in corso per questo progetto');
    }

    // Get project
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Progetto non trovato');

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        userId,
        gitBranch: branch || 'main',
        status: 'PENDING',
      },
    });

    // Run deploy pipeline asynchronously
    this.executeDeploy(deployment.id, project.path, branch || 'main').catch((err) => {
      log.error(`[Deploy] Pipeline error for deployment ${deployment.id}:`, err);
    });

    return deployment;
  }

  /**
   * Execute the full deploy pipeline
   */
  private async executeDeploy(deploymentId: string, projectPath: string, branch: string) {
    const startTime = Date.now();
    let logs = '';

    const appendLog = (line: string) => {
      logs += line + '\n';
      const deployment = { deploymentId };
      projectEvents.emit(DEPLOY_EVENT_TYPES.DEPLOY_LOG, {
        deploymentId,
        projectPath,
        line,
      });
    };

    const updateStatus = async (status: DeploymentStatus, currentStep?: string) => {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status, currentStep, ...(status !== 'PENDING' && !await this.getStartedAt(deploymentId) ? { startedAt: new Date() } : {}) },
      });
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { projectId: true },
      });
      projectEvents.emit(DEPLOY_EVENT_TYPES.DEPLOY_STATUS, {
        deploymentId,
        projectId: deployment?.projectId,
        status,
        currentStep,
      });
    };

    try {
      // Step 1: Get commit before
      appendLog('--- STEP 1: Git Pull ---');
      const commitBefore = await this.runCommand('git', ['rev-parse', 'HEAD'], projectPath, appendLog);

      await updateStatus('GIT_PULLING', 'git_pull');
      await this.runCommand('git', ['pull', 'origin', branch], projectPath, appendLog);

      const commitAfter = await this.runCommand('git', ['rev-parse', 'HEAD'], projectPath, appendLog);
      const commitMessage = await this.runCommand('git', ['log', '-1', '--pretty=%B'], projectPath, appendLog);

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          commitBefore: commitBefore.trim(),
          commitAfter: commitAfter.trim(),
          commitMessage: commitMessage.trim().substring(0, 500),
          startedAt: new Date(),
        },
      });

      // Step 2: Build
      appendLog('\n--- STEP 2: Docker Build ---');
      await updateStatus('BUILDING', 'build');
      await this.runCommand('docker', ['compose', 'build', '--no-cache', 'app'], projectPath, appendLog);

      // Step 3: Deploy
      appendLog('\n--- STEP 3: Docker Up ---');
      await updateStatus('DEPLOYING', 'deploy');
      await this.runCommand('docker', ['compose', 'up', '-d', 'app'], projectPath, appendLog);

      // Step 4: Health Check
      appendLog('\n--- STEP 4: Health Check ---');
      await updateStatus('HEALTH_CHECK', 'health_check');
      await this.healthCheck(projectPath, appendLog);

      // Success
      const duration = Math.round((Date.now() - startTime) / 1000);
      appendLog(`\n✅ Deploy completato in ${duration}s`);

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'SUCCESS',
          logs,
          duration,
          completedAt: new Date(),
          currentStep: null,
        },
      });

      // Update project lastDeployAt
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { projectId: true },
      });
      if (deployment) {
        await prisma.project.update({
          where: { id: deployment.projectId },
          data: { lastDeployAt: new Date() },
        });
      }

      projectEvents.emit(DEPLOY_EVENT_TYPES.DEPLOY_COMPLETED, {
        deploymentId,
        projectId: deployment?.projectId,
        status: 'SUCCESS',
        duration,
      });

      // Log activity + notification
      await this.logActivity(deploymentId, 'SUCCESS');
      await this.createDeployNotification(deploymentId, 'SUCCESS');
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
      appendLog(`\n❌ Deploy fallito: ${errorMsg}`);

      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { projectId: true },
      });

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'FAILED',
          logs,
          duration,
          errorMessage: errorMsg.substring(0, 1000),
          completedAt: new Date(),
          currentStep: null,
        },
      });

      projectEvents.emit(DEPLOY_EVENT_TYPES.DEPLOY_COMPLETED, {
        deploymentId,
        projectId: deployment?.projectId,
        status: 'FAILED',
        duration,
        error: errorMsg,
      });

      await this.logActivity(deploymentId, 'FAILED');
      await this.createDeployNotification(deploymentId, 'FAILED');
    }
  }

  /**
   * Create notification for deploy result
   */
  private async createDeployNotification(deploymentId: string, status: 'SUCCESS' | 'FAILED') {
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { project: { select: { id: true, name: true } } },
      });
      if (!deployment) return;

      await notificationService.createForAdmins({
        type: status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
        title: status === 'SUCCESS'
          ? `Deploy completato: ${deployment.project.name}`
          : `Deploy fallito: ${deployment.project.name}`,
        message: status === 'SUCCESS'
          ? `Deploy di ${deployment.project.name} completato in ${deployment.duration}s (${deployment.commitAfter?.substring(0, 7) || 'N/A'})`
          : `Deploy di ${deployment.project.name} fallito: ${deployment.errorMessage?.substring(0, 200) || 'Errore sconosciuto'}`,
        priority: status === 'FAILED' ? 'HIGH' : 'NORMAL',
        source: 'deploy',
        sourceId: deploymentId,
        actionLabel: 'Dettagli',
        actionHref: `/dashboard/projects/${deployment.project.id}`,
      });
    } catch (err) {
      log.error('[Deploy] Failed to create notification:', err);
    }
  }

  private async getStartedAt(deploymentId: string): Promise<Date | null> {
    const d = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { startedAt: true },
    });
    return d?.startedAt || null;
  }

  /**
   * Run a shell command with streaming output
   */
  private runCommand(
    cmd: string,
    args: string[],
    cwd: string,
    onLine: (line: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, shell: false });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        text.split('\n').filter(Boolean).forEach((line) => onLine(`[stdout] ${line}`));
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        text.split('\n').filter(Boolean).forEach((line) => onLine(`[stderr] ${line}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command "${cmd} ${args.join(' ')}" failed with code ${code}: ${stderr.substring(0, 500)}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn "${cmd}": ${err.message}`));
      });
    });
  }

  /**
   * Health check: poll docker compose ps until app container is healthy/running
   */
  private async healthCheck(projectPath: string, onLine: (line: string) => void): Promise<void> {
    const maxAttempts = 24; // 2 minutes at 5s intervals
    const interval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const output = await this.runCommand(
          'docker',
          ['compose', 'ps', '--format', 'json'],
          projectPath,
          () => {}, // Suppress intermediate output
        );

        // Parse JSON output (each line is a JSON object)
        const lines = output.trim().split('\n').filter(Boolean);
        let appRunning = false;

        for (const line of lines) {
          try {
            const container = JSON.parse(line);
            if (container.Service === 'app' || container.Name?.includes('-app-')) {
              const state = container.State?.toLowerCase();
              const health = container.Health?.toLowerCase();
              onLine(`[health] Container: ${container.Name}, State: ${state}, Health: ${health || 'N/A'}`);

              if (state === 'running' && (health === 'healthy' || health === '' || !health)) {
                appRunning = true;
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }

        if (appRunning) {
          onLine('[health] ✅ App container is running');
          return;
        }
      } catch {
        // Ignore errors during health check polling
      }

      onLine(`[health] Waiting for app container... (${i + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error('Health check timeout: app container non healthy dopo 2 minuti');
  }

  /**
   * Get deployments for a project
   */
  async getDeployments(projectId: string, limit = 20, offset = 0) {
    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.deployment.count({ where: { projectId } }),
    ]);

    return { deployments, total };
  }

  /**
   * Get latest deployment for a project
   */
  async getLatestDeployment(projectId: string) {
    return prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Log deploy activity
   */
  private async logActivity(deploymentId: string, status: 'SUCCESS' | 'FAILED') {
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { project: { select: { name: true, slug: true } }, user: true },
      });
      if (!deployment) return;

      await prisma.activityLog.create({
        data: {
          userId: deployment.userId,
          action: 'DEPLOY',
          resource: 'project',
          resourceId: deployment.projectId,
          description: status === 'SUCCESS'
            ? `Deploy completato: ${deployment.project.name} (${deployment.commitAfter?.substring(0, 7) || 'N/A'})`
            : `Deploy fallito: ${deployment.project.name} - ${deployment.errorMessage?.substring(0, 100) || 'Errore'}`,
          status: status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
          errorMessage: status === 'FAILED' ? deployment.errorMessage : undefined,
          metadata: {
            deploymentId,
            branch: deployment.gitBranch,
            commitBefore: deployment.commitBefore,
            commitAfter: deployment.commitAfter,
            duration: deployment.duration,
          },
        },
      });
    } catch (err) {
      log.error('[Deploy] Failed to log activity:', err);
    }
  }
}

export const deployService = new DeployService();
export { DEPLOY_EVENT_TYPES };
