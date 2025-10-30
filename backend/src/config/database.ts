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
  // eslint-disable-next-line no-var
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting Prisma');
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting Prisma');
  await prisma.$disconnect();
});

logger.debug('Prisma client singleton initialized');
