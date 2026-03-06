/**
 * Professional Rate Limiting Middleware for EduLift Backend
 *
 * Provides comprehensive rate limiting protection with different tiers:
 * - Anonymous clients: 100 requests/minute per IP
 * - Authenticated users: 300 requests/minute per user
 * - Sensitive endpoints (auth): 20 requests/minute per IP
 *
 * Features:
 * - Integration with existing error handling system
 * - Standardized rate limit headers
 * - Logging for monitoring and security
 * - Memory-based storage (suitable for single-instance deployment)
 */

import { rateLimiter } from 'hono-rate-limiter';
import { Context } from 'hono';
import { createLogger } from './logger';
import { createErrorResponse, ErrorCodes } from './errorHandler';

const logger = createLogger('rate-limiter');

/**
 * Helper function to extract client IP address from request
 */
const getClientIP = function(c: Context): string {
  // Try various headers in order of preference
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-client-ip') ||
    'unknown'
  );
};

/**
 * Helper function to check if user is authenticated
 */
const isUserAuthenticated = function(c: Context): boolean {
  return !!c.get('userId');
};

/**
 * Helper function to get authenticated user ID
 */
const getAuthenticatedUserId = function(c: Context): string {
  return c.get('userId') || 'anonymous';
};

/**
 * Creates a rate limit exceeded response using our standard error format
 */
const createRateLimitResponse = function(c: Context, retryAfter?: number) {
  logger.warn('Rate limit exceeded', {
    ip: getClientIP(c),
    userAgent: c.req.header('user-agent'),
    path: c.req.path,
    method: c.req.method,
    userId: isUserAuthenticated(c) ? getAuthenticatedUserId(c) : undefined,
    timestamp: new Date().toISOString(),
  });

  const response = createErrorResponse({
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests, please try again later',
    statusCode: 429,
  });

  // Add retry after information if available
  if (retryAfter) {
    response.details = { ...response.details, retryAfter };
    c.header('Retry-After', retryAfter.toString());
  }

  return c.json(response, 429);
};

/**
 * Rate limiter for anonymous clients (IP-based)
 * - 100 requests per minute per IP
 * - Applied to all non-authenticated routes
 */
export const anonymousRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // 100 requests per minute
  standardHeaders: 'draft-6', // RateLimit-* headers
  keyGenerator: function(c) {
    return `anonymous:${getClientIP(c)}`;
  },
  // Custom handler to integrate with our error system
  handler: function(c, retryAfter) {
    return createRateLimitResponse(c, Number(retryAfter));
  },
  // Skip if user is authenticated (will use higher limits)
  skip: function(c) {
    return isUserAuthenticated(c);
  },
});

/**
 * Rate limiter for authenticated users (user-based)
 * - 300 requests per minute per user
 * - Applied after authentication middleware
 */
export const authenticatedRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 300, // 300 requests per minute
  standardHeaders: 'draft-6', // RateLimit-* headers
  keyGenerator: function(c) { return `user:${getAuthenticatedUserId(c)}`; },
  handler: function(c, retryAfter) { return createRateLimitResponse(c, Number(retryAfter)); },
  // Skip if user is not authenticated (will use anonymous limits)
  skip: function(c) {
    return !isUserAuthenticated(c);
  },
});

/**
 * Sensitive rate limiter for authentication endpoints
 * - 20 requests per minute per IP
 * - Prevents brute force attacks on login/register
 * - Applied specifically to auth routes
 */
export const authEndpointRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 20, // 20 requests per minute
  standardHeaders: 'draft-6', // RateLimit-* headers
  keyGenerator: function(c) { return `auth:${getClientIP(c)}`; },
  handler: function(c, retryAfter) {
    logger.warn('Auth endpoint rate limit exceeded', {
      ip: getClientIP(c),
      userAgent: c.req.header('user-agent'),
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
      // Extra logging for auth endpoints for security monitoring
      suspicious: true,
    });

    const response = createErrorResponse({
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many authentication attempts, please try again later',
      statusCode: 429,
    });

    if (retryAfter !== undefined) {
      response.details = { ...response.details, retryAfter: Number(retryAfter) };
      c.header('Retry-After', Number(retryAfter).toString());
    }

    return c.json(response, 429);
  },
});

/**
 * Global rate limiter that combines both anonymous and authenticated limits
 * This middleware should be applied globally to all API routes
 */
export const globalRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: isUserAuthenticated => isUserAuthenticated ? 300 : 100, // Dynamic limit based on auth
  standardHeaders: 'draft-6', // RateLimit-* headers
  keyGenerator: function(c) {
    const userId = getAuthenticatedUserId(c);
    return isUserAuthenticated(c) ? `user:${userId}` : `anonymous:${getClientIP(c)}`;
  },
  handler: function(c, retryAfter) { return createRateLimitResponse(c, Number(retryAfter)); },
});

/**
 * Middleware factory to create a conditional rate limiter
 * that applies different limits based on the route pattern
 */
export const createConditionalRateLimiter = function(options: {
  anonymousLimit?: number;
  authenticatedLimit?: number;
  windowMs?: number;
  pathPatterns?: string[];
}) {
  const {
    anonymousLimit = 100,
    authenticatedLimit = 300,
    windowMs = 60 * 1000,
    pathPatterns = [],
  } = options;

  return rateLimiter({
    windowMs,
    limit: isUserAuthenticated => isUserAuthenticated ? authenticatedLimit : anonymousLimit,
    standardHeaders: 'draft-6',
    keyGenerator: function(c) {
      const userId = getAuthenticatedUserId(c);
      return isUserAuthenticated(c) ? `user:${userId}` : `anonymous:${getClientIP(c)}`;
    },
    handler: function(c, retryAfter) { return createRateLimitResponse(c, Number(retryAfter)); },
    // Only apply to specified path patterns if provided
    skip: function(c) {
      if (pathPatterns.length === 0) return false; // Apply to all routes if no patterns specified

      const path = c.req.path;
      return !pathPatterns.some(pattern => path.includes(pattern));
    },
  });
};

/**
 * Admin API rate limiter (more restrictive)
 * - 50 requests per minute for administrative operations
 */
export const adminRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 50, // 50 requests per minute
  standardHeaders: 'draft-6',
  keyGenerator: function(c) { return `admin:${getAuthenticatedUserId(c)}`; },
  handler: function(c, retryAfter) {
    logger.warn('Admin endpoint rate limit exceeded', {
      userId: getAuthenticatedUserId(c),
      ip: getClientIP(c),
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
      critical: true, // Mark as critical for monitoring
    });

    const response = createErrorResponse({
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many administrative requests, please try again later',
      statusCode: 429,
    });

    if (retryAfter !== undefined) {
      response.details = { ...response.details, retryAfter: Number(retryAfter) };
      c.header('Retry-After', Number(retryAfter).toString());
    }

    return c.json(response, 429);
  },
  // Only apply if user is authenticated
  skip: function(c) {
    return !isUserAuthenticated(c);
  },
});