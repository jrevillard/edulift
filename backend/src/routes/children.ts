/**
 * Children Router - OpenAPI Hono Native
 *
 * OpenAPI native Hono router for children endpoints
 * Pattern: Route mounting with authentication middleware
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../middleware/auth-hono';
import childController from '../controllers/ChildController';

// Type for context with userId
type ChildVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const router = new OpenAPIHono<{ Variables: ChildVariables }>();

// Apply authentication to all routes
router.use('*', authenticateToken);

// Mount controller
router.route('/', childController);

export default router;