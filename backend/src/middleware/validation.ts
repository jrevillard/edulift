import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, ValidationError } from '../types';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        const response: ApiResponse = {
          success: false,
          error: 'Validation failed',
          validationErrors,
        };

        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors,
        };

        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        const response: ApiResponse = {
          success: false,
          error: 'Invalid query parameters',
          validationErrors,
        };

        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};