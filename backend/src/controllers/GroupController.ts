/**
 * Group Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for groups endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { GroupService } from '../services/GroupService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { createLogger } from '../utils/logger';

// Import all schemas
import {
  CreateGroupSchema,
  JoinGroupSchema,
  UpdateGroupSchema,
  UpdateFamilyRoleSchema,
  ValidateInviteSchema,
  GroupParamsSchema,
  FamilyRoleParamsSchema,
  GroupResponseSchema,
  UpdateFamilyRoleResponseSchema,
  EnrichedGroupFamilySchema,
  InvitationValidationSchema,
  SimpleSuccessResponseSchema,
  ErrorResponseSchema,
  createSuccessSchema,
} from '../schemas/groups';

const logger = createLogger('GroupController');

// Hono type for context with userId
export type GroupVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const app = new OpenAPIHono<{ Variables: GroupVariables }>();

// ============================================================================
// MODULE SERVICES (replacable for testing)
// ============================================================================

const moduleServices = {
  prisma: new PrismaClient(),
  emailService: EmailServiceFactory.getInstance(),
  groupService: null as any,  // Will be initialized below
};

// Initialize groupService with dependencies
moduleServices.groupService = new GroupService(moduleServices.prisma, moduleServices.emailService);

// Export function to replace services for testing
export function __replaceServices(newServices: Partial<typeof moduleServices>) {
  if (newServices.prisma) {
    moduleServices.prisma = newServices.prisma;
  }
  if (newServices.emailService) {
    moduleServices.emailService = newServices.emailService;
  }
  if (newServices.groupService) {
    moduleServices.groupService = newServices.groupService;
  } else if (newServices.prisma || newServices.emailService) {
    // Recreate groupService if prisma or emailService changed
    moduleServices.groupService = new GroupService(
      moduleServices.prisma,
      moduleServices.emailService
    );
  }
}

// Export function to reset services
export function __resetServices() {
  moduleServices.prisma = new PrismaClient();
  moduleServices.emailService = EmailServiceFactory.getInstance();
  moduleServices.groupService = new GroupService(moduleServices.prisma, moduleServices.emailService);
}

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * POST /validate-invite - Validate invitation code (public)
 */
const validateInviteRoute = createRoute({
  method: 'post',
  path: '/validate-invite',
  tags: ['Groups'],
  summary: 'Validate group invitation code',
  description: 'Validate a group invitation code without authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidateInviteSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(InvitationValidationSchema),
        },
      },
      description: 'Invitation code validation result',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid invite code',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Invalid invite code',
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
 * POST /groups - Create group
 */
const createGroupRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Groups'],
  summary: 'Create a new group',
  description: 'Create a new group with the authenticated user as admin',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateGroupSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupResponseSchema),
        },
      },
      description: 'Group created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
 * POST /groups/join - Join group
 */
const joinGroupRoute = createRoute({
  method: 'post',
  path: '/join',
  tags: ['Groups'],
  summary: 'Join a group',
  description: 'Join a group using invitation code',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: JoinGroupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupResponseSchema),
        },
      },
      description: 'Joined group successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid invite code',
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
      description: 'Not found - Invalid invite code',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Conflict - Already member or no family',
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
 * GET /groups/my-groups - Get user groups
 */
const getMyGroupsRoute = createRoute({
  method: 'get',
  path: '/my-groups',
  tags: ['Groups'],
  summary: 'Get user groups',
  description: 'Get all groups the authenticated user belongs to',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(GroupResponseSchema)),
        },
      },
      description: 'User groups retrieved successfully',
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
 * GET /groups/:groupId/families - Get group families
 */
const getGroupFamiliesRoute = createRoute({
  method: 'get',
  path: '/{groupId}/families',
  tags: ['Groups'],
  summary: 'Get group families',
  description: 'Get all families in a group',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(EnrichedGroupFamilySchema)),
        },
      },
      description: 'Group families retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Forbidden - Not a group member',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Group does not exist',
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
 * PATCH /groups/:groupId/families/:familyId/role - Update family role
 */
const updateFamilyRoleRoute = createRoute({
  method: 'patch',
  path: '/{groupId}/families/{familyId}/role',
  tags: ['Groups'],
  summary: 'Update family role in group',
  description: 'Update a family role within a group',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyRoleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateFamilyRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(UpdateFamilyRoleResponseSchema),
        },
      },
      description: 'Family role updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
      description: 'Not found - Group or family does not exist',
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
 * DELETE /groups/:groupId/families/:familyId - Remove family from group
 */
