import 'dotenv/config';
import { createServer } from 'http';
import app from './app.js';
import { SocketHandler } from './socket/socketHandler.js';
import { setGlobalSocketHandler } from './utils/socketEmitter.js';
import { logger } from './utils/logger.js';

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

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;