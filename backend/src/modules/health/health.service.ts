/**
 * Health Check Service
 * Monitors the health status of all system services
 */

import Docker from "dockerode";
import { prisma } from "../../services/prisma.service";
import Redis from "ioredis";
import axios from "axios";
import { safeExec } from "../../utils/shell-sanitizer";
import { n8nWebhookService } from "../../services/n8n-webhook.service";
import log from '../../services/logger.service';

// PM2 process type for health checks
interface PM2Process {
  pm2_env?: {
    status?: string;
  };
}

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency?: number;
  message?: string;
  lastCheck: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  services: ServiceHealth[];
  timestamp: string;
}

interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  message?: string;
  details?: Record<string, unknown>;
}

class HealthService {
  private docker: Docker;
  private checkCache: Map<string, { result: ServiceHealth; timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  /**
   * Get health status of all services
   */
  async getSystemHealth(forceRefresh = false): Promise<SystemHealth> {
    const services = await Promise.all([
      this.checkService("PostgreSQL", () => this.checkPostgres(), forceRefresh),
      this.checkService("Redis", () => this.checkRedis(), forceRefresh),
      this.checkService("Docker", () => this.checkDocker(), forceRefresh),
      this.checkService("Traefik", () => this.checkTraefik(), forceRefresh),
      this.checkService("PM2", () => this.checkPM2(), forceRefresh),
      this.checkService("N8N", () => this.checkN8N(), forceRefresh),
      this.checkService("API Backend", () => this.checkAPIBackend(), forceRefresh),
    ]);

    // Determine overall status
    const unhealthyCount = services.filter(s => s.status === "unhealthy").length;
    const degradedCount = services.filter(s => s.status === "degraded").length;

    let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (unhealthyCount > 0) {
      overall = unhealthyCount >= 3 ? "unhealthy" : "degraded";
    } else if (degradedCount > 0) {
      overall = "degraded";
    }

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check a single service with caching
   */
  private async checkService(
    name: string,
    checkFn: () => Promise<HealthCheckResult>,
    forceRefresh: boolean
  ): Promise<ServiceHealth> {
    const cacheKey = name;
    const cached = this.checkCache.get(cacheKey);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    const startTime = Date.now();
    try {
      const result = await checkFn();
      const health: ServiceHealth = {
        name,
        status: result.healthy ? "healthy" : "unhealthy",
        latency: result.latency,
        message: result.message,
        lastCheck: new Date().toISOString(),
        details: result.details,
      };

      this.checkCache.set(cacheKey, { result: health, timestamp: Date.now() });
      return health;
    } catch (error) {
      const health: ServiceHealth = {
        name,
        status: "unhealthy",
        latency: Date.now() - startTime,
        message: (error as Error).message,
        lastCheck: new Date().toISOString(),
      };
      this.checkCache.set(cacheKey, { result: health, timestamp: Date.now() });
      return health;
    }
  }

  /**
   * Check PostgreSQL database
   */
  private async checkPostgres(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        healthy: true,
        latency: Date.now() - start,
        message: "Database connection successful",
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        message: `Database error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

    try {
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
      });
      await client.connect();
      await client.ping();
      await client.quit();

      return {
        healthy: true,
        latency: Date.now() - start,
        message: "Redis connection successful",
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        message: `Redis error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check Docker daemon
   */
  private async checkDocker(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const info = await this.docker.info();
      const containers = await this.docker.listContainers({ all: true });

      const running = containers.filter(c => c.State === "running").length;
      const stopped = containers.filter(c => c.State !== "running").length;

      return {
        healthy: true,
        latency: Date.now() - start,
        message: `${running} containers running, ${stopped} stopped`,
        details: {
          containersRunning: running,
          containersStopped: stopped,
          serverVersion: info.ServerVersion,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        message: `Docker error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check Traefik reverse proxy
   */
  private async checkTraefik(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await axios.get("http://traefik:8080/api/overview", {
        timeout: 5000,
      });

      return {
        healthy: response.status === 200,
        latency: Date.now() - start,
        message: "Traefik API responding",
        details: response.data,
      };
    } catch (error) {
      // Traefik might not have API enabled, check if container is running
      try {
        const containers = await this.docker.listContainers({
          filters: { name: ["traefik"] },
        });
        const traefikContainer = containers.find(c =>
          c.Names.some(n => n.includes("traefik"))
        );

        if (traefikContainer && traefikContainer.State === "running") {
          return {
            healthy: true,
            latency: Date.now() - start,
            message: "Traefik container running (API not accessible)",
          };
        }
      } catch {}

      return {
        healthy: false,
        latency: Date.now() - start,
        message: `Traefik check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check PM2 process manager
   */
  private async checkPM2(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await safeExec("pm2", ["jlist"], { timeout: 10000 });
      const processes = JSON.parse(result.stdout);

      const online = processes.filter((p: PM2Process) => p.pm2_env?.status === "online").length;
      const errored = processes.filter((p: PM2Process) => p.pm2_env?.status === "errored").length;
      const stopped = processes.filter((p: PM2Process) => p.pm2_env?.status === "stopped").length;

      const healthy = errored === 0;

      return {
        healthy,
        latency: Date.now() - start,
        message: `${online} online, ${errored} errored, ${stopped} stopped`,
        details: {
          online,
          errored,
          stopped,
          total: processes.length,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        message: `PM2 check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check N8N automation service
   */
  private async checkN8N(): Promise<HealthCheckResult> {
    const start = Date.now();
    const n8nUrl = process.env.N8N_URL || "http://n8n:5678";

    try {
      const response = await axios.get(`${n8nUrl}/healthz`, {
        timeout: 5000,
      });

      return {
        healthy: response.status === 200,
        latency: Date.now() - start,
        message: "N8N service responding",
      };
    } catch (error) {
      // Check if container is running
      try {
        const containers = await this.docker.listContainers({
          filters: { name: ["n8n"] },
        });
        const n8nContainer = containers.find(c =>
          c.Names.some(n => n.includes("n8n") && !n.includes("postgres"))
        );

        if (n8nContainer && n8nContainer.State === "running") {
          return {
            healthy: true,
            latency: Date.now() - start,
            message: "N8N container running (healthz not accessible)",
          };
        }
      } catch {}

      return {
        healthy: false,
        latency: Date.now() - start,
        message: `N8N check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check API Backend (self-check)
   */
  private async checkAPIBackend(): Promise<HealthCheckResult> {
    const start = Date.now();
    return {
      healthy: true,
      latency: Date.now() - start,
      message: "API Backend responding (self)",
    };
  }

  /**
   * Check SSL certificate expiry
   */
  async checkSSLExpiry(domain: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await safeExec(
        "bash",
        ["-c", `echo | openssl s_client -connect ${domain}:443 -servername ${domain} 2>/dev/null | openssl x509 -noout -dates`],
        { timeout: 10000 }
      );

      const match = result.stdout.match(/notAfter=(.+)/);
      if (match) {
        const expiryDate = new Date(match[1]);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return {
          healthy: daysUntilExpiry > 14,
          latency: Date.now() - start,
          message: `SSL expires in ${daysUntilExpiry} days`,
          details: {
            expiryDate: expiryDate.toISOString(),
            daysUntilExpiry,
          },
        };
      }

      return {
        healthy: false,
        latency: Date.now() - start,
        message: "Could not parse SSL expiry date",
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        message: `SSL check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get health status of a specific container
   */
  async getContainerHealth(containerId: string): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      const isRunning = info.State.Running;
      const health = info.State.Health;

      let status: "healthy" | "degraded" | "unhealthy" = "unhealthy";
      let message = "Container not running";

      if (isRunning) {
        if (health) {
          status = health.Status === "healthy" ? "healthy" :
                   health.Status === "starting" ? "degraded" : "unhealthy";
          message = `Health: ${health.Status}`;
        } else {
          status = "healthy";
          message = "Container running (no healthcheck)";
        }
      }

      return {
        name: info.Name.replace("/", ""),
        status,
        latency: Date.now() - start,
        message,
        lastCheck: new Date().toISOString(),
        details: {
          image: info.Config.Image,
          created: info.Created,
          state: info.State.Status,
        },
      };
    } catch (error) {
      return {
        name: containerId,
        status: "unknown",
        latency: Date.now() - start,
        message: (error as Error).message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear health check cache
   */
  /**
   * Check system health and trigger alerts for unhealthy services
   */
  async checkAndAlert(): Promise<{ alerted: string[]; healthy: string[] }> {
    const health = await this.getSystemHealth(true);
    const alerted: string[] = [];
    const healthy: string[] = [];

    for (const service of health.services) {
      if (service.status === "unhealthy") {
        // Trigger N8N webhook for unhealthy service
        await n8nWebhookService.triggerHealthCheckFailed({
          service: service.name,
          status: service.status,
          latency: service.latency,
          errorMessage: service.message,
          details: service.details,
        });
        alerted.push(service.name);
      } else {
        healthy.push(service.name);
      }
    }

    if (alerted.length > 0) {
      log.info(`[Health] Alert triggered for: ${alerted.join(", ")}`);
    }

    return { alerted, healthy };
  }

  clearCache(): void {
    this.checkCache.clear();
  }
}

export const healthService = new HealthService();
