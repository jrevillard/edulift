/**
 * Child Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for children endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { ChildService } from '../../services/ChildService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';
import { createLogger } from '../../utils/logger';
import { getErrorInfo } from '../../middleware/errorHandler';

// Import Hono-native schemas
import {
  CreateChildSchema,
  UpdateChildSchema,
  ChildParamsSchema,
  ChildGroupParamsSchema,
  ChildResponseSchema,
  ChildGroupMembershipSchema,
} from '../../schemas/children';
import { FamilyResponseSchema } from '../../schemas/families';
import { ErrorResponseSchema } from '../../schemas/responses';

// Type for Hono context with userId
type ChildVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createChildControllerRoutes(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  childService?: ChildService;
  childAssignmentService?: ChildAssignmentService;
} = {}): OpenAPIHono<{ Variables: ChildVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('ChildController');
  const childServiceInstance = dependencies.childService ?? new ChildService(prismaInstance);
  const childAssignmentServiceInstance = dependencies.childAssignmentService ?? new ChildAssignmentService(prismaInstance);

  // Create app
  const app = new OpenAPIHono<{ Variables: ChildVariables }>();

  // ============================================================================
  // OPENAPI ROUTES DEFINITIONS
  // ============================================================================


  // Success response schema helper
  const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
    return z.object({
    success: z.boolean(),
    data: schema,
    });
  };

  // ============================================================================
  // OPENAPI ROUTES DEFINITIONS
  // ============================================================================

/**
 * POST /children - Create a new child
 */
const createChildRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Children'],
  summary: 'Create a new child',
  description: 'Add a new child to your family. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    body: {
    content: {
    'application/json': {
    schema: CreateChildSchema,
    },
    },
    },
  },
  responses: {
    201: {
    content: {
    'application/json': {
    schema: createSuccessSchema(ChildResponseSchema),
    },
    },
    description: 'Child created successfully',
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
    description: 'Forbidden - Insufficient permissions or no family',
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
 * GET /children - List all children
 */
const getChildrenRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Children'],
  summary: 'List all children',
  description: 'Get all children for the authenticated user\'s family',
  security: [{ Bearer: [] }],
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(z.array(ChildResponseSchema)),
    },
    },
    description: 'List of children',
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
 * GET /children/:childId - Get specific child
 */
