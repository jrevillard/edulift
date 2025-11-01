// @ts-nocheck
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { CreateScheduleSlotData, AssignVehicleToSlotData, ScheduleSlotWithDetails, UpdateSeatOverrideData } from '../types';
import { NotificationService } from './NotificationService';
import { ScheduleSlotValidationService } from './ScheduleSlotValidationService';
import { PrismaClient } from '@prisma/client';
import { getWeekBoundaries } from '../utils/isoWeekUtils';
import { createLogger } from '../utils/logger';

const logger = createLogger('ScheduleSlotService');

export class ScheduleSlotService {
  private prisma: PrismaClient;

  constructor(
    private scheduleSlotRepository: ScheduleSlotRepository,
    private notificationService?: NotificationService,
    private validationService?: ScheduleSlotValidationService,
    prisma?: PrismaClient,
  ) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Helper method to validate if a schedule slot can be modified (not in the past)
   * @param scheduleSlotId - The slot ID to validate
   * @param userId - The user ID (to get timezone)
   */
  async validateSlotNotInPast(scheduleSlotId: string, userId?: string): Promise<void> {
    const slot = await this.scheduleSlotRepository.findById(scheduleSlotId);
    if (!slot) {
      throw new Error('Schedule slot not found');
    }

    // Try to get timezone from user first
    let timezone: string | undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      timezone = user?.timezone;
    }

    // Fallback to group's timezone if user timezone not available
    if (!timezone) {
      const group = await this.prisma.group.findUnique({
        where: { id: slot.groupId },
        select: { timezone: true },
      });
      timezone = group?.timezone || 'UTC';
    }

    // Use timezone-aware validation
    const { isDateInPastWithTimezone } = await import('../utils/dateValidation');
    const { DateTime } = await import('luxon');

