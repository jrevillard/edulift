// @ts-nocheck
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { SocketHandler } from '../socketHandler';
import { SOCKET_EVENTS } from '../../shared/events';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/SocketService');
jest.mock('../../services/ScheduleSlotService');
jest.mock('../../repositories/ScheduleSlotRepository');
jest.mock('../../services/ScheduleSlotValidationService');
jest.mock('../../services/NotificationService');
jest.mock('../../services/EmailService');
jest.mock('../../services/MockEmailService');
jest.mock('../../repositories/UserRepository');
jest.mock('../../services/AuthorizationService');
jest.mock('../../services/EmailServiceFactory');

// Mock console methods to eliminate ALL output during tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

// Global console mocks for clean test output
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

describe('SocketHandler', () => {
  let httpServer: HTTPServer;
  let socketHandler: SocketHandler;
  let clientSocket: Socket;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let activeTimeouts: NodeJS.Timeout[] = [];
  
  const TEST_USER_ID = 'test-user-123';
  const TEST_GROUP_ID = 'test-group-456';
  const TEST_FAMILY_ID = 'test-family-789';
  const JWT_SECRET = 'test-secret';

  // Helper function to track timeouts
  const setTestTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeout = setTimeout(callback, delay);
    activeTimeouts.push(timeout);
    return timeout;
  };

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });
  
  afterAll(async () => {
    // Final cleanup
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Create HTTP server
    httpServer = new HTTPServer();
    
    // Mock Prisma client with ALL required methods
    mockPrisma = {
      familyMember: {
        findFirst: jest.fn(),
      },
      group: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      scheduleSlot: {
        findUnique: jest.fn(),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;
    
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);

    // Setup default mock responses for SUCCESSFUL authentication
    (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
      familyId: TEST_FAMILY_ID,
    });
    
    (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([
      { id: TEST_GROUP_ID, familyId: TEST_FAMILY_ID },
      { id: 'another-group-id', familyId: TEST_FAMILY_ID },
    ]);

    (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: TEST_GROUP_ID,
      familyId: TEST_FAMILY_ID,
      familyMembers: [{ familyId: TEST_FAMILY_ID }],
    });

    (mockPrisma.scheduleSlot.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-slot-123',
      group: {
        id: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        familyMembers: [{ familyId: TEST_FAMILY_ID }],
      },
    });

    // Initialize SocketHandler
    socketHandler = new SocketHandler(httpServer);
    
    // Mock authorization service to allow all operations
    const mockAuthService = socketHandler['authorizationService'];
    if (mockAuthService) {
      mockAuthService.canUserAccessGroup = jest.fn().mockResolvedValue(true);
      mockAuthService.canUserAccessScheduleSlot = jest.fn().mockResolvedValue(true);
      mockAuthService.canUserAccessFamily = jest.fn().mockResolvedValue(true);
      mockAuthService.getUserAccessibleGroupIds = jest.fn().mockResolvedValue([TEST_GROUP_ID, 'another-group-id']);
      mockAuthService.canUserAccessGroups = jest.fn().mockResolvedValue({
        [TEST_GROUP_ID]: true,
        'another-group-id': true,
      });
    }
    
    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Clear all tracked timeouts
    activeTimeouts.forEach(timeout => clearTimeout(timeout));
    activeTimeouts = [];
    
    // Disconnect client sockets
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    // Cleanup socket handler (includes Prisma disconnect)
    if (socketHandler) {
      await socketHandler.cleanup();
    }
    
    // Close HTTP server with proper await
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    it('should accept valid JWT token', async () => {
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      const connectionPromise = new Promise<void>((resolve, reject) => {
        clientSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: { token },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          resolve();
        });

        clientSocket.on('connect_error', (error: unknown) => {
          reject(error);
        });

        // Set timeout to prevent hanging tests
        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      clientSocket.connect();
      await expect(connectionPromise).resolves.toBeUndefined();
    });

    it('should reject connection without token', async () => {
      const connectionPromise = new Promise<Error>((resolve) => {
        clientSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
          autoConnect: false,
        });

        clientSocket.on('connect_error', (error: unknown) => {
          resolve(error);
        });

        // Set timeout in case no error is emitted
        setTestTimeout(() => resolve(new Error('No error received')), 3000);
      });

      clientSocket.connect();
      const error = await connectionPromise;
      expect(error.message).toContain('Authentication failed');
    });

    it('should reject connection with invalid token', async () => {
      const connectionPromise = new Promise<Error>((resolve) => {
        clientSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: { token: 'invalid-token' },
          autoConnect: false,
        });

        clientSocket.on('connect_error', (error: unknown) => {
          resolve(error);
        });

        setTestTimeout(() => resolve(new Error('No error received')), 3000);
      });

      clientSocket.connect();
      const error = await connectionPromise;
      expect(error.message).toContain('Authentication failed');
    });

    it('should accept token from authorization header', async () => {
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      const connectionPromise = new Promise<void>((resolve, reject) => {
        clientSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
          extraHeaders: {
            authorization: `Bearer ${token}`,
          },
          autoConnect: false,
        });

        clientSocket.on('connect', () => {
          resolve();
        });

        clientSocket.on('connect_error', (error: unknown) => {
          reject(error);
        });

        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      clientSocket.connect();
      await expect(connectionPromise).resolves.toBeUndefined();
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should accept requests under rate limit', async () => {
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      // Create multiple connections to test rate limiting
      const connections: Socket[] = [];
      
      try {
        for (let i = 0; i < 5; i++) {
          const socket = io(`http://localhost:${(httpServer.address() as any).port}`, {
            auth: { token },
            autoConnect: false,
          });
          
          const connectionPromise = new Promise<void>((resolve, reject) => {
            socket.on('connect', () => resolve());
            socket.on('connect_error', (error: unknown) => reject(error));
            setTestTimeout(() => reject(new Error('Connection timeout')), 3000);
          });
          
          socket.connect();
          await connectionPromise;
          connections.push(socket);
        }
        
        expect(connections).toHaveLength(5);
      } finally {
        connections.forEach(socket => socket.disconnect());
      }
    });

    // Note: Rate limiting test with actual rejection would require creating many connections
    // which is complex to test in unit tests. This would be better suited for integration tests.
  });

  describe('Connection Events', () => {
    let connectedSocket: Socket;

    beforeEach(async () => {
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      connectedSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      await new Promise<void>((resolve, reject) => {
        connectedSocket.on('connect', () => resolve());
        connectedSocket.on('connect_error', (error: unknown) => reject(error));
        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
        connectedSocket.connect();
      });
    });

    afterEach(() => {
      if (connectedSocket) {
        connectedSocket.disconnect();
      }
    });

    it('should emit CONNECTED event on successful connection', async () => {
      // Create a fresh socket connection for this test to avoid race conditions
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      const testSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      const connectedEventPromise = new Promise<any>((resolve, reject) => {
        testSocket.on(SOCKET_EVENTS.CONNECTED, (data: unknown) => {
          resolve(data);
        });
        
        testSocket.on('connect_error', (error: unknown) => {
          reject(error);
        });
        
        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Connect after setting up the listener
      testSocket.connect();
      
      const data = await connectedEventPromise;
      expect(data).toEqual({
        userId: TEST_USER_ID,
        groups: [TEST_GROUP_ID, 'another-group-id'],
        timestamp: expect.any(Number),
      });
      
      testSocket.disconnect();
    });

    it('should handle group join events', async () => {
      // Create second client that will receive the join event
      const token = jwt.sign({ userId: 'another-user-id' }, JWT_SECRET);
      const secondSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      // Set up event listener on second socket before connecting
      const userJoinedPromise = new Promise<any>((resolve, reject) => {
        secondSocket.on(SOCKET_EVENTS.USER_JOINED, (data: unknown) => {
          resolve(data);
        });
        
        setTestTimeout(() => reject(new Error('Join event timeout')), 3000);
      });

      // Connect the second socket and have it join the group first
      await new Promise<void>((resolve) => {
        secondSocket.on('connect', () => {
          // Second socket joins the group room first
          secondSocket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId: TEST_GROUP_ID });
          setTestTimeout(() => {
            // Then first socket joins, which should trigger USER_JOINED event to second socket
            connectedSocket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId: TEST_GROUP_ID });
          }, 100);
          resolve();
        });
        secondSocket.connect();
      });
      
      // Second socket should receive the join event
      const joinData = await userJoinedPromise;
      expect(joinData).toEqual({
        userId: TEST_USER_ID,
        groupId: TEST_GROUP_ID,
      });

      secondSocket.disconnect();
    });

    it('should handle group leave events', async () => {
      // Create second client that will receive the leave event
      const token = jwt.sign({ userId: 'another-user-id' }, JWT_SECRET);
      const secondSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      // Set up event listener on second socket before connecting
      const userLeftPromise = new Promise<any>((resolve, reject) => {
        secondSocket.on(SOCKET_EVENTS.USER_LEFT, (data: unknown) => {
          resolve(data);
        });
        
        setTestTimeout(() => reject(new Error('Leave event timeout')), 3000);
      });

      // Connect the second socket and have both join the group first
      await new Promise<void>((resolve) => {
        secondSocket.on('connect', () => {
          // Both sockets join the group room first
          secondSocket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId: TEST_GROUP_ID });
          connectedSocket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId: TEST_GROUP_ID });
          setTestTimeout(() => {
            // Then first socket leaves, which should trigger USER_LEFT event to second socket
            connectedSocket.emit(SOCKET_EVENTS.GROUP_LEAVE, { groupId: TEST_GROUP_ID });
          }, 100);
          resolve();
        });
        secondSocket.connect();
      });
      
      const leaveData = await userLeftPromise;
      expect(leaveData).toEqual({
        userId: TEST_USER_ID,
        groupId: TEST_GROUP_ID,
      });

      secondSocket.disconnect();
    });

    it('should handle schedule subscription events', async () => {
      // Test schedule subscribe - no direct response, but should not error
      connectedSocket.emit(SOCKET_EVENTS.SCHEDULE_SUBSCRIBE, { 
        groupId: TEST_GROUP_ID, 
        week: '2024-01', 
      });

      // Test schedule unsubscribe
      connectedSocket.emit(SOCKET_EVENTS.SCHEDULE_UNSUBSCRIBE, { 
        groupId: TEST_GROUP_ID, 
        week: '2024-01', 
      });

      // If no errors are thrown, the events were handled successfully
      await new Promise(resolve => setTestTimeout(() => resolve(undefined), 100));
    });

    it('should handle heartbeat events', async () => {
      const heartbeatAckPromise = new Promise<any>((resolve) => {
        connectedSocket.on(SOCKET_EVENTS.HEARTBEAT_ACK, (data: unknown) => {
          resolve(data);
        });
      });

      connectedSocket.emit(SOCKET_EVENTS.HEARTBEAT);
      
      const ackData = await heartbeatAckPromise;
      expect(ackData).toEqual({
        timestamp: expect.any(Number),
      });
    });

    it('should handle typing events', async () => {
      // Create second client to receive typing events
      const token = jwt.sign({ userId: 'another-user-id' }, JWT_SECRET);
      const secondSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      const typingStartPromise = new Promise<any>((resolve, reject) => {
        secondSocket.on(SOCKET_EVENTS.USER_TYPING, (data: unknown) => {
          resolve(data);
        });
        
        setTestTimeout(() => reject(new Error('Typing start timeout')), 3000);
      });

      const typingStopPromise = new Promise<any>((resolve, reject) => {
        secondSocket.on(SOCKET_EVENTS.USER_STOPPED_TYPING, (data: unknown) => {
          resolve(data);
        });
        
        setTestTimeout(() => reject(new Error('Typing stop timeout')), 3000);
      });

      // Connect second socket and set up room joining
      await new Promise<void>((resolve) => {
        secondSocket.on('connect', () => {
          const scheduleSlotId = 'test-slot-123';
          
          // Both sockets join the schedule slot room
          connectedSocket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_JOIN, { scheduleSlotId });
          secondSocket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_JOIN, { scheduleSlotId });
          
          // Small delay to ensure room joining is complete
          setTestTimeout(() => {
            // First socket starts typing
            connectedSocket.emit('typing:start', { scheduleSlotId });
          }, 100);
          
          resolve();
        });
        secondSocket.connect();
      });
      
      const typingData = await typingStartPromise;
      expect(typingData).toEqual({
        userId: TEST_USER_ID,
        scheduleSlotId: 'test-slot-123',
      });

      // First socket stops typing
      connectedSocket.emit('typing:stop', { scheduleSlotId: 'test-slot-123' });
      
      const stopTypingData = await typingStopPromise;
      expect(stopTypingData).toEqual({
        userId: TEST_USER_ID,
        scheduleSlotId: 'test-slot-123',
      });

      secondSocket.disconnect();
    });
  });

  describe('Database Integration', () => {
    it('should handle user with no family', async () => {
      // Mock the authorization service to return empty groups for this specific user
      const mockAuthService = socketHandler['authorizationService'];
      mockAuthService.getUserAccessibleGroupIds = jest.fn().mockResolvedValue([]);
      
      const token = jwt.sign({ userId: 'user-without-family' }, JWT_SECRET);
      
      const connectedSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      await new Promise<void>((resolve, reject) => {
        connectedSocket.on('connect', () => resolve());
        connectedSocket.on('connect_error', (error: unknown) => reject(error));
        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
        connectedSocket.connect();
      });

      // Should still connect successfully, just with no groups
      expect(mockAuthService.getUserAccessibleGroupIds).toHaveBeenCalledWith('user-without-family');

      connectedSocket.disconnect();
    });

    it('should handle database query errors gracefully', async () => {
      // Mock authorization service to throw database error
      const mockAuthService = socketHandler['authorizationService'];
      mockAuthService.getUserAccessibleGroupIds = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const token = jwt.sign({ userId: 'user-db-error' }, JWT_SECRET);
      
      const errorPromise = new Promise<any>((resolve) => {
        const connectedSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
          auth: { token },
          autoConnect: false,
        });

        connectedSocket.on(SOCKET_EVENTS.ERROR, (error: unknown) => {
          resolve(error);
          connectedSocket.disconnect();
        });

        connectedSocket.on('connect_error', (error) => {
          resolve(error);
        });

        setTestTimeout(() => resolve(new Error('No error received')), 3000);
        connectedSocket.connect();
      });

      const error = await errorPromise;
      expect(error.type).toBe('CONNECTION_ERROR');
      expect(error.message).toBe('Failed to establish connection');
    });
  });

  describe('Public Methods', () => {
    it('should broadcast to group', () => {
      const ioSpy = jest.spyOn(socketHandler.getIO(), 'to');
      const emitSpy = jest.fn();
      ioSpy.mockReturnValue({ emit: emitSpy } as any);

      const testData = { message: 'test' };
      socketHandler.broadcastToGroup(TEST_GROUP_ID, 'test-event', testData);

      expect(ioSpy).toHaveBeenCalledWith(TEST_GROUP_ID);
      expect(emitSpy).toHaveBeenCalledWith('test-event', testData);
    });

    it('should broadcast to user', () => {
      const ioSpy = jest.spyOn(socketHandler.getIO(), 'to');
      const emitSpy = jest.fn();
      ioSpy.mockReturnValue({ emit: emitSpy } as any);

      const testData = { message: 'test' };
      socketHandler.broadcastToUser(TEST_USER_ID, 'test-event', testData);

      expect(ioSpy).toHaveBeenCalledWith(TEST_USER_ID);
      expect(emitSpy).toHaveBeenCalledWith('test-event', testData);
    });

    it('should return IO instance', () => {
      const io = socketHandler.getIO();
      expect(io).toBeInstanceOf(SocketIOServer);
    });
  });

  describe('Error Handling', () => {
    it('should handle socket errors', async () => {
      const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
      
      const connectedSocket = io(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token },
        autoConnect: false,
      });

      await new Promise<void>((resolve, reject) => {
        connectedSocket.on('connect', () => resolve());
        connectedSocket.on('connect_error', (error: unknown) => reject(error));
        setTestTimeout(() => reject(new Error('Connection timeout')), 5000);
        connectedSocket.connect();
      });

      // Emit error event
      const testError = { type: 'TEST_ERROR', message: 'Test error message' };
      connectedSocket.emit(SOCKET_EVENTS.ERROR, testError);

      // Should not throw or disconnect - just log the error
      await new Promise(resolve => setTestTimeout(() => resolve(undefined), 100));

      connectedSocket.disconnect();
    });
  });

  describe('CORS Configuration', () => {
    it('should configure CORS from environment variables', () => {
      const io = socketHandler.getIO();
      // Note: This is testing internal configuration which is hard to access directly
      // In a real scenario, you might want to make the CORS config more testable
      expect(io).toBeDefined();
    });
  });
});