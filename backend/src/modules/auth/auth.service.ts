import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { prisma } from '../../services/prisma.service';
import { config } from '../../config/env';
import { UnauthorizedError, ConflictError, NotFoundError } from '../../utils/errors';

export class AuthService {

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    name: string;
    password: string;
  }) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
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

    return user;
  }


  /**
   * Login user
   */
  async login(email: string, password: string, twoFactorCode?: string) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return {
          requiresTwoFactor: true,
          userId: user.id,
        };
      }

      const isValid = this.verify2FACode(user.twoFactorSecret!, twoFactorCode);

      if (!isValid) {
        throw new UnauthorizedError('Invalid 2FA code');
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Return user without password
    const { password: _, twoFactorSecret: __, ...userWithoutSensitive } = user;

    return {
      requiresTwoFactor: false,
      user: userWithoutSensitive,
    };
  }


  /**
   * Create session for user
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create session
    const session = await prisma.session.create({
      data: {
        userId,
        token: this.generateToken(),
        refreshToken: this.generateToken(),
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return session;
  }


  /**
   * Verify session token
   */
  async verifySession(token: string) {
    const session = await prisma.session.findUnique({
      where: { token },
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

    if (!session) {
      throw new UnauthorizedError('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      // Delete expired session
      await prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedError('Session expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    return session;
  }


  /**
   * Refresh session
   */
  async refreshSession(refreshToken: string) {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
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

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedError('Session expired');
    }

    // Generate new tokens
    const newToken = this.generateToken();
    const newRefreshToken = this.generateToken();

    // Update session with new tokens
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
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

    return updatedSession;
  }


  /**
   * Logout (delete session by token)
   * @deprecated Use logoutBySessionId instead
   */
  async logout(token: string) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  /**
   * Logout by session ID (preferred method)
   */
  async logoutBySessionId(sessionId: string) {
    await prisma.session.deleteMany({
      where: { id: sessionId },
    });
  }


  /**
   * Setup 2FA for user
   */
  async setup2FA(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `VPS Panel (${user.email})`,
      issuer: 'VPS Control Panel',
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Save secret (not yet enabled)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    return {
      secret: secret.base32,
      qrCode,
    };
  }


  /**
   * Enable 2FA for user
   */
  async enable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new NotFoundError('2FA not set up');
    }

    // Verify code
    const isValid = this.verify2FACode(user.twoFactorSecret, code);

    if (!isValid) {
      throw new UnauthorizedError('Invalid 2FA code');
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    return { success: true };
  }


  /**
   * Disable 2FA for user
   */
  async disable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new NotFoundError('2FA not enabled');
    }

    // Verify code
    const isValid = this.verify2FACode(user.twoFactorSecret!, code);

    if (!isValid) {
      throw new UnauthorizedError('Invalid 2FA code');
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { success: true };
  }


  /**
   * Verify 2FA code
   */
  private verify2FACode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps before/after
    });
  }


  /**
   * Generate random token
   */
  private generateToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }


  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }


  /**
   * Update user password
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    return { success: true };
  }


  /**
   * Update user profile (name and email)
   */
  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // If email is being changed, check for duplicates
    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new ConflictError('Email already in use');
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return updated;
  }


  /**
   * Get user preferences
   */
  async getPreferences(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Default preferences
    const defaultPreferences = {
      theme: 'system',
      language: 'it',
      notifications: {
        email: true,
        push: false,
        systemAlerts: true,
        projectUpdates: true,
      },
      dashboard: {
        autoRefresh: true,
        refreshInterval: 30,
        compactView: false,
      },
    };

    // Merge with stored preferences
    return user.preferences ? { ...defaultPreferences, ...(user.preferences as object) } : defaultPreferences;
  }


  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get current preferences and merge
    const currentPreferences = (user.preferences as Record<string, any>) || {};
    const mergedPreferences = {
      ...currentPreferences,
      ...preferences,
      notifications: {
        ...(currentPreferences.notifications || {}),
        ...(preferences.notifications || {}),
      },
      dashboard: {
        ...(currentPreferences.dashboard || {}),
        ...(preferences.dashboard || {}),
      },
    };

    // Update preferences
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: mergedPreferences },
    });

    return mergedPreferences;
  }


  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    // Mark current session
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }


  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string, currentSessionId: string) {
    // Prevent revoking current session
    if (sessionId === currentSessionId) {
      throw new ConflictError('Cannot revoke current session. Use logout instead.');
    }

    // Check session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Delete session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    return { success: true };
  }


  /**
   * Revoke all sessions except current
   */
  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    const result = await prisma.session.deleteMany({
      where: {
        userId,
        id: { not: currentSessionId },
      },
    });

    return {
      success: true,
      revokedCount: result.count,
    };
  }


  /**
   * Cleanup expired sessions (called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

}

export const authService = new AuthService();
