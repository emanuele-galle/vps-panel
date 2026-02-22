import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing cookies module
vi.mock('../src/config/env', () => ({
  config: {
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
    PANEL_DOMAIN: 'test.example.com',
    NODE_ENV: 'test',
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

import {
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCsrfTokenCookieOptions,
  getClearCookieOptions,
  getAccessToken,
  getRefreshToken,
} from '../src/utils/cookies';

describe('Cookie Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('COOKIE_NAMES', () => {
    it('should have correct values', () => {
      expect(COOKIE_NAMES.ACCESS_TOKEN).toBe('access_token');
      expect(COOKIE_NAMES.REFRESH_TOKEN).toBe('refresh_token');
      expect(COOKIE_NAMES.CSRF_TOKEN).toBe('csrf_token');
    });
  });

  describe('getAccessTokenCookieOptions', () => {
    it('should return httpOnly true and secure false in non-production', () => {
      const options = getAccessTokenCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      // 7d = 7 * 24 * 60 * 60 * 1000 = 604800000
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getRefreshTokenCookieOptions', () => {
    it('should have path /api/auth', () => {
      const options = getRefreshTokenCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.path).toBe('/api/auth');
      // 30d = 30 * 24 * 60 * 60 * 1000 = 2592000000
      expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getCsrfTokenCookieOptions', () => {
    it('should have httpOnly false', () => {
      const options = getCsrfTokenCookieOptions();

      expect(options.httpOnly).toBe(false);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      // 24 hours in ms
      expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('getClearCookieOptions', () => {
    it('should have maxAge 0', () => {
      const options = getClearCookieOptions();

      expect(options.maxAge).toBe(0);
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
    });
  });

  describe('getAccessToken', () => {
    it('should return token from cookies', () => {
      const mockRequest = {
        cookies: { access_token: 'test-cookie-token' },
        headers: {},
      } as any;

      const token = getAccessToken(mockRequest);
      expect(token).toBe('test-cookie-token');
    });

    it('should return token from Authorization header', () => {
      const mockRequest = {
        cookies: {},
        headers: { authorization: 'Bearer test-header-token' },
      } as any;

      const token = getAccessToken(mockRequest);
      expect(token).toBe('test-header-token');
    });

    it('should return null when no token', () => {
      const mockRequest = {
        cookies: {},
        headers: {},
      } as any;

      const token = getAccessToken(mockRequest);
      expect(token).toBeNull();
    });

    it('should prefer cookie token over Authorization header', () => {
      const mockRequest = {
        cookies: { access_token: 'cookie-token' },
        headers: { authorization: 'Bearer header-token' },
      } as any;

      const token = getAccessToken(mockRequest);
      expect(token).toBe('cookie-token');
    });
  });

  describe('getRefreshToken', () => {
    it('should return token from cookies', () => {
      const mockRequest = {
        cookies: { refresh_token: 'test-refresh-cookie' },
        body: {},
      } as any;

      const token = getRefreshToken(mockRequest);
      expect(token).toBe('test-refresh-cookie');
    });

    it('should return token from body', () => {
      const mockRequest = {
        cookies: {},
        body: { refreshToken: 'test-refresh-body' },
      } as any;

      const token = getRefreshToken(mockRequest);
      expect(token).toBe('test-refresh-body');
    });

    it('should return null when no token', () => {
      const mockRequest = {
        cookies: {},
        body: {},
      } as any;

      const token = getRefreshToken(mockRequest);
      expect(token).toBeNull();
    });

    it('should prefer cookie token over body token', () => {
      const mockRequest = {
        cookies: { refresh_token: 'cookie-refresh' },
        body: { refreshToken: 'body-refresh' },
      } as any;

      const token = getRefreshToken(mockRequest);
      expect(token).toBe('cookie-refresh');
    });
  });
});
