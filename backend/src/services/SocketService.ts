// @ts-nocheck
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ScheduleSlotService } from './ScheduleSlotService';
import { WeeklySchedule } from '../types';
import { SOCKET_EVENTS } from '../shared/events';
import { createLogger } from '../utils/logger';

const logger = createLogger('SocketService');

export interface AuthData {
  userId: string;
  groupIds: string[];
}

export interface ScheduleSlotUpdateData {
  scheduleSlotId: string;
  vehicleId?: string;
  driverId?: string;
  childrenIds?: string[];
  action?: 'assign' | 'remove';
}

export interface ConflictData {
  scheduleSlotId: string;
  conflictType: 'DRIVER_DOUBLE_BOOKING' | 'VEHICLE_DOUBLE_BOOKING' | 'CAPACITY_EXCEEDED';
  affectedUsers: string[];
  message?: string;
}

export class SocketService {
  constructor(private scheduleSlotService: ScheduleSlotService) {}

  async handleConnection(socket: Socket, authData: AuthData): Promise<void> {
    // Store user ID on socket for later reference
    socket.userId = authData.userId;

    // Join user to their personal room
    await socket.join(authData.userId);

    // Join user to all their group rooms
    for (const groupId of authData.groupIds) {
      await socket.join(groupId);
      
      // Notify other group members that user has joined
      socket.to(groupId).emit(SOCKET_EVENTS.USER_JOINED, {
        userId: authData.userId,
        groupId,
      });
    }

    logger.info('User connected and joined groups', { userId: authData.userId, groupCount: authData.groupIds.length });
  }

  async handleScheduleSlotUpdate(
    socket: Socket, 
    io: SocketIOServer, 
    data: ScheduleSlotUpdateData,
  ): Promise<void> {
    try {
      const { scheduleSlotId, driverId, vehicleId } = data;

      // Handle vehicle assignment/removal
      if (vehicleId) {
        if (data.action === 'remove') {
          await this.scheduleSlotService.removeVehicleFromSlot(scheduleSlotId, vehicleId);
        } else {
          // Default to assign
          await this.scheduleSlotService.assignVehicleToSlot({
            scheduleSlotId,
            vehicleId,
            ...(driverId && { driverId }),
          });
        }
      }

      // Update driver for existing vehicle assignment
      if (driverId && vehicleId && data.action !== 'remove') {
        await this.scheduleSlotService.updateVehicleDriver(scheduleSlotId, vehicleId, driverId);
      }

      // Note: Child assignments must be done through API endpoints with vehicleAssignmentId
      // Socket updates do not support child assignments for now

      // Get updated schedule slot details
      const updatedSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      
      if (!updatedSlot) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          type: 'SCHEDULE_SLOT_NOT_FOUND',
          message: 'Schedule slot not found',
        });
        return;
      }

      // Broadcast schedule slot update to all group members
      const groupId = updatedSlot.groupId;
      
      io.to(groupId).emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, {
        ...updatedSlot,
        updatedBy: socket.userId,
      });

    } catch (error) {
      logger.error('Failed to update schedule slot', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, scheduleSlotId: data.scheduleSlotId });

      socket.emit(SOCKET_EVENTS.ERROR, {
        type: this.categorizeError(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleDisconnection(socket: Socket): Promise<void> {
    if (!socket.userId) return;

    // Notify all groups that the user has left
    for (const room of socket.rooms) {
      if (room !== socket.id && room !== socket.userId) {
        // This is a group room
        socket.to(room).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: socket.userId,
          groupId: room,
        });
      }
    }

    logger.info('User disconnected', { userId: socket.userId });
  }

  broadcastScheduleUpdate(io: SocketIOServer, scheduleData: WeeklySchedule): void {
    io.to(scheduleData.groupId).emit(SOCKET_EVENTS.SCHEDULE_UPDATED, scheduleData);
  }

  async detectAndBroadcastConflicts(
    io: SocketIOServer, 
    conflictData: ConflictData,
  ): Promise<void> {
    // Notify affected users about the conflict
    for (const userId of conflictData.affectedUsers) {
      io.to(userId).emit(SOCKET_EVENTS.CONFLICT_DETECTED, conflictData);
    }

    logger.warn('Conflict detected for schedule slot', { scheduleSlotId: conflictData.scheduleSlotId, conflictType: conflictData.conflictType, affectedUserCount: conflictData.affectedUsers.length });
  }

  async broadcastGroupNotification(
    io: SocketIOServer,
    groupId: string,
    notification: {
      type: 'SCHEDULE_PUBLISHED' | 'MEMBER_JOINED' | 'MEMBER_LEFT';
      message: string;
      data?: Record<string, unknown>;
    },
  ): Promise<void> {
    io.to(groupId).emit(SOCKET_EVENTS.NOTIFICATION, notification);
  }

  // Get real-time group statistics
  getGroupActiveUsers(io: SocketIOServer, groupId: string): number {
    const room = io.sockets.adapter.rooms.get(groupId);
    return room ? room.size : 0;
  }

  // Force disconnect user from all sessions
  async forceDisconnectUser(io: SocketIOServer, userId: string): Promise<void> {
    const sockets = await io.in(userId).fetchSockets();
    
    for (const socket of sockets) {
      socket.disconnect(true);
    }
  }

  private categorizeError(error: unknown): string {
    if (error.message.includes('capacity')) {
      return 'CAPACITY_ERROR';
    }
    if (error.message.includes('not found')) {
      return 'NOT_FOUND_ERROR';
    }
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      return 'DUPLICATE_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  // Real-time capacity monitoring
  async monitorScheduleSlotCapacity(
    io: SocketIOServer,
    scheduleSlotId: string,
  ): Promise<void> {
    const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
    
    if (!scheduleSlot) return;

    const groupId = scheduleSlot.groupId;
    
    if (scheduleSlot.availableSeats <= 0) {
      io.to(groupId).emit(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_FULL, {
        scheduleSlotId,
        message: 'Schedule slot is now at full capacity',
      });
    } else if (scheduleSlot.availableSeats <= 1) {
      io.to(groupId).emit(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_WARNING, {
        scheduleSlotId,
        availableSeats: scheduleSlot.availableSeats,
        message: 'Schedule slot is almost at capacity',
      });
    }
  }
}