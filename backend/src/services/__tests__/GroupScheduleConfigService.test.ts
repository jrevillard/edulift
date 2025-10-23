import { GroupScheduleConfigService, ScheduleHours } from '../GroupScheduleConfigService';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { ActivityLogRepository } from '../../repositories/ActivityLogRepository';
import { GroupService } from '../GroupService';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../repositories/ActivityLogRepository');
jest.mock('../GroupService');

const mockPrisma = {
  groupScheduleConfig: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  group: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  scheduleSlot: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

const mockActivityLogRepo = {
  createActivity: jest.fn(),
} as unknown as ActivityLogRepository;

const mockGroupService = {
  getUserGroups: jest.fn(),
  hasGroupAdminPermissions: jest.fn(),
} as unknown as GroupService;

describe('GroupScheduleConfigService', () => {
  let service: GroupScheduleConfigService;
  const userId = 'user1';
  const groupId = 'group1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GroupScheduleConfigService(mockPrisma);
    (service as any).activityLogRepo = mockActivityLogRepo;
    (service as any).groupService = mockGroupService;
  });

  describe('getGroupScheduleConfig', () => {
    it('should return configuration for authorized user', async () => {
      const mockConfig = {
        id: 'config1',
        groupId,
        scheduleHours: {
          MONDAY: ['07:00', '08:00'],
          TUESDAY: ['07:00', '08:00'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        group: { id: groupId, name: 'Test Group' },
      };

      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([
        { id: groupId, name: 'Test Group' },
      ]);
      (mockPrisma.groupScheduleConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getGroupScheduleConfig(groupId, userId);

      expect(result).toEqual(mockConfig);
      expect(mockGroupService.getUserGroups).toHaveBeenCalledWith(userId);
      expect(mockPrisma.groupScheduleConfig.findUnique).toHaveBeenCalledWith({
        where: { groupId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw error for unauthorized user', async () => {
      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([]);

      await expect(service.getGroupScheduleConfig(groupId, userId))
        .rejects.toThrow(new AppError('Access denied to group schedule configuration', 403));
    });

    it('should return null if no configuration exists', async () => {
      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([
        { id: groupId, name: 'Test Group' },
      ]);
      (mockPrisma.groupScheduleConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getGroupScheduleConfig(groupId, userId);

      expect(result).toBeNull();
    });
  });

  describe('getGroupTimeSlots', () => {
    it('should return time slots for specific weekday from configuration', async () => {
      const mockConfig = {
        scheduleHours: {
          MONDAY: ['07:00', '08:00', '15:00'],
          TUESDAY: ['07:00', '16:00'],
        },
      };

      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([
        { id: groupId, name: 'Test Group' },
      ]);
      (mockPrisma.groupScheduleConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getGroupTimeSlots(groupId, 'MONDAY', userId);

      expect(result).toEqual(['07:00', '08:00', '15:00']);
    });

    it('should throw error when no configuration exists', async () => {
      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([
        { id: groupId, name: 'Test Group' },
      ]);
      (mockPrisma.groupScheduleConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getGroupTimeSlots(groupId, 'MONDAY', userId))
        .rejects.toThrow('Group schedule configuration not found. Please contact an administrator to configure schedule slots.');
    });

    it('should return empty array for invalid weekday', async () => {
      const mockConfig = {
        scheduleHours: {
          MONDAY: ['07:00', '08:00'],
        },
      };

      (mockGroupService.getUserGroups as jest.Mock).mockResolvedValue([
        { id: groupId, name: 'Test Group' },
      ]);
      (mockPrisma.groupScheduleConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getGroupTimeSlots(groupId, 'INVALID_DAY', userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateGroupScheduleConfig', () => {
    const validScheduleHours: ScheduleHours = {
      MONDAY: ['07:00', '08:00', '15:00'],
      TUESDAY: ['07:00', '16:00'],
    };

    it('should update configuration for authorized admin', async () => {
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };
      const mockConfig = {
        id: 'config1',
        groupId,
        scheduleHours: validScheduleHours,
        createdAt: new Date(),
        updatedAt: new Date(),
        group: mockGroup,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
      (mockPrisma.scheduleSlot.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.groupScheduleConfig.upsert as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.updateGroupScheduleConfig(groupId, validScheduleHours, userId);

      expect(result).toEqual(mockConfig);
      expect(mockGroupService.hasGroupAdminPermissions).toHaveBeenCalledWith(userId, groupId);
      expect(mockActivityLogRepo.createActivity).toHaveBeenCalledWith({
        userId,
        actionType: 'GROUP_SCHEDULE_CONFIG_UPDATE',
        actionDescription: 'Updated schedule configuration for group "Test Group"',
        entityType: 'group',
        entityId: groupId,
        entityName: 'Test Group',
        metadata: {
          configId: 'config1',
          scheduleHours: validScheduleHours,
        },
      });
    });

    it('should throw error for non-admin user', async () => {
      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(false);

      await expect(service.updateGroupScheduleConfig(groupId, validScheduleHours, userId))
        .rejects.toThrow(new AppError('Only group administrators can modify schedule configuration', 403));
    });

    it('should throw error for invalid weekday', async () => {
      const invalidScheduleHours = {
        INVALID_DAY: ['07:00', '08:00'],
      };
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      await expect(service.updateGroupScheduleConfig(groupId, invalidScheduleHours, userId))
        .rejects.toThrow(new AppError('Invalid weekday: INVALID_DAY', 400));
    });

    it('should throw error for invalid time format', async () => {
      const invalidScheduleHours = {
        MONDAY: ['25:00', '08:00'], // Invalid hour
      };
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      await expect(service.updateGroupScheduleConfig(groupId, invalidScheduleHours, userId))
        .rejects.toThrow(new AppError('Invalid time format: 25:00. Expected HH:MM', 400));
    });

    it('should throw error for duplicate time slots', async () => {
      const invalidScheduleHours = {
        MONDAY: ['07:00', '08:00', '07:00'], // Duplicate
      };
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      await expect(service.updateGroupScheduleConfig(groupId, invalidScheduleHours, userId))
        .rejects.toThrow(new AppError('Duplicate time slots found for MONDAY', 400));
    });

    it('should throw error for too many time slots', async () => {
      const tooManySlots = Array.from({ length: 21 }, (_, i) =>
        `${String(i).padStart(2, '0')}:00`,
      );
      const invalidScheduleHours = {
        MONDAY: tooManySlots,
      };
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      await expect(service.updateGroupScheduleConfig(groupId, invalidScheduleHours, userId))
        .rejects.toThrow(new AppError('Maximum 20 time slots allowed per weekday', 400));
    });

    it('should throw error for intervals less than 15 minutes', async () => {
      const invalidScheduleHours = {
        MONDAY: ['07:00', '07:10'], // 10 minute interval
      };
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      await expect(service.updateGroupScheduleConfig(groupId, invalidScheduleHours, userId))
        .rejects.toThrow(new AppError('Minimum 15-minute interval required between time slots', 400));
    });

    it('should throw error when trying to remove time slots with existing bookings', async () => {
      const existingSlots = [
        {
          id: 'slot1',
          datetime: new Date('2024-01-01T07:00:00.000Z'),
          _count: { childAssignments: 2 },
        },
      ];
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        timezone: 'UTC',
        operatingHours: null,
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
      (mockPrisma.scheduleSlot.findMany as jest.Mock).mockResolvedValue(existingSlots);

      const scheduleHoursWithoutExistingSlot = {
        MONDAY: ['08:00', '15:00'], // Missing 07:00 which has bookings
      };

      await expect(service.updateGroupScheduleConfig(groupId, scheduleHoursWithoutExistingSlot, userId))
        .rejects.toThrow(new AppError('Cannot remove time slots with existing bookings: MONDAY 07:00 (2 children assigned)', 400));
    });
  });

  describe('resetGroupScheduleConfig', () => {
    it('should reset configuration to default for authorized admin', async () => {
      const mockConfig = {
        id: 'config1',
        groupId,
        scheduleHours: GroupScheduleConfigService.getDefaultScheduleHours(),
        createdAt: new Date(),
        updatedAt: new Date(),
        group: { id: groupId, name: 'Test Group' },
      };

      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
      (mockPrisma.groupScheduleConfig.upsert as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.resetGroupScheduleConfig(groupId, userId);

      expect(result).toEqual(mockConfig);
      expect(mockActivityLogRepo.createActivity).toHaveBeenCalledWith({
        userId,
        actionType: 'GROUP_SCHEDULE_CONFIG_RESET',
        actionDescription: 'Reset schedule configuration to default for group "Test Group"',
        entityType: 'group',
        entityId: groupId,
        entityName: 'Test Group',
        metadata: {
          configId: 'config1',
        },
      });
    });

    it('should throw error for non-admin user', async () => {
      (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(false);

      await expect(service.resetGroupScheduleConfig(groupId, userId))
        .rejects.toThrow(new AppError('Only group administrators can reset schedule configuration', 403));
    });
  });

  describe('initializeDefaultConfigs', () => {
    it('should initialize default configurations for groups without configs', async () => {
      const groupsWithoutConfig = [
        { id: 'group1', name: 'Group 1' },
        { id: 'group2', name: 'Group 2' },
      ];

      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue(groupsWithoutConfig);
      (mockPrisma.groupScheduleConfig.create as jest.Mock).mockResolvedValue({});

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.initializeDefaultConfigs();

      expect(mockPrisma.group.findMany).toHaveBeenCalledWith({
        where: { scheduleConfig: null },
        select: { id: true, name: true },
      });

      expect(mockPrisma.groupScheduleConfig.create).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('✓ Initialized configuration for group: Group 1');
      expect(consoleSpy).toHaveBeenCalledWith('✓ Initialized configuration for group: Group 2');

      consoleSpy.mockRestore();
    });
  });

  describe('getDefaultScheduleHours', () => {
    it('should return default schedule hours', () => {
      const defaultHours = GroupScheduleConfigService.getDefaultScheduleHours();

      expect(defaultHours).toEqual({
        MONDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
        TUESDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
        WEDNESDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
        THURSDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
        FRIDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
      });
    });
  });

  describe('validateTimeFormat', () => {
    it('should validate valid time formats', () => {
      const validTimes = ['00:00', '07:30', '12:00', '23:59'];

      validTimes.forEach(time => {
        expect((service as any).validateTimeFormat(time)).toBe(true);
      });
    });

    it('should reject invalid time formats', () => {
      const invalidTimes = ['24:00', '7:30', '12:60', 'abc', ''];

      invalidTimes.forEach(time => {
        expect((service as any).validateTimeFormat(time)).toBe(false);
      });
    });
  });

  describe('timezone and operating hours validation', () => {
    describe('validateScheduleHours with operating hours', () => {
      it('should validate schedule hours within operating hours in user timezone', () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['08:00', '09:00', '15:00'],
          TUESDAY: ['10:00', '16:00'],
        };
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };
        const timezone = 'Asia/Tokyo';

        // Should not throw
        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, operatingHours, timezone);
        }).not.toThrow();
      });

      it('should reject schedule outside operating hours in user timezone', () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['07:00', '09:00'], // 07:00 is before 08:00 operating hours start
        };
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };
        const timezone = 'Asia/Tokyo';

        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, operatingHours, timezone);
        }).toThrow(/Schedule time 07:00 on MONDAY is outside operating hours \(08:00-20:00/);
      });

      it('should reject schedule after operating hours end', () => {
        const scheduleHours: ScheduleHours = {
          FRIDAY: ['15:00', '20:30'], // 20:30 is after 20:00 operating hours end
        };
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };
        const timezone = 'Europe/Paris';

        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, operatingHours, timezone);
        }).toThrow(/Schedule time 20:30 on FRIDAY is outside operating hours \(08:00-20:00/);
      });

      it('should validate schedule at exact operating hours boundaries', () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['08:00', '20:00'], // Exact boundaries
        };
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };
        const timezone = 'America/New_York';

        // Should not throw
        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, operatingHours, timezone);
        }).not.toThrow();
      });

      it('should include timezone abbreviation in error message', () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['07:00'],
        };
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };
        const timezone = 'Asia/Tokyo';

        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, operatingHours, timezone);
        }).toThrow(/Tokyo/); // Should include timezone info
      });

      it('should work without operating hours (backward compatibility)', () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['07:00', '08:00', '15:00'],
        };

        // Should not throw when no operating hours provided
        expect(() => {
          (service as any).validateScheduleHours(scheduleHours, null, 'UTC');
        }).not.toThrow();
      });
    });

    describe('isWithinOperatingHours', () => {
      it('should return true for time within operating hours', () => {
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };

        expect((service as any).isWithinOperatingHours('08:00', operatingHours)).toBe(true);
        expect((service as any).isWithinOperatingHours('12:00', operatingHours)).toBe(true);
        expect((service as any).isWithinOperatingHours('20:00', operatingHours)).toBe(true);
      });

      it('should return false for time outside operating hours', () => {
        const operatingHours = { start_hour: '08:00', end_hour: '20:00' };

        expect((service as any).isWithinOperatingHours('07:59', operatingHours)).toBe(false);
        expect((service as any).isWithinOperatingHours('20:01', operatingHours)).toBe(false);
        expect((service as any).isWithinOperatingHours('00:00', operatingHours)).toBe(false);
        expect((service as any).isWithinOperatingHours('23:59', operatingHours)).toBe(false);
      });
    });

    describe('validateOperatingHoursFormat', () => {
      it('should validate correct operating hours format', () => {
        const validOperatingHours = { start_hour: '08:00', end_hour: '20:00' };

        expect(() => {
          (service as any).validateOperatingHoursFormat(validOperatingHours);
        }).not.toThrow();
      });

      it('should reject operating hours with invalid start_hour format', () => {
        const invalidOperatingHours = { start_hour: '25:00', end_hour: '20:00' };

        expect(() => {
          (service as any).validateOperatingHoursFormat(invalidOperatingHours);
        }).toThrow(/Invalid start_hour format: 25:00/);
      });

      it('should reject operating hours with invalid end_hour format', () => {
        const invalidOperatingHours = { start_hour: '08:00', end_hour: '8:00' };

        expect(() => {
          (service as any).validateOperatingHoursFormat(invalidOperatingHours);
        }).toThrow(/Invalid end_hour format: 8:00/);
      });

      it('should reject operating hours where start >= end', () => {
        const invalidOperatingHours = { start_hour: '20:00', end_hour: '08:00' };

        expect(() => {
          (service as any).validateOperatingHoursFormat(invalidOperatingHours);
        }).toThrow(/start_hour \(20:00\) must be before end_hour \(08:00\)/);
      });

      it('should reject operating hours where start equals end', () => {
        const invalidOperatingHours = { start_hour: '08:00', end_hour: '08:00' };

        expect(() => {
          (service as any).validateOperatingHoursFormat(invalidOperatingHours);
        }).toThrow(/start_hour \(08:00\) must be before end_hour \(08:00\)/);
      });
    });

    describe('updateGroupScheduleConfig with timezone and operating hours', () => {
      it('should fetch group and validate with group timezone and operating hours', async () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['09:00', '10:00'],
        };
        const mockGroup = {
          id: groupId,
          name: 'Tokyo Group',
          timezone: 'Asia/Tokyo',
          operatingHours: { start_hour: '08:00', end_hour: '20:00' },
        };
        const mockConfig = {
          id: 'config1',
          groupId,
          scheduleHours,
          createdAt: new Date(),
          updatedAt: new Date(),
          group: mockGroup,
        };

        (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
        (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
        (mockPrisma.scheduleSlot.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.groupScheduleConfig.upsert as jest.Mock).mockResolvedValue(mockConfig);

        const result = await service.updateGroupScheduleConfig(groupId, scheduleHours, userId);

        expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({
          where: { id: groupId },
          select: {
            id: true,
            name: true,
            timezone: true,
            operatingHours: true,
          },
        });
        expect(result).toEqual(mockConfig);
      });

      it('should reject schedule outside group operating hours', async () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['07:00', '09:00'], // 07:00 is before 08:00 start
        };
        const mockGroup = {
          id: groupId,
          name: 'Tokyo Group',
          timezone: 'Asia/Tokyo',
          operatingHours: { start_hour: '08:00', end_hour: '20:00' },
        };

        (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
        (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

        await expect(service.updateGroupScheduleConfig(groupId, scheduleHours, userId))
          .rejects.toThrow(/Schedule time 07:00 on MONDAY is outside operating hours/);
      });

      it('should handle group without operating hours', async () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['07:00', '09:00'],
        };
        const mockGroup = {
          id: groupId,
          name: 'No Restrictions Group',
          timezone: 'UTC',
          operatingHours: null, // No operating hours set
        };
        const mockConfig = {
          id: 'config1',
          groupId,
          scheduleHours,
          createdAt: new Date(),
          updatedAt: new Date(),
          group: mockGroup,
        };

        (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
        (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
        (mockPrisma.scheduleSlot.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.groupScheduleConfig.upsert as jest.Mock).mockResolvedValue(mockConfig);

        const result = await service.updateGroupScheduleConfig(groupId, scheduleHours, userId);

        // Should succeed without operating hours validation
        expect(result).toEqual(mockConfig);
      });

      it('should throw error if group not found', async () => {
        const scheduleHours: ScheduleHours = {
          MONDAY: ['09:00'],
        };

        (mockGroupService.hasGroupAdminPermissions as jest.Mock).mockResolvedValue(true);
        (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.updateGroupScheduleConfig(groupId, scheduleHours, userId))
          .rejects.toThrow(new AppError('Group not found', 404));
      });
    });

    describe('timeToMinutes', () => {
      it('should convert time strings to minutes correctly', () => {
        expect((service as any).timeToMinutes('00:00')).toBe(0);
        expect((service as any).timeToMinutes('08:00')).toBe(480);
        expect((service as any).timeToMinutes('12:30')).toBe(750);
        expect((service as any).timeToMinutes('23:59')).toBe(1439);
      });
    });
  });
});