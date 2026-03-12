
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { CreateScheduleSlotData, WeeklySchedule, ScheduleSlotWithDetails } from '../types';
import { PrismaClient, Prisma } from '@prisma/client';

// Type for schedule slot from repository with details
type ScheduleSlotFromRepo = Prisma.ScheduleSlotGetPayload<{
  include: {
    group: {
      select: {
        id: true;
        name: true;
      };
    };
    vehicleAssignments: {
      include: {
        vehicle: true;
        driver: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    childAssignments: {
      select: {
        scheduleSlotId: true;
        childId: true;
        vehicleAssignmentId: true;
        assignedAt: true;
        child: {
          select: {
            id: true;
            name: true;
            age: true;
            familyId: true;
            createdAt: true;
            updatedAt: true;
          };
        };
      };
    };
  };
} & {
  id: string;
  groupId: string;
  datetime: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export class SchedulingService {
  constructor(
    private scheduleSlotRepository: ScheduleSlotRepository,
    private prisma: PrismaClient,
  ) {}

  async createScheduleSlot(data: CreateScheduleSlotData) {
    // Parse datetime string to Date object (UTC) 
    const datetime = new Date(data.datetime);
    
    // Validate datetime
    if (isNaN(datetime.getTime())) {
      throw new Error('Invalid datetime format. Please provide valid ISO datetime string.');
    }
    
    // Prevent creating schedule slots in the past
    const now = new Date();
    if (datetime.getTime() < now.getTime()) {
      throw new Error('Cannot create trips in the past');
    }
    
    // Check for existing slot at same datetime for same group
    const existingSlot = await this.scheduleSlotRepository.findByGroupAndDateTime(
      data.groupId,
      datetime,
    );

    if (existingSlot) {
      throw new Error('Schedule slot already exists for this group and datetime');
    }

    return this.scheduleSlotRepository.create({
      ...data,
      datetime: datetime.toISOString(), // Ensure consistent UTC storage
    });
  }

  async getWeeklySchedule(groupId: string, week: string): Promise<WeeklySchedule> {
    // Calculate week start and end dates for datetime filtering
    const [year, weekNum] = week.split('-').map(Number);
    
    // Calculate the Monday of the specified ISO week
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    
    let daysToFirstMonday;
    if (jan1Day === 0) { // Sunday
      daysToFirstMonday = 1;
    } else if (jan1Day === 1) { // Monday
      daysToFirstMonday = 0;
    } else { // Tuesday to Saturday
      daysToFirstMonday = 8 - jan1Day;
    }
    
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    
    // ISO week 1 logic
    let isoWeek1Start;
    if (firstMonday.getDate() <= 4) {
      isoWeek1Start = firstMonday;
    } else {
      isoWeek1Start = new Date(firstMonday);
      isoWeek1Start.setDate(firstMonday.getDate() - 7);
    }
    
    // Calculate target week start (Monday) and end (Sunday)
    const weekStart = new Date(isoWeek1Start);
    weekStart.setDate(isoWeek1Start.getDate() + (weekNum - 1) * 7);
    weekStart.setUTCHours(0, 0, 0, 0); // Start of Monday in UTC
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    weekEnd.setUTCHours(23, 59, 59, 999); // End of Sunday in UTC

    const scheduleSlots = await this.scheduleSlotRepository.getWeeklyScheduleByDateRange(
      groupId,
      weekStart,
      weekEnd,
    ) as ScheduleSlotFromRepo[];

    const scheduleSlotDetails: ScheduleSlotWithDetails[] = scheduleSlots.map((slot) => {
      const totalCapacity = slot.vehicleAssignments?.reduce((sum: number, va) =>
        sum + (va.seatOverride || va.vehicle.capacity), 0) ?? 0;

      return {
        id: slot.id,
        groupId: slot.groupId,
        datetime: slot.datetime.toISOString(),
        group: slot.group,
        vehicleAssignments: slot.vehicleAssignments?.map((va) => ({
          id: va.id,
          vehicleId: va.vehicleId,
          scheduleSlotId: va.scheduleSlotId,
          driverId: va.driverId,
          seatOverride: va.seatOverride,
          createdAt: va.createdAt.toISOString(),
          vehicle: {
            id: va.vehicle.id,
            name: va.vehicle.name,
            capacity: va.vehicle.capacity,
            familyId: va.vehicle.familyId,
            createdAt: va.vehicle.createdAt.toISOString(),
            updatedAt: va.vehicle.updatedAt.toISOString(),
          },
          driver: va.driver ? {
            id: va.driver.id,
            name: va.driver.name,
          } : null,
          childAssignments: [],
        })) ?? [],
        childAssignments: slot.childAssignments?.map((assignment) => ({
          id: `${assignment.scheduleSlotId}_${assignment.childId}`,
          scheduleSlotId: assignment.scheduleSlotId,
          childId: assignment.childId,
          vehicleAssignmentId: assignment.vehicleAssignmentId,
          assignedAt: assignment.assignedAt.toISOString(),
          child: {
            id: assignment.child.id,
            name: assignment.child.name,
            age: assignment.child.age,
            familyId: assignment.child.familyId,
            createdAt: assignment.child.createdAt.toISOString(),
            updatedAt: assignment.child.updatedAt.toISOString(),
          },
        })) ?? [],
        totalCapacity,
        availableSeats: Math.max(0, totalCapacity - (slot.childAssignments?.length || 0)),
        createdAt: slot.createdAt.toISOString(),
        updatedAt: slot.updatedAt.toISOString(),
      };
    });

    return {
      week,
      groupId,
      scheduleSlots: scheduleSlotDetails,
    };
  }

  async detectScheduleConflicts(parentId: string, scheduleSlotId: string): Promise<string[]> {
    const conflicts: string[] = [];
    
    // Get schedule slot details first
    const scheduleSlot = await this.scheduleSlotRepository.findById(scheduleSlotId) as ScheduleSlotFromRepo | null;
    if (!scheduleSlot) {
      return conflicts;
    }

    const conflictingSlots = await this.scheduleSlotRepository.findConflictingSlotsForParentByDateTime(
      parentId,
      scheduleSlot.groupId,
      scheduleSlot.datetime,
    ) as ScheduleSlotFromRepo[];

    for (const slot of conflictingSlots) {
      // Check if parent is already driving
      for (const vehicleAssignment of slot.vehicleAssignments || []) {
        if (vehicleAssignment.driverId === parentId) {
          conflicts.push(`Parent is already driving in schedule slot ${slot.id}`);
        }

        // Check if vehicle belongs to parent's family and if parent has access
        const vehicleWithFamily = await this.prisma.vehicle.findUnique({
          where: { id: vehicleAssignment.vehicle.id },
          include: {
            family: {
              include: {
                members: {
                  where: { userId: parentId },
                  select: { userId: true, role: true },
                },
              },
            },
          },
        });
        
        // If the vehicle belongs to parent's family, it's a conflict
        if (vehicleWithFamily?.family?.members && vehicleWithFamily.family.members.length > 0) {
          conflicts.push(`Vehicle ${vehicleAssignment.vehicle.name} from your family is already assigned to schedule slot ${slot.id}`);
        }
      }

      // Check if children belong to parent's family and if parent has access
      for (const assignment of slot.childAssignments || []) {
        const childWithFamily = await this.prisma.child.findUnique({
          where: { id: assignment.child.id },
          include: {
            family: {
              include: {
                members: {
                  where: { userId: parentId },
                  select: { userId: true, role: true },
                },
              },
            },
          },
        });
        
        // If the child belongs to parent's family, it's a conflict
        if (childWithFamily?.family?.members && childWithFamily.family.members.length > 0) {
          conflicts.push(`Child ${assignment.child.name} from your family is already assigned to schedule slot ${slot.id}`);
        }
      }
    }

    return conflicts;
  }

  async detectConflicts(parentId: string, groupId: string, datetime: Date): Promise<string[]> {
    const conflicts: string[] = [];

    const conflictingSlots = await this.scheduleSlotRepository.findConflictingSlotsForParentByDateTime(
      parentId,
      groupId,
      datetime,
    ) as ScheduleSlotFromRepo[];

    for (const slot of conflictingSlots) {
      // Check if parent is already driving
      for (const vehicleAssignment of slot.vehicleAssignments || []) {
        if (vehicleAssignment.driverId === parentId) {
          conflicts.push(`Parent is already driving in schedule slot ${slot.id}`);
        }

        // Check if vehicle belongs to parent's family and if parent has access
        const vehicleWithFamily = await this.prisma.vehicle.findUnique({
          where: { id: vehicleAssignment.vehicle.id },
          include: {
            family: {
              include: {
                members: {
                  where: { userId: parentId },
                  select: { userId: true, role: true },
                },
              },
            },
          },
        });
        
        // If the vehicle belongs to parent's family, it's a conflict
        if (vehicleWithFamily?.family?.members && vehicleWithFamily.family.members.length > 0) {
          conflicts.push(`Vehicle ${vehicleAssignment.vehicle.name} from your family is already assigned to schedule slot ${slot.id}`);
        }
      }

      // Check if children belong to parent's family and if parent has access
      for (const assignment of slot.childAssignments || []) {
        const childWithFamily = await this.prisma.child.findUnique({
          where: { id: assignment.child.id },
          include: {
            family: {
              include: {
                members: {
                  where: { userId: parentId },
                  select: { userId: true, role: true },
                },
              },
            },
          },
        });
        
        // If the child belongs to parent's family, it's a conflict
        if (childWithFamily?.family?.members && childWithFamily.family.members.length > 0) {
          conflicts.push(`Child ${assignment.child.name} from your family is already assigned to schedule slot ${slot.id}`);
        }
      }
    }

    return conflicts;
  }
}