const getChildRoute = createRoute({
  method: 'get',
  path: '/{childId}',
  tags: ['Children'],
  summary: 'Get child by ID',
  description: 'Get details of a specific child',
  security: [{ Bearer: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(ChildResponseSchema),
    },
    },
    description: 'Child details',
    },
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child not found',
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
 * PUT /children/:childId - Update child (complete)
 */
const updateChildRoute = createRoute({
  method: 'put',
  path: '/{childId}',
  tags: ['Children'],
  summary: 'Update child (PUT)',
  description: 'Update child information completely. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    params: ChildParamsSchema,
    body: {
    content: {
    'application/json': {
    schema: UpdateChildSchema,
    },
    },
    },
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(ChildResponseSchema),
    },
    },
    description: 'Child updated successfully',
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
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child not found',
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
 * PATCH /children/:childId - Update child (partial)
 */
const patchChildRoute = createRoute({
  method: 'patch',
  path: '/{childId}',
  tags: ['Children'],
  summary: 'Update child (PATCH)',
  description: 'Partially update child information. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    params: ChildParamsSchema,
    body: {
    content: {
    'application/json': {
    schema: UpdateChildSchema,
    },
    },
    },
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(ChildResponseSchema),
    },
    },
    description: 'Child updated successfully',
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
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child not found',
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
 * DELETE /children/:childId - Delete child
 */
const deleteChildRoute = createRoute({
  method: 'delete',
  path: '/{childId}',
  tags: ['Children'],
  summary: 'Delete child',
  description: 'Delete a child from your family',
  security: [{ Bearer: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(FamilyResponseSchema),
    },
    },
    description: 'Child deleted successfully',
    },
    403: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Forbidden - Insufficient permissions',
    },
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child not found',
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
 * POST /children/:childId/groups/:groupId - Add child to group
 */
const addChildToGroupRoute = createRoute({
  method: 'post',
  path: '/{childId}/groups/{groupId}',
  tags: ['Children'],
  summary: 'Add child to group',
  description: 'Add a child to a group',
  security: [{ Bearer: [] }],
  request: {
    params: ChildGroupParamsSchema,
  },
  responses: {
    201: {
    content: {
    'application/json': {
    schema: createSuccessSchema(ChildGroupMembershipSchema),
    },
    },
    description: 'Child added to group successfully',
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
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child or group not found',
    },
    409: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Conflict - Child already belongs to group',
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
 * DELETE /children/:childId/groups/:groupId - Remove child from group
 */
const removeChildFromGroupRoute = createRoute({
  method: 'delete',
  path: '/{childId}/groups/{groupId}',
  tags: ['Children'],
  summary: 'Remove child from group',
  description: 'Remove a child from a group',
  security: [{ Bearer: [] }],
  request: {
    params: ChildGroupParamsSchema,
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: z.object({
    success: z.boolean(),
    data: z.object({
    message: z.string(),
    }),
    }),
    },
    },
    description: 'Child removed from group successfully',
    },
    403: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Forbidden - Insufficient permissions',
    },
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child, group, or membership not found',
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
 * GET /children/:childId/groups - Get child group memberships
 */
const getChildGroupsRoute = createRoute({
  method: 'get',
  path: '/{childId}/groups',
  tags: ['Children'],
  summary: 'Get child group memberships',
  description: 'Get all group memberships for a specific child',
  security: [{ Bearer: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
    content: {
    'application/json': {
    schema: createSuccessSchema(z.array(ChildGroupMembershipSchema)),
    },
    },
    description: 'List of group memberships',
    },
    404: {
    content: {
    'application/json': {
    schema: ErrorResponseSchema,
    },
    },
    description: 'Child not found',
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
   * POST /children - Create a new child
   */
  app.openapi(createChildRoute, async (c) => {
    const userId = c.get('userId');
    const user = c.get('user');
    const input = c.req.valid('json');

    loggerInstance.info('createChild', { userId, name: input.name, age: input.age, userEmail: user?.email });

    try {
      // Verify user family
    const userFamily = await childServiceInstance.getUserFamily(userId);
    if (!userFamily) {
    loggerInstance.warn('createChild: user without family', { userId });
    return c.json({
    success: false,
    error: 'User must belong to a family to add children',
    code: 'NO_FAMILY',
    }, 403);
    }

      // Verify family admin permissions
    const canModifyChildren = await childServiceInstance.canUserModifyFamilyChildren(userId, userFamily.id);
    if (!canModifyChildren) {
    loggerInstance.warn('createChild: insufficient permissions', { userId, familyId: userFamily.id });
    return c.json({
    success: false,
    error: 'Insufficient permissions to add children to family',
    code: 'INSUFFICIENT_PERMISSIONS',
    }, 403);
    }

      // Create child
    const childData: { name: string; familyId: string; age?: number } = {
    name: input.name,
    familyId: userFamily.id,
    };

    if (input.age !== undefined) {
    childData.age = input.age;
    }

    const child = await childServiceInstance.createChild(childData, userId);

    loggerInstance.info('createChild: child created', { userId, childId: child.id });

    return c.json({
    success: true,
    data: child,
    }, 201);
    } catch (error) {
    loggerInstance.error('createChild: error', { userId, error });
    return c.json({
    success: false,
    error: 'Failed to create child',
    code: 'CREATE_FAILED',
    }, 500);
    }
  });

  /**
   * GET /children - List all children
   */
  app.openapi(getChildrenRoute, async (c) => {
    const userId = c.get('userId');
    
    loggerInstance.info('getChildren', { userId });
    
    try {
    const children = await childServiceInstance.getChildrenByUser(userId);
    
    loggerInstance.info('getChildren: children retrieved', { userId, count: children.length });
    
    return c.json({
    success: true,
    data: children,
    }, 200);
    } catch (error) {
    loggerInstance.error('getChildren: error', { userId, error });
    return c.json({
    success: false,
    error: 'Failed to retrieve children',
    code: 'RETRIEVE_FAILED',
    }, 500);
    }
    });
    
  /**
     * GET /children/:childId - Get specific child
     */
  app.openapi(getChildRoute, async (c) => {
    const userId = c.get('userId');
    const { childId } = c.req.valid('param');
    
    loggerInstance.info('getChild', { userId, childId });
    
    try {
    const child = await childServiceInstance.getChildById(childId, userId);
    
    loggerInstance.info('getChild: child found', { userId, childId, childName: child.name });
    
    return c.json({
    success: true,
    data: child,
    }, 200);
    } catch (error) {
    loggerInstance.error('getChild: error', { userId, childId, error });
    return c.json({
    success: false,
    error: 'Child not found',
    code: 'CHILD_NOT_FOUND',
    }, 404);
    }
    });
    
  /**
   * PUT /children/:childId - Update child (complete)
   */
  app.openapi(updateChildRoute, async (c) => {
    const userId = c.get('userId');
    const { childId } = c.req.valid('param');
    const updateData = c.req.valid('json');
    
    loggerInstance.info('updateChild (PUT)', { userId, childId, updateData });
    
    try {
        // Filter out undefined values
    const updateDataFiltered: { name?: string; age?: number } = {};
    if (updateData.name !== undefined) {
    updateDataFiltered.name = updateData.name;
    }
    if (updateData.age !== undefined) {
    updateDataFiltered.age = updateData.age;
    }
    
    if (Object.keys(updateDataFiltered).length === 0) {
    loggerInstance.warn('updateChild: no update data provided', { userId, childId });
    return c.json({
    success: false,
    error: 'No update data provided',
    code: 'NO_DATA',
    }, 400);
    }
    
    const updatedChild = await childServiceInstance.updateChild(childId, userId, updateDataFiltered);
    
    loggerInstance.info('updateChild: child updated', {
    userId,
    childId,
    newName: updatedChild.name,
    });
    
    return c.json({
    success: true,
    data: updatedChild,
    }, 200);
    } catch (error) {
    loggerInstance.error('updateChild: error', { userId, childId, error });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'UPDATE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'UPDATE_FAILED',
    }, statusCode as 400 | 403 | 404 | 500);
    }
  });

  /**
   * PATCH /children/:childId - Update child (partial)
     */
  app.openapi(patchChildRoute, async (c) => {
    const userId = c.get('userId');
    const { childId } = c.req.valid('param');
    const updateData = c.req.valid('json');
    
    loggerInstance.info('updateChild (PATCH)', { userId, childId, updateData });
    
    try {
        // Filter out undefined values
    const updateDataFiltered: { name?: string; age?: number } = {};
    if (updateData.name !== undefined) {
    updateDataFiltered.name = updateData.name;
    }
    if (updateData.age !== undefined) {
    updateDataFiltered.age = updateData.age;
    }
    
    if (Object.keys(updateDataFiltered).length === 0) {
    loggerInstance.warn('updateChild: no update data provided', { userId, childId });
    return c.json({
    success: false,
    error: 'No update data provided',
    code: 'NO_DATA',
    }, 400);
    }
    
    const updatedChild = await childServiceInstance.updateChild(childId, userId, updateDataFiltered);
    
    loggerInstance.info('updateChild: child updated', {
    userId,
    childId,
    newName: updatedChild.name,
    });
    
    return c.json({
    success: true,
    data: updatedChild,
    }, 200);
    } catch (error) {
    loggerInstance.error('updateChild: error', { userId, childId, error });
    const errorInfo = getErrorInfo(error, 'UPDATE_FAILED');
    return c.json({
      success: false,
      error: errorInfo.message,
      code: 'UPDATE_FAILED',
    }, errorInfo.statusCode as 400 | 403 | 404 | 500);
    }
    });

  /**
     * DELETE /children/:childId - Delete child
     */
  app.openapi(deleteChildRoute, async (c): Promise<any> => {
    const userId = c.get('userId');
    const { childId } = c.req.valid('param');

    loggerInstance.info('deleteChild', { userId, childId });

    try {
    // Delete child - now returns complete Family
    const updatedFamily = await childServiceInstance.deleteChild(childId, userId);

    loggerInstance.info('deleteChild: child deleted', { userId, childId });

    return c.json({
    success: true,
    data: updatedFamily,
    }, 200);
    } catch (error) {
    loggerInstance.error('deleteChild: error', { userId, childId, error });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'DELETE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'DELETE_FAILED',
    }, statusCode as 400 | 403 | 404 | 500);
    }
    });

  /**
   * POST /children/:childId/groups/:groupId - Add child to group
   */
  app.openapi(addChildToGroupRoute, async (c) => {
    const userId = c.get('userId');
    const { childId, groupId } = c.req.valid('param');
    
    loggerInstance.info('addChildToGroup', { userId, childId, groupId });
    
    try {
    const membership = await childAssignmentServiceInstance.addChildToGroup(childId, groupId, userId);
    
    loggerInstance.info('addChildToGroup: child added to group', {
    userId,
    childId,
    groupId,
    });
    
    return c.json({
    success: true,
    data: membership,
    }, 201);
    } catch (error: any) {
    loggerInstance.error('addChildToGroup: error', { userId, childId, groupId, error });
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Failed to add child to group';
    return c.json({
    success: false,
    error: errorMessage,
    code: error.code || 'ADD_FAILED',
    }, statusCode);
    }
  });
  
  /**
   * DELETE /children/:childId/groups/:groupId - Remove child from group
     */
  app.openapi(removeChildFromGroupRoute, async (c): Promise<any> => {
    const userId = c.get('userId');
    const { childId, groupId } = c.req.valid('param');
    
    loggerInstance.info('removeChildFromGroup', { userId, childId, groupId });
    
    try {
    await childAssignmentServiceInstance.removeChildFromGroup(childId, groupId, userId);
    
    loggerInstance.info('removeChildFromGroup: child removed from group', {
    userId,
    childId,
    groupId,
    });
    
    return c.json({
    success: true,
    data: { message: 'Child removed from group successfully' },
    }, 200);
    } catch (error) {
    loggerInstance.error('removeChildFromGroup: error', { userId, childId, groupId, error });
    const { statusCode, message: errorMessage, code } = getErrorInfo(error, 'REMOVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: code || 'REMOVE_FAILED',
    }, statusCode as 400 | 403 | 404 | 500);
    }
  });

  /**
   * GET /children/:childId/groups - Get child group memberships
     */
  app.openapi(getChildGroupsRoute, async (c): Promise<any> => {
    const userId = c.get('userId');
    const { childId } = c.req.valid('param');
    
    loggerInstance.info('getChildGroups', { userId, childId });
    
    try {
    const memberships = await childAssignmentServiceInstance.getChildGroupMemberships(childId, userId);
    
    loggerInstance.info('getChildGroups: memberships retrieved', {
    userId,
    childId,
    count: memberships.length,
    });
    
    return c.json({
    success: true,
    data: memberships,
    }, 200);
    } catch (error) {
    loggerInstance.error('getChildGroups: error', { userId, childId, error });
    const { statusCode, message: errorMessage, code } = getErrorInfo(error, 'RETRIEVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: code || 'RETRIEVE_FAILED',
    }, statusCode as 400 | 403 | 404 | 500);
    }
    });

  return app;
}

// Default export for backward compatibility (uses real services)
export default createChildControllerRoutes();
