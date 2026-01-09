/**
 * OpenAPI Hono Auth Routes
 *
 * Authentication routes using OpenAPI Hono format with comprehensive security
 * Controller manages all routes with OpenAPI documentation and security schemes
 *
 * Public endpoints (no authentication required):
 * - POST /auth/magic-link → Request magic link
 * - POST /auth/verify → Verify magic link (uses PKCE email token)
 * - POST /auth/refresh → Refresh JWT token
 *
 * Protected endpoints (JWT authentication required):
 * - POST /auth/logout → Logout
 * - GET /auth/profile → Get profile
 * - PUT /auth/profile → Update profile
 * - PATCH /auth/profile/timezone → Update timezone
 * - POST /auth/profile/delete-request → Request account deletion (step 1)
 * - POST /auth/profile/delete-confirm → Confirm account deletion (step 2, requires JWT + email token)
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../../middleware/auth-hono';
import authController from '../../controllers/v1/AuthController';

// Initialize OpenAPIHono
const app = new OpenAPIHono();

// Apply JWT authentication middleware to protected routes
// Pattern: /profile/* matches /profile and all sub-paths
app.use('/logout', authenticateToken);
app.use('/profile/*', authenticateToken);

// Mount auth controller after middleware is configured
app.route('/', authController);

export default app;
