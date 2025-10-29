/**
 * Global Console Override System
 *
 * This module overrides Node.js console methods globally to ensure ALL console calls
 * respect the LOG_LEVEL environment variable. Every console.* call will be intercepted
 * and routed through the logger system, eliminating any bypasses.
 */

import { logger } from './logger';

// Store original console methods for restoration if needed
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace,
  table: console.table,
  group: console.group,
  groupEnd: console.groupEnd,
  groupCollapsed: console.groupCollapsed,
  time: console.time,
  timeEnd: console.timeEnd,
  clear: console.clear,
  assert: console.assert,
  count: console.count,
  countReset: console.countReset,
  dir: console.dir,
  dirxml: console.dirxml,
};

/**
 * Enhanced console call wrapper that preserves call stack and formatting
 */
function createConsoleWrapper(
  level: 'debug' | 'info' | 'warn' | 'error',
  originalMethod: (...args: any[]) => void
) {
  return (...args: any[]): void => {
    // Always call through the logger system first
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }).join(' ');

    // Route through the logger system which respects LOG_LEVEL
    switch (level) {
      case 'debug':
        logger.debug(message);
        break;
      case 'info':
        logger.info(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
    }

    // If we're in development or the original method would have shown,
    // also call the original method to preserve formatting
    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Special wrapper for console.trace to include stack trace
 */
function createTraceWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }).join(' ');

    // Log through our system
    logger.debug(`TRACE: ${message}`);

    // Call original to show stack trace in non-production
    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Wrapper for console.table to preserve table formatting
 */
function createTableWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const message = `TABLE: ${args.length} item(s)`;
    logger.debug(message);

    // Always show tables in non-production as they're useful for debugging
    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Wrapper for console.group methods
 */
function createGroupWrapper(originalMethod: (...args: any[]) => void, type: 'group' | 'groupCollapsed' | 'groupEnd' = 'group') {
  return (...args: any[]): void => {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }).join(' ');

    logger.debug(`${type.toUpperCase()}: ${message}`);

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Wrapper for console.time/timeEnd
 */
const timers = new Map<string, number>();

function createTimeWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    timers.set(label, Date.now());
    logger.debug(`TIMER START: ${label}`);

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

function createTimeEndWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    const startTime = timers.get(label);

    if (startTime) {
      const duration = Date.now() - startTime;
      timers.delete(label);
      logger.debug(`TIMER END: ${label} - ${duration}ms`);

      if (process.env.NODE_ENV !== 'production') {
        originalMethod.apply(console, args);
      }
    } else {
      logger.warn(`Timer "${label}" not found`);
      if (process.env.NODE_ENV !== 'production') {
        originalMethod.apply(console, args);
      }
    }
  };
}

/**
 * Wrapper for console.assert
 */
function createAssertWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const [assertion, ...messageArgs] = args;

    if (!assertion) {
      const message = messageArgs.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.stack || arg.message;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }).join(' ') || 'Assertion failed';

      logger.error(`ASSERTION FAILED: ${message}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Wrapper for console.count
 */
const counters = new Map<string, number>();

function createCountWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    const current = (counters.get(label) || 0) + 1;
    counters.set(label, current);

    logger.debug(`COUNT: ${label} = ${current}`);

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

function createCountResetWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    counters.delete(label);

    logger.debug(`COUNT RESET: ${label}`);

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Wrapper for console.dir
 */
function createDirWrapper(originalMethod: (...args: any[]) => void) {
  return (...args: any[]): void => {
    const message = `DIR: ${args.length} object(s)`;
    logger.debug(message);

    if (process.env.NODE_ENV !== 'production') {
      originalMethod.apply(console, args);
    }
  };
}

/**
 * Override all console methods globally
 */
export function overrideConsole(): void {
  console.log = createConsoleWrapper('info', originalConsole.log);
  console.error = createConsoleWrapper('error', originalConsole.error);
  console.warn = createConsoleWrapper('warn', originalConsole.warn);
  console.info = createConsoleWrapper('info', originalConsole.info);
  console.debug = createConsoleWrapper('debug', originalConsole.debug);
  console.trace = createTraceWrapper(originalConsole.trace);
  console.table = createTableWrapper(originalConsole.table);
  console.group = createGroupWrapper(originalConsole.group, 'group');
  console.groupEnd = createGroupWrapper(originalConsole.groupEnd, 'groupEnd');
  console.groupCollapsed = createGroupWrapper(originalConsole.groupCollapsed, 'groupCollapsed');
  console.time = createTimeWrapper(originalConsole.time);
  console.timeEnd = createTimeEndWrapper(originalConsole.timeEnd);
  console.assert = createAssertWrapper(originalConsole.assert);
  console.count = createCountWrapper(originalConsole.count);
  console.countReset = createCountResetWrapper(originalConsole.countReset);
  console.dir = createDirWrapper(originalConsole.dir);
  console.dirxml = createDirWrapper(originalConsole.dirxml);

  // console.clear should still work normally
  console.clear = originalConsole.clear;
}

/**
 * Restore original console methods (useful for testing)
 */
export function restoreConsole(): void {
  Object.assign(console, originalConsole);
}

/**
 * Get statistics about console usage
 */
export function getConsoleStats(): {
  timersCount: number;
  countersCount: number;
} {
  return {
    timersCount: timers.size,
    countersCount: counters.size,
  };
}

/**
 * Clear all timers and counters (useful for cleanup)
 */
export function clearConsoleStats(): void {
  timers.clear();
  counters.clear();
}

// Auto-override console when this module is imported
overrideConsole();

// Export for testing purposes
export { originalConsole };