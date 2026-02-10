/**
 * Vehicle Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for vehicles endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { VehicleService, UpdateVehicleData } from '../../services/VehicleService';
import { createLogger } from '../../utils/logger';

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
} from '../../schemas/vehicles';
import { FamilyResponseSchema } from '../../schemas/families';
import { ErrorResponseSchema } from '../../schemas/responses';

// Hono type for context with userId
type VehicleVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Success response schema
const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
  return z.object({
    success: z.boolean(),
    data: schema,
  });
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create VehicleController with injected dependencies
 * For production: call without params (uses real services)
 * For tests: inject mocked services
 */
export function createVehicleControllerRoutes(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  vehicleService?: VehicleService;
} = {}): OpenAPIHono<{ Variables: VehicleVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('VehicleController');
  const vehicleServiceInstance = dependencies.vehicleService ?? new VehicleService(prismaInstance);

  // Create app
  const app = new OpenAPIHono<{ Variables: VehicleVariables }>();

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
          schema: createSuccessSchema(FamilyResponseSchema),
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

  loggerInstance.info('createVehicle', { userId, name: input.name, capacity: input.capacity, userEmail: user?.email });

  try {
    // Verify user family
    const userFamily = await vehicleServiceInstance.getUserFamily(userId);
    if (!userFamily) {
      loggerInstance.warn('createVehicle: user without family', { userId });
      return c.json({
        success: false,
        error: 'User must belong to a family to add vehicles',
        code: 'NO_FAMILY',
      }, 403);
    }

    // Verify family admin permissions
    const canModifyVehicles = await vehicleServiceInstance.canUserModifyFamilyVehicles(userId, userFamily.id);
    if (!canModifyVehicles) {
      loggerInstance.warn('createVehicle: insufficient permissions', { userId, familyId: userFamily.id });
      return c.json({
        success: false,
        error: 'Insufficient permissions to add vehicles to family',
        code: 'INSUFFICIENT_PERMISSIONS',
      }, 403);
    }

    // Create vehicle
    const vehicle = await vehicleServiceInstance.createVehicle({
      name: input.name,
      capacity: input.capacity,
      familyId: userFamily.id,
    }, userId);

    loggerInstance.info('createVehicle: vehicle created', { userId, vehicleId: vehicle.id });

    return c.json({
      success: true,
      data: vehicle,
    }, 201);
  } catch (error) {
    loggerInstance.error('createVehicle: error', { userId, error });
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

  loggerInstance.info('getVehicles', { userId });

  try {
    const vehicles = await vehicleServiceInstance.getVehiclesByUser(userId);

    loggerInstance.info('getVehicles: vehicles retrieved', { userId, count: vehicles.length });

    return c.json({
      success: true,
      data: vehicles,
    }, 200);
  } catch (error) {
    loggerInstance.error('getVehicles: error', { userId, error });
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

  loggerInstance.info('getAvailableVehicles', { userId, groupId, timeSlotId });

  try {
    const availableVehicles = await vehicleServiceInstance.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

    loggerInstance.info('getAvailableVehicles: available vehicles', {
      groupId,
      timeSlotId,
      count: availableVehicles.length
    });

    return c.json({
      success: true,
      data: availableVehicles,
    }, 200);
  } catch (error) {
    loggerInstance.error('getAvailableVehicles: error', { userId, groupId, timeSlotId, error });
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

  loggerInstance.info('getVehicle', { userId, vehicleId });

  try {
    const vehicle = await vehicleServiceInstance.getVehicleById(vehicleId, userId);

    loggerInstance.info('getVehicle: vehicle found', { userId, vehicleId, vehicleName: vehicle.name });

    return c.json({
      success: true,
      data: vehicle,
    }, 200);
  } catch (error) {
    loggerInstance.error('getVehicle: error', { userId, vehicleId, error });
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

  loggerInstance.info('updateVehicle', { userId, vehicleId, updateData });

  try {
    // Filter data for UpdateVehicleData
    const updateDataFiltered: UpdateVehicleData = {};
    if (updateData.name !== undefined) {
      updateDataFiltered.name = updateData.name;
    }
    if (updateData.capacity !== undefined) {
      updateDataFiltered.capacity = updateData.capacity;
    }

    const updatedVehicle = await vehicleServiceInstance.updateVehicle(vehicleId, userId, updateDataFiltered);

    loggerInstance.info('updateVehicle: vehicle updated', {
      userId,
      vehicleId,
      newName: updatedVehicle.name
    });

    return c.json({
      success: true,
      data: updatedVehicle,
    }, 200);
  } catch (error) {
    loggerInstance.error('updateVehicle: error', { userId, vehicleId, error });
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

  loggerInstance.info('deleteVehicle', { userId, vehicleId });

  try {
    // Delete vehicle - now returns complete Family
    const updatedFamily = await vehicleServiceInstance.deleteVehicle(vehicleId, userId);

    loggerInstance.info('deleteVehicle: vehicle deleted', { userId, vehicleId });

    return c.json({
      success: true,
      data: updatedFamily,
    }, 200);
  } catch (error) {
    loggerInstance.error('deleteVehicle: error', { userId, vehicleId, error });
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

  loggerInstance.info('getVehicleSchedule', { userId, vehicleId, week });

  try {
    const schedule = await vehicleServiceInstance.getVehicleSchedule(vehicleId, userId, week);

    loggerInstance.info('getVehicleSchedule: schedule retrieved', {
      userId,
      vehicleId,
      week
    });

    return c.json({
      success: true,
      data: schedule,
    }, 200);
  } catch (error) {
    loggerInstance.error('getVehicleSchedule: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or schedule retrieval failed',
      code: 'RETRIEVE_FAILED',
    }, 404);
  }
});

  return app;
}

// Default export for backward compatibility (uses real services)
export default createVehicleControllerRoutes();
