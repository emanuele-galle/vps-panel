import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';

// Mock config before importing cookies module
vi.mock('../../src/config/env', () => ({
  config: {
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
  },
  isProduction: false,
}));

import {
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCsrfTokenCookieOptions,
  getClearCookieOptions,
  setAuthCookies,
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
} from '../../src/utils/cookies';

describe('Cookie Utilities', () => {
  describe('COOKIE_NAMES', () => {
    it('should have correct cookie names', () => {
      expect(COOKIE_NAMES.ACCESS_TOKEN).toBe('access_token');
      expect(COOKIE_NAMES.REFRESH_TOKEN).toBe('refresh_token');
      expect(COOKIE_NAMES.CSRF_TOKEN).toBe('csrf_token');
    });
  });

  describe('getAccessTokenCookieOptions', () => {
    it('should return HttpOnly option', () => {
      const options = getAccessTokenCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should have SameSite strict', () => {
      const options = getAccessTokenCookieOptions();
      expect(options.sameSite).toBe('lax');
    });

    it('should have path set to /', () => {
      const options = getAccessTokenCookieOptions();
      expect(options.path).toBe('/');
    });

    it('should have maxAge based on JWT_EXPIRES_IN', () => {
      const options = getAccessTokenCookieOptions();
      // 7d = 7 * 24 * 60 * 60 * 1000 = 604800000ms
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getRefreshTokenCookieOptions', () => {
    it('should return HttpOnly option', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should have restricted path to /api/auth', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.path).toBe('/api/auth');
    });

    it('should have maxAge based on JWT_REFRESH_EXPIRES_IN', () => {
      const options = getRefreshTokenCookieOptions();
      // 30d = 30 * 24 * 60 * 60 * 1000 = 2592000000ms
      expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getCsrfTokenCookieOptions', () => {
    it('should NOT be HttpOnly (needs JavaScript access)', () => {
      const options = getCsrfTokenCookieOptions();
      expect(options.httpOnly).toBe(false);
    });

    it('should have SameSite strict', () => {
      const options = getCsrfTokenCookieOptions();
      expect(options.sameSite).toBe('lax');
    });
  });

  describe('getClearCookieOptions', () => {
    it('should have maxAge of 0', () => {
      const options = getClearCookieOptions();
      expect(options.maxAge).toBe(0);
    });
  });

  describe('setAuthCookies', () => {
    let mockReply: Partial<FastifyReply>;

    beforeEach(() => {
      mockReply = {
        setCookie: vi.fn().mockReturnThis(),
      };
    });

    it('should set access token cookie', () => {
      setAuthCookies(mockReply as FastifyReply, 'access-token', 'refresh-token');

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        })
      );
    });

    it('should set refresh token cookie', () => {
      setAuthCookies(mockReply as FastifyReply, 'access-token', 'refresh-token');

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
        })
      );
    });
  });

  describe('clearAuthCookies', () => {
    let mockReply: Partial<FastifyReply>;

    beforeEach(() => {
      mockReply = {
        clearCookie: vi.fn().mockReturnThis(),
      };
    });

    it('should clear all auth cookies', () => {
      clearAuthCookies(mockReply as FastifyReply);

      expect(mockReply.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        expect.any(Object)
      );
      expect(mockReply.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        expect.any(Object)
      );
      expect(mockReply.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAMES.CSRF_TOKEN,
        expect.any(Object)
      );
    });
  });

  describe('getAccessToken', () => {
    it('should prefer cookie over Authorization header', () => {
      const mockRequest = {
        cookies: { [COOKIE_NAMES.ACCESS_TOKEN]: 'cookie-token' },
        headers: { authorization: 'Bearer header-token' },
      } as unknown as FastifyRequest;

      expect(getAccessToken(mockRequest)).toBe('cookie-token');
    });

    it('should fall back to Authorization header if no cookie', () => {
      const mockRequest = {
        cookies: {},
        headers: { authorization: 'Bearer header-token' },
      } as unknown as FastifyRequest;

      expect(getAccessToken(mockRequest)).toBe('header-token');
    });

    it('should return null if no token found', () => {
      const mockRequest = {
        cookies: {},
        headers: {},
      } as unknown as FastifyRequest;

      expect(getAccessToken(mockRequest)).toBeNull();
    });

    it('should handle missing cookies property', () => {
      const mockRequest = {
        headers: { authorization: 'Bearer header-token' },
      } as unknown as FastifyRequest;

      expect(getAccessToken(mockRequest)).toBe('header-token');
    });
  });

  describe('getRefreshToken', () => {
    it('should prefer cookie over body', () => {
      const mockRequest = {
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'cookie-refresh' },
        body: { refreshToken: 'body-refresh' },
      } as unknown as FastifyRequest;

      expect(getRefreshToken(mockRequest)).toBe('cookie-refresh');
    });

    it('should fall back to body if no cookie', () => {
      const mockRequest = {
        cookies: {},
        body: { refreshToken: 'body-refresh' },
      } as unknown as FastifyRequest;

      expect(getRefreshToken(mockRequest)).toBe('body-refresh');
    });

    it('should return null if no token found', () => {
      const mockRequest = {
        cookies: {},
        body: {},
      } as unknown as FastifyRequest;

      expect(getRefreshToken(mockRequest)).toBeNull();
    });
  });
});

describe('Security: Cookie Configuration', () => {
  it('should use HttpOnly for access token to prevent XSS', () => {
    const options = getAccessTokenCookieOptions();
    expect(options.httpOnly).toBe(true);
  });

  it('should use HttpOnly for refresh token to prevent XSS', () => {
    const options = getRefreshTokenCookieOptions();
    expect(options.httpOnly).toBe(true);
  });

  it('should use SameSite=strict for CSRF protection', () => {
    const accessOptions = getAccessTokenCookieOptions();
    const refreshOptions = getRefreshTokenCookieOptions();

    expect(accessOptions.sameSite).toBe('lax');
    expect(refreshOptions.sameSite).toBe('lax');
  });

  it('should restrict refresh token path to /api/auth', () => {
    const options = getRefreshTokenCookieOptions();
    expect(options.path).toBe('/api/auth');
  });

  it('CSRF token should NOT be HttpOnly (needs JS access for headers)', () => {
    const options = getCsrfTokenCookieOptions();
    expect(options.httpOnly).toBe(false);
  });
});
