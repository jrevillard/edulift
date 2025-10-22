import { PrismaClient, Prisma } from '@prisma/client';
import { CreateScheduleSlotData } from '../types';
import { getWeekBoundaries, getDateFromISOWeek } from '../utils/isoWeekUtils';

export class ScheduleSlotRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateScheduleSlotData) {
    return this.prisma.scheduleSlot.create({
      data,
      include: {
        group: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: {
            vehicle: { select: { id: true, name: true, capacity: true } },
            driver: { select: { id: true, name: true } }
          }
        },
        childAssignments: {
          include: {
            child: { select: { id: true, name: true } }
          }
        }
      }
    });
  }


  async findById(id: string) {
    return this.prisma.scheduleSlot.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: {
            vehicle: { select: { id: true, name: true, capacity: true } },
            driver: { select: { id: true, name: true } }
          }
        },
        childAssignments: {
          select: {
            vehicleAssignmentId: true,
            child: { select: { id: true, name: true } }
          }
        }
      }
    });
  }

  async findByIdWithDetails(id: string) {
    return this.prisma.scheduleSlot.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: {
            vehicle: { select: { id: true, name: true, capacity: true } },
            driver: { select: { id: true, name: true } }
          }
        },
        childAssignments: {
          select: {
            vehicleAssignmentId: true,
            child: { 
              select: { 
                id: true, 
                name: true
              } 
            }
          }
        }
      }
    });
  }

  async findByGroupAndDateTime(groupId: string, datetime: Date) {
    return this.prisma.scheduleSlot.findUnique({
      where: {
        groupId_datetime: {
          groupId,
          datetime
        }
      },
      include: {
        group: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: {
            vehicle: { select: { id: true, name: true, capacity: true } },
            driver: { select: { id: true, name: true } }
          }
        },
        childAssignments: {
          include: {
            child: { select: { id: true, name: true } }
          }
        }
      }
    });
  }

  async assignVehicleToSlot(scheduleSlotId: string, vehicleId: string, driverId?: string, seatOverride?: number) {
    // ✅ PRODUCTION: Use SERIALIZABLE transaction to prevent race conditions
    return await this.prisma.$transaction(
      async (tx) => {
        // Validate schedule slot exists
        const scheduleSlot = await tx.scheduleSlot.findUnique({
          where: { id: scheduleSlotId },
          include: { group: true }
        });
        if (!scheduleSlot) {
          throw new Error('Schedule slot not found');
        }

        // Validate vehicle exists
        const vehicle = await tx.vehicle.findUnique({
          where: { id: vehicleId },
          select: { id: true, name: true, capacity: true, familyId: true }
        });
        if (!vehicle) {
          throw new Error('Vehicle not found');
        }

        // Validate driver exists if provided
        if (driverId) {
          const driver = await tx.user.findUnique({ where: { id: driverId } });
          if (!driver) {
            throw new Error('Driver not found');
          }
        }

        // Check if vehicle is already assigned to this schedule slot
        const existingAssignment = await tx.scheduleSlotVehicle.findUnique({
          where: {
            scheduleSlotId_vehicleId: {
              scheduleSlotId,
              vehicleId
            }
          }
        });

        if (existingAssignment) {
          throw new Error('Vehicle is already assigned to this schedule slot');
        }

        // Business rule: Check for vehicle conflicts (same datetime in same group)
        const conflictingSlots = await tx.scheduleSlot.findMany({
          where: {
            id: { not: scheduleSlotId },
            groupId: scheduleSlot.groupId,
            datetime: scheduleSlot.datetime,
            vehicleAssignments: {
              some: { vehicleId }
            }
          }
        });

        if (conflictingSlots.length > 0) {
          throw new Error(
            `Vehicle is already assigned to another schedule slot at ${scheduleSlot.datetime.toISOString()}`
          );
        }

        // Create the assignment
        const result = await tx.scheduleSlotVehicle.create({
          data: {
            scheduleSlotId,
            vehicleId,
            driverId: driverId || null,
            seatOverride: seatOverride || null
          },
          include: {
            vehicle: {
              select: { id: true, name: true, capacity: true }
            },
            driver: {
              select: { id: true, name: true }
            }
          }
        });

        return result;
      },
      {
        // ✅ SERIALIZABLE = Maximum isolation - prevents race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );
  }

  async removeVehicleFromSlot(scheduleSlotId: string, vehicleId: string) {
    // Use transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Remove the vehicle assignment
      const result = await tx.scheduleSlotVehicle.delete({
        where: {
          scheduleSlotId_vehicleId: {
            scheduleSlotId,
            vehicleId
          }
        }
      });

      // Check remaining vehicle assignments after removal
      const remainingVehicleCount = await tx.scheduleSlotVehicle.count({ 
        where: { scheduleSlotId } 
      });

      // Business rule: ScheduleSlot must have at least one vehicle
      // If last vehicle is removed, delete the entire ScheduleSlot
      let slotDeleted = false;
      if (remainingVehicleCount === 0) {
        await tx.scheduleSlot.delete({
          where: { id: scheduleSlotId }
        });
        slotDeleted = true;
      }

      return { vehicleAssignment: result, slotDeleted };
    });
  }

  async updateVehicleDriver(scheduleSlotId: string, vehicleId: string, driverId: string | null) {
    return this.prisma.scheduleSlotVehicle.update({
      where: {
        scheduleSlotId_vehicleId: {
          scheduleSlotId,
          vehicleId
        }
      },
      data: { driverId }
    });
  }


  async removeChildFromSlot(scheduleSlotId: string, childId: string) {
    return this.prisma.scheduleSlotChild.delete({
      where: {
        scheduleSlotId_childId: {
          scheduleSlotId,
          childId
        }
      }
    });
  }

  /**
   * Get weekly schedule by date range
   *
   * @deprecated Use getScheduleByWeek with timezone parameter instead
   * This method uses raw UTC dates which may not align with user's week boundaries
   */
  async getWeeklyScheduleByDateRange(groupId: string, weekStart: Date, weekEnd: Date) {
    return this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: { id: true, name: true, capacity: true }
            },
            driver: {
              select: { id: true, name: true }
            }
          }
        },
        childAssignments: {
          select: {
            vehicleAssignmentId: true,
            child: {
              select: { id: true, name: true, familyId: true }
            }
          }
        }
      },
      orderBy: [
        { datetime: 'asc' }
      ]
    });
  }

  /**
   * Get schedule for a specific ISO week in the user's timezone
   *
   * Calculates week boundaries (Monday 00:00 to Sunday 23:59:59.999) in the user's
   * timezone and converts to UTC for database queries. This ensures schedules are
   * filtered according to the user's local week, not UTC.
   *
   * @param groupId - The group ID to filter schedules
   * @param year - ISO week year
   * @param week - ISO week number (1-53)
   * @param timezone - IANA timezone string (e.g., "Europe/Paris", "Asia/Tokyo")
   * @returns Schedule slots within the week boundaries
   *
   * @example
   * // Get Week 1 of 2024 in Asia/Tokyo timezone
   * // Week starts: Monday 2024-01-01 00:00 JST (2023-12-31 15:00 UTC)
   * // Week ends: Sunday 2024-01-07 23:59:59.999 JST (2024-01-07 14:59:59.999 UTC)
   * await repository.getScheduleByWeek('group-1', 2024, 1, 'Asia/Tokyo');
   */
  async getScheduleByWeek(
    groupId: string,
    year: number,
    week: number,
    timezone: string
  ) {
    // Get the Monday 00:00 in user's timezone for this ISO week
    const weekStartDate = getDateFromISOWeek(year, week, timezone);

    // Calculate week boundaries in user's timezone (converted to UTC)
    const { weekStart, weekEnd } = getWeekBoundaries(weekStartDate, timezone);

    // Query database using UTC boundaries
    return this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: { id: true, name: true, capacity: true }
            },
            driver: {
              select: { id: true, name: true }
            }
          }
        },
        childAssignments: {
          select: {
            vehicleAssignmentId: true,
            child: {
              select: { id: true, name: true, familyId: true }
            }
          }
        }
      },
      orderBy: [
        { datetime: 'asc' }
      ]
    });
  }

  /**
   * Get weekly schedule by date range with timezone awareness
   *
   * Takes a reference datetime and calculates the week boundaries in the user's timezone.
   * More convenient than getScheduleByWeek when you have a datetime rather than week number.
   *
   * @param groupId - The group ID to filter schedules
   * @param datetime - Reference datetime (will find the week containing this datetime)
   * @param timezone - IANA timezone string
   * @returns Schedule slots within the week boundaries
   *
   * @example
   * // Get the week containing Jan 3, 2024 in America/Los_Angeles
   * await repository.getScheduleByWeekFromDate(
   *   'group-1',
   *   new Date('2024-01-03T10:00:00Z'),
   *   'America/Los_Angeles'
   * );
   */
  async getScheduleByWeekFromDate(
    groupId: string,
    datetime: Date | string,
    timezone: string
  ) {
    // Calculate week boundaries in user's timezone
    const { weekStart, weekEnd } = getWeekBoundaries(datetime, timezone);

    // Query database using UTC boundaries
    return this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: { id: true, name: true, capacity: true }
            },
            driver: {
              select: { id: true, name: true }
            }
          }
        },
        childAssignments: {
          select: {
            vehicleAssignmentId: true,
            child: {
              select: { id: true, name: true, familyId: true }
            }
          }
        }
      },
      orderBy: [
        { datetime: 'asc' }
      ]
    });
  }

  async findConflictingSlotsForParentByDateTime(
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
      },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: { id: true, name: true }
            }
          }
        },
        childAssignments: {
          include: {
            child: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
  }

  async bulkUpdateSlots(updates: Array<{ id: string; data: any }>) {
    // Validate each update before executing
    for (const update of updates) {
      // If updating datetime, check it's not in the past
      if (update.data.datetime) {
        const datetime = new Date(update.data.datetime);
        if (isNaN(datetime.getTime())) {
          throw new Error(`Invalid datetime format in update for slot ${update.id}`);
        }
        const now = new Date();
        if (datetime.getTime() < now.getTime()) {
          throw new Error(`Cannot update slot ${update.id} to a time in the past`);
        }
      }
      
      // If updating any other fields, check that the existing slot is not in the past
      if (!update.data.datetime) {
        const existingSlot = await this.prisma.scheduleSlot.findUnique({
          where: { id: update.id },
          select: { datetime: true }
        });
        
        if (!existingSlot) {
          throw new Error(`Schedule slot ${update.id} not found`);
        }
        
        const now = new Date();
        if (existingSlot.datetime.getTime() < now.getTime()) {
          throw new Error(`Cannot modify schedule slot ${update.id} that is in the past`);
        }
      }
    }

    const transactions = updates.map(update =>
      this.prisma.scheduleSlot.update({
        where: { id: update.id },
        data: update.data
      })
    );

    return this.prisma.$transaction(transactions);
  }

  async findSlotsByDateTimeRange(groupId: string, startDate: Date, endDate: Date) {
    return this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: { id: true, name: true, capacity: true }
            },
            driver: {
              select: { id: true, name: true }
            }
          }
        },
        childAssignments: {
          include: {
            child: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [
        { datetime: 'asc' }
      ]
    });
  }

  async updateSeatOverride(vehicleAssignmentId: string, seatOverride?: number) {
    return this.prisma.scheduleSlotVehicle.update({
      where: { id: vehicleAssignmentId },
      data: { seatOverride: seatOverride || null },
      include: {
        vehicle: {
          select: { id: true, name: true, capacity: true }
        },
        driver: {
          select: { id: true, name: true }
        }
      }
    });
  }

  async findVehicleAssignmentById(vehicleAssignmentId: string) {
    return this.prisma.scheduleSlotVehicle.findUnique({
      where: { id: vehicleAssignmentId },
      select: {
        id: true,
        scheduleSlotId: true,
        vehicleId: true,
        driverId: true,
        seatOverride: true
      }
    });
  }
}