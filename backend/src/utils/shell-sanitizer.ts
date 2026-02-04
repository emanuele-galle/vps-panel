/**
 * Shell Sanitizer Utility
 * Prevents command injection vulnerabilities by validating and sanitizing
 * inputs before use in shell commands.
 */

import { spawn, SpawnOptions } from 'child_process';


/**
 * Characters that are dangerous in shell contexts
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>!#*?~\n\r\\'"]/g;

/**
 * Valid PostgreSQL identifier pattern (database names, usernames)
 */
const PG_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Valid Docker name pattern (container names, volume names, network names)
 */
const DOCKER_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;

/**
 * Valid hostname pattern
 */
const HOSTNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/**
 * Valid path component pattern (no slashes, no special chars)
 */
const PATH_COMPONENT_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Sanitize a string for safe use in shell commands.
 * Removes or escapes dangerous characters.
 *
 * @param arg - The argument to sanitize
 * @returns Sanitized string safe for shell use
 */
export function sanitizeShellArg(arg: string): string {
  if (typeof arg !== 'string') {
    throw new Error('Shell argument must be a string');
  }

  // Replace all shell metacharacters with empty string
  return arg.replace(SHELL_METACHARACTERS, '');
}

/**
 * Escape a string for safe use in single quotes in shell.
 * This is the safest way to pass arbitrary strings to shell.
 *
 * @param arg - The argument to escape
 * @returns String safe for use inside single quotes
 */
export function escapeShellArg(arg: string): string {
  if (typeof arg !== 'string') {
    throw new Error('Shell argument must be a string');
  }

  // In single quotes, only single quote itself needs escaping
  // We do this by ending the quote, adding escaped quote, and restarting
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate a PostgreSQL identifier (database name, username, etc.)
 *
 * @param identifier - The identifier to validate
 * @returns true if valid, false otherwise
 */
export function validatePgIdentifier(identifier: string): boolean {
  if (typeof identifier !== 'string' || identifier.length === 0 || identifier.length > 63) {
    return false;
  }
  return PG_IDENTIFIER_PATTERN.test(identifier);
}

/**
 * Validate a Docker name (container, volume, network, etc.)
 *
 * @param name - The name to validate
 * @returns true if valid, false otherwise
 */
export function validateDockerName(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) {
    return false;
  }
  return DOCKER_NAME_PATTERN.test(name);
}

/**
 * Validate a hostname
 *
 * @param hostname - The hostname to validate
 * @returns true if valid, false otherwise
 */
export function validateHostname(hostname: string): boolean {
  if (typeof hostname !== 'string' || hostname.length === 0 || hostname.length > 253) {
    return false;
  }
  return HOSTNAME_PATTERN.test(hostname);
}

/**
 * Validate a file path to prevent path traversal attacks.
 * The path must be absolute and not contain .. or other dangerous patterns.
 *
 * @param filePath - The path to validate
 * @param allowedRoots - Array of allowed root directories (e.g., ['/var/www', '/tmp'])
 * @returns true if valid, false otherwise
 */
