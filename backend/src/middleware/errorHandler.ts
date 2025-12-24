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