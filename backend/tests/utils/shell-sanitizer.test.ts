import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
} from '../../src/utils/shell-sanitizer';

describe('Shell Sanitizer', () => {
  describe('sanitizeShellArg', () => {
    it('should remove shell metacharacters', () => {
      expect(sanitizeShellArg('test;rm -rf /')).toBe('testrm -rf /');
      expect(sanitizeShellArg('test|cat /etc/passwd')).toBe('testcat /etc/passwd');
      expect(sanitizeShellArg('test`whoami`')).toBe('testwhoami');
      expect(sanitizeShellArg('test$(id)')).toBe('testid');
    });

    it('should remove backticks and command substitution', () => {
      expect(sanitizeShellArg('`whoami`')).toBe('whoami');
      expect(sanitizeShellArg('$(id)')).toBe('id');
      expect(sanitizeShellArg('${PATH}')).toBe('PATH');
    });

    it('should remove quotes', () => {
      expect(sanitizeShellArg("test'injection")).toBe('testinjection');
      expect(sanitizeShellArg('test"injection')).toBe('testinjection');
    });

    it('should remove newlines', () => {
      expect(sanitizeShellArg('test\ninjection')).toBe('testinjection');
      expect(sanitizeShellArg('test\r\ninjection')).toBe('testinjection');
    });

    it('should keep safe characters', () => {
      expect(sanitizeShellArg('test-file_name.txt')).toBe('test-file_name.txt');
      expect(sanitizeShellArg('user@email.com')).toBe('user@email.com'); // @ is safe
      expect(sanitizeShellArg('/var/www/html')).toBe('/var/www/html');
    });

    it('should throw on non-string input', () => {
      expect(() => sanitizeShellArg(123 as any)).toThrow('Shell argument must be a string');
      expect(() => sanitizeShellArg(null as any)).toThrow('Shell argument must be a string');
    });
  });

  describe('escapeShellArg', () => {
    it('should wrap in single quotes', () => {
      expect(escapeShellArg('test')).toBe("'test'");
    });

    it('should escape single quotes properly', () => {
      expect(escapeShellArg("it's a test")).toBe("'it'\\''s a test'");
      expect(escapeShellArg("test'test")).toBe("'test'\\''test'");
    });

    it('should handle empty string', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('should throw on non-string input', () => {
      expect(() => escapeShellArg(123 as any)).toThrow('Shell argument must be a string');
    });
  });

  describe('validatePgIdentifier', () => {
    it('should accept valid PostgreSQL identifiers', () => {
      expect(validatePgIdentifier('users')).toBe(true);
      expect(validatePgIdentifier('my_table')).toBe(true);
      expect(validatePgIdentifier('Table123')).toBe(true);
      expect(validatePgIdentifier('_private')).toBe(true);
    });

    it('should reject identifiers starting with numbers', () => {
      expect(validatePgIdentifier('123table')).toBe(false);
      expect(validatePgIdentifier('0users')).toBe(false);
    });

    it('should reject identifiers with special characters', () => {
      expect(validatePgIdentifier('table;drop')).toBe(false);
      expect(validatePgIdentifier('table-name')).toBe(false);
      expect(validatePgIdentifier('table.name')).toBe(false);
      expect(validatePgIdentifier("table'name")).toBe(false);
    });

    it('should reject SQL injection attempts', () => {
      expect(validatePgIdentifier("'; DROP TABLE users;--")).toBe(false);
      expect(validatePgIdentifier('table; SELECT * FROM users')).toBe(false);
    });

    it('should reject empty and too long identifiers', () => {
      expect(validatePgIdentifier('')).toBe(false);
      expect(validatePgIdentifier('a'.repeat(64))).toBe(false);
      expect(validatePgIdentifier('a'.repeat(63))).toBe(true);
    });
  });

  describe('validateDockerName', () => {
    it('should accept valid Docker names', () => {
      expect(validateDockerName('my-container')).toBe(true);
      expect(validateDockerName('container_name')).toBe(true);
      expect(validateDockerName('container.name')).toBe(true);
      expect(validateDockerName('nginx')).toBe(true);
      expect(validateDockerName('vps-panel-backend')).toBe(true);
    });

    it('should reject names starting with special chars', () => {
      expect(validateDockerName('-container')).toBe(false);
      expect(validateDockerName('_container')).toBe(false);
      expect(validateDockerName('.container')).toBe(false);
    });

    it('should reject names with uppercase', () => {
      expect(validateDockerName('MyContainer')).toBe(false);
      expect(validateDockerName('NGINX')).toBe(false);
    });

    it('should reject injection attempts', () => {
      expect(validateDockerName('container;rm -rf /')).toBe(false);
      expect(validateDockerName('container`whoami`')).toBe(false);
    });
  });

  describe('validateHostname', () => {
    it('should accept valid hostnames', () => {
      expect(validateHostname('localhost')).toBe(true);
      expect(validateHostname('postgres')).toBe(true);
      expect(validateHostname('my-host')).toBe(true);
      expect(validateHostname('host123')).toBe(true);
    });

    it('should reject hostnames starting/ending with hyphen', () => {
      expect(validateHostname('-host')).toBe(false);
      expect(validateHostname('host-')).toBe(false);
    });

    it('should reject hostnames with special chars', () => {
      expect(validateHostname('host;injection')).toBe(false);
      expect(validateHostname('host`cmd`')).toBe(false);
    });
  });

  describe('validatePath', () => {
    it('should accept valid absolute paths', () => {
      expect(validatePath('/var/www/html')).toBe(true);
      expect(validatePath('/tmp/backup.tar.gz')).toBe(true);
      expect(validatePath('/root/vps-panel')).toBe(true);
    });

    it('should reject relative paths', () => {
      expect(validatePath('var/www/html')).toBe(false);
      expect(validatePath('./test')).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      expect(validatePath('/var/www/../etc/passwd')).toBe(false);
      expect(validatePath('/var/www/../../etc')).toBe(false);
      expect(validatePath('/var/www/..')).toBe(false);
    });

    it('should reject null bytes', () => {
      expect(validatePath('/var/www/test\0.txt')).toBe(false);
    });

    it('should validate against allowed roots', () => {
      expect(validatePath('/var/www/project', ['/var/www'])).toBe(true);
      expect(validatePath('/etc/passwd', ['/var/www'])).toBe(false);
      expect(validatePath('/var/www', ['/var/www'])).toBe(true);
    });
  });

  describe('validatePathComponent', () => {
    it('should accept valid path components', () => {
      expect(validatePathComponent('file.txt')).toBe(true);
      expect(validatePathComponent('my-folder')).toBe(true);
      expect(validatePathComponent('test_file')).toBe(true);
    });

    it('should reject components with slashes', () => {
      expect(validatePathComponent('path/to/file')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(validatePathComponent('file;rm')).toBe(false);
      expect(validatePathComponent('file`cmd`')).toBe(false);
    });
  });

  describe('safeExec', () => {
    it('should execute commands with array arguments', async () => {
      const result = await safeExec('echo', ['hello', 'world']);
      expect(result.stdout.trim()).toBe('hello world');
      expect(result.exitCode).toBe(0);
    });

    it('should not interpret shell metacharacters in arguments', async () => {
      // This would be dangerous if passed to a shell
      const result = await safeExec('echo', ['test;echo injected']);
      // The semicolon is treated as literal text, not a command separator
      // So the output is literally "test;echo injected" with a newline
      expect(result.stdout).toContain('test;echo injected');
      // Verify it's a single line (no command execution happened)
      expect(result.stdout.trim().split('\n').length).toBe(1);
    });

    it('should capture stderr', async () => {
      const result = await safeExec('ls', ['/nonexistent-path-12345']);
      expect(result.stderr).toBeTruthy();
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('safePgDump', () => {
    it('should reject invalid hostname', async () => {
      await expect(safePgDump({
        host: 'host;rm -rf /',
        user: 'user',
        database: 'db',
        password: 'pass',
        outputFile: '/tmp/dump.sql',
      })).rejects.toThrow('Invalid hostname');
    });

    it('should reject invalid username', async () => {
      await expect(safePgDump({
        host: 'localhost',
        user: "user';DROP TABLE users;--",
        database: 'db',
        password: 'pass',
        outputFile: '/tmp/dump.sql',
      })).rejects.toThrow('Invalid PostgreSQL username');
    });

    it('should reject invalid database name', async () => {
      await expect(safePgDump({
        host: 'localhost',
        user: 'user',
        database: 'db;DROP DATABASE',
        password: 'pass',
        outputFile: '/tmp/dump.sql',
      })).rejects.toThrow('Invalid PostgreSQL database name');
    });

    it('should reject invalid output path', async () => {
      await expect(safePgDump({
        host: 'localhost',
        user: 'user',
        database: 'db',
        password: 'pass',
        outputFile: '/etc/passwd',
      })).rejects.toThrow('Invalid output file path');
    });

    it('should reject invalid table names', async () => {
      await expect(safePgDump({
        host: 'localhost',
        user: 'user',
        database: 'db',
        password: 'pass',
        outputFile: '/tmp/dump.sql',
        tables: ['users', "';DROP TABLE users;--"],
      })).rejects.toThrow('Invalid table name');
    });
  });

  describe('safeDockerExec', () => {
    it('should reject disallowed subcommands', async () => {
      await expect(safeDockerExec(['rmi', '-f', 'image'])).rejects.toThrow(
        'Docker subcommand not allowed'
      );
    });

    it('should accept allowed subcommands', async () => {
      // This will fail because container doesn't exist, but command validation passes
      const result = await safeDockerExec(['ps', '-a']);
      // If docker is available, this should work
      expect(result).toBeDefined();
    });
  });

  describe('safeTar', () => {
    it('should reject invalid archive path', async () => {
      await expect(safeTar('c', '/etc/cron.d/malicious', '.')).rejects.toThrow(
        'Invalid archive path'
      );
    });

    it('should reject invalid source path', async () => {
      await expect(safeTar('c', '/tmp/backup.tar.gz', '/etc/passwd')).rejects.toThrow(
        'Invalid source path'
      );
    });

    it('should reject path traversal in archive path', async () => {
      await expect(safeTar('c', '/tmp/../etc/cron.d/evil', '.')).rejects.toThrow(
        'Invalid archive path'
      );
    });
  });

  describe('safeDu', () => {
    it('should return 0 for non-existent paths', async () => {
      const size = await safeDu('/nonexistent-path-12345');
      expect(size).toBe(0);
    });

    it('should reject invalid paths', async () => {
      await expect(safeDu('relative/path')).rejects.toThrow('Invalid path for du');
    });

    it('should reject path traversal', async () => {
      await expect(safeDu('/tmp/../etc/passwd')).rejects.toThrow('Invalid path for du');
    });
  });

  describe('safeDf', () => {
    it('should return disk usage for root', async () => {
      const result = await safeDf('/');
      expect(result.total).toBeGreaterThan(0);
      expect(result.used).toBeGreaterThanOrEqual(0);
      expect(result.free).toBeGreaterThanOrEqual(0);
      expect(result.percentage).toBeGreaterThanOrEqual(0);
      expect(result.percentage).toBeLessThanOrEqual(100);
    });

    it('should reject invalid paths', async () => {
      await expect(safeDf('relative/path')).rejects.toThrow('Invalid path for df');
    });
  });
});

describe('Security: Command Injection Prevention', () => {
  it('should prevent semicolon injection', () => {
    const malicious = 'backup;rm -rf /';
    expect(sanitizeShellArg(malicious)).not.toContain(';');
    expect(validatePgIdentifier(malicious)).toBe(false);
    expect(validateDockerName(malicious)).toBe(false);
  });

  it('should prevent pipe injection', () => {
    const malicious = 'backup|cat /etc/passwd';
    expect(sanitizeShellArg(malicious)).not.toContain('|');
  });

  it('should prevent backtick injection', () => {
    const malicious = 'backup`whoami`';
    expect(sanitizeShellArg(malicious)).not.toContain('`');
  });

  it('should prevent $() substitution', () => {
    const malicious = 'backup$(id)';
    expect(sanitizeShellArg(malicious)).not.toContain('$');
    expect(sanitizeShellArg(malicious)).not.toContain('(');
    expect(sanitizeShellArg(malicious)).not.toContain(')');
  });

  it('should prevent && and || chaining', () => {
    const malicious1 = 'backup && rm -rf /';
    const malicious2 = 'backup || cat /etc/shadow';
    expect(sanitizeShellArg(malicious1)).not.toContain('&');
    // || has | which is already removed
    expect(sanitizeShellArg(malicious2)).not.toContain('|');
  });

  it('should prevent newline injection', () => {
    const malicious = 'backup\nrm -rf /';
    expect(sanitizeShellArg(malicious)).not.toContain('\n');
  });

  it('should prevent quote escape attacks', () => {
    const malicious = "backup'; rm -rf /; echo '";
    expect(sanitizeShellArg(malicious)).not.toContain("'");
    expect(sanitizeShellArg(malicious)).not.toContain(';');
  });
});
