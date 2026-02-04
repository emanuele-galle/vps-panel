import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { UserRole } from '@prisma/client';

/**
 * Authenticate middleware - verifies JWT token
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    // Verify JWT token
    await request.jwtVerify();

    // Token payload is now available in request.user
    const user = request.user as JwtPayload;
    if (!user || !user.userId) {
      throw new UnauthorizedError('Invalid token');
    }
  } catch (_error) {
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * Require admin role middleware
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
    
    const user = request.user as JwtPayload;
    
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required');
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * Require role middleware - checks if user has required role
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    if (!user || !user.role) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

/**
 * Optional auth middleware - doesn't throw if not authenticated
 */
export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (_error) {
    // Ignore error, just don't set user
    request.user = undefined as any;
  }
}

/**
 * Verify a JWT token directly (for WebSocket authentication)
 */
export async function verifyToken(token: string, app: FastifyInstance): Promise<{
  userId: string;
  sessionId: string;
  role: UserRole;
}> {
  try {
    const decoded = app.jwt.verify(token) as {
      userId: string;
      sessionId: string;
      role: UserRole;
    };

    if (!decoded.userId) {
      throw new Error('Invalid token payload');
    }

    return decoded;
  } catch (_error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
