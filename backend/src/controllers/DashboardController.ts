/**
 * Dashboard Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for dashboard endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { DashboardService } from '../services/DashboardService';
import { createLogger } from '../utils/logger';

const logger = createLogger('DashboardController');

// Type Hono for context with userId
type DashboardVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const app = new OpenAPIHono<{ Variables: DashboardVariables }>();

// Initialize services
const prisma = new PrismaClient();
const dashboardService = new DashboardService(prisma);

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Failed to retrieve dashboard data',
    description: 'Error message',
  }),
  code: z.string().optional().openapi({
    example: 'DASHBOARD_ERROR',
    description: 'Error code for programmatic handling',
  }),
});

// Success response schema helper
const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
  return z.object({
    success: z.literal(true),
    data: schema,
  });
};

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * Enum definitions
 */
const TrendDirectionEnum = z.enum(['up', 'down', 'neutral']).openapi({
  description: 'Direction of a trend indicator',
  example: 'up',
});

const ActivityTypeEnum = z.enum(['group', 'vehicle', 'child', 'schedule']).openapi({
  description: 'Type of activity in the dashboard',
  example: 'vehicle',
});

/**
 * Schema definitions
 */
const TrendDataSchema = z.object({
  value: z.string().openapi({
    description: 'Trend value as string',
    example: '+12%',
  }),
  direction: TrendDirectionEnum,
  period: z.string().openapi({
    description: 'Time period for the trend',
    example: 'last 7 days',
  }),
});

const DashboardStatsDataSchema = z.object({
  groups: z.number().int().min(0).openapi({
    description: 'Number of groups the user belongs to',
    example: 3,
  }),
  children: z.number().int().min(0).openapi({
    description: 'Number of children in the family',
    example: 2,
  }),
  vehicles: z.number().int().min(0).openapi({
    description: 'Number of vehicles in the family',
    example: 2,
  }),
  thisWeekTrips: z.number().int().min(0).openapi({
    description: 'Number of trips scheduled for this week',
    example: 12,
  }),
  trends: z.object({
    groups: TrendDataSchema,
    children: TrendDataSchema,
    vehicles: TrendDataSchema,
    trips: TrendDataSchema,
  }),
});

const ChildInfoSchema = z.object({
  id: z.string().openapi({
    description: 'Child ID',
    example: 'cl123456789012345678901234',
  }),
  name: z.string().openapi({
    description: 'Child name',
    example: 'John Doe',
  }),
});

const VehicleInfoSchema = z.object({
  id: z.string().openapi({
    description: 'Vehicle ID',
    example: 'cl123456789012345678901235',
  }),
  name: z.string().openapi({
    description: 'Vehicle name',
    example: 'Toyota Sienna',
  }),
  capacity: z.number().int().min(1).openapi({
    description: 'Vehicle capacity',
    example: 6,
  }),
});

const DriverInfoSchema = z.object({
  id: z.string().openapi({
    description: 'Driver ID',
    example: 'cl123456789012345678901236',
  }),
  name: z.string().openapi({
    description: 'Driver name',
    example: 'Jane Smith',
  }),
});

const GroupInfoSchema = z.object({
  id: z.string().openapi({
    description: 'Group ID',
    example: 'cl123456789012345678901237',
  }),
  name: z.string().openapi({
    description: 'Group name',
    example: 'School Commute Group',
  }),
});

const TripScheduleItemSchema = z.object({
  id: z.string().openapi({
    description: 'Trip schedule ID',
    example: 'cl123456789012345678901234',
  }),
  time: z.string().openapi({
    description: 'Scheduled departure time (HH:MM format)',
    example: '08:30',
  }),
  datetime: z.string().datetime().openapi({
    description: 'Full datetime in ISO 8601 format for timezone conversion',
    example: '2024-01-15T08:30:00Z',
  }),
  date: z.string().openapi({
    description: 'Date description (e.g., "Today" or day of week)',
    example: 'Today',
  }),
  children: z.array(ChildInfoSchema).openapi({
    description: 'Children assigned to this trip',
  }),
  vehicle: VehicleInfoSchema.optional().openapi({
    description: 'Vehicle assigned to this trip',
  }),
  driver: DriverInfoSchema.optional().openapi({
    description: 'Driver assigned to this trip',
  }),
  group: GroupInfoSchema,
});

