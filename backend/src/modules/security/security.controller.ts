import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { securityAuditService } from '../../services/security-audit.service';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getEventsQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(168).default(24), // max 7 days
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const getStatsQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(168).default(24),
});

const cleanupBodySchema = z.object({
  daysToKeep: z.coerce.number().int().positive().max(365).default(90),
});

// ============================================
// CONTROLLER
// ============================================

export class SecurityController {
  /**
   * GET /api/security/events
   * Get recent security events
   */
  async getEvents(
    request: FastifyRequest<{ Querystring: { hours?: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const query = getEventsQuerySchema.parse(request.query);
    const events = await securityAuditService.getRecentSecurityEvents(query.hours, query.limit);

    return reply.send({
      success: true,
      data: events,
    });
  }

  /**
   * GET /api/security/stats
   * Get security statistics
   */
  async getStats(
    request: FastifyRequest<{ Querystring: { hours?: string } }>,
    reply: FastifyReply
  ) {
    const query = getStatsQuerySchema.parse(request.query);
    const stats = await securityAuditService.getSecurityStats(query.hours);

    return reply.send({
      success: true,
      data: stats,
    });
  }

  /**
   * POST /api/security/cleanup
   * Clean up old security logs
   */
  async cleanup(
    request: FastifyRequest<{ Body: { daysToKeep?: number } }>,
    reply: FastifyReply
  ) {
    const body = cleanupBodySchema.parse(request.body || {});
    const deletedCount = await securityAuditService.cleanupOldLogs(body.daysToKeep);

    return reply.send({
      success: true,
      data: {
        deletedCount,
        message: `${deletedCount} security logs older than ${body.daysToKeep} days deleted`,
      },
    });
  }
}

export const securityController = new SecurityController();
