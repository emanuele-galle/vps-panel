import archiver from 'archiver';
import unzipper from 'unzipper';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, readdir, stat, rm, writeFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import type { BackupAnalysis } from '../modules/backup/backup.types';
import log from '../services/logger.service';

export class ZipUtils {
  /**
   * Validates that a path is safely within the target directory
   * Prevents path traversal attacks (e.g., ../../etc/passwd)
   */
  private static isPathSafe(targetDir: string, entryPath: string): boolean {
    // Normalize both paths to resolve any .. or . components
    const normalizedTarget = normalize(resolve(targetDir));
    const fullPath = normalize(resolve(targetDir, entryPath));

    // Check that the resolved path starts with the target directory
    // Must be either the target dir itself or within it (with path separator)
    return fullPath === normalizedTarget ||
           fullPath.startsWith(normalizedTarget + '/');
  }

  /**
   * Validates a ZIP entry for security issues
   */
  private static validateZipEntry(entryPath: string): { safe: boolean; reason?: string } {
    // Check for null bytes (can bypass checks)
    if (entryPath.includes('\0')) {
      return { safe: false, reason: 'Entry contains null byte' };
    }

    // Check for absolute paths
    if (entryPath.startsWith('/') || entryPath.startsWith('\\')) {
      return { safe: false, reason: 'Entry has absolute path' };
    }

    // Check for Windows drive letters
    if (/^[a-zA-Z]:/.test(entryPath)) {
      return { safe: false, reason: 'Entry has Windows drive letter' };
    }

    // Check for path traversal sequences
    const segments = entryPath.split(/[/\\]/);
    for (const segment of segments) {
      if (segment === '..') {
        return { safe: false, reason: 'Entry contains path traversal (..)' };
      }
    }

    return { safe: true };
  }

  /**
   * Estrae un file ZIP in una directory con protezione path traversal
   * Uses Open.file() instead of Parse() for robust handling of large/nested ZIPs
   */
  static async extractZip(zipPath: string, targetDir: string): Promise<void> {
    await mkdir(targetDir, { recursive: true });

    // Resolve target directory to absolute path
    const resolvedTargetDir = resolve(targetDir);

    // Open.file() reads the ZIP central directory first - much more reliable
    // than Parse() streaming which fails on large nested ZIPs and special chars
    const directory = await unzipper.Open.file(zipPath);

    for (const entry of directory.files) {
      const entryPath = entry.path;
      const entryType = entry.type; // 'Directory' or 'File'

      // Skip macOS metadata directories
      if (entryPath.startsWith('__MACOSX/') || entryPath.includes('/__MACOSX/')) {
        continue;
      }

      // Skip .DS_Store files
      if (entryPath.endsWith('.DS_Store')) {
        continue;
      }

      // Validate entry for security issues
      const validation = this.validateZipEntry(entryPath);
      if (!validation.safe) {
        log.error(`[SECURITY] Rejecting ZIP entry: ${entryPath} - ${validation.reason}`);
        continue;
      }

      // Validate path is within target directory
      if (!this.isPathSafe(resolvedTargetDir, entryPath)) {
        log.error(`[SECURITY] Path traversal attempt blocked: ${entryPath}`);
        continue;
      }

      const fullPath = join(resolvedTargetDir, entryPath);

      try {
        if (entryType === 'Directory') {
          await mkdir(fullPath, { recursive: true });
        } else {
          // Ensure parent directory exists
          await mkdir(join(fullPath, '..'), { recursive: true });

          // Extract file using buffer for reliability
          const content = await entry.buffer();
          await writeFile(fullPath, content);
        }
      } catch (err) {
        log.error(`Error processing ${entryPath}:`, err);
      }
    }
  }

  /**
   * Crea un file ZIP da una directory
   */
  static async createZip(sourceDir: string, outputPath: string, excludePatterns: string[] = []): Promise<void> {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (error) => reject(error));

      archive.pipe(output);

      // Pattern da escludere di default
      const defaultExcludes = [
        'node_modules/**',
        '.next/**',
        'dist/**',
        'build/**',
        '.git/**',
        '*.log',
        '.env',
        '.env.local',
        'coverage/**',
        '.cache/**',
        ...excludePatterns,
      ];

      archive.glob('**/*', {
        cwd: sourceDir,
        ignore: defaultExcludes,
        dot: false,
      });

      archive.finalize();
    });
  }

  /**
   * Analizza il contenuto di una directory estratta
   */
  static async analyzeExtractedDir(dirPath: string): Promise<BackupAnalysis> {
    const analysis: BackupAnalysis = {
      hasPackageJson: false,
      hasDockerCompose: false,
      hasPrismaSchema: false,
      filesCount: 0,
      totalSize: 0,
      directories: [],
      filesToCleanup: [],
    };

    const filesToClean = [
      'node_modules',
      '.next',
      'dist',
      'build',
      '.git',
      'coverage',
      '.cache',
      'logs',
    ];

    await this.scanDirectory(dirPath, dirPath, analysis, filesToClean);

    // Detect framework
    if (analysis.hasPackageJson) {
      const packageJsonPath = join(dirPath, 'package.json');
      const packageJson = require(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.next) {
        analysis.detectedFramework = 'nextjs';
      } else if (deps['@nestjs/core']) {
        analysis.detectedFramework = 'nestjs';
      } else if (deps.express) {
        analysis.detectedFramework = 'express';
      } else if (deps.fastify) {
        analysis.detectedFramework = 'fastify';
      } else if (deps.wordpress) {
        analysis.detectedFramework = 'wordpress';
      } else {
        analysis.detectedFramework = 'other';
      }

      // Extract dependencies
      analysis.dependencies = {
        runtime: Object.keys(packageJson.dependencies || {}),
        global: Object.keys(packageJson.devDependencies || {}),
      };
    }

    return analysis;
  }

  private static async scanDirectory(
    basePath: string,
    currentPath: string,
    analysis: BackupAnalysis,
    filesToClean: string[]
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relativePath = fullPath.replace(basePath + '/', '');

      if (entry.isDirectory()) {
        analysis.directories.push(relativePath);

        // Check se è una directory da pulire
        if (filesToClean.includes(entry.name)) {
          analysis.filesToCleanup.push(relativePath);
          continue; // Non scandire dentro directory da pulire
        }

        await this.scanDirectory(basePath, fullPath, analysis, filesToClean);
      } else {
        analysis.filesCount++;
        const stats = await stat(fullPath);
        analysis.totalSize += stats.size;

        // Check file speciali
        if (entry.name === 'package.json') {
          analysis.hasPackageJson = true;
        } else if (entry.name === 'docker-compose.yml' || entry.name === 'docker-compose.yaml') {
          analysis.hasDockerCompose = true;
        } else if (entry.name === 'schema.prisma') {
          analysis.hasPrismaSchema = true;
        }
      }
    }
  }

  /**
   * Pulisce file e directory non necessari
   */
  static async cleanupExtractedDir(dirPath: string, filesToRemove: string[]): Promise<number> {
    let cleaned = 0;

    for (const fileToRemove of filesToRemove) {
      const fullPath = join(dirPath, fileToRemove);
      try {
        await rm(fullPath, { recursive: true, force: true });
        cleaned++;
      } catch (error) {
        log.error(`Errore rimuovendo ${fullPath}:`, error);
      }
    }

    return cleaned;
  }
}
