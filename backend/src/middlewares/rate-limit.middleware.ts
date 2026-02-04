import type { JwtPayload } from '../utils/types';

// Rate limit context type
interface RateLimitContext {
  after: string;
}
/**
 * Rate Limiting Middleware (Redis-backed)
 *
 * Provides comprehensive rate limiting for the API:
 * - Global rate limits for all requests
 * - Stricter limits for authentication endpoints
 * - Stricter limits for sensitive operations
 * - Redis-backed for distributed systems and persistence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config/env';
import { redis } from '../services/redis.service';
import log from '../services/logger.service';

/**
 * Rate limit configurations for different route types
 */
export const rateLimitConfigs = {
  // Global rate limit (default)
  global: {
    max: config.RATE_LIMIT_MAX, // 100 per minute
    timeWindow: config.RATE_LIMIT_WINDOW, // 60000ms = 1 minute
  },
  // Authentication endpoints (stricter)
  auth: {
    max: 5, // 5 attempts
    timeWindow: 60 * 1000, // per minute
  },
  // Login specifically (very strict to prevent brute force)
  login: {
    max: 5, // 5 attempts
    timeWindow: 5 * 60 * 1000, // per 5 minutes
    ban: 15 * 60 * 1000, // Ban for 15 minutes after exceeding
  },
  // Password reset (very strict)
  passwordReset: {
    max: 3, // 3 attempts
    timeWindow: 60 * 60 * 1000, // per hour
  },
  // API key creation
  apiKey: {
    max: 10, // 10 per hour
    timeWindow: 60 * 60 * 1000,
  },
  // File downloads
  download: {
    max: 30, // 30 downloads per minute
    timeWindow: 60 * 1000,
  },
  // Backup creation (resource intensive)
  backup: {
    max: 5, // 5 backups per hour
    timeWindow: 60 * 60 * 1000,
  },
  // Docker operations
  docker: {
    max: 30, // 30 operations per minute
    timeWindow: 60 * 1000,
  },
  // Project creation
  projectCreate: {
    max: 10, // 10 projects per hour
    timeWindow: 60 * 60 * 1000,
  },
} as const;

/**
 * Custom key generator - uses IP + User ID if authenticated
 */
function keyGenerator(req: FastifyRequest): string {
  const user = req.user as JwtPayload | undefined;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (user?.userId) {
    return `${ip}:${user.userId}`;
  }

  return String(ip);
}

/**
 * Error response for rate limit exceeded
 */
function errorResponseBuilder(_req: FastifyRequest, context: RateLimitContext) {
  return {
    statusCode: 429,
    success: false,
    error: {
      code: 'rate_limit_exceeded',
      message: 'Troppe richieste. Riprova più tardi.',
      retryAfter: context.after,
    },
  };
}

/**
 * Register global rate limiting
 */
export async function registerGlobalRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: rateLimitConfigs.global.max,
    timeWindow: rateLimitConfigs.global.timeWindow,
    keyGenerator,
    errorResponseBuilder,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Skip rate limiting for health checks
    allowList: (req) => {
      return req.url === '/health' || req.url === '/';
    },
  });
}

/**
 * Redis key helpers for rate limiting
 */
const RateLimitKeys = {
  counter: (key: string, endpoint: string) => `ratelimit:${endpoint}:${key}`,
  ban: (key: string, endpoint: string) => `ratelimit:ban:${endpoint}:${key}`,
  banLevel: (key: string, endpoint: string) => `ratelimit:banlevel:${endpoint}:${key}`,
  failedAttempts: (key: string, endpoint: string) => `ratelimit:failed:${endpoint}:${key}`,
};

/**
 * Progressive ban durations (in seconds)
 */
const BanDurations = {
  level1: 5 * 60,        // 5 minutes
  level2: 15 * 60,       // 15 minutes
  level3: 60 * 60,       // 1 hour
  level4: 24 * 60 * 60,  // 24 hours
};

/**
 * Get next ban duration based on current level
 */
function getNextBanDuration(currentLevel: number): number {
  switch (currentLevel) {
    case 0: return BanDurations.level1;
    case 1: return BanDurations.level2;
    case 2: return BanDurations.level3;
    default: return BanDurations.level4;
  }
}

/**
 * Get next ban level (max 3 for level4)
 */
function getNextBanLevel(currentLevel: number): number {
  return Math.min(currentLevel + 1, 3);
}

/**
 * Format ban duration for human-readable message
 */
function formatBanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} secondi`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minuti`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore`;
  return `${Math.floor(seconds / 86400)} giorni`;
}

/**
 * Create a Redis-backed rate limiter for specific routes
 */
export function createRateLimiter(
  configKey: keyof typeof rateLimitConfigs
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const limitConfig = rateLimitConfigs[configKey];
  const ttlSeconds = Math.ceil(limitConfig.timeWindow / 1000);
  const enableProgressiveBan = 'ban' in limitConfig && limitConfig.ban;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const clientKey = keyGenerator(request);
    const counterKey = RateLimitKeys.counter(clientKey, configKey);
    const banKey = RateLimitKeys.ban(clientKey, configKey);
    const banLevelKey = RateLimitKeys.banLevel(clientKey, configKey);
    const user = request.user as JwtPayload | undefined;

    try {
      // Check if currently banned
      if (enableProgressiveBan) {
        const isBanned = await redis.exists(banKey);
        if (isBanned) {
          const banTtl = await redis.ttl(banKey);
          const currentLevel = parseInt((await redis.getClient().get(banLevelKey)) || '0', 10);

          // Security logging: Ban active
          const logger = request.log || log;
          logger.warn({
            event: 'rate_limit_ban_active',
            clientKey,
            endpoint: configKey,
            banLevel: currentLevel + 1,
            banTtl,
            ip: request.ip,
            userId: user?.userId,
            userAgent: request.headers['user-agent'],
          }, 'Rate limit ban active');

          reply.header('Retry-After', banTtl > 0 ? banTtl : BanDurations.level1);
          return reply.status(429).send({
            success: false,
            error: {
              code: 'RATE_LIMIT_BANNED',
              message: `Troppe richieste. Sei temporaneamente bloccato. Riprova tra ${formatBanDuration(banTtl > 0 ? banTtl : BanDurations.level1)}.`,
              retryAfter: `${banTtl > 0 ? banTtl : BanDurations.level1}s`,
              banLevel: currentLevel + 1,
            },
          });
        }
      }

      // Increment counter with TTL
      const count = await redis.incr(counterKey, ttlSeconds);
      const remaining = Math.max(0, limitConfig.max - count);
      const resetAt = Math.ceil(Date.now() / 1000) + ttlSeconds;

      // Set headers
      reply.header('X-RateLimit-Limit', limitConfig.max);
      reply.header('X-RateLimit-Remaining', remaining);
      reply.header('X-RateLimit-Reset', resetAt);

      // Check if over limit
      if (count > limitConfig.max) {
        // Apply progressive ban if configured
        if (enableProgressiveBan) {
          // Get current ban level (default 0)
          const currentLevel = parseInt((await redis.getClient().get(banLevelKey)) || '0', 10);
          const nextLevel = getNextBanLevel(currentLevel);
          const banDuration = getNextBanDuration(currentLevel);

          // Set ban with progressive duration
          await redis.set(banKey, '1', banDuration);

          // Update ban level with extended TTL (30 days to track repeat offenders)
          await redis.set(banLevelKey, String(nextLevel), 30 * 24 * 60 * 60);

          // Security logging: Rate limit exceeded, ban applied
          const logger = request.log || log;
          logger.warn({
            event: 'rate_limit_exceeded',
            clientKey,
            endpoint: configKey,
            count,
            limit: limitConfig.max,
            banLevel: nextLevel,
            banDuration,
            ip: request.ip,
            userId: user?.userId,
            userAgent: request.headers['user-agent'],
            url: request.url,
          }, `Rate limit exceeded: ban level ${nextLevel} applied`);

          reply.header('Retry-After', banDuration);

          return reply.status(429).send({
            success: false,
            error: {
              code: 'rate_limit_exceeded',
              message: `Troppe richieste. Sei bloccato per ${formatBanDuration(banDuration)}.`,
              retryAfter: `${banDuration}s`,
              banLevel: nextLevel,
            },
          });
        }

        // No progressive ban, just rate limit
        const retryAfter = ttlSeconds;
        reply.header('Retry-After', retryAfter);

        // Security logging: Rate limit exceeded (no ban)
        const logger = request.log || log;
          logger.warn({
          event: 'rate_limit_exceeded',
          clientKey,
          endpoint: configKey,
          count,
          limit: limitConfig.max,
          ip: request.ip,
          userId: user?.userId,
          userAgent: request.headers['user-agent'],
          url: request.url,
        }, 'Rate limit exceeded');

        return reply.status(429).send({
          success: false,
          error: {
            code: 'rate_limit_exceeded',
            message: 'Troppe richieste. Riprova più tardi.',
            retryAfter: `${retryAfter}s`,
          },
        });
      }
    } catch (error) {
      // If Redis fails, log but don't block the request
      log.error({
        event: 'RATE_LIMIT_ERROR',
        error: error instanceof Error ? error.message : String(error),
        endpoint: configKey,
        clientKey,
      }, `Rate limit Redis error for ${configKey}`);
      // Fallback: allow request to proceed
    }
  };
}

/**
 * Pre-built rate limiters for common use cases
 */
export const rateLimiters = {
  auth: createRateLimiter('auth'),
  login: createRateLimiter('login'),
  passwordReset: createRateLimiter('passwordReset'),
  download: createRateLimiter('download'),
  backup: createRateLimiter('backup'),
  docker: createRateLimiter('docker'),
  projectCreate: createRateLimiter('projectCreate'),
};
