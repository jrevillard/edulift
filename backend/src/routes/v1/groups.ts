/**
 * OPENAPI NATIF Hono Groups Router - Phase 2
 *
 * OpenAPI native Hono router for groups endpoints with native Zod validation
 * Authentication via Hono auth-hono middleware
 * Direct response format: c.json(data, status) - NO wrapper
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../../middleware/auth-hono';
import groupController from '../../controllers/v1/GroupController';

// Initialize OpenAPIHono
const router = new OpenAPIHono();

// Apply authentication to all routes
router.use('*', authenticateToken);

// OpenAPI Hono router - mount OpenAPI controller
router.route('/', groupController);

export default router;