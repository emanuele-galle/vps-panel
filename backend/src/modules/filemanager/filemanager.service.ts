
import { prisma } from '../../services/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { dockerService } from '../docker/docker.service';
import { AppError } from '../../utils/errors';
import { config, isProduction } from '../../config/env';


// Helper to generate FileBrowser URL based on environment
function getFileBrowserUrl(type: 'system' | 'files' | 'project', port: number, _projectSlug?: string): string {
  const panelDomain = config.PANEL_DOMAIN;

  if (isProduction && panelDomain) {
    // In production, use domain-based URLs via Traefik
    if (type === 'system') {
      return `https://system-files.${panelDomain}`;
    } else if (type === 'files') {
      return `https://files.${panelDomain}`;
    }
    // For project-specific filebrowsers, would need subdomain or path routing
    // For now fallback to port-based
  }

  // Development or fallback: use localhost with port
  return `http://localhost:${port}`;
}

interface FileBrowserInstance {
  projectId: string;
  projectSlug: string;
  url: string;
  port: number;
  isRunning: boolean;
  containerId?: string;
  username: string;
}

class FileManagerService {
  /**
   * Get FileBrowser instance for a project
   */
  async getInstance(projectId: string): Promise<FileBrowserInstance | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new AppError(404, 'Project not found');
      }

      // Check database first
      const dbInstance = await prisma.fileBrowserInstance.findUnique({
        where: { projectId },
      });

      if (dbInstance) {
        // Verify container status
        const isRunning = await this.isContainerRunning(dbInstance.containerId);

        // Update status in database if changed
        if (isRunning !== (dbInstance.status === 'running')) {
          await prisma.fileBrowserInstance.update({
            where: { id: dbInstance.id },
            data: {
              status: isRunning ? 'running' : 'stopped',
              ...(isRunning ? { lastStartedAt: new Date() } : { lastStoppedAt: new Date() }),
            },
          });
        }

        return {
          projectId,
          projectSlug: project.slug,
          url: getFileBrowserUrl('project', dbInstance.port, project.slug),
          port: dbInstance.port,
          isRunning,
          containerId: dbInstance.containerId || undefined,
          username: dbInstance.username,
        };
      }

      // Check if FileBrowser container exists but not in database (recovery)
      const containers = await dockerService.listContainers(true);
      const fileBrowserContainer = containers.find(
        (c) =>
          c.Labels?.['app'] === 'filebrowser' &&
          c.Labels?.['project'] === project.slug
      );

      if (fileBrowserContainer) {
        const port = fileBrowserContainer.Ports?.[0]?.PublicPort || 8080;

        // Save to database for future reference
        const recovered = await prisma.fileBrowserInstance.create({
          data: {
            projectId,
            containerId: fileBrowserContainer.Id,
            port,
            password: this.generatePassword(), // Unknown password, generate new
            status: fileBrowserContainer.State === 'running' ? 'running' : 'stopped',
          },
        });

        return {
          projectId,
          projectSlug: project.slug,
          url: getFileBrowserUrl('project', port, project.slug),
          port,
          isRunning: fileBrowserContainer.State === 'running',
          containerId: fileBrowserContainer.Id,
          username: recovered.username,
        };
      }

      return null;
    } catch (error) {
      throw new AppError(500, `Failed to get FileBrowser instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start FileBrowser for a project
   */
  async startFileBrowser(projectId: string): Promise<FileBrowserInstance> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new AppError(404, 'Project not found');
      }

      // Check if already running
      const existingInstance = await this.getInstance(projectId);
      if (existingInstance?.isRunning) {
        return existingInstance;
      }

      // Get or create database record
      let dbInstance = await prisma.fileBrowserInstance.findUnique({
        where: { projectId },
      });

      if (!dbInstance) {
        // Create new instance
        const port = await dockerService.getAvailablePort(8080);
        const password = this.generatePassword();

        dbInstance = await prisma.fileBrowserInstance.create({
          data: {
            projectId,
            port,
            password,
            status: 'starting',
          },
        });
      }

      // Create FileBrowser docker-compose configuration
      const fileBrowserPath = path.join(
        '/var/www/projects',
        project.slug,
        'filebrowser'
      );
      await fs.mkdir(fileBrowserPath, { recursive: true });

      const composeContent = this.getFileBrowserComposeConfig(
        project.slug,
        project.path,
        dbInstance.port,
        dbInstance.username,
        dbInstance.password
      );

      const composePath = path.join(fileBrowserPath, 'docker-compose.yml');
      await fs.writeFile(composePath, composeContent);

      // Start FileBrowser container
      await dockerService.composeUp(fileBrowserPath);

      // Get container ID
      const containers = await dockerService.listContainers(true);
      const container = containers.find(
        (c) =>
          c.Labels?.['app'] === 'filebrowser' &&
          c.Labels?.['project'] === project.slug
      );

      // Update database with container ID and status
      await prisma.fileBrowserInstance.update({
        where: { id: dbInstance.id },
        data: {
          containerId: container?.Id,
          status: 'running',
          lastStartedAt: new Date(),
        },
      });

      return {
        projectId,
        projectSlug: project.slug,
        url: getFileBrowserUrl('project', dbInstance.port, project.slug),
        port: dbInstance.port,
        isRunning: true,
        containerId: container?.Id,
        username: dbInstance.username,
      };
    } catch (error) {
      // Update status to error if failed
      const dbInstance = await prisma.fileBrowserInstance.findUnique({
        where: { projectId },
      });
      if (dbInstance) {
        await prisma.fileBrowserInstance.update({
          where: { id: dbInstance.id },
          data: { status: 'error' },
        });
      }
      throw new AppError(500, `Failed to start FileBrowser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop FileBrowser for a project
   */
  async stopFileBrowser(projectId: string): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new AppError(404, 'Project not found');
      }

      const fileBrowserPath = path.join(
        '/var/www/projects',
        project.slug,
        'filebrowser'
      );

      await dockerService.composeDown(fileBrowserPath);

      // Update database status
      const dbInstance = await prisma.fileBrowserInstance.findUnique({
        where: { projectId },
      });

      if (dbInstance) {
        await prisma.fileBrowserInstance.update({
          where: { id: dbInstance.id },
          data: {
            status: 'stopped',
            lastStoppedAt: new Date(),
          },
        });
      }
    } catch (error) {
      throw new AppError(500, `Failed to stop FileBrowser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get System FileBrowser instance (Admin only)
   * Returns the always-running system FileBrowser container info
   */
  async getSystemInstance(): Promise<FileBrowserInstance> {
    try {
      // Check database for system instance
      let dbInstance = await prisma.fileBrowserInstance.findFirst({
        where: { type: 'SYSTEM' },
      });

      // If not in DB, create record by detecting container
      if (!dbInstance) {
        const containers = await dockerService.listContainers(true);
        const systemContainer = containers.find(
          (c) => c.Labels?.['app'] === 'filebrowser-system'
        );

        if (!systemContainer) {
          throw new AppError(500, 'System FileBrowser container not found. Please ensure docker-compose is running.');
        }

        const port = systemContainer.Ports?.[0]?.PublicPort || 80;

        // Create database record
        dbInstance = await prisma.fileBrowserInstance.create({
          data: {
            type: 'SYSTEM',
            projectId: null,
            containerId: systemContainer.Id,
            port,
            mountPath: '/var/www',
            username: 'admin', // From docker-compose env
            password: 'See .env FILEBROWSER_SYSTEM_PASSWORD',
            status: systemContainer.State === 'running' ? 'running' : 'stopped',
          },
        });
      }

      // Verify container is still running
      const isRunning = await this.isContainerRunning(dbInstance.containerId);

      // Update status if changed
      if (isRunning !== (dbInstance.status === 'running')) {
        await prisma.fileBrowserInstance.update({
          where: { id: dbInstance.id },
          data: {
            status: isRunning ? 'running' : 'stopped',
            ...(isRunning ? { lastStartedAt: new Date() } : { lastStoppedAt: new Date() }),
          },
        });
      }

      return {
        projectId: 'SYSTEM', // Special identifier
        projectSlug: 'system',
        url: getFileBrowserUrl('system', dbInstance.port),
        port: dbInstance.port,
        isRunning,
        containerId: dbInstance.containerId || undefined,
        username: dbInstance.username,
      };
    } catch (error) {
      throw new AppError(500, `Failed to get System FileBrowser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all FileBrowser instances
   */
  async getAllInstances(): Promise<FileBrowserInstance[]> {
    try {
      const projects = await prisma.project.findMany({
        include: {
          fileBrowser: true,
        },
      });

      const instances: FileBrowserInstance[] = [];

      for (const project of projects) {
        if (project.fileBrowser) {
          const isRunning = await this.isContainerRunning(project.fileBrowser.containerId);

          instances.push({
            projectId: project.id,
            projectSlug: project.slug,
            url: getFileBrowserUrl('project', project.fileBrowser.port, project.slug),
            port: project.fileBrowser.port,
            isRunning,
            containerId: project.fileBrowser.containerId || undefined,
            username: project.fileBrowser.username,
          });
        }
      }

      return instances;
    } catch (error) {
      throw new AppError(500, `Failed to get FileBrowser instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate FileBrowser docker-compose configuration
   */
  private getFileBrowserComposeConfig(
    projectSlug: string,
    projectPath: string,
    port: number,
    username: string,
    password: string
  ): string {
    return `version: '3.8'

services:
  filebrowser:
    image: filebrowser/filebrowser:latest
    container_name: ${projectSlug}_filebrowser
    restart: unless-stopped
    ports:
      - "${port}:80"
    volumes:
      - ${projectPath}:/srv
      - filebrowser_db:/database
    environment:
      - FB_BASEURL=/
      - FB_NOAUTH=false
      - FB_USERNAME=${username}
      - FB_PASSWORD=${password}
    labels:
      - "app=filebrowser"
      - "project=${projectSlug}"
    networks:
      - filebrowser_network

volumes:
  filebrowser_db:

networks:
  filebrowser_network:
    driver: bridge
`;
  }

  /**
   * Generate random password
   */
  private generatePassword(length: number = 16): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Check if container is running
   */
  private async isContainerRunning(containerId?: string | null): Promise<boolean> {
    if (!containerId) return false;

    try {
      const container = await dockerService.getContainer(containerId);
      return container.State?.Status === 'running';
    } catch (_error) {
      return false;
    }
  }
}

export const fileManagerService = new FileManagerService();
