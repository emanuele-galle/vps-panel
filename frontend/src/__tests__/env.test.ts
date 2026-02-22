import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

describe('env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_PANEL_DOMAIN;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use default localhost when no env vars set', async () => {
    const env = await import('@/lib/env');
    expect(env.panelDomain).toBe('localhost');
    expect(env.apiUrl).toBe('http://localhost:3001/api');
  });

  it('should generate correct adminerUrl', async () => {
    const env = await import('@/lib/env');
    expect(env.adminerUrl).toBe('https://db.localhost');
  });

  it('should generate correct fileBrowserBaseUrl', async () => {
    const env = await import('@/lib/env');
    expect(env.fileBrowserBaseUrl).toBe('https://files.localhost');
  });

  it('should generate correct gdriveBackupFolder', async () => {
    const env = await import('@/lib/env');
    expect(env.gdriveBackupFolder).toBe('VPS-localhost-backups');
  });

  it('should use custom NEXT_PUBLIC_PANEL_DOMAIN', async () => {
    process.env.NEXT_PUBLIC_PANEL_DOMAIN = 'example.com';
    const env = await import('@/lib/env');
    expect(env.panelDomain).toBe('example.com');
    expect(env.adminerUrl).toBe('https://db.example.com');
    expect(env.fileBrowserBaseUrl).toBe('https://files.example.com');
  });

  it('should replace dots in gdriveBackupFolder', async () => {
    process.env.NEXT_PUBLIC_PANEL_DOMAIN = 'fodivps1.cloud';
    const env = await import('@/lib/env');
    expect(env.gdriveBackupFolder).toBe('VPS-fodivps1-cloud-backups');
  });

  it('should use custom NEXT_PUBLIC_API_URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    const env = await import('@/lib/env');
    expect(env.apiUrl).toBe('https://api.example.com');
  });
});
