import { prisma } from './prisma.service';
import { projectEvents } from '../modules/projects/projects.service';
import log from './logger.service';
import { NotificationType, NotificationPriority } from '@prisma/client';

const NOTIFICATION_EVENT_TYPES = {
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count',
} as const;

export class NotificationService {
  /**
   * Create a notification for a specific user
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actionLabel?: string;
    actionHref?: string;
    priority?: NotificationPriority;
    source?: string;
    sourceId?: string;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        actionLabel: data.actionLabel,
        actionHref: data.actionHref,
        priority: data.priority || 'NORMAL',
        source: data.source,
        sourceId: data.sourceId,
      },
    });

    // Emit WebSocket event
    projectEvents.emit(NOTIFICATION_EVENT_TYPES.NOTIFICATION_NEW, {
      userId: data.userId,
      notification,
    });

    // Update unread count
    const count = await this.getUnreadCount(data.userId);
    projectEvents.emit(NOTIFICATION_EVENT_TYPES.NOTIFICATION_COUNT, {
      userId: data.userId,
      count,
    });

    return notification;
  }

  /**
   * Create a notification for all admin users
   */
  async createForAdmins(data: {
    type: NotificationType;
    title: string;
    message: string;
    actionLabel?: string;
    actionHref?: string;
    priority?: NotificationPriority;
    source?: string;
    sourceId?: string;
  }) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    const notifications = await Promise.all(
      admins.map((admin) =>
        this.create({ ...data, userId: admin.id })
      )
    );

    return notifications;
  }

  /**
   * Get notifications for a user (paginated)
   */
  async getAll(userId: string, options?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const { limit = 50, offset = 0, unreadOnly = false } = options || {};

    const where = {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true, readAt: new Date() },
    });

    // Update unread count
    const count = await this.getUnreadCount(userId);
    projectEvents.emit(NOTIFICATION_EVENT_TYPES.NOTIFICATION_COUNT, { userId, count });

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    projectEvents.emit(NOTIFICATION_EVENT_TYPES.NOTIFICATION_COUNT, { userId, count: 0 });
  }

  /**
   * Delete a notification
   */
  async delete(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  /**
   * Clear all notifications for a user
   */
  async clearAll(userId: string) {
    return prisma.notification.deleteMany({
      where: { userId },
    });
  }

  /**
   * Cleanup old notifications (older than 30 days)
   */
  async cleanupOld(daysOld = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        read: true,
      },
    });

    if (result.count > 0) {
      log.info(`[Notifications] Cleaned up ${result.count} old notifications`);
    }

    return result.count;
  }
}

export const notificationService = new NotificationService();
export { NOTIFICATION_EVENT_TYPES };
