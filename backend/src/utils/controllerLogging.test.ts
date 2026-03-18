/**
 * Unit tests for controller logging utilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  extractRequestContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationWarning,
  logOperationDebug,
  createControllerLogger,
  OperationTimer,
  createTimer,
} from './controllerLogging';
import { Context } from 'hono';

// Mock the logger
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock the getClientIP function
jest.mock('./ipExtractor', () => ({
  getClientIP: jest.fn(() => '192.168.1.100'),
}));

describe('extractRequestContext', () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      req: {
        method: 'POST',
        url: 'https://example.com/api/test',
        header: jest.fn(),
      },
      get: jest.fn((key: string) => {
        const data: Record<string, unknown> = {
          userId: 'user123',
          user: { id: 'user123', email: 'test@example.com' },
          requestMetadata: {
            clientIp: '10.0.0.1',
            userAgent: 'TestAgent/1.0',
            requestId: 'req-123',
            timestamp: '2024-01-15T10:30:00Z',
            method: 'POST',
            path: '/api/test',
          },
        };
        return data[key];
      }),
    } as unknown as Context;
  });

  it('should extract complete context with middleware metadata', () => {
    const context = extractRequestContext(mockContext, 'testOperation');

    expect(context).toMatchObject({
      userId: 'user123',
      userEmail: 'test@example.com',
      operation: 'testOperation',
      endpoint: 'POST /api/test',
      method: 'POST',
      timestamp: '2024-01-15T10:30:00Z',
      clientIp: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      requestId: 'req-123',
    });
  });

  it('should include business context when provided', () => {
    const businessContext = { action: 'create', resource: 'user' };
    const context = extractRequestContext(mockContext, 'testOperation', businessContext);

    expect(context.businessContext).toEqual(businessContext);
  });

  it('should fallback to direct extraction when middleware metadata is absent', () => {
    const contextWithoutMetadata: Context = {
      ...mockContext,
      get: jest.fn((key: string) => {
        const data: Record<string, unknown> = {
          userId: 'user456',
          user: { id: 'user456', email: 'fallback@example.com' },
        };
        return data[key];
      }),
    } as unknown as Context;

    const context = extractRequestContext(contextWithoutMetadata, 'testOperation');

    expect(context).toMatchObject({
      userId: 'user456',
      userEmail: 'fallback@example.com',
      endpoint: 'POST /api/test',
      method: 'POST',
      clientIp: '192.168.1.100',
    });
    expect(context.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle undefined userId and userEmail', () => {
    const contextWithoutUser: Context = {
      ...mockContext,
      get: jest.fn(() => undefined),
    } as unknown as Context;

    const context = extractRequestContext(contextWithoutUser, 'testOperation');

    expect(context.userId).toBeUndefined();
    expect(context.userEmail).toBeUndefined();
  });
});

describe('logOperationStart', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockContext = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/resource',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;

    // Import logger after mocking
    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.info = mockLogger;
  });

  it('should log operation start with context', () => {
    logOperationStart('testOperation', mockContext);

    expect(mockLogger).toHaveBeenCalledWith(
      'testOperation: Operation started',
      expect.objectContaining({
        operation: 'testOperation',
        endpoint: 'GET /api/resource',
      })
    );
  });

  it('should include additional data in log', () => {
    const additionalData = { resourceId: 'abc123', action: 'create' };
    logOperationStart('testOperation', mockContext, additionalData);

    expect(mockLogger).toHaveBeenCalledWith(
      'testOperation: Operation started',
      expect.objectContaining({
        ...additionalData,
      })
    );
  });
});

describe('logOperationSuccess', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockContext = {
      req: {
        method: 'POST',
        url: 'https://example.com/api/users',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;

    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.info = mockLogger;
  });

  it('should log operation success with result data', () => {
    const resultData = { userId: 'newUser123', created: true };
    logOperationSuccess('createUser', mockContext, resultData);

    expect(mockLogger).toHaveBeenCalledWith(
      'createUser: Operation completed successfully',
      expect.objectContaining({
        resultData,
      })
    );
  });

  it('should log operation success without result data', () => {
    logOperationSuccess('deleteUser', mockContext);

    expect(mockLogger).toHaveBeenCalledWith(
      'deleteUser: Operation completed successfully',
      expect.any(Object)
    );
  });
});

describe('logOperationError', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockContext = {
      req: {
        method: 'DELETE',
        url: 'https://example.com/api/users/123',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;

    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.error = mockLogger;
  });

  it('should log error with Error object', () => {
    const error = new Error('Database connection failed');
    logOperationError('deleteUser', mockContext, error);

    expect(mockLogger).toHaveBeenCalledWith(
      'deleteUser: Operation failed',
      expect.objectContaining({
        error: 'Database connection failed',
        stack: expect.any(String),
      })
    );
  });

  it('should log error with string error', () => {
    const errorMessage = 'Validation failed';
    logOperationError('validateInput', mockContext, errorMessage);

    expect(mockLogger).toHaveBeenCalledWith(
      'validateInput: Operation failed',
      expect.objectContaining({
        error: 'Validation failed',
      })
    );
  });

  it('should include additional context in error log', () => {
    const error = new Error('Not found');
    const additionalContext = { resourceId: '123', attempts: 3 };

    logOperationError('getResource', mockContext, error, additionalContext);

    expect(mockLogger).toHaveBeenCalledWith(
      'getResource: Operation failed',
      expect.objectContaining({
        ...additionalContext,
      })
    );
  });
});

describe('logOperationWarning', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockContext = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/resource',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;

    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.warn = mockLogger;
  });

  it('should log warning with message', () => {
    logOperationWarning('getData', mockContext, 'Cache miss, fetching from database');

    expect(mockLogger).toHaveBeenCalledWith(
      'getData: Cache miss, fetching from database',
      expect.any(Object)
    );
  });

  it('should include additional data in warning log', () => {
    const additionalData = { cacheKey: 'users:123', ttl: 3600 };
    logOperationWarning('getData', mockContext, 'Cache miss', additionalData);

    expect(mockLogger).toHaveBeenCalledWith(
      'getData: Cache miss',
      expect.objectContaining(additionalData)
    );
  });
});

describe('logOperationDebug', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockContext = {
      req: {
        method: 'POST',
        url: 'https://example.com/api/data',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;

    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.debug = mockLogger;
  });

  it('should log debug message with context', () => {
    logOperationDebug('processData', mockContext, 'Starting data transformation');

    expect(mockLogger).toHaveBeenCalledWith(
      'processData: Starting data transformation',
      expect.any(Object)
    );
  });

  it('should include additional data in debug log', () => {
    const additionalData = { recordsProcessed: 100, batchSize: 10 };
    logOperationDebug('processData', mockContext, 'Batch completed', additionalData);

    expect(mockLogger).toHaveBeenCalledWith(
      'processData: Batch completed',
      expect.objectContaining(additionalData)
    );
  });
});

describe('createControllerLogger', () => {
  let mockContext: Context;
  let mockLoggerInstance: any;

  beforeEach(() => {
    mockLoggerInstance = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mock createLogger to return our mock instance
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    mockContext = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/test',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;
  });

  it('should create a logger with controller name prefix in operation names', () => {
    const logger = createControllerLogger('TestController');

    logger.logStart('testOperation', mockContext);

    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'testOperation: Operation started',
      expect.objectContaining({
        operation: 'TestController.testOperation',
      })
    );
  });

  it('should log success with correct prefix', () => {
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    const logger = createControllerLogger('TestController');
    logger.logSuccess('testOperation', mockContext, { id: '123' });

    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'testOperation: Operation completed successfully',
      expect.objectContaining({
        operation: 'TestController.testOperation',
        resultData: { id: '123' },
      })
    );
  });

  it('should log error with correct prefix', () => {
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    const logger = createControllerLogger('TestController');
    const error = new Error('Test error');
    logger.logError('testOperation', mockContext, error);

    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'testOperation: Operation failed',
      expect.objectContaining({
        operation: 'TestController.testOperation',
        error: 'Test error',
      })
    );
  });

  it('should log warning with correct prefix', () => {
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    const logger = createControllerLogger('TestController');
    logger.logWarning('testOperation', mockContext, 'Warning message');

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      'testOperation: Warning message',
      expect.objectContaining({
        operation: 'TestController.testOperation',
      })
    );
  });

  it('should log debug with correct prefix', () => {
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    const logger = createControllerLogger('TestController');
    logger.logDebug('testOperation', mockContext, 'Debug message');

    expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
      'testOperation: Debug message',
      expect.objectContaining({
        operation: 'TestController.testOperation',
      })
    );
  });

  it('should provide access to native logger', () => {
    const { createLogger } = require('../utils/logger');
    createLogger.mockReturnValue(mockLoggerInstance);

    const logger = createControllerLogger('TestController');

    expect(logger.logger).toBe(mockLoggerInstance);
  });
});

describe('OperationTimer', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    jest.useFakeTimers();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
    };

    mockContext = {
      req: {
        method: 'POST',
        url: 'https://example.com/api/process',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;
  });

  it('should create timer and log start', () => {
    new OperationTimer('testOperation', mockContext, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'testOperation: Timer started',
      expect.any(Object)
    );
  });

  it('should mark intermediate steps with elapsed time', () => {
    const timer = new OperationTimer('testOperation', mockContext, mockLogger);

    // Advance time by 100ms
    jest.advanceTimersByTime(100);

    timer.mark('databaseQuery');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'testOperation: Step "databaseQuery" completed',
      expect.objectContaining({
        stepName: 'databaseQuery',
        elapsedMs: expect.any(Number),
      })
    );
  });

  it('should end timer and log duration', () => {
    const timer = new OperationTimer('testOperation', mockContext, mockLogger);

    // Advance time by 250ms
    jest.advanceTimersByTime(250);

    const duration = timer.end({ success: true });

    expect(duration).toBeGreaterThanOrEqual(250);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'testOperation: Operation completed',
      expect.objectContaining({
        durationMs: expect.any(Number),
        resultData: { success: true },
      })
    );
  });

  it('should include result data in end log', () => {
    const timer = new OperationTimer('testOperation', mockContext, mockLogger);

    const resultData = { recordsProcessed: 100, errors: 0 };
    timer.end(resultData);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'testOperation: Operation completed',
      expect.objectContaining({
        resultData,
      })
    );
  });
});

describe('createTimer', () => {
  let mockContext: Context;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
    };

    mockContext = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/data',
        header: jest.fn(),
      },
      get: jest.fn(() => undefined),
    } as unknown as Context;
  });

  it('should create and return OperationTimer instance', () => {
    const timer = createTimer('testOperation', mockContext, mockLogger);

    expect(timer).toBeInstanceOf(OperationTimer);
  });

  it('should use controllerLogger if no logger provided', () => {
    const { controllerLogger } = require('./controllerLogging');
    controllerLogger.debug = mockLogger.debug;

    const timer = createTimer('testOperation', mockContext);

    expect(mockLogger.debug).toHaveBeenCalled();
    expect(timer).toBeInstanceOf(OperationTimer);
  });
});
