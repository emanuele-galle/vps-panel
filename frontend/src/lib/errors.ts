/**
 * Error handling type-safe system for VPS Panel
 * Provides typed error classes, type guards, and error message extraction
 */

import { AxiosError } from 'axios';

// Base application error class
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Network-related errors (connection failures, timeouts)
export class NetworkError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(
      message,
      'NETWORK_ERROR',
      undefined,
      originalError ? { originalError: String(originalError) } : undefined
    );
    this.name = 'NetworkError';
  }
}

// API response errors (4xx, 5xx responses)
export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string = 'API_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, context);
    this.name = 'ApiError';
  }
}

// Authentication errors
export class AuthError extends AppError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, fields ? { fields } : undefined);
    this.name = 'ValidationError';
  }
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Type guard for AxiosError
export function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError === true
  );
}

// Type guard for standard Error
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// API error response structure
interface ApiErrorResponse {
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;

    if (data?.error?.message) {
      return data.error.message;
    }
    if (data?.message) {
      return data.message;
    }

    if (error.message) {
      return error.message;
    }

    if (!error.response) {
      return 'Errore di connessione al server';
    }

    const statusMessages: Record<number, string> = {
      400: 'Richiesta non valida',
      401: 'Non autorizzato',
      403: 'Accesso negato',
      404: 'Risorsa non trovata',
      409: 'Conflitto con lo stato attuale',
      422: 'Dati non processabili',
      429: 'Troppe richieste, riprova più tardi',
      500: 'Errore interno del server',
      502: 'Gateway non disponibile',
      503: 'Servizio temporaneamente non disponibile',
      504: 'Timeout del gateway',
    };

    return statusMessages[error.response.status] || 'Errore HTTP ' + error.response.status;
  }

  if (isError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return 'Si è verificato un errore imprevisto';
}

/**
 * Get error code from any error type
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.error?.code) {
      return data.error.code;
    }
    if (error.code) {
      return error.code;
    }
    return 'HTTP_' + (error.response?.status || 'UNKNOWN');
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Convert any error to ApiError for consistent handling
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (isAppError(error)) {
    return new ApiError(
      error.message,
      error.statusCode || 500,
      error.code,
      error.context
    );
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    return new ApiError(
      getErrorMessage(error),
      error.response?.status || 500,
      data?.error?.code || 'API_ERROR'
    );
  }

  return new ApiError(
    getErrorMessage(error),
    500,
    'UNKNOWN_ERROR'
  );
}

/**
 * Check if error is a network connectivity error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }

  if (isAxiosError(error)) {
    return !error.response && error.code !== 'ECONNABORTED';
  }

  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof AuthError) {
    return true;
  }

  if (isAppError(error)) {
    return error.statusCode === 401;
  }

  if (isAxiosError(error)) {
    return error.response?.status === 401;
  }

  return false;
}

/**
 * Check if error is retryable (transient errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response) return true;
    if (status && status >= 500) return true;
    if (status === 429) return true;
    return false;
  }

  if (error instanceof NetworkError) {
    return true;
  }

  return false;
}
