/**
 * Vehicles Schemas with OpenAPI Extensions
 *
 * Zod schemas for vehicles management endpoints with OpenAPI documentation
 * Phase 4: Vehicles domain migration following Auth/Children template pattern
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, BearerAuthSecurity, registerPath } from '../config/openapi.js';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle.js';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Request Schemas
export const CreateVehicleSchema = z.object({
  name: z.string()
    .min(1, 'Vehicle name is required')
    .max(100, 'Vehicle name too long')
    .openapi({
      example: 'Honda Odyssey',
      description: 'Vehicle name or model',
    }),
  capacity: z.number()
    .int()
    .min(VEHICLE_CONSTRAINTS.MIN_CAPACITY, `Vehicle must have at least ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} seat`)
    .max(VEHICLE_CONSTRAINTS.MAX_CAPACITY, `Vehicle cannot have more than ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats`)
    .openapi({
      example: 7,
      description: `Vehicle seating capacity (${VEHICLE_CONSTRAINTS.MIN_CAPACITY}-${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats)`,
    }),
}).openapi({
  title: 'Create Vehicle',
  description: 'Create a new vehicle record in the family',
});

export const UpdateVehicleSchema = z.object({
  name: z.string()
    .min(1, 'Vehicle name is required')
    .max(100, 'Vehicle name too long')
    .optional()
    .openapi({
      example: 'Toyota Sienna',
      description: 'Updated vehicle name or model',
    }),
  capacity: z.number()
    .int()
    .min(VEHICLE_CONSTRAINTS.MIN_CAPACITY, `Vehicle must have at least ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} seat`)
    .max(VEHICLE_CONSTRAINTS.MAX_CAPACITY, `Vehicle cannot have more than ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats`)
    .optional()
    .openapi({
      example: 8,
      description: `Updated vehicle seating capacity (${VEHICLE_CONSTRAINTS.MIN_CAPACITY}-${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats)`,
    }),
}).refine(
  (data) => data.name !== undefined || data.capacity !== undefined,
  { message: 'At least one field (name or capacity) must be provided' },
).openapi({
  title: 'Update Vehicle',
  description: 'Update vehicle information',
});

export const VehicleParamsSchema = z.object({
  vehicleId: z.string()
    .cuid('Invalid vehicle ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique vehicle identifier (CUID format)',
    }),
}).openapi({
  title: 'Vehicle Parameters',
  description: 'URL parameters for vehicle-specific endpoints',
});

export const AvailableVehiclesParamsSchema = z.object({
  groupId: z.string()
    .cuid('Invalid group ID format')
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique group identifier (CUID format)',
    }),
  timeSlotId: z.string()
    .cuid('Invalid time slot ID format')
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique time slot identifier (CUID format)',
    }),
}).openapi({
  title: 'Available Vehicles Parameters',
  description: 'URL parameters for finding available vehicles',
});

export const WeekQuerySchema = z.object({
  week: z.string()
    .optional()
    .openapi({
      example: '2023-W15',
      description: 'Week in ISO format (YYYY-W##) for filtering vehicle schedule',
    }),
}).openapi({
  title: 'Week Query Parameters',
  description: 'Query parameters for week-based filtering',
});

// Response Schemas
export const VehicleResponseSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique vehicle identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Honda Odyssey',
      description: 'Vehicle name or model',
    }),
  capacity: z.number()
    .int()
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Family identifier that owns the vehicle',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Vehicle creation timestamp',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Last update timestamp',
    }),
}).openapi({
  title: 'Vehicle Response',
  description: 'Complete vehicle information',
});

export const AvailableVehicleSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique vehicle identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Honda Odyssey',
      description: 'Vehicle name or model',
    }),
  capacity: z.number()
    .int()
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
  currentAssignments: z.number()
    .int()
    .openapi({
      example: 3,
      description: 'Number of children currently assigned to this vehicle for the time slot',
    }),
  availableSeats: z.number()
    .int()
    .openapi({
      example: 4,
      description: 'Number of available seats remaining',
    }),
  driverName: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'John Doe',
      description: 'Name of the assigned driver (if any)',
    }),
}).openapi({
  title: 'Available Vehicle',
  description: 'Vehicle information for availability checking with current assignment status',
});

export const VehicleScheduleSchema = z.object({
  vehicleId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle identifier',
    }),
  vehicleName: z.string()
    .openapi({
      example: 'Honda Odyssey',
      description: 'Vehicle name',
    }),
  schedule: z.array(z.object({
    date: z.string()
      .date()
      .openapi({
        example: '2023-04-15',
        description: 'Date of the scheduled assignment',
      }),
    timeSlot: z.object({
      id: z.string().cuid(),
      name: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    }).openapi({
      description: 'Time slot information',
    }),
    group: z.object({
      id: z.string().cuid(),
      name: z.string(),
    }).openapi({
      description: 'Group information',
    }),
    assignedChildren: z.number()
      .int()
      .openapi({
        example: 3,
        description: 'Number of children assigned to this vehicle for this slot',
      }),
    isDriver: z.boolean()
      .openapi({
        example: true,
        description: 'Whether the current user is driving for this assignment',
      }),
  })).openapi({
    description: 'Vehicle schedule assignments',
  }),
}).openapi({
  title: 'Vehicle Schedule',
  description: 'Vehicle schedule with trip assignments and driver information',
});

export const VehicleAssignmentSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Unique assignment identifier (CUID format)',
    }),
  vehicleId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Vehicle identifier',
    }),
  timeSlotId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Time slot identifier',
    }),
  date: z.string()
    .date()
    .openapi({
      example: '2023-04-15',
      description: 'Date of the assignment',
    }),
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier',
    }),
  assignedSeats: z.number()
    .int()
    .openapi({
      example: 3,
      description: 'Number of seats assigned for this trip',
    }),
  driverId: z.string()
    .cuid()
    .nullable()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Driver user identifier (null if no driver assigned)',
    }),
}).openapi({
  title: 'Vehicle Assignment',
  description: 'Vehicle trip assignment information',
});

// Register schemas with OpenAPI registry
registry.register('CreateVehicleRequest', CreateVehicleSchema);
registry.register('UpdateVehicleRequest', UpdateVehicleSchema);

// Register API paths following Auth/Children pattern
registerPath({
  method: 'post',
  path: '/vehicles',
  tags: ['Vehicles'],
  summary: 'Create a new vehicle',
  description: 'Add a new vehicle to the authenticated user family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateVehicleRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Vehicle created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: VehicleResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or capacity constraints',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions or no family',
    },
  },
});

registerPath({
  method: 'get',
  path: '/vehicles',
  tags: ['Vehicles'],
  summary: 'Get user vehicles',
  description: 'Retrieve all vehicles belonging to the authenticated user family',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Vehicles retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(VehicleResponseSchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - No family found',
    },
  },
});

registerPath({
  method: 'get',
  path: '/vehicles/available/{groupId}/{timeSlotId}',
  tags: ['Vehicles'],
  summary: 'Get available vehicles',
  description: 'Retrieve available vehicles for a specific group and time slot combination',
  security: [{ BearerAuth: [] }],
  request: {
    params: AvailableVehiclesParamsSchema,
  },
  responses: {
    200: {
      description: 'Available vehicles retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(AvailableVehicleSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group or time slot ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions for group',
    },
    404: {
      description: 'Not found - Group or time slot does not exist',
    },
  },
});

registerPath({
  method: 'get',
  path: '/vehicles/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Get specific vehicle',
  description: 'Retrieve detailed information about a specific vehicle by ID',
  security: [{ BearerAuth: [] }],
  request: {
    params: VehicleParamsSchema,
  },
  responses: {
    200: {
      description: 'Vehicle retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: VehicleResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid vehicle ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Vehicle not accessible',
    },
    404: {
      description: 'Not found - Vehicle does not exist',
    },
  },
});

registerPath({
  method: 'patch',
  path: '/vehicles/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Update vehicle',
  description: 'Partially update vehicle information. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: VehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateVehicleRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Vehicle updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: VehicleResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data, capacity constraints, or capacity reduction conflicts',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Vehicle does not exist',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/vehicles/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Delete vehicle',
  description: 'Remove a vehicle from the family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: VehicleParamsSchema,
  },
  responses: {
    200: {
      description: 'Vehicle deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              success: z.literal(true),
              message: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid vehicle ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Vehicle does not exist',
    },
  },
});

registerPath({
  method: 'get',
  path: '/vehicles/{vehicleId}/schedule',
  tags: ['Vehicles'],
  summary: 'Get vehicle schedule',
  description: 'Retrieve schedule information for a specific vehicle, optionally filtered by week',
  security: [{ BearerAuth: [] }],
  request: {
    params: VehicleParamsSchema,
    query: WeekQuerySchema,
  },
  responses: {
    200: {
      description: 'Vehicle schedule retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: VehicleScheduleSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid vehicle ID or week format',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Vehicle not accessible',
    },
    404: {
      description: 'Not found - Vehicle does not exist',
    },
  },
});

