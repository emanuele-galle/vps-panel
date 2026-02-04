/**
 * Tests for Docker service container filtering logic
 *
 * These tests ensure that:
 * 1. STAFF users can only see containers from their assigned projects
 * 2. Container matching works with various slug/name patterns
 * 3. VPS Console infrastructure containers are always hidden from STAFF
 */

import { describe, it, expect } from 'vitest';

/**
 * Helper function to check if a container belongs to any accessible project
 * This is a copy of the logic from docker.service.ts for testing purposes
 */
function containerBelongsToProject(
  containerName: string,
  composeProject: string,
  accessibleSlugs: Set<string>
): boolean {
  return Array.from(accessibleSlugs).some((slug) => {
    const projectName = composeProject.toLowerCase();
    const cName = containerName.toLowerCase();
    // Extract base slug without hash suffix (e.g., "ristorante-generico" from "ristorante-generico-bb2e1b11")
    const baseSlug = slug.replace(/-[a-f0-9]{8}$/, '').toLowerCase();

    return (
      projectName.includes(slug) ||
      slug.includes(projectName) ||
      cName.includes(slug) ||
      cName.includes(baseSlug) ||
      cName.startsWith(baseSlug)
    );
  });
}

describe('containerBelongsToProject', () => {
  describe('slug with hash suffix matching', () => {
    it('should match container when slug has hash suffix but container name does not', () => {
      const accessibleSlugs = new Set(['ristorante-generico-bb2e1b11']);

      // Container name: ristorante-generico-frontend (no hash)
      // Slug: ristorante-generico-bb2e1b11 (with hash)
      expect(
        containerBelongsToProject(
          'ristorante-generico-frontend',
          'import-cmieueg4c0001f0a6de424spp',
          accessibleSlugs
        )
      ).toBe(true);

      expect(
        containerBelongsToProject(
          'ristorante-generico-backend',
          'import-cmieueg4c0001f0a6de424spp',
          accessibleSlugs
        )
      ).toBe(true);
    });

    it('should match container when both have same base slug', () => {
      const accessibleSlugs = new Set(['my-project-12345678']);

      expect(
        containerBelongsToProject('my-project-app', 'my-project', accessibleSlugs)
      ).toBe(true);

      expect(
        containerBelongsToProject('my-project-db', 'my-project', accessibleSlugs)
      ).toBe(true);
    });

    it('should extract 8-character hex suffix correctly', () => {
      const accessibleSlugs = new Set(['project-name-abcd1234']);

      // Should match: base slug is "project-name"
      expect(
        containerBelongsToProject('project-name-frontend', '', accessibleSlugs)
      ).toBe(true);

      // Different 8-char hex suffix should still work (extracts same base)
      const accessibleSlugs2 = new Set(['project-name-99887766']);
      expect(
        containerBelongsToProject('project-name-backend', '', accessibleSlugs2)
      ).toBe(true);
    });
  });

  describe('exact slug matching', () => {
    it('should match when container name contains the exact slug', () => {
      const accessibleSlugs = new Set(['my-website']);

      expect(
        containerBelongsToProject('my-website-frontend', 'my-website', accessibleSlugs)
      ).toBe(true);
    });

    it('should match when compose project matches slug', () => {
      const accessibleSlugs = new Set(['my-app']);

      expect(containerBelongsToProject('something-else', 'my-app', accessibleSlugs)).toBe(
        true
      );
    });
  });

  describe('no access scenarios', () => {
    it('should not match when container belongs to different project', () => {
      const accessibleSlugs = new Set(['project-a-12345678']);

      expect(
        containerBelongsToProject('project-b-frontend', 'project-b', accessibleSlugs)
      ).toBe(false);
    });

    it('should not match when accessible slugs is empty', () => {
      const accessibleSlugs = new Set<string>();

      expect(
        containerBelongsToProject('any-container', 'any-project', accessibleSlugs)
      ).toBe(false);
    });

    it('should not match unrelated containers', () => {
      const accessibleSlugs = new Set(['ristorante-generico-bb2e1b11']);

      expect(
        containerBelongsToProject('vps-panel-backend', 'vps-panel', accessibleSlugs)
      ).toBe(false);

      expect(
        containerBelongsToProject('other-app-frontend', 'other-app', accessibleSlugs)
      ).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('should match regardless of case', () => {
      const accessibleSlugs = new Set(['My-Project-12345678']);

      expect(
        containerBelongsToProject('MY-PROJECT-FRONTEND', 'my-project', accessibleSlugs)
      ).toBe(true);

      expect(
        containerBelongsToProject('my-project-backend', 'MY-PROJECT', accessibleSlugs)
      ).toBe(true);
    });
  });

  describe('various naming patterns', () => {
    it('should handle import-prefixed compose project names', () => {
      const accessibleSlugs = new Set(['ristorante-generico-bb2e1b11']);

      // Real-world scenario: compose project is "import-cmieueg4c0001f0a6de424spp"
      // Container name is "ristorante-generico-frontend"
      // Slug is "ristorante-generico-bb2e1b11"
      expect(
        containerBelongsToProject(
          'ristorante-generico-frontend',
          'import-cmieueg4c0001f0a6de424spp',
          accessibleSlugs
        )
      ).toBe(true);
    });

    it('should match when slug is substring of compose project', () => {
      const accessibleSlugs = new Set(['my-app']);

      expect(
        containerBelongsToProject('container', 'my-app-production', accessibleSlugs)
      ).toBe(true);
    });

    it('should match when compose project is substring of slug', () => {
      const accessibleSlugs = new Set(['my-app-production-12345678']);

      expect(containerBelongsToProject('container', 'my-app', accessibleSlugs)).toBe(
        true
      );
    });
  });
});

describe('VPS Console container filtering', () => {
  const VPS_CONSOLE_CONTAINER_NAMES = [
    'vps-panel-backend',
    'vps-panel-frontend',
    'vps-panel-postgres',
    'vps-panel-redis',
    'vps-panel-traefik',
    'vps-panel-filebrowser',
    'vps-panel-filebrowser-system',
    'vps-panel-adminer',
    'traefik',
    'adminer',
  ];

  function isVpsConsoleContainer(containerName: string): boolean {
    return VPS_CONSOLE_CONTAINER_NAMES.some((name) =>
      containerName.toLowerCase().includes(name.toLowerCase())
    );
  }

  it('should identify VPS Console containers', () => {
    expect(isVpsConsoleContainer('vps-panel-backend')).toBe(true);
    expect(isVpsConsoleContainer('vps-panel-frontend')).toBe(true);
    expect(isVpsConsoleContainer('vps-panel-postgres')).toBe(true);
    expect(isVpsConsoleContainer('traefik')).toBe(true);
    expect(isVpsConsoleContainer('adminer')).toBe(true);
  });

  it('should not identify user project containers as VPS Console', () => {
    expect(isVpsConsoleContainer('ristorante-generico-frontend')).toBe(false);
    expect(isVpsConsoleContainer('my-app-backend')).toBe(false);
    expect(isVpsConsoleContainer('user-postgres-db')).toBe(false);
  });
});
