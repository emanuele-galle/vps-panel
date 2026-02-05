import { prisma } from '../../services/prisma.service';
import { dockerService } from '../docker/docker.service';
import { redis, CacheKeys, CacheTTL } from '../../services/redis.service';
import { config } from '../../config/env';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Project, ProjectTemplate, ProjectStatus, ProjectMemberRole, UserRole } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { wordpressTemplate } from './templates/wordpress.template';
import { nodejsTemplate } from './templates/nodejs.template';
import { nextjsTemplate } from './templates/nextjs.template';
import { EventEmitter } from 'events';
import log from '../../services/logger.service';

// Event emitter for real-time project updates
export const projectEvents = new EventEmitter();

export const ProjectEventTypes = {
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',
  PROJECT_STATUS_CHANGED: 'project:status',
  PROJECT_CREDENTIALS_SYNCED: 'project:credentials',
  CONTAINER_STATUS_CHANGED: 'project:container:status'
} as const;

export class ProjectsService {
  private readonly projectsRoot = config.PROJECTS_ROOT;

  // Sub-services (initialized after construction via init())
  private _membersService!: import('./projects-members.service').ProjectsMembersService;
  private _filesService!: import('./projects-files.service').ProjectsFilesService;

  /**
   * Initialize sub-services. Must be called after construction.
   */
  init() {
    const { ProjectsMembersService } = require('./projects-members.service');
    const { ProjectsFilesService } = require('./projects-files.service');

    this._membersService = new ProjectsMembersService(
      this.canAccessProject.bind(this),
      (userId: string) => this.invalidateAccessCache(userId)
    );
    this._filesService = new ProjectsFilesService(
      this.getProjectById.bind(this)
    );

    return this;
  }

  // ==========================================
  // PROJECT ACCESS HELPERS
  // ==========================================

