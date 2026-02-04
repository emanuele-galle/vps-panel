/**
 * CSRF Protection Middleware
 *
 * Provides double-submit cookie pattern CSRF protection.
 * Works with HttpOnly cookies for JWT authentication.
 *
 * Pattern:
 * 1. Server sets a CSRF token cookie (not HttpOnly - JS needs to read it)
 * 2. Client sends the token in X-CSRF-Token header
 * 3. Server verifies header matches cookie
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { COOKIE_NAMES, getCsrfTokenCookieOptions } from '../utils/cookies';
import { isProduction } from '../config/env';

/**
 * Header name for CSRF token
 */
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Token length in bytes (will be hex encoded to 64 chars)
 */
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie
 * Called on successful login to establish a CSRF token
 */
export function setCsrfTokenCookie(reply: FastifyReply): string {
  const token = generateCsrfToken();

  reply.setCookie(COOKIE_NAMES.CSRF_TOKEN, token, getCsrfTokenCookieOptions());

  return token;
}

/**
 * Methods that require CSRF protection (state-changing operations)
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Routes that are exempt from CSRF protection
 * - Login: Doesn't have a CSRF token yet
 * - Public endpoints without authentication
 */
const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/health',
  '/',
];

/**
 * Route prefixes that are exempt from CSRF protection
 * These routes use Bearer token authentication instead of cookies
 */
const EXEMPT_ROUTE_PREFIXES = [
  '/api/system-backup',  // Backup operations use Bearer token
  '/api/backups',        // Backup upload uses multipart/form-data with Bearer token
  '/api/optimization',   // System optimization operations (protected by JWT auth)
];

/**
 * CSRF protection middleware
 *
 * Verifies that the CSRF token in the request header matches the cookie.
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE).
 */
export async function csrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip for non-state-changing methods
  if (!PROTECTED_METHODS.includes(request.method)) {
    return;
  }

  // Skip for exempt routes
  const path = request.url.split('?')[0]; // Remove query string
  if (EXEMPT_ROUTES.includes(path)) {
    return;
  }

  // Skip for exempt route prefixes
  if (EXEMPT_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return;
  }

  // If using Authorization header with Bearer token, skip CSRF
  // (CSRF protection is only needed for cookie-based auth)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return; // Using Bearer token, CSRF not applicable
  }

  // Skip if no authentication cookie (unauthenticated requests)
  const accessToken = request.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (!accessToken) {
    return; // No auth at all, let auth middleware handle it
  }

  // Get CSRF token from cookie and header
  const cookieToken = request.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
  const headerToken = request.headers[CSRF_HEADER] as string;

  // Verify both exist
  if (!cookieToken || !headerToken) {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'Token CSRF mancante. Ricarica la pagina.',
      },
    });
  }

  // Verify tokens match (constant-time comparison)
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Token CSRF non valido. Ricarica la pagina.',
      },
    });
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Register CSRF protection for the app
 * Should be called after cookie plugin is registered
 */
export async function registerCsrfProtection(app: FastifyInstance) {
  // Add CSRF check to all requests
  app.addHook('preHandler', csrfProtection);

  // Add endpoint to get a new CSRF token
  app.get('/api/csrf-token', async (request, reply) => {
    const token = setCsrfTokenCookie(reply);

    return reply.send({
      success: true,
      data: {
        csrfToken: token,
      },
    });
  });
}

/**
 * CSRF configuration for different environments
 */
export const csrfConfig = {
  // In development, we might want to be more lenient
  enabled: isProduction,
  // Token cookie name
  cookieName: COOKIE_NAMES.CSRF_TOKEN,
  // Header name for token
  headerName: CSRF_HEADER,
};
