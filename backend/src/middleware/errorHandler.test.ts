/**
 * Unit tests for error handling utilities
 */

import { describe, it, expect } from '@jest/globals';
import { normalizeError, AppError, getErrorInfo } from './errorHandler';

describe('normalizeError', () => {
  it('should normalize Error objects', () => {
    const error = new Error('Test error message');
    const normalized = normalizeError(error);

    expect(normalized.message).toBe('Test error message');
    expect(normalized.stack).toBeDefined();
    expect(normalized.originalType).toBe('Error');
  });

  it('should normalize AppError objects', () => {
    const appError = new AppError('Application error', 400);
    const normalized = normalizeError(appError);

    expect(normalized.message).toBe('Application error');
    expect(normalized.stack).toBeDefined();
    expect(normalized.originalType).toBe('AppError');
  });

  it('should normalize string errors', () => {
    const error = 'String error message';
    const normalized = normalizeError(error);

    expect(normalized.message).toBe('String error message');
    expect(normalized.stack).toBeUndefined();
    expect(normalized.originalType).toBe('String');
  });

  it('should normalize objects with message property', () => {
    const error = { message: 'Object error message', code: 'ERR_CODE' };
    const normalized = normalizeError(error);

    expect(normalized.message).toBe('Object error message');
    expect(normalized.originalType).toBe('Unknown');
  });

  it('should handle objects without message property', () => {
    const error = { code: 'ERR_CODE', statusCode: 500 };
    const normalized = normalizeError(error);

    expect(normalized.message).toBe('Unknown error');
    expect(normalized.stack).toBeUndefined();
    expect(normalized.originalType).toBe('Unknown');
  });

  it('should handle null and undefined', () => {
    const nullResult = normalizeError(null);
    const undefinedResult = normalizeError(undefined);

    expect(nullResult.message).toBe('Unknown error');
    expect(nullResult.originalType).toBe('Unknown');

    expect(undefinedResult.message).toBe('Unknown error');
    expect(undefinedResult.originalType).toBe('Unknown');
  });

  it('should handle numbers', () => {
    const error = 404;
    const normalized = normalizeError(error);

    // Numbers are converted to string in the fallback
    expect(normalized.message).toBe('Unknown error');
    expect(normalized.originalType).toBe('Unknown');
  });

  it('should preserve stack traces from Error objects', () => {
    const error = new Error('Stack trace test');
    const normalized = normalizeError(error);

    expect(normalized.stack).toBe(error.stack);
    expect(normalized.stack).toContain('Error: Stack trace test');
  });

  it('should handle errors with complex stack traces', () => {
    function throwError() {
      throw new Error('Deep error');
    }

    try {
      throwError();
    } catch (error) {
      const normalized = normalizeError(error);

      expect(normalized.message).toBe('Deep error');
      expect(normalized.stack).toBeDefined();
      expect(normalized.stack).toContain('throwError');
    }
  });

  it('should handle errors without stack traces', () => {
    const error = new Error('No stack');
    // Remove stack trace manually
    delete (error as any).stack;

    const normalized = normalizeError(error);

    expect(normalized.message).toBe('No stack');
    expect(normalized.stack).toBeUndefined();
  });
});

describe('getErrorInfo integration with normalizeError', () => {
  it('should provide consistent error handling', () => {
    const error = new Error('Test error');
    const normalized = normalizeError(error);
    const errorInfo = getErrorInfo(error);

    expect(normalized.message).toBe(errorInfo.message);
    expect(errorInfo.statusCode).toBe(500);
  });

  it('should handle AppError consistently', () => {
    const appError = new AppError('Not found', 404);
    const normalized = normalizeError(appError);
    const errorInfo = getErrorInfo(appError);

    expect(normalized.message).toBe(errorInfo.message);
    expect(errorInfo.statusCode).toBe(404);
  });

  it('should handle string errors consistently', () => {
    const error = 'String error';
    const normalized = normalizeError(error);
    const errorInfo = getErrorInfo(error);

    expect(normalized.message).toBe(errorInfo.message);
    expect(errorInfo.statusCode).toBe(500);
  });
});
