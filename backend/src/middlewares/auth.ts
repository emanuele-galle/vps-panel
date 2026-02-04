import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware to authenticate user via JWT
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (_err) {
    reply.code(401).send({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication middleware
 * Does not fail if no token is provided
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (_err) {
    // Silently fail, user will be undefined
    request.user = undefined as any;
  }
}
