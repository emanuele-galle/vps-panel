/**
 * Cookie Utilities
 *
 * Secure cookie configuration for JWT authentication.
 * Uses HttpOnly cookies to prevent XSS attacks from stealing tokens.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { config, isProduction } from '../config/env';

/**
 * Cookie names for authentication tokens
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token',
} as const;

/**
 * Cookie domain for cross-subdomain sharing
 * In production, use .fodivps1.cloud to share cookies between
 * fodivps1.cloud (frontend) and api.fodivps1.cloud (backend)
 */
const COOKIE_DOMAIN = isProduction ? '.fodivps1.cloud' : undefined;

/**
 * Common cookie options for secure cookies
 */
const baseOptions = {
  httpOnly: true, // Prevent JavaScript access (XSS protection)
  secure: isProduction, // Only send over HTTPS in production
  sameSite: 'lax' as const, // Allow cross-subdomain with top-level navigation
  path: '/', // Available on all paths
  domain: COOKIE_DOMAIN, // Share cookies across subdomains
};

/**
 * Access token cookie options
 * Shorter expiration, HttpOnly, Secure
 */
export function getAccessTokenCookieOptions() {
  // Parse JWT expiration (e.g., '7d' -> 7 days in ms)
  const expiresInMs = parseExpiration(config.JWT_EXPIRES_IN);

  return {
    ...baseOptions,
    maxAge: expiresInMs,
    // Don't set domain - let browser auto-set for current domain
  };
}

/**
 * Refresh token cookie options
 * Longer expiration, HttpOnly, Secure, stricter path
 */
export function getRefreshTokenCookieOptions() {
  // Parse refresh token expiration (e.g., '30d' -> 30 days in ms)
  const expiresInMs = parseExpiration(config.JWT_REFRESH_EXPIRES_IN);

  return {
    ...baseOptions,
    maxAge: expiresInMs,
    path: '/api/auth', // Only send for auth endpoints (token refresh)
  };
}

/**
 * CSRF token cookie options
 * NOT HttpOnly - needs to be readable by JavaScript to include in requests
 */
export function getCsrfTokenCookieOptions() {
  return {
    httpOnly: false, // Must be readable by JavaScript
    secure: isProduction,
    sameSite: 'lax' as const, // Allow cross-subdomain
    path: '/',
    domain: COOKIE_DOMAIN, // Share across subdomains
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}

/**
 * Clear cookie options (for logout)
 */
export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 0, // Expire immediately
  };
}

/**
 * Set authentication cookies
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
) {
  // Set access token cookie
  reply.setCookie(
    COOKIE_NAMES.ACCESS_TOKEN,
    accessToken,
    getAccessTokenCookieOptions()
  );

  // Set refresh token cookie (stricter path)
  reply.setCookie(
    COOKIE_NAMES.REFRESH_TOKEN,
    refreshToken,
    getRefreshTokenCookieOptions()
  );
}

/**
 * Clear authentication cookies (logout)
 */
export function clearAuthCookies(reply: FastifyReply) {
  // Clear access token
  reply.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, {
    ...getClearCookieOptions(),
    path: '/',
  });

  // Clear refresh token
  reply.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
    ...getClearCookieOptions(),
    path: '/api/auth',
  });

  // Clear CSRF token
  reply.clearCookie(COOKIE_NAMES.CSRF_TOKEN, {
    ...getClearCookieOptions(),
    httpOnly: false,
    domain: COOKIE_DOMAIN,
  });
}

/**
 * Get access token from request (cookie or header)
 * Supports both cookie-based and header-based authentication
 */
export function getAccessToken(request: FastifyRequest): string | null {
  // First try cookies (preferred)
  const cookieToken = request.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization header for backwards compatibility
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Get refresh token from request (cookie or body)
 */
export function getRefreshToken(request: FastifyRequest): string | null {
  // First try cookies
  const cookieToken = request.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to request body for backwards compatibility
  const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
  if (bodyToken) {
    return bodyToken;
  }

  return null;
}

/**
 * Parse expiration string to milliseconds
 * Supports: 's' (seconds), 'm' (minutes), 'h' (hours), 'd' (days)
 */
function parseExpiration(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);

  if (!match) {
    // Default to 7 days if format is invalid
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}
