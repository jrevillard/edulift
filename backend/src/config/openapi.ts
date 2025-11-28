/**
 * OpenAPI Configuration
 *
 * Zod-centric OpenAPI registry and configuration
 * Phase 2.1: OpenAPI configuration with registry
 */

import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Create registry instance for Zod schemas
export const registry = new OpenAPIRegistry();

// OpenAPI configuration structure
export const config = {
  openapi: {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'EduLift API',
      description: 'API de gestion collaborative du transport scolaire',
      contact: {
        name: 'EduLift Team',
        email: 'support@edulift.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.edulift.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Children',
        description: 'Children management endpoints',
      },
      {
        name: 'Vehicles',
        description: 'Vehicle management endpoints',
      },
      {
        name: 'Groups',
        description: 'Group management endpoints',
      },
      {
        name: 'Families',
        description: 'Family management endpoints',
      },
      {
        name: 'Schedule Slots',
        description: 'Schedule slot management and assignment endpoints',
      },
      {
        name: 'FCM Tokens',
        description: 'FCM token management and push notification endpoints',
      },
      {
        name: 'Dashboard',
        description: 'Dashboard and analytics endpoints',
      },
      {
        name: 'Invitations',
        description: 'Invitation management endpoints for families and groups',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
};

// Register common schemas that will be used across multiple domains
export const registerCommonSchemas = () => {
  // Common response schemas
  registry.register('SuccessResponse', z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().optional().openapi({ description: 'Success message' }),
  }));

  registry.register('ErrorResponse', z.object({
    success: z.boolean().openapi({ example: false }),
    error: z.object({
      code: z.string().optional().openapi({ description: 'Error code' }),
      message: z.string().openapi({ description: 'Error message' }),
      details: z.any().optional().nullable().openapi({ description: 'Additional error details' }),
    }),
  }));

  // Pagination schemas
  registry.register('PaginationParams', z.object({
    page: z.number().int().min(1).default(1).openapi({ description: 'Page number for pagination' }),
    limit: z.number().int().min(1).max(100).default(20).openapi({ description: 'Number of items per page' }),
  }));

  registry.register('PaginationResponse', z.object({
    page: z.number().int().openapi({ description: 'Current page number' }),
    limit: z.number().int().openapi({ description: 'Items per page' }),
    total: z.number().int().openapi({ description: 'Total number of items' }),
    totalPages: z.number().int().openapi({ description: 'Total number of pages' }),
  }));
};

// Initialize common schemas
registerCommonSchemas();

// Import domain schemas to trigger their registration
// These imports will be handled by the generation script to avoid circular dependencies
// import '../schemas/auth';
// import '../schemas/children';
// import '../schemas/vehicles';
// import '../schemas/groups';
// import '../schemas/families';
// import '../schemas/dashboard';

// Export registry for other modules to register their schemas
export default registry;