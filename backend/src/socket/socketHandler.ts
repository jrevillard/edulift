import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ServerType } from '@hono/node-server';
import { SocketService } from '../services/SocketService';
import { ScheduleSlotService } from '../services/ScheduleSlotService';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { ScheduleSlotValidationService } from '../services/ScheduleSlotValidationService';
import { NotificationService } from '../services/NotificationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { UserRepository } from '../repositories/UserRepository';
import { prisma as globalPrisma } from '../config/database';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS } from '../shared/events';
import { AuthorizationService } from '../services/AuthorizationService';
import { createLogger } from '../utils/logger';
import {
  validatePayload,
  scheduleSlotUpdateSchema,
  scheduleSlotJoinSchema,
  groupJoinSchema,
  scheduleSubscribeSchema,
  typingStartSchema,
  authenticateSchema,
} from './validation';

// Extend Socket interface to include userId
declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

export class SocketHandler {
  private io: SocketIOServer;
  socketService: SocketService;
  private authorizationService: AuthorizationService;
  private prisma: typeof globalPrisma;
  private logger = createLogger('socket');
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(server: HTTPServer | ServerType) {
    // Type safety: createAdaptorServer returns ServerType which includes HTTP/2,
    // but Socket.IO requires HTTP/1. In practice, createAdaptorServer always
    // creates HTTP/1 servers, so this cast is safe. Socket.IO will fail clearly
    // if HTTP/2 is ever used.
    const httpServer = server as HTTPServer;

    // Initialize Socket.io with CORS configuration
    const corsOrigins = process.env.CORS_ORIGIN === '*'
      ? '*'
      : process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim());

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Use singleton Prisma instance
    this.prisma = globalPrisma;
    const prisma = this.prisma;
    const scheduleSlotRepository = new ScheduleSlotRepository(prisma);
    const userRepository = new UserRepository(prisma);

    // Use EmailServiceFactory for consistent email configuration
    const emailService = EmailServiceFactory.getInstance();

    const notificationService = new NotificationService(emailService, userRepository, scheduleSlotRepository, prisma);
    const scheduleSlotValidationService = new ScheduleSlotValidationService(prisma);
    const scheduleSlotService = new ScheduleSlotService(scheduleSlotRepository, notificationService, scheduleSlotValidationService);
    this.socketService = new SocketService(scheduleSlotService);

