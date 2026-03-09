/**
 * WebSocket Integration Test
 *
 * Simple test to verify that WebSocket endpoint is accessible
 * and Socket.IO is properly initialized
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

describe('WebSocket Integration', () => {
  let server: any;
  let port: number;
  let clientSocket: ClientSocket;
  const testUrl = `http://localhost:${Math.floor(Math.random() * 1000) + 3000}`;

  beforeAll(async () => {
    // Dynamic import of server to avoid import issues
    const { default: app } = await import('../server');

    // Create HTTP server
    server = createServer();

    // Start server with Hono app
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('should accept WebSocket connection on /socket.io/', async () => {
    const clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        expect(clientSocket.connected).toBe(true);
        clientSocket.disconnect();
        resolve();
      });

      clientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  it('should return 404 for non-existent socket endpoint (negative test)', async () => {
    const response = await fetch(`http://localhost:${port}/socket.io/`);
    expect(response.status).toBe(404); // Should fail until Socket.IO is implemented
  });
});
