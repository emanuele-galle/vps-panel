import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { deployService } from './deploy.service';
import { projectsService } from './projects.service';
import { UserRole } from '@prisma/client';

export class DeployController {
  /**
   * POST /api/projects/:id/deploy
   */
  async startDeploy(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { branch } = (request.body as { branch?: string }) || {};

    // Check project access
    const hasAccess = await projectsService.canAccessProject(id, userId, role as UserRole);
    if (!hasAccess) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Progetto non trovato' } });
    }

    try {
      const deployment = await deployService.startDeploy(id, userId, branch);
      return reply.status(201).send({ success: true, data: deployment });
    } catch (error: any) {
      return reply.status(409).send({ success: false, error: { code: 'DEPLOY_CONFLICT', message: error.message } });
    }
  }

  /**
   * GET /api/projects/:id/deployments
   */
  async getDeployments(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { limit, offset } = request.query as { limit?: string; offset?: string };

    const hasAccess = await projectsService.canAccessProject(id, userId, role as UserRole);
    if (!hasAccess) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Progetto non trovato' } });
    }

    const result = await deployService.getDeployments(id, Number(limit) || 20, Number(offset) || 0);
    return reply.send({ success: true, data: result });
  }

  /**
   * GET /api/projects/:id/deployments/latest
   */
  async getLatestDeployment(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const hasAccess = await projectsService.canAccessProject(id, userId, role as UserRole);
    if (!hasAccess) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Progetto non trovato' } });
    }

    const deployment = await deployService.getLatestDeployment(id);
    return reply.send({ success: true, data: deployment });
  }
}

export const deployController = new DeployController();