    if (isDateInPastWithTimezone(slot.datetime, timezone)) {
      const dateTime = DateTime.fromJSDate(slot.datetime, { zone: 'utc' });
      const localTime = dateTime.setZone(timezone).toFormat('yyyy-MM-dd HH:mm');
      throw new Error(`Cannot modify trips in the past (${localTime} in ${timezone})`);
    }
  }

  async createScheduleSlotWithVehicle(
    slotData: CreateScheduleSlotData,
    vehicleId: string,
    userId: string,
    driverId?: string,
    seatOverride?: number,
  ) {
    const datetime = new Date(slotData.datetime);

    // Get user's timezone from database (single source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const timezone = user.timezone;

    // Validate that we're not creating a trip in the past (timezone-aware)
    // Note: slotData.datetime should be a UTC ISO string from the frontend
    const { isDateInPastWithTimezone } = await import('../utils/dateValidation');
    const { DateTime } = await import('luxon');

    if (isDateInPastWithTimezone(datetime, timezone)) {
      const dateTime = DateTime.fromJSDate(datetime, { zone: 'utc' });
      const userLocalTime = dateTime.setZone(timezone).toFormat('yyyy-MM-dd HH:mm');
      throw new Error(`Cannot create trips in the past (${userLocalTime} in ${timezone})`);
    }

    // Validate that the time is configured in the group's schedule config
    // This ensures only valid time slots (e.g., 07:30 UTC, 08:00 UTC) can be created
    // Note: scheduleHours are stored as UTC times, so validation is timezone-independent
    if (this.validationService) {
      await this.validationService.validateScheduleTime(slotData.groupId, datetime, timezone);
    }

    // First create the schedule slot
    const scheduleSlot = await this.scheduleSlotRepository.create(slotData);

    // Then immediately assign the vehicle with optional seat override
    await this.scheduleSlotRepository.assignVehicleToSlot(scheduleSlot.id, vehicleId, driverId, seatOverride);

    // Return the complete schedule slot with vehicle assignment
    return await this.scheduleSlotRepository.findById(scheduleSlot.id);
  }

  async assignVehicleToSlot(data: AssignVehicleToSlotData) {
    const { scheduleSlotId, vehicleId, driverId, seatOverride } = data;

    // Validate that we're not modifying a trip in the past
    await this.validateSlotNotInPast(scheduleSlotId);

    // Validate assignment before proceeding
    if (this.validationService) {
      await this.validationService.validateVehicleAssignment(vehicleId, scheduleSlotId);
      if (driverId) {
        await this.validationService.validateDriverAvailability(driverId, scheduleSlotId);
      }
      if (seatOverride !== undefined) {
        await this.validationService.validateSeatOverride(seatOverride);
      }
    }
    
    const result = await this.scheduleSlotRepository.assignVehicleToSlot(scheduleSlotId, vehicleId, driverId, seatOverride);
    
    // Validate slot integrity after assignment
    if (this.validationService) {
      await this.validationService.validateSlotIntegrity(scheduleSlotId);
    }
    
    // Send notification for vehicle assignment
    if (this.notificationService) {
      this.notificationService.notifyScheduleSlotChange(scheduleSlotId, 'VEHICLE_ASSIGNED')
        .catch(error => logger.error('Failed to send vehicle assignment notification', { error: error instanceof Error ? error.message : String(error), scheduleSlotId }));
    }
    
    return result;
  }

  async removeVehicleFromSlot(scheduleSlotId: string, vehicleId: string) {
    // Validate that we're not modifying a trip in the past
    await this.validateSlotNotInPast(scheduleSlotId);

    // Send notification BEFORE removing vehicle (while slot still has the vehicle)
    if (this.notificationService) {
      this.notificationService.notifyScheduleSlotChange(scheduleSlotId, 'VEHICLE_REMOVED')
        .catch(error => logger.error('Failed to send vehicle removal notification', { error: error instanceof Error ? error.message : String(error), scheduleSlotId }));
    }
    
    const result = await this.scheduleSlotRepository.removeVehicleFromSlot(scheduleSlotId, vehicleId);
    
    // Only validate slot integrity if the slot still exists (wasn't deleted)
    if (this.validationService && !result.slotDeleted) {
      await this.validationService.validateSlotIntegrity(scheduleSlotId);
    }
    
    return result;
  }


  async removeChildFromSlot(scheduleSlotId: string, childId: string) {
    // Validate that we're not modifying a trip in the past
    await this.validateSlotNotInPast(scheduleSlotId);

    const result = await this.scheduleSlotRepository.removeChildFromSlot(scheduleSlotId, childId);
    
    // Send notification for child removal
    if (this.notificationService) {
      this.notificationService.notifyScheduleSlotChange(scheduleSlotId, 'CHILD_REMOVED')
        .catch(error => logger.error('Failed to send child removal notification', { error: error instanceof Error ? error.message : String(error), scheduleSlotId }));
    }
    
    return result;
  }

  async updateVehicleDriver(scheduleSlotId: string, vehicleId: string, driverId: string | null) {
    // Validate that we're not modifying a trip in the past
    await this.validateSlotNotInPast(scheduleSlotId);

    // Validate driver availability if assigning a driver
    if (driverId && this.validationService) {
      await this.validationService.validateDriverAvailability(driverId, scheduleSlotId);
    }
    
    const result = await this.scheduleSlotRepository.updateVehicleDriver(scheduleSlotId, vehicleId, driverId);
    
    // Send notification for driver assignment
    if (this.notificationService) {
      this.notificationService.notifyScheduleSlotChange(scheduleSlotId, 'DRIVER_ASSIGNED')
        .catch(error => logger.error('Failed to send driver assignment notification', { error: error instanceof Error ? error.message : String(error), scheduleSlotId }));
    }
    
    return result;
  }

  async updateSeatOverride(data: UpdateSeatOverrideData) {
    const { vehicleAssignmentId, seatOverride } = data;

    // Get the vehicle assignment to check the schedule slot date
    const vehicleAssignment = await this.scheduleSlotRepository.findVehicleAssignmentById(vehicleAssignmentId);
    if (vehicleAssignment) {
      await this.validateSlotNotInPast(vehicleAssignment.scheduleSlotId);
    }

    // Validate seat override value
    if (seatOverride !== undefined && this.validationService) {
      await this.validationService.validateSeatOverride(seatOverride);
    }

    const result = await this.scheduleSlotRepository.updateSeatOverride(vehicleAssignmentId, seatOverride);

    // Use the existing vehicleAssignment for integrity validation and notification
    if (vehicleAssignment) {
      // Validate slot integrity after update
      if (this.validationService) {
        await this.validationService.validateSlotIntegrity(vehicleAssignment.scheduleSlotId);
      }

      // Send notification for seat override update
      if (this.notificationService) {
        this.notificationService.notifyScheduleSlotChange(vehicleAssignment.scheduleSlotId, 'SEAT_OVERRIDE_UPDATED')
          .catch(error => logger.error('Failed to send seat override update notification', { error: error instanceof Error ? error.message : String(error), scheduleSlotId: vehicleAssignment.scheduleSlotId }));
      }
    }

    return result;
  }

  async getScheduleSlotDetails(scheduleSlotId: string): Promise<ScheduleSlotWithDetails | null> {
    logger.debug('Fetching schedule slot details', { scheduleSlotId });
    const slot = await this.scheduleSlotRepository.findById(scheduleSlotId);

    if (!slot) {
      logger.debug('Schedule slot not found', { scheduleSlotId });
      return null;
    }

    logger.debug('Repository returned schedule slot', { scheduleSlotId, vehicleAssignmentCount: slot.vehicleAssignments?.length || 0 });
    slot.vehicleAssignments?.forEach((va: unknown) => {
      logger.debug('Vehicle assignment details', { vehicleName: va.vehicle.name, vehicleId: va.vehicle.id, assignmentId: va.id });
    });

    const totalCapacity = slot.vehicleAssignments.reduce((sum: number, va: unknown) =>
      sum + (va.seatOverride ?? va.vehicle.capacity), 0);
    const availableSeats = totalCapacity > 0
      ? totalCapacity - slot.childAssignments.length
      : 999; // Unlimited if no vehicles

    const result: ScheduleSlotWithDetails = {
      id: slot.id,
      groupId: slot.groupId,
      datetime: slot.datetime,
      vehicleAssignments: slot.vehicleAssignments.map((va: unknown) => ({
        id: va.id,
        vehicle: {
          id: va.vehicle.id,
          name: va.vehicle.name,
          capacity: va.vehicle.capacity,
        },
        driver: va.driver ? {
          id: va.driver.id,
          name: va.driver.name,
        } : undefined,
        seatOverride: va.seatOverride,
      })),
      childAssignments: (() => {
        const validAssignments = slot.childAssignments.filter((assignment: unknown) => assignment.vehicleAssignmentId);
        const invalidAssignments = slot.childAssignments.filter((assignment: unknown) => !assignment.vehicleAssignmentId);

        // Filter out invalid assignments silently
        if (invalidAssignments.length > 0) {
          logger.warn('Found child assignments with missing vehicleAssignmentId', { slotId: slot.id, invalidCount: invalidAssignments.length });
        }

        return validAssignments.map((assignment: unknown) => ({
          vehicleAssignmentId: assignment.vehicleAssignmentId,
          child: {
            id: assignment.child.id,
            name: assignment.child.name,
          },
        }));
      })(),
      totalCapacity,
      availableSeats,
      createdAt: slot.createdAt?.toISOString(),
      updatedAt: slot.updatedAt?.toISOString(),
    };

    logger.debug('Returning schedule slot details', { scheduleSlotId, vehicleAssignmentCount: result.vehicleAssignments.length });

    return result;
  }

  async getSchedule(groupId: string, startDate?: string, endDate?: string) {
    // Get group to retrieve timezone
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        timezone: true,
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    // Use group's timezone (defaults to UTC in schema)
    const timezone = group.timezone;

    // If no date range provided, default to current week in user's timezone
    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd = new Date(endDate);
    } else {
      // Use timezone-aware week boundaries
      // Get current week boundaries (Monday 00:00 to Sunday 23:59:59.999) in user's timezone
      const now = new Date();
      const boundaries = getWeekBoundaries(now, timezone);

      rangeStart = boundaries.weekStart;
      rangeEnd = boundaries.weekEnd;
    }

    logger.debug('Fetching schedule slots from repository', { groupId, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() });
    const slots = await this.scheduleSlotRepository.getWeeklyScheduleByDateRange(groupId, rangeStart, rangeEnd);

    logger.debug('Repository returned schedule slots', { groupId, slotCount: slots.length });
    slots.forEach((slot: unknown) => {
      logger.debug('Schedule slot details', { slotId: slot.id, vehicleAssignmentCount: slot.vehicleAssignments?.length || 0 });
      slot.vehicleAssignments?.forEach((va: unknown) => {
        logger.debug('Vehicle assignment in slot', { vehicleName: va.vehicle.name, vehicleId: va.vehicle.id });
      });
    });

    // Transform to match expected format (data already enriched by repository includes)
    logger.debug('Transforming schedule slots', { slotCount: slots.length });
    const slotsWithDetails = slots.map((slot: unknown) => {
      const totalCapacity = slot.vehicleAssignments.reduce((sum: number, va: unknown) =>
        sum + (va.seatOverride ?? va.vehicle.capacity), 0);
      const availableSeats = totalCapacity > 0
        ? totalCapacity - slot.childAssignments.length
        : 999; // Unlimited if no vehicles

      // Filter out invalid child assignments
      const validAssignments = slot.childAssignments.filter((assignment: unknown) => assignment.vehicleAssignmentId);
      const invalidAssignments = slot.childAssignments.filter((assignment: unknown) => !assignment.vehicleAssignmentId);

      if (invalidAssignments.length > 0) {
        logger.warn('Found child assignments with missing vehicleAssignmentId', { slotId: slot.id, invalidCount: invalidAssignments.length });
      }

      return {
        id: slot.id,
        groupId: slot.groupId,
        datetime: slot.datetime,
        vehicleAssignments: slot.vehicleAssignments.map((va: unknown) => ({
          id: va.id,
          vehicle: {
            id: va.vehicle.id,
            name: va.vehicle.name,
            capacity: va.vehicle.capacity,
          },
          driver: va.driver ? {
            id: va.driver.id,
            name: va.driver.name,
          } : undefined,
          seatOverride: va.seatOverride,
        })),
        childAssignments: validAssignments.map((assignment: unknown) => ({
          vehicleAssignmentId: assignment.vehicleAssignmentId,
          child: {
            id: assignment.child.id,
            name: assignment.child.name,
          },
        })),
        totalCapacity,
        availableSeats,
        createdAt: slot.createdAt?.toISOString(),
        updatedAt: slot.updatedAt?.toISOString(),
      };
    });

    logger.debug('Final schedule result prepared', { slotCount: slotsWithDetails.length });
    slotsWithDetails.forEach((slot, index) => {
      logger.debug('Final slot details', { index, slotId: slot.id, vehicleCount: slot.vehicleAssignments?.length || 0 });
    });

    return {
      groupId,
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      scheduleSlots: slotsWithDetails,
    };
  }

  validateSlotCapacity(slot: unknown): boolean {
    if (!slot.vehicleAssignments || slot.vehicleAssignments.length === 0) {
      return true; // No vehicles means unlimited capacity for now
    }

    const totalCapacity = slot.vehicleAssignments.reduce((sum: number, va: unknown) => 
      sum + (va.seatOverride ?? va.vehicle.capacity), 0);
    const assignedCount = slot.childAssignments?.length || 0;
    return assignedCount < totalCapacity;
  }

  async validateSlotConflicts(scheduleSlotId: string): Promise<string[]> {
    const conflicts: string[] = [];
    const slot = await this.scheduleSlotRepository.findById(scheduleSlotId);
    
    if (!slot) {
      return conflicts;
    }

    // Check capacity conflicts
    if (!this.validateSlotCapacity(slot)) {
      conflicts.push('CAPACITY_EXCEEDED');
    }

    // Check driver/parent double booking
    if (slot.vehicleAssignments) {
      for (const vehicleAssignment of slot.vehicleAssignments) {
        if (vehicleAssignment.driver) {
          const driverConflicts = await this.scheduleSlotRepository.findConflictingSlotsForParentByDateTime(
            vehicleAssignment.driver.id,
            slot.groupId,
            slot.datetime,
          );
          
          if (driverConflicts.length > 1) {
            conflicts.push('DRIVER_DOUBLE_BOOKING');
          }
        }
      }
    }

    return conflicts;
  }
}