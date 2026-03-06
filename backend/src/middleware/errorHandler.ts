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
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }
}

/**
 * Create a standard validation error
 */
export const createValidationError = function(message: string): AppError {
  return new AppError(message, 400);
};

/**
 * Create a standard not found error
 */
export const createNotFoundError = function(resource: string): AppError {
  return new AppError(`${resource} not found`, 404);
};

/**
 * Create a standard unauthorized error
 */
export const createUnauthorizedError = function(message: string = 'Unauthorized'): AppError {
  return new AppError(message, 401);
};

/**
 * Create a standard forbidden error
 */
export const createForbiddenError = function(message: string = 'Forbidden'): AppError {
  return new AppError(message, 403);
};

/**
 * Create a standard server error
 */
export const createServerError = function(message: string = 'Internal server error'): AppError {
  return new AppError(message, 500);
};

/**
 * Extract error information safely from unknown error type
 * Modern TypeScript approach with type guards
 */
export interface ErrorInfo {
  statusCode: number;
  message: string;
  code?: string;
}

export const getErrorInfo = function(error: unknown, defaultCode: string = 'UNKNOWN_ERROR'): ErrorInfo {
  // Handle AppError instances (MOST IMPORTANT - must come first)
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  // Handle objects with statusCode property (includes AppError-like objects)
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const err = error as { message?: string; statusCode: number; code?: string };
    const result: ErrorInfo = {
      statusCode: err.statusCode,
      message: err.message || 'Unknown error',
    };
    // Only include code property if it exists (exactOptionalPropertyTypes compliance)
    if (err.code !== undefined) {
      result.code = err.code;
    }
    return result;
  }

  // Handle standard Error instances (without statusCode)
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

  // Handle objects with message property (non-standard errors without statusCode)
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = error as { message?: string; code?: string };
    const result: ErrorInfo = {
      statusCode: 500,
      message: err.message || 'Unknown error',
    };
    // Only include code property if it exists
    if (err.code !== undefined) {
      result.code = err.code;
    }
    return result;
  }

  // Fallback for completely unknown errors
  return {
    statusCode: 500,
    message: 'Unknown error',
    code: defaultCode,
  };
};