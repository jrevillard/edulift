/**
 * Standardized WebSocket Event Registry
 * 
 * This file defines all WebSocket event names used across the application
 * to ensure consistency between frontend emits/listens and backend handling.
 */

export const SOCKET_EVENTS = {
  // Connection Events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  
  // Group Management Events
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  GROUP_UPDATED: 'group:updated',
  MEMBER_JOINED: 'member:joined', 
  MEMBER_LEFT: 'member:left',
  
  // User Presence Events
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  USER_TYPING: 'user:typing',
  USER_STOPPED_TYPING: 'user:stopped_typing',
  
  // Schedule Events
  SCHEDULE_UPDATED: 'schedule:updated',
  SCHEDULE_SLOT_UPDATED: 'schedule:slot:updated',
  SCHEDULE_SLOT_CREATED: 'schedule:slot:created', 
  SCHEDULE_SLOT_DELETED: 'schedule:slot:deleted',
  
  // Schedule Capacity Events
  SCHEDULE_SLOT_CAPACITY_FULL: 'scheduleSlot:capacity:full',
  SCHEDULE_SLOT_CAPACITY_WARNING: 'scheduleSlot:capacity:warning',
  
  // Schedule Subscription Events
  SCHEDULE_SUBSCRIBE: 'schedule:subscribe',
  SCHEDULE_UNSUBSCRIBE: 'schedule:unsubscribe',
  SCHEDULE_SLOT_JOIN: 'scheduleSlot:join',
  SCHEDULE_SLOT_LEAVE: 'scheduleSlot:leave',
  
  // Child Management Events
  CHILD_ADDED: 'child:added',
  CHILD_UPDATED: 'child:updated',
  CHILD_DELETED: 'child:deleted',
  
  // Vehicle Management Events  
  VEHICLE_ADDED: 'vehicle:added',
  VEHICLE_UPDATED: 'vehicle:updated', 
  VEHICLE_DELETED: 'vehicle:deleted',
  
  // Family Events (MODERN FORMAT ONLY)
  FAMILY_MEMBER_JOINED: 'family:member:joined',
  FAMILY_MEMBER_LEFT: 'family:member:left',
  FAMILY_UPDATED: 'family:updated',
  
  // Notification Events
  NOTIFICATION: 'notification',
  
  // Conflict Detection Events
  CONFLICT_DETECTED: 'conflict:detected',
  
  // Error Events
  ERROR: 'error',
  
  // Heartbeat Events
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat-ack',
} as const;

// Type for event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// Event data interfaces
export interface GroupEventData {
  groupId: string;
  userId?: string;
  familyId?: string;
}

export interface ScheduleEventData {
  groupId: string;
  scheduleSlotId?: string;
  week?: string;
}

export interface UserEventData {
  userId: string;
  groupId: string;
  familyId?: string;
}

export interface NotificationEventData {
  type: 'SCHEDULE_PUBLISHED' | 'MEMBER_JOINED' | 'MEMBER_LEFT';
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorEventData {
  type: string;
  message: string;
}

export interface ConflictEventData {
  scheduleSlotId: string;
  conflictType: 'DRIVER_DOUBLE_BOOKING' | 'VEHICLE_DOUBLE_BOOKING' | 'CAPACITY_EXCEEDED';
  affectedUsers: string[];
  message?: string;
}

export interface ChildEventData {
  groupId?: string;
  familyId?: string;
  childId?: string;
  userId?: string;
}

export interface VehicleEventData {
  groupId?: string;
  familyId?: string;
  vehicleId?: string;
  userId?: string;
}

export interface FamilyEventData {
  familyId: string;
  userId?: string;
  memberId?: string;
}

export interface CapacityEventData {
  scheduleSlotId: string;
  groupId: string;
  currentCapacity: number;
  maxCapacity: number;
  warningType: 'WARNING' | 'FULL';
}

// All events now use modern colon-separated format only
// Legacy compatibility layer has been completely removed