/**
 * Socket Emitter Utility
 * 
 * Provides a way for controllers and services to emit WebSocket events
 * after database operations without circular import issues.
 */

import { SOCKET_EVENTS } from '../shared/events';

// Global reference to socket handler (set during app initialization)
let globalSocketHandler: any = null;

export const setGlobalSocketHandler = (socketHandler: unknown): void => {
  globalSocketHandler = socketHandler;
};

export const getGlobalSocketHandler = (): unknown => {
  return globalSocketHandler;
};

// Utility functions for common WebSocket emissions
export class SocketEmitter {
  
  static broadcastScheduleSlotUpdate = (groupId: string, scheduleSlotId: string, data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }

    globalSocketHandler.broadcastToGroup(groupId, SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, {
      scheduleSlotId,
      groupId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastScheduleSlotCreated = (groupId: string, scheduleSlotId: string, data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }

    globalSocketHandler.broadcastToGroup(groupId, SOCKET_EVENTS.SCHEDULE_SLOT_CREATED, {
      scheduleSlotId,
      groupId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastScheduleSlotDeleted = (groupId: string, scheduleSlotId: string): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }
    
    globalSocketHandler.broadcastToGroup(groupId, SOCKET_EVENTS.SCHEDULE_SLOT_DELETED, {
      scheduleSlotId,
      groupId,
    });
  };
  
  static broadcastScheduleUpdate = (groupId: string, data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }

    globalSocketHandler.broadcastToGroup(groupId, SOCKET_EVENTS.SCHEDULE_UPDATED, {
      groupId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastGroupUpdate = (groupId: string, data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }

    globalSocketHandler.broadcastToGroup(groupId, SOCKET_EVENTS.GROUP_UPDATED, {
      groupId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastChildUpdate = (userId: string, familyId: string, eventType: 'added' | 'updated' | 'deleted', data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }
    
    const eventMap = {
      added: SOCKET_EVENTS.CHILD_ADDED,
      updated: SOCKET_EVENTS.CHILD_UPDATED,
      deleted: SOCKET_EVENTS.CHILD_DELETED,
    };
    
    globalSocketHandler.broadcastToUser(userId, eventMap[eventType], {
      userId,
      familyId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastVehicleUpdate = (userId: string, familyId: string, eventType: 'added' | 'updated' | 'deleted', data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }
    
    const eventMap = {
      added: SOCKET_EVENTS.VEHICLE_ADDED,
      updated: SOCKET_EVENTS.VEHICLE_UPDATED,
      deleted: SOCKET_EVENTS.VEHICLE_DELETED,
    };
    
    globalSocketHandler.broadcastToUser(userId, eventMap[eventType], {
      userId,
      familyId,
      ...(data as Record<string, unknown>),
    });
  };
  
  static broadcastFamilyUpdate = (familyId: string, eventType: 'memberJoined' | 'memberLeft' | 'updated', data?: unknown): void => {
    if (!globalSocketHandler) {
      console.warn('SocketHandler not initialized, skipping WebSocket emission');
      return;
    }
    
    const eventMap = {
      memberJoined: SOCKET_EVENTS.FAMILY_MEMBER_JOINED,
      memberLeft: SOCKET_EVENTS.FAMILY_MEMBER_LEFT,
      updated: SOCKET_EVENTS.FAMILY_UPDATED,
    };
    
    // Broadcast to all family members (assuming they're in rooms based on family ID)
    globalSocketHandler.broadcastToGroup(familyId, eventMap[eventType], {
      familyId,
      ...(data as Record<string, unknown>),
    });
  };
}