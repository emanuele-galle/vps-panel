import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../utils/types';

/**
 * Middleware to check if user is admin
 * Must be used after authenticate middleware
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as JwtPayload;

  if (!user) {
    reply.code(401).send({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (user.role !== 'ADMIN') {
    reply.code(403).send({
      success: false,
      error: 'Admin access required',
    });
    return;
  }
}
