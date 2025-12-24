/**
 * Schema Registry for Hono OpenAPI Integration
 *
 * Provides a centralized registry for all Zod schemas that need
 * to be registered for OpenAPI documentation generation.
 */

import { z } from 'zod';

interface OpenAPIPath {
  method: string;
  path: string;
  tags?: string[];
  summary?: string;
  description?: string;
  request?: any;
  responses?: any;
  security?: any;
  middleware?: any[];
}

// Simple registry for schema registration
// This is a lightweight implementation that works with Hono's OpenAPI generation
class SchemaRegistry {
  private schemas: Map<string, z.ZodSchema> = new Map();
  private paths: OpenAPIPath[] = [];

  /**
   * Register a schema with a unique name
   */
  register(name: string, schema: z.ZodSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Register an OpenAPI path (for compatibility with existing code)
   */
  registerPath(path: OpenAPIPath): void {
    this.paths.push(path);
  }

  /**
   * Get a registered schema by name
   */
  get(name: string): z.ZodSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Get all registered schemas
   */
  getAll(): Map<string, z.ZodSchema> {
    return new Map(this.schemas);
  }

  /**
   * Get all registered paths
   */
  getAllPaths(): OpenAPIPath[] {
    return [...this.paths];
  }

  /**
   * Check if a schema is registered
   */
  has(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Get all registered schema names
   */
  getNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Clear all registered schemas and paths
   */
  clear(): void {
    this.schemas.clear();
    this.paths = [];
  }
}

// Create a singleton instance for use throughout the application
export const registry = new SchemaRegistry();

// Export the registerPath function for backward compatibility
export function registerPath(path: OpenAPIPath): void {
  registry.registerPath(path);
}

// Export the class for potential testing or alternative instances
export { SchemaRegistry };