/**
 * Configuration centralisée du logging pour l'application EduLift
 *
 * Ce service utilise Pino avec une configuration centralisée
 * et fournit des méthodes standardisées pour tout le code
 *
 * @author EduLift Team
 */

import pino from 'pino';
import * as os from 'os';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

class PinoLoggerService implements Logger {
  private logger: pino.Logger;
  private context: string;

  constructor(context?: string) {
    this.context = context || 'main';

    // Configuration pour la production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const validLevels = ['error', 'warn', 'info', 'debug'];
    const rawLogLevel = process.env.LOG_LEVEL?.toLowerCase();
    const logLevel = (rawLogLevel && validLevels.includes(rawLogLevel))
      ? rawLogLevel
      : 'info';

    const config: pino.LoggerOptions = {
      level: logLevel,
      // Toujours inclure les métadonnées essentielles
      base: {
        pid: process.pid,
        hostname: os.hostname(),
        service: 'edulift-backend',
        context: this.context
      }
    };

    // En développement, utiliser un format lisible mais structuré
    if (isDevelopment) {
      config.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      };
    }

    this.logger = pino(config);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info({ message, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn({ message, ...meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error({ message, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug({ message, ...meta });
  }

  createChildLogger(childContext: string): Logger {
    const fullContext = this.context ? `${this.context}:${childContext}` : childContext;
    return new PinoLoggerService(fullContext);
  }
}

// Exporter le service de logging principal
export const logger = new PinoLoggerService();

// Exporter un créateur de logger contextuel pour les services
export const createLogger = (context: string): Logger => {
  return new PinoLoggerService(context);
};