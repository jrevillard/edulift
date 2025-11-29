import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, ValidationError } from '../types';
import { createLogger } from '../utils/logger';

// Logger pour le middleware de validation
const validationLogger = createLogger('ValidationMiddleware');

// Interface pour les options de validation
export interface ValidationOptions {
  /** Message d'erreur personnalisé */
  errorMessage?: string;
  /** Code HTTP personnalisé (défaut: 400) */
  statusCode?: number;
  /** Logger contextuel personnalisé */
  logger?: any;
  /** Nom de l'opération pour le logging */
  operationName?: string;
  /** Ajouter le contexte métier aux logs */
  includeBusinessContext?: boolean;
}

// Interface pour le contexte de validation
export interface ValidationContext {
  operation: string;
  endpoint: string;
  method: string;
  userId?: string;
  timestamp: string;
  businessContext?: Record<string, any>;
}

// Créer le contexte de logging pour une requête
const createValidationContext = (req: Request, operationName: string): ValidationContext => {
  const timestamp = new Date().toISOString();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  // Extraire l'userId si disponible (AuthenticatedRequest)
  const userId = (req as any).userId || (req as any).user?.id;

  return {
    operation: operationName,
    endpoint,
    method: req.method,
    userId,
    timestamp,
  };
};

// Transformer les erreurs Zod en format standardisé
const transformZodError = (error: z.ZodError): ValidationError[] => {
  return error.issues.map(err => {
    const validationError: ValidationError = {
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    };

    // Ajouter expected/received seulement si disponibles
    if ('expected' in err) {
      (validationError as any).expected = (err as any).expected;
    }
    if ('received' in err) {
      (validationError as any).received = (err as any).received;
    }

    return validationError;
  });
};

// Logger la validation avec contexte
const logValidation = (
  context: ValidationContext,
  dataType: 'body' | 'params' | 'query',
  isValid: boolean,
  errors?: ValidationError[],
  businessContext?: Record<string, any>,
): void => {
  const logData = {
    ...context,
    dataType,
    isValid,
    errorCount: errors?.length || 0,
    businessContext,
  };

  if (isValid) {
    validationLogger.debug(`${context.operation}: Validation successful`, logData);
  } else {
    validationLogger.warn(`${context.operation}: Validation failed`, {
      ...logData,
      validationErrors: errors,
    });
  }
};

// Middleware principal de validation avec logging contextuel
const createValidationMiddleware = (
  schema: z.ZodSchema,
  dataType: 'body' | 'params' | 'query',
  options: ValidationOptions = {},
) => {
  const {
    errorMessage,
    statusCode = 400,
    operationName = 'Validation',
    includeBusinessContext = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const context = createValidationContext(req, operationName);

    // Ajouter le contexte métier si demandé
    let businessContext: Record<string, any> | undefined;
    if (includeBusinessContext) {
      businessContext = {
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentType: req.get('Content-Type'),
      };
    }

    try {
      // Extraire et valider les données selon le type
      let rawData: any;
      let targetProperty: keyof Request;

      switch (dataType) {
        case 'body':
          rawData = req.body;
          targetProperty = 'body';
          break;
        case 'params':
          rawData = req.params;
          targetProperty = 'params';
          break;
        case 'query':
          rawData = req.query;
          targetProperty = 'query';
          break;
      }

      const validatedData = schema.parse(rawData);

      // Remplacer les données originales par les données validées
      (req as any)[targetProperty] = validatedData;

      // Logger la validation réussie
      logValidation(context, dataType, true, undefined, businessContext);

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = transformZodError(error);

        // Logger l'échec de validation
        logValidation(context, dataType, false, validationErrors, businessContext);

        // Construire la réponse d'erreur
        const response: ApiResponse = {
          success: false,
          error: errorMessage || `Invalid ${dataType}`,
          validationErrors,
          statusCode,
        };

        res.status(statusCode).json(response);
        return;
      }

      // Pour les autres types d'erreur, passer au middleware suivant
      next(error);
    }
  };
};

// Middleware spécialisés avec options par défaut
export const validateBody = (schema: z.ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'body', {
    errorMessage: 'Invalid request body',
    ...options,
  });

export const validateParams = (schema: z.ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'params', {
    errorMessage: 'Invalid URL parameters',
    ...options,
  });

export const validateQuery = (schema: z.ZodSchema, options?: ValidationOptions) =>
  createValidationMiddleware(schema, 'query', {
    errorMessage: 'Invalid query parameters',
    ...options,
  });

// Middleware combiné pour valider plusieurs types en une seule fois
export const validateRequest = (
  schemas: {
    body?: z.ZodSchema;
    params?: z.ZodSchema;
    query?: z.ZodSchema;
  },
  options?: ValidationOptions,
) => {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

  if (schemas.body) {
    middlewares.push(validateBody(schemas.body, options));
  }
  if (schemas.params) {
    middlewares.push(validateParams(schemas.params, options));
  }
  if (schemas.query) {
    middlewares.push(validateQuery(schemas.query, options));
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    let currentIndex = 0;

    const runNextMiddleware = (): void => {
      if (currentIndex >= middlewares.length) {
        next();
        return;
      }

      const middleware = middlewares[currentIndex];
      currentIndex++;

      // Remplacer next() dans le middleware pour continuer la chaîne
      middleware(req, res, runNextMiddleware);
    };

    runNextMiddleware();
  };
};

// Wrapper pour les contrôleurs qui gère automatiquement les erreurs Zod avec logging
export const withZodErrorHandling = <T extends Request = Request>(
  handler: (req: T, res: Response) => Promise<void>,
  options: {
    operationName?: string;
    logger?: any;
    includeBusinessContext?: boolean;
  } = {},
) => {
  const {
    operationName = 'Controller',
  } = options;

  return async (req: T, res: Response): Promise<void> => {
    const context = createValidationContext(req, operationName);

    try {
      await handler(req, res);
    } catch (error) {
      // Gérer les erreurs Zod qui n'ont pas été interceptées par le middleware
      if (error instanceof z.ZodError) {
        const validationErrors = transformZodError(error);

        validationLogger.error(`${operationName}: Unhandled Zod validation error`, {
          ...context,
          validationErrors,
        });

        const response: ApiResponse = {
          success: false,
          error: 'Validation failed',
          validationErrors,
          statusCode: 400,
        };

        res.status(400).json(response);
        return;
      }

      // Pour les autres erreurs, les propager
      throw error;
    }
  };
};

// Exporter les utilitaires pour usage externe
export { createValidationContext, transformZodError, logValidation };