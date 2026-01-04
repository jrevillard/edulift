/**
 * Invitations Router Migration Tests
 * Migration tests to OpenAPI Hono pattern
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from '@jest/globals';

describe('Invitations Router Migration Verification', () => {
  it('should verify OpenAPI Hono migration is complete', () => {
    // Read the actual routes file to verify OpenAPI Hono migration
    const routesFile = fs.readFileSync(
      path.join(__dirname, '..', 'v1', 'invitations.ts'),
      'utf8',
    );

    // Verify Express imports are gone
    expect(routesFile).not.toContain('import { Router');
    expect(routesFile).not.toContain('from \'express\'');
    expect(routesFile).not.toContain('Request, Response, NextFunction');

    // Verify OpenAPI Hono imports are present
    expect(routesFile).toContain('import { OpenAPIHono } from \'@hono/zod-openapi\'');

    // Verify controller import pattern - default import for OpenAPI controllers
    expect(routesFile).toContain('import invitationController');
    expect(routesFile).toContain('app.route(\'/\', invitationController)');

    // Verify Express middleware is gone
    expect(routesFile).not.toContain('authenticateToken,');
    expect(routesFile).not.toContain('asyncHandler');
    expect(routesFile).not.toContain('sendSuccessResponse');
    expect(routesFile).not.toContain('sendErrorResponse');

    // Verify OpenAPI documentation is present
    expect(routesFile).toContain('app.doc');
  });

  it('should verify OpenAPI schemas are consistent', () => {
    // Read the schemas file to verify OpenAPI schema format
    const schemasFile = fs.readFileSync(
      path.join(__dirname, '..', '..', 'schemas', 'invitations.ts'),
      'utf8',
    );

    // Verify OpenAPI schema extensions
    expect(schemasFile).toContain('extendZodWithOpenApi');
    expect(schemasFile).toContain('registerPath');

    // Verify schema definitions
    expect(schemasFile).toContain('FamilyInvitationValidationSchema');
    expect(schemasFile).toContain('GroupInvitationValidationSchema');
    expect(schemasFile).toContain('FamilyInvitationResponseSchema');
    expect(schemasFile).toContain('GroupInvitationResponseSchema');
    expect(schemasFile).toContain('AcceptInvitationResponseSchema');
    expect(schemasFile).toContain('CancelInvitationResponseSchema');
  });

  it('should verify controller maintains OpenAPI Hono format', () => {
    // Read the controller file to verify OpenAPI Hono format
    const controllerFile = fs.readFileSync(
      path.join(__dirname, '..', '..', 'controllers', 'v1', 'InvitationController.ts'),
      'utf8',
    );

    // Verify OpenAPI Hono imports and patterns
    expect(controllerFile).toContain('import { OpenAPIHono, createRoute, z } from \'@hono/zod-openapi\'');
    expect(controllerFile).toContain('const app = new OpenAPIHono');

    // Verify createRoute pattern
    expect(controllerFile).toContain('const validateFamilyInvitationRoute = createRoute');
    expect(controllerFile).toContain('const validateGroupInvitationRoute = createRoute');
    expect(controllerFile).toContain('const createFamilyInvitationRoute = createRoute');
    expect(controllerFile).toContain('const acceptFamilyInvitationRoute = createRoute');

    // Verify OpenAPI handler registration
    expect(controllerFile).toContain('app.openapi(');

    // Verify Hono response patterns with explicit status codes
    expect(controllerFile).toContain('return c.json(');
    expect(controllerFile).toContain('c.req.valid(');
    expect(controllerFile).toContain('c.get(\'userId\')');

    // Verify no Express patterns
    expect(controllerFile).not.toContain('req, res, next');
    expect(controllerFile).not.toContain('sendSuccessResponse(');
    expect(controllerFile).not.toContain('sendErrorResponse(');

    // Verify default export pattern (controller exports factory function result)
    expect(controllerFile).toContain('export default createInvitationControllerRoutes()');
  });
});
