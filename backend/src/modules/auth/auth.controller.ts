import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { authService } from './auth.service';
import { ValidationError } from '../../utils/errors';
import { setAuthCookies, clearAuthCookies, getRefreshToken } from '../../utils/cookies';
import { setCsrfTokenCookie } from '../../middlewares/csrf.middleware';
import { securityAuditService } from '../../services/security-audit.service';
import { sanitizeForLog } from '../../utils/log-sanitizer';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

const verify2FASchema = z.object({
  code: z.string().length(6),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(5).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    systemAlerts: z.boolean().optional(),
    projectUpdates: z.boolean().optional(),
  }).optional(),
  dashboard: z.object({
    autoRefresh: z.boolean().optional(),
    refreshInterval: z.number().min(5).max(300).optional(),
    compactView: z.boolean().optional(),
  }).optional(),
});

export class AuthController {
  /**
   * POST /api/auth/register
   * DEPRECATED: Public registration is disabled for security.
   * This method is kept for internal use by admin user creation via /api/users
   * Route is commented out in auth.routes.ts
   */
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);

    const user = await authService.register({
      email: body.email,
      name: body.name,
      password: body.password,
    });

    // Create session
    const session = await authService.createSession(
      user.id,
      request.ip,
      request.headers['user-agent'] || 'unknown'
    );

    // Sign JWT token
    const token = await reply.jwtSign({ userId: user.id, sessionId: session.id, role: user.role });

    return reply.send({
      success: true,
      data: {
        user,
        token,
        refreshToken: session.refreshToken,
      },
    });
  }

  /**
   * POST /api/auth/login
   */
  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);

    try {
      const result = await authService.login(
        body.email,
        body.password,
        body.twoFactorCode
      );

      if (result.requiresTwoFactor) {
        return reply.send({
          success: true,
          data: {
            requiresTwoFactor: true,
          },
        });
      }

      // Create session
      const session = await authService.createSession(
        result.user!.id,
        request.ip,
        request.headers['user-agent'] || 'unknown'
      );

      // Sign JWT token
      const token = await reply.jwtSign({
        userId: result.user!.id,
        sessionId: session.id,
        role: result.user!.role,
      });

      // Log successful login
      await securityAuditService.logLoginSuccess(
        result.user!.id,
        request.ip,
        request.headers['user-agent']
      );

      // Structured logging for login success
      request.log.info({
        event: 'login_success',
        userId: result.user!.id,
        email: sanitizeForLog(result.user!.email),
        ip: request.ip || 'unknown',
        userAgent: request.headers['user-agent']?.substring(0, 100),
      }, 'User logged in successfully');

      // Set HttpOnly cookies for secure token storage
      setAuthCookies(reply, token, session.refreshToken!);

      // Set CSRF token cookie (not HttpOnly - JS needs to read it)
      const csrfToken = setCsrfTokenCookie(reply);

      return reply.send({
        success: true,
        data: {
          user: result.user,
          // Still include tokens in response for backwards compatibility
          // Frontend can choose to use cookies or store in memory
          token,
          refreshToken: session.refreshToken,
          csrfToken, // Include CSRF token for client-side use
        },
      });
    } catch (error) {
      // Log failed login attempt
      await securityAuditService.logLoginFailure(
        body.email,
        request.ip,
        request.headers['user-agent'] || 'unknown',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Structured logging for login failure
      request.log.warn({
        event: 'login_failed',
        email: sanitizeForLog(body.email),
        ip: request.ip || 'unknown',
        userAgent: request.headers['user-agent']?.substring(0, 100),
        reason: error instanceof Error ? error.message : 'unknown_error',
      }, 'Login attempt failed');

      throw error;
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(request: FastifyRequest, reply: FastifyReply) {
    // Get refresh token from cookie or body (backwards compatibility)
    const refreshToken = getRefreshToken(request);

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    try {
      const session = await authService.refreshSession(refreshToken);

      // Sign new JWT token
      const token = await reply.jwtSign({
        userId: session.userId,
        sessionId: session.id,
        role: session.user.role,
      });

      // Set new HttpOnly cookies
      setAuthCookies(reply, token, session.refreshToken!);

      // Security logging: Token refresh success
      await securityAuditService.logTokenRefresh(
        session.userId,
        request.ip,
        request.headers['user-agent'],
        true
      );

      return reply.send({
        success: true,
        data: {
          token,
          refreshToken: session.refreshToken,
        },
      });
    } catch (error) {
      // Security logging: Token refresh failure
      await securityAuditService.logTokenRefresh(
        'unknown',
        request.ip,
        request.headers['user-agent'],
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = request.user as JwtPayload;

    // Delete session directly by ID (not by token)
    await authService.logoutBySessionId(sessionId);

    // Clear HttpOnly cookies
    clearAuthCookies(reply);

    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * GET /api/auth/me
   */
  async me(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;

    const user = await authService.getUserById(userId);

    return reply.send({
      success: true,
      data: { user },
    });
  }

  /**
   * PUT /api/auth/profile
   */
  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = updateProfileSchema.parse(request.body);

    const user = await authService.updateProfile(userId, body);

    return reply.send({
      success: true,
      data: { user },
    });
  }

  /**
   * POST /api/auth/2fa/setup
   */
  async setup2FA(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;

    const result = await authService.setup2FA(userId);

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/auth/2fa/enable
   */
  async enable2FA(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = verify2FASchema.parse(request.body);

    const result = await authService.enable2FA(userId, body.code);

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/auth/2fa/disable
   */
  async disable2FA(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = verify2FASchema.parse(request.body);

    const result = await authService.disable2FA(userId, body.code);

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * PUT /api/auth/password
   */
  async updatePassword(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = updatePasswordSchema.parse(request.body);

    const result = await authService.updatePassword(
      userId,
      body.currentPassword,
      body.newPassword
    );

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/auth/preferences
   */
  async getPreferences(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;

    const preferences = await authService.getPreferences(userId);

    return reply.send({
      success: true,
      data: preferences,
    });
  }

  /**
   * PUT /api/auth/preferences
   */
  async updatePreferences(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = preferencesSchema.parse(request.body);

    const preferences = await authService.updatePreferences(userId, body);

    return reply.send({
      success: true,
      data: preferences,
    });
  }

  /**
   * GET /api/auth/sessions
   */
  async getSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId, sessionId } = request.user as JwtPayload;

    const sessions = await authService.getUserSessions(userId, sessionId);

    return reply.send({
      success: true,
      data: { sessions },
    });
  }

  /**
   * DELETE /api/auth/sessions/:id
   */
  async revokeSession(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { userId, sessionId: currentSessionId } = request.user as JwtPayload;
    const { id: sessionIdToRevoke } = request.params;

    const result = await authService.revokeSession(userId, sessionIdToRevoke, currentSessionId);

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * DELETE /api/auth/sessions
   */
  async revokeAllOtherSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId, sessionId: currentSessionId } = request.user as JwtPayload;

    const result = await authService.revokeAllOtherSessions(userId, currentSessionId);

    return reply.send({
      success: true,
      data: result,
    });
  }
}

export const authController = new AuthController();
