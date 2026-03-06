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

    // Configure log level (independent of NODE_ENV)
    const validLevels = ['error', 'warn', 'info', 'debug'];
    const logLevel = validLevels.includes(process.env.LOG_LEVEL?.toLowerCase() || '')
      ? process.env.LOG_LEVEL?.toLowerCase() || 'info'
      : 'info';

    // Configure format (based on LOG_PRETTY if available, otherwise NODE_ENV)
    const isPretty = process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV !== 'production';

    const config: pino.LoggerOptions = {
      level: logLevel,
      // Always include essential metadata
      base: {
        pid: process.pid,
        hostname: os.hostname(),
        service: 'edulift-backend',
        context: this.context,
      },
    };

    // Use readable format if LOG_PRETTY=true or NODE_ENV != production
    if (isPretty) {
      config.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          // Preserve newlines in message content
          messageFormat: '{msg}',
          // Handle multiline messages properly
          crlf: false,
          // Don't escape special characters in messages
          escapeString: false,
        },
      };
    }

    this.logger = pino(config);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    // Pass message as raw string with metadata to preserve newlines
    this.logger.info({
      message: message.replace(/\n/g, '\n'), // Ensure newlines are preserved
      ...meta,
    });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error({
      message: message.replace(/\n/g, '\n'),
      ...meta,
    });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn({
      message: message.replace(/\n/g, '\n'),
      ...meta,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug({
      message: message.replace(/\n/g, '\n'),
      ...meta,
    });
  }
}

// Default logger instance for application-wide use
export const logger = new PinoAppLogger();

// Context-specific loggers
export const createLogger = (context: string): Logger => {
  return new PinoAppLogger(context);
};