import { describe, it, expect } from '@jest/globals';
import {
  createServiceError,
  isServiceError,
  normalizeError,
  getErrorMessage,
  getErrorForLogging,
  createErrorResponse,
  ErrorCodes,
} from '../errorHandler';

describe('errorHandler', () => {
  describe('createServiceError', () => {
    it('should create a service error with required fields', () => {
      const error = createServiceError('TEST_ERROR', 'Test message');

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500); // Default from ERROR_CODE_STATUS_MAP
      expect(error.isServiceError).toBe(true);
      expect(error.details).toBeUndefined();
    });

    it('should create a service error with custom status code', () => {
      const error = createServiceError('VALIDATION_ERROR', 'Invalid input', 400);

      expect(error.statusCode).toBe(400);
    });

    it('should create a service error with details', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = createServiceError('VALIDATION_ERROR', 'Invalid input', 400, details);

      expect(error.details).toEqual(details);
    });

    it('should use default status code for unknown error codes', () => {
      const error = createServiceError('UNKNOWN_ERROR', 'Unknown error');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('isServiceError', () => {
    it('should return true for service errors', () => {
      const error = createServiceError('TEST_ERROR', 'Test message');

      expect(isServiceError(error)).toBe(true);
    });

    it('should return false for regular Error objects', () => {
      const error = new Error('Regular error');

      expect(isServiceError(error)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isServiceError(null)).toBe(false);
      expect(isServiceError(undefined)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const error = { message: 'error', isServiceError: false };

      expect(isServiceError(error)).toBe(false);
    });
  });

  describe('normalizeError', () => {
    it('should normalize service errors', () => {
      const serviceError = createServiceError('CUSTOM_ERROR', 'Custom message', 400, { field: 'test' });
      const normalized = normalizeError(serviceError);

      expect(normalized.message).toBe('Custom message');
      expect(normalized.code).toBe('CUSTOM_ERROR');
      expect(normalized.statusCode).toBe(400);
      expect(normalized.details).toEqual({ field: 'test' });
      expect(normalized.originalError).toBe(serviceError);
    });

    it('should normalize standard Error instances', () => {
      const error = new Error('Standard error');
      error.stack = 'error stack';
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('Standard error');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.stack).toBe('error stack');
      expect(normalized.originalError).toBe(error);
    });

    it('should normalize ValidationError with appropriate code', () => {
      const error = new Error('Validation failed') as any;
      error.name = 'ValidationError';
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(normalized.statusCode).toBe(400);
    });

    it('should normalize UnauthorizedError with appropriate code', () => {
      const error = new Error('Unauthorized') as any;
      error.name = 'UnauthorizedError';
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(normalized.statusCode).toBe(401);
    });

    it('should infer error type from message content', () => {
      const notFoundError = new Error('User not found');
      const normalized1 = normalizeError(notFoundError);

      expect(normalized1.code).toBe(ErrorCodes.NOT_FOUND);
      expect(normalized1.statusCode).toBe(404);

      const conflictError = new Error('User already exists');
      const normalized2 = normalizeError(conflictError);

      expect(normalized2.code).toBe(ErrorCodes.ALREADY_EXISTS);
      expect(normalized2.statusCode).toBe(409);
    });

    it('should normalize objects with code and message properties', () => {
      const error = { code: 'CUSTOM_CODE', message: 'Custom message', statusCode: 422 };
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('Custom message');
      expect(normalized.code).toBe('CUSTOM_CODE');
      expect(normalized.statusCode).toBe(422);
      expect(normalized.originalError).toBe(error);
    });

    it('should normalize objects with just message property', () => {
      const error = { message: 'Object message' };
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('Object message');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.details).toEqual(error);
    });

    it('should normalize other objects to JSON string', () => {
      const error = { someProperty: 'someValue', anotherProperty: 123 };
      const normalized = normalizeError(error);

      expect(normalized.message).toBe(JSON.stringify(error));
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.details).toEqual(error);
    });

    it('should normalize string errors', () => {
      const error = 'String error message';
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('String error message');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.originalError).toBe('String error message');
    });

    it('should infer error type from string content', () => {
      const error = 'User not found';
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(ErrorCodes.NOT_FOUND);
      expect(normalized.statusCode).toBe(404);
    });

    it('should normalize null errors', () => {
      const normalized = normalizeError(null);

      expect(normalized.message).toBe('Unknown error occurred');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.details).toEqual({ errorType: 'null_undefined' });
    });

    it('should normalize undefined errors', () => {
      const normalized = normalizeError(undefined);

      expect(normalized.message).toBe('Unknown error occurred');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.details).toEqual({ errorType: 'null_undefined' });
    });

    it('should normalize unknown types as string', () => {
      const error = 123;
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('123');
      expect(normalized.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.details).toEqual({ errorType: 'number', value: 123 });
    });

    // Test the specific case from our failing test
    it('should handle custom error objects correctly', () => {
      const customError = { code: 'CUSTOM_ERROR', message: 'Custom error object' };
      const normalized = normalizeError(customError);

      expect(normalized.message).toBe('Custom error object');
      expect(normalized.code).toBe('CUSTOM_ERROR');
      expect(normalized.statusCode).toBe(500); // Default since CUSTOM_ERROR is not in ERROR_CODE_STATUS_MAP
      expect(normalized.originalError).toBe(customError);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from service error', () => {
      const error = createServiceError('TEST_ERROR', 'Test message');
      const message = getErrorMessage(error);

      expect(message).toBe('Test message');
    });

    it('should extract message from regular Error', () => {
      const error = new Error('Error message');
      const message = getErrorMessage(error);

      expect(message).toBe('Error message');
    });

    it('should extract message from object', () => {
      const error = { code: 'ERROR', message: 'Object message' };
      const message = getErrorMessage(error);

      expect(message).toBe('Object message');
    });

    it('should convert unknown types to string', () => {
      const error = 123;
      const message = getErrorMessage(error);

      expect(message).toBe('123');
    });

    // Test the specific case from our failing test
    it('should extract message from custom error object', () => {
      const customError = { code: 'CUSTOM_ERROR', message: 'Custom error object' };
      const message = getErrorMessage(customError);

      expect(message).toBe('Custom error object');
    });
  });

  describe('getErrorForLogging', () => {
    it('should return error details for logging', () => {
      const error = createServiceError('TEST_ERROR', 'Test message', 400, { field: 'test' });
      const logInfo = getErrorForLogging(error);

      expect(logInfo.message).toBe('Test message');
      expect(logInfo.code).toBe('TEST_ERROR');
      expect(logInfo.statusCode).toBe(400);
      expect(logInfo.details).toEqual({ field: 'test' });
    });

    it('should include stack trace when available', () => {
      const error = new Error('Test error');
      error.stack = 'error stack trace';
      const logInfo = getErrorForLogging(error);

      expect(logInfo.stack).toBe('error stack trace');
    });

    it('should not include stack trace when unavailable', () => {
      const error = { message: 'Object error' };
      const logInfo = getErrorForLogging(error);

      expect(logInfo.stack).toBeUndefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response from service error', () => {
      const error = createServiceError('TEST_ERROR', 'Test message', 400, { field: 'test' });
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Test message',
        code: 'TEST_ERROR',
        details: { field: 'test' },
      });
    });

    it('should create error response from regular Error', () => {
      const error = new Error('Regular error');
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Regular error',
        code: ErrorCodes.INTERNAL_ERROR,
      });
    });

    // Test the specific case from our failing test
    it('should create error response from custom error object', () => {
      const customError = { code: 'CUSTOM_ERROR', message: 'Custom error object' };
      const response = createErrorResponse(customError);

      expect(response).toEqual({
        success: false,
        error: 'Custom error object',
        code: 'CUSTOM_ERROR',
      });
    });
  });
});