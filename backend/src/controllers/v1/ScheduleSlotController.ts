/**
 * Schedule Slot Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for schedule slots endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { ScheduleSlotService } from '../../services/ScheduleSlotService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { SocketEmitter } from '../../utils/socketEmitter';
import { createLogger } from '../../utils/logger';
import { normalizeError } from '../../utils/errorHandler';
import type { ScheduleSlotWithDetails, AssignVehicleToSlotData } from '../../types';

// Import Hono-native schemas
import {
  CreateScheduleSlotWithVehicleSchema,
  AssignVehicleSchema,
  AssignChildSchema,
  UpdateDriverSchema,
  VehicleIdSchema,
  UpdateSeatOverrideSchema,
  ScheduleSlotParamsSchema,
  GroupParamsSchema,
  ScheduleSlotChildParamsSchema,
  ScheduleSlotVehicleParamsSchema,
  DateRangeQuerySchema,
  ScheduleSlotSchema,
  ScheduleVehicleAssignmentSchema,
  AvailableChildSchema,
  ScheduleResponseSchema,
} from '../../schemas/scheduleSlots';
import { ErrorResponseSchema } from '../../schemas/responses';

// Type for Hono variables with userId
type ScheduleSlotVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone?: string };
};

// ============================================================================
// DATA TRANSFORMATION HELPERS
// ============================================================================

/**
 * Transform Date to ISO string safely
 */
function dateToISOString(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') return date;
  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Transform schedule slot from Prisma to OpenAPI schema format
 */
function transformScheduleSlot(slot: ScheduleSlotWithDetails | null): any {
  if (!slot) return null;

  return {
    ...slot,
    datetime: typeof slot.datetime === 'string' ? slot.datetime : dateToISOString(slot.datetime as any) || slot.datetime,
    createdAt: dateToISOString(slot.createdAt as any) || slot.createdAt,
    updatedAt: dateToISOString(slot.updatedAt as any) || slot.updatedAt,
    vehicleAssignments: slot.vehicleAssignments?.map(va => transformVehicleAssignment(va)),
    childAssignments: slot.childAssignments?.map(ca => transformChildAssignment(ca)),
  };
}

/**
 * Transform vehicle assignment from Prisma to OpenAPI schema format
 */
function transformVehicleAssignment(assignment: any): any {
  if (!assignment) return assignment;

  return {
    id: assignment.id,
    vehicleId: assignment.vehicleId,
    scheduleSlotId: assignment.scheduleSlotId,
    driverId: assignment.driverId,
    seatOverride: assignment.seatOverride,
    createdAt: assignment.createdAt ? dateToISOString(assignment.createdAt) : assignment.createdAt,
    vehicle: assignment.vehicle,
    driver: assignment.driver ? {
      id: assignment.driver.id,
      name: assignment.driver.name,
      email: assignment.driver.email,
    } : undefined,
  };
}

/**
 * Transform available child from Prisma to OpenAPI schema format
 */
function transformAvailableChild(child: any): any {
  if (!child) return child;

  return {
    id: child.id,
    firstName: child.name?.split(' ')[0] || child.firstName,
    lastName: child.name?.split(' ').slice(1).join(' ') || child.lastName,
    familyId: child.familyId,
    familyName: child.familyName,
    canAssign: child.canAssign ?? true,
    conflictReason: child.conflictReason,
  };
}

/**
 * Transform child assignment from service to API response format.
 * Service returns Prisma model with nested relations; we need flat structure.
 */
function transformChildAssignment(assignment: any): any {
  if (!assignment) return assignment;

  // ScheduleSlotChild uses composite key (@@id([scheduleSlotId, childId]))
  // Generate a synthetic ID for API compatibility with frontend DTOs
  const syntheticId = `${assignment.scheduleSlotId}_${assignment.childId}`;

  return {
    id: syntheticId,
    scheduleSlotId: assignment.scheduleSlotId,
    childId: assignment.childId,
    vehicleAssignmentId: assignment.vehicleAssignmentId,
    assignedAt: assignment.assignedAt ? dateToISOString(assignment.assignedAt) : assignment.assignedAt,
    child: assignment.child,
    vehicleAssignment: assignment.vehicleAssignment ? transformVehicleAssignment(assignment.vehicleAssignment) : undefined,
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create ScheduleSlotController with injected dependencies
 * For production: call without params (uses real services)
 * For tests: inject mocked services
 */
export function createScheduleSlotControllerRoutes(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  scheduleSlotService?: ScheduleSlotService;
  childAssignmentService?: ChildAssignmentService;
  scheduleSlotRepository?: ScheduleSlotRepository;
  skipAuthChecks?: boolean; // For testing: skip userId validation checks
  testUserId?: string; // For testing: use specific userId
} = {}): OpenAPIHono<{ Variables: ScheduleSlotVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('ScheduleSlotController');
  const scheduleSlotRepositoryInstance = dependencies.scheduleSlotRepository ?? new ScheduleSlotRepository(prismaInstance);
  const scheduleSlotServiceInstance = dependencies.scheduleSlotService ?? new ScheduleSlotService(scheduleSlotRepositoryInstance);
  const childAssignmentServiceInstance = dependencies.childAssignmentService ?? new ChildAssignmentService(prismaInstance);

  // Create app
  const app = new OpenAPIHono<{ Variables: ScheduleSlotVariables }>();

  // For testing: add middleware that sets userId when Bearer token is present
  if (dependencies.skipAuthChecks) {
    const testUserId = dependencies.testUserId || 'cltestuser12345678901234567';
    app.use('*', async (c: any, next: any) => {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
      }
      // Set test user context
      c.set('userId', testUserId);
      c.set('user', {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'UTC',
      });
      await next();
    });
  }

// Success response schema helper
const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
  return z.object({
    success: z.boolean(),
    data: schema,
  });
};

// Message response schema for operations with success message
const MessageResponseSchema = z.object({
  message: z.string(),
});

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * POST /groups/:groupId/schedule-slots - Create schedule slot with vehicle
 */
const createScheduleSlotRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/schedule-slots',
  tags: ['Schedule Slots'],
  summary: 'Create schedule slot with vehicle',
  description: 'Create a new schedule slot with vehicle assignment for a specific group',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateScheduleSlotWithVehicleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Schedule slot created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input or vehicle ID missing',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
 * POST /schedule-slots/:scheduleSlotId/vehicles - Assign vehicle to slot
 */
const assignVehicleRoute = createRoute({
  method: 'post',
  path: '/schedule-slots/{scheduleSlotId}/vehicles',
  tags: ['Schedule Slots'],
  summary: 'Assign vehicle to schedule slot',
  description: 'Assign a vehicle to an existing schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: AssignVehicleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleVehicleAssignmentSchema),
        },
      },
      description: 'Vehicle assigned successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input or vehicle ID missing',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found',
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
 * DELETE /schedule-slots/:scheduleSlotId/vehicles - Remove vehicle from slot
 */
const removeVehicleRoute = createRoute({
  method: 'delete',
  path: '/schedule-slots/{scheduleSlotId}/vehicles',
  tags: ['Schedule Slots'],
  summary: 'Remove vehicle from schedule slot',
  description: 'Remove a vehicle assignment from a schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: VehicleIdSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.object({
            message: z.string(),
            slotDeleted: z.boolean(),
          })),
        },
      },
      description: 'Vehicle removed successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Vehicle ID missing',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found',
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
 * PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleId/driver - Update vehicle driver
 */
