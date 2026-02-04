/**
 * Logger service for VPS Panel
 * Replaces console.* statements with structured logging
 * Only shows error level in production, all levels in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  component?: string;
}

interface LoggerOptions {
  component?: string;
  enabled?: boolean;
}

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  private component?: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.component = options.component;
    this.enabled = options.enabled ?? true;
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      component: this.component,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    
    // In production, only log errors
    if (!isDevelopment && level !== 'error') {
      return false;
    }
    
    return true;
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const prefix = entry.component ? '[' + entry.component + ']' : '[App]';
    const timestamp = isDevelopment ? '' : entry.timestamp + ' ';
    const contextStr = entry.context && Object.keys(entry.context).length > 0
      ? ' ' + JSON.stringify(entry.context)
      : '';

    const formattedMessage = timestamp + prefix + ' ' + entry.message + contextStr;

    switch (entry.level) {
      case 'debug':
        if (isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        // In production, you could send to error tracking service here
        // e.g., Sentry.captureException(...)
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatEntry('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatEntry('error', message, context));
  }

  /**
   * Factory method to create a logger with a component prefix
   */
  static create(component: string): Logger {
    return new Logger({ component });
  }
}

// Default logger instance
export const logger = new Logger();

// Export class for creating component-specific loggers
export { Logger };

// Export types
export type { LogLevel, LogEntry, LoggerOptions };

/**
 * Helper function to log errors with proper context extraction
 * Use this to replace console.error throughout the codebase
 */
export function logError(
  error: unknown,
  component?: string,
  additionalContext?: Record<string, unknown>
): void {
  const log = component ? Logger.create(component) : logger;
  
  let errorMessage: string;
  let errorContext: Record<string, unknown> = { ...additionalContext };

  if (error instanceof Error) {
    errorMessage = error.message;
    errorContext = {
      ...errorContext,
      errorName: error.name,
      ...(isDevelopment && error.stack ? { stack: error.stack } : {}),
    };
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    errorMessage = 'Unknown error occurred';
    errorContext = { ...errorContext, rawError: String(error) };
  }

  log.error(errorMessage, errorContext);
}

/**
 * Helper to log API errors specifically
 */
export function logApiError(
  error: unknown,
  endpoint: string,
  method: string = 'GET'
): void {
  logError(error, 'API', {
    endpoint,
    method,
  });
}

/**
 * Helper to log store action errors
 */
export function logStoreError(
  error: unknown,
  storeName: string,
  action: string
): void {
  logError(error, storeName, {
    action,
  });
}

/**
 * Helper to log component errors
 */
export function logComponentError(
  error: unknown,
  componentName: string,
  action?: string
): void {
  logError(error, componentName, action ? { action } : undefined);
}
