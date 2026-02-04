import { User, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../../services/prisma.service';
import bcrypt from 'bcrypt';
import { config } from '../../config/env';
import { AppError } from '../../utils/errors';
import { PasswordValidator } from '../../utils/password-validator';


interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
}

interface UserStats {
  total: number;
  admins: number;
  staff: number;
  active: number;
  inactive: number;
  with2FA: number;
}

class UsersService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<Omit<User, 'password' | 'twoFactorSecret'>[]> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return users;
    } catch (error) {
      throw new AppError(500, `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<Omit<User, 'password' | 'twoFactorSecret'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      throw new AppError(500, `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new user (admin only)
   */
  async createUser(data: CreateUserData): Promise<Omit<User, 'password' | 'twoFactorSecret'>> {
    try {
      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError(409, 'Email already in use');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new AppError(400, 'Invalid email format');
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(data.password);
      if (!passwordValidation.isValid) {
        throw new AppError(
          400,
          `Password validation failed: ${passwordValidation.errors.join(', ')}`
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          role: data.role || 'STAFF',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user (admin only)
   */
  async updateUser(
    id: string,
    data: UpdateUserData
  ): Promise<Omit<User, 'password' | 'twoFactorSecret'>> {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new AppError(404, 'User not found');
      }

      // If email is being updated, check if it's already in use
      if (data.email && data.email !== existingUser.email) {
        const emailInUse = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (emailInUse) {
          throw new AppError(409, 'Email already in use');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
          throw new AppError(400, 'Invalid email format');
        }
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          isActive: data.isActive,
          twoFactorEnabled: data.twoFactorEnabled,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(id: string, requestingUserId: string): Promise<void> {
    try {
      // Prevent self-deletion
      if (id === requestingUserId) {
        throw new AppError(400, 'Cannot delete your own account');
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change user password (admin only)
   */
  async changeUserPassword(id: string, newPassword: string): Promise<void> {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(
          400,
          `Password validation failed: ${passwordValidation.errors.join(', ')}`
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);

      // Update password
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(id: string): Promise<Omit<User, 'password' | 'twoFactorSecret'>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to toggle user status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const users = await prisma.user.findMany();

      const stats: UserStats = {
        total: users.length,
        admins: users.filter((u) => u.role === 'ADMIN').length,
        staff: users.filter((u) => u.role === 'STAFF').length,
        active: users.filter((u) => u.isActive).length,
        inactive: users.filter((u) => !u.isActive).length,
        with2FA: users.filter((u) => u.twoFactorEnabled).length,
      };

      return stats;
    } catch (error) {
      throw new AppError(500, `Failed to get user statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string): Promise<Omit<User, 'password' | 'twoFactorSecret'>[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          preferences: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return users;
    } catch (error) {
      throw new AppError(500, `Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const usersService = new UsersService();
