import { Request } from 'express';
import { createLogger } from '../utils/logger';

// Type for authenticated requests
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email?: string;
  };
}

// Main logger for controller operations
export const controllerLogger = createLogger('ControllerOperations');

// Interface for request context
export interface RequestContext {
  /** ID de l'utilisateur authentifié */
  userId: string | undefined;
  /** Email de l'utilisateur authentifié */
  userEmail: string | undefined;
  /** Nom de l'opération en cours */
  operation: string;
  /** Endpoint appelé */
  endpoint: string;
  /** Méthode HTTP */
  method: string;
  /** Timestamp de la requête */
  timestamp: string;
  /** Adresse IP du client */
  clientIp: string | undefined;
  /** User Agent du client */
  userAgent: string | undefined;
  /** Contexte métier personnalisé */
  businessContext: Record<string, unknown> | undefined;
}

// Extract context from Express request
export const extractRequestContext = (
  req: Request,
  operationName: string,
  businessContext?: Record<string, unknown>,
): RequestContext => {
  const timestamp = new Date().toISOString();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  // Extraire les informations d'authentification
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.userId || authReq.user?.id;
  const userEmail = authReq.user?.email;

  return {
    userId,
    userEmail,
    operation: operationName,
    endpoint,
    method: req.method,
    timestamp,
    clientIp: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.get('User-Agent'),
    businessContext,
  };
};

// Log operation start
export const logOperationStart = (
  operationName: string,
  req: Request,
  additionalData?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(req, operationName, additionalData);

  controllerLogger.info(`${operationName}: Operation started`, {
    ...context,
    ...additionalData,
  });
};

// Log operation success
export const logOperationSuccess = (
  operationName: string,
  req: Request,
  resultData?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(req, operationName);

  controllerLogger.info(`${operationName}: Operation completed successfully`, {
    ...context,
    resultData,
  });
};

// Log operation error
export const logOperationError = (
  operationName: string,
  req: Request,
  error: Error | string,
  additionalContext?: Record<string, unknown>,
): void => {
  const context = extractRequestContext(req, operationName, additionalContext);

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
  req: Request,
  message: string,
  additionalData?: Record<string, any>,
): void => {
  const context = extractRequestContext(req, operationName, additionalData);

  controllerLogger.warn(`${operationName}: ${message}`, {
    ...context,
    ...additionalData,
  });
};

// Log debug information for an operation
export const logOperationDebug = (
  operationName: string,
  req: Request,
  message: string,
  additionalData?: Record<string, any>,
): void => {
  const context = extractRequestContext(req, operationName, additionalData);

  controllerLogger.debug(`${operationName}: ${message}`, {
    ...context,
    ...additionalData,
  });
};

// Créer un logger spécialisé pour un contrôleur spécifique
export const createControllerLogger = (controllerName: string) => {
  const logger = createLogger(controllerName);

  return {
    // Wrapper for operation start logs
    logStart: (operationName: string, req: Request, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(req, `${controllerName}.${operationName}`, additionalData);
      logger.info(`${operationName}: Operation started`, context as unknown as Record<string, unknown>);
    },

    // Wrapper for success logs
    logSuccess: (operationName: string, req: Request, resultData?: Record<string, any>) => {
      const context = extractRequestContext(req, `${controllerName}.${operationName}`);
      logger.info(`${operationName}: Operation completed successfully`, {
        ...context,
        resultData,
      });
    },

    // Wrapper for error logs
    logError: (operationName: string, req: Request, error: Error | string, additionalContext?: Record<string, any>) => {
      const context = extractRequestContext(req, `${controllerName}.${operationName}`, additionalContext);
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
    logWarning: (operationName: string, req: Request, message: string, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(req, `${controllerName}.${operationName}`, additionalData);
      logger.warn(`${operationName}: ${message}`, context as unknown as Record<string, unknown>);
    },

    // Wrapper for debug logs
    logDebug: (operationName: string, req: Request, message: string, additionalData?: Record<string, any>) => {
      const context = extractRequestContext(req, `${controllerName}.${operationName}`, additionalData);
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
  private req: Request;
  private logger: any;

  constructor(operationName: string, req: Request, logger?: any) {
    this.operationName = operationName;
    this.req = req;
    this.startTime = Date.now();
    this.logger = logger || controllerLogger;

    const context = extractRequestContext(req, operationName);
    this.logger.debug(`${operationName}: Timer started`, context);
  }

  // Marquer une étape intermédiaire
  mark(stepName: string, additionalData?: Record<string, any>): void {
    const elapsed = Date.now() - this.startTime;
    const context = extractRequestContext(this.req, this.operationName, additionalData);

    this.logger.debug(`${this.operationName}: Step "${stepName}" completed`, {
      ...context,
      stepName,
      elapsedMs: elapsed,
      ...additionalData,
    });
  }

  // Terminer le timer et logger le résultat
  end(resultData?: Record<string, any>): number {
    const elapsed = Date.now() - this.startTime;
    const context = extractRequestContext(this.req, this.operationName);

    this.logger.info(`${this.operationName}: Operation completed`, {
      ...context,
      durationMs: elapsed,
      resultData,
    });

    return elapsed;
  }
}

// Utility to create a timer
export const createTimer = (operationName: string, req: Request, logger?: any): OperationTimer => {
  return new OperationTimer(operationName, req, logger);
};