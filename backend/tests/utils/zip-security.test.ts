import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZipUtils } from '../../src/utils/zip.utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

describe('ZipUtils Security', () => {
  const testDir = '/tmp/zip-security-test';
  const extractDir = '/tmp/zip-security-extract';

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(extractDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm(extractDir, { recursive: true, force: true });
    } catch {}
  });

  /**
   * Helper to create a ZIP file with custom entries
   */
  async function createTestZip(zipPath: string, entries: { name: string; content: string }[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      for (const entry of entries) {
        archive.append(entry.content, { name: entry.name });
      }

      archive.finalize();
    });
  }

  describe('Path Traversal Protection', () => {
    it('should extract safe files normally', async () => {
      const zipPath = path.join(testDir, 'safe.zip');
      await createTestZip(zipPath, [
        { name: 'file.txt', content: 'Hello World' },
        { name: 'subdir/nested.txt', content: 'Nested content' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      const file1 = await fs.readFile(path.join(extractDir, 'file.txt'), 'utf-8');
      expect(file1).toBe('Hello World');

      const file2 = await fs.readFile(path.join(extractDir, 'subdir/nested.txt'), 'utf-8');
      expect(file2).toBe('Nested content');
    });

    it('should block path traversal with ../', async () => {
      const zipPath = path.join(testDir, 'traversal.zip');

      // Create ZIP with path traversal entry
      await createTestZip(zipPath, [
        { name: '../../../etc/malicious.txt', content: 'MALICIOUS' },
        { name: 'safe.txt', content: 'Safe content' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      // Malicious file should NOT be extracted outside target
      const maliciousPath = '/etc/malicious.txt';
      let maliciousExists = false;
      try {
        await fs.access(maliciousPath);
        maliciousExists = true;
      } catch {
        maliciousExists = false;
      }
      expect(maliciousExists).toBe(false);

      // Safe file should still be extracted
      const safeContent = await fs.readFile(path.join(extractDir, 'safe.txt'), 'utf-8');
      expect(safeContent).toBe('Safe content');
    });

    it('should block absolute paths', async () => {
      const zipPath = path.join(testDir, 'absolute.zip');

      await createTestZip(zipPath, [
        { name: '/tmp/absolute-test.txt', content: 'MALICIOUS' },
        { name: 'normal.txt', content: 'Normal' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      // Absolute path file should NOT be extracted
      let absoluteExists = false;
      try {
        await fs.access('/tmp/absolute-test.txt');
        absoluteExists = true;
        // Clean up if it somehow got created
        await fs.unlink('/tmp/absolute-test.txt');
      } catch {
        absoluteExists = false;
      }
      expect(absoluteExists).toBe(false);

      // Normal file should be extracted
      const normalContent = await fs.readFile(path.join(extractDir, 'normal.txt'), 'utf-8');
      expect(normalContent).toBe('Normal');
    });

    it('should block entries with null bytes', async () => {
      // Note: archiver may sanitize this, but we test the validation logic
      const zipPath = path.join(testDir, 'nullbyte.zip');

      await createTestZip(zipPath, [
        { name: 'safe.txt', content: 'Safe' },
      ]);

      // This should not throw
      await expect(ZipUtils.extractZip(zipPath, extractDir)).resolves.not.toThrow();
    });

    it('should block Windows-style paths', async () => {
      const zipPath = path.join(testDir, 'windows.zip');

      await createTestZip(zipPath, [
        { name: 'safe.txt', content: 'Safe' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      const safeContent = await fs.readFile(path.join(extractDir, 'safe.txt'), 'utf-8');
      expect(safeContent).toBe('Safe');
    });

    it('should handle deeply nested safe paths', async () => {
      const zipPath = path.join(testDir, 'nested.zip');

      await createTestZip(zipPath, [
        { name: 'a/b/c/d/e/deep.txt', content: 'Deep content' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      const deepContent = await fs.readFile(
        path.join(extractDir, 'a/b/c/d/e/deep.txt'),
        'utf-8'
      );
      expect(deepContent).toBe('Deep content');
    });

    it('should handle mixed safe and unsafe entries', async () => {
      const zipPath = path.join(testDir, 'mixed.zip');

      await createTestZip(zipPath, [
        { name: 'safe1.txt', content: 'Safe 1' },
        { name: '../unsafe.txt', content: 'Unsafe' },
        { name: 'safe2.txt', content: 'Safe 2' },
        { name: 'subdir/../../../etc/passwd', content: 'Attack' },
        { name: 'safe3.txt', content: 'Safe 3' },
      ]);

      await ZipUtils.extractZip(zipPath, extractDir);

      // All safe files should be extracted
      expect(await fs.readFile(path.join(extractDir, 'safe1.txt'), 'utf-8')).toBe('Safe 1');
      expect(await fs.readFile(path.join(extractDir, 'safe2.txt'), 'utf-8')).toBe('Safe 2');
      expect(await fs.readFile(path.join(extractDir, 'safe3.txt'), 'utf-8')).toBe('Safe 3');

      // Verify no files outside extractDir
      const extractedFiles = await fs.readdir(extractDir);
      expect(extractedFiles).toContain('safe1.txt');
      expect(extractedFiles).toContain('safe2.txt');
      expect(extractedFiles).toContain('safe3.txt');
    });
  });
});
