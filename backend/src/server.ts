import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { SocketHandler } from './socket/socketHandler';
import { setGlobalSocketHandler } from './utils/socketEmitter';

const PORT = Number(process.env.PORT) || 3001;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io and export for global access
export const socketHandler = new SocketHandler(server);

// Set global socket handler for controllers to use
setGlobalSocketHandler(socketHandler);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Socket.io enabled for real-time collaboration`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default server;