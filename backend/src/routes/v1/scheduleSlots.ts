/**
 * Schedule Slots Routes - OpenAPI Hono Native
 *
 * Schedule slots management routes using OpenAPI Hono format
 * Controller uses official Hono OpenAPI pattern with createRoute + app.openapi()
 *
 * NOTE: The controller uses absolute paths (e.g., /groups/{groupId}/schedule-slots)
 * so we wrap it to apply authentication middleware.
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../../middleware/auth-hono';
import scheduleSlotController from '../../controllers/v1/ScheduleSlotController';

// Create wrapper router to apply authentication
const app = new OpenAPIHono();

// Apply JWT authentication to all schedule slot routes
app.use('*', authenticateToken);

// Mount schedule slot controller
app.route('/', scheduleSlotController);

export default app;
