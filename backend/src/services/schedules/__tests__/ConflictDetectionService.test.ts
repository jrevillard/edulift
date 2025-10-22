import { ConflictDetectionService } from '../ConflictDetectionService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  scheduleSlot: {
    findMany: jest.fn(),
  },
} as any;

describe('ConflictDetectionService', () => {
  let conflictService: ConflictDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    conflictService = new ConflictDetectionService(mockPrisma as PrismaClient);
  });

  describe('detectConflicts - Timezone Aware', () => {
    it('should detect conflicts in user timezone (Asia/Tokyo)', async () => {
      // Two schedules at 10:00-11:00 JST (01:00-02:00 UTC) and 10:00-11:00 JST (01:00-02:00 UTC)
      // These SHOULD conflict in JST
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST (same time)
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('VEHICLE_DOUBLE_BOOKING');
      expect(result.conflicts[0].message).toContain('Monday 10:00');
    });

    it('should not detect false conflicts due to UTC conversion', async () => {
      // Schedule A: 10:00-11:00 JST (01:00-02:00 UTC)
      // Schedule B: 11:00-12:00 JST (02:00-03:00 UTC)
      // These should NOT conflict in JST timezone
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T02:00:00.000Z'), // 11:00 JST
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST (different time)
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflicts spanning DST transition (spring forward)', async () => {
      // In Europe/Paris, DST starts on March 30, 2025 at 2:00 AM (clocks move to 3:00 AM)
      // Two slots both scheduled for "2:30 AM" on March 30 should conflict
      // even though one might be UTC+1 and the other UTC+2

      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-03-30T01:30:00.000Z'), // 2:30 CET (before DST)
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-03-30T01:30:00.000Z'), // Same UTC time
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Europe/Paris'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('VEHICLE_DOUBLE_BOOKING');
    });

    it('should handle overlaps at timezone boundaries', async () => {
      // Test case: Same UTC time but different local dates
      // 2025-10-20 23:00 UTC = 2025-10-21 08:00 JST
      // 2025-10-21 08:00 JST should conflict with another 2025-10-21 08:00 JST
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T23:00:00.000Z'), // 2025-10-21 08:00 JST
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T23:00:00.000Z'), // 2025-10-21 08:00 JST
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should not detect conflicts for different vehicles at same time', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
        vehicleId: 'vehicle-2',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1', // Different vehicle
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect driver conflicts in user timezone', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
        driverId: 'driver-1',
        vehicleId: 'vehicle-2',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driverId: 'driver-1', // Same driver
              driver: { id: 'driver-1', name: 'John Doe' },
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('DRIVER_DOUBLE_BOOKING');
    });

    it('should exclude specified slot from conflict check', async () => {
      // When updating a slot, we should exclude it from conflict detection
      const newSlot = {
        scheduleSlotId: 'slot-to-update',
        datetime: new Date('2025-10-20T01:00:00.000Z'),
        vehicleId: 'vehicle-1',
      };

      // findMany should be called with exclusion filter and return empty array
      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo',
        'slot-to-update' // Exclude this slot
      );

      expect(result.hasConflict).toBe(false);
      expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'slot-to-update' },
          }),
        })
      );
    });

    it('should format error messages with user timezone', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'), // 10:00 JST
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.conflicts[0].message).toContain('10:00'); // JST time
      expect(result.conflicts[0].message).not.toContain('01:00'); // UTC time
      expect(result.conflicts[0].datetimeInUserTimezone).toBe('Monday 10:00');
    });

    it('should handle multiple conflicts for same slot', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'),
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'),
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1', // Vehicle conflict
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driverId: 'driver-1', // Driver conflict
              driver: { id: 'driver-1', name: 'John Doe' },
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(2); // Both vehicle and driver conflicts
      expect(result.conflicts.map(c => c.type)).toContain('VEHICLE_DOUBLE_BOOKING');
      expect(result.conflicts.map(c => c.type)).toContain('DRIVER_DOUBLE_BOOKING');
    });
  });

  describe('validateNoConflicts', () => {
    it('should throw error when conflicts are detected', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'),
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-20T01:00:00.000Z'),
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      await expect(
        conflictService.validateNoConflicts('group-1', newSlot, 'Asia/Tokyo')
      ).rejects.toThrow(/Cannot assign to schedule slot due to conflicts/);
    });

    it('should not throw when no conflicts are detected', async () => {
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T01:00:00.000Z'),
        vehicleId: 'vehicle-1',
      };

      mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

      await expect(
        conflictService.validateNoConflicts('group-1', newSlot, 'Asia/Tokyo')
      ).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle DST fall back (repeated hour)', async () => {
      // In Europe/Paris, DST ends on October 26, 2025 at 3:00 AM (clocks move back to 2:00 AM)
      // The hour 2:00-3:00 occurs twice
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-26T01:00:00.000Z'), // First 2:00 AM (CEST, UTC+2)
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-26T01:00:00.000Z'), // Same UTC time
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Europe/Paris'
      );

      expect(result.hasConflict).toBe(true);
    });

    it('should handle timezone with no DST (Asia/Tokyo)', async () => {
      // Japan doesn't observe DST
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-03-30T01:00:00.000Z'), // 10:00 JST
        vehicleId: 'vehicle-1',
      };

      const existingSlots = [
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-03-30T01:00:00.000Z'),
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(existingSlots);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should handle different days in different timezones', async () => {
      // 2025-10-20 23:30 UTC = 2025-10-21 08:30 JST (next day)
      // 2025-10-21 00:30 UTC = 2025-10-21 09:30 JST (same day)
      const newSlot = {
        scheduleSlotId: 'new-slot-1',
        datetime: new Date('2025-10-20T23:30:00.000Z'), // 2025-10-21 08:30 JST
        vehicleId: 'vehicle-1',
      };

      mockPrisma.scheduleSlot.findMany.mockResolvedValue([
        {
          id: 'existing-slot-1',
          groupId: 'group-1',
          datetime: new Date('2025-10-21T00:30:00.000Z'), // 2025-10-21 09:30 JST (different hour)
          vehicleAssignments: [
            {
              id: 'va-1',
              vehicleId: 'vehicle-1',
              vehicle: { id: 'vehicle-1', name: 'Bus 1' },
              driver: null,
              driverId: null,
            },
          ],
        },
      ]);

      const result = await conflictService.detectConflicts(
        'group-1',
        newSlot,
        'Asia/Tokyo'
      );

      expect(result.hasConflict).toBe(false); // Different times in JST
    });
  });
});