const removeFamilyFromGroupRoute = createRoute({
  method: 'delete',
  path: '/{groupId}/families/{familyId}',
  tags: ['Groups'],
  summary: 'Remove family from group',
  description: 'Remove a family from a group',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyRoleParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Family removed from group successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid IDs',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
      description: 'Not found - Group or family does not exist',
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
 * PATCH /groups/:groupId - Update group
 */
const updateGroupRoute = createRoute({
  method: 'patch',
  path: '/{groupId}',
  tags: ['Groups'],
  summary: 'Update group',
  description: 'Update group information',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateGroupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupResponseSchema),
        },
      },
      description: 'Group updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
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
      description: 'Not found - Group does not exist',
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
 * DELETE /groups/:groupId - Delete group
 */
const deleteGroupRoute = createRoute({
  method: 'delete',
  path: '/{groupId}',
  tags: ['Groups'],
  summary: 'Delete group',
  description: 'Delete a group (group admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Group deleted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Forbidden - Not group admin',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Group does not exist',
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
 * POST /groups/:groupId/leave - Leave group
 */
const leaveGroupRoute = createRoute({
  method: 'post',
  path: '/{groupId}/leave',
  tags: ['Groups'],
  summary: 'Leave group',
  description: 'Leave a group',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Left group successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Forbidden - Cannot leave as last admin',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Group does not exist',
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
 * POST /validate-invite - Validate invitation code (public)
 */
app.openapi(validateInviteRoute, async (c) => {
  const input = c.req.valid('json');

  logger.info('validateInviteCode', { inviteCode: `${input.inviteCode.substring(0, 8)}...` });

  try {
    const result = await moduleServices.groupService.validateInvitationCode(input.inviteCode.trim());

    if (!result.valid) {
      logger.warn('validateInviteCode: invalid code', { inviteCode: `${input.inviteCode.substring(0, 8)}...` });
      return c.json({
        success: false,
        error: result.error || 'Invalid invitation code',
        code: 'INVALID_INVITE',
      }, 400);
    }

    logger.info('validateInviteCode: success', { inviteCode: `${input.inviteCode.substring(0, 8)}...` });

    return c.json({
      success: true,
      data: {
        valid: true,
        group: result.group ? {
          id: result.group.id,
          name: result.group.name,
          inviteCode: '',
          createdBy: '',
          createdAt: '',
          updatedAt: '',
        } : null,
        userStatus: 'FAMILY_MEMBER' as const,
        actionRequired: 'READY_TO_JOIN' as const,
      },
    }, 200);
  } catch (error) {
    logger.error('validateInviteCode', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to validate invitation code',
      code: 'VALIDATION_FAILED',
    }, 500);
  }
});

/**
 * POST /groups - Create group
 */
app.openapi(createGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  logger.info('createGroup', { userId, name: input.name, userEmail: user?.email });

  try {
    // Get user's family
    const userFamily = await moduleServices.prisma.familyMember.findFirst({
      where: { userId },
      select: { familyId: true, role: true },
    });

    if (!userFamily) {
      logger.warn('createGroup: user without family', { userId });
      return c.json({
        success: false,
        error: 'User must belong to a family to create groups',
        code: 'NO_FAMILY',
      }, 403);
    }

    if (userFamily.role !== 'ADMIN') {
      logger.warn('createGroup: insufficient permissions', { userId, familyId: userFamily.familyId });
      return c.json({
        success: false,
        error: 'Only family administrators can create groups',
        code: 'INSUFFICIENT_PERMISSIONS',
      }, 403);
    }

    const group = await moduleServices.groupService.createGroup({
      name: input.name,
      description: input.description,
      familyId: userFamily.familyId,
      createdBy: userId,
    });

    logger.info('createGroup: success', { userId, groupId: group.id });
    return c.json({
      success: true,
      data: group,
    }, 201);
  } catch (error) {
    logger.error('createGroup', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to create group',
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * POST /groups/join - Join group
 */
app.openapi(joinGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  logger.info('joinGroup', { userId, inviteCode: `${input.inviteCode.substring(0, 8)}...`, userEmail: user?.email });

  try {
    const membership = await moduleServices.groupService.joinGroupByInviteCode(input.inviteCode.trim(), userId);

    logger.info('joinGroup: success', { userId, membershipId: membership.id });
    return c.json({
      success: true,
      data: membership,
    }, 200);
  } catch (error: any) {
    logger.error('joinGroup', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to join group',
      code: error.code || 'JOIN_FAILED',
    }, statusCode);
  }
});

/**
 * GET /groups/my-groups - Get user groups
 */
app.openapi(getMyGroupsRoute, async (c) => {
  const userId = c.get('userId');

  logger.info('getMyGroups', { userId });

  try {
    const groups = await moduleServices.groupService.getUserGroups(userId);

    logger.info('getMyGroups: success', { userId, count: groups.length });
    return c.json({
      success: true,
      data: groups,
    }, 200);
  } catch (error) {
    logger.error('getMyGroups', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to retrieve user groups',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * GET /groups/:groupId/families - Get group families
 */
app.openapi(getGroupFamiliesRoute, async (c) => {
  const userId = c.get('userId');
  const { groupId } = c.req.valid('param');

  logger.info('getGroupFamilies', { userId, groupId });

  try {
    const families = await moduleServices.groupService.getGroupFamilies(groupId, userId);

    logger.info('getGroupFamilies: success', { userId, groupId, count: families.length });
    return c.json({
      success: true,
      data: families,
    }, 200);
  } catch (error: any) {
    logger.error('getGroupFamilies', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to retrieve group families',
      code: error.code || 'RETRIEVE_FAILED',
    }, statusCode);
  }
});

/**
 * PATCH /groups/:groupId/families/:familyId/role - Update family role
 */
app.openapi(updateFamilyRoleRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId, familyId } = c.req.valid('param');
  const { role } = c.req.valid('json');

  logger.info('updateFamilyRole', { userId, groupId, familyId, role, userEmail: user?.email });

  try {
    const membership = await moduleServices.groupService.updateFamilyRole(groupId, familyId, role as 'ADMIN' | 'MEMBER', userId);

    logger.info('updateFamilyRole: success', { userId, groupId, familyId, role });
    return c.json({
      success: true,
      data: membership,
    }, 200);
  } catch (error: any) {
    logger.error('updateFamilyRole', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to update family role',
      code: error.code || 'UPDATE_FAILED',
    }, statusCode);
  }
});

/**
 * DELETE /groups/:groupId/families/:familyId - Remove family from group
 */
app.openapi(removeFamilyFromGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId, familyId } = c.req.valid('param');

  logger.info('removeFamilyFromGroup', { userId, groupId, familyId, userEmail: user?.email });

  try {
    await moduleServices.groupService.removeFamilyFromGroup(groupId, familyId, userId);

    logger.info('removeFamilyFromGroup: success', { userId, groupId, familyId });
    return c.json({
      success: true,
      message: 'Family removed from group successfully',
    }, 200);
  } catch (error: any) {
    logger.error('removeFamilyFromGroup', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to remove family from group',
      code: error.code || 'REMOVE_FAILED',
    }, statusCode);
  }
});

/**
 * PATCH /groups/:groupId - Update group
 */
app.openapi(updateGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');
  const updateData = c.req.valid('json');

  logger.info('updateGroup', { userId, groupId, userEmail: user?.email });

  try {
    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const filteredUpdateData: { name?: string; description?: string } = {};
    if (updateData.name !== undefined) {
      filteredUpdateData.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      filteredUpdateData.description = updateData.description;
    }
    const group = await moduleServices.groupService.updateGroup(groupId, userId, filteredUpdateData);

    logger.info('updateGroup: success', { userId, groupId });
    return c.json({
      success: true,
      data: group,
    }, 200);
  } catch (error: any) {
    logger.error('updateGroup', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to update group',
      code: error.code || 'UPDATE_FAILED',
    }, statusCode);
  }
});

