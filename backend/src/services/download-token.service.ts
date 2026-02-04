/**
 * Download Token Service
 *
 * Provides secure, short-lived, single-use tokens for file downloads.
 * This prevents JWT tokens from being exposed in URLs/logs while still
 * allowing authenticated file downloads via direct links.
 */

import crypto from 'crypto';
import { prisma } from './prisma.service';

interface DownloadTokenPayload {
  userId: string;
  resourceType: 'backup' | 'file' | 'export';
  resourceId: string;
  filePath: string;
}

interface GeneratedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Default token expiration in milliseconds (5 minutes)
 */
const DEFAULT_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Token length in bytes (will be hex encoded to 64 chars)
 */
const TOKEN_LENGTH = 32;

export class DownloadTokenService {
  /**
   * Generate a secure, short-lived download token
   *
   * @param payload - Token payload with resource information
   * @param expiresInMs - Token expiration in milliseconds (default: 5 minutes)
   * @returns Generated token and expiration date
   */
  async generateToken(
    payload: DownloadTokenPayload,
    expiresInMs: number = DEFAULT_EXPIRATION_MS
  ): Promise<GeneratedToken> {
    // Generate cryptographically secure random token
    const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex');

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Store token in database
    await prisma.downloadToken.create({
      data: {
        token,
        userId: payload.userId,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        filePath: payload.filePath,
        expiresAt,
        used: false,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validate and consume a download token
   *
   * @param token - The token to validate
   * @param allowMultipleUse - If true, don't mark token as used (for large files like backups)
   * @returns The token payload if valid, null otherwise
   */
  async validateAndConsumeToken(
    token: string,
    allowMultipleUse: boolean = false
  ): Promise<DownloadTokenPayload | null> {
    // Input validation
    if (!token || typeof token !== 'string' || token.length !== TOKEN_LENGTH * 2) {
      return null;
    }

    // Use transaction to atomically check and mark as used
    const result = await prisma.$transaction(async (tx) => {
      // Find the token
      const downloadToken = await tx.downloadToken.findUnique({
        where: { token },
      });

      // Check if token exists
      if (!downloadToken) {
        return null;
      }

      // For backup tokens, allow multiple use (for resume/retry of large file downloads)
      const isBackupToken = downloadToken.resourceType === 'backup';

      // Check if token is already used (single-use protection) - skip for backups
      if (downloadToken.used && !isBackupToken) {
        return null;
      }

      // Check if token is expired
      if (downloadToken.expiresAt < new Date()) {
        // Clean up expired token
        await tx.downloadToken.delete({ where: { token } });
        return null;
      }

      // Mark token as used (only if not already used and not allowing multiple use)
      if (!downloadToken.used && !allowMultipleUse && !isBackupToken) {
        await tx.downloadToken.update({
          where: { token },
          data: { used: true, usedAt: new Date() },
        });
      }

      return {
        userId: downloadToken.userId,
        resourceType: downloadToken.resourceType as DownloadTokenPayload['resourceType'],
        resourceId: downloadToken.resourceId,
        filePath: downloadToken.filePath,
      };
    });

    return result;
  }

  /**
   * Clean up expired tokens
   * Should be run periodically (e.g., every hour)
   *
   * @returns Number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.downloadToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          // Also delete used tokens older than 1 hour
          {
            used: true,
            usedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }
          },
        ],
      },
    });

    return result.count;
  }

  /**
   * Revoke all tokens for a specific user
   * (e.g., on logout or password change)
   *
   * @param userId - User ID whose tokens should be revoked
   * @returns Number of tokens revoked
   */
  async revokeUserTokens(userId: string): Promise<number> {
    const result = await prisma.downloadToken.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Revoke all tokens for a specific resource
   * (e.g., when a backup is deleted)
   *
   * @param resourceType - Type of resource
   * @param resourceId - ID of the resource
   * @returns Number of tokens revoked
   */
  async revokeResourceTokens(
    resourceType: DownloadTokenPayload['resourceType'],
    resourceId: string
  ): Promise<number> {
    const result = await prisma.downloadToken.deleteMany({
      where: { resourceType, resourceId },
    });

    return result.count;
  }
}

export const downloadTokenService = new DownloadTokenService();
