import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available before vi.mock hoisting
const { mockCreate, mockFindUnique, mockUpdate, mockDelete, mockDeleteMany, mockTransaction } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('../../src/services/prisma.service', () => ({
  prisma: {
    downloadToken: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
      deleteMany: mockDeleteMany,
    },
    $transaction: mockTransaction,
  },
}));

// Import after mock
import { downloadTokenService } from '../../src/services/download-token.service';

describe('DownloadTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateToken', () => {
    it('should generate a 64-character hex token', async () => {
      mockCreate.mockResolvedValue({ token: 'mock-token' });

      const result = await downloadTokenService.generateToken({
        userId: 'user-123',
        resourceType: 'backup',
        resourceId: 'backup-456',
        filePath: '/var/backups/backup.tar.gz',
      });

      expect(result.token).toHaveLength(64);
      expect(result.token).toMatch(/^[a-f0-9]+$/);
    });

    it('should create token with default 5-minute expiration', async () => {
      mockCreate.mockResolvedValue({ token: 'mock-token' });

      const result = await downloadTokenService.generateToken({
        userId: 'user-123',
        resourceType: 'backup',
        resourceId: 'backup-456',
        filePath: '/var/backups/backup.tar.gz',
      });

      // Default expiration is 5 minutes
      const expectedExpiration = new Date('2025-01-15T10:05:00Z');
      expect(result.expiresAt.getTime()).toBe(expectedExpiration.getTime());
    });

    it('should create token with custom expiration', async () => {
      mockCreate.mockResolvedValue({ token: 'mock-token' });

      const customExpiration = 10 * 60 * 1000; // 10 minutes
      const result = await downloadTokenService.generateToken(
        {
          userId: 'user-123',
          resourceType: 'backup',
          resourceId: 'backup-456',
          filePath: '/var/backups/backup.tar.gz',
        },
        customExpiration
      );

      const expectedExpiration = new Date('2025-01-15T10:10:00Z');
      expect(result.expiresAt.getTime()).toBe(expectedExpiration.getTime());
    });

    it('should store token in database with correct data', async () => {
      mockCreate.mockResolvedValue({ token: 'mock-token' });

      await downloadTokenService.generateToken({
        userId: 'user-123',
        resourceType: 'backup',
        resourceId: 'backup-456',
        filePath: '/var/backups/backup.tar.gz',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          resourceType: 'backup',
          resourceId: 'backup-456',
          filePath: '/var/backups/backup.tar.gz',
          used: false,
        }),
      });
    });
  });

  describe('validateAndConsumeToken', () => {
    it('should return null for invalid token format (wrong length)', async () => {
      const result = await downloadTokenService.validateAndConsumeToken('short');
      expect(result).toBeNull();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should return null for empty token', async () => {
      const result = await downloadTokenService.validateAndConsumeToken('');
      expect(result).toBeNull();
    });

    it('should return null for null token', async () => {
      const result = await downloadTokenService.validateAndConsumeToken(null as any);
      expect(result).toBeNull();
    });

    it('should return null if token does not exist', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          downloadToken: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        });
      });

      const validToken = 'a'.repeat(64);
      const result = await downloadTokenService.validateAndConsumeToken(validToken);
      expect(result).toBeNull();
    });

    it('should return null if token is already used', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          downloadToken: {
            findUnique: vi.fn().mockResolvedValue({
              token: 'a'.repeat(64),
              used: true,
              expiresAt: new Date('2025-01-15T11:00:00Z'),
            }),
          },
        });
      });

      const result = await downloadTokenService.validateAndConsumeToken('a'.repeat(64));
      expect(result).toBeNull();
    });

    it('should return null and delete if token is expired', async () => {
      const localMockDelete = vi.fn();
      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          downloadToken: {
            findUnique: vi.fn().mockResolvedValue({
              token: 'a'.repeat(64),
              used: false,
              expiresAt: new Date('2025-01-15T09:00:00Z'), // Expired (before current time)
            }),
            delete: localMockDelete,
          },
        });
      });

      const result = await downloadTokenService.validateAndConsumeToken('a'.repeat(64));
      expect(result).toBeNull();
      expect(localMockDelete).toHaveBeenCalledWith({ where: { token: 'a'.repeat(64) } });
    });

    it('should return payload and mark token as used for valid token', async () => {
      const localMockUpdate = vi.fn();
      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          downloadToken: {
            findUnique: vi.fn().mockResolvedValue({
              token: 'a'.repeat(64),
              userId: 'user-123',
              resourceType: 'backup',
              resourceId: 'backup-456',
              filePath: '/var/backups/backup.tar.gz',
              used: false,
              expiresAt: new Date('2025-01-15T11:00:00Z'), // Valid (after current time)
            }),
            update: localMockUpdate,
          },
        });
      });

      const result = await downloadTokenService.validateAndConsumeToken('a'.repeat(64));

      expect(result).toEqual({
        userId: 'user-123',
        resourceType: 'backup',
        resourceId: 'backup-456',
        filePath: '/var/backups/backup.tar.gz',
      });

      expect(localMockUpdate).toHaveBeenCalledWith({
        where: { token: 'a'.repeat(64) },
        data: { used: true, usedAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and old used tokens', async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 });

      const result = await downloadTokenService.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            {
              used: true,
              usedAt: { lt: expect.any(Date) },
            },
          ],
        },
      });
    });
  });

  describe('revokeUserTokens', () => {
    it('should delete all tokens for a specific user', async () => {
      mockDeleteMany.mockResolvedValue({ count: 3 });

      const result = await downloadTokenService.revokeUserTokens('user-123');

      expect(result).toBe(3);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('revokeResourceTokens', () => {
    it('should delete all tokens for a specific resource', async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 });

      const result = await downloadTokenService.revokeResourceTokens('backup', 'backup-456');

      expect(result).toBe(2);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { resourceType: 'backup', resourceId: 'backup-456' },
      });
    });
  });
});

describe('Security: Download Token Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate cryptographically secure tokens', async () => {
    mockCreate.mockResolvedValue({ token: 'mock' });

    // Generate multiple tokens and verify they are unique
    const tokens = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = await downloadTokenService.generateToken({
        userId: 'user-123',
        resourceType: 'backup',
        resourceId: 'backup-456',
        filePath: '/var/backups/backup.tar.gz',
      });
      tokens.add(result.token);
    }

    // All tokens should be unique
    expect(tokens.size).toBe(10);
  });

  it('should prevent token reuse (single-use)', async () => {
    // This is tested in validateAndConsumeToken tests above
    // Token marked as used returns null on second attempt
  });

  it('should enforce expiration time', async () => {
    // This is tested in validateAndConsumeToken tests above
    // Expired tokens return null and are deleted
  });
});
