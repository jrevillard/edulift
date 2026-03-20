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
import { verifyGroupAccess } from '../../utils/accessControl';
import { getErrorInfo } from '../../middleware/errorHandler';
import { transformFamilyForResponse } from '../../utils/transformers';
import {
  createControllerLogger,
} from '../../utils/controllerLogging';

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
export const createVehicleControllerRoutes = function(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  vehicleService?: VehicleService;
} = {}): OpenAPIHono<{ Variables: VehicleVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('VehicleController');
  const vehicleServiceInstance = dependencies.vehicleService ?? new VehicleService(prismaInstance);

  // Create controller logger for comprehensive request logging
  const vehicleLogger = createControllerLogger('VehicleController');

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
          schema: createSuccessSchema(FamilyResponseSchema),
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
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Access denied - user does not have access to this group',
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
          schema: createSuccessSchema(FamilyResponseSchema),
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
app.openapi(createVehicleRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  vehicleLogger.logStart('createVehicle', c, {
    businessContext: {
      userId,
      name: input.name,
      capacity: input.capacity,
    },
  });

  loggerInstance.info('createVehicle', { userId, name: input.name, capacity: input.capacity, userEmail: user?.email });

  try {
    // Verify user family
    const userFamily = await vehicleServiceInstance.getUserFamily(userId);
    if (!userFamily) {
      vehicleLogger.logWarning('createVehicle', c, 'User without family');
      loggerInstance.warn('createVehicle: user without family', { userId });
      return c.json({
        success: false,
        error: 'User must belong to a family to add vehicles',
      code: 'NO_FAMILY' as const,
      }, 403);
    }

    // Verify family admin permissions
    const canModifyVehicles = await vehicleServiceInstance.canUserModifyFamilyVehicles(userId, userFamily.id);
    if (!canModifyVehicles) {
      vehicleLogger.logWarning('createVehicle', c, 'Insufficient permissions');
      loggerInstance.warn('createVehicle: insufficient permissions', { userId, familyId: userFamily.id });
      return c.json({
        success: false,
        error: 'Insufficient permissions to add vehicles to family',
      code: 'INSUFFICIENT_PERMISSIONS' as const,
      }, 403);
    }

    // Create vehicle
    const family = await vehicleServiceInstance.createVehicle({
      name: input.name,
      capacity: input.capacity,
      familyId: userFamily.id,
    }, userId);

    vehicleLogger.logSuccess('createVehicle', c, { userId, familyId: family.id });
    loggerInstance.info('createVehicle: vehicle created', { userId, familyId: family.id });

    return c.json({
    success: true,
    data: family,
    }, 201);
  } catch (error: unknown) {
    vehicleLogger.logError('createVehicle', c, error as Error | string);
      loggerInstance.error('createVehicle: error', { userId, error });
      const { statusCode, message: errorMessage } = getErrorInfo(error, 'CREATE_FAILED');
      return c.json({
        success: false,
        error: errorMessage,
      code: 'CREATE_FAILED' as const,
      }, statusCode as 400 | 403 | 404 | 500);
    }
});

/**
 * GET /vehicles - List all vehicles
 */
app.openapi(getVehiclesRoute, async (c): Promise<any> => {
  const userId = c.get('userId');

  vehicleLogger.logStart('getVehicles', c, {
    businessContext: { userId },
  });

  try {
    const vehicles = await vehicleServiceInstance.getVehiclesByUser(userId);

    vehicleLogger.logSuccess('getVehicles', c, { userId, count: vehicles.length });

    return c.json({
      success: true,
      data: vehicles,
    }, 200);
  } catch (error: any) {
    vehicleLogger.logError('getVehicles', c, error as Error | string);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Failed to retrieve vehicles';
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RETRIEVE_FAILED' as const,
    }, statusCode);
  }
});

/**
 * GET /vehicles/available/:groupId/:timeSlotId - Get available vehicles
 */