const updateVehicleDriverRoute = createRoute({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleId}/driver',
  tags: ['Schedule Slots'],
  summary: 'Update vehicle driver',
  description: 'Update or remove driver for a vehicle assignment in a schedule slot. Returns the complete updated ScheduleSlot with all vehicleAssignments and childAssignments from all families.',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotVehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateDriverSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Driver updated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found',
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
 * DELETE /schedule-slots/:scheduleSlotId/children/:childId - Remove child from slot
 */
const removeChildRoute = createRoute({
  method: 'delete',
  path: '/schedule-slots/{scheduleSlotId}/children/{childId}',
  tags: ['Schedule Slots'],
  summary: 'Remove child from schedule slot',
  description: 'Remove a child assignment from a schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotChildParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(MessageResponseSchema),
        },
      },
      description: 'Child removed successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found or child assignment does not exist',
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
 * GET /schedule-slots/:scheduleSlotId - Get schedule slot details
 */
const getScheduleSlotRoute = createRoute({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}',
  tags: ['Schedule Slots'],
  summary: 'Get schedule slot details',
  description: 'Retrieve detailed information for a specific schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Schedule slot details retrieved successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found',
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
 * GET /groups/:groupId/schedule - Get group schedule
 */
const getScheduleRoute = createRoute({
  method: 'get',
  path: '/groups/{groupId}/schedule',
  tags: ['Schedule Slots'],
  summary: 'Get group schedule',
  description: 'Retrieve schedule for a specific group with optional date range filtering',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    query: DateRangeQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleResponseSchema),
        },
      },
      description: 'Group schedule retrieved successfully',
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
 * GET /schedule-slots/:scheduleSlotId/conflicts - Get schedule slot conflicts
 */
const getScheduleSlotConflictsRoute = createRoute({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}/conflicts',
  tags: ['Schedule Slots'],
  summary: 'Get schedule slot conflicts',
  description: 'Retrieve list of conflicts for a schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.object({
            conflicts: z.array(z.string()),
          })),
        },
      },
      description: 'Schedule slot conflicts retrieved successfully',
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
 * POST /schedule-slots/:scheduleSlotId/children - Assign child to slot
 */
