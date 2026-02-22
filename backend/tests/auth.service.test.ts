import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing AuthService
vi.mock('../src/services/prisma.service', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock config
vi.mock('../src/config/env', () => ({
  config: {
    BCRYPT_ROUNDS: 10,
    JWT_SECRET: 'test-secret-key-minimum-32-characters-long',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
    NODE_ENV: 'test',
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock speakeasy
vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn().mockReturnValue({
      base32: 'MOCK_SECRET_BASE32',
      otpauth_url: 'otpauth://totp/test',
    }),
    totp: {
      verify: vi.fn().mockReturnValue(true),
    },
  },
  generateSecret: vi.fn().mockReturnValue({
    base32: 'MOCK_SECRET_BASE32',
    otpauth_url: 'otpauth://totp/test',
  }),
  totp: {
    verify: vi.fn().mockReturnValue(true),
  },
}));

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  },
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

import { AuthService } from '../src/modules/auth/auth.service';
import { prisma } from '../src/services/prisma.service';
import { UnauthorizedError, ConflictError, NotFoundError } from '../src/utils/errors';
import * as bcrypt from 'bcrypt';

const mockedPrisma = vi.mocked(prisma, true);
const mockedBcrypt = vi.mocked(bcrypt, true);

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  describe('register', () => {
    it('should create user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      const createdUser = {
        id: 'user-1',
        email: userData.email,
        name: userData.name,
        role: 'STAFF',
        isActive: true,
        twoFactorEnabled: false,
        createdAt: new Date(),
      };

      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue(createdUser as any);

      const result = await authService.register(userData);

      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          name: userData.name,
          password: 'hashed-password',
          role: 'STAFF',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(createdUser);
    });

    it('should throw ConflictError if email exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Existing User',
        password: 'hashed',
        role: 'STAFF',
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        preferences: null,
        createdAt: new Date(),
        lastLoginAt: null,
      };

      mockedPrisma.user.findUnique.mockResolvedValue(existingUser as any);

      await expect(
        authService.register({
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        })
      ).rejects.toThrow(ConflictError);

      expect(mockedPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed-password',
      role: 'STAFF',
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      preferences: null,
      createdAt: new Date(),
      lastLoginAt: null,
    };

    it('should return user for valid credentials', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedPrisma.user.update.mockResolvedValue(mockUser as any);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.requiresTwoFactor).toBe(false);
      expect(result.user).toBeDefined();
      expect((result as any).user.email).toBe('test@example.com');
      // Should not contain password or twoFactorSecret
      expect((result as any).user.password).toBeUndefined();
      expect((result as any).user.twoFactorSecret).toBeUndefined();
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedError for invalid email', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockedPrisma.user.findUnique.mockResolvedValue(inactiveUser as any);

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should return requiresTwoFactor when 2FA enabled without code', async () => {
      const user2FA = {
        ...mockUser,
        twoFactorEnabled: true,
        twoFactorSecret: 'MOCK_SECRET_BASE32',
      };
      mockedPrisma.user.findUnique.mockResolvedValue(user2FA as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.requiresTwoFactor).toBe(true);
      expect((result as any).userId).toBe('user-1');
      expect((result as any).user).toBeUndefined();
    });
  });

  describe('verifySession', () => {
    it('should return session for valid token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDate,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'STAFF',
          isActive: true,
          twoFactorEnabled: false,
        },
      };

      mockedPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const result = await authService.verifySession('valid-token');

      expect(result).toEqual(mockSession);
      expect(mockedPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              twoFactorEnabled: true,
            },
          },
        },
      });
    });

    it('should throw for expired session', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: pastDate,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'STAFF',
          isActive: true,
          twoFactorEnabled: false,
        },
      };

      mockedPrisma.session.findUnique.mockResolvedValue(expiredSession as any);

      await expect(
        authService.verifySession('expired-token')
      ).rejects.toThrow(UnauthorizedError);

      // Should delete the expired session
      expect(mockedPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      mockedPrisma.session.deleteMany.mockResolvedValue({ count: 5 } as any);

      const result = await authService.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('updatePassword', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'old-hashed-password',
      role: 'STAFF',
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      preferences: null,
      createdAt: new Date(),
      lastLoginAt: null,
    };

    it('should hash new password and delete all sessions', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
      mockedPrisma.user.update.mockResolvedValue(mockUser as any);
      mockedPrisma.session.deleteMany.mockResolvedValue({ count: 3 } as any);

      const result = await authService.updatePassword(
        'user-1',
        'oldPassword',
        'newPassword'
      );

      expect(result).toEqual({ success: true });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'oldPassword',
        mockUser.password
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword', 10);
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hashed-password' },
      });
      expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should throw if current password is wrong', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        authService.updatePassword('user-1', 'wrongPassword', 'newPassword')
      ).rejects.toThrow(UnauthorizedError);

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
      expect(mockedPrisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });
});
