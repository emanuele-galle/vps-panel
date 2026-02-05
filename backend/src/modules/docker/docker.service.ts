import Docker from 'dockerode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config/env';
import { prisma } from '../../services/prisma.service';
import { UserRole } from '@prisma/client';

const execAsync = promisify(exec);

/**
 * Strip Docker multiplexed stream headers from log output.
 * Non-TTY containers return logs with 8-byte headers per frame:
 * [stream_type(1) + padding(3) + size(4)] + payload
 */
function stripDockerHeaders(buffer: Buffer): string {
  const lines: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least 8 bytes for the header
    if (offset + 8 > buffer.length) {
      // Remaining bytes without valid header - append as-is
      lines.push(buffer.subarray(offset).toString('utf8'));
      break;
    }

    const streamType = buffer[offset];
    // Docker stream types: 0=stdin, 1=stdout, 2=stderr
    if (streamType > 2) {
      // Not a valid Docker stream header — treat rest as raw text
      lines.push(buffer.subarray(offset).toString('utf8'));
      break;
    }

    const frameSize = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + frameSize > buffer.length) {
      // Truncated frame - take what we can
      lines.push(buffer.subarray(offset).toString('utf8'));
      break;
    }

    lines.push(buffer.subarray(offset, offset + frameSize).toString('utf8'));
    offset += frameSize;
  }

  return lines.join('');
}

/**
 * VPS Console infrastructure container names that should always be hidden from STAFF users
 * These are system containers that manage the VPS Panel itself
 */
const VPS_CONSOLE_CONTAINER_NAMES = [
  'vps-panel-backend',
  'vps-panel-frontend',
  'vps-panel-postgres',
  'vps-panel-redis',
  'vps-panel-traefik',
  'vps-panel-filebrowser',
  'vps-panel-filebrowser-system',
  'vps-panel-adminer',
  'traefik',
  'adminer',
];

/**
 * Check if a container belongs to any of the accessible projects
 * Handles various naming patterns:
 * - Exact slug match
 * - Slug with hash suffix (e.g., "project-name-bb2e1b11")
 * - Container name containing slug
 * - Docker compose project label matching
 * - Project path matching via working_dir label
 *
 * @param containerName - The container name (without leading /)
 * @param composeProject - The docker-compose project label value
 * @param composeWorkingDir - The docker-compose working directory (from label)
 * @param accessibleSlugs - Set of slugs the user has access to
 * @param accessiblePaths - Set of project paths the user has access to
 * @returns true if container belongs to an accessible project
 */
