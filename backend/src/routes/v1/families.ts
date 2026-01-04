/**
 * OPENAPI NATIF Hono Families Router - Phase 2
 *
 * OpenAPI native Hono router for families endpoints with native Zod validation
 * Authentication via Hono auth-hono middleware
 * Direct response format: c.json(data, status) - NO wrapper
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import familyController from '../../controllers/v1/FamilyController';

// Initialisation OpenAPIHono
const router = new OpenAPIHono();

// OpenAPI Hono router - mount OpenAPI controller
// Controller already handles authentication, validation, and OpenAPI routes
router.route('/', familyController);

export default router;
