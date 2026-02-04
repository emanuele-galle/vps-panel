import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { notificationService } from '../../services/notification.service';

export class NotificationController {
  /**
   * GET /api/notifications
   */
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { limit, offset, unreadOnly } = request.query as {
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };

    const result = await notificationService.getAll(userId, {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      unreadOnly: unreadOnly === 'true',
    });

    return reply.send({ success: true, data: result });
  }

  /**
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const count = await notificationService.getUnreadCount(userId);
    return reply.send({ success: true, data: { count } });
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await notificationService.markAsRead(id, userId);
    return reply.send({ success: true });
  }

  /**
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    await notificationService.markAllAsRead(userId);
    return reply.send({ success: true });
  }

  /**
   * DELETE /api/notifications/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await notificationService.delete(id, userId);
    return reply.send({ success: true });
  }

  /**
   * DELETE /api/notifications/clear
   */
  async clearAll(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    await notificationService.clearAll(userId);
    return reply.send({ success: true });
  }
}

export const notificationController = new NotificationController();
