import { GroupService } from './GroupService';
import { ChildService } from './ChildService';
import { VehicleService } from './VehicleService';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { DayTransportSummary, TransportSlotSummary, VehicleAssignmentSummary, CapacityStatus, WeeklyDashboardResponse } from '../types/DashboardTypes';

const logger = createLogger('DashboardService');

// Type definitions for Prisma entities to avoid 'any' types
interface ScheduleSlotVehicleWithRelations {
  id: string;
  vehicle: {
    id: string;
    name: string;
    capacity: number;
  };
  driver?: {
    id: string;
    name: string;
  } | null;
  childAssignments?: Array<{
    child: {
      id: string;
      name: string;
    };
  }>;
}

interface ScheduleSlotWithRelations {
  id: string;
  datetime: Date;
  group?: {
    id: string;
    name: string;
  } | null;
  vehicleAssignments?: ScheduleSlotVehicleWithRelations[];
}

export interface TrendData {
  value: string;
  direction: 'up' | 'down' | 'neutral';
  period: string;
}

export interface DashboardStats {
  groups: number;
  children: number;
  vehicles: number;
  thisWeekTrips: number;
  trends: {
    groups: TrendData;
    children: TrendData;
    vehicles: TrendData;
    trips: TrendData;
  };
}

export interface TodayTrip {
  id: string;
  time: string; // UTC time in HH:MM format for backward compatibility
  datetime: string; // ISO 8601 datetime string for timezone conversion on frontend
  destination: string;
  type: 'pickup' | 'dropoff';
  date: string;
  children: {
    id: string;
    name: string;
  }[];
  vehicle?: {
    id: string;
    name: string;
    capacity: number;
  } | undefined;
  driver?: {
    id: string;
    name: string;
  } | undefined;
  group: {
    id: string;
    name: string;
  };
}

export interface ActivityItem {
  id: string;
  action: string;
  time: string;
  timestamp: Date;
  type: 'group' | 'vehicle' | 'child' | 'schedule';
  entityId?: string | null;
  entityName?: string | null;
}