    // Initialize authorization service
    this.authorizationService = new AuthorizationService(this.prisma);

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          throw new Error('No authentication token provided');
        }

        const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'fallback-secret-key';
        const decoded = jwt.verify(token, jwtAccessSecret) as any;
        
        if (!decoded.userId) {
          throw new Error('Invalid token payload');
        }

        // Store user info on socket
        socket.userId = decoded.userId;
        
        next();
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.error('Socket authentication failed:', { error: error instanceof Error ? error.message : String(error) });
        }
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware - ALWAYS ENABLED
    this.io.use((socket, next) => {
      const limit = 100; // requests per minute
      const windowMs = 60 * 1000; // 1 minute

      const key = socket.handshake.address;
      const now = Date.now();
      
      if (!this.rateLimitMap.has(key)) {
        this.rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      const rateLimit = this.rateLimitMap.get(key);
      
      // Fix TypeScript error: ensure rateLimit is not undefined
      if (!rateLimit) {
        next(new Error('Rate limit error'));
        return;
      }
      
      if (now > rateLimit.resetTime) {
        rateLimit.count = 1;
        rateLimit.resetTime = now + windowMs;
        next();
        return;
      }

      if (rateLimit.count >= limit) {
        next(new Error('Rate limit exceeded'));
        return;
      }

      rateLimit.count++;
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: Socket) => {
      this.logger.info(`Socket connected: ${socket.id} for user: ${socket.userId}`);

      try {
        // Handle initial connection and join user to groups
        await this.handleUserConnection(socket);

        // Schedule Slot related events
        socket.on(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, async (data) => {
          // Validate payload before processing
          const validation = validatePayload(scheduleSlotUpdateSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }
          await this.socketService.handleScheduleSlotUpdate(socket, this.io, validation.data as any);
        });

        socket.on(SOCKET_EVENTS.SCHEDULE_SLOT_JOIN, async (data) => {
          // Validate payload first
          const validation = validatePayload(scheduleSlotJoinSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          // SECURITY: Check user authentication and authorization
          if (!socket.userId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not authenticated',
            });
            return;
          }

          const canAccess = await this.authorizationService.canUserAccessScheduleSlot(socket.userId, validation.data.scheduleSlotId);

          if (!canAccess) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to access this schedule slot',
            });
            return;
          }

          await socket.join(`scheduleSlot-${validation.data.scheduleSlotId}`);
          if (process.env.NODE_ENV !== 'test') {
            this.logger.info(`User ${socket.userId} joined schedule slot ${validation.data.scheduleSlotId}`);
          }
        });

        socket.on(SOCKET_EVENTS.SCHEDULE_SLOT_LEAVE, async (data) => {
          // Validate payload first
          const validation = validatePayload(scheduleSlotJoinSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          await socket.leave(`scheduleSlot-${validation.data.scheduleSlotId}`);
          this.logger.info(`User ${socket.userId} left schedule slot ${validation.data.scheduleSlotId}`);
        });

        // Group-related events
        socket.on(SOCKET_EVENTS.GROUP_JOIN, async (data) => {
          // Validate payload first
          const validation = validatePayload(groupJoinSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          // SECURITY: Check user authentication and authorization
          if (!socket.userId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not authenticated',
            });
            return;
          }

          const canAccess = await this.authorizationService.canUserAccessGroup(socket.userId, validation.data.groupId);

          if (!canAccess) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to access this group',
            });
            return;
          }

          await socket.join(validation.data.groupId);
          socket.to(validation.data.groupId).emit(SOCKET_EVENTS.USER_JOINED, {
            userId: socket.userId,
            groupId: validation.data.groupId,
          });
        });

        socket.on(SOCKET_EVENTS.GROUP_LEAVE, async (data) => {
          // Validate payload first
          const validation = validatePayload(groupJoinSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          await socket.leave(validation.data.groupId);
          socket.to(validation.data.groupId).emit(SOCKET_EVENTS.USER_LEFT, {
            userId: socket.userId,
            groupId: validation.data.groupId,
          });
        });

        // Schedule-related events
        socket.on(SOCKET_EVENTS.SCHEDULE_SUBSCRIBE, async (data) => {
          // Validate payload first
          const validation = validatePayload(scheduleSubscribeSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          // SECURITY: Check user authentication and authorization
          if (!socket.userId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not authenticated',
            });
            return;
          }

          const canAccess = await this.authorizationService.canUserAccessGroup(socket.userId, validation.data.groupId);
          
          if (!canAccess) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to access this group schedule',
            });
            return;
          }

          await socket.join(`schedule-${validation.data.groupId}-${validation.data.week}`);
        });

        socket.on(SOCKET_EVENTS.SCHEDULE_UNSUBSCRIBE, async (data) => {
          // Validate payload first
          const validation = validatePayload(scheduleSubscribeSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          await socket.leave(`schedule-${validation.data.groupId}-${validation.data.week}`);
        });

        // Real-time collaboration events
        socket.on('typing:start', async (data) => {
          // Validate payload first
          const validation = validatePayload(typingStartSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          // SECURITY: Check user authentication and authorization
          if (!socket.userId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not authenticated',
            });
            return;
          }

          const canAccess = await this.authorizationService.canUserAccessScheduleSlot(socket.userId, validation.data.scheduleSlotId);
          
          if (!canAccess) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to access this schedule slot',
            });
            return;
          }

          socket.to(`scheduleSlot-${validation.data.scheduleSlotId}`).emit(SOCKET_EVENTS.USER_TYPING, {
            userId: socket.userId,
            scheduleSlotId: validation.data.scheduleSlotId,
          });
        });

        socket.on('typing:stop', async (data) => {
          // Validate payload first
          const validation = validatePayload(typingStartSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          // SECURITY: Check user authentication and authorization
          if (!socket.userId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHENTICATION_ERROR',
              message: 'User not authenticated',
            });
            return;
          }

          const canAccess = await this.authorizationService.canUserAccessScheduleSlot(socket.userId, validation.data.scheduleSlotId);

          if (!canAccess) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to access this schedule slot',
            });
            return;
          }

          socket.to(`scheduleSlot-${validation.data.scheduleSlotId}`).emit(SOCKET_EVENTS.USER_STOPPED_TYPING, {
            userId: socket.userId,
            scheduleSlotId: validation.data.scheduleSlotId,
          });
        });

        // Heartbeat/presence events
        socket.on(SOCKET_EVENTS.HEARTBEAT, () => {
          socket.emit(SOCKET_EVENTS.HEARTBEAT_ACK, { timestamp: Date.now() });
        });

        // Test-specific event handlers for simplified room operations
        socket.on('join-group', async (data) => {
          // Accept both raw string and object format for backwards compatibility
          const groupId = typeof data === 'string' ? data : data?.id;
          if (!groupId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: 'Invalid group ID',
            });
            return;
          }

          if (socket.userId) {
            await socket.join(groupId);
            this.logger.info(`User ${socket.userId} joined group ${groupId}`);
          }
        });

        socket.on('join-family', async (data) => {
          // Accept both raw string and object format for backwards compatibility
          const familyId = typeof data === 'string' ? data : data?.id;
          if (!familyId) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: 'Invalid family ID',
            });
            return;
          }

          if (socket.userId) {
            await socket.join(familyId);
            this.logger.info(`User ${socket.userId} joined family ${familyId}`);
          }
        });

        socket.on('authenticate', async (data) => {
          // Validate payload first (even for test events)
          const validation = validatePayload(authenticateSchema, data);
          if (!validation.success) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              type: 'VALIDATION_ERROR',
              message: validation.error,
            });
            return;
          }

          if (socket.userId) {
            await socket.join(validation.data.userId);
            this.logger.info(`User ${socket.userId} authenticated and joined user room ${validation.data.userId}`);
          }
        });

        // Error handling
        socket.on(SOCKET_EVENTS.ERROR, (error) => {
          this.logger.error(`Socket error for user ${socket.userId}:`, { error: error instanceof Error ? error.message : String(error) });
        });

        // Disconnection handling
        socket.on('disconnect', async (reason) => {
          this.logger.info(`Socket disconnected: ${socket.id} for user: ${socket.userId}, reason: ${reason}`);
          await this.socketService.handleDisconnection(socket);
        });

      } catch (error) {
        this.logger.error('Error in socket connection handling:', { error: error instanceof Error ? error.message : String(error) });
        socket.emit(SOCKET_EVENTS.ERROR, {
          type: 'CONNECTION_ERROR',
          message: 'Failed to establish connection',
        });
        socket.disconnect();
      }
    });
  }

  private async handleUserConnection(socket: Socket): Promise<void> {
    if (!socket.userId) {
      throw new Error('User ID not found on socket');
    }

    try {
      // Use AuthorizationService to get user's accessible groups
      const groupIds = await this.authorizationService.getUserAccessibleGroupIds(socket.userId);

      if (groupIds.length === 0) {
        this.logger.warn(`User ${socket.userId} has no accessible groups`);
        // Still allow connection but with no groups
      }

      // Use SocketService to handle connection
      await this.socketService.handleConnection(socket, {
        userId: socket.userId,
        groupIds,
      });

      // Also join family rooms for family-wide notifications
      const userFamilies = await this.authorizationService.getUserFamilies(socket.userId);
      for (const familyId of userFamilies) {
        await socket.join(`family-${familyId}`);
      }

      // Send connection success
      socket.emit(SOCKET_EVENTS.CONNECTED, {
        userId: socket.userId,
        groups: groupIds,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.logger.error(`Error handling user connection for user ${socket.userId}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // Public methods for external use
  public broadcastToGroup(groupId: string, event: string, data: unknown): void {
    this.io.to(groupId).emit(event, data);
  }

  public broadcastToUser(userId: string, event: string, data: unknown): void {
    this.io.to(userId).emit(event, data);
  }

  public getConnectedUsers(groupId: string): number {
    return this.socketService.getGroupActiveUsers(this.io, groupId);
  }

  public async forceDisconnectUser(userId: string): Promise<void> {
    await this.socketService.forceDisconnectUser(this.io, userId);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public async cleanup(): Promise<void> {
    try {
      // Disconnect all connected sockets first
      this.io.disconnectSockets(true);

      // Wait for disconnections to process (use unref to prevent hanging)
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 100);
        timer.unref();
      });

      // Close the Socket.IO server
      await new Promise<void>((resolve) => {
        this.io.close(() => {
          resolve();
        });
      });

      // Clear rate limit map
      this.rateLimitMap.clear();

      // Note: Don't disconnect Prisma singleton here - it's managed globally
      // and may be used by other parts of the application
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.error('Error during cleanup:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}