const TodayScheduleDataSchema = z.object({
  upcomingTrips: z.array(TripScheduleItemSchema).openapi({
    description: 'List of upcoming trips',
  }),
});

const ActivityItemSchema = z.object({
  id: z.string().openapi({
    description: 'Activity ID',
    example: 'act123456789012345678901234',
  }),
  type: ActivityTypeEnum,
  description: z.string().openapi({
    description: 'Activity description',
    example: 'Vehicle Toyota Sienna added to family',
  }),
  timestamp: z.string().datetime().openapi({
    description: 'When the activity occurred (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  }),
  user: z.string().openapi({
    description: 'User who performed the activity',
    example: 'Jean Dupont',
  }),
  details: z.object({
    entityId: z.string().optional().openapi({
      description: 'Related entity ID',
    }),
    entityName: z.string().optional().openapi({
      description: 'Related entity name',
    }),
  }).optional().openapi({
    description: 'Additional activity details',
  }),
});

const RecentActivityDataSchema = z.object({
  activities: z.array(ActivityItemSchema).openapi({
    description: 'List of recent activities',
  }),
});

const DaySummarySchema = z.object({
  totalTrips: z.number().openapi({
    description: 'Total number of trips',
    example: 4,
  }),
  completedTrips: z.number().openapi({
    description: 'Number of completed trips',
    example: 2,
  }),
  activeTrips: z.number().openapi({
    description: 'Number of active/in-progress trips',
    example: 1,
  }),
});

const WeeklyScheduleDaySchema = z.object({
  date: z.string().openapi({
    description: 'Date in ISO format',
    example: '2024-01-15',
  }),
  dayOfWeek: z.string().openapi({
    description: 'Day of the week name',
    example: 'Monday',
  }),
  trips: z.array(TripScheduleItemSchema).openapi({
    description: 'Trips scheduled for this day',
  }),
  summary: DaySummarySchema,
});

const WeeklyStatsSchema = z.object({
  totalTrips: z.number().openapi({
    description: 'Total trips this week',
    example: 24,
  }),
  totalChildren: z.number().openapi({
    description: 'Total children involved',
    example: 8,
  }),
  totalVehicles: z.number().openapi({
    description: 'Total vehicles used',
    example: 4,
  }),
  activeGroups: z.number().openapi({
    description: 'Number of active groups',
    example: 3,
  }),
});

const WeeklyDashboardDataSchema = z.object({
  weekStart: z.string().openapi({
    description: 'Week start date',
    example: '2024-01-15',
  }),
  weekEnd: z.string().openapi({
    description: 'Week end date',
    example: '2024-01-21',
  }),
  weeklyStats: WeeklyStatsSchema,
  dailySchedules: z.array(WeeklyScheduleDaySchema).openapi({
    description: 'Daily breakdown of the weekly schedule',
  }),
  trends: z.object({
    tripTrend: TrendDataSchema,
    efficiencyTrend: TrendDataSchema,
  }).optional().openapi({
    description: 'Weekly trend indicators',
  }),
});

/**
 * Query schemas
 */
const WeeklyDashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional().openapi({
    description: 'Optional start date for the weekly dashboard (ISO 8601 format)',
    example: '2024-01-15T00:00:00Z',
  }),
});

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Dashboard'],
  summary: 'Get dashboard statistics',
  description: 'Retrieve comprehensive dashboard statistics including counts for groups, children, vehicles, and trips.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(DashboardStatsDataSchema),
        },
      },
      description: 'Dashboard statistics retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * GET /dashboard/today-schedule - Get today's trip schedule
 */
