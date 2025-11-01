import { GroupService } from './GroupService';
import { ChildService } from './ChildService';
import { VehicleService } from './VehicleService';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('DashboardService');

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

      // Transform schedule slots to trip format
      const trips: TodayTrip[] = todaySlots.map(slot => ({
        id: slot.id,
        time: slot.time,
        datetime: slot.datetime ? slot.datetime.toISOString() : new Date().toISOString(), // Include full datetime for frontend timezone conversion
        destination: this.determineDestination(slot.time, slot.group?.name),
        type: this.determineType(slot.time),
        date: 'Today',
        children: slot.childAssignments?.map((assignment: { child: { id: string; name: string } }) => ({
          id: assignment.child.id,
          name: assignment.child.name,
        })) || [],
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
      // Get this week's schedule slots for the user
      const weeklySlots = await this.getWeeklyScheduleSlotsForUser(userId);

      // Transform schedule slots to trip format
      const trips: TodayTrip[] = weeklySlots.map(slot => ({
        id: slot.id,
        time: this.formatTimeFromDatetime(slot.datetime),
        datetime: slot.datetime.toISOString(), // Include full datetime for frontend timezone conversion
        destination: this.determineDestination(this.formatTimeFromDatetime(slot.datetime), slot.group?.name),
        type: this.determineType(this.formatTimeFromDatetime(slot.datetime)),
        date: this.formatDateFromDatetime(slot.datetime),
        children: slot.childAssignments?.map((assignment: { child: { id: string; name: string } }) => ({
          id: assignment.child.id,
          name: assignment.child.name,
        })) || [],
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
      const today = new Date();

      // Calculate this week's date range for datetime filtering
      const weekStart = this.getWeekStartDate(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Count schedule slots for this week where user is involved
      const tripCount = await this.prisma.scheduleSlot.count({
        where: {
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
          OR: [
            // User's family has access to the group
            {
              group: {
                OR: [
                  // User's family owns the group
                  {
                    ownerFamily: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                  // User's family is a member of the group
                  {
                    familyMembers: {
                      some: {
                        family: {
                          members: {
                            some: {
                              userId,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
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
            // User's family children are assigned to this slot
            {
              childAssignments: {
                some: {
                  child: {
                    family: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
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
      // Get current date info
      const today = new Date();

      // Calculate today's date range for datetime filtering
      const todayStart = new Date(today);
      todayStart.setUTCHours(0, 0, 0, 0);
      
      const todayEnd = new Date(today);
      todayEnd.setUTCHours(23, 59, 59, 999);

      // Find schedule slots for today where:
      // 1. User is a member of the group
      // 2. User's children are assigned to the slot OR user is driving
      const scheduleSlots = await this.prisma.scheduleSlot.findMany({
        where: {
          datetime: {
            gte: todayStart,
            lte: todayEnd,
          },
          OR: [
            // User's family has access to the group
            {
              group: {
                OR: [
                  // User's family owns the group
                  {
                    ownerFamily: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                  // User's family is a member of the group
                  {
                    familyMembers: {
                      some: {
                        family: {
                          members: {
                            some: {
                              userId,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
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
            // User's family children are assigned to this slot
            {
              childAssignments: {
                some: {
                  child: {
                    family: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
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
                },
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          childAssignments: {
            include: {
              child: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            where: {
              child: {
                family: {
                  members: {
                    some: {
                      userId, // Only include user's family children
                    },
                  },
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

  private async getWeeklyScheduleSlotsForUser(userId: string): Promise<any[]> {
    try {
      // Get current week date range
      const today = new Date();
      const weekStart = this.getWeekStartDate(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Find all schedule slots for this week where user is involved
      const scheduleSlots = await this.prisma.scheduleSlot.findMany({
        where: {
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
          OR: [
            // User's family has access to the group
            {
              group: {
                OR: [
                  // User's family owns the group
                  {
                    ownerFamily: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                  // User's family is a member of the group
                  {
                    familyMembers: {
                      some: {
                        family: {
                          members: {
                            some: {
                              userId,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
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
            // User's family children are assigned to this slot
            {
              childAssignments: {
                some: {
                  child: {
                    family: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
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
                },
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          childAssignments: {
            include: {
              child: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            where: {
              child: {
                family: {
                  members: {
                    some: {
                      userId, // Only include user's family children
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { datetime: 'asc' },
        ],
      });

      return scheduleSlots;
    } catch (error) {
      logger.error('Failed to fetch weekly schedule slots', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, userId });
      return [];
    }
  }
}