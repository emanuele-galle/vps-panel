import { Domain, UserRole } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { dockerService } from '../docker/docker.service';
import { AppError } from '../../utils/errors';
import * as yaml from 'js-yaml';

// Traefik dynamic config directory
const TRAEFIK_DYNAMIC_DIR = '/root/vps-panel/traefik/dynamic';

// Docker gateway IP for PM2 apps
const DOCKER_GATEWAY_IP = '172.19.0.1';

interface TraefikConfig {
  http?: {
    routers?: Record<string, unknown>;
    services?: Record<string, unknown>;
    middlewares?: Record<string, unknown>;
  };
}

// DNS record type
interface DNSRecord {
  address: string;
  type: string;
}

// Traefik router configuration
interface TraefikRouter {
  rule: string;
  entryPoints: string[];
  service: string;
  tls?: {
    certResolver: string;
  };
  middlewares?: string[];
}

class DomainsService {
  /**
   * Get accessible project IDs for a user
   */
  private async getAccessibleProjectIds(userId: string, userRole: UserRole): Promise<string[] | null> {
    if (userRole === 'ADMIN') return null;

    const [ownedProjects, memberProjects] = await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: { id: true }
      }),
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
      })
    ]);

    const ids = new Set<string>();
    ownedProjects.forEach(p => ids.add(p.id));
    memberProjects.forEach(m => ids.add(m.projectId));

    return Array.from(ids);
  }

  /**
   * Get all domains with optional filters (filtered by user access)
   */
  async getDomains(filters?: {
    projectId?: string;
    isActive?: boolean;
  }, userId?: string, userRole?: UserRole): Promise<Domain[]> {
    try {
      const where: any = {};

      if (filters?.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      // Filter by accessible projects for STAFF users
      if (userId && userRole && userRole !== 'ADMIN') {
        const accessibleIds = await this.getAccessibleProjectIds(userId, userRole);
        if (accessibleIds !== null) {
          if (filters?.projectId) {
            if (!accessibleIds.includes(filters.projectId)) {
              return [];
            }
          } else {
            where.projectId = { in: accessibleIds };
          }
        }
      }

      return await prisma.domain.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      throw new AppError(500, `Failed to fetch domains: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Get domain by ID
   */
  async getDomainById(id: string): Promise<Domain | null> {
    try {
      return await prisma.domain.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              path: true,
            },
          },
        },
      });
    } catch (error) {
      throw new AppError(500, `Failed to fetch domain: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Check if project is a PM2 project (has ecosystem.config.js)
   */
  private async isPM2Project(projectPath: string): Promise<boolean> {
    try {
      const ecosystemPath = path.join(projectPath, 'ecosystem.config.js');
      await fs.access(ecosystemPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if project is a Docker project (has docker-compose.yml with app services)
   */
  private async isDockerProject(projectPath: string): Promise<boolean> {
    try {
      const composePath = path.join(projectPath, 'docker-compose.yml');
      const content = await fs.readFile(composePath, 'utf-8');
      // Check if it has actual app services (not just database)
      const serviceMatch = content.match(/services:\s+(\w+):/);
      return !!serviceMatch;
    } catch {
      return false;
    }
  }

  /**
   * Extract port from ecosystem.config.js
   * Returns the PORT env variable or the first available port
   */
  private async extractPM2Port(projectPath: string): Promise<number | null> {
    try {
      const ecosystemPath = path.join(projectPath, 'ecosystem.config.js');
      const content = await fs.readFile(ecosystemPath, 'utf-8');

      // Try to find PORT in env section
      const portMatch = content.match(/PORT['"]\s*:\s*['"]?(\d+)['"]?/);
      if (portMatch) {
        return parseInt(portMatch[1], 10);
      }

      // Try to find port in args
      const argsPortMatch = content.match(/--port[=\s]+(\d+)/);
      if (argsPortMatch) {
        return parseInt(argsPortMatch[1], 10);
      }

      // Try alternative patterns
      const envPortMatch = content.match(/env\s*:\s*\{[^}]*PORT\s*:\s*(\d+)/s);
      if (envPortMatch) {
        return parseInt(envPortMatch[1], 10);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create new domain
   */
  async createDomain(data: {
    domain: string;
    projectId: string;
    sslEnabled?: boolean;
  }): Promise<Domain> {
    try {
      // Validate domain format
      if (!this.isValidDomain(data.domain)) {
        throw new AppError(400, 'Invalid domain format');
      }

      // Check if domain already exists
      const existingDomain = await prisma.domain.findUnique({
        where: { domain: data.domain },
      });

      if (existingDomain) {
        throw new AppError(409, 'Domain already exists');
      }

      // Check if project exists
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new AppError(404, 'Project not found');
      }

      // Detect project type
      const isPM2 = await this.isPM2Project(project.path);
      const isDocker = !isPM2 && await this.isDockerProject(project.path);

      // Create domain in database
      const domain = await prisma.domain.create({
        data: {
          domain: data.domain,
          projectId: data.projectId,
          sslEnabled: data.sslEnabled ?? true,
          sslProvider: data.sslEnabled ? 'LETSENCRYPT' : undefined,
          isActive: true,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              path: true,
            },
          },
        },
      });

      // Update Traefik configuration based on project type
      if (isPM2) {
        await this.updateTraefikConfigPM2(
          project.path,
          project.slug,
          data.domain,
          data.sslEnabled ?? true
        );
        // PM2: No restart needed, Traefik auto-reloads dynamic config
      } else if (isDocker) {
        await this.updateTraefikConfig(project.path, data.domain, data.sslEnabled ?? true);
        // Restart project containers to apply changes
        await dockerService.composeRestart(project.path);
      } else {
        // Fallback: try PM2 style (creates Traefik dynamic config)
        await this.updateTraefikConfigPM2(
          project.path,
          project.slug,
          data.domain,
          data.sslEnabled ?? true
        );
      }

      return domain;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create domain: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Update domain
   */
  async updateDomain(
    id: string,
    data: {
      sslEnabled?: boolean;
      isActive?: boolean;
    }
  ): Promise<Domain> {
    try {
      const domain = await prisma.domain.findUnique({
        where: { id },
        include: {
          project: true,
        },
      });

      if (!domain) {
        throw new AppError(404, 'Domain not found');
      }

      // Update domain in database
      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: {
          sslEnabled: data.sslEnabled ?? domain.sslEnabled,
          sslProvider: data.sslEnabled ? 'LETSENCRYPT' : domain.sslProvider,
          isActive: data.isActive ?? domain.isActive,
          updatedAt: new Date(),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              path: true,
            },
          },
        },
      });

      // Update Traefik configuration if SSL changed
      if (data.sslEnabled !== undefined && data.sslEnabled !== domain.sslEnabled) {
        const isPM2 = await this.isPM2Project(domain.project.path);

        if (isPM2) {
          await this.updateTraefikConfigPM2(
            domain.project.path,
            domain.project.slug,
            domain.domain,
            data.sslEnabled
          );
        } else {
          await this.updateTraefikConfig(
            domain.project.path,
            domain.domain,
            data.sslEnabled
          );
          await dockerService.composeRestart(domain.project.path);
        }
      }

      return updatedDomain;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update domain: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Delete domain
   */
  async deleteDomain(id: string): Promise<void> {
    try {
      const domain = await prisma.domain.findUnique({
        where: { id },
        include: {
          project: true,
        },
      });

      if (!domain) {
        throw new AppError(404, 'Domain not found');
      }

      // Detect project type
      const isPM2 = await this.isPM2Project(domain.project.path);

      // Remove domain from database
      await prisma.domain.delete({
        where: { id },
      });

      // Remove from Traefik configuration
      if (isPM2) {
        await this.removeTraefikConfigPM2(domain.project.slug, domain.domain);
      } else {
        await this.removeTraefikConfig(domain.project.path, domain.domain);
        // Restart project containers to apply changes
        await dockerService.composeRestart(domain.project.path);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete domain: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Verify domain DNS points to server
   */
  async verifyDomain(domain: string): Promise<{
    isValid: boolean;
    records: DNSRecord[];
    message: string;
  }> {
    try {
      const dns = require('dns').promises;

      try {
        const addresses = await dns.resolve4(domain);

        // Here you would check if any of the addresses match your server IP
        // For now, we'll just return the addresses found
        return {
          isValid: addresses.length > 0,
          records: addresses,
          message: addresses.length > 0
            ? 'Domain DNS records found'
            : 'No DNS records found',
        };
      } catch (dnsError: unknown) {
        return {
          isValid: false,
          records: [],
          message: `DNS lookup failed: ${(dnsError instanceof Error ? dnsError.message : String(dnsError))}`,
        };
      }
    } catch (error) {
      throw new AppError(500, `Failed to verify domain: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Update Traefik configuration for PM2 project
   * Creates/updates a YAML file in /root/vps-panel/traefik/dynamic/
   */
  private async updateTraefikConfigPM2(
    projectPath: string,
    projectSlug: string,
    domain: string,
    sslEnabled: boolean
  ): Promise<void> {
    try {
      const traefikConfigPath = path.join(TRAEFIK_DYNAMIC_DIR, `${projectSlug}.yml`);

      // Extract port from ecosystem.config.js
      const port = await this.extractPM2Port(projectPath);
      if (!port) {
        throw new Error('Could not determine PM2 app port from ecosystem.config.js');
      }

      // Create router and service name from domain
      const routerName = domain.replace(/\./g, '-').replace(/\*/g, 'wildcard');
      const serviceName = `${projectSlug}-${routerName}`;

      let config: TraefikConfig;

      // Try to read existing config
      try {
        const existingContent = await fs.readFile(traefikConfigPath, 'utf-8');
        config = yaml.load(existingContent) as TraefikConfig || {};
      } catch {
        // File doesn't exist, create new config
        config = {};
      }

      // Ensure structure exists
      if (!config.http) config.http = {};
      if (!config.http.routers) config.http.routers = {};
      if (!config.http.services) config.http.services = {};
      if (!config.http.middlewares) config.http.middlewares = {};

      // Check if router already exists
      if (config.http.routers[routerName]) {
        // Router exists, just return (domain already configured)
        return;
      }

      // Add router for the new domain
      const router: TraefikRouter = {
        rule: `Host(\`${domain}\`)`,
        entryPoints: ['websecure'],
        service: serviceName,
      };

      if (sslEnabled) {
        router.tls = {
          certResolver: 'letsencrypt',
        };
      }

      // Add security middleware reference if exists
      const middlewareName = `${projectSlug}-headers`;
      if (config.http.middlewares[middlewareName]) {
        router.middlewares = [middlewareName];
      }

      config.http.routers[routerName] = router;

      // Add service for the domain
      config.http.services[serviceName] = {
        loadBalancer: {
          servers: [
            { url: `http://${DOCKER_GATEWAY_IP}:${port}` }
          ],
        },
      };

      // Write config with comment header
      const yamlContent = `# Traefik dynamic configuration for ${projectSlug}
# Auto-generated by VPS Panel - DO NOT EDIT MANUALLY
# Last updated: ${new Date().toISOString()}

${yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true })}`;

      await fs.writeFile(traefikConfigPath, yamlContent);
    } catch (error) {
      throw new Error(`Failed to update Traefik PM2 config: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Remove domain from Traefik PM2 configuration
   */
  private async removeTraefikConfigPM2(
    projectSlug: string,
    domain: string
  ): Promise<void> {
    try {
      const traefikConfigPath = path.join(TRAEFIK_DYNAMIC_DIR, `${projectSlug}.yml`);

      // Read existing config
      let config: TraefikConfig;
      try {
        const existingContent = await fs.readFile(traefikConfigPath, 'utf-8');
        config = yaml.load(existingContent) as TraefikConfig || {};
      } catch {
        // File doesn't exist, nothing to remove
        return;
      }

      if (!config.http?.routers || !config.http?.services) {
        return;
      }

      // Create router and service name from domain
      const routerName = domain.replace(/\./g, '-').replace(/\*/g, 'wildcard');
      const serviceName = `${projectSlug}-${routerName}`;

      // Remove router and service
      delete config.http.routers[routerName];
      delete config.http.services[serviceName];

      // If no routers left, delete the file
      if (Object.keys(config.http.routers).length === 0) {
        await fs.unlink(traefikConfigPath);
        return;
      }

      // Write updated config
      const yamlContent = `# Traefik dynamic configuration for ${projectSlug}
# Auto-generated by VPS Panel - DO NOT EDIT MANUALLY
# Last updated: ${new Date().toISOString()}

${yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true })}`;

      await fs.writeFile(traefikConfigPath, yamlContent);
    } catch (error) {
      throw new Error(`Failed to remove Traefik PM2 config: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Update Traefik configuration for Docker project
   */
  private async updateTraefikConfig(
    projectPath: string,
    domain: string,
    sslEnabled: boolean
  ): Promise<void> {
    try {
      const composePath = path.join(projectPath, 'docker-compose.yml');
      let composeContent = await fs.readFile(composePath, 'utf-8');

      // Find the main service (usually the first service or web service)
      const serviceMatch = composeContent.match(/services:\s+(\w+):/);
      if (!serviceMatch) {
        throw new Error('Could not find service in docker-compose.yml');
      }

      const serviceName = serviceMatch[1];
      const domainSlug = domain.replace(/\./g, '-');

      // Add Traefik labels for the custom domain
      const traefikLabels = [
        `      - "traefik.http.routers.${domainSlug}.rule=Host(\`${domain}\`)"`,
        `      - "traefik.http.routers.${domainSlug}.entrypoints=websecure"`,
      ];

      if (sslEnabled) {
        traefikLabels.push(
          `      - "traefik.http.routers.${domainSlug}.tls=true"`,
          `      - "traefik.http.routers.${domainSlug}.tls.certresolver=letsencrypt"`
        );
      }

      // Check if labels already exist for this domain
      const domainLabelRegex = new RegExp(
        `traefik\\.http\\.routers\\.${domainSlug}`,
        'g'
      );

      if (!domainLabelRegex.test(composeContent)) {
        // Add labels to the service
        const labelsSection = composeContent.match(/labels:\s*\n/);

        if (labelsSection) {
          // Add to existing labels
          const labelIndex = composeContent.indexOf(labelsSection[0]) + labelsSection[0].length;
          composeContent =
            composeContent.slice(0, labelIndex) +
            traefikLabels.join('\n') +
            '\n' +
            composeContent.slice(labelIndex);
        } else {
          // Create labels section
          const serviceRegex = new RegExp(
            `(\\s+${serviceName}:.*?\\n)(\\s+\\w+:)`,
            's'
          );
          const match = composeContent.match(serviceRegex);

          if (match) {
            const insertion = `${match[1]}    labels:\n${traefikLabels.join('\n')}\n${match[2]}`;
            composeContent = composeContent.replace(serviceRegex, insertion);
          }
        }

        await fs.writeFile(composePath, composeContent);
      }
    } catch (error) {
      throw new Error(`Failed to update Traefik config: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Remove domain from Traefik configuration (Docker)
   */
  private async removeTraefikConfig(
    projectPath: string,
    domain: string
  ): Promise<void> {
    try {
      const composePath = path.join(projectPath, 'docker-compose.yml');
      let composeContent = await fs.readFile(composePath, 'utf-8');

      const domainSlug = domain.replace(/\./g, '-');
      const labelRegex = new RegExp(
        `\\s*- "traefik\\.http\\.routers\\.${domainSlug}.*"\\n`,
        'g'
      );

      composeContent = composeContent.replace(labelRegex, '');
      await fs.writeFile(composePath, composeContent);
    } catch (error) {
      throw new Error(`Failed to remove Traefik config: ${(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : String(error))}`);
    }
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  }
}

export const domainsService = new DomainsService();
