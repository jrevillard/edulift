import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  validateBody,
  validateParams,
  validateQuery,
  validateRequest,
  withZodErrorHandling,
  createValidationContext,
  transformZodError,
  ValidationOptions,
} from '../validation';
import { ApiResponse } from '../../types';

// Mock du logger
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      method: 'POST',
      path: '/test',
      route: { path: '/test' },
      get: jest.fn(),
      ip: '127.0.0.1',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    it('should validate successfully and update request body', () => {
      const validData = { name: 'John', age: 25 };
      mockRequest.body = validData;

      const middleware = validateBody(testSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual(validData);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid body', () => {
      const invalidData = { name: '', age: -5 };
      mockRequest.body = invalidData;

      const middleware = validateBody(testSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid request body');
      expect(response.validationErrors).toHaveLength(2);
    });

    it('should use custom error message and status code', () => {
      const options: ValidationOptions = {
        errorMessage: 'Custom error message',
        statusCode: 422,
      };

      const middleware = validateBody(testSchema, options);
      mockRequest.body = { name: '', age: -5 };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.error).toBe('Custom error message');
    });

    it('should include business context when requested', () => {
      const options: ValidationOptions = {
        includeBusinessContext: true,
        operationName: 'TestOperation',
      };

      const middleware = validateBody(testSchema, options);
      mockRequest.body = { name: 'John', age: 25 };
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    const testSchema = z.object({
      id: z.string().uuid(),
    });

    it('should validate params successfully', () => {
      const validParams = { id: '550e8400-e29b-41d4-a716-446655440000' };
      mockRequest.params = validParams;

      const middleware = validateParams(testSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.params).toEqual(validParams);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return validation error for invalid params', () => {
      const invalidParams = { id: 'invalid-uuid' };
      mockRequest.params = invalidParams;

      const middleware = validateParams(testSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid URL parameters');
    });
  });

  describe('validateQuery', () => {
    const testSchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    });

    it('should validate query successfully', () => {
      const validQuery = { page: '1', limit: '10' };
      mockRequest.query = validQuery;

      const middleware = validateQuery(testSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.query).toEqual(validQuery);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return validation error for invalid query', () => {
      const invalidSchema = z.object({
        page: z.string().regex(/^\d+$/, 'Page must be a number'),
      });

      const middleware = validateQuery(invalidSchema);
      mockRequest.query = { page: 'not-a-number' };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateRequest', () => {
    const bodySchema = z.object({
      title: z.string().min(1),
    });
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });
    const querySchema = z.object({
      include: z.string().optional(),
    });

    it('should validate multiple schemas successfully', () => {
      mockRequest.body = { title: 'Test Title' };
      mockRequest.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      mockRequest.query = { include: 'details' };

      const middleware = validateRequest({
        body: bodySchema,
        params: paramsSchema,
        query: querySchema,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should stop on first validation failure', () => {
      mockRequest.body = { title: '' }; // Invalid
      mockRequest.params = { id: 'invalid-uuid' }; // Also invalid
      mockRequest.query = {};

      const middleware = validateRequest({
        body: bodySchema,
        params: paramsSchema,
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.validationErrors).toHaveLength(1);
      expect(response.validationErrors![0].field).toBe('title');
    });
  });

  describe('withZodErrorHandling', () => {
    it('should handle successful controller execution', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const wrappedHandler = withZodErrorHandling(mockHandler, {
        operationName: 'TestOperation',
      });

      await wrappedHandler(mockRequest as Request, mockResponse as Response);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should catch and handle ZodError from controller', async () => {
      // Créer une vraie erreur Zod pour éviter les problèmes de types
      const testSchema = z.string();
      const zodError = testSchema.safeParse(123).error!;

      const mockHandler = jest.fn().mockRejectedValue(zodError);
      const wrappedHandler = withZodErrorHandling(mockHandler, {
        operationName: 'TestOperation',
      });

      await wrappedHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.success).toBe(false);
      expect(response.validationErrors).toHaveLength(1);
    });

    it('should propagate non-Zod errors', async () => {
      const nonZodError = new Error('Database error');
      const mockHandler = jest.fn().mockRejectedValue(nonZodError);

      const wrappedHandler = withZodErrorHandling(mockHandler);

      await expect(wrappedHandler(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow('Database error');
    });
  });

  describe('Utility Functions', () => {
    describe('createValidationContext', () => {
      it('should create context with basic request info', () => {
        mockRequest.method = 'GET';
        mockRequest.route = { path: '/users/:id' };

        const context = createValidationContext(mockRequest as Request, 'TestOperation');

        expect(context.operation).toBe('TestOperation');
        expect(context.method).toBe('GET');
        expect(context.endpoint).toBe('GET /users/:id');
        expect(context.timestamp).toBeDefined();
      });

      it('should extract userId from AuthenticatedRequest', () => {
        const authReq = mockRequest as any;
        authReq.userId = 'user123';

        const context = createValidationContext(authReq, 'TestOperation');

        expect(context.userId).toBe('user123');
      });

      it('should extract userId from user object', () => {
        const authReq = mockRequest as any;
        authReq.user = { id: 'user456' };

        const context = createValidationContext(authReq, 'TestOperation');

        expect(context.userId).toBe('user456');
      });
    });

    describe('transformZodError', () => {
      it('should transform ZodError to ValidationError format', () => {
        // Créer de vraies erreurs Zod pour éviter les problèmes de types
        const stringSchema = z.string();
        const numberSchema = z.number().min(1);

        const stringError = stringSchema.safeParse(123).error!;
        const numberError = numberSchema.safeParse(0).error!;

        // Combiner les erreurs en un seul ZodError
        const zodError = new z.ZodError([...stringError.issues, ...numberError.issues]);

        const validationErrors = transformZodError(zodError);

        expect(validationErrors).toHaveLength(2);

        // Vérifier que les erreurs contiennent les champs attendus
        expect(validationErrors[0]).toMatchObject({
          field: '',
          message: expect.stringContaining('string'),
          code: expect.any(String),
        });

        expect(validationErrors[1]).toMatchObject({
          field: '',
          message: expect.stringContaining('Too small'),
          code: expect.any(String),
        });
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing usage patterns', () => {
      // Test the old API still works
      const testSchema = z.object({ data: z.string() });
      const middleware = validateBody(testSchema);

      mockRequest.body = { data: 'test' };

      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle complex validation scenarios like in original tests', () => {
      const complexSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Valid email required'),
        age: z.number().min(0, 'Age must be positive').optional(),
      });

      // Test multiple validation errors
      mockRequest.body = {
        name: '',
        email: 'invalid-email',
        age: -5,
      };

      const middleware = validateBody(complexSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0] as ApiResponse;
      expect(response.success).toBe(false);
      expect(response.validationErrors).toHaveLength(3);
    });
  });
});