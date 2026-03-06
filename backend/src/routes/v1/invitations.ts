/**
 * OpenAPI Hono Invitations Routes
 *
 * Invitation system routes using OpenAPI Hono format
 * Authentication applied selectively to protected routes
 *
 * Validation endpoints (optional authentication):
 * - GET /invitations/validate/:code → Validate invitation (JWT optional for EMAIL_MISMATCH check)
 * - GET /invitations/family/:code/validate → Validate family invitation (JWT optional for EMAIL_MISMATCH check)
 * - GET /invitations/group/:code/validate → Validate group invitation (JWT optional for EMAIL_MISMATCH check)
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
import { authenticateToken, optionalAuthentication } from '../../middleware/auth-hono';
import invitationController from '../../controllers/v1/InvitationController';

const app = new OpenAPIHono();

// Validation endpoints with optional authentication
// - Accessible without token for basic validation
// - If JWT provided, validates it and checks EMAIL_MISMATCH
app.use('/validate/:code', optionalAuthentication);
app.use('/family/:code/validate', optionalAuthentication);
app.use('/group/:code/validate', optionalAuthentication);

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
