/**
 * Error Handling Utilities for Hono Integration
 *
 * Provides backward compatibility for existing error handling
 * while integrating with Hono's error handling system.
 */

/**
 * Custom error class for application-specific errors
 * Maintains compatibility with existing code structure
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }

  /**
   * Convert AppError to Hono-compatible response format
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      statusCode: this.statusCode,
      name: this.name,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * Create a standard validation error
 */
export function createValidationError(message: string): AppError {
  return new AppError(message, 400);
}

/**
 * Create a standard not found error
 */
export function createNotFoundError(resource: string): AppError {
  return new AppError(`${resource} not found`, 404);
}

/**
 * Create a standard unauthorized error
 */
export function createUnauthorizedError(message: string = 'Unauthorized'): AppError {
  return new AppError(message, 401);
}

/**
 * Create a standard forbidden error
 */
export function createForbiddenError(message: string = 'Forbidden'): AppError {
  return new AppError(message, 403);
}

/**
 * Create a standard server error
 */
export function createServerError(message: string = 'Internal server error'): AppError {
  return new AppError(message, 500);
}

/**
 * Extract error information safely from unknown error type
 * Modern TypeScript approach with type guards
 */
export type AppStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 500 | 503;

export interface ErrorInfo {
  statusCode: AppStatusCode;
  message: string;
  code?: string;
}

export function getErrorInfo(error: unknown, defaultCode: string = 'UNKNOWN_ERROR'): ErrorInfo {
  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode as AppStatusCode,
      message: error.message,
    };
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return {
      statusCode: 500,
      message: error.message,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      statusCode: 500,
      message: error,
    };
  }

  // Handle objects with message property (non-standard errors)
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = error as { message?: string; statusCode?: number; code?: string };
    return {
      statusCode: (err.statusCode || 500) as AppStatusCode,
      message: err.message || 'Unknown error',
      code: err.code,
    };
  }

  // Fallback for completely unknown errors
  return {
    statusCode: 500,
    message: 'Unknown error',
    code: defaultCode,
  };
}