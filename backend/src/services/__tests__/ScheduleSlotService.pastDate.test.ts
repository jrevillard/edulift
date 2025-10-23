import { describe, beforeEach, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { ScheduleSlotService } from '../ScheduleSlotService';
import { DateTime } from 'luxon';

// Mock current date for consistent testing
const mockToday = new Date('2025-11-15T10:00:00Z'); // Monday

// Mock DateTime.now() from luxon for timezone-aware validation
const originalLuxonNow = DateTime.now;
beforeAll(() => {
  DateTime.now = jest.fn(() => DateTime.fromJSDate(mockToday, { zone: 'utc' })) as any;
});

afterAll(() => {
  DateTime.now = originalLuxonNow;
});

// Mock ScheduleSlotRepository
const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  assignVehicleToSlot: jest.fn(),
  removeVehicleFromSlot: jest.fn(),
  findVehicleAssignmentById: jest.fn(),
} as any;

// Mock Prisma client for validation service
const mockPrisma = {
  groupScheduleConfig: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  group: { findUnique: jest.fn() },
} as any;

describe('ScheduleSlotService - Past Date Prevention', () => {
  let scheduleSlotService: ScheduleSlotService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Add default mock for user lookup
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@test.com',
      timezone: 'UTC',
    });

    // Add default mock for group lookup (used in validateSlotNotInPast fallback)
    mockPrisma.group.findUnique.mockResolvedValue({
      id: 'group-1',
      name: 'Test Group',
      timezone: 'UTC',
    });

    scheduleSlotService = new ScheduleSlotService(
      mockRepository,
      undefined,
      undefined,
      mockPrisma,
    );
  });

  describe('createScheduleSlotWithVehicle', () => {
    it('should prevent creating schedule slot for past day', async () => {
      // Setup: Try to create slot for yesterday using datetime format
      const slotData = {
        groupId: 'group-1',
        datetime: '2025-10-18T09:00:00.000Z', // Yesterday (Oct 18, 2025 - real past date)
      };

      // Act & Assert
      await expect(
        scheduleSlotService.createScheduleSlotWithVehicle(
          slotData,
          'vehicle-1',
          'user-1',
          'driver-1',
        ),
      ).rejects.toThrow('Cannot create trips in the past');
    });

    it('should allow creating schedule slot for today', async () => {
      // Setup: Create slot for today
      const slotData = {
        groupId: 'group-1',
        datetime: '2025-11-15T11:00:00.000Z', // Today (Jan 15, 2025) - 11 AM (after mocked current time 10 AM)
      };

      const mockCreatedSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-11-15T11:00:00.000Z'),
        createdAt: new Date(),
      };

      const mockSlotWithDetails = {
        ...mockCreatedSlot,
        vehicleAssignments: [{
          id: 'assignment-1',
          vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 8 },
          driver: { id: 'driver-1', name: 'Test Driver' },
          seatOverride: null,
        }],
        childAssignments: [],
      };

      mockRepository.create.mockResolvedValue(mockCreatedSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue(undefined);
      mockRepository.findById.mockResolvedValue(mockSlotWithDetails);

      // Act - should not throw
      const result = await scheduleSlotService.createScheduleSlotWithVehicle(
        slotData,
        'vehicle-1',
        'user-1',
        'driver-1',
      );

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1', 'driver-1', undefined);
    });

    it('should allow creating schedule slot for future day', async () => {
      // Setup: Create slot for future day
      const slotData = {
        groupId: 'group-1',
        datetime: '2025-11-19T09:00:00.000Z', // Future day (Jan 19, 2025)
      };

      const mockCreatedSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-11-19T09:00:00.000Z'),
        createdAt: new Date(),
      };

      const mockSlotWithDetails = {
        ...mockCreatedSlot,
        vehicleAssignments: [],
        childAssignments: [],
      };

      mockRepository.create.mockResolvedValue(mockCreatedSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue(undefined);
      mockRepository.findById.mockResolvedValue(mockSlotWithDetails);

      // Act - should not throw
      const result = await scheduleSlotService.createScheduleSlotWithVehicle(
        slotData,
        'vehicle-1',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
    });
  });

  describe('removeVehicleFromSlot', () => {
    it('should prevent removing vehicle from past schedule slot', async () => {
      // Setup: Mock existing slot from yesterday
      const pastSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-11-14T09:00:00.000Z'), // Yesterday (Jan 14, 2024)
      };

      mockRepository.findById.mockResolvedValue(pastSlot);

      // Act & Assert
      await expect(
        scheduleSlotService.removeVehicleFromSlot('slot-1', 'vehicle-1'),
      ).rejects.toThrow('Cannot modify trips in the past');
    });

    it('should allow removing vehicle from future schedule slot', async () => {
      // Setup: Mock existing slot for future day
      const futureSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-11-19T09:00:00.000Z'), // Future day (Jan 19, 2024)
      };
      
      const mockRemovalResult = {
        vehicleAssignment: {
          id: 'assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: null,
          seatOverride: null,
          createdAt: new Date(),
        },
        slotDeleted: false,
      };

      mockRepository.findById.mockResolvedValue(futureSlot);
      mockRepository.removeVehicleFromSlot.mockResolvedValue(mockRemovalResult);

      // Act - should not throw
      const result = await scheduleSlotService.removeVehicleFromSlot('slot-1', 'vehicle-1');

      expect(result).toBeDefined();
      expect(mockRepository.removeVehicleFromSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1');
    });
  });

  describe('Date validation helper', () => {
    it('should correctly identify past dates using timezone-aware function', async () => {
      const { isDateInPastWithTimezone } = await import('../../utils/dateValidation');
      const yesterday = new Date('2025-11-14T10:00:00Z');
      expect(isDateInPastWithTimezone(yesterday, 'UTC')).toBe(true);
    });

    it('should correctly identify today as not past using timezone-aware function', async () => {
      const { isDateInPastWithTimezone } = await import('../../utils/dateValidation');
      const today = new Date('2025-11-15T10:00:00Z');
      expect(isDateInPastWithTimezone(today, 'UTC')).toBe(false);
    });

    it('should correctly identify future dates as not past using timezone-aware function', async () => {
      const { isDateInPastWithTimezone } = await import('../../utils/dateValidation');
      const tomorrow = new Date('2025-11-16T10:00:00Z');
      expect(isDateInPastWithTimezone(tomorrow, 'UTC')).toBe(false);
    });
  });
});