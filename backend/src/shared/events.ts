/**
 * Shared WebSocket Event Registry
 *
 * This file re-exports event types from @shared-types/asyncapi for backward compatibility.
 * The source of truth is now in shared-types/asyncapi/, which is auto-generated
 * from the AsyncAPI specification.
 *
 * Source of truth: shared-types/asyncapi/ (generated from docs/asyncapi/asyncapi.yaml)
 */

// Re-export event constants and types from shared-types
export {
  SOCKET_EVENTS,
  type SocketEventName,
} from '@shared-types/asyncapi/events';

// Re-export all generated types for convenience
export type {
  ConnectedPayload,
  DisconnectedPayload,
  DisconnectReason,
  GroupEventDataCreated,
  GroupEventDataDeleted,
  GroupEventDataUpdated,
  GroupData,
  GroupFamilyEventDataAdded,
  GroupFamilyLeftEventData,
  GroupFamilyRemovedEventData,
  GroupFamilyRoleEventData,
  FamilyRole,
  GroupInvitationEventData,
  MemberJoinedEventData,
  MemberLeftEventData,
  GroupJoinRequestData,
  GroupLeaveRequestData,
  ScheduleEventData,
  ScheduleSlotEventDataCreated,
  ScheduleSlotEventDataUpdated,
  ScheduleSlotEventDataDeleted,
  ScheduleSlotData,
  ScheduleSlotCapacityFullEventData,
  ScheduleSlotCapacityWarningEventData,
  CapacityStatusFull,
  CapacityStatusWarning,
  ScheduleSubscribeRequestData,
  ScheduleUnsubscribeRequestData,
  ScheduleSlotJoinRequestData,
  ScheduleSlotLeaveRequestData,
  ChildEventDataAdded,
  ChildEventDataUpdated,
  ChildEventDataDeleted,
  ChildData,
  VehicleEventDataAdded,
  VehicleEventDataUpdated,
  VehicleEventDataDeleted,
  VehicleData,
  FamilyMemberJoinedEventData,
  FamilyMemberLeftEventData,
  FamilyEventData,
  FamilyUpdateAction,
  FamilyData,
  UserJoinedEventData,
  UserLeftEventData,
  TypingEventDataTyping,
  TypingEventDataStoppedTyping,
  TypingActionTyping,
  TypingActionStoppedTyping,
  NotificationEventData,
  NotificationType,
  ConflictEventData,
  ConflictType,
  ErrorEventData,
  HeartbeatPayload,
  HeartbeatAckTimestamp,
} from '@shared-types/asyncapi';
