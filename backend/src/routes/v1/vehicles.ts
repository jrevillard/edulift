/**
 * OPENAPI NATIF Hono Vehicles Router - Phase 1
 *
 * OpenAPI native Hono router for vehicles endpoints with native Zod validation
 * Authentication via Hono auth-hono middleware
 * Direct response format: c.json(data, status) - NO wrapper
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../../middleware/auth-hono';
import vehicleController from '../../controllers/v1/VehicleController';

// Initialisation OpenAPIHono
const router = new OpenAPIHono();

// Apply authentication to all routes
router.use('*', authenticateToken);

// OpenAPI Hono router - mount OpenAPI controller
router.route('/', vehicleController);

export default router;