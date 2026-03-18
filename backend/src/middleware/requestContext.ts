/**
 * Request Context Middleware for EduLift Backend
 *
 * This middleware extracts and adds request metadata to the Hono context,
 * making it available to all downstream handlers including controllers.
 *
 * Metadata extracted:
 * - clientIp: Client IP address from various headers
 * - userAgent: User agent string for client identification
 * - requestId: Unique identifier for request tracing
 * - timestamp: ISO timestamp of when the request was received
 * - method: HTTP method
 * - path: Request path without query string
 *
 * Usage:
 * The middleware should be applied globally BEFORE authentication and rate limiting:
 * app.use('*', requestContextMiddleware);
 */

import { Context, Next } from 'hono';
import { getClientIP } from '../utils/ipExtractor';

/**
 * Interface for request metadata stored in context
 */
export interface RequestMetadata {
  clientIp: string;
  userAgent: string | undefined;
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
}

/**
 * Request Context Middleware
 *
 * Extracts request metadata and stores it in the Hono context under the 'requestMetadata' key.
 * This metadata is then available to all controllers via c.get('requestMetadata').
 */
export const requestContextMiddleware = async (c: Context, next: Next) => {
  // Extract client IP from various headers
  const clientIp = getClientIP(c);

  // Generate a unique request ID for tracing
  const requestId = crypto.randomUUID();

  // Extract request metadata
  const metadata: RequestMetadata = {
    clientIp,
    userAgent: c.req.header('user-agent'),
    requestId,
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  };

  // Store metadata in context for downstream handlers
  c.set('requestMetadata', metadata);

  // Also set individual properties for easier access
  c.set('clientIp', clientIp);
  c.set('requestId', requestId);
  c.set('requestTimestamp', metadata.timestamp);

  // Continue to next middleware
  await next();
};
