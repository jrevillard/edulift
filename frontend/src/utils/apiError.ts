/**
 * Centralized API error handling utility
 * Provides consistent error extraction and formatting across all API services
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Extracts error information from various error types returned by openapi-fetch
 * @param error - Error from API call (can be string, object, or Error instance)
 * @returns Normalized error object with message and optional status code
 */
export function getApiError(error: unknown): ApiError {
  // String errors
  if (typeof error === 'string') {
    return { message: error };
  }

  // Error instances
  if (error instanceof Error) {
    return {
      message: error.message,
      status: undefined, // Error instances don't typically have status
      code: undefined
    };
  }

  // Object errors (common with openapi-fetch)
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Try multiple possible message fields
    const message =
      (err.message as string | undefined) ||
      (err.error as string | undefined) ||
      (err.detail as string | undefined) ||
      'An error occurred';

    return {
      message,
      status: err.status as number | undefined,
      code: err.code as string | undefined
    };
  }

  // Unknown error type
  return { message: 'An unknown error occurred' };
}

/**
 * Throws a formatted error based on API error response
 * @param error - Error from API call
 * @param defaultMessage - Fallback message if error cannot be extracted
 * @throws Error with formatted message
 */
export function throwApiError(error: unknown, defaultMessage: string = 'Request failed'): never {
  const apiError = getApiError(error);
  throw new Error(apiError.message || defaultMessage);
}

/**
 * Checks if an error is a specific HTTP status code
 * @param error - Error from API call
 * @param statusCode - HTTP status code to check
 * @returns true if error matches the status code
 */
export function isHttpError(error: unknown, statusCode: number): boolean {
  const apiError = getApiError(error);
  return apiError.status === statusCode;
}

/**
 * Checks if an error is a 404 Not Found
 * @param error - Error from API call
 * @returns true if error is a 404
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}

/**
 * Checks if an error is a 409 Conflict
 * @param error - Error from API call
 * @returns true if error is a 409
 */
export function isConflictError(error: unknown): boolean {
  return isHttpError(error, 409);
}
