import { PrismaClient, GroupScheduleConfig } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { GroupService } from './GroupService';
import { getWeekdayInTimezone, getTimeInTimezone } from '../utils/timezoneUtils';

// Type definitions for schedule configuration
// IMPORTANT: All times are stored as UTC times (e.g., "07:00" means 07:00 UTC)
export interface ScheduleHours {
  [key: string]: string[]; // { 'MONDAY': ['07:00', '07:30'], 'TUESDAY': ['08:00'] } - all times in UTC
}

export interface OperatingHours {
  start_hour: string; // HH:MM format in UTC (e.g., "08:00" means 08:00 UTC)
  end_hour: string;   // HH:MM format in UTC (e.g., "20:00" means 20:00 UTC)
}

export interface GroupScheduleConfigData {
  groupId: string;
  scheduleHours: ScheduleHours;
}

export interface UpdateScheduleConfigData {
  scheduleHours: ScheduleHours;
}

// Default schedule configuration template
const DEFAULT_SCHEDULE_HOURS: ScheduleHours = {
  MONDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
  TUESDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
  WEDNESDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
  THURSDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
  FRIDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
};

export class GroupScheduleConfigService {
  private activityLogRepo: ActivityLogRepository;
  private groupService: GroupService;

  constructor(private prisma: PrismaClient) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
    this.groupService = new GroupService(prisma);
  }

  /**
   * Validate time slot format (HH:MM)
   */
  private validateTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validate operating hours structure
   */
  private validateOperatingHoursFormat(operatingHours: OperatingHours): void {
    if (!operatingHours.start_hour || !operatingHours.end_hour) {
      throw new AppError('Operating hours must have start_hour and end_hour', 400);
    }

    if (!this.validateTimeFormat(operatingHours.start_hour)) {
      throw new AppError(`Invalid start_hour format: ${operatingHours.start_hour}. Expected HH:MM`, 400);
    }

    if (!this.validateTimeFormat(operatingHours.end_hour)) {
      throw new AppError(`Invalid end_hour format: ${operatingHours.end_hour}. Expected HH:MM`, 400);
    }

    // Compare hours - handle case where end_hour is before start_hour (spanning midnight)
    const startMinutes = this.timeToMinutes(operatingHours.start_hour);
    const endMinutes = this.timeToMinutes(operatingHours.end_hour);

    if (startMinutes >= endMinutes) {
      throw new AppError(
        `Operating hours start_hour (${operatingHours.start_hour}) must be before end_hour (${operatingHours.end_hour})`,
        400,
      );
    }
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if a time slot is within operating hours
   */
  private isWithinOperatingHours(time: string, operatingHours: OperatingHours): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(operatingHours.start_hour);
    const endMinutes = this.timeToMinutes(operatingHours.end_hour);

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Validate schedule hours structure
   * @param scheduleHours - Schedule hours to validate (stored as UTC times)
   * @param operatingHours - Optional operating hours constraint (also in UTC)
   * @param timezone - Timezone for displaying error messages (default: 'UTC')
   *
   * IMPORTANT: scheduleHours and operatingHours are both stored as UTC times.
   * For example, "07:00" means 07:00 UTC, not 07:00 in the user's local time.
   */
  private validateScheduleHours(
    scheduleHours: ScheduleHours,
    operatingHours?: OperatingHours | null,
    timezone: string = 'UTC',
  ): void {
    const validWeekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

    // Validate operating hours format if provided
    if (operatingHours) {
      this.validateOperatingHoursFormat(operatingHours);
    }

    for (const weekday in scheduleHours) {
      if (!validWeekdays.includes(weekday)) {
        throw new AppError(`Invalid weekday: ${weekday}`, 400);
      }

      const times = scheduleHours[weekday];
      if (!Array.isArray(times)) {
        throw new AppError(`Times for ${weekday} must be an array`, 400);
      }

      if (times.length > 20) {
        throw new AppError('Maximum 20 time slots allowed per weekday', 400);
      }

      // Check for duplicates
      const uniqueTimes = new Set(times);
      if (uniqueTimes.size !== times.length) {
        throw new AppError(`Duplicate time slots found for ${weekday}`, 400);
      }

      // Validate each time format and operating hours constraint
      for (const time of times) {
        if (!this.validateTimeFormat(time)) {
          throw new AppError(`Invalid time format: ${time}. Expected HH:MM`, 400);
        }

        // Check if time is within operating hours (both are UTC times)
        if (operatingHours && !this.isWithinOperatingHours(time, operatingHours)) {
          const tzAbbr = timezone === 'UTC' ? 'UTC' : timezone.split('/').pop() || timezone;
          throw new AppError(
            `Schedule time ${time} on ${weekday} is outside operating hours (${operatingHours.start_hour}-${operatingHours.end_hour} ${tzAbbr}). All times must be within the group's operating hours.`,
            400,
          );
        }
      }

      // Validate minimum intervals (15 minutes)
      const sortedTimes = times.sort();
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const currentTime = new Date(`2000-01-01T${sortedTimes[i]}:00`);
        const nextTime = new Date(`2000-01-01T${sortedTimes[i + 1]}:00`);
        const diffMinutes = (nextTime.getTime() - currentTime.getTime()) / (1000 * 60);

        if (diffMinutes < 15) {
          throw new AppError('Minimum 15-minute interval required between time slots', 400);
        }
      }
    }
  }

  /**
   * Get schedule configuration for a group
   */
  async getGroupScheduleConfig(groupId: string, userId: string): Promise<GroupScheduleConfig | null> {
    try {
      // Verify user has access to the group
      const userGroups = await this.groupService.getUserGroups(userId);
      const hasAccess = userGroups.some(group => group.id === groupId);
      
      if (!hasAccess) {
        throw new AppError('Access denied to group schedule configuration', 403);
      }

      const config = await this.prisma.groupScheduleConfig.findUnique({
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

      return config;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get group schedule config error:', error);
      throw new AppError('Failed to fetch group schedule configuration', 500);
    }
  }

  /**
   * Get time slots for a specific group and weekday
   */
  async getGroupTimeSlots(groupId: string, weekday: string, userId: string): Promise<string[]> {
    try {
      // Verify user has access to the group
      const userGroups = await this.groupService.getUserGroups(userId);
      const hasAccess = userGroups.some(group => group.id === groupId);
      
      if (!hasAccess) {
        throw new AppError('Access denied to group schedule configuration', 403);
      }

      const config = await this.prisma.groupScheduleConfig.findUnique({
        where: { groupId },
      });

      if (!config) {
        throw new AppError('Group schedule configuration not found. Please contact an administrator to configure schedule slots.', 404);
      }

      const scheduleHours = config.scheduleHours as ScheduleHours;
      return scheduleHours[weekday.toUpperCase()] || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get group time slots error:', error);
      throw new AppError('Failed to fetch group time slots', 500);
    }
  }

  /**
   * Create or update schedule configuration for a group
   */
  async updateGroupScheduleConfig(
    groupId: string,
    scheduleHours: ScheduleHours,
    userId: string,
    timezone: string = 'UTC',
  ): Promise<GroupScheduleConfig> {
    try {
      // Verify user has admin permissions for the group
      const hasAdminPermissions = await this.groupService.hasGroupAdminPermissions(userId, groupId);
      if (!hasAdminPermissions) {
        throw new AppError('Only group administrators can modify schedule configuration', 403);
      }

      // Fetch group to get timezone and operating hours
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          name: true,
          timezone: true,
          operatingHours: true,
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Use group's timezone for validation, fallback to provided timezone or UTC
      const groupTimezone = group.timezone || timezone;
      const operatingHours = group.operatingHours as OperatingHours | null;

      // Validate schedule hours structure with operating hours constraint
      this.validateScheduleHours(scheduleHours, operatingHours, groupTimezone);

      // Check for conflicts with existing schedule slots
      await this.validateNoConflictsWithExistingSlots(groupId, scheduleHours, groupTimezone);

      // Create or update configuration
      const config = await this.prisma.groupScheduleConfig.upsert({
        where: { groupId },
        update: {
          scheduleHours,
          updatedAt: new Date(),
        },
        create: {
          groupId,
          scheduleHours,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'GROUP_SCHEDULE_CONFIG_UPDATE',
        actionDescription: `Updated schedule configuration for group "${config.group.name}"`,
        entityType: 'group',
        entityId: groupId,
        entityName: config.group.name,
        metadata: {
          configId: config.id,
          scheduleHours,
        },
      });

      return config;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Update group schedule config error:', error);
      throw new AppError('Failed to update group schedule configuration', 500);
    }
  }

  /**
   * Reset schedule configuration to default values
   */
  async resetGroupScheduleConfig(groupId: string, userId: string): Promise<GroupScheduleConfig> {
    try {
      // Verify user has admin permissions for the group
      const hasAdminPermissions = await this.groupService.hasGroupAdminPermissions(userId, groupId);
      if (!hasAdminPermissions) {
        throw new AppError('Only group administrators can reset schedule configuration', 403);
      }

      // Reset to default configuration
      const config = await this.prisma.groupScheduleConfig.upsert({
        where: { groupId },
        update: {
          scheduleHours: DEFAULT_SCHEDULE_HOURS,
          updatedAt: new Date(),
        },
        create: {
          groupId,
          scheduleHours: DEFAULT_SCHEDULE_HOURS,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'GROUP_SCHEDULE_CONFIG_RESET',
        actionDescription: `Reset schedule configuration to default for group "${config.group.name}"`,
        entityType: 'group',
        entityId: groupId,
        entityName: config.group.name,
        metadata: {
          configId: config.id,
        },
      });

      return config;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Reset group schedule config error:', error);
      throw new AppError('Failed to reset group schedule configuration', 500);
    }
  }

  /**
   * Validate that proposed schedule changes don't conflict with existing schedule slots
   *
   * IMPORTANT: scheduleHours are stored as UTC times (e.g., "07:00" means 07:00 UTC).
   * This validation compares existing slot times in UTC against the proposed UTC schedule hours.
   */
  private async validateNoConflictsWithExistingSlots(
    groupId: string,
    proposedScheduleHours: ScheduleHours,
    _timezone: string = 'UTC',
  ): Promise<void> {
    const existingSlots = await this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: new Date(), // Only check future slots
        },
      },
      select: {
        id: true,
        datetime: true,
        _count: {
          select: {
            childAssignments: true,
          },
        },
      },
    });

    const conflicts: string[] = [];

    for (const slot of existingSlots) {
      const slotDate = new Date(slot.datetime);

      // Extract weekday and time in UTC (scheduleHours are stored as UTC times)
      const weekday = getWeekdayInTimezone(slotDate, 'UTC');
      const timeSlot = getTimeInTimezone(slotDate, 'UTC');

      // Check if this time slot would be removed in the new configuration
      const proposedTimes = proposedScheduleHours[weekday] || [];
      
      if (!proposedTimes.includes(timeSlot) && slot._count.childAssignments > 0) {
        conflicts.push(`${weekday} ${timeSlot} (${slot._count.childAssignments} children assigned)`);
      }
    }

    if (conflicts.length > 0) {
      throw new AppError(
        `Cannot remove time slots with existing bookings: ${conflicts.join(', ')}`, 
        400,
      );
    }
  }

  /**
   * Initialize default configurations for existing groups (required for all groups)
   */
  async initializeDefaultConfigs(): Promise<void> {
    try {
      // Get all groups without schedule configurations
      const groupsWithoutConfig = await this.prisma.group.findMany({
        where: {
          scheduleConfig: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      console.log(`Initializing required schedule configurations for ${groupsWithoutConfig.length} groups`);

      for (const group of groupsWithoutConfig) {
        await this.prisma.groupScheduleConfig.create({
          data: {
            groupId: group.id,
            scheduleHours: DEFAULT_SCHEDULE_HOURS,
          },
        });
        
        console.log(`✓ Initialized configuration for group: ${group.name}`);
      }

      console.log('Required schedule configurations initialized successfully');
    } catch (error) {
      console.error('Failed to initialize schedule configurations:', error);
      throw new AppError('Failed to initialize schedule configurations', 500);
    }
  }

  /**
   * Get default schedule hours template
   */
  static getDefaultScheduleHours(): ScheduleHours {
    return { ...DEFAULT_SCHEDULE_HOURS };
  }
}