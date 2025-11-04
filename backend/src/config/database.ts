/**
 * Database Configuration - Singleton PrismaClient
 *
 * This module provides a singleton instance of PrismaClient to prevent
 * multiple database connections and EventEmitter memory leaks.
 *
 * @author EduLift Team
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('database');

// Declare global to prevent multiple instances in development
declare global {
   
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient instance
 * Reuses existing instance in development to prevent hot reload issues
 */
export const prisma = global.__prisma || new PrismaClient({
  log: process.env.LOG_LEVEL === 'debug'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

// Store in global for development hot reload
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

logger.debug('Prisma client singleton initialized');

/**
 * Disconnect from database
 * Called by the main server during graceful shutdown
 */
export const disconnectDatabase = async (): Promise<void> => {
  logger.info('Disconnecting from database');
  await prisma.$disconnect();
};
