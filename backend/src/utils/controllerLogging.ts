import { Context } from 'hono';
import { createLogger } from '../utils/logger';
import { getClientIP } from './ipExtractor';
import { sanitizeUserAgent } from './security';

// Type for authenticated requests (Hono Context)
interface AuthenticatedContext extends Context {
  userId?: string;
  user?: {
    id: string;
    email?: string;
  };
}

// Main logger for controller operations
export const controllerLogger = createLogger('ControllerOperations');

// Interface for request metadata set by requestContextMiddleware
export interface RequestMetadata {
  clientIp: string;
  userAgent: string | undefined;
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
}

// Interface for request context
export interface RequestContext {
  /** Authenticated user ID */
  userId: string | undefined;
  /** Authenticated user email */
  userEmail: string | undefined;
  /** Current operation name */
  operation: string;
  /** Called endpoint */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Request timestamp */
  timestamp: string;
  /** Client IP address */
  clientIp: string | undefined;
  /** Client User Agent */
  userAgent: string | undefined;
  /** Request correlation ID */
  requestId: string | undefined;
  /** Custom business context */
  businessContext: Record<string, unknown> | undefined;
}

// Extract context from Hono context
export const extractRequestContext = (
  c: Context,
  operationName: string,
  businessContext?: Record<string, unknown>,
): RequestContext => {
  // Try to use request metadata from middleware first (more efficient and consistent)
  const requestMetadata = c.get('requestMetadata') as RequestMetadata | undefined;

  // Extract authentication information from Hono context
  const userId = c.get('userId') || c.get('user')?.id;
  const userEmail = c.get('user')?.email;

  // Use middleware metadata if available, otherwise fall back to direct extraction
  const path = requestMetadata?.path || new URL(c.req.url).pathname;
  const endpoint = `${requestMetadata?.method || c.req.method} ${path}`;

  // Sanitize user-agent to prevent log injection attacks
  const rawUserAgent = requestMetadata?.userAgent;
  // Use explicit check for undefined to preserve empty string distinction
  const sanitizedUserAgent = rawUserAgent !== undefined ? sanitizeUserAgent(rawUserAgent) : undefined;

  return {
    userId,
    userEmail,
    operation: operationName,
    endpoint,
    method: requestMetadata?.method || c.req.method,
    timestamp: requestMetadata?.timestamp || new Date().toISOString(),
    clientIp: requestMetadata?.clientIp || getClientIP(c),
    userAgent: sanitizedUserAgent,
    requestId: requestMetadata?.requestId,
    businessContext,
  };
};

// Log operation start
export const logOperationStart = (
  operationName: string,
  c: Context,
  additionalData?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(c, operationName, additionalData);

  controllerLogger.info(`${operationName}: Operation started`, {
    ...context,
    ...additionalData,
  });
};

// Log operation success
export const logOperationSuccess = (
  operationName: string,
  c: Context,
  resultData?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(c, operationName);

  controllerLogger.info(`${operationName}: Operation completed successfully`, {
    ...context,
    resultData,
  });
};

// Log operation error
export const logOperationError = (
  operationName: string,
  c: Context,
  error: Error | string,
  additionalContext?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(c, operationName, additionalContext);

  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  controllerLogger.error(`${operationName}: Operation failed`, {
    ...context,
    error: errorMessage,
    stack: errorStack,
    ...additionalContext,
  });
};

// Log operation warning
export const logOperationWarning = (
  operationName: string,
  c: Context,
  message: string,
  additionalData?: Record<string, any>,
): void => {
  const context = extractRequestContext(c, operationName, additionalData);

  controllerLogger.warn(`${operationName}: ${message}`, {
    ...context,
    ...additionalData,
  });
};

// Log debug information for an operation
export const logOperationDebug = (
  operationName: string,
  c: Context,
  message: string,
  additionalData?: Record<string, any>,
): void => {
  const context = extractRequestContext(c, operationName, additionalData);

  controllerLogger.debug(`${operationName}: ${message}`, {
    ...context,
    ...additionalData,
  });
};

// Create a specialized logger for a specific controller
export const createControllerLogger = (controllerName: string) => {
  const logger = createLogger(controllerName);

  return {
    // Wrapper for operation start logs
    logStart: (operationName: string, c: Context, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(c, `${controllerName}.${operationName}`, additionalData);
      logger.info(`${operationName}: Operation started`, context as unknown as Record<string, unknown>);
    },

    // Wrapper for success logs
    logSuccess: (operationName: string, c: Context, resultData?: Record<string, any>) => {
      const context = extractRequestContext(c, `${controllerName}.${operationName}`);
      logger.info(`${operationName}: Operation completed successfully`, {
        ...context,
        resultData,
      });
    },

    // Wrapper for error logs
    logError: (operationName: string, c: Context, error: Error | string, additionalContext?: Record<string, any>) => {
      const context = extractRequestContext(c, `${controllerName}.${operationName}`, additionalContext);
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`${operationName}: Operation failed`, {
        ...context,
        error: errorMessage,
        stack: errorStack,
        ...additionalContext,
      });
    },

    // Wrapper for warning logs
    logWarning: (operationName: string, c: Context, message: string, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(c, `${controllerName}.${operationName}`, additionalData);
      logger.warn(`${operationName}: ${message}`, context as unknown as Record<string, unknown>);
    },

    // Wrapper for debug logs
    logDebug: (operationName: string, c: Context, message: string, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(c, `${controllerName}.${operationName}`, additionalData);
      logger.debug(`${operationName}: ${message}`, context as unknown as Record<string, unknown>);
    },

    // Native logger for advanced usage
    logger,
  };
};

// Measure operation duration
export class OperationTimer {
  private startTime: number;
  private operationName: string;
  private c: Context;
  private logger: any;

  constructor(operationName: string, c: Context, logger?: any) {
    this.operationName = operationName;
    this.c = c;
    this.startTime = Date.now();
    this.logger = logger || controllerLogger;

    const context = extractRequestContext(c, operationName);
    this.logger.debug(`${operationName}: Timer started`, context);
  }

  // Mark an intermediate step
  mark(stepName: string, additionalData?: Record<string, any>): void {
    const elapsed = Date.now() - this.startTime;
    const context = extractRequestContext(this.c, this.operationName, additionalData);

    this.logger.debug(`${this.operationName}: Step "${stepName}" completed`, {
      ...context,
      stepName,
      elapsedMs: elapsed,
      ...additionalData,
    });
  }

  // End the timer and log the result
  end(resultData?: Record<string, any>): number {
    const elapsed = Date.now() - this.startTime;
    const context = extractRequestContext(this.c, this.operationName);

    this.logger.info(`${this.operationName}: Operation completed`, {
      ...context,
      durationMs: elapsed,
      resultData,
    });

    return elapsed;
  }
}

// Utility to create a timer
export const createTimer = (operationName: string, c: Context, logger?: any): OperationTimer => {
  return new OperationTimer(operationName, c, logger);
};

// Backward compatibility exports
export { AuthenticatedContext as AuthenticatedRequest };