import { ActivityLog, LogStatus, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../utils/errors';
import log from '../../services/logger.service';


interface CreateActivityLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description: string;
  metadata?: any;
  status?: LogStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ActivityLogWithUser extends ActivityLog {
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  status?: LogStatus;
  startDate?: Date;
  endDate?: Date;
}

interface ActivityLogStats {
  total: number;
  success: number;
  error: number;
  warning: number;
  byResource: Record<string, number>;
  byAction: Record<string, number>;
}

class ActivityService {
  /**
   * Create activity log entry
   */
  async createLog(data: CreateActivityLogData): Promise<ActivityLog> {
    try {
      const log = await prisma.activityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          description: data.description,
          metadata: data.metadata,
          status: data.status || 'SUCCESS',
          errorMessage: data.errorMessage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      return log;
    } catch (error) {
      throw new AppError(500, `Failed to create activity log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all activity logs with optional filters
   */
  async getAllLogs(
    filters?: ActivityLogFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: ActivityLogWithUser[]; total: number; pages: number }> {
    try {
      const where: Prisma.ActivityLogWhereInput = {};

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.action) {
        where.action = { contains: filters.action, mode: Prisma.QueryMode.insensitive };
      }

      if (filters?.resource) {
        where.resource = filters.resource;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
      ]);

      const pages = Math.ceil(total / limit);

      return { logs, total, pages };
    } catch (error) {
      throw new AppError(500, `Failed to fetch activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get activity log by ID
   */
  async getLogById(id: string): Promise<ActivityLogWithUser | null> {
    try {
      const log = await prisma.activityLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return log;
    } catch (error) {
      throw new AppError(500, `Failed to fetch activity log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get activity logs for specific user
   */
  async getLogsByUser(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: ActivityLogWithUser[]; total: number; pages: number }> {
    try {
      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityLog.count({ where: { userId } }),
      ]);

      const pages = Math.ceil(total / limit);

      return { logs, total, pages };
    } catch (error) {
      throw new AppError(500, `Failed to fetch user activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get activity logs for specific resource
   */
  async getLogsByResource(
    resource: string,
    resourceId?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: ActivityLogWithUser[]; total: number; pages: number }> {
    try {
      const where: Prisma.ActivityLogWhereInput = { resource };

      if (resourceId) {
        where.resourceId = resourceId;
      }

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
      ]);

      const pages = Math.ceil(total / limit);

      return { logs, total, pages };
    } catch (error) {
      throw new AppError(500, `Failed to fetch resource activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get activity log statistics
   */
  async getLogStats(filters?: ActivityLogFilters): Promise<ActivityLogStats> {
    try {
      const where: Prisma.ActivityLogWhereInput = {};

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.resource) {
        where.resource = filters.resource;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const logs = await prisma.activityLog.findMany({ where });

      const stats: ActivityLogStats = {
        total: logs.length,
        success: logs.filter((l) => l.status === 'SUCCESS').length,
        error: logs.filter((l) => l.status === 'ERROR').length,
        warning: logs.filter((l) => l.status === 'WARNING').length,
        byResource: {},
        byAction: {},
      };

      // Count by resource
      logs.forEach((log) => {
        if (!stats.byResource[log.resource]) {
          stats.byResource[log.resource] = 0;
        }
        stats.byResource[log.resource]++;
      });

      // Count by action
      logs.forEach((log) => {
        if (!stats.byAction[log.action]) {
          stats.byAction[log.action] = 0;
        }
        stats.byAction[log.action]++;
      });

      return stats;
    } catch (error) {
      throw new AppError(500, `Failed to get activity log statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete old activity logs (cleanup)
   */
  async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.activityLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      throw new AppError(500, `Failed to delete old logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search activity logs
   */
  async searchLogs(
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: ActivityLogWithUser[]; total: number; pages: number }> {
    try {
      const where = {
        OR: [
          { action: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { resource: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      };

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
      ]);

      const pages = Math.ceil(total / limit);

      return { logs, total, pages };
    } catch (error) {
      throw new AppError(500, `Failed to search activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export activity logs to JSON
   */
  async exportLogs(filters?: ActivityLogFilters): Promise<ActivityLogWithUser[]> {
    try {
      const where: Prisma.ActivityLogWhereInput = {};

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.resource) {
        where.resource = filters.resource;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const logs = await prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return logs;
    } catch (error) {
      throw new AppError(500, `Failed to export activity logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const activityService = new ActivityService();

// Helper function to log activities (can be used throughout the app)
export async function logActivity(data: CreateActivityLogData): Promise<void> {
  try {
    await activityService.createLog(data);
  } catch (error) {
    log.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}
