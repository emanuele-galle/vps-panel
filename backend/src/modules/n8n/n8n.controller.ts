import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { n8nService } from './n8n.service';
import { idSchema } from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getLogsQuerySchema = z.object({
  tail: z.coerce.number().int().positive().max(5000).default(200),
});

const backupIdParamsSchema = z.object({
  id: idSchema,
});

const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  backupEnabled: z.boolean().optional(),
  backupSchedule: z.string().max(100).optional(),
  retentionDays: z.coerce.number().int().positive().max(365).optional(),
});

// ============================================
// CONTROLLER
// ============================================

export class N8nController {
  /**
   * GET /api/n8n/status - Get N8N status
   */
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const status = await n8nService.getStatus();
      return reply.send({ success: true, data: status });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/n8n/start - Start N8N
   */
  async start(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await n8nService.start();
      return reply.send({ success: true, data: result });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/n8n/stop - Stop N8N
   */
  async stop(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await n8nService.stop();
      return reply.send({ success: true, data: result });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/n8n/restart - Restart N8N
   */
  async restart(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await n8nService.restart();
      return reply.send({ success: true, data: result });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/n8n/logs - Get N8N logs
   */
  async getLogs(
    request: FastifyRequest<{ Querystring: { tail?: string } }>,
    reply: FastifyReply
  ) {
    // Validate query
    const query = getLogsQuerySchema.parse(request.query);
    const logs = await n8nService.getLogs(query.tail);
    return reply.send({ success: true, data: { logs } });
  }

  /**
   * GET /api/n8n/stats - Get N8N container stats
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await n8nService.getStats();
      return reply.send({ success: true, data: stats });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/n8n/workflows - Get N8N workflows
   */
  async getWorkflows(request: FastifyRequest, reply: FastifyReply) {
    try {
      const workflows = await n8nService.getWorkflows();
      return reply.send({ success: true, data: workflows });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/n8n/backup - Create N8N backup
   */
  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: 'Non autenticato',
        });
      }

      const result = await n8nService.createBackup(userId);
      return reply.send({ success: true, data: result });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/n8n/backups - List N8N backups
   */
  async listBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const backups = await n8nService.listBackups();
      return reply.send({
        success: true,
        data: backups.map((b) => ({
          ...b,
          size: Number(b.size),
        })),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/n8n/backups/:id/restore - Restore N8N from backup
   */
  async restoreBackup(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = backupIdParamsSchema.parse(request.params);
    const result = await n8nService.restoreBackup(params.id);
    return reply.send({ success: true, data: result });
  }

  /**
   * DELETE /api/n8n/backups/:id - Delete N8N backup
   */
  async deleteBackup(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = backupIdParamsSchema.parse(request.params);
    await n8nService.deleteBackup(params.id);
    return reply.send({
      success: true,
      message: 'Backup eliminato con successo',
    });
  }

  /**
   * GET /api/n8n/sso-token - Generate SSO token for N8N access
   */
  async getSsoToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user?.id || !user?.email) {
        return reply.status(401).send({
          success: false,
          message: 'Non autenticato',
        });
      }

      const result = await n8nService.generateSsoToken(user.id, user.email);
      return reply.send({ success: true, data: result });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/n8n/config - Get N8N configuration
   */
  async getConfig(request: FastifyRequest, reply: FastifyReply) {
    try {
      const configData = await n8nService.getConfig();
      return reply.send({ success: true, data: configData });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * PUT /api/n8n/config - Update N8N configuration
   */
  async updateConfig(
    request: FastifyRequest<{
      Body: {
        enabled?: boolean;
        autoStart?: boolean;
        backupEnabled?: boolean;
        backupSchedule?: string;
        retentionDays?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate body
    const body = updateConfigSchema.parse(request.body);
    const configData = await n8nService.updateConfig(body);
    return reply.send({ success: true, data: configData });
  }

  /**
   * POST /api/n8n/cleanup - Cleanup old backups
   */
  async cleanupBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const deletedCount = await n8nService.cleanupOldBackups();
      return reply.send({
        success: true,
        data: { deletedCount },
        message: `${deletedCount} backup eliminati`,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const n8nController = new N8nController();
