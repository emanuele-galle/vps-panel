import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createRateLimiter, rateLimitConfigs } from '../../src/middlewares/rate-limit.middleware';

// Mock config
vi.mock('../../src/config/env', () => ({
  config: {
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW: 60000,
  },
}));

describe('Rate Limit Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));

    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRateLimiter', () => {
    it('should allow requests within limit', async () => {
      const limiter = createRateLimiter('login'); // 5 requests per 5 minutes

      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
        expect(mockReply.status).not.toHaveBeenCalled();
      }
    });

    it('should block requests exceeding limit', async () => {
      const limiter = createRateLimiter('login'); // 5 requests per 5 minutes

      // Make 5 requests (allowed)
      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      // 6th request should be blocked
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
          }),
        })
      );
    });

    it('should set appropriate headers', async () => {
      const limiter = createRateLimiter('login');

      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should reset after time window expires', async () => {
      const limiter = createRateLimiter('login'); // 5 requests per 5 minutes

      // Make 5 requests (allowed)
      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Reset mocks
      mockReply.status = vi.fn().mockReturnThis();

      // Should be allowed again
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should track different IPs separately', async () => {
      const limiter = createRateLimiter('login');

      // Make 5 requests from IP 1
      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      // IP 1 is now rate limited
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).toHaveBeenCalledWith(429);

      // Reset mocks and use different IP
      mockReply.status = vi.fn().mockReturnThis();
      mockRequest.ip = '192.168.1.2';

      // IP 2 should still be allowed
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should include user ID in key when authenticated', async () => {
      const limiter = createRateLimiter('login');

      // Simulate authenticated request
      (mockRequest as any).user = { userId: 'user-123' };

      // Make requests - they should use IP:userId as key
      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      // Should be blocked
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).toHaveBeenCalledWith(429);

      // Reset and use same IP but different user
      mockReply.status = vi.fn().mockReturnThis();
      (mockRequest as any).user = { userId: 'user-456' };

      // Different user should still be allowed
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('Rate limit configurations', () => {
    it('should have correct login limits', () => {
      expect(rateLimitConfigs.login).toEqual({
        max: 5,
        timeWindow: 5 * 60 * 1000,
        ban: 15 * 60 * 1000,
      });
    });

    it('should have correct auth limits', () => {
      expect(rateLimitConfigs.auth).toEqual({
        max: 5,
        timeWindow: 60 * 1000,
      });
    });

    it('should have correct backup limits', () => {
      expect(rateLimitConfigs.backup).toEqual({
        max: 5,
        timeWindow: 60 * 60 * 1000,
      });
    });

    it('should have correct download limits', () => {
      expect(rateLimitConfigs.download).toEqual({
        max: 30,
        timeWindow: 60 * 1000,
      });
    });

    it('should have correct docker limits', () => {
      expect(rateLimitConfigs.docker).toEqual({
        max: 30,
        timeWindow: 60 * 1000,
      });
    });
  });

  describe('Ban functionality', () => {
    it('should ban user after exceeding login limit', async () => {
      const limiter = createRateLimiter('login'); // Has ban of 15 minutes

      // Exceed limit (5 + 1 = 6 requests)
      for (let i = 0; i < 6; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      expect(mockReply.status).toHaveBeenCalledWith(429);

      // Reset mocks
      mockReply.status = vi.fn().mockReturnThis();
      mockReply.send = vi.fn().mockReturnThis();

      // Advance time by 5 minutes (window reset) - should still be banned
      vi.advanceTimersByTime(5 * 60 * 1000);

      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('bloccato'),
          }),
        })
      );
    });

    it('should unban after ban period expires', async () => {
      const limiter = createRateLimiter('login');

      // Exceed limit to trigger ban
      for (let i = 0; i < 6; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      // Advance time by 15 minutes (ban duration)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      // Reset mocks
      mockReply.status = vi.fn().mockReturnThis();

      // Should be allowed again
      await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('Retry-After header', () => {
    it('should include Retry-After header when rate limited', async () => {
      const limiter = createRateLimiter('auth'); // 5 requests per minute

      // Exceed limit
      for (let i = 0; i < 6; i++) {
        await limiter(mockRequest as FastifyRequest, mockReply as FastifyReply);
      }

      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });
});

describe('Security: Rate Limiting', () => {
  it('should have strict limits for authentication endpoints', () => {
    // Login should be very strict
    expect(rateLimitConfigs.login.max).toBeLessThanOrEqual(5);
    expect(rateLimitConfigs.login.timeWindow).toBeGreaterThanOrEqual(60 * 1000);

    // Should have ban functionality
    expect(rateLimitConfigs.login.ban).toBeGreaterThan(0);
  });

  it('should have reasonable limits for password reset', () => {
    expect(rateLimitConfigs.passwordReset.max).toBeLessThanOrEqual(5);
    expect(rateLimitConfigs.passwordReset.timeWindow).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it('should have limits for resource-intensive operations', () => {
    // Backup creation should be limited
    expect(rateLimitConfigs.backup.max).toBeLessThanOrEqual(10);
    expect(rateLimitConfigs.backup.timeWindow).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });
});
