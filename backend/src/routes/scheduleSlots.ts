/**
 * Schedule Slots Routes - OpenAPI Hono Native
 *
 * Schedule slots management routes using OpenAPI Hono format
 * Controller uses official Hono OpenAPI pattern with createRoute + app.openapi()
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../middleware/auth-hono';
import scheduleSlotController from '../controllers/ScheduleSlotController';

// Create OpenAPI Hono app
const app = new OpenAPIHono();

// Apply authentication to all routes
app.use('*', authenticateToken);

// Mount controller routes (controller already has all OpenAPI definitions)
app.route('/', scheduleSlotController);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'schedule-slots',
    timestamp: new Date().toISOString(),
  });
});

// Export the OpenAPI Hono routes
export default app;
