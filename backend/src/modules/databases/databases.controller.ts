import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { databasesService } from './databases.service';
import { AppError } from '../../utils/errors';
import {
  idSchema,
  databaseTypeSchema,
  nameSchema,
  simplePasswordSchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getDatabasesQuerySchema = z.object({
  projectId: idSchema.optional(),
  type: databaseTypeSchema.optional(),
});

const getDatabaseParamsSchema = z.object({
  id: idSchema,
});

const createDatabaseSchema = z.object({
  name: nameSchema,
  type: databaseTypeSchema,
  projectId: idSchema,
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be less than 32 characters')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Username must start with a letter and contain only letters, numbers, and underscores')
    .optional(),
  password: simplePasswordSchema.optional(),
});

const updateDatabaseSchema = z.object({
  password: simplePasswordSchema.optional(),
});

// ============================================
// CONTROLLER
// ============================================

class DatabasesController {
  /**
   * Get all databases
   * GET /api/databases
   * Filtered by user access: STAFF only see databases from assigned projects
   */
  async getDatabases(
    request: FastifyRequest<{
      Querystring: { projectId?: string; type?: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate query parameters
    const query = getDatabasesQuerySchema.parse(request.query);

    const user = request.user as JwtPayload | undefined;
    const filters: { projectId?: string; type?: import('@prisma/client').DatabaseType } = {};

    if (query.projectId) {
      filters.projectId = query.projectId;
    }

    if (query.type) {
      filters.type = query.type as import('@prisma/client').DatabaseType;
    }

    const databases = await databasesService.getDatabases(filters, user?.userId, user?.role);

    return reply.send({
      success: true,
      data: databases,
    });
  }

  /**
   * Get database by ID
   * GET /api/databases/:id
   */
  async getDatabase(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = getDatabaseParamsSchema.parse(request.params);

    const database = await databasesService.getDatabaseById(params.id);

    if (!database) {
      throw new AppError(404, 'Database not found', 'DATABASE_NOT_FOUND');
    }

    return reply.send({
      success: true,
      data: database,
    });
  }

  /**
   * Create new database
   * POST /api/databases
   */
  async createDatabase(
    request: FastifyRequest<{
      Body: {
        name: string;
        type: string;
        projectId: string;
        username?: string;
        password?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate body
    const body = createDatabaseSchema.parse(request.body);

    const database = await databasesService.createDatabase({
      name: body.name,
      type: body.type,
      projectId: body.projectId,
      username: body.username,
      password: body.password,
    });

    return reply.status(201).send({
      success: true,
      data: database,
    });
  }

  /**
   * Update database
   * PUT /api/databases/:id
   */
  async updateDatabase(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        password?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate params and body
    const params = getDatabaseParamsSchema.parse(request.params);
    const body = updateDatabaseSchema.parse(request.body);

    const database = await databasesService.updateDatabase(params.id, {
      password: body.password,
    });

    return reply.send({
      success: true,
      data: database,
    });
  }

  /**
   * Delete database
   * DELETE /api/databases/:id
   */
  async deleteDatabase(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = getDatabaseParamsSchema.parse(request.params);

    await databasesService.deleteDatabase(params.id);

    return reply.send({
      success: true,
      data: { message: 'Database deleted successfully' },
    });
  }

  /**
   * Get connection string
   * GET /api/databases/:id/connection
   */
  async getConnectionString(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = getDatabaseParamsSchema.parse(request.params);

    const database = await databasesService.getDatabaseById(params.id);

    if (!database) {
      throw new AppError(404, 'Database not found', 'DATABASE_NOT_FOUND');
    }

    const connectionString = databasesService.getConnectionString(database);

    return reply.send({
      success: true,
      data: { connectionString },
    });
  }
}

export const databasesController = new DatabasesController();
