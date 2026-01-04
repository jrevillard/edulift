/**
 * OPENAPI NATIF Hono Vehicles Router - Phase 1
 *
 * OpenAPI native Hono router for vehicles endpoints with native Zod validation
 * Authentication via Hono auth-hono middleware
 * Direct response format: c.json(data, status) - NO wrapper
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import vehicleController from '../../controllers/v1/VehicleController';

// Initialisation OpenAPIHono
const router = new OpenAPIHono();

// OpenAPI Hono router - mount OpenAPI controller
// Controller already handles authentication, validation, and OpenAPI routes
router.route('/', vehicleController);

export default router;