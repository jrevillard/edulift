/**
 * Error utility functions for safe error handling
 */

import type { ApiResponseLegacy } from '../types';

/**
 * Extract error message from axios error or generic error
 */
export const getErrorMessage = (error: unknown): string => {
  // Handle Error objects with axios response data
  if (error instanceof Error &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    error.response.data !== null) {

    const responseData = error.response.data as ApiResponseLegacy<unknown>;

    // Handle validation errors array
    if (responseData.validationErrors && Array.isArray(responseData.validationErrors)) {
      const validationError = responseData.validationErrors[0];
      if (validationError && validationError.message) {
        return validationError.message;
      }
    }

    // Handle error field
    if (responseData.error && typeof responseData.error === 'string') {
      return responseData.error;
    }

    // Note: ApiResponseLegacy doesn't have a message field, only error field
    // If we need to handle messages from the new ApiResponse, we'd need to update the logic
  }

  // Handle Error objects with message
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle objects with toString method
  if (error && typeof error === 'object' && 'toString' in error && typeof error.toString === 'function') {
    const stringResult = error.toString();
    if (stringResult && stringResult !== '[object Object]') {
      return stringResult;
    }
  }

  return 'An unexpected error occurred';
};

/**
 * Type guard for axios error with response data
 */
export const isAxiosErrorWithResponse = (error: unknown): error is Error & {
  response: {
    data: {
      message?: string;
      error?: string;
    };
  };
} => {
  return error instanceof Error &&
    'response' in error &&
    error.response !== null &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data !== null &&
    typeof error.response.data === 'object';
};