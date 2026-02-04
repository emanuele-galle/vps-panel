import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { usersService } from './users.service';
import { AppError } from '../../utils/errors';
import {
  idSchema,
  emailSchema,
  passwordSchema,
  nameSchema,
  userRoleSchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const userIdParamsSchema = z.object({
  id: idSchema,
});

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: userRoleSchema.default('STAFF'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

const updateUserSchema = z.object({
  email: emailSchema.optional(),
  name: nameSchema.optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  newPassword: passwordSchema,
});

const searchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long')
    .transform((val) => val.trim()),
});

// ============================================
// CONTROLLER
// ============================================

export const usersController = {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const users = await usersService.getAllUsers();
    reply.send({
      success: true,
      data: users,
    });
  },

  /**
   * Get user by ID (admin only)
   */
  async getUserById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = userIdParamsSchema.parse(request.params);

    const user = await usersService.getUserById(params.id);

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    reply.send({
      success: true,
      data: user,
    });
  },

  /**
   * Create new user (admin only)
   */
  async createUser(
    request: FastifyRequest<{
      Body: {
        email: string;
        password: string;
        name: string;
        role?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate body with Zod
    const data = createUserSchema.parse(request.body) as CreateUserInput;

    const user = await usersService.createUser({
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
    });

    reply.code(201).send({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  },

  /**
   * Update user (admin only)
   */
  async updateUser(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        email?: string;
        name?: string;
        role?: string;
        isActive?: boolean;
        twoFactorEnabled?: boolean;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and body
    const params = userIdParamsSchema.parse(request.params);
    const data = updateUserSchema.parse(request.body);

    const user = await usersService.updateUser(params.id, data);

    reply.send({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  },

  /**
   * Delete user (admin only)
   */
  async deleteUser(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = userIdParamsSchema.parse(request.params);
    const requestingUserId = (request.user as JwtPayload).userId;

    await usersService.deleteUser(params.id, requestingUserId);

    reply.send({
      success: true,
      message: 'User deleted successfully',
    });
  },

  /**
   * Change user password (admin only)
   */
  async changeUserPassword(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { newPassword: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params and body
    const params = userIdParamsSchema.parse(request.params);
    const body = changePasswordSchema.parse(request.body);

    await usersService.changeUserPassword(params.id, body.newPassword);

    reply.send({
      success: true,
      message: 'Password changed successfully',
    });
  },

  /**
   * Toggle user status (admin only)
   */
  async toggleUserStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate params
    const params = userIdParamsSchema.parse(request.params);

    const user = await usersService.toggleUserStatus(params.id);

    reply.send({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    });
  },

  /**
   * Get user statistics (admin only)
   */
  async getUserStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const stats = await usersService.getUserStats();

    reply.send({
      success: true,
      data: stats,
    });
  },

  /**
   * Search users (admin only)
   */
  async searchUsers(
    request: FastifyRequest<{ Querystring: { q: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validate query
    const query = searchQuerySchema.parse(request.query);

    const users = await usersService.searchUsers(query.q);

    reply.send({
      success: true,
      data: users,
    });
  },
};
