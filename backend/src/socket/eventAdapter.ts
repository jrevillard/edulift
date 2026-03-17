/**
 * Event Type Adapter
 *
 * Converts internal event data to AsyncAPI-generated types before emission.
 * The AsyncAPI generator renames some properties (type → reservedType, etc.)
 * to avoid JavaScript keyword conflicts. This adapter bridges the gap.
 */

import type {
  ErrorEventData,
  ScheduleSlotCapacityFullEventData,
  ScheduleSlotCapacityWarningEventData,
  ScheduleSlotEventDataUpdated,
  GroupEventDataCreated,
  GroupEventDataDeleted,
  GroupEventDataUpdated,
  ChildEventDataAdded,
  ChildEventDataUpdated,
  ChildEventDataDeleted,
  VehicleEventDataAdded,
  VehicleEventDataUpdated,
  VehicleEventDataDeleted,
  FamilyMemberJoinedEventData,
  FamilyMemberLeftEventData,
  FamilyEventData,
  UserJoinedEventData,
  UserLeftEventData,
  TypingEventDataTyping,
  TypingEventDataStoppedTyping,
  ConnectedPayload,
  HeartbeatAckTimestamp,
} from '@shared-types/asyncapi';
import {
  GroupActionCreated,
  GroupActionDeleted,
  GroupActionUpdated,
  ChildActionAdded,
  ChildActionUpdated,
  ChildActionDeleted,
  VehicleActionAdded,
  VehicleActionUpdated,
  VehicleActionDeleted,
  MemberActionJoined,
  MemberActionLeft,
  FamilyUpdateAction,
  ScheduleSlotActionUpdated,
  TypingActionTyping,
  TypingActionStoppedTyping,
  CapacityStatusFull,
  CapacityStatusWarning,
  GroupFamilyActionAdded,
  GroupFamilyActionRemoved,
} from '@shared-types/asyncapi';

// Error Event Adapter
export const adaptErrorEvent = (error: { type: string; message: string }): ErrorEventData => ({
  reservedType: error.type,
  message: error.message,
});

// Schedule Slot Event Adapters
export const adaptScheduleSlotUpdatedEvent = (
  slot: Record<string, unknown>,
  updatedBy?: string,
): ScheduleSlotEventDataUpdated => ({
  scheduleSlotId: slot.id as string,
  groupId: slot.groupId as string,
  action: ScheduleSlotActionUpdated.UPDATED,
  slot: slot as any,
  ...(updatedBy && { updatedBy }),
});

export const adaptScheduleSlotCapacityFullEvent = (
  scheduleSlotId: string,
  groupId: string,
  message: string,
): ScheduleSlotCapacityFullEventData => ({
  scheduleSlotId,
  groupId,
  reservedStatus: CapacityStatusFull.FULL,
  message,
});

export const adaptScheduleSlotCapacityWarningEvent = (
  scheduleSlotId: string,
  groupId: string,
  availableSeats: number,
  message: string,
): ScheduleSlotCapacityWarningEventData => ({
  scheduleSlotId,
  groupId,
  reservedStatus: CapacityStatusWarning.WARNING,
  message,
  additionalProperties: new Map([['availableSeats', availableSeats]]),
});

// Group Event Adapters
export const adaptGroupCreatedEvent = (
  groupId: string,
  group?: Record<string, unknown>,
  createdBy?: string,
): GroupEventDataCreated => {
  const result: GroupEventDataCreated = {
    groupId,
    action: GroupActionCreated.CREATED,
    group: group as any,
  };
  if (createdBy !== undefined) {
    result.createdBy = createdBy;
  }
  return result;
};

export const adaptGroupDeletedEvent = (
  groupId: string,
  deletedBy?: string,
): GroupEventDataDeleted => {
  const result: GroupEventDataDeleted = {
    groupId,
    action: GroupActionDeleted.DELETED,
  };
  if (deletedBy !== undefined) {
    result.deletedBy = deletedBy;
  }
  return result;
};

export const adaptGroupUpdatedEvent = (
  groupId: string,
  updatedBy?: string,
  action?: GroupActionUpdated,
): GroupEventDataUpdated => {
  const result: GroupEventDataUpdated = {
    groupId,
    action: action || GroupActionUpdated.UPDATED,
  };
  if (updatedBy !== undefined) {
    result.updatedBy = updatedBy;
  }
  return result;
};

// Group Family Event Adapters
export const adaptGroupFamilyAddedEvent = (
  groupId: string,
  familyId: string,
  joinedBy?: string,
): any => ({
  groupId,
  familyId,
  action: GroupFamilyActionAdded.FAMILY_JOINED,
  ...(joinedBy && { joinedBy }),
});

