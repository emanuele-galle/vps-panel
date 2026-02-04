import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { monitoringService } from './monitoring.service';
import { containerIdSchema } from '../../utils/validation';
import { AppError } from '../../utils/errors';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const metricsHistoryQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(168).default(24), // max 7 days
});

const containerIdParamsSchema = z.object({
  id: containerIdSchema,
});

// ============================================
// CONTROLLER
// ============================================

export class MonitoringController {
  /**
   * GET /api/monitoring/current
   * Get current system metrics
   */
  async getCurrentMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await monitoringService.getSystemMetrics();

    return reply.send({
      success: true,
      data: metrics,
    });
  }

  /**
   * GET /api/monitoring/history
   * Get metrics history
   */
  async getMetricsHistory(
    request: FastifyRequest<{ Querystring: { hours?: string } }>,
    reply: FastifyReply
  ) {
    // Validate query
    const query = metricsHistoryQuerySchema.parse(request.query);

    const history = await monitoringService.getMetricsHistory(query.hours);

    return reply.send({
      success: true,
      data: history,
    });
  }

  /**
   * GET /api/monitoring/container/:id
   * Get container statistics
   */
  async getContainerStats(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);

    const stats = await monitoringService.getContainerStats(params.id);

    if (!stats) {
      throw new AppError(404, 'Container not found or not running', 'CONTAINER_NOT_FOUND');
    }

    return reply.send({
      success: true,
      data: stats,
    });
  }

  /**
   * GET /api/monitoring/dashboard-summary
   * Get dashboard summary with recent deploys and system health
   */
  async getDashboardSummary(request: FastifyRequest, reply: FastifyReply) {
    const summary = await monitoringService.getDashboardSummary();

    return reply.send({
      success: true,
      data: summary,
    });
  }

  /**
   * GET /api/monitoring/disk
   * Get comprehensive disk metrics
   */
  async getDiskMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await monitoringService.getDiskMetrics();

    return reply.send({
      success: true,
      data: metrics,
    });
  }

  /**
   * GET /api/monitoring/disk/volumes
   * Get Docker volumes with sizes
   */
  async getVolumesStorage(request: FastifyRequest, reply: FastifyReply) {
    const volumes = await monitoringService.getVolumesWithSize();

    return reply.send({
      success: true,
      data: volumes,
    });
  }

  /**
   * GET /api/monitoring/disk/containers
   * Get container storage usage
   */
  async getContainersStorage(request: FastifyRequest, reply: FastifyReply) {
    const containers = await monitoringService.getContainersStorageUsage();

    return reply.send({
      success: true,
      data: containers,
    });
  }

  /**
   * GET /api/monitoring/disk/images
   * Get Docker images storage
   */
  async getImagesStorage(request: FastifyRequest, reply: FastifyReply) {
    const images = await monitoringService.getImagesStorageUsage();

    return reply.send({
      success: true,
      data: images,
    });
  }

  /**
   * GET /api/monitoring/disk/databases
   * Get database sizes
   */
  async getDatabasesStorage(request: FastifyRequest, reply: FastifyReply) {
    const databases = await monitoringService.getDatabaseSizes();

    return reply.send({
      success: true,
      data: databases,
    });
  }
}

export const monitoringController = new MonitoringController();
