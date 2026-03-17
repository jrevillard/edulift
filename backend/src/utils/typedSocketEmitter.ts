/**
 * Type-safe Socket.IO Emitter
 *
 * Provides type-safe emit functions that automatically adapt
 * internal event data to AsyncAPI-generated types.
 */

import type { Socket } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '@shared-types/asyncapi/events';
import * as EventAdapter from '../socket/eventAdapter';

/**
 * Type-safe emit wrapper for Socket instances
 */
export const typedSocketEmit = {
  error: (socket: Socket, type: string, message: string) => {
    socket.emit(SOCKET_EVENTS.ERROR, EventAdapter.adaptErrorEvent({ type, message }));
  },

  connected: (socket: Socket, userId: string, groups: string[]) => {
    socket.emit(SOCKET_EVENTS.CONNECTED, EventAdapter.adaptConnectedEvent(userId, groups));
  },

  heartbeatAck: (socket: Socket) => {
    socket.emit(SOCKET_EVENTS.HEARTBEAT_ACK, EventAdapter.adaptHeartbeatAckEvent());
  },

  userJoined: (socket: Socket, userId: string, groupId: string) => {
    socket.emit(SOCKET_EVENTS.USER_JOINED, EventAdapter.adaptUserJoinedEvent(userId, groupId));
  },

  userLeft: (socket: Socket, userId: string, groupId: string) => {
    socket.emit(SOCKET_EVENTS.USER_LEFT, EventAdapter.adaptUserLeftEvent(userId, groupId));
  },

  userTyping: (socket: Socket, userId: string, scheduleSlotId: string) => {
    socket.emit(SOCKET_EVENTS.USER_TYPING, EventAdapter.adaptUserTypingEvent(userId, scheduleSlotId));
  },

  userStoppedTyping: (socket: Socket, userId: string, scheduleSlotId: string) => {
    socket.emit(SOCKET_EVENTS.USER_STOPPED_TYPING, EventAdapter.adaptUserStoppedTypingEvent(userId, scheduleSlotId));
  },
};

/**
 * Type-safe broadcast wrapper for Socket.IO Server instances
 */