/**
 * DELETE /groups/:groupId - Delete group
 */
app.openapi(deleteGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');

  logger.info('deleteGroup', { userId, groupId, userEmail: user?.email });

  try {
    await moduleServices.groupService.deleteGroup(groupId, userId);

    logger.info('deleteGroup: success', { userId, groupId });
    return c.json({
      success: true,
      message: 'Group deleted successfully',
    }, 200);
  } catch (error: any) {
    logger.error('deleteGroup', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to delete group',
      code: error.code || 'DELETE_FAILED',
    }, statusCode);
  }
});

/**
 * POST /groups/:groupId/leave - Leave group
 */
app.openapi(leaveGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');

  logger.info('leaveGroup', { userId, groupId, userEmail: user?.email });

  try {
    await moduleServices.groupService.leaveGroup(groupId, userId);

    logger.info('leaveGroup: success', { userId, groupId });
    return c.json({
      success: true,
      message: 'Left group successfully',
    }, 200);
  } catch (error: any) {
    logger.error('leaveGroup', { error: error instanceof Error ? error.message : String(error) });
    const statusCode = error.statusCode || 500;
    return c.json({
      success: false,
      error: error.message || 'Failed to leave group',
      code: error.code || 'LEAVE_FAILED',
    }, statusCode);
  }
});

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

/**
 * Create controller with dependencies for testing
 * This allows tests to inject mocked services
 */
export function createGroupControllerWithDeps(deps: {
  prisma?: PrismaClient;
  groupService?: GroupService;
}): OpenAPIHono<{ Variables: GroupVariables }> {
  // Replace module services with provided mocks
  __replaceServices(deps);

  const testApp = new OpenAPIHono<{ Variables: GroupVariables }>();

  // Copy all routes from app to testApp (now using replaced module services)
  testApp.route('/', app);

  return testApp;
}

// Note: GroupVariables type is already exported above (line 36)
export default app;