  /**
   * Check if user can access a project (owner, admin, or member)
   */
  async canAccessProject(projectId: string, userId: string, userRole: UserRole): Promise<boolean> {
    // Admin can access everything
    if (userRole === 'ADMIN') return true;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId } }
      }
    });

    if (!project) return false;

    // Owner or member
    return project.userId === userId || project.members.length > 0;
  }

  /**
   * Get accessible project IDs for a user
   * OPTIMIZED: Uses Redis cache to reduce database queries
   */
  async getAccessibleProjectIds(userId: string, userRole: UserRole): Promise<string[] | null> {
    // Admin can access all - return null to indicate no filter needed
    if (userRole === 'ADMIN') return null;

    // Check cache first
    const cacheKey = CacheKeys.accessibleProjects(userId);
    const cached = await redis.get<string[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // For staff, get owned projects + member projects
    const [ownedProjects, memberProjects] = await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: { id: true }
      }),
      prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true }
      })
    ]);

    const ids = new Set<string>();
    ownedProjects.forEach(p => ids.add(p.id));
    memberProjects.forEach(m => ids.add(m.projectId));

    const result = Array.from(ids);

    // Cache for 5 minutes
    await redis.set(cacheKey, result, CacheTTL.accessibleProjects);

    return result;
  }

  /**
   * Invalidate accessible projects cache for a user
   */
  private async invalidateAccessCache(userId: string): Promise<void> {
    await redis.del(CacheKeys.accessibleProjects(userId));
  }

  /**
   * Invalidate accessible projects cache for all members of a project
   */
  private async invalidateProjectMembersCache(projectId: string): Promise<void> {
    // Get all members of this project
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true }
    });

    // Get owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true }
    });

    const userIds = new Set<string>();
    members.forEach(m => userIds.add(m.userId));
    if (project) userIds.add(project.userId);

    // Invalidate cache for all affected users
    await Promise.all(
      Array.from(userIds).map(userId => this.invalidateAccessCache(userId))
    );
  }

  /**
   * Create a new project
   */
  async createProject(data: {
    name: string;
    slug: string;
    description?: string;
    userId: string;
    clientName?: string;
    clientEmail?: string;
    template: ProjectTemplate;
  }) {
    // Check if slug is unique
    const existing = await prisma.project.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new ConflictError('Project slug already exists');
    }

    // Create project directory
    const clientSlug = data.clientName
      ? data.clientName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : 'default';
    const projectPath = path.join(this.projectsRoot, clientSlug, data.slug);

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'backups'), { recursive: true });

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        userId: data.userId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        template: data.template,
        status: ProjectStatus.ACTIVE,
        path: projectPath,
      },
    });

    try {
      // Generate docker-compose.yml from template
      const port = await dockerService.getAvailablePort();
      const composeContent = await this.generateCompose(
        data.template,
        data.slug,
        data.name,
        port
      );

      const composePath = path.join(projectPath, 'docker-compose.yml');
      await fs.writeFile(composePath, composeContent);

      // Create .env file with generated passwords
      const envContent = this.generateEnvFile(data.template);
      const envPath = path.join(projectPath, '.env');
      await fs.writeFile(envPath, envContent);

      // Create README
      const readmeContent = this.generateReadme(project);
      const readmePath = path.join(projectPath, 'README.md');
      await fs.writeFile(readmePath, readmeContent);

      // Start the project with docker-compose
      await dockerService.composeUp(projectPath);

      // Update project with deployment time
      await prisma.project.update({
        where: { id: project.id },
        data: { lastDeployAt: new Date() },
      });

      // Invalidate owner's cache
      await this.invalidateAccessCache(data.userId);

      // Generate credentials file for the project
      await this.generateCredentialsFile(project);

      // Emit project created event for real-time updates
      projectEvents.emit(ProjectEventTypes.PROJECT_CREATED, {
        projectId: project.id,
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          template: project.template,
          status: project.status,
          path: project.path
        }
      });


      return project;
    } catch (error) {
      // Rollback: delete project from database and filesystem
      await prisma.project.delete({ where: { id: project.id } });
      await fs.rm(projectPath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Get all projects for a user (filtered by role)
   */
  async getProjects(userId: string, userRole: UserRole, filters?: {
    status?: ProjectStatus;
    template?: ProjectTemplate;
  }) {
    // Get accessible project IDs for staff users
    const accessibleIds = await this.getAccessibleProjectIds(userId, userRole);

    return prisma.project.findMany({
      where: {
        // If accessibleIds is null (admin), no filter. Otherwise filter by accessible projects
        ...(accessibleIds !== null && { id: { in: accessibleIds } }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.template && { template: filters.template }),
      },
      include: {
        _count: {
          select: {
            containers: true,
            domains: true,
            members: true,
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get project by ID (with access check based on role)
   */
  async getProjectById(projectId: string, userId: string, userRole: UserRole = 'STAFF') {
    // Check access first
    const hasAccess = await this.canAccessProject(projectId, userId, userRole);
    if (!hasAccess) {
      throw new NotFoundError('Project not found');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        containers: true,
        domains: true,
        volumes: true,
        networks: true,
        databases: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
      clientName?: string;
      clientEmail?: string;
    }
  ) {
    const project = await this.getProjectById(projectId, userId);

    return prisma.project.update({
      where: { id: project.id },
      data,
    });
  }

  /**
   * Update project credentials
   */
  async updateProjectCredentials(
    projectId: string,
    userId: string,
    credentials: Record<string, any>
  ) {
    const project = await this.getProjectById(projectId, userId);

    return prisma.project.update({
      where: { id: project.id },
      data: { credentials },
    });
  }

  /**
   * Sync credentials from vps-credentials.json file in project root
   * This allows projects to define their demo credentials that will be shown in VPS Console
   * File format: { accounts: { role: { email, password, description?, loginUrl? } }, dashboardUrls?: { name: url } }
   */
  async syncCredentialsFromFile(projectId: string, userId: string, userRole: UserRole = 'STAFF') {
    const project = await this.getProjectById(projectId, userId, userRole);
    const credentialsPath = path.join(project.path, 'vps-credentials.json');

    try {
      // Check if file exists
      await fs.access(credentialsPath);
      
      // Read and parse the file
      const fileContent = await fs.readFile(credentialsPath, 'utf-8');
      const credentials = JSON.parse(fileContent);

      // Validate basic structure
      if (!credentials || typeof credentials !== 'object') {
        return { synced: false, reason: 'Invalid credentials file format' };
      }

      // Update project credentials in database
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { credentials },
      });

      return { 
        synced: true, 
        credentials: updated.credentials,
        source: 'vps-credentials.json'
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist - return current credentials without error
        return { 
          synced: false, 
          reason: 'vps-credentials.json not found',
          credentials: project.credentials 
        };
      }
      if (error instanceof SyntaxError) {
        return { synced: false, reason: 'Invalid JSON in vps-credentials.json' };
      }
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, userId: string, userRole: UserRole = 'STAFF') {
    const project = await this.getProjectById(projectId, userId, userRole);

    // Invalidate cache for all affected users BEFORE deleting
    await this.invalidateProjectMembersCache(projectId);

    // Stop and remove containers
    try {
      await dockerService.composeDown(project.path);
    } catch (_error) {
      // Continue even if compose down fails
    }

    // Remove project directory
    await fs.rm(project.path, { recursive: true, force: true });

    // Delete from database (cascade will handle relations)
    await prisma.project.delete({
      where: { id: project.id },
    });

    return { success: true };
  }

  /**
   * Start project
   */
  async startProject(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);

    await dockerService.composeUp(project.path);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: ProjectStatus.ACTIVE,
        lastDeployAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * Stop project
   */
  async stopProject(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);

    await dockerService.composeDown(project.path);

    await prisma.project.update({
      where: { id: project.id },
      data: { status: ProjectStatus.INACTIVE },
    });

    return { success: true };
  }

  /**
   * Restart project
   */
  async restartProject(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);

    await dockerService.composeRestart(project.path);

    await prisma.project.update({
      where: { id: project.id },
      data: { lastDeployAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Get project logs
   */
  async getProjectLogs(projectId: string, userId: string, tail: number = 100) {
    const project = await this.getProjectById(projectId, userId);

    const logs = await dockerService.composeLogs(project.path, tail);

    return { logs };
  }

  /**
   * Generate docker-compose.yml content from template
   */
  private async generateCompose(
    template: ProjectTemplate,
    slug: string,
    name: string,
    port: number
  ): Promise<string> {
    const templateConfig = {
      projectSlug: slug,
      projectName: name,
      port,
      dbPassword: this.generatePassword(),
      previewDomain: config.PREVIEW_DOMAIN,
    };

    switch (template) {
      case ProjectTemplate.WORDPRESS:
        return wordpressTemplate(templateConfig);
      case ProjectTemplate.NODEJS:
        return nodejsTemplate(templateConfig);
      case ProjectTemplate.NEXTJS:
        return nextjsTemplate(templateConfig);
      default:
        throw new Error(`Template ${template} not implemented yet`);
    }
  }

  /**
   * Generate .env file content
   */
  private generateEnvFile(template: ProjectTemplate): string {
    const dbPassword = this.generatePassword();

    let content = `# Generated by VPS Control Panel\n`;
    content += `# Created: ${new Date().toISOString()}\n\n`;

    if (template === ProjectTemplate.WORDPRESS) {
      content += `DB_PASSWORD=${dbPassword}\n`;
      content += `WORDPRESS_DB_PASSWORD=${dbPassword}\n`;
    }

    return content;
  }

  /**
   * Generate README content
   */
  private generateReadme(project: Project): string {
    return `# ${project.name}

**Project ID:** ${project.id}
**Slug:** ${project.slug}
**Template:** ${project.template}
**Created:** ${project.createdAt}

## Preview URL

Your project is available at:
\`\`\`
https://${project.slug}.${config.PREVIEW_DOMAIN}
\`\`\`

## Directory Structure

- \`src/\` - Your application source code
- \`backups/\` - Database backups
- \`docker-compose.yml\` - Docker configuration
- \`.env\` - Environment variables

## Management

Manage this project from the VPS Control Panel dashboard.

---
Generated by VPS Control Panel
`;
  }

  /**
   * Generate secure random password
   */
  private generatePassword(length: number = 32): string {
    return require('crypto').randomBytes(length).toString('hex');
  }


  /**
   * Generate vps-credentials.json file for a project
   * Creates credentials file with app info, database credentials, and file manager access
   */
  private async generateCredentialsFile(
    project: { id: string; name: string; slug: string; path: string; template: ProjectTemplate },
    dbCredentials?: { type: string; port: number; name: string; user: string; password: string }
  ) {
    const previewDomain = config.PREVIEW_DOMAIN || 'fodivps1.cloud';
    
    const credentials: Record<string, any> = {
      app: {
        name: project.name,
        slug: project.slug,
        url: `https://${project.slug}.${previewDomain}`,
        template: project.template
      },
      database: dbCredentials ? {
        type: dbCredentials.type,
        host: '172.19.0.1',
        port: dbCredentials.port,
        name: dbCredentials.name,
        user: dbCredentials.user,
        password: dbCredentials.password,
        connectionString: dbCredentials.type === 'postgresql' 
          ? `postgresql://${dbCredentials.user}:${dbCredentials.password}@172.19.0.1:${dbCredentials.port}/${dbCredentials.name}`
          : `mysql://${dbCredentials.user}:${dbCredentials.password}@172.19.0.1:${dbCredentials.port}/${dbCredentials.name}`
      } : null,
      fileManager: {
        url: 'https://files.fodivps1.cloud',
        path: project.path
      },
      accounts: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const credentialsFilePath = path.join(project.path, 'vps-credentials.json');
    
    try {
      await fs.writeFile(credentialsFilePath, JSON.stringify(credentials, null, 2));
      
      // Update project in database with credentials
      await prisma.project.update({
        where: { id: project.id },
        data: { 
          credentials,
          previewUrl: credentials.app.url
        }
      });

      // Emit event for real-time update
      projectEvents.emit(ProjectEventTypes.PROJECT_CREDENTIALS_SYNCED, {
        projectId: project.id,
        credentials
      });

      return credentials;
    } catch (error) {
      log.error(`[ProjectsService] Error generating credentials file for ${project.slug}:`, error);
      throw error;
    }
  }

  // ==========================================
  // DELEGATED METHODS - Temporary Files
  // ==========================================

  async getTempFiles(projectId: string, userId: string) {
    return this._filesService.getTempFiles(projectId, userId);
  }

  async uploadTempFile(projectId: string, userId: string, part: any): Promise<string> {
    return this._filesService.uploadTempFile(projectId, userId, part);
  }

  async deleteTempFile(projectId: string, userId: string, filename: string) {
    return this._filesService.deleteTempFile(projectId, userId, filename);
  }

  async clearTempFiles(projectId: string, userId: string) {
    return this._filesService.clearTempFiles(projectId, userId);
  }

  // ==========================================
  // DELEGATED METHODS - Project Members
  // ==========================================

  async addProjectMember(
    projectId: string,
    memberId: string,
    role: ProjectMemberRole = 'MEMBER',
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    return this._membersService.addProjectMember(projectId, memberId, role, requestingUserId, requestingUserRole);
  }

  async removeProjectMember(
    projectId: string,
    memberId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    return this._membersService.removeProjectMember(projectId, memberId, requestingUserId, requestingUserRole);
  }

  async updateProjectMemberRole(
    projectId: string,
    memberId: string,
    newRole: ProjectMemberRole,
    requestingUserId: string,
    requestingUserRole: UserRole
  ) {
    return this._membersService.updateProjectMemberRole(projectId, memberId, newRole, requestingUserId, requestingUserRole);
  }

  async getProjectMembers(projectId: string, userId: string, userRole: UserRole) {
    return this._membersService.getProjectMembers(projectId, userId, userRole);
  }

  async getAvailableStaffForProject(projectId: string, requestingUserRole: UserRole) {
    return this._membersService.getAvailableStaffForProject(projectId, requestingUserRole);
  }

  // ==========================================
  // DELEGATED METHODS - Project Size & Env Vars
  // ==========================================

  async getProjectSize(projectId: string, userId: string, userRole: UserRole) {
    return this._filesService.getProjectSize(projectId, userId, userRole);
  }

  async getEnvVars(projectId: string, userId: string, userRole: UserRole): Promise<Array<{ key: string; value: string }>> {
    return this._filesService.getEnvVars(projectId, userId, userRole);
  }

  async updateEnvVars(
    projectId: string,
    userId: string,
    userRole: UserRole,
    variables: Array<{ key: string; value: string }>
  ): Promise<{ updated: boolean; path: string }> {
    return this._filesService.updateEnvVars(projectId, userId, userRole, variables);
  }
}

export const projectsService = new ProjectsService().init();

// Re-export sub-services for direct access if needed
export { ProjectsMembersService } from './projects-members.service';
export { ProjectsFilesService } from './projects-files.service';