const getTodayScheduleRoute = createRoute({
  method: 'get',
  path: '/today-schedule',
  tags: ['Dashboard'],
  summary: 'Get today\'s schedule',
  description: 'Retrieve today\'s trips and schedule including upcoming trips with vehicle and driver assignments.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(TodayScheduleDataSchema),
        },
      },
      description: 'Today\'s schedule retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * GET /dashboard/recent-activity - Get recent activity log
 */
const getRecentActivityRoute = createRoute({
  method: 'get',
  path: '/recent-activity',
  tags: ['Dashboard'],
  summary: 'Get recent activity',
  description: 'Retrieve recent activity log for the user and their family.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(RecentActivityDataSchema),
        },
      },
      description: 'Recent activity retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * GET /dashboard/weekly - Get weekly dashboard analytics
 */
const getWeeklyDashboardRoute = createRoute({
  method: 'get',
  path: '/weekly',
  tags: ['Dashboard'],
  summary: 'Get weekly dashboard',
  description: 'Retrieve complete weekly dashboard with detailed schedules and summary statistics.',
  security: [{ Bearer: [] }],
  request: {
    query: WeeklyDashboardQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(WeeklyDashboardDataSchema),
        },
      },
      description: 'Weekly dashboard retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid query parameters',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
app.openapi(getStatsRoute, async (c) => {
  const userId = c.get('userId');

  logger.info('getStats', { userId });

  try {
    const stats = await dashboardService.calculateUserStats(userId);

    logger.info('getStats: stats retrieved', { userId });

    return c.json({
      success: true,
      data: stats,
    }, 200);
  } catch (error) {
    logger.error('getStats: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve dashboard statistics',
      code: 'STATS_RETRIEVAL_FAILED',
    }, 500);
  }
});

/**
 * GET /dashboard/today-schedule - Get today's trip schedule
 */
app.openapi(getTodayScheduleRoute, async (c) => {
  const userId = c.get('userId');

  logger.info('getTodaySchedule', { userId });

  try {
    const trips = await dashboardService.getTodayTripsForUser(userId);

    // Transform trips to match expected format
    const upcomingTrips = trips.map(trip => ({
      id: trip.id,
      time: trip.time,
      datetime: trip.datetime,
      date: trip.date,
      children: trip.children,
      vehicle: trip.vehicle,
      driver: trip.driver,
      group: trip.group,
    }));

    logger.info('getTodaySchedule: schedule retrieved', {
      userId,
      count: upcomingTrips.length
    });

    return c.json({
      success: true,
      data: {
        upcomingTrips,
      },
    }, 200);
  } catch (error) {
    logger.error('getTodaySchedule: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve today\'s schedule',
      code: 'SCHEDULE_RETRIEVAL_FAILED',
    }, 500);
  }
});

/**
 * GET /dashboard/recent-activity - Get recent activity log
 */
app.openapi(getRecentActivityRoute, async (c) => {
  const userId = c.get('userId');

  logger.info('getRecentActivity', { userId });

  try {
    // Get user's family to determine whether to fetch user or family activity
    const userFamily = await dashboardService.getUserWithFamily(userId);
    const activities = userFamily?.familyMemberships?.[0]?.familyId
      ? await dashboardService.getRecentActivityForFamily(userFamily.familyMemberships[0].familyId)
      : await dashboardService.getRecentActivityForUser(userId);

    // Transform activities to match expected format
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.action,
      timestamp: activity.timestamp.toISOString(),
      user: 'Current User', // Since we're fetching for current user/family
      details: activity.entityId || activity.entityName ? {
        entityId: activity.entityId || undefined,
        entityName: activity.entityName || undefined,
      } : undefined,
    }));

    logger.info('getRecentActivity: activity retrieved', {
      userId,
      count: formattedActivities.length
    });

    return c.json({
      success: true,
      data: {
        activities: formattedActivities,
      },
    }, 200);
  } catch (error) {
    logger.error('getRecentActivity: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve recent activity',
      code: 'ACTIVITY_RETRIEVAL_FAILED',
    }, 500);
  }
});

