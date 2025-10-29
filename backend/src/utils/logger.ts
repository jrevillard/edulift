/**
 * Logger utility for application-wide logging using Pino
 *
 * This logger provides a structured interface that respects LOG_LEVEL
 * and uses Pino for high-performance structured logging.
 */

import pino from 'pino';
import * as os from 'os';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

class PinoAppLogger implements Logger {
  private logger: pino.Logger;
  private context: string;

  constructor(context?: string) {
    this.context = context || 'main';

    // Configuration for development vs production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const validLevels = ['error', 'warn', 'info', 'debug'];
    const logLevel = validLevels.includes(process.env.LOG_LEVEL?.toLowerCase() || '')
      ? process.env.LOG_LEVEL?.toLowerCase() || 'info'
      : 'info';

    const config: any = {
      level: logLevel,
      // Always include essential metadata
      base: {
        pid: process.pid,
        hostname: os.hostname(),
        service: 'edulift-backend',
        context: this.context
      }
    };

    // In development, use readable format
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

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error({ message, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn({ message, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug({ message, ...meta });
  }
}

// Default logger instance for application-wide use
export const logger = new PinoAppLogger();

// Context-specific loggers
export const createLogger = (context: string): Logger => {
  return new PinoAppLogger(context);
};