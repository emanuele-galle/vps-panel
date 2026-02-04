import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { projectsService } from './projects.service';
import { discoveryService } from './discovery.service';
import { ProjectTemplate, ProjectStatus, ProjectMemberRole, UserRole } from '@prisma/client';

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  template: z.nativeEnum(ProjectTemplate),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
});

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(ProjectMemberRole).optional().default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(ProjectMemberRole),
});

export class ProjectsController {
  /**
   * GET /api/projects
   */
  async getProjects(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { status, template } = request.query as {
      status?: ProjectStatus;
      template?: ProjectTemplate;
    };

    const projects = await projectsService.getProjects(userId, role, {
      status,
      template,
    });

    return reply.send({
      success: true,
      data: projects,
    });
  }

  /**
   * GET /api/projects/:id
   */
  async getProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const project = await projectsService.getProjectById(id, userId, role);

    return reply.send({
      success: true,
      data: project,
    });
  }

  /**
   * POST /api/projects
   */
  async createProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const body = createProjectSchema.parse(request.body);

    const project = await projectsService.createProject({
      name: body.name,
      slug: body.slug,
      template: body.template,
      description: body.description,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      userId,
    });

    return reply.status(201).send({
      success: true,
      data: project,
      message: 'Project created and deployed successfully',
    });
  }

  /**
   * PUT /api/projects/:id
   */
  async updateProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.parse(request.body);

    const project = await projectsService.updateProject(id, userId, body);

    return reply.send({
      success: true,
      data: project,
      message: 'Project updated successfully',
    });
  }

  /**
   * DELETE /api/projects/:id
   */
  async deleteProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await projectsService.deleteProject(id, userId, role);

    return reply.send({
      success: true,
      message: 'Project deleted successfully',
    });
  }

  /**
   * PUT /api/projects/:id/credentials
   */
  async updateCredentials(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const credentials = request.body as Record<string, unknown>;

    const project = await projectsService.updateProjectCredentials(id, userId, credentials);

    return reply.send({
      success: true,
      data: project,
      message: 'Credentials updated successfully',
    });
  }

  /**
   * POST /api/projects/:id/sync-credentials
   * Sync credentials from vps-credentials.json file in project root
   */
  async syncCredentials(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const result = await projectsService.syncCredentialsFromFile(id, userId, role);

    return reply.send({
      success: true,
      data: result,
      message: result.synced ? 'Credentials synced successfully' : result.reason,
    });
  }

  /**
   * POST /api/projects/:id/start
   */
  async startProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await projectsService.startProject(id, userId);

    return reply.send({
      success: true,
      message: 'Project started successfully',
    });
  }

  /**
   * POST /api/projects/:id/stop
   */
  async stopProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await projectsService.stopProject(id, userId);

    return reply.send({
      success: true,
      message: 'Project stopped successfully',
    });
  }

  /**
   * POST /api/projects/:id/restart
   */
  async restartProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await projectsService.restartProject(id, userId);

    return reply.send({
      success: true,
      message: 'Project restarted successfully',
    });
  }

  /**
   * GET /api/projects/:id/logs
   */
  async getProjectLogs(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { tail = 100 } = request.query as { tail?: number };

    const result = await projectsService.getProjectLogs(id, userId, Number(tail));

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/projects/:id/temp-files
   * List temporary files for a project
   */
  async getTempFiles(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const files = await projectsService.getTempFiles(id, userId);

    return reply.send({
      success: true,
      data: files,
    });
  }

  /**
   * POST /api/projects/:id/temp-files
   * Upload temporary files to a project
   */
  async uploadTempFiles(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const parts = request.files();
    const uploadedFiles: string[] = [];

    for await (const part of parts) {
      const filename = await projectsService.uploadTempFile(id, userId, part);
      uploadedFiles.push(filename);
    }

    return reply.send({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
  }

  /**
   * DELETE /api/projects/:id/temp-files/:filename
   * Delete a specific temporary file
   */
  async deleteTempFile(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id, filename } = request.params as { id: string; filename: string };

    await projectsService.deleteTempFile(id, userId, filename);

    return reply.send({
      success: true,
      message: 'File deleted successfully',
    });
  }

  /**
   * DELETE /api/projects/:id/temp-files
   * Clear all temporary files for a project
   */
  async clearTempFiles(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    await projectsService.clearTempFiles(id, userId);

    return reply.send({
      success: true,
      message: 'All temporary files cleared',
    });
  }

  // ==========================================
  // PROJECT MEMBERS ENDPOINTS
  // ==========================================

  /**
   * GET /api/projects/:id/members
   * Get all members of a project
   */
  async getMembers(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const members = await projectsService.getProjectMembers(id, userId, role);

    return reply.send({
      success: true,
      data: members,
    });
  }

  /**
   * GET /api/projects/:id/available-staff
   * Get staff users that can be added to the project (Admin only)
   */
  async getAvailableStaff(request: FastifyRequest, reply: FastifyReply) {
    const { role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const staff = await projectsService.getAvailableStaffForProject(id, role);

    return reply.send({
      success: true,
      data: staff,
    });
  }

  /**
   * POST /api/projects/:id/members
   * Add a member to a project (Admin only)
   */
  async addMember(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };
    const body = addMemberSchema.parse(request.body);

    const member = await projectsService.addProjectMember(
      id,
      body.userId,
      body.role,
      userId,
      role
    );

    return reply.status(201).send({
      success: true,
      data: member,
      message: 'Member added successfully',
    });
  }

  /**
   * PUT /api/projects/:id/members/:memberId
   * Update a member's role (Admin only)
   */
  async updateMemberRole(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id, memberId } = request.params as { id: string; memberId: string };
    const body = updateMemberRoleSchema.parse(request.body);

    const member = await projectsService.updateProjectMemberRole(
      id,
      memberId,
      body.role,
      userId,
      role
    );

    return reply.send({
      success: true,
      data: member,
      message: 'Member role updated successfully',
    });
  }

  /**
   * DELETE /api/projects/:id/members/:memberId
   * Remove a member from a project (Admin only)
   */
  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id, memberId } = request.params as { id: string; memberId: string };

    await projectsService.removeProjectMember(id, memberId, userId, role);

    return reply.send({
      success: true,
      message: 'Member removed successfully',
    });
  }

  // ==========================================
  // PROJECT SIZE ENDPOINT
  // ==========================================

  /**
   * GET /api/projects/:id/size
   * Get project size (folder + containers + databases)
   */
  async getProjectSize(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const sizeData = await projectsService.getProjectSize(id, userId, role);

    return reply.send({
      success: true,
      data: sizeData,
    });
  }

  // ==========================================
  // PROJECT DISCOVERY ENDPOINTS
  // ==========================================

  /**
   * GET /api/projects/discovery/scan
   * Scan for unregistered projects (ADMIN only)
   */
  async discoverProjects(request: FastifyRequest, reply: FastifyReply) {
    const { role } = request.user as { userId: string; role: UserRole };

    if (role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can discover projects' },
      });
    }

    const result = await discoveryService.discoverProjects();

    return reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/projects/discovery/import
   * Import a discovered project (ADMIN only)
   */
  async importDiscoveredProject(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };

    if (role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can import projects' },
      });
    }

    const body = z.object({
      folderName: z.string(),
      path: z.string(),
      name: z.string().min(2).max(100),
      slug: z.string().min(2).max(50),
      template: z.nativeEnum(ProjectTemplate),
      description: z.string().optional(),
      previewUrl: z.string().optional(),
    }).parse(request.body);

    const project = await discoveryService.importProject(
      {
        folderName: body.folderName,
        path: body.path,
        name: body.name,
        slug: body.slug,
        template: body.template,
        hasPackageJson: false,
        hasDockerCompose: false,
        hasEcosystem: false,
        hasClaudeMd: false,
        detectedInfo: {},
      },
      userId,
      {
        name: body.name,
        description: body.description,
        previewUrl: body.previewUrl,
      }
    );

    return reply.status(201).send({
      success: true,
      data: project,
      message: 'Project imported successfully',
    });
  }

  /**
   * POST /api/projects/discovery/import-all
   * Import all discovered projects (ADMIN only)
   */
  async importAllDiscoveredProjects(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };

    if (role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can import projects' },
      });
    }

    const result = await discoveryService.importAllProjects(userId);

    return reply.send({
      success: true,
      data: result,
      message: `Imported ${result.imported} projects`,
    });
  }

  // ==========================================
  // ENVIRONMENT VARIABLES ENDPOINTS
  // ==========================================

  /**
   * GET /api/projects/:id/env
   * Get environment variables for a project
   */
  async getEnvVars(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const envVars = await projectsService.getEnvVars(id, userId, role);

    return reply.send({
      success: true,
      data: { variables: envVars },
    });
  }

  /**
   * PUT /api/projects/:id/env
   * Update environment variables for a project
   */
  async updateEnvVars(request: FastifyRequest, reply: FastifyReply) {
    const { userId, role } = request.user as { userId: string; role: UserRole };
    const { id } = request.params as { id: string };

    const envSchema = z.object({
      variables: z.array(z.object({
        key: z.string().min(1),
        value: z.string(),
      })),
    });

    const body = envSchema.parse(request.body);
    const typedVariables = body.variables as Array<{ key: string; value: string }>;

    const result = await projectsService.updateEnvVars(id, userId, role, typedVariables);

    return reply.send({
      success: true,
      data: result,
      message: 'Environment variables updated successfully',
    });
  }
}

export const projectsController = new ProjectsController();
