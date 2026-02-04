import { prisma } from '../../services/prisma.service';
import { config } from '../../config/env';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectTemplate, ProjectStatus } from '@prisma/client';

interface DiscoveredProject {
  folderName: string;
  path: string;
  name: string;
  slug: string;
  template: ProjectTemplate;
  hasPackageJson: boolean;
  hasDockerCompose: boolean;
  hasEcosystem: boolean;
  hasClaudeMd: boolean;
  detectedInfo: {
    description?: string;
    previewUrl?: string;
  };
}

interface DiscoveryResult {
  discovered: DiscoveredProject[];
  alreadyRegistered: string[];
  errors: { folder: string; error: string }[];
}

export class DiscoveryService {
  private readonly projectsRoot = config.PROJECTS_ROOT;

  /**
   * Scan the projects directory and find unregistered projects
   */
  async discoverProjects(): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      discovered: [],
      alreadyRegistered: [],
      errors: [],
    };

    try {
      // Get all folders in projects directory
      const entries = await fs.readdir(this.projectsRoot, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      // Get all registered project paths from database
      const registeredProjects = await prisma.project.findMany({
        select: { path: true, slug: true },
      });
      const registeredPaths = new Set(registeredProjects.map((p) => p.path));
      const registeredSlugs = new Set(registeredProjects.map((p) => p.slug));

      // Check each folder
      for (const folder of folders) {
        const folderPath = path.join(this.projectsRoot, folder);

        // Skip if already registered
        if (registeredPaths.has(folderPath)) {
          result.alreadyRegistered.push(folder);
          continue;
        }

        try {
          const projectInfo = await this.analyzeProjectFolder(folderPath, folder, registeredSlugs);
          if (projectInfo) {
            result.discovered.push(projectInfo);
          }
        } catch (error) {
          result.errors.push({ folder, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan projects directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Analyze a folder to determine if it's a valid project
   */
  private async analyzeProjectFolder(
    folderPath: string,
    folderName: string,
    registeredSlugs: Set<string>
  ): Promise<DiscoveredProject | null> {
    // Check for project indicator files
    const [hasPackageJson, hasDockerCompose, hasEcosystem, hasClaudeMd] = await Promise.all([
      this.fileExists(path.join(folderPath, 'package.json')),
      this.fileExists(path.join(folderPath, 'docker-compose.yml')),
      this.fileExists(path.join(folderPath, 'ecosystem.config.js')),
      this.fileExists(path.join(folderPath, 'CLAUDE.md')),
    ]);

    // Must have at least one indicator file to be considered a project
    if (!hasPackageJson && !hasDockerCompose && !hasEcosystem) {
      return null;
    }

    // Detect project template
    const template = await this.detectTemplate(folderPath, hasPackageJson);

    // Generate slug from folder name
    let slug = this.generateSlug(folderName);

    // Ensure slug is unique
    let slugSuffix = 1;
    const originalSlug = slug;
    while (registeredSlugs.has(slug)) {
      slug = `${originalSlug}-${slugSuffix}`;
      slugSuffix++;
    }

    // Try to extract info from CLAUDE.md or package.json
    const detectedInfo = await this.extractProjectInfo(folderPath, hasClaudeMd, hasPackageJson);

    // Generate human-readable name
    const name = detectedInfo.name || this.generateName(folderName);

    return {
      folderName,
      path: folderPath,
      name,
      slug,
      template,
      hasPackageJson,
      hasDockerCompose,
      hasEcosystem,
      hasClaudeMd,
      detectedInfo: {
        description: detectedInfo.description,
        previewUrl: detectedInfo.previewUrl,
      },
    };
  }

  /**
   * Detect project template based on files
   */
  private async detectTemplate(folderPath: string, hasPackageJson: boolean): Promise<ProjectTemplate> {
    if (!hasPackageJson) {
      // Check for other indicators
      const hasPhp = await this.fileExists(path.join(folderPath, 'wp-config.php'));
      if (hasPhp) return 'WORDPRESS';

      const hasPython = await this.fileExists(path.join(folderPath, 'requirements.txt'));
      if (hasPython) return 'PYTHON';

      return 'STATIC';
    }

    try {
      const packageJsonPath = path.join(folderPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return 'NEXTJS';
      if (deps['react'] && !deps['next']) return 'NODEJS';
      if (deps['express'] || deps['fastify'] || deps['koa']) return 'NODEJS';
      if (deps['laravel-mix'] || deps['@laravel/vite-plugin']) return 'PHP';

      return 'NODEJS';
    } catch {
      return 'NODEJS';
    }
  }

  /**
   * Extract project info from CLAUDE.md or package.json
   */
  private async extractProjectInfo(
    folderPath: string,
    hasClaudeMd: boolean,
    hasPackageJson: boolean
  ): Promise<{ name?: string; description?: string; previewUrl?: string }> {
    const info: { name?: string; description?: string; previewUrl?: string } = {};

    // Try CLAUDE.md first
    if (hasClaudeMd) {
      try {
        const claudeMdPath = path.join(folderPath, 'CLAUDE.md');
        const content = await fs.readFile(claudeMdPath, 'utf-8');

        // Extract project name from header
        const nameMatch = content.match(/\*\*Progetto\*\*\s*\|\s*([^|]+)/i);
        if (nameMatch) {
          info.name = nameMatch[1].trim();
        }

        // Extract domain/preview URL
        const domainMatch = content.match(/\*\*Domain\*\*\s*\|\s*([^\s|]+)/i);
        if (domainMatch) {
          info.previewUrl = domainMatch[1].trim();
        }

        // Try to extract description from Overview section
        const overviewMatch = content.match(/## Overview\s*\n+([^\n#]+)/i);
        if (overviewMatch) {
          info.description = overviewMatch[1].trim().substring(0, 200);
        }
      } catch {
        // Ignore errors
      }
    }

    // Try package.json as fallback
    if (hasPackageJson && !info.name) {
      try {
        const packageJsonPath = path.join(folderPath, 'package.json');
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        if (pkg.name && !pkg.name.startsWith('@')) {
          info.name = this.generateName(pkg.name);
        }
        if (pkg.description) {
          info.description = pkg.description.substring(0, 200);
        }
      } catch {
        // Ignore errors
      }
    }

    return info;
  }

  /**
   * Import a discovered project into the database
   */
  async importProject(
    discovered: DiscoveredProject,
    userId: string,
    options?: {
      name?: string;
      description?: string;
      previewUrl?: string;
    }
  ) {
    const project = await prisma.project.create({
      data: {
        name: options?.name || discovered.name,
        slug: discovered.slug,
        description: options?.description || discovered.detectedInfo.description,
        template: discovered.template,
        status: ProjectStatus.ACTIVE,
        path: discovered.path,
        previewUrl: options?.previewUrl || discovered.detectedInfo.previewUrl,
        userId,
      },
    });

    return project;
  }

  /**
   * Import all discovered projects
   */
  async importAllProjects(userId: string): Promise<{ imported: number; errors: string[] }> {
    const discovery = await this.discoverProjects();
    const errors: string[] = [];
    let imported = 0;

    for (const project of discovery.discovered) {
      try {
        await this.importProject(project, userId);
        imported++;
      } catch (error) {
        errors.push(`${project.folderName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Helper to check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate slug from folder name
   */
  private generateSlug(folderName: string): string {
    return folderName
      .toLowerCase()
      .replace(/^import-/, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Generate human-readable name from folder/package name
   */
  private generateName(input: string): string {
    return input
      .replace(/^import-/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}

export const discoveryService = new DiscoveryService();
