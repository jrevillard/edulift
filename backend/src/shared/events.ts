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
  GROUP_CREATED: 'group:created',
  GROUP_DELETED: 'group:deleted',
  GROUP_FAMILY_ADDED: 'group:family:added',
  GROUP_FAMILY_LEFT: 'group:family:left',
  GROUP_FAMILY_REMOVED: 'group:family:removed',
  GROUP_FAMILY_ROLE_UPDATED: 'group:family:role:updated',
  GROUP_INVITATION_SENT: 'group:invitation:sent',
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
export interface ConnectedPayload {
  userId: string;
  groups: string[];
  timestamp: number;
}

export interface DisconnectedPayload {
  reason: 'client_disconnect' | 'server_disconnect' | 'timeout' | 'auth_failed';
  timestamp: number;
}

export interface GroupEventData {
  groupId: string;
  action: 'created' | 'deleted' | 'updated';
  createdBy?: string;
  deletedBy?: string;
  updatedBy?: string;
  group?: {
    id: string;
    name: string;
    description: string;
    inviteCode: string;
  };
}

export interface GroupFamilyEventData {
  groupId: string;
  familyId: string;
  action: 'added' | 'left' | 'removed';
  familyName?: string;
  joinedBy?: string;
  removedBy?: string;
}

export interface GroupFamilyRoleEventData {
  groupId: string;
  familyId: string;
  newRole: 'admin' | 'member';
  previousRole?: 'admin' | 'member';
  updatedBy: string;
}

export interface GroupInvitationEventData {
  groupId: string;
  familyId: string;
  inviteCode: string;
  invitedBy: string;
  expiresAt: number;
}

export interface MemberEventData {
  groupId: string;
  userId: string;
  action: 'joined' | 'left';
  userName?: string;
}

export interface ScheduleEventData {
  groupId: string;
  scheduleSlotId?: string;
  week?: string;
  schedule?: Record<string, unknown>;
}

export interface ScheduleSlotEventData {
  groupId: string;
  scheduleSlotId: string;
  action: 'created' | 'updated' | 'deleted';
  slot?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    currentLoad: number;
  };
}

export interface ScheduleSlotCapacityEventData {
  groupId: string;
  scheduleSlotId: string;
  status: 'full' | 'warning';
  currentLoad: number;
  capacity: number;
  message?: string;
}

export interface ChildEventData {
  familyId: string;
  childId: string;
  action: 'added' | 'updated' | 'deleted';
  child?: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
}

export interface VehicleEventData {
  familyId: string;
  vehicleId: string;
  action: 'added' | 'updated' | 'deleted';
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    capacity: number;
  };
}

export interface FamilyMemberEventData {
  familyId: string;
  userId: string;
  action: 'joined' | 'left';
  userName?: string;
  role?: string;
}

export interface FamilyEventData {
  familyId: string;
  action: 'updated';
  family?: {
    id: string;
    name: string;
  };
}

export interface UserEventData {
  userId: string;
  groupId: string;
  action: 'joined' | 'left';
  userName?: string;
}

export interface TypingEventData {
  userId: string;
  scheduleSlotId: string;
  action: 'typing' | 'stopped_typing';
}

export interface NotificationEventData {
  type: 'SCHEDULE_PUBLISHED' | 'MEMBER_JOINED' | 'MEMBER_LEFT' | 'INFO' | 'WARNING' | 'SUCCESS';
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorEventData {
  type: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConflictEventData {
  scheduleSlotId: string;
  conflictType: 'DRIVER_DOUBLE_BOOKING' | 'VEHICLE_DOUBLE_BOOKING' | 'CAPACITY_EXCEEDED';
  affectedUsers: string[];
  message?: string;
}

export interface HeartbeatAckData {
  timestamp: number;
}

// All events now use modern colon-separated format only
// Legacy compatibility layer has been completely removed