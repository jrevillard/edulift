/**
 * Schedule Slots Routes - OpenAPI Hono Native
 *
 * Schedule slots management routes using OpenAPI Hono format
 * Controller uses official Hono OpenAPI pattern with createRoute + app.openapi()
 *
 * NOTE: The controller uses absolute paths (e.g., /groups/{groupId}/schedule-slots)
 * so we directly export it without wrapping in another router to avoid double nesting.
 */

import scheduleSlotController from '../../controllers/v1/ScheduleSlotController';

// Direct export of controller (it's already an OpenAPIHono with all routes)
export default scheduleSlotController;
