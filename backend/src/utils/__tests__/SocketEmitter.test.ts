import { SocketEmitter, setGlobalSocketHandler, getGlobalSocketHandler } from '../socketEmitter';
import { SOCKET_EVENTS } from '../../shared/events';

describe('SocketEmitter', () => {
  let mockSocketHandler: jest.Mocked<any>;

  beforeEach(() => {
    // Create mock socket handler
    mockSocketHandler = {
      broadcastToGroup: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    // Reset global socket handler
    setGlobalSocketHandler(mockSocketHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear global socket handler
    setGlobalSocketHandler(null);
  });

  describe('Global Socket Handler Management', () => {
    it('should set and get global socket handler', () => {
      const testHandler = { test: 'handler' };
      setGlobalSocketHandler(testHandler);
      expect(getGlobalSocketHandler()).toBe(testHandler);
    });

    it('should handle null socket handler', () => {
      setGlobalSocketHandler(null);
      expect(getGlobalSocketHandler()).toBeNull();
    });
  });

  describe('Schedule Slot Events', () => {
    const groupId = 'test-group-123';
    const scheduleSlotId = 'test-slot-456';

    it('should broadcast schedule slot update', () => {
      const additionalData = { capacity: 5, driver: 'John Doe' };
      
      SocketEmitter.broadcastScheduleSlotUpdate(groupId, scheduleSlotId, additionalData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED,
        {
          scheduleSlotId,
          groupId,
          ...additionalData
        }
      );
    });

    it('should broadcast schedule slot created', () => {
      const slotData = { datetime: '2024-01-15T08:00:00Z', vehicleId: 'vehicle-123' };
      
      SocketEmitter.broadcastScheduleSlotCreated(groupId, scheduleSlotId, slotData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.SCHEDULE_SLOT_CREATED,
        {
          scheduleSlotId,
          groupId,
          ...slotData
        }
      );
    });

    it('should broadcast schedule slot deleted', () => {
      SocketEmitter.broadcastScheduleSlotDeleted(groupId, scheduleSlotId);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.SCHEDULE_SLOT_DELETED,
        {
          scheduleSlotId,
          groupId
        }
      );
    });

    it('should broadcast schedule update', () => {
      const scheduleData = { week: '2024-03', totalSlots: 10 };
      
      SocketEmitter.broadcastScheduleUpdate(groupId, scheduleData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.SCHEDULE_UPDATED,
        {
          groupId,
          ...scheduleData
        }
      );
    });

    it('should handle missing additional data for schedule events', () => {
      SocketEmitter.broadcastScheduleSlotUpdate(groupId, scheduleSlotId);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED,
        {
          scheduleSlotId,
          groupId
        }
      );
    });
  });

  describe('Group Events', () => {
    const groupId = 'test-group-789';

    it('should broadcast group update', () => {
      const groupData = { name: 'Updated Group Name', memberCount: 15 };
      
      SocketEmitter.broadcastGroupUpdate(groupId, groupData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_UPDATED,
        {
          groupId,
          ...groupData
        }
      );
    });

    it('should handle group update without additional data', () => {
      SocketEmitter.broadcastGroupUpdate(groupId);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_UPDATED,
        {
          groupId
        }
      );
    });
  });

  describe('Child Management Events', () => {
    const userId = 'user-123';
    const familyId = 'family-456';

    it('should broadcast child added event', () => {
      const childData = { childId: 'child-789', name: 'Alice Smith', age: 8 };
      
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'added', childData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.CHILD_ADDED,
        {
          userId,
          familyId,
          ...childData
        }
      );
    });

    it('should broadcast child updated event', () => {
      const childData = { childId: 'child-789', name: 'Alice Johnson', age: 9 };
      
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'updated', childData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.CHILD_UPDATED,
        {
          userId,
          familyId,
          ...childData
        }
      );
    });

    it('should broadcast child deleted event', () => {
      const childData = { childId: 'child-789' };
      
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'deleted', childData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.CHILD_DELETED,
        {
          userId,
          familyId,
          ...childData
        }
      );
    });

    it('should handle child events without additional data', () => {
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'added');

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.CHILD_ADDED,
        {
          userId,
          familyId
        }
      );
    });
  });

  describe('Vehicle Management Events', () => {
    const userId = 'user-456';
    const familyId = 'family-789';

    it('should broadcast vehicle added event', () => {
      const vehicleData = { vehicleId: 'vehicle-123', name: 'Honda Civic', capacity: 5 };
      
      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'added', vehicleData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.VEHICLE_ADDED,
        {
          userId,
          familyId,
          ...vehicleData
        }
      );
    });

    it('should broadcast vehicle updated event', () => {
      const vehicleData = { vehicleId: 'vehicle-123', name: 'Honda Civic 2024', capacity: 5 };
      
      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'updated', vehicleData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.VEHICLE_UPDATED,
        {
          userId,
          familyId,
          ...vehicleData
        }
      );
    });

    it('should broadcast vehicle deleted event', () => {
      const vehicleData = { vehicleId: 'vehicle-123' };
      
      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'deleted', vehicleData);

      expect(mockSocketHandler.broadcastToUser).toHaveBeenCalledWith(
        userId,
        SOCKET_EVENTS.VEHICLE_DELETED,
        {
          userId,
          familyId,
          ...vehicleData
        }
      );
    });
  });

  describe('Family Events', () => {
    const familyId = 'family-999';

    it('should broadcast family member joined event', () => {
      const memberData = { memberId: 'member-123', name: 'John Doe', role: 'parent' };
      
      SocketEmitter.broadcastFamilyUpdate(familyId, 'memberJoined', memberData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        familyId,
        SOCKET_EVENTS.FAMILY_MEMBER_JOINED,
        {
          familyId,
          ...memberData
        }
      );
    });

    it('should broadcast family member left event', () => {
      const memberData = { memberId: 'member-123', name: 'John Doe' };
      
      SocketEmitter.broadcastFamilyUpdate(familyId, 'memberLeft', memberData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        familyId,
        SOCKET_EVENTS.FAMILY_MEMBER_LEFT,
        {
          familyId,
          ...memberData
        }
      );
    });

    it('should broadcast family updated event', () => {
      const familyData = { name: 'The Smith Family', memberCount: 4 };
      
      SocketEmitter.broadcastFamilyUpdate(familyId, 'updated', familyData);

      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        familyId,
        SOCKET_EVENTS.FAMILY_UPDATED,
        {
          familyId,
          ...familyData
        }
      );
    });
  });

  describe('Error Handling - No Socket Handler', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      // Clear the global socket handler
      setGlobalSocketHandler(null);
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should warn and skip when socket handler not initialized', () => {
      SocketEmitter.broadcastScheduleSlotUpdate('group-123', 'slot-456');

      expect(consoleSpy).toHaveBeenCalledWith(
        'SocketHandler not initialized, skipping WebSocket emission'
      );
    });

    it('should not throw error when broadcasting without socket handler', () => {
      expect(() => {
        SocketEmitter.broadcastScheduleSlotUpdate('group-123', 'slot-456');
        SocketEmitter.broadcastChildUpdate('user-123', 'family-456', 'added');
        SocketEmitter.broadcastVehicleUpdate('user-123', 'family-456', 'updated');
        SocketEmitter.broadcastFamilyUpdate('family-456', 'memberJoined');
        SocketEmitter.broadcastGroupUpdate('group-123');
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('Event Data Structure Validation', () => {
    it('should include required fields in schedule slot update', () => {
      const groupId = 'group-123';
      const scheduleSlotId = 'slot-456';
      const extraData = { capacity: 8, driverId: 'driver-789' };

      SocketEmitter.broadcastScheduleSlotUpdate(groupId, scheduleSlotId, extraData);

      const [actualGroupId, actualEvent, actualData] = mockSocketHandler.broadcastToGroup.mock.calls[0];
      
      expect(actualGroupId).toBe(groupId);
      expect(actualEvent).toBe(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED);
      expect(actualData).toEqual({
        scheduleSlotId,
        groupId,
        capacity: 8,
        driverId: 'driver-789'
      });
    });

    it('should include required fields in child update', () => {
      const userId = 'user-123';
      const familyId = 'family-456';
      const extraData = { childId: 'child-789', name: 'Test Child' };

      SocketEmitter.broadcastChildUpdate(userId, familyId, 'added', extraData);

      const [actualUserId, actualEvent, actualData] = mockSocketHandler.broadcastToUser.mock.calls[0];
      
      expect(actualUserId).toBe(userId);
      expect(actualEvent).toBe(SOCKET_EVENTS.CHILD_ADDED);
      expect(actualData).toEqual({
        userId,
        familyId,
        childId: 'child-789',
        name: 'Test Child'
      });
    });

    it('should handle empty additional data objects', () => {
      SocketEmitter.broadcastScheduleSlotUpdate('group-123', 'slot-456', {});

      const [, , actualData] = mockSocketHandler.broadcastToGroup.mock.calls[0];
      expect(actualData).toEqual({
        scheduleSlotId: 'slot-456',
        groupId: 'group-123'
      });
    });
  });

  describe('Event Type Mapping', () => {
    it('should correctly map child event types', () => {
      const userId = 'user-123';
      const familyId = 'family-456';

      SocketEmitter.broadcastChildUpdate(userId, familyId, 'added');
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'updated');
      SocketEmitter.broadcastChildUpdate(userId, familyId, 'deleted');

      const calls = mockSocketHandler.broadcastToUser.mock.calls;
      expect(calls[0][1]).toBe(SOCKET_EVENTS.CHILD_ADDED);
      expect(calls[1][1]).toBe(SOCKET_EVENTS.CHILD_UPDATED);
      expect(calls[2][1]).toBe(SOCKET_EVENTS.CHILD_DELETED);
    });

    it('should correctly map vehicle event types', () => {
      const userId = 'user-123';
      const familyId = 'family-456';

      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'added');
      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'updated');
      SocketEmitter.broadcastVehicleUpdate(userId, familyId, 'deleted');

      const calls = mockSocketHandler.broadcastToUser.mock.calls;
      expect(calls[0][1]).toBe(SOCKET_EVENTS.VEHICLE_ADDED);
      expect(calls[1][1]).toBe(SOCKET_EVENTS.VEHICLE_UPDATED);
      expect(calls[2][1]).toBe(SOCKET_EVENTS.VEHICLE_DELETED);
    });

    it('should correctly map family event types', () => {
      const familyId = 'family-456';

      SocketEmitter.broadcastFamilyUpdate(familyId, 'memberJoined');
      SocketEmitter.broadcastFamilyUpdate(familyId, 'memberLeft');
      SocketEmitter.broadcastFamilyUpdate(familyId, 'updated');

      const calls = mockSocketHandler.broadcastToGroup.mock.calls;
      expect(calls[0][1]).toBe(SOCKET_EVENTS.FAMILY_MEMBER_JOINED);
      expect(calls[1][1]).toBe(SOCKET_EVENTS.FAMILY_MEMBER_LEFT);
      expect(calls[2][1]).toBe(SOCKET_EVENTS.FAMILY_UPDATED);
    });
  });
});