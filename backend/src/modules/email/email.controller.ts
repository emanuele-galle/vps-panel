import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { emailService } from './email.service';
import { AppError } from '../../utils/errors';
import {
  idSchema,
  emailSchema,
  simplePasswordSchema,
  nameSchema,
  safeStringSchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const emailIdParamsSchema = z.object({
  id: idSchema,
});

const createEmailSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  quota: z.coerce.number().int().positive().max(100000).optional(),
  clientName: nameSchema.optional(),
  notes: safeStringSchema.optional(),
});

const updateEmailSchema = z.object({
  quota: z.coerce.number().int().positive().max(100000).optional(),
  forwardTo: emailSchema.optional(),
  autoReply: z.boolean().optional(),
  autoReplyMsg: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
  clientName: nameSchema.optional(),
  notes: safeStringSchema.optional(),
});

const changePasswordSchema = z.object({
  newPassword: simplePasswordSchema,
});

export const emailController = {
  /**
   * Get all email accounts
   */
  async getAllEmails(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const accounts = await emailService.getAllEmailAccounts();
      reply.send({
        success: true,
        data: accounts,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to fetch email accounts',
        });
      }
    }
  },

  /**
   * Get email account by ID
   */
  async getEmailById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = emailIdParamsSchema.parse(request.params);
    const account = await emailService.getEmailAccountById(params.id);

    reply.send({
      success: true,
      data: account,
    });
  },

  /**
   * Create new email account
   */
  async createEmail(
    request: FastifyRequest<{
      Body: {
        email: string;
        password: string;
        quota?: number;
        clientName?: string;
        notes?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate body with Zod (handles all validation)
    const data = createEmailSchema.parse(request.body);

    // Check if email already exists
    const existing = await emailService.getEmailAccountByEmail(data.email);
    if (existing) {
      throw new AppError(409, 'Email account already exists', 'EMAIL_EXISTS');
    }

    const account = await emailService.createEmailAccount(data as { email: string; password: string; clientName?: string; notes?: string; quota?: number });

    reply.code(201).send({
      success: true,
      message: 'Email account created successfully',
      data: account,
    });
  },

  /**
   * Update email account
   */
  async updateEmail(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        quota?: number;
        forwardTo?: string;
        autoReply?: boolean;
        autoReplyMsg?: string;
        isActive?: boolean;
        clientName?: string;
        notes?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and body
    const params = emailIdParamsSchema.parse(request.params);
    const data = updateEmailSchema.parse(request.body);

    const account = await emailService.updateEmailAccount(params.id, data);

    reply.send({
      success: true,
      message: 'Email account updated successfully',
      data: account,
    });
  },

  /**
   * Delete email account
   */
  async deleteEmail(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = emailIdParamsSchema.parse(request.params);
    await emailService.deleteEmailAccount(params.id);

    reply.send({
      success: true,
      message: 'Email account deleted successfully',
    });
  },

  /**
   * Change email password
   */
  async changePassword(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { newPassword: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and body
    const params = emailIdParamsSchema.parse(request.params);
    const body = changePasswordSchema.parse(request.body);

    await emailService.changePassword(params.id, body.newPassword);

    reply.send({
      success: true,
      message: 'Password changed successfully',
    });
  },

  /**
   * Sync email accounts from Hostinger
   */
  async syncFromHostinger(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await emailService.syncFromHostinger();

      reply.send({
        success: true,
        synced: result.synced,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to sync email accounts',
        });
      }
    }
  },

  /**
   * Get email statistics
   */
  async getEmailStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const stats = await emailService.getEmailStats();

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          success: false,
          error: error.message,
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to fetch email statistics',
        });
      }
    }
  },
};
