/**
 * Dashboard Routes - OpenAPI Hono
 *
 * Dashboard routes with authentication middleware
 * All routes are protected and require JWT authentication
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { authenticateToken } from '../middleware/auth-hono';
import dashboardController from '../controllers/DashboardController';

// Create OpenAPI Hono app
const app = new OpenAPIHono();

// Apply authentication middleware to all routes
app.use('*', authenticateToken);

// Mount dashboard controller routes
app.route('/', dashboardController);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'dashboard',
    timestamp: new Date().toISOString(),
    endpoints: 4,
    analytics: 'comprehensive',
  });
});

export default app;
