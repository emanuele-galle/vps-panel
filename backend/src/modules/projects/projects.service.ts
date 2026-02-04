import { prisma } from '../../services/prisma.service';
import { dockerService } from '../docker/docker.service';
import { redis, CacheKeys, CacheTTL } from '../../services/redis.service';
import { config } from '../../config/env';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { Project, ProjectTemplate, ProjectStatus, ProjectMemberRole, UserRole } from '@prisma/client';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import { wordpressTemplate } from './templates/wordpress.template';
import { nodejsTemplate } from './templates/nodejs.template';
import { nextjsTemplate } from './templates/nextjs.template';
import { safeDu, validatePath } from '../../utils/shell-sanitizer';
import { monitoringService } from '../monitoring/monitoring.service';
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

    const credentialsPath = path.join(project.path, 'vps-credentials.json');
    
    try {
      await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
      
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
  // TEMPORARY FILES MANAGEMENT
  // ==========================================

  /**
   * Get temp uploads directory for a project
   */
  private getTempUploadsDir(projectPath: string): string {
    return path.join(projectPath, 'temp-uploads');
  }

  /**
   * List temporary files for a project
   */
  async getTempFiles(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    try {
      await fs.access(tempDir);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    const files = await fs.readdir(tempDir, { withFileTypes: true });
    const fileInfos = await Promise.all(
      files
        .filter((f) => f.isFile())
        .map(async (f) => {
          const filePath = path.join(tempDir, f.name);
          const stats = await fs.stat(filePath);
          return {
            name: f.name,
            size: stats.size,
            modified: stats.mtime,
          };
        })
    );

    return fileInfos;
  }

  /**
   * Upload a temporary file
   */
  async uploadTempFile(projectId: string, userId: string, part: any): Promise<string> {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Sanitize filename
    const sanitizedFilename = part.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(tempDir, sanitizedFilename);

    // Write file
    const buffer = await part.toBuffer();
    await fs.writeFile(filePath, buffer);

    return sanitizedFilename;
  }

  /**
   * Delete a specific temporary file
   */
  async deleteTempFile(projectId: string, userId: string, filename: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);
    const filePath = path.join(tempDir, filename);

    // Security: ensure the file is within the temp directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(tempDir)) {
      throw new Error('Invalid file path');
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Clear all temporary files for a project
   */
  async clearTempFiles(projectId: string, userId: string) {
    const project = await this.getProjectById(projectId, userId);
    const tempDir = this.getTempUploadsDir(project.path);

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ==========================================
  // PROJECT MEMBERS MANAGEMENT
  // ==========================================

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

  // ==========================================
  // PROJECT SIZE CALCULATION
  // ==========================================

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get project size (folder + containers + databases)
   */
  async getProjectSize(projectId: string, userId: string, userRole: UserRole) {
    const project = await this.getProjectById(projectId, userId, userRole);

    // Calculate folder size
    let folderSize = 0;
    try {
      if (project.path && validatePath(project.path)) {
        folderSize = await safeDu(project.path);
      }
    } catch (_error) {
      // Folder might not exist or be accessible
    }

    // Get container sizes from monitoring service
    let containersSize = 0;
    let containersCount = 0;
    try {
      const containersData = await monitoringService.getContainersStorageUsage();
      // Filter containers belonging to this project
      const projectContainers = containersData.containers.filter(
        (c: any) => c.projectSlug === project.slug ||
                   c.name?.startsWith(project.slug) ||
                   c.projectName?.toLowerCase().includes(project.name.toLowerCase())
      );
      containersSize = projectContainers.reduce((sum: number, c: { size?: number }) => sum + (c.size || 0), 0);
      containersCount = projectContainers.length;
    } catch (_error) {
      // Ignore errors
    }

    // Get database sizes
    let databasesSize = 0;
    let databasesCount = 0;
    try {
      const databasesData = await monitoringService.getDatabaseSizes();
      // Filter databases belonging to this project
      const projectDatabases = databasesData.databases.filter(
        (d: any) => d.projectSlug === project.slug
      );
      databasesSize = projectDatabases.reduce((sum: number, d: { size?: number }) => sum + (d.size || 0), 0);
      databasesCount = projectDatabases.length;
    } catch (_error) {
      // Ignore errors
    }

    const totalSize = folderSize + containersSize + databasesSize;

    return {
      folder: {
        size: folderSize,
        sizeFormatted: this.formatBytes(folderSize),
      },
      containers: {
        size: containersSize,
        sizeFormatted: this.formatBytes(containersSize),
        count: containersCount,
      },
      databases: {
        size: databasesSize,
        sizeFormatted: this.formatBytes(databasesSize),
        count: databasesCount,
      },
      total: {
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize),
      },
    };
  }

  // ==========================================
  // ENVIRONMENT VARIABLES MANAGEMENT
  // ==========================================

  /**
   * Get environment variables from project .env file
   */
  async getEnvVars(projectId: string, userId: string, userRole: UserRole): Promise<Array<{ key: string; value: string }>> {
    const project = await this.getProjectById(projectId, userId, userRole);

    if (!project.path) {
      return [];
    }

    const envPath = path.join(project.path, '.env');

    // Check if .env file exists
    if (!fsSync.existsSync(envPath)) {
      // Try .env.local or .env.production
      const altPaths = [
        path.join(project.path, '.env.local'),
        path.join(project.path, '.env.production'),
      ];
      for (const altPath of altPaths) {
        if (fsSync.existsSync(altPath)) {
          return this.parseEnvFile(altPath);
        }
      }
      return [];
    }

    return this.parseEnvFile(envPath);
  }

  /**
   * Parse .env file into array of key-value pairs
   */
  private parseEnvFile(filePath: string): Array<{ key: string; value: string }> {
    try {
      const content = fsSync.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const variables: Array<{ key: string; value: string }> = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Parse key=value
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex > 0) {
          const key = trimmed.substring(0, equalsIndex).trim();
          let value = trimmed.substring(equalsIndex + 1).trim();

          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          variables.push({ key, value });
        }
      }

      return variables;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Update environment variables in project .env file
   */
  async updateEnvVars(
    projectId: string,
    userId: string,
    userRole: UserRole,
    variables: Array<{ key: string; value: string }>
  ): Promise<{ updated: boolean; path: string }> {
    const project = await this.getProjectById(projectId, userId, userRole);

    if (!project.path) {
      throw new NotFoundError('Project path not configured');
    }

    const envPath = path.join(project.path, '.env');

    // Build .env content
    const content = variables
      .map(({ key, value }) => {
        // Quote values that contain spaces or special characters
        if (value.includes(' ') || value.includes('#') || value.includes('=')) {
          return `${key}="${value}"`;
        }
        return `${key}=${value}`;
      })
      .join('\n');

    // Write to .env file
    fsSync.writeFileSync(envPath, content + '\n', { mode: 0o600 });

    return {
      updated: true,
      path: envPath,
    };
  }
}

export const projectsService = new ProjectsService();