/**
 * GET /dashboard/weekly - Get weekly dashboard analytics
 */
app.openapi(getWeeklyDashboardRoute, async (c) => {
  const userId = c.get('userId');
  const { startDate } = c.req.valid('query');

  logger.info('getWeeklyDashboard', { userId, startDate });

  try {
    // Parse startDate if provided
    const parsedStartDate = startDate ? new Date(startDate) : undefined;

    const weeklyData = await dashboardService.getWeeklyDashboard(userId, parsedStartDate);

    // Check if service returned an error response
    if (!weeklyData.success) {
      const statusCode: 400 | 401 | 500 = (weeklyData.statusCode ?? 500) as 400 | 401 | 500;
      return c.json({
        success: false,
        error: weeklyData.error || 'Failed to retrieve weekly dashboard',
        code: 'WEEKLY_DASHBOARD_FAILED',
      }, statusCode);
    }

    // Transform the weekly dashboard response to match expected format
    // The service returns a different format, so we need to adapt it
    const transformedData = {
      weekStart: weeklyData.data?.startDate || new Date().toISOString().split('T')[0],
      weekEnd: weeklyData.data?.endDate || new Date().toISOString().split('T')[0],
      weeklyStats: {
        totalTrips: 0, // Calculate from days
        totalChildren: weeklyData.data?.metadata?.totalChildren || 0,
        totalVehicles: 0, // Not available in current response
        activeGroups: weeklyData.data?.metadata?.totalGroups || 0,
      },
      dailySchedules: weeklyData.data?.days?.map((day: any) => ({
        date: day.date,
        dayOfWeek: new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }),
        trips: day.transports?.map((transport: any) => ({
          id: transport.scheduleSlotId,
          time: transport.time,
          datetime: `${day.date}T${transport.time}:00Z`,
          date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }),
          children: transport.vehicleAssignmentSummaries?.flatMap((vas: any) =>
            vas.children?.map((child: any) => ({
              id: child.childId,
              name: child.childName,
            })) || []
          ) || [],
          vehicle: transport.vehicleAssignmentSummaries?.[0] ? {
            id: transport.vehicleAssignmentSummaries[0].vehicleId,
            name: transport.vehicleAssignmentSummaries[0].vehicleName,
            capacity: transport.vehicleAssignmentSummaries[0].vehicleCapacity,
          } : undefined,
          driver: transport.vehicleAssignmentSummaries?.[0]?.driver ? {
            id: transport.vehicleAssignmentSummaries[0].driver.id,
            name: transport.vehicleAssignmentSummaries[0].driver.name,
          } : undefined,
          group: {
            id: transport.groupId,
            name: transport.groupName,
          },
        })) || [],
        summary: {
          totalTrips: day.transports?.length || 0,
          completedTrips: 0, // Not tracked in current implementation
          activeTrips: 0, // Not tracked in current implementation
        },
      })) || [],
      trends: undefined, // Not available in current response format
    };

    // Calculate total trips from daily schedules
    transformedData.weeklyStats.totalTrips = transformedData.dailySchedules.reduce(
      (sum, day) => sum + day.summary.totalTrips,
      0
    );

    logger.info('getWeeklyDashboard: weekly data retrieved', {
      userId,
      weekStart: transformedData.weekStart,
      totalTrips: transformedData.weeklyStats.totalTrips
    });

    return c.json({
      success: true,
      data: transformedData,
    }, 200);
  } catch (error) {
    logger.error('getWeeklyDashboard: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve weekly dashboard',
      code: 'WEEKLY_DASHBOARD_FAILED',
    }, 500);
  }
});

export default app;