const assignChildRoute = createRoute({
  method: 'post',
  path: '/schedule-slots/{scheduleSlotId}/children',
  tags: ['Schedule Slots'],
  summary: 'Assign child to schedule slot',
  description: 'Assign a child to a specific vehicle assignment in a schedule slot. Returns the complete updated ScheduleSlot with all vehicleAssignments and childAssignments from all families.',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: AssignChildSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Child assigned successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Child ID missing',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot not found',
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
 * DELETE /schedule-slots/:scheduleSlotId/children/:childId/remove - Remove child from schedule slot
 */
const removeChildFromScheduleSlotRoute = createRoute({
  method: 'delete',
  path: '/schedule-slots/{scheduleSlotId}/children/{childId}/remove',
  tags: ['Schedule Slots'],
  summary: 'Remove child from schedule slot',
  description: 'Remove a child assignment from a schedule slot (dedicated endpoint)',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotChildParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.unknown()),
        },
      },
      description: 'Child removed successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
 * GET /schedule-slots/:scheduleSlotId/children/available - Get available children for slot
 */
const getAvailableChildrenRoute = createRoute({
  method: 'get',
  path: '/schedule-slots/{scheduleSlotId}/children/available',
  tags: ['Schedule Slots'],
  summary: 'Get available children for schedule slot',
  description: 'Retrieve list of children available for assignment to a schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(AvailableChildSchema)),
        },
      },
      description: 'Available children retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
 * PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleId/seat-override - Update seat override
 */
const updateSeatOverrideRoute = createRoute({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleId}/seat-override',
  tags: ['Schedule Slots'],
  summary: 'Update seat override for vehicle',
  description: 'Update seat capacity override for a vehicle in a schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: ScheduleSlotVehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateSeatOverrideSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Seat override updated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot or vehicle not found',
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
 * POST /groups/:groupId/schedule-slots - Create schedule slot with vehicle
 */
app.openapi(createScheduleSlotRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');
  const input = c.req.valid('json');

  loggerInstance.debug('createScheduleSlotWithVehicle: Received request', {
    userId,
    groupId,
    datetime: input.datetime,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    seatOverride: input.seatOverride,
    userEmail: user?.email,
  });

  if (!input.vehicleId) {
    loggerInstance.warn('createScheduleSlotWithVehicle: Vehicle ID is required', { userId, groupId });
    return c.json({
      success: false,
      error: 'Vehicle ID is required to create a schedule slot',
    }, 400);
  }

  try {
    const slotData = {
      groupId,
      datetime: input.datetime,
    };

    loggerInstance.debug('createScheduleSlotWithVehicle: Creating slot with vehicle', {
      groupId,
      userId,
      vehicleId: input.vehicleId,
      datetime: input.datetime,
    });

    const slot = await scheduleSlotServiceInstance.createScheduleSlotWithVehicle(
      slotData,
      input.vehicleId,
      userId,
      input.driverId,
      input.seatOverride
    ) as ScheduleSlotWithDetails | null;

    // Transform slot to OpenAPI format
    const transformedSlot = transformScheduleSlot(slot);

    // Emit WebSocket event for real-time updates
    if (slot) {
      loggerInstance.debug('createScheduleSlotWithVehicle: Broadcasting WebSocket events', {
        groupId,
        slotId: slot.id,
      });
      SocketEmitter.broadcastScheduleSlotCreated(groupId, slot.id, slot);
      SocketEmitter.broadcastScheduleUpdate(groupId);
    }

    loggerInstance.debug('createScheduleSlotWithVehicle: Slot created successfully', {
      groupId,
      slotId: slot?.id,
      vehicleId: input.vehicleId,
    });

    return c.json({
      success: true,
      data: transformedSlot,
    }, 201);
  } catch (error) {
    const normalizedError = normalizeError(error);

    loggerInstance.error('createScheduleSlotWithVehicle: Error occurred', {
      error: normalizedError.message,
      code: normalizedError.code,
      stack: normalizedError.stack,
      statusCode: normalizedError.statusCode,
      userId,
      groupId,
    });

    return c.json({
      success: false,
      error: 'Failed to create schedule slot',
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * POST /schedule-slots/:scheduleSlotId/vehicles - Assign vehicle to slot
 */
app.openapi(assignVehicleRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');

  if (!input.vehicleId) {
    return c.json({
      success: false,
      error: 'Vehicle ID is required',
    }, 400);
  }

  try {
    // Get the schedule slot first to obtain groupId for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const assignmentData: AssignVehicleToSlotData = {
      scheduleSlotId,
      vehicleId: input.vehicleId,
    };
    if (input.driverId !== undefined) {
      assignmentData.driverId = input.driverId;
    }
    if (input.seatOverride !== undefined) {
      assignmentData.seatOverride = input.seatOverride;
    }

    const result = await scheduleSlotServiceInstance.assignVehicleToSlot(assignmentData);

    // Transform result to OpenAPI format
    const transformedResult = transformVehicleAssignment(result);

    // Emit WebSocket event for real-time updates
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: transformedResult,
    }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to assign vehicle',
      code: 'ASSIGN_FAILED',
    }, 500);
  }
});

/**
 * DELETE /schedule-slots/:scheduleSlotId/vehicles - Remove vehicle from slot
 */
app.openapi(removeVehicleRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');

  if (!input.vehicleId) {
    return c.json({
      success: false,
      error: 'Vehicle ID is required',
    }, 400);
  }

  try {
    // Get the schedule slot first to obtain groupId for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const result = await scheduleSlotServiceInstance.removeVehicleFromSlot(scheduleSlotId, input.vehicleId);

    // Emit WebSocket event for real-time updates
    if (!result) {
      // Slot was deleted (last vehicle removed)
      SocketEmitter.broadcastScheduleSlotDeleted(scheduleSlot.groupId, scheduleSlotId);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      return c.json({
        success: true,
        data: {
          message: 'Vehicle removed successfully - schedule slot deleted (last vehicle)',
          slotDeleted: true,
        },
      }, 200);
    } else {
      // Slot still exists with remaining vehicles
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      return c.json({
        success: true,
        data: result, // Returns full ScheduleSlot with vehicleAssignments and childAssignments
      }, 200);
    }
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to remove vehicle',
      code: 'REMOVE_FAILED',
    }, 500);
  }
});

