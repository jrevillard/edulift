import 'dotenv/config';
import { logger } from './utils/logger';

// DEBUG: Test logging configuration immediately
logger.debug('Server.ts - Checking LOG_LEVEL:', { LOG_LEVEL: process.env.LOG_LEVEL });
logger.debug('Server.ts - Checking LOG_PRETTY:', { LOG_PRETTY: process.env.LOG_PRETTY });
logger.debug('Server.ts - Checking NODE_ENV:', { NODE_ENV: process.env.NODE_ENV });

// Import console override FIRST to ensure ALL console calls respect LOG_LEVEL
import './utils/consoleOverride';
import { createServer } from 'http';
import app from './app';
import { SocketHandler } from './socket/socketHandler';
import { setGlobalSocketHandler } from './utils/socketEmitter';
import { disconnectDatabase } from './config/database';

// DEBUG: Test logger immediately after import
logger.debug('Server.ts - After consoleOverride import');
logger.info('Server.ts - Logger initialized successfully');

const PORT = Number(process.env.PORT) || 3001;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io and export for global access
export const socketHandler = new SocketHandler(server);

// Set global socket handler for controllers to use
setGlobalSocketHandler(socketHandler);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    socketEnabled: true,
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    // Close server to stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      // Disconnect database
      await disconnectDatabase();

      logger.info('Process terminated');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000); // 10 second timeout
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
};

// Register signal handlers only once
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;