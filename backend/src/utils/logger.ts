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

  constructor(context?: string) {
    // @ts-expect-error - exactOptionalPropertyTypes issue with optional context
    this.context = context;
  }

  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${prefix} ${message}${metaStr}`;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage(message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage(message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage(message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(this.formatMessage(message, meta));
  }
}

// Default logger instance for application-wide use
export const logger = new AppLogger();

// Context-specific loggers
export const createLogger = (context: string): Logger => {
  return new AppLogger(context);
};