/**
 * PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleId/driver - Update vehicle driver
 */
app.openapi(updateVehicleDriverRoute, async (c) => {
  const { scheduleSlotId, vehicleId } = c.req.valid('param');
  const input = c.req.valid('json');

  try {
    // Get the schedule slot first to obtain groupId for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    // Update the driver
    await scheduleSlotServiceInstance.updateVehicleDriver(scheduleSlotId, vehicleId, input.driverId);

    // ✅ Fetch the complete updated ScheduleSlot with all families' data
    const updatedSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);

    // Edge case: ScheduleSlot might have been deleted during the update
    if (!updatedSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot was deleted during update',
      }, 404);
    }

    // Emit WebSocket event for real-time updates
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: updatedSlot, // Complete ScheduleSlot with all vehicleAssignments and childAssignments
    }, 200) as any; // Type narrowing: Hono's strict typing doesn't match our union response type
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to update driver',
      code: 'UPDATE_FAILED',
    }, 500);
  }
});

/**
 * DELETE /schedule-slots/:scheduleSlotId/children/:childId - Remove child from slot
 */
app.openapi(removeChildRoute, async (c) => {
  const { scheduleSlotId, childId } = c.req.valid('param');

  try {
    // Get the schedule slot first to obtain groupId for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const result = await scheduleSlotServiceInstance.removeChildFromSlot(scheduleSlotId, childId);

    // Emit WebSocket event for real-time updates
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: { message: 'Child removed successfully' },
    }, 200);
  } catch (error) {
    // Check if it's a Prisma "record not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return c.json({
        success: false,
        error: 'Child assignment not found',
        code: 'CHILD_NOT_FOUND',
      }, 404);
    }

    return c.json({
      success: false,
      error: 'Failed to remove child',
      code: 'REMOVE_FAILED',
    }, 500);
  }
});

/**
 * GET /schedule-slots/:scheduleSlotId - Get schedule slot details
 */
