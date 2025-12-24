/**
 * OpenAPI Hono Invitations Routes
 *
 * Invitation system routes using OpenAPI Hono format
 * 10 endpoints with comprehensive family and group invitation management
 *
 * Endpoints:
 * - GET /invitations/validate/:code → Validate invitation (public)
 * - POST /invitations/family → Create family invitation (protected)
 * - GET /invitations/family/:code/validate → Validate family invitation (public)
 * - POST /invitations/family/:code/accept → Accept family invitation (protected)
 * - POST /invitations/group → Create group invitation (protected)
 * - GET /invitations/group/:code/validate → Validate group invitation (public)
 * - POST /invitations/group/:code/accept → Accept group invitation (protected)
 * - GET /invitations/user → Get user invitations (protected)
 * - DELETE /invitations/family/:invitationId → Cancel family invitation (protected)
 * - DELETE /invitations/group/:invitationId → Cancel group invitation (protected)
 */

import { OpenAPIHono } from '@hono/zod-openapi';

// Import controller with default import
import invitationController from '../controllers/InvitationController';

// Initialize OpenAPIHono
const app = new OpenAPIHono();

// OpenAPI Hono router - mount OpenAPI controller
// Controller defines OpenAPI routes with security specifications
app.route('/', invitationController);

// OpenAPI Documentation
app.doc31('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'EduLift Invitations API',
    version: '1.0.0',
    description: 'Family and group invitation system with comprehensive validation and management',
  },
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'invitations',
    timestamp: new Date().toISOString(),
    endpoints: 10,
    types: ['family', 'group'],
    features: ['code-validation', 'role-management', 'permissions'],
  });
});

// Export the OpenAPI Hono routes
export default app;
