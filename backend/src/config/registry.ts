/**
 * OpenAPI Registry Module
 *
 * Lazy initialization of the OpenAPI registry to avoid circular dependencies
 */

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

let _registry: OpenAPIRegistry | null = null;

export const getRegistry = (): OpenAPIRegistry => {
  if (!_registry) {
    _registry = new OpenAPIRegistry();
  }
  return _registry;
};

export const registry = getRegistry();

/**
 * Wrapper around registry.registerPath that automatically generates operationId
 * Usage: registerPath({ method: 'get', path: '/api/v1/auth/profile', ... })
 */
export const registerPath = (config: any) => {
  // Auto-generate operationId if not provided
  if (!config.operationId && config.method && config.path) {
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

    config.operationId = generateOperationId(config.method, config.path);
  }
  return registry.registerPath(config);
};