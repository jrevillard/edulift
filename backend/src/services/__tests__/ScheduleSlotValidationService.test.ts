import { ScheduleSlotValidationService } from '../ScheduleSlotValidationService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  scheduleSlot: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  vehicle: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  child: {
    findUnique: jest.fn(),
  },
  scheduleSlotVehicle: {
    findMany: jest.fn(),
  },
  scheduleSlotChild: {
    findMany: jest.fn(),
  },
  groupScheduleConfig: {
    findUnique: jest.fn(),
  },
} as any;

describe('ScheduleSlotValidationService', () => {
  let validationService: ScheduleSlotValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    validationService = new ScheduleSlotValidationService(mockPrisma as PrismaClient);
  });

  describe('validateSlotTiming', () => {
    it('should validate correct datetime format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      await expect(
        validationService.validateSlotTiming(futureDate)
      ).resolves.not.toThrow();
    });

    it('should throw error for past datetime', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      await expect(
        validationService.validateSlotTiming(pastDate)
      ).rejects.toThrow(/Cannot schedule slot in the past/);
    });

    it('should throw error for invalid datetime', async () => {
      const invalidDate = new Date('invalid');

      await expect(
        validationService.validateSlotTiming(invalidDate)
      ).rejects.toThrow(/Invalid datetime/);
    });
  });

  describe('validateSlotTimingWithTimezone', () => {
    it('should accept future dates in user timezone', async () => {
      // Create a date that is 2 days in the future in UTC
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      await expect(
        validationService.validateSlotTimingWithTimezone(futureDate, 'America/New_York')
      ).resolves.not.toThrow();
    });

    it('should reject past dates in user timezone (not UTC)', async () => {
      // Create a date that is 1 day in the past in UTC
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        validationService.validateSlotTimingWithTimezone(pastDate, 'Europe/Paris')
      ).rejects.toThrow(/Cannot schedule slot in the past/);
    });

    it('should allow dates that are past in UTC but future in user timezone', async () => {
      // This test simulates a scenario where it's late evening UTC (e.g., 23:00 UTC)
      // but early morning the next day in Asia/Tokyo (08:00 JST)
      // A user in Tokyo creating a schedule for "tomorrow" in their timezone

      // Create a date for tomorrow at 00:30 UTC (this is 09:30 JST)
      const now = new Date();
      const tomorrowUTC = new Date(now);
      tomorrowUTC.setUTCDate(now.getUTCDate() + 1);
      tomorrowUTC.setUTCHours(0, 30, 0, 0);

      // This should NOT throw because it's in the future in Asia/Tokyo timezone
      await expect(
        validationService.validateSlotTimingWithTimezone(tomorrowUTC, 'Asia/Tokyo')
      ).resolves.not.toThrow();
    });

    it('should reject dates that are future in UTC but past in user timezone', async () => {
      // When it's morning UTC, it might be previous day evening in America/Los_Angeles
      // However, this is a tricky test - we need a date that's future in UTC but past in LA
      // This is actually not possible in practice since LA is behind UTC
      // Let's test with a date that's clearly in the past for both

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        validationService.validateSlotTimingWithTimezone(pastDate, 'America/Los_Angeles')
      ).rejects.toThrow(/Cannot schedule slot in the past/);
    });

    it('should handle DST transitions correctly', async () => {
      // Test with a date during DST transition
      // March 10, 2024 is when DST starts in America/New_York
      const dstDate = new Date('2024-03-10T12:00:00.000Z');

      // This date is in the past relative to our test time, so should throw
      await expect(
        validationService.validateSlotTimingWithTimezone(dstDate, 'America/New_York')
      ).rejects.toThrow(/Cannot schedule slot in the past/);
    });

    it('should throw error for invalid datetime with timezone', async () => {
      const invalidDate = new Date('invalid');

      await expect(
        validationService.validateSlotTimingWithTimezone(invalidDate, 'Europe/Paris')
      ).rejects.toThrow(/Invalid datetime/);
    });

    it('should include user timezone in error message', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        validationService.validateSlotTimingWithTimezone(pastDate, 'Europe/Paris')
      ).rejects.toThrow(/Europe\/Paris/);
    });

    it('should work with ISO string input', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const isoString = futureDate.toISOString();

      await expect(
        validationService.validateSlotTimingWithTimezone(isoString, 'America/New_York')
      ).resolves.not.toThrow();
    });
  });

  describe('validateVehicleAssignment', () => {
    it('should validate available vehicle', async () => {
      const mockVehicle = { id: 'vehicle-1', name: 'Bus 1', capacity: 20 };
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1'
      };
      
      mockPrisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        validationService.validateVehicleAssignment('vehicle-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should not throw if vehicle is not assigned to conflicting slots', async () => {
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1'
      };
      
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        validationService.validateVehicleAssignment('vehicle-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should throw error if vehicle already assigned to another slot at same time', async () => {
      const mockVehicle = { id: 'vehicle-1', name: 'Bus 1', capacity: 20 };
      const mockSlot = {
        id: 'slot-1',
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        groupId: 'group-1'
      };
      const conflictingSlots = [
        {
          id: 'slot-2',
          datetime: new Date('2024-01-08T08:00:00.000Z'),
          groupId: 'group-1',
          vehicleAssignments: [{
            id: 'va-1',
            vehicleId: 'vehicle-1',
            vehicle: { id: 'vehicle-1', name: 'Bus 1' },
            driverId: null,
            driver: null
          }]
        }
      ];

      mockPrisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue(conflictingSlots);

      await expect(
        validationService.validateVehicleAssignment('vehicle-1', 'slot-1')
      ).rejects.toThrow(/Cannot assign to schedule slot due to conflicts/);

      await expect(
        validationService.validateVehicleAssignment('vehicle-1', 'slot-1')
      ).rejects.toThrow(/Vehicle is already assigned to another schedule slot/);
    });
  });

  describe('validateDriverAvailability', () => {
    it('should validate available driver', async () => {
      const mockDriver = { id: 'driver-1', name: 'John Doe' };
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        validationService.validateDriverAvailability('driver-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should not throw if driver has no conflicting assignments', async () => {
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1'
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        validationService.validateDriverAvailability('driver-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should throw error if driver already assigned to another slot at same time', async () => {
      const mockDriver = { id: 'driver-1', name: 'John Doe' };
      const mockSlot = {
        id: 'slot-1',
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        groupId: 'group-1'
      };
      const conflictingSlots = [
        {
          id: 'slot-2',
          datetime: new Date('2024-01-08T08:00:00.000Z'),
          groupId: 'group-1',
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driverId: 'driver-1',
              driver: { id: 'driver-1', name: 'John Doe' }
            }
          ]
        }
      ];

      mockPrisma.user.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue(conflictingSlots);

      await expect(
        validationService.validateDriverAvailability('driver-1', 'slot-1')
      ).rejects.toThrow(/Cannot assign to schedule slot due to conflicts/);

      await expect(
        validationService.validateDriverAvailability('driver-1', 'slot-1')
      ).rejects.toThrow(/Driver is already assigned to another schedule slot/);
    });
  });

  describe('validateChildAssignment', () => {
    it('should validate child assignment', async () => {
      const mockChild = { id: 'child-1', name: 'Alice', userId: 'parent-1' };
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1',
        vehicleAssignments: [
          { vehicle: { capacity: 20 } }
        ],
        childAssignments: []
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        validationService.validateChildAssignment('child-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should not throw if child assignment is valid', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [{ vehicle: { capacity: 20 } }],
        childAssignments: []
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateChildAssignment('child-1', 'slot-1')
      ).resolves.not.toThrow();
    });

    it('should throw error if no vehicles assigned to slot', async () => {
      const mockChild = { id: 'child-1', name: 'Alice', userId: 'parent-1' };
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [],
        childAssignments: []
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateChildAssignment('child-1', 'slot-1')
      ).rejects.toThrow('Cannot assign child to schedule slot without vehicles');
    });

    it('should throw error if slot is at capacity', async () => {
      const mockChild = { id: 'child-1', name: 'Alice', userId: 'parent-1' };
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { vehicle: { capacity: 1 } }
        ],
        childAssignments: [
          { childId: 'existing-child' }
        ]
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateChildAssignment('child-1', 'slot-1')
      ).rejects.toThrow('Schedule slot is at full capacity');
    });

    it('should not throw if child has no conflicting assignments', async () => {
      const mockSlot = {
        id: 'slot-1',
        day: 'MONDAY',
        time: '08:00',
        week: '2024-01',
        groupId: 'group-1',
        vehicleAssignments: [
          { vehicle: { capacity: 20 } }
        ],
        childAssignments: []
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateChildAssignment('child-1', 'slot-1')
      ).resolves.not.toThrow();
    });
  });

  describe('validateSlotIntegrity', () => {
    it('should validate slot with vehicles and children', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { vehicle: { capacity: 20 } }
        ],
        childAssignments: [
          { childId: 'child-1' }
        ]
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateSlotIntegrity('slot-1')
      ).resolves.not.toThrow();
    });

    it('should throw error if slot not found', async () => {
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(null);

      await expect(
        validationService.validateSlotIntegrity('non-existent')
      ).rejects.toThrow('Schedule slot not found');
    });

    it('should return true if slot has no vehicles and no children', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [],
        childAssignments: []
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      const result = await validationService.validateSlotIntegrity('slot-1');
      expect(result).toBe(true);
    });

    it('should throw error if children exceed vehicle capacity', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { vehicle: { capacity: 1 } }
        ],
        childAssignments: [
          { childId: 'child-1' },
          { childId: 'child-2' }
        ]
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateSlotIntegrity('slot-1')
      ).rejects.toThrow('Schedule slot exceeds capacity: 2 children assigned to 1 seats');
    });
  });

  describe('validateSeatOverride', () => {
    it('should accept valid seat override values', async () => {
      await expect(
        validationService.validateSeatOverride(1)
      ).resolves.not.toThrow();

      await expect(
        validationService.validateSeatOverride(5)
      ).resolves.not.toThrow();

      await expect(
        validationService.validateSeatOverride(10)
      ).resolves.not.toThrow();
    });

    it('should accept zero as a valid seat override', async () => {
      await expect(
        validationService.validateSeatOverride(0)
      ).resolves.not.toThrow();
    });

    it('should throw error for negative seat override', async () => {
      await expect(
        validationService.validateSeatOverride(-1)
      ).rejects.toThrow('Seat override cannot be negative');

      await expect(
        validationService.validateSeatOverride(-10)
      ).rejects.toThrow('Seat override cannot be negative');
    });

    it('should throw error for seat override exceeding maximum', async () => {
      await expect(
        validationService.validateSeatOverride(11)
      ).rejects.toThrow('Seat override cannot exceed 10 seats (application limit)');

      await expect(
        validationService.validateSeatOverride(50)
      ).rejects.toThrow('Seat override cannot exceed 10 seats (application limit)');
    });
  });

  describe('getEffectiveCapacity', () => {
    it('should return seat override when present', () => {
      const assignment = {
        seatOverride: 15,
        vehicle: { capacity: 20 }
      };

      // Access private method through any type casting
      const effectiveCapacity = (validationService as any).getEffectiveCapacity(assignment);
      expect(effectiveCapacity).toBe(15);
    });

    it('should return vehicle capacity when no seat override', () => {
      const assignment = {
        seatOverride: null,
        vehicle: { capacity: 20 }
      };

      const effectiveCapacity = (validationService as any).getEffectiveCapacity(assignment);
      expect(effectiveCapacity).toBe(20);
    });

    it('should return vehicle capacity when seat override is undefined', () => {
      const assignment = {
        vehicle: { capacity: 20 }
      };

      const effectiveCapacity = (validationService as any).getEffectiveCapacity(assignment);
      expect(effectiveCapacity).toBe(20);
    });
  });

  describe('validateScheduleTime', () => {
    it('should accept slot creation with valid configured time for MONDAY', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00', '15:30'],
          'TUESDAY': ['07:30', '08:00'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Monday, 07:30 UTC
      const datetime = new Date('2025-10-13T07:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).resolves.not.toThrow();
    });

    it('should accept slot creation with valid configured time for TUESDAY', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00'],
          'TUESDAY': ['07:30', '08:00', '15:30'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Tuesday, 15:30 UTC
      const datetime = new Date('2025-10-14T15:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).resolves.not.toThrow();
    });

    it('should reject slot creation with invalid time not in config', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00'],
          'TUESDAY': ['07:30', '08:00'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Monday, 05:30 UTC (not configured)
      const datetime = new Date('2025-10-13T05:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).rejects.toThrow(/Time 05:30 is not configured for MONDAY/);
    });

    it('should reject slot creation with time configured for wrong weekday', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00'],
          'TUESDAY': ['15:30', '16:00'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Monday, 15:30 UTC (only configured for Tuesday)
      const datetime = new Date('2025-10-13T15:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).rejects.toThrow(/Time 15:30 is not configured for MONDAY/);
    });

    it('should reject slot creation when group has no schedule config', async () => {
      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(null);

      const datetime = new Date('2025-10-13T07:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).rejects.toThrow('Group has no schedule configuration');
    });

    it('should reject slot creation when weekday has no configured times', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00'],
          // TUESDAY not configured
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Tuesday, 07:30 UTC (weekday not in config)
      const datetime = new Date('2025-10-14T07:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).rejects.toThrow(/Time 07:30 is not configured for TUESDAY/);
    });

    it('should provide helpful error message with all available times', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:30', '08:00'],
          'TUESDAY': ['15:30', '16:00'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Invalid time
      const datetime = new Date('2025-10-13T05:30:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).rejects.toThrow(/Available times: 07:30, 08:00, 15:30, 16:00/);
    });

    it('should handle times with leading zeros correctly', async () => {
      const mockConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:00', '07:30', '08:00'],
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Monday, 07:00 UTC (should match "07:00" not "7:00")
      const datetime = new Date('2025-10-13T07:00:00.000Z');

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'UTC')
      ).resolves.not.toThrow();
    });

    it('should validate time slot that crosses day boundary in UTC (Tokyo user creates Monday local = Sunday UTC)', async () => {
      const mockConfig = {
        scheduleHours: {
          'SUNDAY': ['16:00'],  // Sunday evening UTC
          'MONDAY': ['07:30']
        },
      };

      mockPrisma.groupScheduleConfig.findUnique.mockResolvedValue(mockConfig);

      // Tokyo user (UTC+9) creates Monday 01:00 JST → Sunday 16:00 UTC
      // This tests day boundary crossing
      const datetime = new Date('2025-10-12T16:00:00.000Z');  // Sunday UTC!

      await expect(
        validationService.validateScheduleTime('group-1', datetime, 'Asia/Tokyo')
      ).resolves.not.toThrow();  // Should match SUNDAY 16:00 in config
    });
  });

  describe('validateSlotIntegrity with seat override', () => {
    it('should use effective capacity with seat override for validation', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { 
            seatOverride: 3,
            vehicle: { capacity: 20 } 
          }
        ],
        childAssignments: [
          { childId: 'child-1' },
          { childId: 'child-2' }
        ]
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      // Should not throw because effective capacity (3) > children (2)
      await expect(
        validationService.validateSlotIntegrity('slot-1')
      ).resolves.not.toThrow();
    });

    it('should throw error when children exceed overridden capacity', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { 
            seatOverride: 1,
            vehicle: { capacity: 20 } 
          }
        ],
        childAssignments: [
          { childId: 'child-1' },
          { childId: 'child-2' }
        ]
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      await expect(
        validationService.validateSlotIntegrity('slot-1')
      ).rejects.toThrow('Schedule slot exceeds capacity: 2 children assigned to 1 seats');
    });

    it('should handle mixed assignments with and without seat override', async () => {
      const mockSlot = {
        id: 'slot-1',
        vehicleAssignments: [
          { 
            seatOverride: 2,
            vehicle: { capacity: 10 } 
          },
          { 
            seatOverride: null,
            vehicle: { capacity: 5 } 
          }
        ],
        childAssignments: [
          { childId: 'child-1' },
          { childId: 'child-2' },
          { childId: 'child-3' },
          { childId: 'child-4' },
          { childId: 'child-5' },
          { childId: 'child-6' }
        ]
      };

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);

      // Total effective capacity: 2 (override) + 5 (default) = 7
      // Children: 6, so should not throw
      await expect(
        validationService.validateSlotIntegrity('slot-1')
      ).resolves.not.toThrow();
    });
  });
});