export const typedIoBroadcast = {
  toGroup: (
    io: SocketIOServer,
    groupId: string,
    event: typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS],
    data: unknown,
  ) => {
    io.to(groupId).emit(event, data);
  },

  toUser: (
    io: SocketIOServer,
    userId: string,
    event: typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS],
    data: unknown,
  ) => {
    io.to(userId).emit(event, data);
  },

  scheduleSlotUpdated: (
    io: SocketIOServer,
    groupId: string,
    slot: Record<string, unknown>,
    updatedBy?: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED,
      EventAdapter.adaptScheduleSlotUpdatedEvent(slot, updatedBy),
    );
  },

  scheduleSlotCreated: (
    io: SocketIOServer,
    groupId: string,
    scheduleSlotId: string,
    slot?: Record<string, unknown>,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.SCHEDULE_SLOT_CREATED,
      EventAdapter.adaptScheduleSlotUpdatedEvent(
        { id: scheduleSlotId, groupId, ...slot },
        undefined,
      ),
    );
  },

  scheduleSlotDeleted: (
    io: SocketIOServer,
    groupId: string,
    scheduleSlotId: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.SCHEDULE_SLOT_DELETED,
      { scheduleSlotId, groupId, action: 'deleted' as const },
    );
  },

  scheduleSlotCapacityFull: (
    io: SocketIOServer,
    groupId: string,
    scheduleSlotId: string,
    message: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_FULL,
      EventAdapter.adaptScheduleSlotCapacityFullEvent(scheduleSlotId, groupId, message),
    );
  },

  scheduleSlotCapacityWarning: (
    io: SocketIOServer,
    groupId: string,
    scheduleSlotId: string,
    availableSeats: number,
    message: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_WARNING,
      EventAdapter.adaptScheduleSlotCapacityWarningEvent(
        scheduleSlotId,
        groupId,
        availableSeats,
        message,
      ),
    );
  },

  groupCreated: (
    io: SocketIOServer,
    groupId: string,
    group?: Record<string, unknown>,
    createdBy?: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_CREATED,
      EventAdapter.adaptGroupCreatedEvent(groupId, group, createdBy),
    );
  },

  groupDeleted: (
    io: SocketIOServer,
    groupId: string,
    deletedBy?: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_DELETED,
      EventAdapter.adaptGroupDeletedEvent(groupId, deletedBy),
    );
  },

  groupUpdated: (
    io: SocketIOServer,
    groupId: string,
    updatedBy?: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_UPDATED,
      EventAdapter.adaptGroupUpdatedEvent(groupId, updatedBy),
    );
  },

  childAdded: (
    io: SocketIOServer,
    familyId: string,
    childId: string,
    userId: string,
    child?: Record<string, unknown>,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.CHILD_ADDED,
      EventAdapter.adaptChildAddedEvent(childId, familyId, userId, child),
    );
  },

  childUpdated: (
    io: SocketIOServer,
    familyId: string,
    childId: string,
    userId: string,
    child?: Record<string, unknown>,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.CHILD_UPDATED,
      EventAdapter.adaptChildUpdatedEvent(childId, familyId, userId, child),
    );
  },

  childDeleted: (
    io: SocketIOServer,
    familyId: string,
    childId: string,
    userId: string,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.CHILD_DELETED,
      EventAdapter.adaptChildDeletedEvent(childId, familyId, userId),
    );
  },

  vehicleAdded: (
    io: SocketIOServer,
    familyId: string,
    vehicleId: string,
    userId: string,
    vehicle?: Record<string, unknown>,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.VEHICLE_ADDED,
      EventAdapter.adaptVehicleAddedEvent(vehicleId, familyId, userId, vehicle),
    );
  },

  vehicleUpdated: (
    io: SocketIOServer,
    familyId: string,
    vehicleId: string,
    userId: string,
    vehicle?: Record<string, unknown>,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.VEHICLE_UPDATED,
      EventAdapter.adaptVehicleUpdatedEvent(vehicleId, familyId, userId, vehicle),
    );
  },

  vehicleDeleted: (
    io: SocketIOServer,
    familyId: string,
    vehicleId: string,
    userId: string,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.VEHICLE_DELETED,
      EventAdapter.adaptVehicleDeletedEvent(vehicleId, familyId, userId),
    );
  },

  familyMemberJoined: (
    io: SocketIOServer,
    familyId: string,
    userId: string,
    memberRole?: string,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.FAMILY_MEMBER_JOINED,
      EventAdapter.adaptFamilyMemberJoinedEvent(familyId, userId, memberRole),
    );
  },

  familyMemberLeft: (
    io: SocketIOServer,
    familyId: string,
    userId: string,
  ) => {
    io.to(`family-${familyId}`).emit(
      SOCKET_EVENTS.FAMILY_MEMBER_LEFT,
      EventAdapter.adaptFamilyMemberLeftEvent(familyId, userId),
    );
  },

  // Group Family Events
  groupFamilyAdded: (
    io: SocketIOServer,
    groupId: string,
    familyId: string,
    joinedBy?: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_FAMILY_ADDED,
      EventAdapter.adaptGroupFamilyAddedEvent(groupId, familyId, joinedBy),
    );
  },

  groupFamilyRemoved: (
    io: SocketIOServer,
    groupId: string,
    familyId: string,
    removedBy: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_FAMILY_REMOVED,
      EventAdapter.adaptGroupFamilyRemovedEvent(groupId, familyId, removedBy),
    );
  },

  groupFamilyLeft: (
    io: SocketIOServer,
    groupId: string,
    familyId: string,
  ) => {
    io.to(groupId).emit(
      SOCKET_EVENTS.GROUP_FAMILY_LEFT,
      EventAdapter.adaptGroupFamilyLeftEvent(groupId, familyId),
    );
  },
};
