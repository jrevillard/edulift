/**
 * OpenAPI Hono Invitations Routes
 *
 * Invitation system routes using OpenAPI Hono format
 * Authentication applied selectively to protected routes
 *
 * Public endpoints (no authentication required):
 * - GET /invitations/validate/:code → Validate invitation
 * - GET /invitations/family/:code/validate → Validate family invitation
 * - GET /invitations/group/:code/validate → Validate group invitation
 *
 * Protected endpoints (JWT authentication required):
 * - POST /invitations/family → Create family invitation
 * - POST /invitations/family/:code/accept → Accept family invitation
 * - POST /invitations/group → Create group invitation
 * - POST /invitations/group/:code/accept → Accept group invitation
 * - GET /invitations/user → Get user invitations
 * - DELETE /invitations/family/:invitationId → Cancel family invitation
 * - DELETE /invitations/group/:invitationId → Cancel group invitation
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken, publicEndpoint } from '../../middleware/auth-hono';
import invitationController from '../../controllers/v1/InvitationController';

const app = new OpenAPIHono();

// Public endpoints (no authentication required)
app.use('/validate/:code', publicEndpoint);
app.use('/family/:code/validate', publicEndpoint);
app.use('/group/:code/validate', publicEndpoint);

// Protected endpoints (JWT authentication required)
// All other routes require authentication
app.use('*', authenticateToken);

// Mount controller after middleware is configured
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
