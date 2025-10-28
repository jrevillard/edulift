/**
 * Logger utility for application-wide logging
 *
 * This logger wraps console methods but provides a structured interface
 * that follows ESLint rules by using only allowed console methods.
 */

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class AppLogger implements Logger {
  private context?: string;
  private logLevel: string;

  constructor(context?: string) {
    // @ts-expect-error - exactOptionalPropertyTypes issue with optional context
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
  }

  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${prefix} ${message}${metaStr}`;
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message, meta));
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message, meta));
    }
  }
}

// Default logger instance for application-wide use
export const logger = new AppLogger();

// Context-specific loggers
export const createLogger = (context: string): Logger => {
  return new AppLogger(context);
};