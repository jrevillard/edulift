import { describe, it, expect } from '@jest/globals';
import {
  createErrorResponse,
  createServiceError,
  normalizeError
} from '../errorHandler';

describe('errorHandler Integration', () => {
  describe('Custom Error Object Handling', () => {
    it('should handle custom error objects with code and message', () => {
      // This test replaces the problematic integration test
      // It verifies that custom error objects are handled correctly
      const customError = { code: 'CUSTOM_ERROR', message: 'Custom error object' };

      // Test normalizeError directly
      const normalized = normalizeError(customError);
      expect(normalized.message).toBe('Custom error object');
      expect(normalized.code).toBe('CUSTOM_ERROR');
      expect(normalized.statusCode).toBe(500);

      // Test createErrorResponse
      const response = createErrorResponse(customError);
      expect(response).toEqual({
        success: false,
        error: 'Custom error object',
        code: 'CUSTOM_ERROR'
      });
    });

    it('should handle service errors correctly', () => {
      const serviceError = createServiceError('VALIDATION_ERROR', 'Invalid input', 400);
      const response = createErrorResponse(serviceError);

      expect(response).toEqual({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle regular Error objects correctly', () => {
      const error = new Error('Database connection failed');
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle objects with only message property', () => {
      const error = { message: 'Simple error message' };
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Simple error message',
        code: 'INTERNAL_ERROR',
        details: error
      });
    });

    it('should handle string errors correctly', () => {
      const error = 'String error message';
      const response = createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'String error message',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle null/undefined errors gracefully', () => {
      const response = createErrorResponse(null);

      expect(response).toEqual({
        success: false,
        error: 'Unknown error occurred',
        code: 'INTERNAL_ERROR',
        details: { errorType: 'null_undefined' }
      });
    });

    it('should prevent [object Object] conversion', () => {
      // The original problem this test was trying to solve
      const problematicError = { someProperty: 'someValue' };
      const response = createErrorResponse(problematicError);

      // Should NOT return "[object Object]"
      expect(response.error).not.toBe('[object Object]');
      expect(response.error).toBe(JSON.stringify(problematicError));
    });
  });
});