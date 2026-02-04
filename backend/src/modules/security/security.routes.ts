import { FastifyInstance } from 'fastify';
import { securityController } from './security.controller';
import { authenticate } from '../auth/jwt.middleware';
import { requireAdmin } from '../../middlewares/admin';

export async function securityRoutes(fastify: FastifyInstance) {
  // All security routes require authentication and ADMIN role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/security/events - Get recent security events
  fastify.get('/events', securityController.getEvents.bind(securityController));

  // GET /api/security/stats - Get security statistics
  fastify.get('/stats', securityController.getStats.bind(securityController));

  // POST /api/security/cleanup - Clean up old security logs
  fastify.post('/cleanup', securityController.cleanup.bind(securityController));
}