app.openapi(getAvailableVehiclesRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const { groupId, timeSlotId } = c.req.valid('param');

  vehicleLogger.logStart('getAvailableVehicles', c, {
    businessContext: { userId, groupId, timeSlotId },
  });

  // Verify user has access to the group
  const accessError = await verifyGroupAccess(prismaInstance, userId, groupId);
  if (!accessError.hasAccess) {
    vehicleLogger.logWarning('getAvailableVehicles', c, 'Group access denied', { userId, groupId });
    return c.json({ success: false, error: accessError.error }, accessError.statusCode);
  }

  try {
    const availableVehicles = await vehicleServiceInstance.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

    vehicleLogger.logSuccess('getAvailableVehicles', c, {
      groupId,
      timeSlotId,
      count: availableVehicles.length,
    });

    return c.json({
      success: true,
      data: availableVehicles,
    }, 200);
  } catch (error: any) {
    vehicleLogger.logError('getAvailableVehicles', c, error as Error | string);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Failed to retrieve available vehicles';
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RETRIEVE_FAILED' as const,
    }, statusCode);
  }
});

/**
 * GET /vehicles/:vehicleId - Get specific vehicle
 */
app.openapi(getVehicleRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');

  vehicleLogger.logStart('getVehicle', c, {
    businessContext: { userId, vehicleId },
  });

  try {
    const vehicle = await vehicleServiceInstance.getVehicleById(vehicleId, userId);

    vehicleLogger.logSuccess('getVehicle', c, {
      userId,
      vehicleId,
      vehicleName: vehicle.name,
      familyId: vehicle.familyId,
      capacity: vehicle.capacity,
    });

    return c.json({
      success: true,
      data: vehicle,
    }, 200);
  } catch (error: unknown) {
    vehicleLogger.logError('getVehicle', c, error as Error | string);
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'RETRIEVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RETRIEVE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * PATCH /vehicles/:vehicleId - Update vehicle
 */
app.openapi(updateVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');
  const updateData = c.req.valid('json');

  vehicleLogger.logStart('updateVehicle', c, {
    businessContext: {
      userId,
      vehicleId,
      fields: Object.keys(updateData),
    },
  });

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

    const family = await vehicleServiceInstance.updateVehicle(vehicleId, userId, updateDataFiltered);

    vehicleLogger.logSuccess('updateVehicle', c, { userId, vehicleId, familyId: family.id });
    loggerInstance.info('updateVehicle: vehicle updated', {
      userId,
      vehicleId,
      familyId: family.id,
    });

    return c.json({
    success: true,
    data: family,
    }, 200);
  } catch (error: unknown) {
    vehicleLogger.logError('updateVehicle', c, error as Error | string);
    loggerInstance.error('updateVehicle: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or update failed',
      code: 'UPDATE_FAILED' as const,
    }, 404);
  }
});

/**
 * DELETE /vehicles/:vehicleId - Delete vehicle
 */
app.openapi(deleteVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');

  vehicleLogger.logStart('deleteVehicle', c, {
    businessContext: { userId, vehicleId },
  });

  loggerInstance.info('deleteVehicle', { userId, vehicleId });

  try {
    // Delete vehicle - now returns complete Family
    const updatedFamily = await vehicleServiceInstance.deleteVehicle(vehicleId, userId);

    vehicleLogger.logSuccess('deleteVehicle', c, { userId, vehicleId });
    loggerInstance.info('deleteVehicle: vehicle deleted', { userId, vehicleId });

    return c.json({
    success: true,
    data: transformFamilyForResponse(updatedFamily),
    }, 200);
  } catch (error: unknown) {
    vehicleLogger.logError('deleteVehicle', c, error as Error | string);
    loggerInstance.error('deleteVehicle: error', { userId, vehicleId, error });
    return c.json({
      success: false,
      error: 'Vehicle not found or delete failed',
      code: 'DELETE_FAILED' as const,
    }, 404);
  }
});

/**
 * GET /vehicles/:vehicleId/schedule - Get vehicle schedule
 */
app.openapi(getVehicleScheduleRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const { vehicleId } = c.req.valid('param');
  const { week } = c.req.valid('query');

  vehicleLogger.logStart('getVehicleSchedule', c, {
    businessContext: { userId, vehicleId, week },
  });

  try {
    const schedule = await vehicleServiceInstance.getVehicleSchedule(vehicleId, userId, week);

    vehicleLogger.logSuccess('getVehicleSchedule', c, {
      userId,
      vehicleId,
      week,
    });

    return c.json({
      success: true,
      data: schedule,
    }, 200);
  } catch (error: unknown) {
    vehicleLogger.logError('getVehicleSchedule', c, error as Error | string);
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'RETRIEVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RETRIEVE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

  return app;
};

// Default export for backward compatibility (uses real services)
export default createVehicleControllerRoutes();
