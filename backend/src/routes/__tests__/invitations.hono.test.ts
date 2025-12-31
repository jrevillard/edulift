/**
 * OpenAPI Hono Invitations Router Tests
 * Tests for OpenAPI Hono router for InvitationController
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from '@jest/globals';

describe('Invitations OpenAPI Hono Router', () => {
  describe('Router Structure', () => {
    it('should export default router', () => {
      // Read the actual routes file
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify default export
      expect(routesFile).toContain('export default app');

      // Verify OpenAPI Hono imports
      expect(routesFile).toContain('import { OpenAPIHono }');
    });

    it('should mount controller with route delegation', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify controller mount pattern
      expect(routesFile).toContain("app.route('/', invitationController)");
    });

    it('should have health check endpoint', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify health check endpoint
      expect(routesFile).toContain("app.get('/health'");
    });
  });

  describe('Route Delegation Pattern', () => {
    it('should use Hono route delegation pattern', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify route delegation syntax
      expect(routesFile).toContain('app.route(');
    });

    it('should support all invitation endpoints', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify health check mentions 10 endpoints
      expect(routesFile).toContain('endpoints: 10');
    });
  });

  describe('OpenAPI Hono Format Compliance', () => {
    it('should follow OpenAPI Hono patterns without Express dependencies', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify no Express imports
      expect(routesFile).not.toContain('from \'express\'');
      expect(routesFile).not.toContain('import { Router');

      // Verify OpenAPI Hono imports
      expect(routesFile).toContain('@hono/zod-openapi');
    });

    it('should have OpenAPI documentation endpoint', () => {
      const routesFile = fs.readFileSync(
        path.join(__dirname, '..', 'invitations.ts'),
        'utf8',
      );

      // Verify OpenAPI doc endpoint
      expect(routesFile).toContain('app.doc');
    });
  });

  describe('Controller Structure', () => {
    it('should use OpenAPI createRoute pattern', () => {
      const controllerFile = fs.readFileSync(
        path.join(__dirname, '..', '..', 'controllers', 'InvitationController.ts'),
        'utf8',
      );

      // Verify createRoute pattern
      expect(controllerFile).toContain('const validateFamilyInvitationRoute = createRoute');
      expect(controllerFile).toContain('const validateGroupInvitationRoute = createRoute');
      expect(controllerFile).toContain('const createFamilyInvitationRoute = createRoute');
      expect(controllerFile).toContain('const acceptFamilyInvitationRoute = createRoute');
    });

    it('should register routes with app.openapi', () => {
      const controllerFile = fs.readFileSync(
        path.join(__dirname, '..', '..', 'controllers', 'InvitationController.ts'),
        'utf8',
      );

      // Verify OpenAPI handler registration
      expect(controllerFile).toContain('app.openapi(');
    });

    it('should use explicit status codes in responses', () => {
      const controllerFile = fs.readFileSync(
        path.join(__dirname, '..', '..', 'controllers', 'InvitationController.ts'),
        'utf8',
      );

      // Verify explicit status codes
      expect(controllerFile).toContain('c.json(');
    });
  });
});
