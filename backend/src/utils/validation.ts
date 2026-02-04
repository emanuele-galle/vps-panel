/**
 * Shared Zod Validation Schemas
 *
 * Reusable validation schemas for common patterns across all controllers.
 * Centralizes validation logic for consistency and maintainability.
 */

import { z } from 'zod';

// ============================================
// COMMON ID PATTERNS
// ============================================

/**
 * CUID validation (Prisma default ID format)
 * Format: starts with 'c', 25 chars alphanumeric
 */
export const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/, {
  message: 'Invalid ID format',
});

/**
 * UUID v4 validation
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format',
});

/**
 * Generic ID that accepts both CUID and UUID
 */
export const idSchema = z.string().min(1, 'ID is required').max(50, 'ID too long');

/**
 * Params with single ID
 */
export const idParamsSchema = z.object({
  id: idSchema,
});

// ============================================
// PAGINATION
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================
// DATE RANGES
// ============================================

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate must be before endDate' }
);

// ============================================
// USER INPUT SANITIZATION
// ============================================

/**
 * Safe string that strips dangerous characters
 * Used for user-provided names, descriptions, etc.
 */
export const safeStringSchema = z.string()
  .min(1, 'Field is required')
  .max(500, 'Field too long')
  .transform((val) => val.trim())
  .refine((val) => !/<script|javascript:|on\w+=/i.test(val), {
    message: 'Invalid characters detected',
  });

/**
 * Name field (for users, projects, etc.)
 */
export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .transform((val) => val.trim());

/**
 * Slug field (URL-safe identifier)
 */
export const slugSchema = z.string()
  .min(2, 'Slug must be at least 2 characters')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .transform((val) => val.toLowerCase());

/**
 * Description/notes field
 */
export const descriptionSchema = z.string()
  .max(2000, 'Description too long')
  .transform((val) => val.trim())
  .optional();

// ============================================
// EMAIL VALIDATION
// ============================================

export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((val) => val.toLowerCase().trim());

// ============================================
// PASSWORD VALIDATION
// ============================================

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[a-z]/.test(val),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

/**
 * Simple password (for database credentials, etc.)
 * Less strict than user passwords
 */
export const simplePasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters');

// ============================================
// DOMAIN VALIDATION
// ============================================

/**
 * Domain name validation
 * Allows subdomains, but not protocols or paths
 */
export const domainSchema = z.string()
  .min(3, 'Domain must be at least 3 characters')
  .max(255, 'Domain too long')
  .regex(
    /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
    'Invalid domain format'
  )
  .transform((val) => val.toLowerCase().trim());

/**
 * URL validation (full URL with protocol)
 */
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long');

// ============================================
// DATABASE TYPES
// ============================================

export const databaseTypeSchema = z.enum([
  'MYSQL',
  'POSTGRESQL',
  'MONGODB',
  'REDIS',
  'SQLITE',
]);

// ============================================
// USER ROLES
// ============================================

export const userRoleSchema = z.enum(['ADMIN', 'STAFF']);

// ============================================
// PROJECT TYPES
// ============================================

export const projectTypeSchema = z.enum([
  'NODEJS',
  'NEXTJS',
  'STATIC',
  'WORDPRESS',
  'CUSTOM',
]);

// ============================================
// CONTAINER ACTIONS
// ============================================

/**
 * Container identifier - accepts both Docker ID (hex) and container name
 * ID format: 12-64 hex characters
 * Name format: alphanumeric with dashes and underscores
 */
export const containerIdSchema = z.string()
  .min(1, 'Container identifier is required')
  .max(128, 'Container identifier too long')
  .refine(
    (val) => /^[a-f0-9]{12,64}$/.test(val) || /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(val),
    'Invalid container identifier format (must be hex ID or valid container name)'
  );

// ============================================
// FILE PATHS
// ============================================

/**
 * Safe file path that prevents traversal
 */
export const safePathSchema = z.string()
  .max(4096, 'Path too long')
  .refine(
    (val) => !val.includes('..'),
    'Path traversal not allowed'
  )
  .refine(
    (val) => !val.includes('\0'),
    'Null bytes not allowed in path'
  );

// ============================================
// NUMERIC RANGES
// ============================================

export const portSchema = z.coerce.number()
  .int('Port must be an integer')
  .min(1, 'Port must be at least 1')
  .max(65535, 'Port must be less than 65536');

export const positiveIntSchema = z.coerce.number()
  .int('Must be an integer')
  .positive('Must be positive');

export const nonNegativeIntSchema = z.coerce.number()
  .int('Must be an integer')
  .nonnegative('Must be non-negative');

// ============================================
// QUERY PARAMETER HELPERS
// ============================================

/**
 * Boolean from query string
 * Accepts: 'true', '1', 'yes' as true
 */
export const booleanQuerySchema = z.string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return ['true', '1', 'yes'].includes(val.toLowerCase());
  });

/**
 * Array from comma-separated query string
 */
export const arrayQuerySchema = z.string()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === '') return [];
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  });

// ============================================
// BACKUP TYPES
// ============================================

export const backupTypeSchema = z.enum(['system', 'full', 'project']);

// ============================================
// ACTIVITY LOG STATUS
// ============================================

export const activityStatusSchema = z.enum(['SUCCESS', 'FAILURE', 'PENDING']);

// ============================================
// COMMON COMBINED SCHEMAS
// ============================================

/**
 * Standard list query params
 */
export const listQuerySchema = paginationSchema.merge(
  z.object({
    search: z.string().max(200).optional(),
  })
);

/**
 * Standard date-filtered list query params
 */
export const dateFilteredListSchema = listQuerySchema.and(dateRangeSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate and parse request body
 * Throws ZodError on validation failure (handled by error middleware)
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): z.infer<T> {
  return schema.parse(body);
}

/**
 * Validate and parse request params
 */
export function validateParams<T extends z.ZodType>(
  schema: T,
  params: unknown
): z.infer<T> {
  return schema.parse(params);
}

/**
 * Validate and parse request query
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  query: unknown
): z.infer<T> {
  return schema.parse(query);
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParse<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
