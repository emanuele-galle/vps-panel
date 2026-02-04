import { FastifyInstance } from 'fastify';
import { notificationController } from './notification.controller';
import { authenticate } from '../auth/jwt.middleware';

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Must be before /:id routes
  app.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));
  app.patch('/read-all', notificationController.markAllAsRead.bind(notificationController));
  app.delete('/clear', notificationController.clearAll.bind(notificationController));

  app.get('/', notificationController.getAll.bind(notificationController));
  app.patch('/:id/read', notificationController.markAsRead.bind(notificationController));
  app.delete('/:id', notificationController.delete.bind(notificationController));
}
