import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { dockerService } from './docker.service';
import {
  containerIdSchema,
  booleanQuerySchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const listContainersQuerySchema = z.object({
  all: booleanQuerySchema,
});

const containerIdParamsSchema = z.object({
  id: containerIdSchema,
});

const removeContainerQuerySchema = z.object({
  force: booleanQuerySchema,
});

const getLogsQuerySchema = z.object({
  tail: z.coerce.number()
    .int('Tail must be an integer')
    .min(1, 'Tail must be at least 1')
    .max(10000, 'Tail must be less than 10000')
    .optional()
    .default(100),
});

// ============================================
// CONTROLLER
// ============================================

class DockerController {
  /**
   * Get all containers
   * GET /api/docker/containers
   * Filtered by user role: STAFF users only see containers from assigned projects
   */
  async listContainers(
    request: FastifyRequest<{
      Querystring: { all?: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate query
    const query = listContainersQuerySchema.parse(request.query);
    const all = query.all ?? false;
    const user = request.user as JwtPayload | undefined;

    // Use filtered method if user info is available
    const containers = user?.role
      ? await dockerService.listContainersForUser(all, user.role, user.userId)
      : await dockerService.listContainers(all);

    return reply.send({
      success: true,
      data: containers,
    });
  }

  /**
   * Get container by ID
   * GET /api/docker/containers/:id
   */
  async getContainer(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    const container = await dockerService.getContainer(params.id);

    return reply.send({
      success: true,
      data: container,
    });
  }

  /**
   * Start container
   * POST /api/docker/containers/:id/start
   */
  async startContainer(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    await dockerService.startContainer(params.id);

    return reply.send({
      success: true,
      data: { message: 'Container started successfully' },
    });
  }

  /**
   * Stop container
   * POST /api/docker/containers/:id/stop
   */
  async stopContainer(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    await dockerService.stopContainer(params.id);

    return reply.send({
      success: true,
      data: { message: 'Container stopped successfully' },
    });
  }

  /**
   * Restart container
   * POST /api/docker/containers/:id/restart
   */
  async restartContainer(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    await dockerService.restartContainer(params.id);

    return reply.send({
      success: true,
      data: { message: 'Container restarted successfully' },
    });
  }

  /**
   * Remove container
   * DELETE /api/docker/containers/:id
   */
  async removeContainer(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { force?: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params and query
    const params = containerIdParamsSchema.parse(request.params);
    const query = removeContainerQuerySchema.parse(request.query);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    await dockerService.removeContainer(params.id, query.force ?? false);

    return reply.send({
      success: true,
      data: { message: 'Container removed successfully' },
    });
  }

  /**
   * Get container logs
   * GET /api/docker/containers/:id/logs
   */
  async getContainerLogs(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { tail?: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params and query
    const params = containerIdParamsSchema.parse(request.params);
    const query = getLogsQuerySchema.parse(request.query);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    const logs = await dockerService.getContainerLogs(params.id, query.tail);

    return reply.send({
      success: true,
      data: { logs },
    });
  }

  /**
   * Get container stats
   * GET /api/docker/containers/:id/stats
   */
  async getContainerStats(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = containerIdParamsSchema.parse(request.params);
    const user = request.user as JwtPayload | undefined;

    // Verify access for STAFF users
    if (user?.role) {
      await dockerService.verifyContainerAccess(params.id, user.role, user.userId);
    }

    const stats = await dockerService.getContainerStats(params.id);

    return reply.send({
      success: true,
      data: stats,
    });
  }

  /**
   * List networks
   * GET /api/docker/networks
   */
  async listNetworks(request: FastifyRequest, reply: FastifyReply) {
    const networks = await dockerService.listNetworks();

    return reply.send({
      success: true,
      data: networks,
    });
  }

  /**
   * List volumes
   * GET /api/docker/volumes
   */
  async listVolumes(request: FastifyRequest, reply: FastifyReply) {
    const volumes = await dockerService.listVolumes();

    return reply.send({
      success: true,
      data: volumes,
    });
  }

  /**
   * List images
   * GET /api/docker/images
   */
  async listImages(request: FastifyRequest, reply: FastifyReply) {
    const images = await dockerService.listImages();

    return reply.send({
      success: true,
      data: images,
    });
  }
}

export const dockerController = new DockerController();
