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

// Register security schemes using native registerComponent
export const BearerAuth = registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT access token',
});

// Export the security scheme name for use in paths
export const BearerAuthSecurity = { [BearerAuth.name]: [] };

/**
 * Helper function to generate consistent operationId from method and path
 * Example: ('get', '/auth/profile') => 'getAuthProfile'
 * Example: ('post', '/auth/magic-link') => 'postAuthMagicLink'
 * Example: ('post', '/children/{childId}/groups/{groupId}') => 'postChildrenByChildIdGroupsByGroupId'
 */
const generateOperationId = (method: string, path: string): string => {
  const pathParts = path
    .split('/')
    .filter(p => p) // Remove empty segments only
    .map(p => {
      // Handle path parameters like {childId} -> ByChildId
      if (p.startsWith('{') && p.endsWith('}')) {
        const param = p.slice(1, -1); // Remove { }
        return `By${  param.charAt(0).toUpperCase()  }${param.slice(1)}`;
      }
      // Convert kebab-case to camelCase (e.g., 'magic-link' -> 'MagicLink')
      if (p.includes('-')) {
        return p.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
      }
      return p;
    })
    .map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)); // CamelCase

  return method + pathParts.join('');
};

/**
 * Wrapper around registry.registerPath that automatically generates operationId
 * Usage: registerPath({ method: 'get', path: '/api/v1/auth/profile', ... })
 */
export const registerPath = (config: Parameters<typeof registry.registerPath>[0]) => {
  // Auto-generate operationId if not provided
  if (!config.operationId && config.method && config.path) {
    config.operationId = generateOperationId(config.method, config.path);
  }
  return registry.registerPath(config);
};

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
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.edulift.com/api/v1',
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
    security: [
      {
        [BearerAuth.name]: [],
      },
    ],
  },
};

// Register common schemas that will be used across multiple domains
// NOTE: These are currently not used with $ref in any endpoints, so they are commented out
// to avoid "Component is never used" warnings. Uncomment when needed.
export const registerCommonSchemas = () => {
  // Common response schemas
  // registry.register('SuccessResponse', z.object({
  //   success: z.boolean().openapi({ example: true }),
  //   message: z.string().optional().openapi({ description: 'Success message' }),
  // }));

  // registry.register('ErrorResponse', z.object({
  //   success: z.boolean().openapi({ example: false }),
  //   error: z.object({
  //     code: z.string().optional().openapi({ description: 'Error code' }),
  //     message: z.string().openapi({ description: 'Error message' }),
  //     details: z.record(z.string(), z.unknown()).optional().openapi({ description: 'Additional error details' }),
  //   }),
  // }));

  // Pagination schemas
  // registry.register('PaginationParams', z.object({
  //   page: z.number().int().min(1).default(1).openapi({ description: 'Page number for pagination' }),
  //   limit: z.number().int().min(1).max(100).default(20).openapi({ description: 'Number of items per page' }),
  // }));

  // registry.register('PaginationResponse', z.object({
  //   page: z.number().int().openapi({ description: 'Current page number' }),
  //   limit: z.number().int().openapi({ description: 'Items per page' }),
  //   total: z.number().int().openapi({ description: 'Total number of items' }),
  //   totalPages: z.number().int().openapi({ description: 'Total number of pages' }),
  // }));
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