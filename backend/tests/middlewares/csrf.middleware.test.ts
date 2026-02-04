import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock config
vi.mock('../../src/config/env', () => ({
  config: {},
  isProduction: true,
}));

// Mock cookies
vi.mock('../../src/utils/cookies', () => ({
  COOKIE_NAMES: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    CSRF_TOKEN: 'csrf_token',
  },
  getCsrfTokenCookieOptions: () => ({
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  }),
}));

import {
  generateCsrfToken,
  setCsrfTokenCookie,
  csrfProtection,
  CSRF_HEADER,
} from '../../src/middlewares/csrf.middleware';
import { COOKIE_NAMES } from '../../src/utils/cookies';

describe('CSRF Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      url: '/api/some-endpoint',
      cookies: {},
      headers: {},
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
    };
  });

  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateCsrfToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 10; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(10);
    });
  });

  describe('setCsrfTokenCookie', () => {
    it('should set CSRF cookie with correct options', () => {
      setCsrfTokenCookie(mockReply as FastifyReply);

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.CSRF_TOKEN,
        expect.any(String),
        expect.objectContaining({
          httpOnly: false, // Must be readable by JavaScript
        })
      );
    });

    it('should return the generated token', () => {
      const token = setCsrfTokenCookie(mockReply as FastifyReply);

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('csrfProtection', () => {
    it('should skip for GET requests', async () => {
      mockRequest.method = 'GET';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip for HEAD requests', async () => {
      mockRequest.method = 'HEAD';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip for OPTIONS requests', async () => {
      mockRequest.method = 'OPTIONS';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip for login endpoint', async () => {
      mockRequest.url = '/api/auth/login';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip for refresh endpoint', async () => {
      mockRequest.url = '/api/auth/refresh';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip for health endpoint', async () => {
      mockRequest.url = '/health';

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip if using Bearer token instead of cookies', async () => {
      mockRequest.headers = {
        authorization: 'Bearer some-jwt-token',
      };
      mockRequest.cookies = {}; // No access_token cookie

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip if not authenticated', async () => {
      mockRequest.cookies = {}; // No access_token cookie
      mockRequest.headers = {}; // No authorization header

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should reject if CSRF token missing in cookie', async () => {
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        // No csrf_token cookie
      };
      mockRequest.headers = {
        [CSRF_HEADER]: 'some-header-token',
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CSRF_TOKEN_MISSING',
          }),
        })
      );
    });

    it('should reject if CSRF token missing in header', async () => {
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        [COOKIE_NAMES.CSRF_TOKEN]: 'some-cookie-token',
      };
      // No x-csrf-token header

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should reject if tokens do not match', async () => {
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        [COOKIE_NAMES.CSRF_TOKEN]: 'cookie-token-123',
      };
      mockRequest.headers = {
        [CSRF_HEADER]: 'different-header-token',
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CSRF_TOKEN_INVALID',
          }),
        })
      );
    });

    it('should allow request if tokens match', async () => {
      const csrfToken = 'a'.repeat(64);

      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        [COOKIE_NAMES.CSRF_TOKEN]: csrfToken,
      };
      mockRequest.headers = {
        [CSRF_HEADER]: csrfToken,
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should check CSRF for PUT requests', async () => {
      mockRequest.method = 'PUT';
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        // Missing CSRF token
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should check CSRF for DELETE requests', async () => {
      mockRequest.method = 'DELETE';
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        // Missing CSRF token
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should check CSRF for PATCH requests', async () => {
      mockRequest.method = 'PATCH';
      mockRequest.cookies = {
        [COOKIE_NAMES.ACCESS_TOKEN]: 'some-jwt-token',
        // Missing CSRF token
      };

      await csrfProtection(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('Security: CSRF Protection', () => {
  it('should use timing-safe comparison', async () => {
    // If tokens are of different lengths, should reject
    const mockRequest = {
      method: 'POST',
      url: '/api/something',
      cookies: {
        access_token: 'jwt',
        csrf_token: 'short',
      },
      headers: {
        [CSRF_HEADER]: 'much-longer-token-value',
      },
    } as unknown as FastifyRequest;

    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    await csrfProtection(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(403);
  });

  it('should only apply CSRF to cookie-authenticated requests', async () => {
    // If using Bearer token, CSRF doesn't apply (no cookie to forge)
    const mockRequest = {
      method: 'POST',
      url: '/api/something',
      cookies: {}, // No cookies
      headers: {
        authorization: 'Bearer jwt-token',
      },
    } as unknown as FastifyRequest;

    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    await csrfProtection(mockRequest, mockReply);

    expect(mockReply.status).not.toHaveBeenCalled();
  });
});