export const adaptGroupFamilyRemovedEvent = (
  groupId: string,
  familyId: string,
  removedBy?: string,
  action?: GroupFamilyActionRemoved,
): any => ({
  groupId,
  familyId,
  action: action || GroupFamilyActionRemoved.REMOVED,
  removedBy,
});

export const adaptGroupFamilyLeftEvent = (
  groupId: string,
  familyId: string,
): any => ({
  groupId,
  familyId,
  action: GroupFamilyActionRemoved.REMOVED,
});

// Child Event Adapters
export const adaptChildAddedEvent = (
  childId: string,
  familyId: string,
  userId: string,
  child?: Record<string, unknown>,
): ChildEventDataAdded => ({
  childId,
  familyId,
  action: ChildActionAdded.ADDED,
  child: child as any,
  additionalProperties: new Map([['userId', userId]]),
});

export const adaptChildUpdatedEvent = (
  childId: string,
  familyId: string,
  userId: string,
  child?: Record<string, unknown>,
): ChildEventDataUpdated => ({
  childId,
  familyId,
  action: ChildActionUpdated.UPDATED,
  child: child as any,
  additionalProperties: new Map([['userId', userId]]),
});

export const adaptChildDeletedEvent = (
  childId: string,
  familyId: string,
  userId: string,
): ChildEventDataDeleted => ({
  childId,
  familyId,
  action: ChildActionDeleted.DELETED,
  additionalProperties: new Map([['userId', userId]]),
});

// Vehicle Event Adapters
export const adaptVehicleAddedEvent = (
  vehicleId: string,
  familyId: string,
  userId: string,
  vehicle?: Record<string, unknown>,
): VehicleEventDataAdded => ({
  vehicleId,
  familyId,
  action: VehicleActionAdded.ADDED,
  vehicle: vehicle as any,
  additionalProperties: new Map([['userId', userId]]),
});

export const adaptVehicleUpdatedEvent = (
  vehicleId: string,
  familyId: string,
  userId: string,
  vehicle?: Record<string, unknown>,
): VehicleEventDataUpdated => ({
  vehicleId,
  familyId,
  action: VehicleActionUpdated.UPDATED,
  vehicle: vehicle as any,
  additionalProperties: new Map([['userId', userId]]),
});

export const adaptVehicleDeletedEvent = (
  vehicleId: string,
  familyId: string,
  userId: string,
): VehicleEventDataDeleted => ({
  vehicleId,
  familyId,
  action: VehicleActionDeleted.DELETED,
  additionalProperties: new Map([['userId', userId]]),
});

// Family Event Adapters
export const adaptFamilyMemberJoinedEvent = (
  familyId: string,
  userId: string,
  memberRole?: string,
  action?: MemberActionJoined,
): FamilyMemberJoinedEventData => ({
  familyId,
  userId,
  action: action || MemberActionJoined.MEMBER_JOINED,
  ...(memberRole && { memberRole: memberRole as any }),
});

export const adaptFamilyMemberLeftEvent = (
  familyId: string,
  userId: string,
): FamilyMemberLeftEventData => ({
  familyId,
  userId,
  action: MemberActionLeft.MEMBER_LEFT,
});

export const adaptFamilyUpdatedEvent = (
  familyId: string,
  action: 'nameUpdated' | 'memberRoleUpdated' | 'memberRemoved',
): FamilyEventData => ({
  familyId,
  action: action as FamilyUpdateAction,
});

// User Presence Event Adapters
export const adaptUserJoinedEvent = (
  userId: string,
  groupId: string,
): UserJoinedEventData => ({
  userId,
  groupId,
  action: MemberActionJoined.MEMBER_JOINED,
});

export const adaptUserLeftEvent = (
  userId: string,
  groupId: string,
): UserLeftEventData => ({
  userId,
  groupId,
  action: MemberActionLeft.MEMBER_LEFT,
});

export const adaptUserTypingEvent = (
  userId: string,
  scheduleSlotId: string,
): TypingEventDataTyping => ({
  userId,
  scheduleSlotId,
  action: TypingActionTyping.TYPING,
});

export const adaptUserStoppedTypingEvent = (
  userId: string,
  scheduleSlotId: string,
): TypingEventDataStoppedTyping => ({
  userId,
  scheduleSlotId,
  action: TypingActionStoppedTyping.STOPPED_TYPING,
});

// Connection Event Adapters
export const adaptConnectedEvent = (
  userId: string,
  groups: string[],
): ConnectedPayload => ({
  userId,
  groups,
  timestamp: Date.now(),
});

export const adaptHeartbeatAckEvent = (): HeartbeatAckTimestamp => ({
  timestamp: Date.now(),
});
