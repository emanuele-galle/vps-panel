import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller';
import { authenticate } from './jwt.middleware';
import { rateLimiters } from '../../middlewares/rate-limit.middleware';

export default async function authRoutes(app: FastifyInstance) {
  // Public routes with strict rate limiting
  // SECURITY: Public registration disabled - users can only be created by admins via /api/users or CLI
  // app.post('/register', authController.register.bind(authController));

  // Login - strict rate limit (5 attempts per 5 minutes, ban for 15 minutes)
  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login utente',
      description: 'Autentica un utente con email e password. Restituisce JWT token.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email utente' },
          password: { type: 'string', minLength: 8, description: 'Password utente (min 8 caratteri)' },
          rememberMe: { type: 'boolean', description: 'Mantieni sessione attiva più a lungo', default: false },
        },
      },
      response: {
        200: {
          description: 'Login effettuato con successo',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    role: { type: 'string', enum: ['ADMIN', 'SUPER_ADMIN'] },
                  },
                },
                accessToken: { type: 'string', description: 'JWT access token' },
              },
            },
          },
        },
        401: {
          description: 'Credenziali non valide',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INVALID_CREDENTIALS' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: rateLimiters.login,
    handler: authController.login.bind(authController),
  });

  // Refresh - standard auth rate limit
  app.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh token',
      description: 'Rinnova il token JWT usando il refresh token nei cookie',
      response: {
        200: {
          description: 'Token rinnovato',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: rateLimiters.auth,
    handler: authController.refresh.bind(authController),
  });

  // Protected routes
  app.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout utente',
      description: 'Effettua il logout e invalida la sessione corrente',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          description: 'Logout effettuato',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: authenticate,
    handler: authController.logout.bind(authController),
  });

  app.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Profilo utente corrente',
      description: 'Restituisce i dati dell\'utente autenticato',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      response: {
        200: {
          description: 'Dati utente',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string' },
                    isActive: { type: 'boolean' },
                    twoFactorEnabled: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: authenticate,
    handler: authController.me.bind(authController),
  });

  // 2FA routes
  app.post('/2fa/setup', {
    preHandler: authenticate,
    handler: authController.setup2FA.bind(authController),
  });

  app.post('/2fa/enable', {
    preHandler: authenticate,
    handler: authController.enable2FA.bind(authController),
  });

  app.post('/2fa/disable', {
    preHandler: authenticate,
    handler: authController.disable2FA.bind(authController),
  });

  // Password management
  app.put('/password', {
    preHandler: authenticate,
    handler: authController.updatePassword.bind(authController),
  });

  // User preferences
  app.get('/preferences', {
    preHandler: authenticate,
    handler: authController.getPreferences.bind(authController),
  });

  app.put('/preferences', {
    preHandler: authenticate,
    handler: authController.updatePreferences.bind(authController),
  });

  // Session management
  app.get('/sessions', {
    preHandler: authenticate,
    handler: authController.getSessions.bind(authController),
  });

  app.delete('/sessions/:id', {
    preHandler: authenticate,
    handler: authController.revokeSession.bind(authController),
  });

  app.delete('/sessions', {
    preHandler: authenticate,
    handler: authController.revokeAllOtherSessions.bind(authController),
  });
}
