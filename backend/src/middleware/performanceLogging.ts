/**
 * Performance Logging Middleware
 *
 * Automatic performance measurement for all HTTP requests using Hono's native timing middleware.
 * This provides:
 * - Automatic Server-Timing headers (visible in Chrome/Firefox DevTools)
 * - Zero configuration timing for all endpoints
 * - Optional granular measurements with startTime/endTime
 * - No risk of forgetting to call timer.end() (autoEnd: true)
 *
 * @see backend/docs/TIMER_ARCHITECTURE_ANALYSIS.md for detailed analysis
 */

import { MiddlewareHandler } from 'hono';
import { timing, startTime, endTime, type TimingVariables } from 'hono/timing';
import { createLogger } from '../utils/logger';

const perfLogger = createLogger('Performance');

/**
 * Performance logging middleware
 *
 * Automatically measures and logs the duration of all HTTP requests.
 * Compatible with Server-Timing API for DevTools integration.
 *
 * @example
 * ```typescript
 * import { performanceLogging } from './middleware/performanceLogging';
 *
 * // Apply globally to all routes
 * app.use('*', performanceLogging());
 *
 * // In your handlers, use optional granular measurements:
 * app.get('/users', async (c) => {
 *   startTime(c, 'database');
 *   const users = await db.findMany();
 *   endTime(c, 'database');
 *
 *   return c.json({ users });
 *   // Server-Timing: database;dur=50, total;dur=55
 * });
 * ```
 */
export const performanceLogging = (): MiddlewareHandler => {
  return timing({
    // Include total request duration
    total: true,

    // Automatically end all timers at the end of the request
    // This prevents memory leaks and ensures 100% reliability
    autoEnd: true,

    // Custom description for the total duration
    totalDescription: 'Total Response Time',

    // Enable based on environment
    enabled: (c) => {
      // Disable in test environment
      if (process.env.NODE_ENV === 'test') {
        return false;
      }

      // Disable for health check endpoints (they pollute metrics)
      if (c.req.path.endsWith('/health') || c.req.path.endsWith('/readiness')) {
        return false;
      }

      // Enable for all other requests
      return true;
    },
  });
};

/**
 * Performance data interface for structured logging
 */
interface PerformanceData {
  operation: string;
  method: string;
  path: string;
  duration: number;
  status: number;
  success: boolean;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Structured performance logging middleware
 *
 * This is an alternative to the native timing middleware that provides
 * structured logging with Pino instead of Server-Timing headers.
 *
 * Use this if you prefer structured logs over Server-Timing headers.
 *
 * @example
 * ```typescript
 * import { structuredPerformanceLogging } from './middleware/performanceLogging';
 *
 * app.use('*', structuredPerformanceLogging());
 * ```
 */
export const structuredPerformanceLogging = (): MiddlewareHandler => {
  return async (c, next) => {
    const startTime = Date.now();
    const path = new URL(c.req.url).pathname;

    try {
      await next();

      // Success case
      const duration = Date.now() - startTime;
      const perfData: PerformanceData = {
        operation: `${c.req.method} ${path}`,
        method: c.req.method,
        path,
        duration,
        status: c.res.status,
        success: c.res.status < 400,
        userId: c.get('userId'),
      };

      // Log structured performance data
      perfLogger.info('Request completed', perfData);

    } catch (error) {
      // Error case
      const duration = Date.now() - startTime;
      const perfData: PerformanceData = {
        operation: `${c.req.method} ${path}`,
        method: c.req.method,
        path,
        duration,
        status: c.res.status || 500,
        success: false,
        userId: c.get('userId'),
        error: (error as Error).message,
      };

      perfLogger.error('Request failed', perfData);

      throw error; // Re-throw for error handler
    }
  };
};

/**
 * Sanitize sensitive data from timer logs
 *
 * Prevents sensitive data (passwords, tokens, etc.) from appearing in logs.
 *
 * @example
 * ```typescript
 * import { sanitizeTimerData } from './middleware/performanceLogging';
 *
 * timer.end(sanitizeTimerData({
 *   userId: '123',
 *   password: 'secret123', // Will be redacted
 *   email: 'user@example.com'
 * }));
 * // Result: { userId: '123', password: '[REDACTED]', email: 'user@example.com' }
 * ```
 */
export const sanitizeTimerData = (data: Record<string, unknown>): Record<string, unknown> => {
  const SENSITIVE_FIELDS = [
    'password',
    'passwordConfirmation',
    'currentPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'socialSecurityNumber',
  ];

  const sanitized = { ...data };

  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

// Re-export Hono's timing utilities for convenience
export { timing, startTime, endTime };
export type { TimingVariables };
