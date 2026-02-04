/**
 * Log Sanitizer
 *
 * Sanitizes sensitive data from logs to prevent credential leaks.
 * Redacts passwords, tokens, API keys, and other sensitive patterns.
 */

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];

const SENSITIVE_PATTERNS = [
  /password["\s:=]+([^\s"]+)/gi,
  /token["\s:=]+([^\s"]+)/gi,
  /bearer\s+([^\s"]+)/gi,
];

/**
 * Sanitize sensitive data from any value
 */
export function sanitizeForLog(obj: unknown): unknown {
  // Handle strings - apply pattern matching
  if (typeof obj === 'string') {
    let sanitized = obj;
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        // Keep first 4 chars, replace rest with ***
        return match.replace(/([^\s"]{4})[^\s"]*/g, '$1***');
      });
    });
    return sanitized;
  }

  // Handle primitives
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeForLog(value);
    }
  }
  return result;
}
