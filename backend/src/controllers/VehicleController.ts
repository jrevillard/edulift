/**
 * Vehicle Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for vehicles endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { VehicleService, UpdateVehicleData } from '../services/VehicleService';
import { createLogger } from '../utils/logger';

// Import Hono-native schemas
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  VehicleParamsSchema,
  AvailableVehiclesParamsSchema,
  VehicleResponseSchema,
  AvailableVehicleSchema,
  VehicleScheduleSchema,
  WeekQuerySchema,
} from '../schemas/vehicles';

const logger = createLogger('VehicleController');

// Hono type for context with userId
type VehicleVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const app = new OpenAPIHono<{ Variables: VehicleVariables }>();

// Initialize services
const prisma = new PrismaClient();
const vehicleService = new VehicleService(prisma);

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Vehicle not found',
    description: 'Error message',
  }),
  code: z.string().optional().openapi({
    example: 'VEHICLE_NOT_FOUND',
    description: 'Error code for programmatic handling',
  }),
});

// Success response schema
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
 * POST /vehicles - Create a new vehicle
 */
const createVehicleRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Vehicles'],
  summary: 'Create a new vehicle',
  description: 'Add a new vehicle to your family. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateVehicleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(VehicleResponseSchema),
        },
      },
      description: 'Vehicle created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Forbidden - Insufficient permissions',
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
 * GET /vehicles - List all vehicles
 */
const getVehiclesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Vehicles'],
  summary: 'List all vehicles',
  description: 'Get all vehicles for the authenticated user\'s family',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(VehicleResponseSchema)),
        },
      },
      description: 'List of vehicles',
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
 * GET /vehicles/available/:groupId/:timeSlotId - Get available vehicles
 */
const getAvailableVehiclesRoute = createRoute({
  method: 'get',
  path: '/available/{groupId}/{timeSlotId}',
  tags: ['Vehicles'],
  summary: 'Get available vehicles',
  description: 'Get all available vehicles for a specific schedule slot',
  security: [{ Bearer: [] }],
  request: {
    params: AvailableVehiclesParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(AvailableVehicleSchema)),
        },
      },
      description: 'List of available vehicles',
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
 * GET /vehicles/:vehicleId - Get specific vehicle
 */
const getVehicleRoute = createRoute({
  method: 'get',
  path: '/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Get vehicle by ID',
  description: 'Get details of a specific vehicle',
  security: [{ Bearer: [] }],
  request: {
    params: VehicleParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(VehicleResponseSchema),
        },
      },
      description: 'Vehicle details',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Vehicle not found',
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
 * PATCH /vehicles/:vehicleId - Update vehicle
 */
const updateVehicleRoute = createRoute({
  method: 'patch',
  path: '/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Update vehicle',
  description: 'Update vehicle name or capacity',
  security: [{ Bearer: [] }],
  request: {
    params: VehicleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateVehicleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(VehicleResponseSchema),
        },
      },
      description: 'Vehicle updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Vehicle not found',
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
 * DELETE /vehicles/:vehicleId - Delete vehicle
 */
const deleteVehicleRoute = createRoute({
  method: 'delete',
  path: '/{vehicleId}',
  tags: ['Vehicles'],
  summary: 'Delete vehicle',
  description: 'Delete a vehicle from your family',
  security: [{ Bearer: [] }],
  request: {
    params: VehicleParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              message: z.string(),
            }),
          }),
        },
      },
      description: 'Vehicle deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Vehicle not found',
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
 * GET /vehicles/:vehicleId/schedule - Get vehicle schedule
 */
