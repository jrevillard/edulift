/**
 * Dashboard Schemas with OpenAPI Extensions
 *
 * Zod schemas for dashboard endpoints with OpenAPI documentation
 * Phase 7: Dashboard domain migration following Auth/Children/Vehicles/Groups/Families template pattern
 * 100% OpenAPI Compliance - Perfect Pattern Implementation
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const TrendDirectionEnum = z.enum(['up', 'down', 'neutral']).openapi({
  description: 'Direction of a trend indicator',
  example: 'up',
});

export const ActivityTypeEnum = z.enum(['group', 'vehicle', 'child', 'schedule']).openapi({
  description: 'Type of activity in the dashboard',
  example: 'group',
});

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

export const WeeklyDashboardQuerySchema = z.object({
  startDate: z.iso.datetime()
    .optional()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Optional start date for the weekly dashboard (ISO 8601 format)',
    }),
}).openapi({
  title: 'Weekly Dashboard Query Parameters',
  description: 'Query parameters for weekly dashboard endpoint',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const TrendDataSchema = z.object({
  value: z.string()
    .openapi({
      example: 'Active',
      description: 'Trend value',
    }),
  direction: TrendDirectionEnum.openapi({
    example: 'neutral',
    description: 'Trend direction',
  }),
  period: z.string()
    .openapi({
      example: 'current',
      description: 'Time period for the trend',
    }),
}).openapi({
  title: 'Trend Data',
  description: 'Trend information for dashboard statistics',
});

export const DashboardStatsSchema = z.object({
  groups: z.number()
    .int()
    .min(0)
    .openapi({
      example: 3,
      description: 'Number of groups the user belongs to',
    }),
  children: z.number()
    .int()
    .min(0)
    .openapi({
      example: 2,
      description: 'Number of children in the family',
    }),
  vehicles: z.number()
    .int()
    .min(0)
    .openapi({
      example: 1,
      description: 'Number of vehicles in the family',
    }),
  thisWeekTrips: z.number()
    .int()
    .min(0)
    .openapi({
      example: 5,
      description: 'Number of trips scheduled for this week',
    }),
  trends: z.object({
    groups: TrendDataSchema.openapi({
      description: 'Groups trend information',
    }),
    children: TrendDataSchema.openapi({
      description: 'Children trend information',
    }),
    vehicles: TrendDataSchema.openapi({
      description: 'Vehicles trend information',
    }),
    trips: TrendDataSchema.openapi({
      description: 'Trips trend information',
    }),
  }).openapi({
    description: 'Trend data for various statistics',
  }),
}).openapi({
  title: 'Dashboard Statistics',
  description: 'Dashboard statistics including counts and trends',
});

export const TripChildSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Child identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Emma Johnson',
      description: 'Child name',
    }),
}).openapi({
  title: 'Trip Child',
  description: 'Child information in trip context',
});

export const TripVehicleSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Vehicle identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Toyota Sienna',
      description: 'Vehicle name',
    }),
  capacity: z.number()
    .int()
    .min(1)
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
}).openapi({
  title: 'Trip Vehicle',
  description: 'Vehicle information in trip context',
});

export const TripDriverSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Driver identifier',
    }),
  name: z.string()
    .openapi({
      example: 'John Smith',
      description: 'Driver name',
    }),
}).openapi({
  title: 'Trip Driver',
  description: 'Driver information in trip context',
});

export const TripGroupSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901241',
      description: 'Group identifier',
    }),
  name: z.string()
    .openapi({
      example: 'School Carpool Group A',
      description: 'Group name',
    }),
}).openapi({
  title: 'Trip Group',
  description: 'Group information in trip context',
});

export const TodayTripSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901242',
      description: 'Trip identifier',
    }),
  time: z.string()
    .openapi({
      example: '08:30',
      description: 'Trip time in HH:MM format (UTC)',
    }),
  datetime: z.iso.datetime()
    .openapi({
      example: '2023-01-01T08:30:00.000Z',
      description: 'Full trip datetime in ISO 8601 format for timezone conversion',
    }),
  date: z.string()
    .openapi({
      example: 'Today',
      description: 'Trip date display name',
    }),
  children: z.array(TripChildSchema).openapi({
    description: 'Children assigned to this trip',
  }),
  vehicle: TripVehicleSchema.nullable().optional().openapi({
    description: 'Vehicle assigned to this trip',
  }),
  driver: TripDriverSchema.nullable().optional().openapi({
    description: 'Driver assigned to this trip',
  }),
  group: TripGroupSchema.openapi({
    description: 'Group associated with this trip',
  }),
}).openapi({
  title: 'Today Trip',
  description: 'Trip information for today\'s schedule',
});

export const TodayScheduleResponseSchema = z.object({
  upcomingTrips: z.array(TodayTripSchema).openapi({
    description: 'List of upcoming trips for today',
  }),
}).openapi({
  title: 'Today Schedule Response',
  description: 'Today\'s schedule with upcoming trips',
});

export const ActivityItemSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901243',
      description: 'Activity identifier',
    }),
  action: z.string()
    .openapi({
      example: 'Added child Emma to family',
      description: 'Activity description',
    }),
  time: z.string()
    .openapi({
      example: '2 hours ago',
      description: 'Human-readable time since activity',
    }),
  timestamp: z.iso.datetime()
    .openapi({
      example: '2023-01-01T12:00:00.000Z',
      description: 'Activity timestamp in ISO 8601 format',
    }),
  type: ActivityTypeEnum.openapi({
    example: 'child',
    description: 'Type of activity',
  }),
  entityId: z.cuid()
    .nullable()
    .optional()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Related entity identifier',
    }),
  entityName: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'Emma Johnson',
      description: 'Related entity name',
    }),
}).openapi({
  title: 'Activity Item',
  description: 'Activity log item for dashboard display',
});

export const RecentActivityResponseSchema = z.object({
  activities: z.array(ActivityItemSchema).openapi({
    description: 'List of recent activities',
  }),
}).openapi({
  title: 'Recent Activity Response',
  description: 'Recent activity log for dashboard',
});

export const WeeklyDashboardResponseSchema = z.object({
  success: z.literal(true)
    .openapi({
      description: 'Operation success indicator',
    }),
  data: z.object({
    weekStart: z.iso.datetime()
      .openapi({
        example: '2023-01-01T00:00:00.000Z',
        description: 'Week start date in ISO 8601 format',
      }),
    weekEnd: z.iso.datetime()
      .openapi({
        example: '2023-01-07T23:59:59.999Z',
        description: 'Week end date in ISO 8601 format',
      }),
    days: z.array(z.object({
      date: z.string()
        .openapi({
          example: '2023-01-01',
          description: 'Date in YYYY-MM-DD format',
        }),
      dayName: z.string()
        .openapi({
          example: 'Sunday',
          description: 'Day name',
        }),
      transportSlots: z.array(z.object({
        id: z.cuid(),
        time: z.string(),
        groupId: z.cuid().nullable(),
        groupName: z.string(),
        vehicleId: z.cuid().nullable(),
        vehicleName: z.string().nullable(),
        driverId: z.cuid().nullable(),
        driverName: z.string().nullable(),
        children: z.array(z.object({
          id: z.cuid(),
          name: z.string(),
          familyId: z.cuid(),
          familyName: z.string(),
        })),
        capacity: z.number().int().min(0),
        capacityStatus: z.enum(['AVAILABLE', 'FULL', 'OVERFLOW']),
        isMorning: z.boolean(),
      })),
      hasTransport: z.boolean(),
    })).openapi({
      description: 'Array of days in the week with their transport schedules',
    }),
    summary: z.object({
      totalDays: z.number().int().min(0),
      daysWithTransport: z.number().int().min(0),
      totalTransportSlots: z.number().int().min(0),
      childrenWithTransport: z.number().int().min(0),
      uniqueVehicles: z.number().int().min(0),
      uniqueDrivers: z.number().int().min(0),
      coveragePercentage: z.number().min(0).max(100),
    }),
  }).openapi({
    description: 'Weekly dashboard data including schedules and summary',
  }),
}).openapi({
  title: 'Weekly Dashboard Response',
  description: 'Complete weekly dashboard with schedules and summary statistics',
});

// ============================================================================
// SCHEMA REGISTRATION
// ============================================================================

// Register query parameter schemas

// Register response schemas
registry.register('WeeklyDashboardResponse', WeeklyDashboardResponseSchema);

// ============================================================================
// API PATHS REGISTRATION
// ============================================================================

// All dashboard routes require authentication
registerPath({
  method: 'get',
  path: '/dashboard/stats',
  tags: ['Dashboard'],
  summary: 'Get dashboard statistics',
  description: 'Retrieve user dashboard statistics including counts and trends',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard statistics retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: DashboardStatsSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registerPath({
  method: 'get',
  path: '/dashboard/today-schedule',
  tags: ['Dashboard'],
  summary: 'Get today\'s schedule',
  description: 'Retrieve today\'s trips and schedule for the authenticated user',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Today\'s schedule retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TodayScheduleResponseSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registerPath({
  method: 'get',
  path: '/dashboard/weekly',
  tags: ['Dashboard'],
  summary: 'Get weekly dashboard',
  description: 'Retrieve complete weekly dashboard with schedules and summary statistics',
  security: [{ BearerAuth: [] }],
  request: {
    query: WeeklyDashboardQuerySchema,
  },
  responses: {
    200: {
      description: 'Weekly dashboard retrieved successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/WeeklyDashboardResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Invalid date format',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required or no family associated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registerPath({
  method: 'get',
  path: '/dashboard/recent-activity',
  tags: ['Dashboard'],
  summary: 'Get recent activity',
  description: 'Retrieve recent activity log for the user and their family',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Recent activity retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: RecentActivityResponseSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});