import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { convertUtcToTimezone, formatDateTimeForUser } from '../../utils/timezoneUtils';

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  type: 'VEHICLE_DOUBLE_BOOKING' | 'DRIVER_DOUBLE_BOOKING' | 'TIME_OVERLAP';
  message: string;
  conflictingSlotId: string;
  datetime: Date;
  datetimeInUserTimezone?: string;
}

export interface TimeSlot {
  scheduleSlotId: string;
  datetime: Date;
  vehicleId?: string;
  driverId?: string;
}

export class ConflictDetectionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Detects conflicts between schedule slots using user timezone for accurate time comparisons
   * @param groupId - The group ID to check conflicts within
   * @param newSlot - The new slot to check for conflicts
   * @param userTimezone - User's IANA timezone (e.g., "Asia/Tokyo", "Europe/Paris")
   * @param excludeSlotId - Optional slot ID to exclude from conflict check (for updates)
   * @returns ConflictResult with details of any conflicts found
   */
  async detectConflicts(
    groupId: string,
    newSlot: TimeSlot,
    userTimezone: string,
    excludeSlotId?: string
  ): Promise<ConflictResult> {
    const conflicts: ConflictDetail[] = [];

    // Convert new slot time to user timezone for comparison
    const newSlotInUserTz = convertUtcToTimezone(newSlot.datetime, userTimezone);

    // Find all slots in the same group at the same time (in user timezone)
    // We need to be careful here - two slots might have the same UTC time but different
    // local times, or vice versa. We need to compare in user timezone.
    const whereClause: any = {
      groupId,
    };

    if (excludeSlotId) {
      whereClause.id = { not: excludeSlotId };
    }

    const existingSlots = await this.prisma.scheduleSlot.findMany({
      where: whereClause,
      include: {
        vehicleAssignments: {
          include: {
            vehicle: true,
            driver: true,
          },
        },
      },
    });

    for (const existingSlot of existingSlots) {
      const existingSlotInUserTz = convertUtcToTimezone(existingSlot.datetime, userTimezone);

      // Check if times overlap in user timezone
      if (this.checkTimeOverlap(newSlotInUserTz, existingSlotInUserTz)) {
        // Check for vehicle conflicts
        if (newSlot.vehicleId) {
          const vehicleConflict = existingSlot.vehicleAssignments.find(
            (va) => va.vehicleId === newSlot.vehicleId
          );

          if (vehicleConflict) {
            conflicts.push({
              type: 'VEHICLE_DOUBLE_BOOKING',
              message: `Vehicle is already assigned to another schedule slot at ${formatDateTimeForUser(
                existingSlot.datetime,
                userTimezone
              )}`,
              conflictingSlotId: existingSlot.id,
              datetime: existingSlot.datetime,
              datetimeInUserTimezone: formatDateTimeForUser(existingSlot.datetime, userTimezone),
            });
          }
        }

        // Check for driver conflicts
        if (newSlot.driverId) {
          const driverConflict = existingSlot.vehicleAssignments.find(
            (va) => va.driverId === newSlot.driverId
          );

          if (driverConflict) {
            conflicts.push({
              type: 'DRIVER_DOUBLE_BOOKING',
              message: `Driver is already assigned to another schedule slot at ${formatDateTimeForUser(
                existingSlot.datetime,
                userTimezone
              )}`,
              conflictingSlotId: existingSlot.id,
              datetime: existingSlot.datetime,
              datetimeInUserTimezone: formatDateTimeForUser(existingSlot.datetime, userTimezone),
            });
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Checks if two time slots overlap in the user's timezone
   * This is critical because two slots might not overlap in UTC but do overlap in local time,
   * or vice versa (especially around DST transitions)
   *
   * @param time1 - First time slot in user timezone
   * @param time2 - Second time slot in user timezone
   * @returns true if times overlap (same date and time in user timezone)
   */
  private checkTimeOverlap(
    time1: DateTime,
    time2: DateTime
  ): boolean {
    // For schedule slots, we consider them overlapping if they occur at the same
    // local time on the same local date (year, month, day, hour, minute)
    // This handles DST transitions correctly

    const time1Year = time1.year;
    const time1Month = time1.month;
    const time1Day = time1.day;
    const time1Hour = time1.hour;
    const time1Minute = time1.minute;

    const time2Year = time2.year;
    const time2Month = time2.month;
    const time2Day = time2.day;
    const time2Hour = time2.hour;
    const time2Minute = time2.minute;

    return (
      time1Year === time2Year &&
      time1Month === time2Month &&
      time1Day === time2Day &&
      time1Hour === time2Hour &&
      time1Minute === time2Minute
    );
  }

  /**
   * Validates that a slot can be created/modified without conflicts
   * Throws an error if conflicts are found
   *
   * @param groupId - The group ID
   * @param newSlot - The new slot to validate
   * @param userTimezone - User's IANA timezone
   * @param excludeSlotId - Optional slot ID to exclude from conflict check
   */
  async validateNoConflicts(
    groupId: string,
    newSlot: TimeSlot,
    userTimezone: string,
    excludeSlotId?: string
  ): Promise<void> {
    const result = await this.detectConflicts(groupId, newSlot, userTimezone, excludeSlotId);

    if (result.hasConflict) {
      const errorMessages = result.conflicts.map((c) => c.message);
      throw new Error(
        `Cannot assign to schedule slot due to conflicts:\n${errorMessages.join('\n')}`
      );
    }
  }
}