const getVehicleScheduleRoute = createRoute({
  method: 'get',
  path: '/{vehicleId}/schedule',
  tags: ['Vehicles'],
  summary: 'Get vehicle schedule',
  description: 'Get schedule information for a specific vehicle',
  security: [{ Bearer: [] }],
  request: {
    params: VehicleParamsSchema,
    query: WeekQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(VehicleScheduleSchema),
        },
      },
      description: 'Vehicle schedule information',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Vehicle not found',
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
 * POST /vehicles - Create a new vehicle
 */
app.openapi(createVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  logger.info('createVehicle', { userId, name: input.name, capacity: input.capacity, userEmail: user?.email });

  try {
    // Verify user family
    const userFamily = await vehicleService.getUserFamily(userId);
    if (!userFamily) {
      logger.warn('createVehicle: user without family', { userId });
      return c.json({
        success: false,
        error: 'User must belong to a family to add vehicles',
        code: 'NO_FAMILY',
      }, 403);
    }

    // Verify family admin permissions
    const canModifyVehicles = await vehicleService.canUserModifyFamilyVehicles(userId, userFamily.id);
    if (!canModifyVehicles) {
      logger.warn('createVehicle: insufficient permissions', { userId, familyId: userFamily.id });
      return c.json({
        success: false,
        error: 'Insufficient permissions to add vehicles to family',
        code: 'INSUFFICIENT_PERMISSIONS',
      }, 403);
    }

    // Create vehicle
    const vehicle = await vehicleService.createVehicle({
      name: input.name,
      capacity: input.capacity,
      familyId: userFamily.id,
    }, userId);

    logger.info('createVehicle: vehicle created', { userId, vehicleId: vehicle.id });

    return c.json({
      success: true,
      data: vehicle,
    }, 201);
  } catch (error) {
    logger.error('createVehicle: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to create vehicle',
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * GET /vehicles - List all vehicles
 */
app.openapi(getVehiclesRoute, async (c) => {
  const userId = c.get('userId');

  logger.info('getVehicles', { userId });

  try {
    const vehicles = await vehicleService.getVehiclesByUser(userId);

    logger.info('getVehicles: vehicles retrieved', { userId, count: vehicles.length });

    return c.json({
      success: true,
      data: vehicles,
    }, 200);
  } catch (error) {
    logger.error('getVehicles: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve vehicles',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * GET /vehicles/available/:groupId/:timeSlotId - Get available vehicles
 */
app.openapi(getAvailableVehiclesRoute, async (c) => {
  const userId = c.get('userId');
  const { groupId, timeSlotId } = c.req.valid('param');

  logger.info('getAvailableVehicles', { userId, groupId, timeSlotId });

  try {
    const availableVehicles = await vehicleService.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

    logger.info('getAvailableVehicles: available vehicles', {
      groupId,
      timeSlotId,
      count: availableVehicles.length
    });

    return c.json({
      success: true,
      data: availableVehicles,
    }, 200);
  } catch (error) {
    logger.error('getAvailableVehicles: error', { userId, groupId, timeSlotId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve available vehicles',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * GET /vehicles/:vehicleId - Get specific vehicle
 */
app.openapi(getVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');

  logger.info('getVehicle', { userId, vehicleId });

  try {
    const vehicle = await vehicleService.getVehicleById(vehicleId, userId);

    logger.info('getVehicle: vehicle found', { userId, vehicleId, vehicleName: vehicle.name });

    return c.json({
      success: true,
      data: vehicle,
    }, 200);
  } catch (error) {
    logger.error('getVehicle: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found',
      code: 'VEHICLE_NOT_FOUND',
    }, 404);
  }
});

/**
 * PATCH /vehicles/:vehicleId - Update vehicle
 */
app.openapi(updateVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');
  const updateData = c.req.valid('json');

  logger.info('updateVehicle', { userId, vehicleId, updateData });

  try {
    // Filter data for UpdateVehicleData
    const updateDataFiltered: UpdateVehicleData = {};
    if (updateData.name !== undefined) {
      updateDataFiltered.name = updateData.name;
    }
    if (updateData.capacity !== undefined) {
      updateDataFiltered.capacity = updateData.capacity;
    }

    const updatedVehicle = await vehicleService.updateVehicle(vehicleId, userId, updateDataFiltered);

    logger.info('updateVehicle: vehicle updated', {
      userId,
      vehicleId,
      newName: updatedVehicle.name
    });

    return c.json({
      success: true,
      data: updatedVehicle,
    }, 200);
  } catch (error) {
    logger.error('updateVehicle: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or update failed',
      code: 'UPDATE_FAILED',
    }, 404);
  }
});

/**
 * DELETE /vehicles/:vehicleId - Delete vehicle
 */
app.openapi(deleteVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');

  logger.info('deleteVehicle', { userId, vehicleId });

  try {
    const result = await vehicleService.deleteVehicle(vehicleId, userId);

    logger.info('deleteVehicle: vehicle deleted', { userId, vehicleId });

    return c.json({
      success: true,
      data: { message: result.message },
    }, 200);
  } catch (error) {
    logger.error('deleteVehicle: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or delete failed',
      code: 'DELETE_FAILED',
    }, 404);
  }
});

/**
 * GET /vehicles/:vehicleId/schedule - Get vehicle schedule
 */
app.openapi(getVehicleScheduleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');
  const { week } = c.req.valid('query');

  logger.info('getVehicleSchedule', { userId, vehicleId, week });

  try {
    const schedule = await vehicleService.getVehicleSchedule(vehicleId, userId, week);

    logger.info('getVehicleSchedule: schedule retrieved', {
      userId,
      vehicleId,
      week
    });

    return c.json({
      success: true,
      data: schedule,
    }, 200);
  } catch (error) {
    logger.error('getVehicleSchedule: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or schedule retrieval failed',
      code: 'RETRIEVE_FAILED',
    }, 404);
  }
});

export default app;
