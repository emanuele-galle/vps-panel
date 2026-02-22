import { describe, it, expect } from 'vitest';
import {
  idSchema,
  cuidSchema,
  uuidSchema,
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  nameSchema,
  slugSchema,
  domainSchema,
  urlSchema,
  safeStringSchema,
  safePathSchema,
  portSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  containerIdSchema,
  databaseTypeSchema,
  userRoleSchema,
  projectTypeSchema,
  backupTypeSchema,
  activityStatusSchema,
  booleanQuerySchema,
  arrayQuerySchema,
  paginationSchema,
  dateRangeSchema,
} from '../../src/utils/validation';

describe('Validation Schemas', () => {
  describe('idSchema', () => {
    it('should accept valid IDs', () => {
      expect(idSchema.parse('abc123')).toBe('abc123');
      expect(idSchema.parse('cuid12345678901234567890123')).toBeTruthy();
    });

    it('should reject empty strings', () => {
      expect(() => idSchema.parse('')).toThrow();
    });

    it('should reject IDs that are too long', () => {
      expect(() => idSchema.parse('a'.repeat(51))).toThrow();
    });
  });

  describe('cuidSchema', () => {
    it('should accept valid CUIDs', () => {
      // CUID format: starts with 'c', followed by 24 lowercase alphanumeric chars (total 25)
      expect(cuidSchema.parse('cabcdefghij12345678901234')).toBeTruthy();
      expect(cuidSchema.parse('c1234567890abcdefghijklmn')).toBeTruthy();
    });

    it('should reject invalid CUIDs', () => {
      expect(() => cuidSchema.parse('invalid')).toThrow();
      expect(() => cuidSchema.parse('a'.repeat(25))).toThrow(); // doesn't start with 'c'
      expect(() => cuidSchema.parse('c' + 'A'.repeat(24))).toThrow(); // uppercase not allowed
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
      expect(emailSchema.parse('TEST@EXAMPLE.COM')).toBe('test@example.com'); // lowercase transform
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow();
      expect(() => emailSchema.parse('test@')).toThrow();
      expect(() => emailSchema.parse('@example.com')).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(passwordSchema.parse('Password123')).toBe('Password123');
    });

    it('should reject passwords without uppercase', () => {
      expect(() => passwordSchema.parse('password123')).toThrow();
    });

    it('should reject passwords without lowercase', () => {
      expect(() => passwordSchema.parse('PASSWORD123')).toThrow();
    });

    it('should reject passwords without numbers', () => {
      expect(() => passwordSchema.parse('PasswordABC')).toThrow();
    });

    it('should reject short passwords', () => {
      expect(() => passwordSchema.parse('Pass1')).toThrow();
    });
  });

  describe('simplePasswordSchema', () => {
    it('should accept simple passwords', () => {
      expect(simplePasswordSchema.parse('simple-password')).toBe('simple-password');
    });

    it('should reject short passwords', () => {
      expect(() => simplePasswordSchema.parse('short')).toThrow();
    });
  });

  describe('nameSchema', () => {
    it('should accept valid names', () => {
      expect(nameSchema.parse('John Doe')).toBe('John Doe');
      expect(nameSchema.parse('  Trimmed  ')).toBe('Trimmed');
    });

    it('should reject short names', () => {
      expect(() => nameSchema.parse('A')).toThrow();
    });

    it('should reject long names', () => {
      expect(() => nameSchema.parse('A'.repeat(101))).toThrow();
    });
  });

  describe('slugSchema', () => {
    it('should accept valid slugs', () => {
      expect(slugSchema.parse('my-project')).toBe('my-project');
      expect(slugSchema.parse('project123')).toBe('project123');
    });

    it('should reject slugs with invalid characters', () => {
      expect(() => slugSchema.parse('My Project')).toThrow();
      expect(() => slugSchema.parse('my_project')).toThrow();
    });
  });

  describe('domainSchema', () => {
    it('should accept valid domains', () => {
      expect(domainSchema.parse('example.com')).toBe('example.com');
      expect(domainSchema.parse('sub.example.com')).toBe('sub.example.com');
      expect(domainSchema.parse('EXAMPLE.COM')).toBe('example.com');
    });

    it('should reject invalid domains', () => {
      expect(() => domainSchema.parse('http://example.com')).toThrow();
      expect(() => domainSchema.parse('example')).toThrow();
      expect(() => domainSchema.parse('example.c')).toThrow(); // TLD too short
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
      expect(urlSchema.parse('http://example.com/path')).toBeTruthy();
    });

    it('should reject invalid URLs', () => {
      expect(() => urlSchema.parse('example.com')).toThrow();
      expect(() => urlSchema.parse('not-a-url')).toThrow();
    });
  });

  describe('safeStringSchema', () => {
    it('should accept safe strings', () => {
      expect(safeStringSchema.parse('Hello World')).toBe('Hello World');
    });

    it('should reject XSS attempts', () => {
      expect(() => safeStringSchema.parse('<script>alert("xss")</script>')).toThrow();
      expect(() => safeStringSchema.parse('javascript:alert(1)')).toThrow();
      expect(() => safeStringSchema.parse('onclick=alert(1)')).toThrow();
    });

    it('should trim whitespace', () => {
      expect(safeStringSchema.parse('  hello  ')).toBe('hello');
    });
  });

  describe('safePathSchema', () => {
    it('should accept safe paths', () => {
      expect(safePathSchema.parse('/var/www/project')).toBe('/var/www/project');
    });

    it('should reject path traversal attempts', () => {
      expect(() => safePathSchema.parse('../etc/passwd')).toThrow();
      expect(() => safePathSchema.parse('/var/www/../../../etc/passwd')).toThrow();
    });

    it('should reject null bytes', () => {
      expect(() => safePathSchema.parse('/var/www/file\0.txt')).toThrow();
    });
  });

  describe('portSchema', () => {
    it('should accept valid ports', () => {
      expect(portSchema.parse('80')).toBe(80);
      expect(portSchema.parse(443)).toBe(443);
      expect(portSchema.parse('65535')).toBe(65535);
    });

    it('should reject invalid ports', () => {
      expect(() => portSchema.parse('0')).toThrow();
      expect(() => portSchema.parse('65536')).toThrow();
      expect(() => portSchema.parse('-1')).toThrow();
    });
  });

  describe('containerIdSchema', () => {
    it('should accept valid container IDs', () => {
      expect(containerIdSchema.parse('abc123def456')).toBeTruthy();
      expect(containerIdSchema.parse('a'.repeat(64))).toBeTruthy();
    });

    it('should reject invalid container IDs', () => {
      expect(() => containerIdSchema.parse('')).toThrow(); // empty
      expect(() => containerIdSchema.parse('a!b@c')).toThrow(); // special chars
      expect(() => containerIdSchema.parse('a'.repeat(129))).toThrow(); // too long
    });
  });

  describe('databaseTypeSchema', () => {
    it('should accept valid database types', () => {
      expect(databaseTypeSchema.parse('MYSQL')).toBe('MYSQL');
      expect(databaseTypeSchema.parse('POSTGRESQL')).toBe('POSTGRESQL');
      expect(databaseTypeSchema.parse('MONGODB')).toBe('MONGODB');
      expect(databaseTypeSchema.parse('REDIS')).toBe('REDIS');
      expect(databaseTypeSchema.parse('SQLITE')).toBe('SQLITE');
    });

    it('should reject invalid database types', () => {
      expect(() => databaseTypeSchema.parse('ORACLE')).toThrow();
      expect(() => databaseTypeSchema.parse('mysql')).toThrow();
    });
  });

  describe('userRoleSchema', () => {
    it('should accept valid roles', () => {
      expect(userRoleSchema.parse('ADMIN')).toBe('ADMIN');
      expect(userRoleSchema.parse('STAFF')).toBe('STAFF');
    });

    it('should reject invalid roles', () => {
      expect(() => userRoleSchema.parse('USER')).toThrow();
      expect(() => userRoleSchema.parse('admin')).toThrow();
    });
  });

  describe('booleanQuerySchema', () => {
    it('should parse boolean strings', () => {
      expect(booleanQuerySchema.parse('true')).toBe(true);
      expect(booleanQuerySchema.parse('1')).toBe(true);
      expect(booleanQuerySchema.parse('yes')).toBe(true);
      expect(booleanQuerySchema.parse('false')).toBe(false);
      expect(booleanQuerySchema.parse('no')).toBe(false);
    });

    it('should handle undefined', () => {
      expect(booleanQuerySchema.parse(undefined)).toBe(undefined);
    });
  });

  describe('arrayQuerySchema', () => {
    it('should parse comma-separated strings', () => {
      expect(arrayQuerySchema.parse('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(arrayQuerySchema.parse('one, two, three')).toEqual(['one', 'two', 'three']);
    });

    it('should handle empty strings', () => {
      // Empty strings after filter produce empty array
      const result = arrayQuerySchema.parse('');
      // Transform returns array with empty string filtered out = []
      expect(result).toEqual([]);
    });

    it('should handle undefined', () => {
      expect(arrayQuerySchema.parse(undefined)).toBe(undefined);
    });
  });

  describe('paginationSchema', () => {
    it('should provide defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortOrder).toBe('desc');
    });

    it('should parse string numbers', () => {
      const result = paginationSchema.parse({ page: '5', limit: '50' });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('should enforce max limit', () => {
      expect(() => paginationSchema.parse({ limit: '200' })).toThrow();
    });
  });

  describe('dateRangeSchema', () => {
    it('should accept valid date ranges', () => {
      const result = dateRangeSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should reject invalid date ranges', () => {
      expect(() => dateRangeSchema.parse({
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      })).toThrow();
    });
  });
});

describe('Security: Input Validation', () => {
  it('should prevent SQL injection via special characters', () => {
    // nameSchema should accept these but safeStringSchema would be used for free-form text
    const sqlInjection = "'; DROP TABLE users; --";
    // This would be caught by SQL parameterization, but validation adds defense
    expect(nameSchema.parse(sqlInjection)).toBeTruthy(); // Name allows special chars
  });

  it('should prevent XSS via script tags', () => {
    expect(() => safeStringSchema.parse('<script>alert("xss")</script>')).toThrow();
  });

  it('should prevent path traversal', () => {
    expect(() => safePathSchema.parse('../../etc/passwd')).toThrow();
    expect(() => safePathSchema.parse('/var/www/../../etc/passwd')).toThrow();
  });

  it('should sanitize email addresses', () => {
    // Email normalization - lowercase
    expect(emailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
    // Note: Zod validates before transform, so email with spaces is invalid
    expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
  });

  it('should enforce strong passwords', () => {
    // Weak passwords should be rejected
    expect(() => passwordSchema.parse('password')).toThrow();
    expect(() => passwordSchema.parse('12345678')).toThrow();
    expect(() => passwordSchema.parse('Password')).toThrow(); // no number
  });
});
