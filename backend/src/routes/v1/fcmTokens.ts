/**
 * FCM Tokens Routes
 *
 * Routes for FCM token management endpoints
 */

import { authenticateToken } from '../../middleware/auth-hono';
import fcmTokenController from '../../controllers/v1/FcmTokenController';

const app = fcmTokenController;

// Apply authentication to all routes
app.use('*', authenticateToken);

export default app;
