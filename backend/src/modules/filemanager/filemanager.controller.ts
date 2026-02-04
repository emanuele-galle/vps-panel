import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { fileManagerService } from './filemanager.service';
import { AppError } from '../../utils/errors';
import { idSchema } from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const projectIdParamsSchema = z.object({
  projectId: idSchema,
});

export const fileManagerController = {
  /**
   * Get all FileBrowser instances
   */
  async getAllInstances(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const instances = await fileManagerService.getAllInstances();
      reply.send({
        success: true,
        data: instances,
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
          error: 'Failed to get FileBrowser instances',
        });
      }
    }
  },

  /**
   * Get FileBrowser instance for a specific project
   */
  async getInstance(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = projectIdParamsSchema.parse(request.params);
    const instance = await fileManagerService.getInstance(params.projectId);

    if (!instance) {
      throw new AppError(404, 'FileBrowser instance not found', 'INSTANCE_NOT_FOUND');
    }

    reply.send({
      success: true,
      data: instance,
    });
  },

  /**
   * Start FileBrowser for a project
   */
  async startFileBrowser(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = projectIdParamsSchema.parse(request.params);
    const instance = await fileManagerService.startFileBrowser(params.projectId);

    reply.send({
      success: true,
      message: 'FileBrowser started successfully',
      data: instance,
    });
  },

  /**
   * Stop FileBrowser for a project
   */
  async stopFileBrowser(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = projectIdParamsSchema.parse(request.params);
    await fileManagerService.stopFileBrowser(params.projectId);

    reply.send({
      success: true,
      message: 'FileBrowser stopped successfully',
    });
  },

  /**
   * Get System FileBrowser instance (Admin only)
   */
  async getSystemInstance(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const instance = await fileManagerService.getSystemInstance();
      reply.send({
        success: true,
        data: instance,
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
          error: 'Failed to get System FileBrowser',
        });
      }
    }
  },
};
