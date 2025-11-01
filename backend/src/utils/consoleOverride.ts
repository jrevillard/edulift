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
const createConsoleWrapper = (
  level: 'debug' | 'info' | 'warn' | 'error',
  _originalMethod: (...args: any[]) => void,
) => {
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
    // The logger (Pino) will handle formatting, colors, and output based on LOG_LEVEL
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

    // Note: We no longer call originalMethod here to avoid duplicate logs
    // and to ensure LOG_LEVEL is consistently respected across all environments
  };
};

/**
 * Special wrapper for console.trace to include stack trace
 */
const createTraceWrapper = (_originalMethod: (...args: any[]) => void) => {
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

    // Log through our system with stack trace
    logger.debug(`TRACE: ${message}\n${new Error().stack}`);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.table to preserve table formatting
 */
const createTableWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const message = `TABLE: ${JSON.stringify(args[0])}`;
    logger.debug(message);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.group methods
 */
const createGroupWrapper = (
  _originalMethod: (...args: any[]) => void,
  type: 'group' | 'groupCollapsed' | 'groupEnd' = 'group',
) => {
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

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.time/timeEnd
 */
const timers = new Map<string, number>();

const createTimeWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    timers.set(label, Date.now());
    logger.debug(`TIMER START: ${label}`);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

const createTimeEndWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    const startTime = timers.get(label);

    if (startTime) {
      const duration = Date.now() - startTime;
      timers.delete(label);
      logger.debug(`TIMER END: ${label} - ${duration}ms`);
    } else {
      logger.warn(`Timer "${label}" not found`);
    }

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.assert
 */
const createAssertWrapper = (_originalMethod: (...args: any[]) => void) => {
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

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.count
 */
const counters = new Map<string, number>();

const createCountWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    const current = (counters.get(label) || 0) + 1;
    counters.set(label, current);

    logger.debug(`COUNT: ${label} = ${current}`);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

const createCountResetWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const label = args[0] || 'default';
    counters.delete(label);

    logger.debug(`COUNT RESET: ${label}`);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Wrapper for console.dir
 */
const createDirWrapper = (_originalMethod: (...args: any[]) => void) => {
  return (...args: any[]): void => {
    const message = `DIR: ${JSON.stringify(args[0], null, 2)}`;
    logger.debug(message);

    // Note: Logger handles output based on LOG_LEVEL
  };
};

/**
 * Override all console methods globally
 */
export const overrideConsole = (): void => {
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
};

/**
 * Restore original console methods (useful for testing)
 */
export const restoreConsole = (): void => {
  Object.assign(console, originalConsole);
};

/**
 * Get statistics about console usage
 */
export const getConsoleStats = (): {
  timersCount: number;
  countersCount: number;
} => {
  return {
    timersCount: timers.size,
    countersCount: counters.size,
  };
};

/**
 * Clear all timers and counters (useful for cleanup)
 */
export const clearConsoleStats = (): void => {
  timers.clear();
  counters.clear();
};

// Auto-override console when this module is imported
overrideConsole();

// Export for testing purposes
export { originalConsole };