export function validatePath(filePath: string, allowedRoots: string[] = []): boolean {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  // Must be absolute path
  if (!filePath.startsWith('/')) {
    return false;
  }

  // Normalize and check for path traversal
  const normalizedPath = filePath.replace(/\/+/g, '/'); // Remove duplicate slashes

  // Check for path traversal attempts
  if (normalizedPath.includes('..') || normalizedPath.includes('./')) {
    return false;
  }

  // Check for null bytes
  if (normalizedPath.includes('\0')) {
    return false;
  }

  // If allowed roots specified, path must start with one of them
  if (allowedRoots.length > 0) {
    const isAllowed = allowedRoots.some(root =>
      normalizedPath === root || normalizedPath.startsWith(root + '/')
    );
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a path component (single directory or filename)
 *
 * @param component - The path component to validate
 * @returns true if valid, false otherwise
 */
export function validatePathComponent(component: string): boolean {
  if (typeof component !== 'string' || component.length === 0 || component.length > 255) {
    return false;
  }
  return PATH_COMPONENT_PATTERN.test(component);
}

/**
 * Execute a command safely using spawn with array arguments.
 * This is the safest way to execute commands as arguments are never
 * interpreted by a shell.
 *
 * @param command - The command to execute
 * @param args - Array of arguments (will not be shell-interpreted)
 * @param options - Spawn options
 * @returns Promise with stdout and stderr
 */
export async function safeExec(
  command: string,
  args: string[],
  options: { timeout?: number } & SpawnOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const { timeout = 60000, ...spawnOpts } = options;
    const defaultOptions: SpawnOptions = {
      ...spawnOpts,
    };

    const child = spawn(command, args, {
      ...defaultOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set up timeout
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`Command timed out after ${timeout}ms`));
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Execute pg_dump safely with validated parameters.
 *
 * @param params - PostgreSQL connection parameters
 * @param outputFile - Output file path
 * @param extraArgs - Additional pg_dump arguments
 * @returns Promise with execution result
 */
export async function safePgDump(params: {
  host: string;
  user: string;
  database: string;
  password: string;
  outputFile: string;
  schemaOnly?: boolean;
  dataOnly?: boolean;
  tables?: string[];
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Validate all inputs
  if (!validateHostname(params.host) && params.host !== 'postgres' && params.host !== 'localhost') {
    throw new Error(`Invalid hostname: ${params.host}`);
  }

  if (!validatePgIdentifier(params.user)) {
    throw new Error(`Invalid PostgreSQL username: ${params.user}`);
  }

  if (!validatePgIdentifier(params.database)) {
    throw new Error(`Invalid PostgreSQL database name: ${params.database}`);
  }

  // Allow output to backups directory (including subdirectories)
  const allowedOutputRoots = ['/var/backups', '/tmp'];
  if (!validatePath(params.outputFile, allowedOutputRoots)) {
    throw new Error(`Invalid output file path: ${params.outputFile}`);
  }

  // Validate tables if provided
  if (params.tables) {
    for (const table of params.tables) {
      if (!validatePgIdentifier(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }
    }
  }

  // Build arguments array (safe from injection)
  const args: string[] = [
    '-h', params.host,
    '-U', params.user,
    '-d', params.database,
    '-f', params.outputFile,
  ];

  if (params.schemaOnly) {
    args.push('--schema-only');
  }

  if (params.dataOnly) {
    args.push('--data-only');
  }

  if (params.tables) {
    for (const table of params.tables) {
      args.push('--table=' + table);
    }
  }

  // Execute with PGPASSWORD environment variable
  return safeExec('pg_dump', args, {
    env: {
      ...process.env,
      PGPASSWORD: params.password,
    },
    timeout: 300000, // 5 minutes for database dumps
  });
}

/**
 * Execute a Docker command safely.
 *
 * @param args - Docker command arguments
 * @param options - Execution options
 * @returns Promise with execution result
 */
export async function safeDockerExec(
  args: string[],
  options: SpawnOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Validate docker subcommand (first arg)
  const allowedSubcommands = [
    'exec', 'run', 'stop', 'start', 'restart', 'rm', 'ps', 'logs',
    'inspect', 'volume', 'network', 'images', 'image', 'system', 'cp', 'builder'
  ];

  if (args.length === 0 || !allowedSubcommands.includes(args[0])) {
    throw new Error(`Docker subcommand not allowed: ${args[0]}`);
  }

  return safeExec('docker', args, {
    timeout: 120000, // 2 minutes for docker commands
    ...options,
  });
}

/**
 * Execute tar command safely.
 *
 * @param operation - 'c' for create, 'x' for extract
 * @param archivePath - Path to the archive file
 * @param sourcePath - Source directory or file
 * @param options - Additional options
 * @returns Promise with execution result
 */
export async function safeTar(
  operation: 'c' | 'x',
  archivePath: string,
  sourcePath: string,
  options: {
    gzip?: boolean;
    excludes?: string[];
    changeDir?: string;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Validate paths
  if (!validatePath(archivePath, ['/var/backups', '/tmp'])) {
    throw new Error(`Invalid archive path: ${archivePath}`);
  }

  if (!validatePath(sourcePath, ['/var/www', '/var/backups', '/tmp', '/vps-panel-source', '/root/vps-panel'])) {
    throw new Error(`Invalid source path: ${sourcePath}`);
  }

  if (options.changeDir && !validatePath(options.changeDir, ['/var/www', '/var/backups', '/tmp', '/vps-panel-source', '/root/vps-panel'])) {
    throw new Error(`Invalid change directory path: ${options.changeDir}`);
  }

  // Validate excludes
  if (options.excludes) {
    for (const exclude of options.excludes) {
      // Excludes should be simple patterns without dangerous chars
      if (SHELL_METACHARACTERS.test(exclude) && !exclude.includes('*')) {
        throw new Error(`Invalid exclude pattern: ${exclude}`);
      }
    }
  }

  // Build arguments
  const args: string[] = [];

  if (operation === 'c') {
    args.push('-c');
  } else {
    args.push('-x');
  }

  if (options.gzip) {
    args.push('-z');
  }

  args.push('-f', archivePath);

  if (options.changeDir) {
    args.push('-C', options.changeDir);
  }

  if (options.excludes) {
    for (const exclude of options.excludes) {
      args.push('--exclude=' + exclude);
    }
  }

  args.push(sourcePath);

  return safeExec('tar', args, {
    timeout: 600000, // 10 minutes for tar operations
  });
}

/**
 * Execute du (disk usage) command safely.
 *
 * @param path - Path to check
 * @param options - Options for du command
 * @returns Promise with size in bytes
 */
export async function safeDu(
  path: string,
  options: { summarize?: boolean } = { summarize: true }
): Promise<number> {
  if (!validatePath(path)) {
    throw new Error(`Invalid path for du: ${path}`);
  }

  const args = ['-sb'];
  if (options.summarize) {
    args.push('-s');
  }
  args.push(path);

  try {
    const result = await safeExec('du', args, { timeout: 30000 });
    const sizeStr = result.stdout.split('\t')[0];
    return parseInt(sizeStr, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Execute df (disk free) command safely.
 *
 * @param path - Path to check (defaults to /)
 * @returns Promise with disk usage info
 */
export async function safeDf(
  path: string = '/'
): Promise<{ total: number; used: number; free: number; percentage: number }> {
  if (!validatePath(path)) {
    throw new Error(`Invalid path for df: ${path}`);
  }

  try {
    const result = await safeExec('df', ['-B1', path], { timeout: 10000 });
    const lines = result.stdout.trim().split('\n');

    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      const total = parseInt(parts[1], 10);
      const used = parseInt(parts[2], 10);
      const free = parseInt(parts[3], 10);
      const percentage = (used / total) * 100;

      return {
        total,
        used,
        free,
        percentage: Math.round(percentage * 100) / 100,
      };
    }
  } catch {
    // Fall through to return zeros
  }

  return { total: 0, used: 0, free: 0, percentage: 0 };
}

export default {
  sanitizeShellArg,
  escapeShellArg,
  validatePgIdentifier,
  validateDockerName,
  validateHostname,
  validatePath,
  validatePathComponent,
  safeExec,
  safePgDump,
  safeDockerExec,
  safeTar,
  safeDu,
  safeDf,
};
