/**
 * OpenAPI Hono Auth Routes
 *
 * Authentication routes using OpenAPI Hono format with comprehensive security
 * Controller manages all routes with OpenAPI documentation and security schemes
 *
 * Public endpoints (no authentication required):
 * - POST /auth/magic-link → Request magic link
 * - POST /auth/verify → Verify magic link
 * - POST /auth/refresh → Refresh JWT token
 * - POST /auth/profile/delete-confirm → Confirm deletion (uses email token)
 *
 * Protected endpoints (JWT authentication required):
 * - POST /auth/logout → Logout
 * - PUT /auth/profile → Update profile
 * - PATCH /auth/timezone → Update timezone
 * - POST /auth/profile/delete-request → Request deletion
 * - GET /auth/profile → Get profile
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import authController from '../controllers/AuthController';

// Initialize OpenAPIHono
const app = new OpenAPIHono();

// Mount auth controller - it already has all routes defined with OpenAPI security schemes
// Controller handles public vs protected routes via OpenAPI security: [{ Bearer: [] }] vs security: []
app.route('/', authController);

export default app;
