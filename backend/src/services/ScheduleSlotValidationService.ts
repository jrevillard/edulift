import { PrismaClient } from '@prisma/client';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';
import { getWeekdayInTimezone, getTimeInTimezone } from '../utils/timezoneUtils';
import { ConflictDetectionService } from './schedules/ConflictDetectionService';

export class ScheduleSlotValidationService {
  private conflictService: ConflictDetectionService;

  constructor(private prisma: PrismaClient) {
    this.conflictService = new ConflictDetectionService(prisma);
  }

  /**
   * Get effective capacity for a vehicle assignment (with seat override)
   */
  private getEffectiveCapacity(assignment: any): number {
    return assignment.seatOverride ?? assignment.vehicle.capacity;
  }

  /**
   * Validates seat override value
   * Uses shared vehicle capacity constraints for consistency
   */
  async validateSeatOverride(seatOverride: number): Promise<void> {
    if (seatOverride < 0) {
      throw new Error('Seat override cannot be negative');
    }
    
    // Use shared vehicle constraints to ensure consistency across the application
    if (seatOverride > VEHICLE_CONSTRAINTS.MAX_CAPACITY) {
      throw new Error(`Seat override cannot exceed ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats (application limit)`);
    }
  }

  /**
   * Validates that a schedule slot can be created or modified according to business rules
   */
  async validateSlotIntegrity(scheduleSlotId: string): Promise<boolean> {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: true
          }
        },
        childAssignments: {
          include: {
            child: true
          }
        }
      }
    });

    if (!slot) {
      throw new Error('Schedule slot not found');
    }

    // Business Rule 1: If there are children assigned, there must be at least one vehicle
    if (slot.childAssignments.length > 0 && slot.vehicleAssignments.length === 0) {
      throw new Error('Schedule slot with children must have at least one vehicle assigned');
    }

    // Business Rule 2: Total capacity must not be exceeded (using seat override when available)
    if (slot.vehicleAssignments.length > 0) {
      const totalCapacity = slot.vehicleAssignments.reduce(
        (sum, assignment) => sum + this.getEffectiveCapacity(assignment), 
        0
      );
      
      if (slot.childAssignments.length > totalCapacity) {
        throw new Error(`Schedule slot exceeds capacity: ${slot.childAssignments.length} children assigned to ${totalCapacity} seats`);
      }
    }

    return true;
  }

  /**
   * Validates vehicle assignment conflicts (timezone-aware)
   * @param vehicleId - The vehicle to assign
   * @param scheduleSlotId - The schedule slot ID
   * @param userTimezone - User's IANA timezone (e.g., "Europe/Paris") - defaults to UTC if not provided
   */
  async validateVehicleAssignment(
    vehicleId: string,
    scheduleSlotId: string,
    userTimezone: string = 'UTC'
  ): Promise<void> {
    // Get the schedule slot info
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId }
    });

    if (!slot) {
      throw new Error('Schedule slot not found');
    }

    // Use timezone-aware conflict detection
    await this.conflictService.validateNoConflicts(
      slot.groupId,
      {
        scheduleSlotId,
        datetime: slot.datetime,
        vehicleId,
      },
      userTimezone,
      scheduleSlotId // Exclude the current slot from conflict check
    );
  }

  /**
   * Validates child assignment to schedule slot
   */
  async validateChildAssignment(childId: string, scheduleSlotId: string): Promise<void> {
    // Get schedule slot with current assignments and capacity
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: true
          }
        },
        childAssignments: true
      }
    });

    if (!slot) {
      throw new Error('Schedule slot not found');
    }

    // Check if slot has vehicles
    if (slot.vehicleAssignments.length === 0) {
      throw new Error('Cannot assign child to schedule slot without vehicles');
    }

    // Check capacity (using seat override when available)
    const totalCapacity = slot.vehicleAssignments.reduce(
      (sum, assignment) => sum + this.getEffectiveCapacity(assignment), 
      0
    );

    if (slot.childAssignments.length >= totalCapacity) {
      throw new Error('Schedule slot is at full capacity');
    }

    // Check if child is already assigned
    const existingAssignment = slot.childAssignments.find(
      assignment => assignment.childId === childId
    );

    if (existingAssignment) {
      throw new Error('Child is already assigned to this schedule slot');
    }
  }

  /**
   * Checks if a driver has conflicting assignments at the same time (timezone-aware)
   * @param driverId - The driver to assign
   * @param scheduleSlotId - The schedule slot ID
   * @param userTimezone - User's IANA timezone (e.g., "Europe/Paris") - defaults to UTC if not provided
   */
  async validateDriverAvailability(
    driverId: string,
    scheduleSlotId: string,
    userTimezone: string = 'UTC'
  ): Promise<void> {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId }
    });

    if (!slot) {
      throw new Error('Schedule slot not found');
    }

    // Use timezone-aware conflict detection
    await this.conflictService.validateNoConflicts(
      slot.groupId,
      {
        scheduleSlotId,
        datetime: slot.datetime,
        driverId,
      },
      userTimezone,
      scheduleSlotId // Exclude the current slot from conflict check
    );
  }

  /**
   * Gets schedule slot statistics for monitoring
   */
  async getSlotStats(scheduleSlotId: string) {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: true
          }
        },
        childAssignments: true
      }
    });

    if (!slot) {
      return null;
    }

    const totalCapacity = slot.vehicleAssignments.reduce(
      (sum, assignment) => sum + this.getEffectiveCapacity(assignment), 
      0
    );

    return {
      scheduleSlotId,
      datetime: slot.datetime,
      vehicleCount: slot.vehicleAssignments.length,
      childCount: slot.childAssignments.length,
      totalCapacity,
      availableSeats: Math.max(0, totalCapacity - slot.childAssignments.length),
      isAtCapacity: slot.childAssignments.length >= totalCapacity,
      isEmpty: slot.vehicleAssignments.length === 0 && slot.childAssignments.length === 0,
      hasVehiclesOnly: slot.vehicleAssignments.length > 0 && slot.childAssignments.length === 0,
      hasChildrenOnly: slot.vehicleAssignments.length === 0 && slot.childAssignments.length > 0
    };
  }

  /**
   * Validates that schedule slot datetime is valid (DEPRECATED - use validateSlotTimingWithTimezone)
   * @deprecated Use validateSlotTimingWithTimezone for timezone-aware validation
   */
  async validateSlotTiming(datetime: Date): Promise<void> {
    const now = new Date();

    if (datetime < now) {
      throw new Error(`Cannot schedule slot in the past: ${datetime.toISOString()}`);
    }

    if (isNaN(datetime.getTime())) {
      throw new Error(`Invalid datetime: ${datetime}`);
    }
  }

  /**
   * Validates that schedule slot datetime is valid (timezone-aware)
   * @param datetime - The datetime to validate (UTC Date or ISO string)
   * @param timezone - User's IANA timezone (e.g., "Europe/Paris")
   */
  async validateSlotTimingWithTimezone(datetime: Date | string, timezone: string): Promise<void> {
    // Import at function level to avoid circular dependencies
    const { isDateInPastWithTimezone } = await import('../utils/dateValidation');
    const { DateTime } = await import('luxon');

    // Validate datetime format
    const dateTime = typeof datetime === 'string'
      ? DateTime.fromISO(datetime, { zone: 'utc' })
      : DateTime.fromJSDate(datetime, { zone: 'utc' });

    if (!dateTime.isValid) {
      throw new Error(`Invalid datetime: ${datetime}`);
    }

    // Check if in past using user's timezone
    if (isDateInPastWithTimezone(datetime, timezone)) {
      const userLocalTime = dateTime.setZone(timezone).toFormat('yyyy-MM-dd HH:mm');
      throw new Error(`Cannot schedule slot in the past: ${userLocalTime} (${timezone})`);
    }
  }

  /**
   * Validates that a schedule slot time is configured in the group's schedule config
   * @param groupId - The group ID
   * @param datetime - The datetime to validate (UTC)
   * @param _timezone - User's IANA timezone (unused - kept for API compatibility)
   * @throws Error if time is not configured in group schedule
   *
   * IMPORTANT: scheduleHours are stored as UTC times (e.g., "07:00" means 07:00 UTC).
   * This validation compares the UTC datetime against UTC schedule hours.
   */
  async validateScheduleTime(groupId: string, datetime: Date, _timezone: string): Promise<void> {
    // Get the group's schedule configuration
    const scheduleConfig = await this.prisma.groupScheduleConfig.findUnique({
      where: { groupId }
    });

    // If no schedule config exists, reject the creation
    if (!scheduleConfig) {
      throw new Error(
        'Group has no schedule configuration. Please contact an administrator to configure schedule times.'
      );
    }

    // Extract weekday and time in UTC for comparison with scheduleHours
    // IMPORTANT: scheduleHours are stored as UTC times, so we must compare
    // the UTC datetime against UTC schedule hours (timezone-independent validation)
    const weekday = getWeekdayInTimezone(datetime, 'UTC');
    const timeSlot = getTimeInTimezone(datetime, 'UTC');

    // Get configured times for this weekday
    const scheduleHours = scheduleConfig.scheduleHours as Record<string, string[]>;
    const configuredTimes = scheduleHours[weekday] || [];

    // Check if the time is configured
    if (!configuredTimes.includes(timeSlot)) {
      // Build a helpful error message with available times
      const allConfiguredTimes = Object.values(scheduleHours).flat();
      const uniqueTimes = Array.from(new Set(allConfiguredTimes)).sort();

      throw new Error(
        `Time ${timeSlot} is not configured for ${weekday} in this group. ` +
        `Available times: ${uniqueTimes.join(', ')}`
      );
    }
  }

  /**
   * Checks for parent conflicts (same parent can't be in multiple places at same time)
   */
  async validateParentConflicts(parentId: string, scheduleSlotId: string): Promise<string[]> {
    const conflicts: string[] = [];
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id: scheduleSlotId }
    });
    
    if (!slot) {
      return conflicts;
    }

    // Check for conflicts where parent is driver, vehicle owner, or child parent
    const conflictingSlots = await this.findConflictingSlotsForParent(
      parentId,
      slot.groupId,
      slot.datetime
    );

    if (conflictingSlots.length > 1) {
      conflicts.push('PARENT_DOUBLE_BOOKING');
    }

    return conflicts;
  }

  private async findConflictingSlotsForParent(
    parentId: string,
    groupId: string,
    datetime: Date
  ) {
    return this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime,
        OR: [
          { 
            vehicleAssignments: {
              some: {
                driverId: parentId
              }
            }
          },
          { 
            vehicleAssignments: {
              some: {
                vehicle: { 
                  family: {
                    members: {
                      some: { userId: parentId }
                    }
                  }
                }
              }
            }
          },
          {
            childAssignments: {
              some: {
                child: { 
                  family: {
                    members: {
                      some: { userId: parentId }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    });
  }
}