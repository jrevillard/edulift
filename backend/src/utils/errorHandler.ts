/**
 * Professional Error Handling Utility for EduLift Backend
 *
 * This utility provides consistent error handling across all controllers and services.
 * It normalizes different error types and provides appropriate HTTP status codes.
 */

export interface ServiceError {
  code: string;
  message: string;
  statusCode?: number;
  details?: any;
  isServiceError: true; // Type discriminator
}

export interface NormalizedError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
  originalError?: unknown;
  stack?: string | undefined;
}

/**
 * Standard error codes used across the application
 */
export enum ErrorCodes {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authorization errors (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Business logic errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Service unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Maps error codes to appropriate HTTP status codes
 */
const ERROR_CODE_STATUS_MAP: Record<string, number> = {
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,

  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,

  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,

  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.ALREADY_EXISTS]: 409,
  [ErrorCodes.DUPLICATE_RESOURCE]: 409,

  [ErrorCodes.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCodes.INVALID_OPERATION]: 422,

  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,

  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,

  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Creates a standardized service error object
 */
export const createServiceError = function(
  code: string,
  message: string,
  statusCode?: number,
  details?: any,
): ServiceError {
  return {
    code,
    message,
    statusCode: statusCode || ERROR_CODE_STATUS_MAP[code] || 500,
    details,
    isServiceError: true,
  };
};

/**
 * Type guard to check if an object is a ServiceError
 */
export const isServiceError = function(error: any): error is ServiceError {
  return Boolean(error && typeof error === 'object' && error.isServiceError === true);
};

/**
 * Normalizes any error into a standardized format
 *
 * This function handles:
 * - ServiceError objects (our custom error format)
 * - Error instances (standard JavaScript errors)
 * - String errors
 * - Plain objects with error information
 * - Unknown/error types
 *
 * @param error - The error to normalize
 * @returns NormalizedError object with consistent structure
 */
export const normalizeError = function(error: unknown): NormalizedError {
  // Handle our custom ServiceError objects
  if (isServiceError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode || 500,
      details: error.details,
      originalError: error,
      stack: (error as any).stack, // ServiceError might include stack
    };
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    // Try to extract error code from error name or message
    let code = ErrorCodes.INTERNAL_ERROR;
    let statusCode = 500;

    // Common error patterns
    if (error.name === 'ValidationError') {
      code = ErrorCodes.VALIDATION_ERROR;
      statusCode = 400;
    } else if (error.name === 'UnauthorizedError') {
      code = ErrorCodes.UNAUTHORIZED;
      statusCode = 401;
    } else if (error.message.includes('not found')) {
      code = ErrorCodes.NOT_FOUND;
      statusCode = 404;
    } else if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      code = ErrorCodes.ALREADY_EXISTS;
      statusCode = 409;
    } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
      code = ErrorCodes.FORBIDDEN;
      statusCode = 403;
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      code = ErrorCodes.VALIDATION_ERROR;
      statusCode = 400;
    }

    return {
      message: error.message,
      code,
      statusCode,
      details: undefined,
      originalError: error,
      stack: error.stack || undefined,
    };
  }

  // Handle plain objects with error-like structure
  if (error && typeof error === 'object') {
    const obj = error as Record<string, any>;

    // Handle objects with code and message properties
    if (obj.code && obj.message) {
      return {
        message: obj.message,
        code: String(obj.code),
        statusCode: obj.statusCode || ERROR_CODE_STATUS_MAP[String(obj.code)] || 500,
        details: obj.details,
        originalError: error,
      };
    }

    // Handle objects with just a message property
    if (obj.message) {
      return {
        message: String(obj.message),
        code: ErrorCodes.INTERNAL_ERROR,
        statusCode: 500,
        details: obj,
        originalError: error,
        stack: undefined,
      };
    }

    // Handle other objects - convert to string representation
    const errorString = JSON.stringify(error);
    return {
      message: errorString,
      code: ErrorCodes.INTERNAL_ERROR,
      statusCode: 500,
      details: error,
      originalError: error,
      stack: undefined,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    // Try to infer error type from string content
    let code = ErrorCodes.INTERNAL_ERROR;
    let statusCode = 500;

    if (error.includes('not found')) {
      code = ErrorCodes.NOT_FOUND;
      statusCode = 404;
    } else if (error.includes('already exists') || error.includes('duplicate')) {
      code = ErrorCodes.ALREADY_EXISTS;
      statusCode = 409;
    } else if (error.includes('forbidden') || error.includes('permission')) {
      code = ErrorCodes.FORBIDDEN;
      statusCode = 403;
    } else if (error.includes('validation') || error.includes('invalid')) {
      code = ErrorCodes.VALIDATION_ERROR;
      statusCode = 400;
    }

    return {
      message: error,
      code,
      statusCode,
      details: undefined,
      originalError: error,
    };
  }

  // Handle null/undefined
  if (error === null || error === undefined) {
    return {
      message: 'Unknown error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
      statusCode: 500,
      details: { errorType: 'null_undefined' },
      originalError: error,
    };
  }

  // Fallback for unknown types
  return {
    message: String(error),
    code: ErrorCodes.INTERNAL_ERROR,
    statusCode: 500,
    details: { errorType: typeof error, value: error },
    originalError: error,
  };
};

/**
 * Extracts just the error message for logging purposes
 * This is a drop-in replacement for the problematic pattern
 */
export const getErrorMessage = function(error: unknown): string {
  return normalizeError(error).message;
};

/**
 * Extracts both message and code for detailed logging
 */
export const getErrorForLogging = function(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
  stack?: string | undefined;
} {
  const normalized = normalizeError(error);
  const result: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
    stack?: string;
  } = {
    message: normalized.message,
    code: normalized.code,
    statusCode: normalized.statusCode,
    details: normalized.details,
  };

  if (normalized.stack) {
    result.stack = normalized.stack;
  }

  return result;
};

/**
 * Creates an appropriate HTTP error response body
 */
export const createErrorResponse = function(error: unknown): {
  success: false;
  error: string;
  code?: string;
  details?: any;
} {
  const normalized = normalizeError(error);
  return {
    success: false,
    error: normalized.message,
    code: normalized.code,
    details: normalized.details,
  };
};