import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { activityService } from './activity.service';
import { AppError } from '../../utils/errors';
import {
  idSchema,
  paginationSchema,
  activityStatusSchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  userId: idSchema.optional(),
  action: z.string().max(100).optional(),
  resource: z.string().max(100).optional(),
  status: activityStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const logIdParamsSchema = z.object({
  id: idSchema,
});

const userIdParamsSchema = z.object({
  userId: idSchema,
});

const resourceParamsSchema = z.object({
  resource: z.string().min(1).max(100),
  resourceId: idSchema.optional(),
});

const searchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long')
    .transform((val) => val.trim()),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const exportQuerySchema = z.object({
  userId: idSchema.optional(),
  resource: z.string().max(100).optional(),
  status: activityStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const activityController = {
  /**
   * Get all activity logs with filters
   */
  async getAllLogs(
    request: FastifyRequest<{ Querystring: Record<string, string | undefined> }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate query parameters
    const query = getLogsQuerySchema.parse(request.query);

    const filters: ActivityLogFilters = {};
    if (query.userId) filters.userId = query.userId;
    if (query.action) filters.action = query.action;
    if (query.resource) filters.resource = query.resource;
    if (query.status) filters.status = query.status;
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);

    const result = await activityService.getAllLogs(
      filters,
      query.page,
      query.limit
    );

    reply.send({
      success: true,
      data: result.logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: result.pages,
      },
    });
  },

  /**
   * Get activity log by ID
   */
  async getLogById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = logIdParamsSchema.parse(request.params);
    const log = await activityService.getLogById(params.id);

    if (!log) {
      throw new AppError(404, 'Activity log not found', 'LOG_NOT_FOUND');
    }

    reply.send({
      success: true,
      data: log,
    });
  },

  /**
   * Get logs for specific user
   */
  async getLogsByUser(
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: { page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and query
    const params = userIdParamsSchema.parse(request.params);
    const query = paginationSchema.parse(request.query);

    const result = await activityService.getLogsByUser(
      params.userId,
      query.page,
      query.limit
    );

    reply.send({
      success: true,
      data: result.logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: result.pages,
      },
    });
  },

  /**
   * Get logs for specific resource
   */
  async getLogsByResource(
    request: FastifyRequest<{
      Params: { resource: string; resourceId?: string };
      Querystring: { page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and query
    const params = resourceParamsSchema.parse(request.params);
    const query = paginationSchema.parse(request.query);

    const result = await activityService.getLogsByResource(
      params.resource,
      params.resourceId,
      query.page,
      query.limit
    );

    reply.send({
      success: true,
      data: result.logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: result.pages,
      },
    });
  },

  /**
   * Get activity log statistics
   */
  async getLogStats(
    request: FastifyRequest<{ Querystring: Record<string, string | undefined> }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate query
    const query = getLogsQuerySchema.parse(request.query);

    const filters: ActivityLogFilters = {};
    if (query.userId) filters.userId = query.userId;
    if (query.resource) filters.resource = query.resource;
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);

    const stats = await activityService.getLogStats(filters);

    reply.send({
      success: true,
      data: stats,
    });
  },

  /**
   * Search activity logs
   */
  async searchLogs(
    request: FastifyRequest<{ Querystring: { q: string; page?: string; limit?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate query
    const query = searchQuerySchema.parse(request.query);

    const result = await activityService.searchLogs(
      query.q,
      query.page,
      query.limit
    );

    reply.send({
      success: true,
      data: result.logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: result.pages,
      },
    });
  },

  /**
   * Export activity logs
   */
  async exportLogs(
    request: FastifyRequest<{ Querystring: Record<string, string | undefined> }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate query
    const query = exportQuerySchema.parse(request.query);

    const filters: ActivityLogFilters = {};
    if (query.userId) filters.userId = query.userId;
    if (query.resource) filters.resource = query.resource;
    if (query.status) filters.status = query.status;
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);

    const logs = await activityService.exportLogs(filters);

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename=activity-logs.json')
      .send(logs);
  },
};
