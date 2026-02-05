import { prisma } from '../../services/prisma.service';
import { ProjectMemberRole, UserRole } from '@prisma/client';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';

type CanAccessProjectFn = (projectId: string, userId: string, userRole: UserRole) => Promise<boolean>;
type InvalidateAccessCacheFn = (userId: string) => Promise<void>;

export class ProjectsMembersService {
  constructor(
    private readonly canAccessProject: CanAccessProjectFn,
    private readonly invalidateAccessCache: InvalidateAccessCacheFn
  ) {}

  /**
   * Add a member to a project (Admin only)
   */
  async addProjectMember(
    projectId: string,
    memberId: string,
    role: ProjectMemberRole = 'MEMBER',
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    // Only admins can add members
    if (requestingUserRole !== 'ADMIN') {
      throw new ForbiddenError('Only admins can add members to projects');
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: memberId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId
        }
      }
    });

    if (existingMember) {
      throw new ConflictError('User is already a member of this project');
    }

    // Add member
    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: memberId,
        role
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Invalidate the new member's cache
    await this.invalidateAccessCache(memberId);

    return newMember;
  }

  /**
   * Remove a member from a project (Admin only)
   */
  async removeProjectMember(
    projectId: string,
    memberId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    // Only admins can remove members
    if (requestingUserRole !== 'ADMIN') {
      throw new ForbiddenError('Only admins can remove members from projects');
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId
        }
      }
    });

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    const deleted = await prisma.projectMember.delete({
      where: { id: member.id }
    });

    // Invalidate the removed member's cache
    await this.invalidateAccessCache(memberId);

    return deleted;
  }

  /**
   * Update member role in a project (Admin only)
   */
  async updateProjectMemberRole(
    projectId: string,
    memberId: string,
    newRole: ProjectMemberRole,
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    // Only admins can update roles
    if (requestingUserRole !== 'ADMIN') {
      throw new ForbiddenError('Only admins can update member roles');
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId
        }
      }
    });

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    return prisma.projectMember.update({
      where: { id: member.id },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  /**
   * Get all members of a project
   */
  async getProjectMembers(projectId: string, userId: string, userRole: UserRole) {
    // Check access
    const hasAccess = await this.canAccessProject(projectId, userId, userRole);
    if (!hasAccess) {
      throw new NotFoundError('Project not found');
    }

    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Get all staff users that can be added to projects (Admin only)
   */
  async getAvailableStaffForProject(projectId: string, requestingUserRole: UserRole) {
    if (requestingUserRole !== 'ADMIN') {
      throw new ForbiddenError('Only admins can view available staff');
    }

    // Get all staff users not already in this project
    const existingMembers = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true }
    });

    const memberIds = existingMembers.map(m => m.userId);

    // Get project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true }
    });

    if (project) {
      memberIds.push(project.userId);
    }

    return prisma.user.findMany({
      where: {
        role: 'STAFF',
        isActive: true,
        id: { notIn: memberIds }
      },
      select: { id: true, name: true, email: true }
    });
  }
}
