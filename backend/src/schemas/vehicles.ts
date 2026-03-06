/**
 * Hono Native OpenAPI Schemas for Vehicles
 *
 * Zod schemas with native Hono OpenAPI extensions
 * Compatible with @hono/zod-openapi createRoute()
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Request Schemas with Hono OpenAPI
export const CreateVehicleSchema = z.object({
  name: z.string()
    .min(1, 'Vehicle name is required')
    .max(100, 'Vehicle name too long')
    .openapi({
      example: 'Family Minivan',
      description: 'Vehicle name',
    }),
  capacity: z.number()
    .int()
    .min(VEHICLE_CONSTRAINTS.MIN_CAPACITY, `Vehicle must have at least ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} seat`)
    .max(VEHICLE_CONSTRAINTS.MAX_CAPACITY, `Vehicle cannot have more than ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats`)
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
}).openapi({
  description: 'Create vehicle request',
});

export const UpdateVehicleSchema = z.object({
  name: z.string()
    .min(1, 'Vehicle name is required')
    .max(100, 'Vehicle name too long')
    .optional()
    .openapi({
      example: 'Updated Family Minivan',
      description: 'Updated vehicle name',
    }),
  capacity: z.number()
    .int()
    .min(VEHICLE_CONSTRAINTS.MIN_CAPACITY, `Vehicle must have at least ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} seat`)
    .max(VEHICLE_CONSTRAINTS.MAX_CAPACITY, `Vehicle cannot have more than ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats`)
    .optional()
    .openapi({
      example: 8,
      description: 'Updated vehicle seating capacity',
    }),
}).refine(
  (data) => data.name !== undefined || data.capacity !== undefined,
  { message: 'At least one field (name or capacity) must be provided' },
).openapi({
  description: 'Update vehicle request',
});

export const VehicleParamsSchema = z.object({
  vehicleId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle ID',
    }),
}).openapi({
  description: 'Vehicle path parameters',
});

export const AvailableVehiclesParamsSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group ID',
    }),
  timeSlotId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Time slot ID',
    }),
}).openapi({
  description: 'Available vehicles path parameters',
});

// Response Schemas
export const VehicleResponseSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle unique identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Family Minivan',
      description: 'Vehicle name',
    }),
  capacity: z.number().int()
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family ID that owns the vehicle',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'Vehicle creation timestamp',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'Vehicle last update timestamp',
    }),
}).openapi({
  description: 'Vehicle response data',
});

export const AvailableVehicleSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle unique identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Family Minivan',
      description: 'Vehicle name',
    }),
  capacity: z.number().int()
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
  currentAssignments: z.number().int()
    .openapi({
      example: 3,
      description: 'Number of currently assigned children',
    }),
  availableSeats: z.number().int()
    .openapi({
      example: 4,
      description: 'Number of available seats remaining',
    }),
  driverName: z.string().nullable().optional()
    .openapi({
      example: 'John Doe',
      description: 'Name of the assigned driver (if any)',
    }),
}).openapi({
  description: 'Available vehicle for schedule assignment',
});

export const VehicleScheduleSchema = z.object({
  vehicleId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle unique identifier',
    }),
  vehicleName: z.string()
    .openapi({
      example: 'Family Minivan',
      description: 'Vehicle name',
    }),
  schedule: z.array(z.object({
    date: z.iso.date()
      .openapi({
        example: '2024-01-15',
        description: 'Schedule date',
      }),
    timeSlot: z.object({
      id: z.cuid()
        .openapi({
          example: 'cl123456789012345678901234',
          description: 'Time slot ID',
        }),
      name: z.string()
        .openapi({
          example: 'Morning School Run',
          description: 'Time slot name',
        }),
      startTime: z.string()
        .openapi({
          example: '08:00',
          description: 'Time slot start time',
        }),
      endTime: z.string()
        .openapi({
          example: '08:30',
          description: 'Time slot end time',
        }),
    }),
    group: z.object({
      id: z.cuid()
        .openapi({
          example: 'cl123456789012345678901234',
          description: 'Group ID',
        }),
      name: z.string()
        .openapi({
          example: 'School District A',
          description: 'Group name',
        }),
    }),
    assignedChildren: z.number().int()
      .openapi({
        example: 5,
        description: 'Number of assigned children',
      }),
    isDriver: z.boolean()
      .openapi({
        example: true,
        description: 'Whether this vehicle is driving for this slot',
      }),
  }))
    .openapi({
      description: 'Vehicle schedule entries',
    }),
}).openapi({
  description: 'Vehicle schedule information',
});

export const WeekQuerySchema = z.object({
  week: z.string().optional()
    .openapi({
      example: '2024-W03',
      description: 'Week number in ISO format (YYYY-Wnn)',
    }),
}).openapi({
  description: 'Week query parameter for schedule filtering',
});