app.openapi(getScheduleSlotRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');

  try {
    const slot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);

    if (!slot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    // Transform slot to OpenAPI format
    const transformedSlot = transformScheduleSlot(slot);

    return c.json({
      success: true,
      data: transformedSlot,
    }, 200);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to retrieve schedule slot',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * GET /groups/:groupId/schedule - Get group schedule
 */
app.openapi(getScheduleRoute, async (c) => {
  const { groupId } = c.req.valid('param');
  const { startDate, endDate } = c.req.valid('query');

  loggerInstance.debug(`getSchedule CONTROLLER called for group ${groupId}, startDate: ${startDate}, endDate: ${endDate}`);

  loggerInstance.debug('Calling scheduleSlotServiceInstance.getSchedule...');
  const schedule = await scheduleSlotServiceInstance.getSchedule(
    groupId,
    startDate,
    endDate,
  );

  // Transform schedule slots to ensure ISO date strings
  const transformedSchedule = {
    ...schedule,
    scheduleSlots: schedule.scheduleSlots?.map((slot: ScheduleSlotWithDetails) => slot),
  };

  loggerInstance.debug('Controller sending response:', { transformedSchedule });

  return c.json({
    success: true,
    data: transformedSchedule,
  }, 200);
});

/**
 * GET /schedule-slots/:scheduleSlotId/conflicts - Get schedule slot conflicts
 */
app.openapi(getScheduleSlotConflictsRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');

  try {
    const conflicts = await scheduleSlotServiceInstance.validateSlotConflicts(scheduleSlotId);

    return c.json({
      success: true,
      data: { conflicts },
    }, 200);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to retrieve conflicts',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * POST /schedule-slots/:scheduleSlotId/children - Assign child to slot
 */
app.openapi(assignChildRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');
  const userId = c.get('userId');

  if (!input.childId) {
    return c.json({
      success: false,
      error: 'Child ID is required',
    }, 400);
  }

  // Get the schedule slot first to obtain groupId for WebSocket emissions
  const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
  if (!scheduleSlot) {
    return c.json({
      success: false,
      error: 'Schedule slot not found',
    }, 404);
  }

  // Create the assignment
  await childAssignmentServiceInstance.assignChildToScheduleSlot(
    scheduleSlotId,
    input.childId,
    input.vehicleAssignmentId,
    userId,
  );

  // ✅ Fetch the complete updated ScheduleSlot with all families' data
  const updatedSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);

  // Edge case: ScheduleSlot might have been deleted during the update
  if (!updatedSlot) {
    return c.json({
      success: false,
      error: 'Schedule slot was deleted during update',
    }, 404);
  }

  // Emit WebSocket event for real-time updates
  SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
  SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

  return c.json({
    success: true,
    data: updatedSlot, // Complete ScheduleSlot with all vehicleAssignments and childAssignments
  }, 201) as any; // Type narrowing: Hono's strict typing doesn't match our union response type
});

/**
 * DELETE /schedule-slots/:scheduleSlotId/children/:childId/remove - Remove child from schedule slot
 */
app.openapi(removeChildFromScheduleSlotRoute, async (c) => {
  const { scheduleSlotId, childId } = c.req.valid('param');
  const userId = c.get('userId');

  const result = await childAssignmentServiceInstance.removeChildFromScheduleSlot(
    scheduleSlotId,
    childId,
    userId,
  );

  return c.json({
    success: true,
    data: result,
  }, 200);
});

/**
 * GET /schedule-slots/:scheduleSlotId/children/available - Get available children for slot
 */
app.openapi(getAvailableChildrenRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const userId = c.get('userId');

  const children = await childAssignmentServiceInstance.getAvailableChildrenForScheduleSlot(
    scheduleSlotId,
    userId,
  );

  // Transform children to OpenAPI format
  const transformedChildren = children.map(transformAvailableChild);

  return c.json({
    success: true,
    data: transformedChildren,
  }, 200);
});

/**
 * PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleId/seat-override - Update seat override
 */
app.openapi(updateSeatOverrideRoute, async (c) => {
  const { scheduleSlotId, vehicleId } = c.req.valid('param');
  const input = c.req.valid('json');

  try {
    // Get the schedule slot first to obtain groupId for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    // Update seat override using scheduleSlotId and vehicleId
    await scheduleSlotServiceInstance.updateSeatOverrideByVehicle(scheduleSlotId, vehicleId, input.seatOverride);

    // ✅ Fetch the complete updated ScheduleSlot with all families' data
    const updatedSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);

    // Edge case: ScheduleSlot might have been deleted during the update
    if (!updatedSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot was deleted during update',
      }, 404);
    }

    // Emit WebSocket event for real-time updates
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: updatedSlot, // Complete ScheduleSlot with all vehicleAssignments and childAssignments
    }, 200) as any; // Type narrowing: Hono's strict typing doesn't match our union response type
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to update seat override',
      code: 'UPDATE_FAILED',
    }, 500);
  }
});

  return app;
}

// Default export for backward compatibility (uses real services)
export default createScheduleSlotControllerRoutes();

// Export types for testing
export type { ScheduleSlotVariables };

