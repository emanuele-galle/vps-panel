/**
 * Health Check Controller
 * API endpoints for health monitoring
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { healthService, SystemHealth, ServiceHealth } from "./health.service";
import { resourceAlertsService } from "../../services/resource-alerts.service";
import { prisma } from "../../services/prisma.service";
import { redis } from "../../services/redis.service";

interface SSLCheckQuery {
  domain: string;
}

interface ContainerHealthParams {
  containerId: string;
}

class HealthController {
  /**
   * GET /api/health/ready
   * Readiness probe - checks if app is ready to accept traffic
   * Used by load balancers and orchestrators (k8s, docker swarm)
   * No authentication required
   */
  async getReadiness(_request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const checks: {
      database: boolean;
      redis: boolean;
    } = {
      database: false,
      redis: false,
    };

    let allHealthy = true;

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      allHealthy = false;
    }

    // Check Redis connection
    try {
      const redisClient = redis.getClient();
      await redisClient.connect();
      const pingResult = await redisClient.ping();
      checks.redis = pingResult === 'PONG';
      if (!checks.redis) {
        allHealthy = false;
      }
    } catch (error) {
      checks.redis = false;
      allHealthy = false;
    }

    const status = allHealthy ? 200 : 503;

    return reply.status(status).send({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
  /**
   * Get system-wide health status
   */
  async getSystemHealth(request: FastifyRequest, _reply: FastifyReply): Promise<SystemHealth> {
    const forceRefresh = (request.query as { refresh?: string })?.refresh === "true";
    return healthService.getSystemHealth(forceRefresh);
  }

  /**
   * Check SSL certificate expiry for a domain
   */
  async checkSSLExpiry(
    request: FastifyRequest<{ Querystring: SSLCheckQuery }>,
    reply: FastifyReply
  ): Promise<any> {
    const { domain } = request.query;
    
    if (!domain) {
      return reply.status(400).send({
        error: "Domain parameter is required",
      });
    }
    
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return reply.status(400).send({
        error: "Invalid domain format",
      });
    }
    
    const result = await healthService.checkSSLExpiry(domain);
    return {
      domain,
      ...result,
    };
  }

  /**
   * Get health status of a specific container
   */
  async getContainerHealth(
    request: FastifyRequest<{ Params: ContainerHealthParams }>,
    _reply: FastifyReply
  ): Promise<ServiceHealth> {
    const { containerId } = request.params;
    return healthService.getContainerHealth(containerId);
  }

  /**
   * Clear health check cache (force refresh on next request)
   */
  /**
   * Get current resource usage (CPU, RAM, Disk)
   */
  async getResourceStatus(_request: FastifyRequest, _reply: FastifyReply): Promise<any> {
    const status = await resourceAlertsService.getResourceStatus();
    return {
      success: true,
      data: {
        cpu: {
          usage: Math.round(status.cpu.usage * 10) / 10,
          cores: status.cpu.cores,
          loadAverage: status.cpu.loadAverage.map(l => Math.round(l * 100) / 100),
        },
        memory: {
          total: status.memory.total,
          used: status.memory.used,
          free: status.memory.free,
          usagePercent: Math.round(status.memory.usagePercent * 10) / 10,
        },
        disk: {
          total: status.disk.total,
          used: status.disk.used,
          free: status.disk.free,
          usagePercent: Math.round(status.disk.usagePercent * 10) / 10,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  async clearCache(_request: FastifyRequest, _reply: FastifyReply): Promise<{ success: boolean }> {
    healthService.clearCache();
    return { success: true };
  }
}

export const healthController = new HealthController();
