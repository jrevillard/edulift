/**
 * Schedule Slots Schemas with OpenAPI Extensions
 *
 * Zod schemas for schedule slots management endpoints with OpenAPI documentation
 * Phase 9: ScheduleSlots domain migration - FINAL DOMAIN for 100% coverage
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/registry';
import { BaseVehicleSchema } from './_common';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

export const ScheduleSlotParamsSchema = z.object({
  scheduleSlotId: z.cuid('Invalid schedule slot ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique schedule slot identifier (CUID format)',
    }),
}).openapi({
  title: 'Schedule Slot Parameters',
  description: 'URL parameters for schedule slot-specific endpoints',
});

export const GroupParamsSchema = z.object({
  groupId: z.cuid('Invalid group ID format')
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique group identifier (CUID format)',
    }),
}).openapi({
  title: 'Group Parameters',
  description: 'URL parameters for group-specific endpoints',
});

export const VehicleAssignmentParamsSchema = z.object({
  vehicleAssignmentId: z.cuid('Invalid vehicle assignment ID format')
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique vehicle assignment identifier (CUID format)',
    }),
}).openapi({
  title: 'Vehicle Assignment Parameters',
  description: 'URL parameters for vehicle assignment-specific endpoints',
});

export const ScheduleSlotVehicleParamsSchema = z.object({
  scheduleSlotId: z.cuid('Invalid schedule slot ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique schedule slot identifier (CUID format)',
    }),
  vehicleId: z.cuid('Invalid vehicle ID format')
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Unique vehicle identifier (CUID format)',
    }),
}).openapi({
  title: 'Schedule Slot Vehicle Parameters',
  description: 'URL parameters for schedule slot vehicle-specific endpoints',
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const DateRangeQuerySchema = z.object({
  startDate: z.iso.datetime('Start date must be a valid ISO 8601 datetime string')
    .optional()
    .openapi({
      example: '2023-12-01T00:00:00.000Z',
      description: 'Start date for schedule filtering (ISO 8601 format)',
    }),
  endDate: z.iso.datetime('End date must be a valid ISO 8601 datetime string')
    .optional()
    .openapi({
      example: '2023-12-31T23:59:59.999Z',
      description: 'End date for schedule filtering (ISO 8601 format)',
    }),
}).openapi({
  title: 'Date Range Query Parameters',
  description: 'Query parameters for filtering by date range',
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateScheduleSlotWithVehicleSchema = z.object({
  datetime: z.iso.datetime('DateTime must be a valid ISO 8601 UTC datetime string')
    .openapi({
      example: '2023-12-15T08:00:00.000Z',
      description: 'Schedule slot datetime (ISO 8601 UTC format)',
    }),
  vehicleId: z.cuid('Invalid vehicle ID format')
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Vehicle identifier for assignment',
    }),
  driverId: z.cuid('Invalid driver ID format')
    .nullable()
    .optional()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Optional driver identifier',
    }),
  seatOverride: z.number()
    .int('Seat override must be an integer')
    .min(0, 'Seat override cannot be negative')
    .max(10, 'Seat override cannot exceed maximum capacity')
    .optional()
    .openapi({
      example: 6,
      description: 'Optional seat capacity override for this assignment',
    }),
}).openapi({
  title: 'Create Schedule Slot with Vehicle',
  description: 'Create a new schedule slot with vehicle assignment',
});

export const AssignVehicleSchema = z.object({
  vehicleId: z.cuid('Invalid vehicle ID format')
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Vehicle identifier to assign',
    }),
  driverId: z.cuid('Invalid driver ID format')
    .optional()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Optional driver identifier for the assignment',
    }),
  seatOverride: z.number()
    .int('Seat override must be an integer')
    .min(0, 'Seat override cannot be negative')
    .max(10, 'Seat override cannot exceed maximum capacity')
    .optional()
    .openapi({
      example: 6,
      description: 'Optional seat capacity override for this assignment',
    }),
  childIds: z.array(z.cuid('Invalid child ID format'))
    .optional()
    .openapi({
      example: ['cl123456789012345678901238', 'cl123456789012345678901239'],
      description: 'Optional list of child IDs to assign initially (can add more later with PATCH)',
    }),
}).openapi({
  title: 'Assign Vehicle to Schedule Slot',
  description: 'Assign a vehicle to an existing schedule slot, optionally with initial children',
});

export const PatchVehicleAssignmentSchema = z.object({
  driverId: z.cuid('Invalid driver ID format')
    .optional()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Optional new driver identifier to replace current driver',
    }),
  seatOverride: z.number()
    .int('Seat override must be an integer')
    .min(0, 'Seat override cannot be negative')
    .max(10, 'Seat override cannot exceed maximum capacity')
    .optional()
    .openapi({
      example: 6,
      description: 'Optional new seat capacity override for this assignment',
    }),
  addChildIds: z.array(z.cuid('Invalid child ID format'))
    .optional()
    .openapi({
      example: ['cl123456789012345678901238', 'cl123456789012345678901239'],
      description: 'Optional list of child IDs to add to this vehicle assignment',
    }),
  removeChildIds: z.array(z.cuid('Invalid child ID format'))
    .optional()
    .openapi({
      example: ['cl123456789012345678901240'],
      description: 'Optional list of child IDs to remove from this vehicle assignment',
    }),
}).openapi({
  title: 'Update Vehicle Assignment',
  description: 'Update driver, seat capacity, or add/remove children in an existing vehicle assignment. All fields are optional - only provided fields will be updated.',
});
export const UpdateDriverSchema = z.object({
  driverId: z.cuid('Invalid driver ID format')
    .nullable()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'New driver identifier (null to remove driver)',
    }),
}).openapi({
  title: 'Update Vehicle Driver',
  description: 'Update or remove driver for a vehicle assignment',
});

export const VehicleIdSchema = z.object({
  vehicleId: z.cuid('Invalid vehicle ID format')
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Vehicle identifier to remove',
    }),
}).openapi({
  title: 'Vehicle ID for Removal',
  description: 'Vehicle identifier for removal from schedule slot',
});

export const UpdateSeatOverrideSchema = z.object({
  seatOverride: z.number()
    .int('Seat override must be an integer')
    .min(0, 'Seat override cannot be negative')
    .max(10, 'Seat override cannot exceed maximum capacity')
    .optional()
    .openapi({
      example: 6,
      description: 'New seat capacity override',
    }),
}).openapi({
  title: 'Update Seat Override',
  description: 'Update seat capacity override for vehicle assignment',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Vehicle Assignment Schema that matches actual database structure
export const ScheduleVehicleAssignmentSchema = z.object({
  id: z.string()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Vehicle assignment identifier',
    }),
  vehicleId: z.string()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Vehicle identifier',
    }),
  scheduleSlotId: z.string()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Schedule slot identifier',
    }),
  driverId: z.string()
    .nullable()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Driver identifier (null if no driver assigned)',
    }),
  seatOverride: z.number()
    .nullable()
    .openapi({
      example: 6,
      description: 'Seat capacity override (null if using vehicle default)',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-12-01T08:00:00.000Z',
      description: 'When the vehicle was assigned to this slot',
    }),
  vehicle: BaseVehicleSchema.optional()
    .openapi({
      description: 'Vehicle details (included when requested)',
    }),
  driver: z.object({
    id: z.string()
      .openapi({
        example: 'cl123456789012345678901239',
        description: 'Driver user identifier',
      }),
    name: z.string()
      .openapi({
        example: 'John Doe',
        description: 'Driver name',
      }),
    email: z.string()
      .email('Invalid email format')
      .optional()
      .openapi({
        example: 'john.doe@example.com',
        description: 'Driver email (when included)',
      }),
  }).nullable()
    .optional()
    .openapi({
      description: 'Driver details (included when requested, null if no driver)',
    }),
  childAssignments: z.array(
    z.object({
      id: z.string()
        .openapi({
          example: 'clslot123_child456',
          description: 'Child assignment identifier',
        }),
      childId: z.string()
        .openapi({
          example: 'cl123456789012345678901238',
          description: 'Child identifier',
        }),
      vehicleAssignmentId: z.string()
        .openapi({
          example: 'cl123456789012345678901236',
          description: 'Vehicle assignment identifier',
        }),
      child: z.object({
        id: z.cuid()
          .openapi({
            example: 'cl123456789012345678901238',
            description: 'Child identifier',
          }),
        name: z.string()
          .openapi({
            example: 'Emma Johnson',
            description: 'Child name',
          }),
        age: z.number()
          .nullable()
          .openapi({
            example: 8,
            description: 'Child age (null if not specified)',
          }),
        familyId: z.cuid()
          .openapi({
            example: 'cl123456789012345678901233',
            description: 'Family identifier',
          }),
        createdAt: z.iso.datetime()
          .openapi({
            example: '2023-01-01T00:00:00.000Z',
            description: 'When the child was created',
          }),
        updatedAt: z.iso.datetime()
          .openapi({
            example: '2023-01-15T10:30:00.000Z',
            description: 'When the child was last updated',
          }),
      }).optional()
        .openapi({
          description: 'Child details (included when requested)',
        }),
    }),
  ).optional()
  .openapi({
    description: 'All child assignments for this vehicle (cross-family carpooling support)',
  }),
}).openapi({
  title: 'Schedule Vehicle Assignment',
  description: 'Vehicle assignment for schedule slot (matches Prisma database schema)',
});

export const ChildAssignmentSchema = z.object({
  id: z.string()
    .openapi({
      example: 'clslot123_child456',
      description: 'Child assignment identifier (composite key: scheduleSlotId_childId)',
    }),
  scheduleSlotId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Schedule slot identifier',
    }),
  childId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Child identifier',
    }),
  vehicleAssignmentId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Vehicle assignment identifier',
    }),
  assignedAt: z.iso.datetime()
    .openapi({
      example: '2023-12-01T08:00:00.000Z',
      description: 'Assignment timestamp',
    }),
  child: z.object({
    id: z.cuid(),
    name: z.string(),
    age: z.number().nullable(),
    familyId: z.cuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }).optional()
    .openapi({
      description: 'Child information (included when requested)',
    }),
  vehicleAssignment: ScheduleVehicleAssignmentSchema.optional()
    .openapi({
      description: 'Vehicle assignment information (included when requested)',
    }),
}).openapi({
  title: 'Child Assignment',
  description: 'Child assignment information for a schedule slot',
});

export const ScheduleSlotSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Schedule slot identifier',
    }),
  datetime: z.iso.datetime()
    .openapi({
      example: '2023-12-15T08:00:00.000Z',
      description: 'Schedule slot datetime (ISO 8601 UTC string)',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-12-01T08:00:00.000Z',
      description: 'Schedule slot creation timestamp',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2023-12-01T08:00:00.000Z',
      description: 'Schedule slot update timestamp',
    }),
  vehicleAssignments: z.array(ScheduleVehicleAssignmentSchema).optional()
    .openapi({
      description: 'Vehicle assignments (included when requested)',
    }),
  childAssignments: z.array(ChildAssignmentSchema).optional()
    .openapi({
      description: 'Child assignments (included when requested)',
    }),
  _count: z.object({
    vehicleAssignments: z.number()
      .openapi({
        example: 2,
        description: 'Number of vehicle assignments',
      }),
    childAssignments: z.number()
      .openapi({
        example: 8,
        description: 'Number of child assignments',
      }),
  }).optional()
    .openapi({
      description: 'Count information (included when requested)',
    }),
}).openapi({
  title: 'Schedule Slot',
  description: 'Schedule slot information',
});

export const AvailableChildSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Child identifier',
    }),
  firstName: z.string()
    .openapi({
      example: 'Emma',
      description: 'Child first name',
    }),
  lastName: z.string()
    .openapi({
      example: 'Johnson',
      description: 'Child last name',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901241',
      description: 'Family identifier',
    }),
  familyName: z.string()
    .openapi({
      example: 'Johnson Family',
      description: 'Family name',
    }),
  canAssign: z.boolean()
    .openapi({
      example: true,
      description: 'Whether this child can be assigned to the slot',
    }),
  conflictReason: z.string()
    .optional()
    .openapi({
      example: 'Already assigned to another slot at this time',
      description: 'Reason why child cannot be assigned (if applicable)',
    }),
}).openapi({
  title: 'Available Child',
  description: 'Available child for schedule slot assignment',
});


export const ScheduleResponseSchema = z.object({
  groupId: z.cuid().openapi({
    description: 'Group identifier',
  }),
  startDate: z.string().openapi({
    example: '2023-12-01T00:00:00.000Z',
    description: 'Start date of the schedule range',
  }),
  endDate: z.string().openapi({
    example: '2023-12-31T23:59:59.999Z',
    description: 'End date of the schedule range',
  }),
  scheduleSlots: z.array(ScheduleSlotSchema).openapi({
    description: 'Schedule slots within the date range',
  }),
}).openapi({
  title: 'Schedule Response',
  description: 'Group schedule information with date range and slots',
});

// ============================================================================
// REGISTRY - SCHEMA REGISTRATION
// ============================================================================

// Request schemas
registry.register('CreateScheduleSlotWithVehicleSchema', CreateScheduleSlotWithVehicleSchema);
registry.register('AssignVehicleRequest', AssignVehicleSchema);
registry.register('PatchVehicleAssignmentRequest', PatchVehicleAssignmentSchema);
registry.register('UpdateDriverRequest', UpdateDriverSchema);
registry.register('VehicleIdRequest', VehicleIdSchema);
registry.register('UpdateSeatOverrideRequest', UpdateSeatOverrideSchema);

// Parameter schemas
registry.register('ScheduleSlotParams', ScheduleSlotParamsSchema);
// GroupParams is registered in groups.ts
registry.register('VehicleAssignmentParams', VehicleAssignmentParamsSchema);
registry.register('ScheduleSlotVehicleParams', ScheduleSlotVehicleParamsSchema);

// Query schemas
registry.register('DateRangeQuery', DateRangeQuerySchema);

// Response schemas
registry.register('ScheduleVehicleAssignment', ScheduleVehicleAssignmentSchema);
registry.register('ChildAssignment', ChildAssignmentSchema);
registry.register('ScheduleSlot', ScheduleSlotSchema);
registry.register('AvailableChild', AvailableChildSchema);
registry.register('ScheduleResponse', ScheduleResponseSchema);
// VehicleAssignmentSchema is registered in _common.ts

// ============================================================================
// REGISTRY - API PATHS REGISTRATION
// ============================================================================



// Get schedule slot details
registerPath({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}',
  tags: ['Schedule Slots'],
  summary: 'Get schedule slot details',
  description: 'Retrieve detailed information for a specific schedule slot',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      description: 'Schedule slot details retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ScheduleSlotSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid schedule slot ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - No access to this schedule slot',
    },
    404: {
      description: 'Not found - Schedule slot does not exist',
    },
  },
});

// Assign vehicle to schedule slot
registerPath({
  method: 'post',
  path: '/schedule-slots/{scheduleSlotId}/vehicles',
  tags: ['Schedule Slots'],
  summary: 'Assign vehicle to schedule slot',
  description: 'Assign a vehicle to an existing schedule slot',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AssignVehicleRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Vehicle assigned successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ScheduleSlotSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or vehicle already assigned',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Schedule slot or vehicle does not exist',
    },
  },
});

// Remove vehicle from schedule slot
registerPath({
  method: 'delete',
  path: '/schedule-slots/{scheduleSlotId}/vehicles',
  tags: ['Schedule Slots'],
  summary: 'Remove vehicle from schedule slot',
  description: 'Remove a vehicle assignment from a schedule slot. Returns the complete updated ScheduleSlot with all vehicleAssignments and childAssignments from all families. If this was the last vehicle, the ScheduleSlot is deleted and a message is returned.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/VehicleIdRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Vehicle removed successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.union([
              ScheduleSlotSchema, // When slot still exists with other vehicles
              z.object({
                message: z.string(),
                slotDeleted: z.boolean(),
              }), // When slot was deleted (last vehicle)
            ]),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Schedule slot or vehicle assignment does not exist',
    },
  },
});

// Update vehicle assignment (driver, seat capacity, children)
registerPath({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId}',
  tags: ['Schedule Slots'],
  summary: 'Update vehicle assignment',
  description: 'Update driver, seat capacity, or add/remove children in an existing vehicle assignment. All fields are optional. Returns the complete updated ScheduleSlot.',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      scheduleSlotId: z.cuid(),
      vehicleAssignmentId: z.cuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/PatchVehicleAssignmentRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Vehicle assignment updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ScheduleSlotSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input',
    },
    403: {
      description: 'Access denied',
    },
    404: {
      description: 'Schedule slot or vehicle assignment not found',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Update vehicle driver assignment
registerPath({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleId}/driver',
  tags: ['Schedule Slots'],
  summary: 'Update vehicle driver assignment',
  description: 'Update or remove driver for a vehicle assignment in a schedule slot. Returns the complete updated ScheduleSlot with all vehicleAssignments and childAssignments from all families.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotVehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateDriverRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Driver assignment updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ScheduleSlotSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Schedule slot, vehicle, or assignment does not exist',
    },
  },
});


// Get available children for schedule slot
registerPath({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}/available-children',
  tags: ['Schedule Slots'],
  summary: 'Get available children for schedule slot',
  description: 'Retrieve list of children available for assignment to a schedule slot',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      description: 'Available children retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AvailableChildSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid schedule slot ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - No access to this schedule slot',
    },
    404: {
      description: 'Not found - Schedule slot does not exist',
    },
  },
});

// Get schedule slot conflicts
registerPath({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}/conflicts',
  tags: ['Schedule Slots'],
  summary: 'Get schedule slot conflicts',
  description: 'Retrieve list of conflicts for a schedule slot',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      description: 'Schedule slot conflicts retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.string()),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid schedule slot ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - No access to this schedule slot',
    },
    404: {
      description: 'Not found - Schedule slot does not exist',
    },
  },
});

// Update seat override for vehicle in schedule slot
registerPath({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleId}/seat-override',
  tags: ['Schedule Slots'],
  summary: 'Update seat override for vehicle',
  description: 'Update seat capacity override for a vehicle in a schedule slot. Returns the complete updated ScheduleSlot with all vehicleAssignments and childAssignments from all families.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ScheduleSlotVehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateSeatOverrideRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Seat override updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ScheduleSlotSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Schedule slot or vehicle does not exist',
    },
  },
});