export class DashboardService {
  private groupService: GroupService;
  private childService: ChildService;
  private vehicleService: VehicleService;
  private activityLogRepository: ActivityLogRepository;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    const prismaInstance = prisma || new PrismaClient();
    this.prisma = prismaInstance;
    this.groupService = new GroupService(prismaInstance);
    this.childService = new ChildService(prismaInstance);
    this.vehicleService = new VehicleService(prismaInstance);
    this.activityLogRepository = new ActivityLogRepository(prismaInstance);
  }

  async calculateUserStats(userId: string): Promise<DashboardStats> {
    try {
      // Fetch user data in parallel
      const [groups, children, vehicles, thisWeekTrips] = await Promise.all([
        this.groupService.getUserGroups(userId),
        this.childService.getChildrenByUser(userId),
        this.vehicleService.getVehiclesByUser(userId),
        this.getThisWeekTripsCountForUser(userId), // Fallback implementation
      ]);

      // Calculate basic stats
      const stats: DashboardStats = {
        groups: groups.length,
        children: children.length,
        vehicles: vehicles.length,
        thisWeekTrips,
        trends: {
          groups: { value: 'Active', direction: 'neutral', period: 'current' },
          children: { value: 'Active', direction: 'neutral', period: 'current' },
          vehicles: { value: 'Active', direction: 'neutral', period: 'current' },
          trips: { value: 'Active', direction: 'neutral', period: 'this week' },
        },
      };

      return stats;
    } catch (error) {
      logger.error('Failed to calculate user stats', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      throw error;
    }
  }

  async getTodayTripsForUser(userId: string): Promise<TodayTrip[]> {
    try {
      // Get today's schedule slots for the user
      const todaySlots = await this.getTodayScheduleSlotsForUser(userId);

      // Transform schedule slots to trip format with optimized data
      const trips: TodayTrip[] = todaySlots.map(slot => ({
        id: slot.id,
        time: this.formatTimeFromDatetime(slot.datetime),
        datetime: slot.datetime.toISOString(), // Include full datetime for frontend timezone conversion
        destination: this.determineDestination(this.formatTimeFromDatetime(slot.datetime), slot.group?.name),
        type: this.determineType(this.formatTimeFromDatetime(slot.datetime)),
        date: 'Today',
        children: slot.vehicleAssignments?.flatMap((va: ScheduleSlotVehicleWithRelations) =>
          va.childAssignments?.map((assignment) => ({
            id: assignment.child.id,
            name: assignment.child.name,
          })) || [],
        ) || [],
        vehicle: slot.vehicleAssignments?.[0]?.vehicle ? {
          id: slot.vehicleAssignments[0].vehicle.id,
          name: slot.vehicleAssignments[0].vehicle.name,
          capacity: slot.vehicleAssignments[0].vehicle.capacity,
        } : undefined,
        driver: slot.vehicleAssignments?.[0]?.driver ? {
          id: slot.vehicleAssignments[0].driver.id,
          name: slot.vehicleAssignments[0].driver.name,
        } : undefined,
        group: slot.group ? {
          id: slot.group.id,
          name: slot.group.name,
        } : { id: '', name: 'Unknown Group' },
      }));

      // Sort by time
      trips.sort((a, b) => a.time.localeCompare(b.time));

      return trips;
    } catch (error) {
      logger.error('Failed to get today trips for user', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      throw error;
    }
  }

  async getWeeklyTripsForUser(userId: string): Promise<TodayTrip[]> {
    try {
      // Get user's family first for optimized queries
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return [];
      }

      // Get week date range
      const today = new Date();
      const weekStart = this.getWeekStartDate(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Get this week's schedule slots using optimized method
      const weeklySlots = await this.getWeeklyScheduleSlotsOptimized(userId, userFamily.id, weekStart, weekEnd);

      // Transform schedule slots to trip format with optimized data
      const trips: TodayTrip[] = weeklySlots.map((slot: ScheduleSlotWithRelations) => ({
        id: slot.id,
        time: this.formatTimeFromDatetime(slot.datetime),
        datetime: slot.datetime.toISOString(), // Include full datetime for frontend timezone conversion
        destination: this.determineDestination(this.formatTimeFromDatetime(slot.datetime), slot.group?.name),
        type: this.determineType(this.formatTimeFromDatetime(slot.datetime)),
        date: this.formatDateFromDatetime(slot.datetime),
        children: slot.vehicleAssignments?.flatMap((va: ScheduleSlotVehicleWithRelations) =>
          va.childAssignments?.map((assignment) => ({
            id: assignment.child.id,
            name: assignment.child.name,
          })) || [],
        ) || [],
        vehicle: slot.vehicleAssignments?.[0]?.vehicle ? {
          id: slot.vehicleAssignments[0].vehicle.id,
          name: slot.vehicleAssignments[0].vehicle.name,
          capacity: slot.vehicleAssignments[0].vehicle.capacity,
        } : undefined,
        driver: slot.vehicleAssignments?.[0]?.driver ? {
          id: slot.vehicleAssignments[0].driver.id,
          name: slot.vehicleAssignments[0].driver.name,
        } : undefined,
        group: slot.group ? {
          id: slot.group.id,
          name: slot.group.name,
        } : { id: '', name: 'Unknown Group' },
      }));

      // Sort by day then time
      trips.sort((a, b) => {
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayComparison = dayOrder.indexOf(a.date) - dayOrder.indexOf(b.date);
        return dayComparison || a.time.localeCompare(b.time);
      });

      return trips;
    } catch (error) {
      logger.error('Failed to get weekly trips for user', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      throw error;
    }
  }

  async getRecentActivityForUser(userId: string): Promise<ActivityItem[]> {
    try {
      const activities = await this.activityLogRepository.getRecentActivityForUser(userId, 10);

      // Transform activity logs to dashboard format
      const formattedActivities: ActivityItem[] = activities.map(activity => ({
        id: activity.id,
        action: activity.actionDescription,
        time: this.formatRelativeTime(activity.createdAt),
        timestamp: activity.createdAt,
        type: this.mapEntityTypeToActivityType(activity.entityType),
        entityId: activity.entityId,
        entityName: activity.entityName,
      }));

      return formattedActivities;
    } catch (error) {
      logger.error('Failed to get recent activity for user', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      throw error;
    }
  }

  async getRecentActivityForFamily(familyId: string): Promise<ActivityItem[]> {
    try {
      const activities = await this.activityLogRepository.getRecentActivityForFamily(familyId, 10);

      // Transform activity logs to dashboard format
      const formattedActivities: ActivityItem[] = activities.map(activity => ({
        id: activity.id,
        action: activity.actionDescription,
        time: this.formatRelativeTime(activity.createdAt),
        timestamp: activity.createdAt,
        type: this.mapEntityTypeToActivityType(activity.entityType),
        entityId: activity.entityId,
        entityName: activity.entityName,
      }));

      return formattedActivities;
    } catch (error) {
      logger.error('Failed to get recent activity for family', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, familyId });
      throw error;
    }
  }

  async getUserWithFamily(userId: string): Promise<any> {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          familyMemberships: {
            select: {
              familyId: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get user with family', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      throw error;
    }
  }

  // Helper methods
  private determineDestination(time: string, groupName?: string): string {
    const hour = parseInt(time.split(':')[0]);
    return hour < 12 ? (groupName || 'School') : 'Home';
  }

  private determineType(time: string): 'pickup' | 'dropoff' {
    const hour = parseInt(time.split(':')[0]);
    return hour < 12 ? 'pickup' : 'dropoff';
  }

  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  }

  private formatTimeFromDatetime(datetime: Date): string {
    // Return UTC time as HH:MM format without timezone conversion
    // Backend should send UTC times and let frontend handle display timezone
    const hours = datetime.getUTCHours().toString().padStart(2, '0');
    const minutes = datetime.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private formatDateFromDatetime(datetime: Date): string {
    // Return UTC-based day of week
    // Backend should send UTC times and let frontend handle display timezone
    const dayOfWeek = datetime.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  private mapEntityTypeToActivityType(entityType?: string | null): 'group' | 'vehicle' | 'child' | 'schedule' {
    switch (entityType) {
      case 'group': return 'group';
      case 'vehicle': return 'vehicle';
      case 'child': return 'child';
      case 'schedule': return 'schedule';
      default: return 'group';
    }
  }

  // Get this week's trips count for user
  private async getThisWeekTripsCountForUser(userId: string): Promise<number> {
    try {
      // Get user's family first for optimized filtering
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return 0;
      }

      const today = new Date();

      // Calculate this week's date range for datetime filtering
      const weekStart = this.getWeekStartDate(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Optimized count query with DB-level filtering using userFamilyId
      const tripCount = await this.prisma.scheduleSlot.count({
        where: {
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
          OR: [
            // User's family owns the group - simplified check
            {
              group: {
                ownerFamily: {
                  id: userFamily.id,
                },
              },
            },
            // User's family is a member of the group - simplified check
            {
              group: {
                familyMembers: {
                  some: {
                    familyId: userFamily.id,
                  },
                },
              },
            },
            // User is driving a vehicle in this slot
            {
              vehicleAssignments: {
                some: {
                  driverId: userId,
                },
              },
            },
            // User's family children are assigned to this slot - simplified check
            {
              childAssignments: {
                some: {
                  child: {
                    familyId: userFamily.id,
                  },
                },
              },
            },
          ],
        },
      });

      return tripCount;
    } catch (error) {
      logger.error('Failed to count this week trips', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      return 0;
    }
  }

  private async getTodayScheduleSlotsForUser(userId: string): Promise<any[]> {
    try {
      // Get user's family first for optimized filtering
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return [];
      }

      // Get current date info
      const today = new Date();

      // Calculate today's date range for datetime filtering
      const todayStart = new Date(today);
      todayStart.setUTCHours(0, 0, 0, 0);

      const todayEnd = new Date(today);
      todayEnd.setUTCHours(23, 59, 59, 999);

      // Optimized query with DB-level filtering using userFamilyId
      const scheduleSlots = await this.prisma.scheduleSlot.findMany({
        where: {
          datetime: {
            gte: todayStart,
            lte: todayEnd,
          },
          OR: [
            // User's family owns the group - simplified check
            {
              group: {
                ownerFamily: {
                  id: userFamily.id,
                },
              },
            },
            // User's family is a member of the group - simplified check
            {
              group: {
                familyMembers: {
                  some: {
                    familyId: userFamily.id,
                  },
                },
              },
            },
            // User is driving a vehicle in this slot
            {
              vehicleAssignments: {
                some: {
                  driverId: userId,
                },
              },
            },
            // User's family children are assigned to this slot - simplified check
            {
              childAssignments: {
                some: {
                  child: {
                    familyId: userFamily.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicleAssignments: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  capacity: true,
                  familyId: true,
                },
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
              childAssignments: {
                include: {
                  child: {
                    select: {
                      id: true,
                      name: true,
                      familyId: true,
                    },
                  },
                },
                where: {
                  // Only include children from user's family OR any children assigned to user's family vehicles
                  OR: [
                    {
                      child: {
                        familyId: userFamily.id,
                      },
                    },
                    {
                      vehicleAssignment: {
                        vehicle: {
                          familyId: userFamily.id,
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        orderBy: {
          datetime: 'asc',
        },
      });

      return scheduleSlots;
    } catch (error) {
      logger.error('Failed to fetch today schedule slots', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      // Return empty array if there's an error
      return [];
    }
  }

  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (use UTC)
    
    // Calculate days to subtract to get to Monday
    let daysToSubtract = dayOfWeek - 1; // Monday is day 1
    if (dayOfWeek === 0) { // Sunday
      daysToSubtract = 6; // Go back 6 days to get to Monday
    }
    
    // Create a new date object to avoid mutation issues
    const weekStart = new Date(d.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Get weekly dashboard with DB-level filtering for optimal performance
   * Returns 7 days of transport summaries with vehicles and children filtered at database level
   * Per specification: getWeeklyDashboard(userId, startDate?)
   * Returns WeeklyDashboardResponse format with success wrapper
   */
  async getWeeklyDashboard(userId: string, startDate?: Date): Promise<WeeklyDashboardResponse> {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return {
          success: false,
          error: 'User has no family',
          statusCode: 401,
        } as WeeklyDashboardResponse;
      }

      // Get week date range (Monday to Sunday) - use provided startDate or today
      const baseDate = startDate || new Date();
      const weekStart = this.getWeekStartDate(baseDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Get weekly schedule slots with comprehensive DB-level filtering
      const weeklySlots = await this.getWeeklyScheduleSlotsOptimized(userId, userFamily.id, weekStart, weekEnd);

      // Aggregate slots by day and transform to daily summaries
      const days = this.aggregateSlotsByDay(weeklySlots, weekStart, userFamily.id);

      // Get metadata information
      const groupIds = await this.getGroupIdsForFamily(userFamily.id);
      const totalChildren = weeklySlots.flatMap((slot: any) =>
        slot.vehicleAssignments?.flatMap((va: any) =>
          va.childAssignments?.filter((ca: any) => ca.child.familyId === userFamily.id),
        ) || [],
      ).length;

      // Return in WeeklyDashboardResponse format per specification
      return {
        success: true,
        data: {
          days,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          generatedAt: new Date().toISOString(),
          metadata: {
            familyId: userFamily.id,
            familyName: userFamily.name,
            totalGroups: groupIds.length,
            totalChildren,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to get weekly dashboard', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      });
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      } as WeeklyDashboardResponse;
    }
  }

  /**
   * Get all group IDs where family is owner or member
   * Per specification lines 104-112: include all groups family belongs to
   */
  private async getGroupIdsForFamily(familyId: string): Promise<string[]> {
    // Get all groups (owned + member) in parallel for better performance
    const [ownedGroups, memberGroups] = await Promise.all([
      // Groups owned by user's family
      this.prisma.group.findMany({
        where: { familyId },
        select: { id: true },
      }),
      // Groups where user's family is a member
      this.prisma.groupFamilyMember.findMany({
        where: { familyId },
        select: { groupId: true },
      }),
    ]);

    return [
      ...ownedGroups.map(g => g.id),
      ...memberGroups.map(gm => gm.groupId),
    ];
  }

  /**
   * Ultra-optimized weekly schedule slots query with strategic subqueries and enhanced filtering
   * This implementation minimizes OR conditions and uses more efficient query patterns
   */
  private async getWeeklyScheduleSlotsOptimized(
    userId: string,
    userFamilyId: string,
    weekStart: Date,
    weekEnd: Date,
  ): Promise<any[]> {
    // Step 1: Get all relevant group IDs using extracted method
    const groupIds = await this.getGroupIdsForFamily(userFamilyId);

    // Step 2: Get vehicle assignments where user is driving (separate optimized query)
    const drivingVehicleAssignments = await this.prisma.scheduleSlotVehicle.findMany({
      where: {
        driverId: userId,
        scheduleSlot: {
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      },
      select: { scheduleSlotId: true },
    });

    const drivingSlotIds = drivingVehicleAssignments.map(va => va.scheduleSlotId);

    // Step 3: Get child assignments for user's family children (separate optimized query)
    const familyChildAssignments = await this.prisma.scheduleSlotChild.findMany({
      where: {
        child: {
          familyId: userFamilyId,
        },
        scheduleSlot: {
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      },
      select: { scheduleSlotId: true },
    });

    const childSlotIds = familyChildAssignments.map(ca => ca.scheduleSlotId);

    // Step 4: Main optimized query using IN clauses instead of complex OR conditions
    const scheduleSlots = await this.prisma.scheduleSlot.findMany({
      where: {
        datetime: {
          gte: weekStart,
          lte: weekEnd,
        },
        OR: [
          // Optimized: Use IN clauses for group membership
          ...(groupIds.length > 0 ? [{
            groupId: {
              in: groupIds,
            },
          }] : []),
          // Optimized: Use IN clause for driving slots
          ...(drivingSlotIds.length > 0 ? [{
            id: {
              in: drivingSlotIds,
            },
          }] : []),
          // Optimized: Use IN clause for child assignment slots
          ...(childSlotIds.length > 0 ? [{
            id: {
              in: childSlotIds,
            },
          }] : []),
        ].filter(Boolean), // Remove any empty conditions
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        vehicleAssignments: {
          include: {
            vehicle: {
              select: {
                id: true,
                name: true,
                capacity: true,
                familyId: true,
              },
            },
            driver: {
              select: {
                id: true,
                name: true,
              },
            },
            childAssignments: {
              include: {
                child: {
                  select: {
                    id: true,
                    name: true,
                    familyId: true,
                  },
                },
              },
              where: {
                // Optimized: Keep the family filtering at the assignment level
                OR: [
                  {
                    child: {
                      familyId: userFamilyId,
                    },
                  },
                  {
                    vehicleAssignment: {
                      vehicle: {
                        familyId: userFamilyId,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    return scheduleSlots;
  }

  /**
   * Aggregate slots by day and transform to daily summaries
   * Per specification: groups slots by date and creates DayTransportSummary objects
   */
  private aggregateSlotsByDay(
    slots: any[],
    weekStart: Date,
    userFamilyId: string,
  ): DayTransportSummary[] {
    const daysMap = new Map<string, any[]>();

    // Initialize all 7 days with empty arrays
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      const dayKey = currentDay.toISOString().split('T')[0]; // YYYY-MM-DD
      daysMap.set(dayKey, []);
    }

    // Group slots by date
    slots.forEach(slot => {
      const dayKey = slot.datetime.toISOString().split('T')[0];
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, []);
      }
      daysMap.get(dayKey)!.push(slot);
    });

    // Transform to DayTransportSummary format
    const weeklyDashboard: DayTransportSummary[] = [];

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      const dayKey = currentDay.toISOString().split('T')[0];
      const daySlots = daysMap.get(dayKey) || [];

      // Group slots by time to create transport summaries
      const timeSlotsMap = new Map<string, any[]>();
      daySlots.forEach(slot => {
        const timeKey = this.formatTimeFromDatetime(slot.datetime);
        if (!timeSlotsMap.has(timeKey)) {
          timeSlotsMap.set(timeKey, []);
        }
        timeSlotsMap.get(timeKey)!.push(slot);
      });

      // Convert each time slot to TransportSlotSummary
      const transports: TransportSlotSummary[] = [];
      timeSlotsMap.forEach((timeSlots) => {
        const transportSummary = this.createTransportSlotSummary(timeSlots, userFamilyId);
        transports.push(transportSummary);
      });

      // Sort transports by time
      transports.sort((a, b) => a.time.localeCompare(b.time));

      const daySummary: DayTransportSummary = {
        date: dayKey,
        transports,
        totalChildrenInVehicles: transports.reduce((sum, t) => sum + t.totalChildrenAssigned, 0),
        totalVehiclesWithAssignments: transports.reduce((sum, t) => sum + t.vehicleAssignmentSummaries.length, 0),
        hasScheduledTransports: transports.length > 0,
      };

      weeklyDashboard.push(daySummary);
    }

    return weeklyDashboard;
  }

  /**
   * Filter vehicles for slot according to specification rules
   * Per spec lines 158-194: include family vehicles + other vehicles with family children
   */
  private filterVehiclesForSlot(
    vehicleAssignmentSummaries: VehicleAssignmentSummary[],
  ): VehicleAssignmentSummary[] {
    return vehicleAssignmentSummaries.filter(vehicleSummary => {
      // Include vehicle if:
      // 1. It's a family vehicle (always displayed, even if empty), OR
      // 2. It has assigned children from user's family, OR
      // 3. User is driving it
      return vehicleSummary.isFamilyVehicle ||
             vehicleSummary.assignedChildrenCount > 0 ||
             vehicleSummary.driver?.id;
    });
  }

  /**
   * Create transport slot summary from schedule slots with same time
   */
  private createTransportSlotSummary(slots: any[], userFamilyId: string): TransportSlotSummary {
    if (slots.length === 0) {
      throw new Error('Cannot create transport summary from empty slots');
    }

    const firstSlot = slots[0];
    const time = this.formatTimeFromDatetime(firstSlot.datetime);
    const destination = this.determineDestination(time, firstSlot.group?.name);

    // Collect all vehicle assignments from all slots at this time
    const allVehicleAssignments: any[] = [];
    slots.forEach(slot => {
      if (slot.vehicleAssignments) {
        allVehicleAssignments.push(...slot.vehicleAssignments);
      }
    });

    // Create vehicle assignment summaries with proper filtering
    const unfilteredVehicleSummaries: VehicleAssignmentSummary[] = allVehicleAssignments
      .map(vehicleAssignment => {
        const assignedChildren = vehicleAssignment.childAssignments || [];
        const assignedChildrenCount = assignedChildren.length;
        const totalCapacity = vehicleAssignment.seatOverride || vehicleAssignment.vehicle.capacity;
        const availableSeats = totalCapacity - assignedChildrenCount;
        const capacityStatus = this.getCapacityStatus(availableSeats, totalCapacity);

        return {
          vehicleId: vehicleAssignment.vehicle.id,
          vehicleName: vehicleAssignment.vehicle.name,
          vehicleCapacity: vehicleAssignment.seatOverride || vehicleAssignment.vehicle.capacity,
          assignedChildrenCount,
          availableSeats,
          capacityStatus,
          vehicleFamilyId: vehicleAssignment.vehicle.familyId,
          isFamilyVehicle: vehicleAssignment.vehicle.familyId === userFamilyId,
          driver: vehicleAssignment.driver ? {
            id: vehicleAssignment.driver.id,
            name: vehicleAssignment.driver.name,
          } : undefined,
          // Include children details for API response
          children: assignedChildren.map((childAssignment: any) => ({
            childId: childAssignment.child.id,
            childName: childAssignment.child.name,
            childFamilyId: childAssignment.child.familyId,
            isFamilyChild: childAssignment.child.familyId === userFamilyId,
          })),
        };
      });

    // Apply vehicle filtering rules per specification
    const vehicleAssignmentSummaries = this.filterVehiclesForSlot(unfilteredVehicleSummaries);

    const totalChildrenAssigned = vehicleAssignmentSummaries.reduce((sum, v) => sum + v.assignedChildrenCount, 0);
    const totalCapacity = vehicleAssignmentSummaries.reduce((sum, v) => sum + v.vehicleCapacity, 0);
    const totalAvailableSeats = vehicleAssignmentSummaries.reduce((sum, v) => sum + v.availableSeats, 0);
    const overallCapacityStatus = this.getCapacityStatus(totalAvailableSeats, totalCapacity);

    return {
      time,
      destination,
      vehicleAssignmentSummaries,
      totalChildrenAssigned,
      totalCapacity,
      overallCapacityStatus,
    };
  }

  /**
   * Get capacity status based on availability
   * CRITICAL: Fixed to match specification lines 207-213
   * Uses available/total ratio with correct thresholds (90%/70%)
   */
  private getCapacityStatus(available: number, total: number): CapacityStatus {
    if (total === 0) return 'full';
    const ratio = available / total;
    if (ratio <= 0) return 'overcapacity';  // Overbooked (available <= 0)
    if (ratio <= 0.1) return 'full';        // >= 90% full (available <= 10%)
    if (ratio <= 0.3) return 'limited';     // >= 70% full (available <= 30%)
    return 'available';                     // < 70% full (available > 30%)
  }

  /**
   * Get user's family ID directly (per specification lines 94-101)
   * This is the preferred method for extracting familyId from authenticated user
   */
  async getUserFamilyId(userId: string): Promise<string | null> {
    const familyMember = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: {
        familyId: true,
      },
    });

    return familyMember?.familyId || null;
  }

  /**
   * Get user's family information (full details)
   */
  private async getUserFamily(userId: string): Promise<{ id: string; name: string } | null> {
    const familyMember = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return familyMember?.family || null;
  }

  }