function containerBelongsToProject(
  containerName: string,
  composeProject: string,
  composeWorkingDir: string,
  accessibleSlugs: Set<string>,
  accessiblePaths: Set<string>
): boolean {
  // First check: match by project path (most reliable)
  if (composeWorkingDir && accessiblePaths.has(composeWorkingDir)) {
    return true;
  }

  // Second check: match by slug patterns
  return Array.from(accessibleSlugs).some(slug => {
    const projectName = composeProject.toLowerCase();
    const cName = containerName.toLowerCase();
    // Extract base slug without hash suffix (e.g., "ristorante-generico" from "ristorante-generico-bb2e1b11")
    // Pattern: 8 hex characters at the end preceded by a dash
    const baseSlug = slug.replace(/-[a-f0-9]{8}$/, '').toLowerCase();

    return (
      projectName.includes(slug) ||
      slug.includes(projectName) ||
      cName.includes(slug) ||
      cName.includes(baseSlug) ||
      cName.startsWith(baseSlug)
    );
  });
}

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: config.DOCKER_SOCKET });
  }

  /**
   * Get container by ID or name
   * Docker supports both, but we normalize to ensure consistent behavior
   * @param identifier - Docker container ID (12-64 hex chars) or container name
   */
  private getContainerByIdentifier(identifier: string) {
    // Docker's getContainer works with both ID and name
    return this.docker.getContainer(identifier);
  }

  /**
   * Check if identifier looks like a container ID (hex string)
   */
  private isContainerId(identifier: string): boolean {
    return /^[a-f0-9]{12,64}$/.test(identifier);
  }

  /**
   * Execute docker-compose up in a project directory
   */
  async composeUp(projectPath: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync('docker compose up -d', {
        cwd: projectPath,
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to start project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute docker-compose down in a project directory
   */
  async composeDown(projectPath: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync('docker compose down', {
        cwd: projectPath,
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to stop project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute docker-compose restart in a project directory
   */
  async composeRestart(projectPath: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync('docker compose restart', {
        cwd: projectPath,
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to restart project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get docker-compose logs using dockerode API
   */
  async composeLogs(
    projectPath: string,
    tail: number = 100
  ): Promise<string> {
    try {
      // Get all containers
      const containers = await this.docker.listContainers({ all: true });

      // Filter containers by project using working_dir label (most reliable method)
      const projectDir = path.basename(projectPath);
      const projectContainers = containers.filter(c => {
        const labels = c.Labels || {};
        const composeWorkingDir = labels['com.docker.compose.project.working_dir'] || '';

        // Primary: exact path match
        if (composeWorkingDir === projectPath) {
          return true;
        }

        // Fallback: check if working_dir ends with project directory
        if (composeWorkingDir.endsWith(projectDir)) {
          return true;
        }

        return false;
      });

      if (projectContainers.length === 0) {
        return 'Nessun container trovato per questo progetto.';
      }

      // Get logs from each container
      const logsPromises = projectContainers.map(async (containerInfo) => {
        try {
          const container = this.getContainerByIdentifier(containerInfo.Id);
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: Math.floor(tail / projectContainers.length), // Divide tail among containers
            timestamps: true,
          });

          const containerName = containerInfo.Names?.[0]?.replace(/^\//, '') || containerInfo.Id.substring(0, 12);
          const logString = Buffer.isBuffer(logs) ? stripDockerHeaders(logs) : String(logs);

          // Format logs with container name prefix
          return logString
            .split('\n')
            .filter((line: string) => line.trim())
            .map((line: string) => `[${containerName}] ${line}`)
            .join('\n');
        } catch (_err) {
          return `[${containerInfo.Names?.[0] || containerInfo.Id}] Error getting logs`;
        }
      });

      const allLogs = await Promise.all(logsPromises);
      return allLogs.filter((l: string) => l).join('\n\n') || 'Nessun log disponibile.';
    } catch (error) {
      throw new Error(`Failed to get logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all containers
   */
  async listContainers(all: boolean = true) {
    try {
      return await this.docker.listContainers({ all });
    } catch (error) {
      throw new Error(`Failed to list containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List containers filtered by user role and project access
   * STAFF users only see containers from their assigned projects
   * ADMIN users see all containers
   */
  async listContainersForUser(all: boolean = true, userRole: UserRole, userId?: string) {
    try {
      const containers = await this.docker.listContainers({ all });

      // ADMIN sees everything
      if (userRole === 'ADMIN') {
        return containers;
      }

      // STAFF: Filter to show only containers from assigned projects
      if (!userId) {
        return []; // No userId means no access
      }

      // Get accessible project paths for this staff user
      const [ownedProjects, memberProjects] = await Promise.all([
        prisma.project.findMany({
          where: { userId },
          select: { path: true, slug: true }
        }),
        prisma.projectMember.findMany({
          where: { userId },
          include: {
            project: { select: { path: true, slug: true } }
          }
        })
      ]);

      const accessibleSlugs = new Set<string>();
      const accessiblePaths = new Set<string>();
      ownedProjects.forEach(p => {
        accessibleSlugs.add(p.slug.toLowerCase());
        if (p.path) accessiblePaths.add(p.path);
      });
      memberProjects.forEach(m => {
        accessibleSlugs.add(m.project.slug.toLowerCase());
        if (m.project.path) accessiblePaths.add(m.project.path);
      });

      return containers.filter((container) => {
        const containerName = container.Names[0]?.replace(/^\//, '') || '';

        // Always hide VPS Console infrastructure
        const isVpsConsoleContainer = VPS_CONSOLE_CONTAINER_NAMES.some((name) =>
          containerName.toLowerCase().includes(name.toLowerCase())
        );
        if (isVpsConsoleContainer) return false;

        // Check docker-compose project label - hide vps-panel project
        const composeProject = container.Labels?.['com.docker.compose.project'] || '';
        if (composeProject === 'vps-panel') return false;

        // Get working directory from docker-compose label
        const composeWorkingDir = container.Labels?.['com.docker.compose.project.working_dir'] || '';

        // Check if container belongs to an accessible project using the helper function
        return containerBelongsToProject(containerName, composeProject, composeWorkingDir, accessibleSlugs, accessiblePaths);
      });
    } catch (error) {
      throw new Error(`Failed to list containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a container is VPS Console infrastructure
   * Used to prevent STAFF users from accessing/controlling VPS Console containers
   */
  private async isVpsConsoleContainer(containerId: string): Promise<boolean> {
    try {
      const container = this.getContainerByIdentifier(containerId);
      const info = await container.inspect();

      const containerName = info.Name?.replace(/^\//, '') || '';
      const composeProject = info.Config?.Labels?.['com.docker.compose.project'] || '';

      // Use the centralized constant for consistency
      const isVpsName = VPS_CONSOLE_CONTAINER_NAMES.some((name) =>
        containerName.toLowerCase().includes(name.toLowerCase())
      );
      const isVpsProject = composeProject === 'vps-panel';

      return isVpsName || isVpsProject;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify container access for user role and project membership
   * Throws error if STAFF user tries to access VPS Console container or container not in their projects
   */
  async verifyContainerAccess(containerId: string, userRole: UserRole, userId?: string): Promise<void> {
    if (userRole === 'ADMIN') {
      return; // ADMIN has full access
    }

    const isVpsContainer = await this.isVpsConsoleContainer(containerId);
    if (isVpsContainer) {
      throw new Error('Access denied: VPS Console containers are restricted to administrators');
    }

    // For STAFF, verify container belongs to an assigned project
    if (userId) {
      const container = this.getContainerByIdentifier(containerId);
      const info = await container.inspect();
      const containerName = info.Name?.replace(/^\//, '') || '';
      const composeProject = info.Config?.Labels?.['com.docker.compose.project'] || '';
      const composeWorkingDir = info.Config?.Labels?.['com.docker.compose.project.working_dir'] || '';

      // Get accessible project slugs and paths
      const [ownedProjects, memberProjects] = await Promise.all([
        prisma.project.findMany({
          where: { userId },
          select: { slug: true, path: true }
        }),
        prisma.projectMember.findMany({
          where: { userId },
          include: { project: { select: { slug: true, path: true } } }
        })
      ]);

      const accessibleSlugs = new Set<string>();
      const accessiblePaths = new Set<string>();
      ownedProjects.forEach(p => {
        accessibleSlugs.add(p.slug.toLowerCase());
        if (p.path) accessiblePaths.add(p.path);
      });
      memberProjects.forEach(m => {
        accessibleSlugs.add(m.project.slug.toLowerCase());
        if (m.project.path) accessiblePaths.add(m.project.path);
      });

      // Use the same matching logic as listContainersForUser
      const hasAccess = containerBelongsToProject(containerName, composeProject, composeWorkingDir, accessibleSlugs, accessiblePaths);

      if (!hasAccess) {
        throw new Error('Access denied: Container not in your assigned projects');
      }
    }
  }

  /**
   * Get container by ID
   */
  async getContainer(containerId: string) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      const info = await container.inspect();
      return info;
    } catch (error) {
      throw new Error(`Failed to get container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start container
   */
  async startContainer(containerId: string) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      await container.start();
      return true;
    } catch (error) {
      throw new Error(`Failed to start container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop container
   */
  async stopContainer(containerId: string) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      await container.stop();
      return true;
    } catch (error) {
      throw new Error(`Failed to stop container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restart container
   */
  async restartContainer(containerId: string) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      await container.restart();
      return true;
    } catch (error) {
      throw new Error(`Failed to restart container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove container
   */
  async removeContainer(containerId: string, force: boolean = false) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      await container.remove({ force });
      return true;
    } catch (error) {
      throw new Error(`Failed to remove container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = this.getContainerByIdentifier(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return Buffer.isBuffer(logs) ? stripDockerHeaders(logs) : String(logs);
    } catch (error) {
      throw new Error(`Failed to get container logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId: string) {
    try {
      const container = this.getContainerByIdentifier(containerId);
      const stats = await container.stats({ stream: false });

      // Calculate CPU percentage
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      // Calculate memory percentage
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: {
          used: memoryUsage,
          limit: memoryLimit,
          percentage: Math.round(memoryPercent * 100) / 100,
        },
        network: {
          received: stats.networks?.eth0?.rx_bytes || 0,
          transmitted: stats.networks?.eth0?.tx_bytes || 0,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get container stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List networks
   */
  async listNetworks() {
    try {
      return await this.docker.listNetworks();
    } catch (error) {
      throw new Error(`Failed to list networks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List volumes
   */
  async listVolumes() {
    try {
      return await this.docker.listVolumes();
    } catch (error) {
      throw new Error(`Failed to list volumes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List images
   */
  async listImages() {
    try {
      return await this.docker.listImages();
    } catch (error) {
      throw new Error(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pull image
   */
  async pullImage(imageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(new Error(`Failed to pull image: ${err instanceof Error ? err.message : 'Unknown error'}`));
          return;
        }

        this.docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              reject(new Error(`Failed to pull image: ${err instanceof Error ? err.message : 'Unknown error'}`));
            } else {
              resolve();
            }
          },
          () => {} // Progress callback
        );
      });
    });
  }

  /**
   * Get assigned port for a project (finds next available port)
   */
  async getAvailablePort(startPort: number = 8000): Promise<number> {
    const containers = await this.listContainers(true);
    const usedPorts = new Set<number>();

    // Extract used ports from existing containers
    containers.forEach((container) => {
      container.Ports?.forEach((port) => {
        if (port.PublicPort) {
          usedPorts.add(port.PublicPort);
        }
      });
    });

    // Find next available port
    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }

    return port;
  }
}

export const dockerService = new DockerService();
