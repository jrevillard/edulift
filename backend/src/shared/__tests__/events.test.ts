import { 
  SOCKET_EVENTS, 
  SocketEventName,
  GroupEventData,
  ScheduleEventData,
  UserEventData,
  NotificationEventData,
  ErrorEventData,
  ConflictEventData,
} from '../events';

describe('Event Registry', () => {
  describe('SOCKET_EVENTS Constants', () => {
    it('should have all required connection events', () => {
      expect(SOCKET_EVENTS.CONNECTED).toBe('connected');
      expect(SOCKET_EVENTS.DISCONNECTED).toBe('disconnected');
    });

    it('should have all required group management events', () => {
      expect(SOCKET_EVENTS.GROUP_JOIN).toBe('group:join');
      expect(SOCKET_EVENTS.GROUP_LEAVE).toBe('group:leave');
      expect(SOCKET_EVENTS.GROUP_UPDATED).toBe('group:updated');
      expect(SOCKET_EVENTS.MEMBER_JOINED).toBe('member:joined');
      expect(SOCKET_EVENTS.MEMBER_LEFT).toBe('member:left');
    });

    it('should have all required user presence events', () => {
      expect(SOCKET_EVENTS.USER_JOINED).toBe('user:joined');
      expect(SOCKET_EVENTS.USER_LEFT).toBe('user:left');
      expect(SOCKET_EVENTS.USER_TYPING).toBe('user:typing');
      expect(SOCKET_EVENTS.USER_STOPPED_TYPING).toBe('user:stopped_typing');
    });

    it('should have all required schedule events', () => {
      expect(SOCKET_EVENTS.SCHEDULE_UPDATED).toBe('schedule:updated');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED).toBe('schedule:slot:updated');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_CREATED).toBe('schedule:slot:created');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_DELETED).toBe('schedule:slot:deleted');
    });

    it('should have all schedule capacity events', () => {
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_FULL).toBe('scheduleSlot:capacity:full');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_WARNING).toBe('scheduleSlot:capacity:warning');
    });

    it('should have all schedule subscription events', () => {
      expect(SOCKET_EVENTS.SCHEDULE_SUBSCRIBE).toBe('schedule:subscribe');
      expect(SOCKET_EVENTS.SCHEDULE_UNSUBSCRIBE).toBe('schedule:unsubscribe');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_JOIN).toBe('scheduleSlot:join');
      expect(SOCKET_EVENTS.SCHEDULE_SLOT_LEAVE).toBe('scheduleSlot:leave');
    });

    it('should have all child management events', () => {
      expect(SOCKET_EVENTS.CHILD_ADDED).toBe('child:added');
      expect(SOCKET_EVENTS.CHILD_UPDATED).toBe('child:updated');
      expect(SOCKET_EVENTS.CHILD_DELETED).toBe('child:deleted');
    });

    it('should have all vehicle management events', () => {
      expect(SOCKET_EVENTS.VEHICLE_ADDED).toBe('vehicle:added');
      expect(SOCKET_EVENTS.VEHICLE_UPDATED).toBe('vehicle:updated');
      expect(SOCKET_EVENTS.VEHICLE_DELETED).toBe('vehicle:deleted');
    });

    it('should have all family events in modern format', () => {
      expect(SOCKET_EVENTS.FAMILY_MEMBER_JOINED).toBe('family:member:joined');
      expect(SOCKET_EVENTS.FAMILY_MEMBER_LEFT).toBe('family:member:left');
      expect(SOCKET_EVENTS.FAMILY_UPDATED).toBe('family:updated');
    });

    it('should have all notification and error events', () => {
      expect(SOCKET_EVENTS.NOTIFICATION).toBe('notification');
      expect(SOCKET_EVENTS.CONFLICT_DETECTED).toBe('conflict:detected');
      expect(SOCKET_EVENTS.ERROR).toBe('error');
    });

    it('should have all heartbeat events', () => {
      expect(SOCKET_EVENTS.HEARTBEAT).toBe('heartbeat');
      expect(SOCKET_EVENTS.HEARTBEAT_ACK).toBe('heartbeat-ack');
    });
  });

  describe('Event Name Consistency', () => {
    it('should not have duplicate event names', () => {
      const eventValues = Object.values(SOCKET_EVENTS);
      const uniqueValues = [...new Set(eventValues)];
      
      expect(eventValues).toHaveLength(uniqueValues.length);
    });

    it('should use consistent naming patterns for modern events', () => {
      // Modern events should use colon-separated naming
      const modernEvents = [
        SOCKET_EVENTS.GROUP_JOIN,
        SOCKET_EVENTS.GROUP_LEAVE,
        SOCKET_EVENTS.GROUP_UPDATED,
        SOCKET_EVENTS.MEMBER_JOINED,
        SOCKET_EVENTS.MEMBER_LEFT,
        SOCKET_EVENTS.SCHEDULE_UPDATED,
        SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED,
        SOCKET_EVENTS.SCHEDULE_SLOT_CREATED,
        SOCKET_EVENTS.SCHEDULE_SLOT_DELETED,
        SOCKET_EVENTS.CHILD_ADDED,
        SOCKET_EVENTS.CHILD_UPDATED,
        SOCKET_EVENTS.CHILD_DELETED,
        SOCKET_EVENTS.VEHICLE_ADDED,
        SOCKET_EVENTS.VEHICLE_UPDATED,
        SOCKET_EVENTS.VEHICLE_DELETED,
        SOCKET_EVENTS.USER_JOINED,
        SOCKET_EVENTS.USER_LEFT,
        SOCKET_EVENTS.USER_TYPING,
        SOCKET_EVENTS.USER_STOPPED_TYPING,
        SOCKET_EVENTS.CONFLICT_DETECTED,
        SOCKET_EVENTS.FAMILY_MEMBER_JOINED,
        SOCKET_EVENTS.FAMILY_MEMBER_LEFT,
        SOCKET_EVENTS.FAMILY_UPDATED,
      ];

      modernEvents.forEach(event => {
        expect(event).toMatch(/^[a-z]+:[a-z]+/);
      });
    });

    it('should use modern colon-separated format for all family events', () => {
      const familyEvents = [
        SOCKET_EVENTS.FAMILY_MEMBER_JOINED,
        SOCKET_EVENTS.FAMILY_MEMBER_LEFT,
        SOCKET_EVENTS.FAMILY_UPDATED,
      ];

      familyEvents.forEach(event => {
        // Modern events use colon-separated format
        expect(event).toMatch(/^[a-z]+:[a-z]+/);
        expect(event).toContain(':');
      });
    });
  });

  describe('Event Data Interfaces', () => {
    it('should validate GroupEventData interface', () => {
      const groupData: GroupEventData = {
        groupId: 'test-group-123',
        userId: 'test-user-456',
      };

      expect(groupData.groupId).toBe('test-group-123');
      expect(groupData.userId).toBe('test-user-456');

      // userId should be optional
      const groupDataWithoutUser: GroupEventData = {
        groupId: 'test-group-123',
      };
      expect(groupDataWithoutUser.groupId).toBe('test-group-123');
      expect(groupDataWithoutUser.userId).toBeUndefined();
    });

    it('should validate ScheduleEventData interface', () => {
      const scheduleData: ScheduleEventData = {
        groupId: 'test-group-123',
        scheduleSlotId: 'test-slot-456',
        week: '2024-03',
      };

      expect(scheduleData.groupId).toBe('test-group-123');
      expect(scheduleData.scheduleSlotId).toBe('test-slot-456');
      expect(scheduleData.week).toBe('2024-03');

      // Optional fields
      const minimalScheduleData: ScheduleEventData = {
        groupId: 'test-group-123',
      };
      expect(minimalScheduleData.groupId).toBe('test-group-123');
    });

    it('should validate UserEventData interface', () => {
      const userData: UserEventData = {
        userId: 'test-user-123',
        groupId: 'test-group-456',
      };

      expect(userData.userId).toBe('test-user-123');
      expect(userData.groupId).toBe('test-group-456');
    });

    it('should validate NotificationEventData interface', () => {
      const notificationData: NotificationEventData = {
        type: 'SCHEDULE_PUBLISHED',
        message: 'Schedule has been published',
        data: { scheduleId: 'schedule-123' },
      };

      expect(notificationData.type).toBe('SCHEDULE_PUBLISHED');
      expect(notificationData.message).toBe('Schedule has been published');
      expect(notificationData.data?.scheduleId).toBe('schedule-123');

      // Test all valid notification types
      const validTypes: NotificationEventData['type'][] = [
        'SCHEDULE_PUBLISHED',
        'MEMBER_JOINED',
        'MEMBER_LEFT',
      ];

      validTypes.forEach(type => {
        const data: NotificationEventData = {
          type,
          message: `Test message for ${type}`,
        };
        expect(data.type).toBe(type);
      });
    });

    it('should validate ErrorEventData interface', () => {
      const errorData: ErrorEventData = {
        type: 'VALIDATION_ERROR',
        message: 'Invalid input provided',
      };

      expect(errorData.type).toBe('VALIDATION_ERROR');
      expect(errorData.message).toBe('Invalid input provided');
    });

    it('should validate ConflictEventData interface', () => {
      const conflictData: ConflictEventData = {
        scheduleSlotId: 'slot-123',
        conflictType: 'DRIVER_DOUBLE_BOOKING',
        affectedUsers: ['user-123', 'user-456'],
        message: 'Driver is already assigned to another slot',
      };

      expect(conflictData.scheduleSlotId).toBe('slot-123');
      expect(conflictData.conflictType).toBe('DRIVER_DOUBLE_BOOKING');
      expect(conflictData.affectedUsers).toEqual(['user-123', 'user-456']);
      expect(conflictData.message).toBe('Driver is already assigned to another slot');

      // Test all valid conflict types
      const validConflictTypes: ConflictEventData['conflictType'][] = [
        'DRIVER_DOUBLE_BOOKING',
        'VEHICLE_DOUBLE_BOOKING',
        'CAPACITY_EXCEEDED',
      ];

      validConflictTypes.forEach(conflictType => {
        const data: ConflictEventData = {
          scheduleSlotId: 'slot-123',
          conflictType,
          affectedUsers: ['user-123'],
        };
        expect(data.conflictType).toBe(conflictType);
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce SocketEventName type', () => {
      // This is a compile-time test - if it compiles, the type is working
      const validEventName: SocketEventName = SOCKET_EVENTS.GROUP_UPDATED;
      expect(typeof validEventName).toBe('string');
    });

    it('should ensure all SOCKET_EVENTS values are valid SocketEventName types', () => {
      // Test that all values in SOCKET_EVENTS can be assigned to SocketEventName
      Object.values(SOCKET_EVENTS).forEach(eventName => {
        const typedEventName: SocketEventName = eventName;
        expect(typeof typedEventName).toBe('string');
      });
    });
  });

  describe('Event Categories', () => {
    it('should categorize connection events correctly', () => {
      const connectionEvents = [
        SOCKET_EVENTS.CONNECTED,
        SOCKET_EVENTS.DISCONNECTED,
      ];

      connectionEvents.forEach(event => {
        expect(typeof event).toBe('string');
        expect(event.length).toBeGreaterThan(0);
      });
    });

    it('should categorize real-time collaboration events correctly', () => {
      const collaborationEvents = [
        SOCKET_EVENTS.USER_TYPING,
        SOCKET_EVENTS.USER_STOPPED_TYPING,
        SOCKET_EVENTS.HEARTBEAT,
        SOCKET_EVENTS.HEARTBEAT_ACK,
      ];

      collaborationEvents.forEach(event => {
        expect(typeof event).toBe('string');
        expect(event.length).toBeGreaterThan(0);
      });
    });

    it('should categorize management events correctly', () => {
      const managementEvents = [
        SOCKET_EVENTS.CHILD_ADDED,
        SOCKET_EVENTS.CHILD_UPDATED,
        SOCKET_EVENTS.CHILD_DELETED,
        SOCKET_EVENTS.VEHICLE_ADDED,
        SOCKET_EVENTS.VEHICLE_UPDATED,
        SOCKET_EVENTS.VEHICLE_DELETED,
        SOCKET_EVENTS.GROUP_UPDATED,
        SOCKET_EVENTS.FAMILY_UPDATED,
      ];

      managementEvents.forEach(event => {
        expect(typeof event).toBe('string');
        expect(event.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Event Name Validation', () => {
    it('should not contain special characters except colons, underscores and hyphens', () => {
      Object.values(SOCKET_EVENTS).forEach(eventName => {
        // Allow letters, numbers, colons, underscores, and hyphens
        expect(eventName).toMatch(/^[a-zA-Z0-9:_-]+$/);
      });
    });

    it('should not be empty or whitespace', () => {
      Object.values(SOCKET_EVENTS).forEach(eventName => {
        expect(eventName.trim()).toBe(eventName);
        expect(eventName.length).toBeGreaterThan(0);
      });
    });

    it('should not start or end with special characters', () => {
      Object.values(SOCKET_EVENTS).forEach(eventName => {
        expect(eventName).toMatch(/^[a-zA-Z]/);
        expect(eventName).toMatch(/[a-zA-Z0-9]$/);
      });
    });
  });

  describe('Modern Event Format Compliance', () => {
    it('should use only modern colon-separated format for all events', () => {
      // All events should be in modern format - no legacy compatibility
      const allEvents = Object.values(SOCKET_EVENTS);
      const modernFormatEvents = allEvents.filter(event => 
        event.includes(':') || 
        event === 'connected' || 
        event === 'disconnected' || 
        event === 'notification' || 
        event === 'error' || 
        event === 'heartbeat' || 
        event === 'heartbeat-ack',
      );
      
      // All events should be in modern format or acceptable single-word format
      expect(modernFormatEvents).toHaveLength(allEvents.length);
    });

    it('should have no legacy camelCase event names remaining', () => {
      // Verify no legacy camelCase events like 'familyMemberJoined' exist
      const allEvents = Object.values(SOCKET_EVENTS);
      const legacyCamelCaseEvents = allEvents.filter(event => 
        /^[a-z][a-zA-Z]*$/.test(event) && !event.includes(':') && 
        event !== 'connected' && event !== 'disconnected' && 
        event !== 'notification' && event !== 'error' && 
        event !== 'heartbeat',
      );
      
      expect(legacyCamelCaseEvents).toHaveLength(0);
    });
  });
});