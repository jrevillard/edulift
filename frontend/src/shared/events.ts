/**
 * Frontend WebSocket Event Registry
 *
 * This file re-exports shared event constants and provides frontend-specific types.
 * The shared constants ensure event name consistency between frontend and backend.
 *
 * To update events after backend changes:
 * 1. In backend: npm run asyncapi:build
 * 2. In backend: npm run sync:types
 * 3. Shared events will be automatically synced
 */

// Re-export shared event constants
export { SOCKET_EVENTS, type SocketEventName } from '@shared-types/asyncapi/events';

// Frontend-specific event data types
// These are simplified versions that work with the frontend's strict TypeScript config

export interface GroupEventData {
  groupId: string;
  action: string;
  group?: Record<string, unknown>;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  familyId?: string; // For family join/remove events
}

export interface ScheduleEventData {
  groupId: string;
  scheduleSlotId?: string;
  week?: string;
}

export interface UserEventData {
  userId: string;
  groupId: string;
  action: string;
  familyId?: string;
}

export interface NotificationEventData {
  reservedType: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorEventData {
  reservedType: string;
  message: string;
}

export interface ConflictEventData {
  scheduleSlotId: string;
  conflictType: string;
  affectedUsers: string[];
  message?: string;
}

export interface ChildEventData {
  childId: string;
  familyId: string;
  userId: string;
  action: string;
  child?: Record<string, unknown>;
}

export interface VehicleEventData {
  vehicleId: string;
  familyId: string;
  userId: string;
  action: string;
  vehicle?: Record<string, unknown>;
}

export interface FamilyEventData {
  familyId: string;
  action: string;
  memberRole?: string;
  userId?: string;
}

export interface CapacityEventData {
  scheduleSlotId: string;
  groupId: string;
  reservedStatus: string;
  message: string;
  availableSeats?: number;
}

// Generic event payload type
export type EventPayload = any;
