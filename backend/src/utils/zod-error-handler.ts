import { ZodError } from 'zod';
import { Context } from 'hono';
import { createServiceError, createErrorResponse } from './errorHandler';

/**
 * Transform Zod errors into consistent Hono response format
 */
export const handleZodError = (error: ZodError, c: Context): Response => {
  // Extract the first relevant error message
  const firstError = error.issues[0];

  let errorMessage = 'Validation error';

  if (firstError) {
    if (firstError.code === 'invalid_type') {
      errorMessage = `${firstError.path.join('.')} is required`;
    } else if (firstError.code === 'too_small') {
      errorMessage = firstError.message;
    } else if (firstError.code === 'too_big') {
      errorMessage = firstError.message;
    } else {
      errorMessage = firstError.message;
    }
  }

  // Create a service error for consistent format
  const serviceError = createServiceError(
    'VALIDATION_ERROR',
    errorMessage,
    400,
    { issues: error.issues },
  );

  return c.json(createErrorResponse(serviceError), 400);
};

/**
 * Middleware to intercept Zod validation errors from zValidator
 */
export const zodErrorHandler = async (c: Context, next: () => Promise<void>): Promise<void | Response> => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error, c);
    }
    throw error; // Let other errors pass through
  }
};