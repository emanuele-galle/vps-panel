/**
 * Centralized Logger Service
 * 
 * Uses pino for structured logging with the same configuration as Fastify.
 * This allows services and utilities to log without direct access to the Fastify app.
 */

import pino from 'pino';
import { isProduction } from '../config/env';

// Create pino logger with same config as Fastify
const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Helper to normalize arguments - supports both (msg) and (msg, obj) and (obj, msg) formats
function normalizeArgs(arg1: unknown, arg2?: unknown): { obj: object | undefined; msg: string } {
  if (typeof arg1 === 'string' && arg2 === undefined) {
    return { obj: undefined, msg: arg1 };
  }
  if (typeof arg1 === 'string' && typeof arg2 === 'object') {
    // console.log style: (msg, obj)
    return { obj: arg2 || undefined, msg: arg1 };
  }
  if (typeof arg1 === 'object' && typeof arg2 === 'string') {
    // pino style: (obj, msg)
    return { obj: arg1 || undefined, msg: arg2 };
  }
  if (typeof arg1 === 'object' && arg2 === undefined) {
    // Just object
    return { obj: arg1 || undefined, msg: '' };
  }
  // Fallback - convert to string
  return { obj: undefined, msg: String(arg1) + (arg2 !== undefined ? ' ' + String(arg2) : '') };
}

// Export logger methods for easy use
export const log = {
  debug: (arg1: unknown, arg2?: unknown) => {
    const { obj, msg } = normalizeArgs(arg1, arg2);
    if (obj) {
      logger.debug(obj, msg);
    } else {
      logger.debug(msg);
    }
  },
  info: (arg1: unknown, arg2?: unknown) => {
    const { obj, msg } = normalizeArgs(arg1, arg2);
    if (obj) {
      logger.info(obj, msg);
    } else {
      logger.info(msg);
    }
  },
  warn: (arg1: unknown, arg2?: unknown) => {
    const { obj, msg } = normalizeArgs(arg1, arg2);
    if (obj) {
      logger.warn(obj, msg);
    } else {
      logger.warn(msg);
    }
  },
  error: (arg1: unknown, arg2?: unknown) => {
    const { obj, msg } = normalizeArgs(arg1, arg2);
    if (obj) {
      logger.error(obj, msg);
    } else {
      logger.error(msg);
    }
  },
};

// Export raw pino logger for advanced use
export { logger };

// Default export for convenience
export default log;
