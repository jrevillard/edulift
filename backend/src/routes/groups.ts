/**
 * OPENAPI NATIF Hono Groups Router - Phase 2
 *
 * OpenAPI native Hono router for groups endpoints with native Zod validation
 * Authentication via Hono auth-hono middleware
 * Direct response format: c.json(data, status) - NO wrapper
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import groupController from '../controllers/GroupController';

// Initialize OpenAPIHono
const router = new OpenAPIHono();

// OpenAPI Hono router - mount OpenAPI controller
// Controller already handles authentication, validation, and OpenAPI routes
router.route('/', groupController);

export default router;