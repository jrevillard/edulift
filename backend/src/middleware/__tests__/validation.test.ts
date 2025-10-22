import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../validation';

describe('Validation Middleware', () => {
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

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Valid email required'),
      age: z.number().min(0, 'Age must be positive').optional(),
    });

    it('should pass validation with valid data', () => {
      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockRequest.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      });
    });

    it('should pass validation with optional fields missing', () => {
      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should fail validation with missing required fields', () => {
      mockRequest.body = {
        email: 'john@example.com',
      };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        validationErrors: [
          {
            field: 'name',
            message: 'Required',
          },
        ],
      });
    });

    it('should fail validation with invalid email format', () => {
      mockRequest.body = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        validationErrors: [
          {
            field: 'email',
            message: 'Valid email required',
          },
        ],
      });
    });

    it('should handle multiple validation errors', () => {
      mockRequest.body = {
        name: '',
        email: 'invalid-email',
        age: -5,
      };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Name is required',
          }),
          expect.objectContaining({
            field: 'email',
            message: 'Valid email required',
          }),
          expect.objectContaining({
            field: 'age',
            message: 'Age must be positive',
          }),
        ]),
      });
    });

    it('should handle non-Zod errors', () => {
      const faultySchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as any;

      mockRequest.body = { test: 'data' };

      const middleware = validateBody(faultySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().min(1, 'ID is required'),
      groupId: z.string().min(1, 'Group ID is required').optional(),
    });

    it('should pass validation with valid params', () => {
      mockRequest.params = {
        id: 'user-123',
        groupId: 'group-456',
      };

      const middleware = validateParams(paramsSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid params', () => {
      mockRequest.params = {
        id: '',
      };

      const middleware = validateParams(paramsSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid parameters',
        validationErrors: [
          {
            field: 'id',
            message: 'ID is required',
          },
        ],
      });
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
      limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
      search: z.string().optional(),
    });

    it('should pass validation with valid query params', () => {
      mockRequest.query = {
        page: '1',
        limit: '10',
        search: 'test',
      };

      const middleware = validateQuery(querySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass validation with no query params', () => {
      mockRequest.query = {};

      const middleware = validateQuery(querySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid query params', () => {
      mockRequest.query = {
        page: 'not-a-number',
        limit: 'also-not-a-number',
      };

      const middleware = validateQuery(querySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid query parameters',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            message: 'Page must be a number',
          }),
          expect.objectContaining({
            field: 'limit',
            message: 'Limit must be a number',
          }),
        ]),
      });
    });
  });
});