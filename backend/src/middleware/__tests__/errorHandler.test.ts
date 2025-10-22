import { Request, Response, NextFunction } from 'express';
import { AppError, createError, errorHandler, notFoundHandler } from '../errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 400);
      expect(error.stack).toBeDefined();
    });
  });

  describe('createError', () => {
    it('should create AppError instance', () => {
      const error = createError('Test message', 422);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(422);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('errorHandler', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle AppError with custom status and message', () => {
      const error = new AppError('Custom error message', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error message',
        statusCode: 404,
      });
    });

    it('should handle generic Error with default 500 status', () => {
      const error = new Error('Generic error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      });
    });

    it('should handle Error with custom message', () => {
      const error = new Error('Database connection failed');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      });
    });

    it('should handle non-Error objects', () => {
      const error = 'String error' as any;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      });
    });

    it('should always log error details', () => {
      const error = new Error('Test error for logging');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.objectContaining({
        message: 'Test error for logging',
        statusCode: 500
      }));
    });

    it('should log AppError details with correct status code', () => {
      const error = new AppError('App error for logging', 422);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.objectContaining({
        message: 'App error for logging',
        statusCode: 422
      }));
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 not found errors', () => {
      mockRequest.originalUrl = '/api/non-existent-route';

      notFoundHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Route /api/non-existent-route not found',
        statusCode: 404,
      });
    });

    it('should handle missing originalUrl', () => {
      const mockReqWithoutUrl = { ...mockRequest };
      delete (mockReqWithoutUrl as any).originalUrl;

      notFoundHandler(mockReqWithoutUrl as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Route undefined not found',
        statusCode: 404,
      });
    });
  });
});