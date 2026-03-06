/**
 * Database Configuration for Hono Integration
 *
 * Provides the Prisma client instance for use throughout the application.
 * This file maintains backward compatibility with existing imports.
 */

import { PrismaClient } from '@prisma/client';

// Global Prisma instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;