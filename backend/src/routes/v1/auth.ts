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
import { authenticateToken, publicEndpoint, refreshEndpoint } from '../../middleware/auth-hono';
import authController from '../../controllers/v1/AuthController';

// Initialize OpenAPIHono
const app = new OpenAPIHono();

// Public endpoints (no authentication required)
app.use('/magic-link', publicEndpoint);
app.use('/verify', publicEndpoint);

// Refresh endpoint (no JWT required, but refresh token is mandatory)
app.use('/refresh', refreshEndpoint);

// Protected endpoints (JWT authentication required)
// All other routes require authentication
app.use('*', authenticateToken);

// Mount auth controller after middleware is configured
app.route('/', authController);

export default app;
