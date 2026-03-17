/**
 * Shared WebSocket Event Constants
 *
 * AUTO-GENERATED from docs/asyncapi/asyncapi.yaml
 * Regenerate with: npm run asyncapi:generate-types
 */

export const SOCKET_EVENTS = {
  CHILD_ADDED: 'child:added',
  CHILD_DELETED: 'child:deleted',
  CHILD_UPDATED: 'child:updated',
  CONFLICT_DETECTED: 'conflict:detected',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  FAMILY_MEMBER_JOINED: 'family:member:joined',
  FAMILY_MEMBER_LEFT: 'family:member:left',
  FAMILY_UPDATED: 'family:updated',
  GROUP_CREATED: 'group:created',
  GROUP_DELETED: 'group:deleted',
  GROUP_FAMILY_ADDED: 'group:family:added',
  GROUP_FAMILY_LEFT: 'group:family:left',
  GROUP_FAMILY_REMOVED: 'group:family:removed',
  GROUP_FAMILY_ROLE_UPDATED: 'group:family:role:updated',
  GROUP_INVITATION_SENT: 'group:invitation:sent',
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  GROUP_UPDATED: 'group:updated',
  HEARTBEAT_ACK: 'heartbeat-ack',
  HEARTBEAT: 'heartbeat',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  NOTIFICATION: 'notification',
  SCHEDULE_SLOT_CREATED: 'schedule:slot:created',
  SCHEDULE_SLOT_DELETED: 'schedule:slot:deleted',
  SCHEDULE_SLOT_UPDATED: 'schedule:slot:updated',
  SCHEDULE_SUBSCRIBE: 'schedule:subscribe',
  SCHEDULE_UNSUBSCRIBE: 'schedule:unsubscribe',
  SCHEDULE_UPDATED: 'schedule:updated',
  SCHEDULE_SLOT_CAPACITY_FULL: 'scheduleSlot:capacity:full',
  SCHEDULE_SLOT_CAPACITY_WARNING: 'scheduleSlot:capacity:warning',
  SCHEDULE_SLOT_JOIN: 'scheduleSlot:join',
  SCHEDULE_SLOT_LEAVE: 'scheduleSlot:leave',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  USER_STOPPED_TYPING: 'user:stopped_typing',
  USER_TYPING: 'user:typing',
  VEHICLE_ADDED: 'vehicle:added',
  VEHICLE_DELETED: 'vehicle:deleted',
  VEHICLE_UPDATED: 'vehicle:updated',
} as const;

// Type for event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
