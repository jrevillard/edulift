/**
 * Group Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for groups endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { GroupService } from '../../services/GroupService';
import { GroupScheduleConfigService } from '../../services/GroupScheduleConfigService';
import { EmailServiceFactory } from '../../services/EmailServiceFactory';
import { createLogger } from '../../utils/logger';
import { getErrorInfo } from '../../middleware/errorHandler';

// Type for GroupScheduleConfig with group included (service returns this but type doesn't declare it)
interface GroupScheduleConfigWithGroup {
  id: string | null;
  groupId: string;
  scheduleHours: Record<string, string[]>;
  group?: {
    id: string;
    name: string;
  };
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Import all schemas
import {
  CreateGroupSchema,
  JoinGroupSchema,
  UpdateGroupSchema,
  UpdateFamilyRoleSchema,
  InviteFamilySchema,
  SearchFamiliesQuerySchema,
  GroupParamsSchema,
  FamilyRoleParamsSchema,
  GroupResponseSchema,
  UpdateFamilyRoleResponseSchema,
  EnrichedGroupFamilySchema,
  FamilySearchResultSchema,
  GroupInvitationSchema,
  SimpleSuccessResponseSchema,
  createSuccessSchema,
  UpdateScheduleConfigRequestSchema,
  GroupScheduleConfigResponseSchema,
} from '../../schemas/groups';
import { ErrorResponseSchema } from '../../schemas/responses';

// Hono type for context with userId
export type GroupVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Error response schema
const createErrorResponseSchema = () => {
  return ErrorResponseSchema;
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create GroupController with injected dependencies
 * For production: call without params (uses real services)
 * For tests: inject mocked services
 */
export function createGroupControllerRoutes(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  emailService?: any;
  groupService?: GroupService;
  scheduleConfigService?: GroupScheduleConfigService;
} = {}): OpenAPIHono<{ Variables: GroupVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('GroupController');
  const emailServiceInstance = dependencies.emailService ?? EmailServiceFactory.getInstance();
  const groupServiceInstance = dependencies.groupService ?? new GroupService(prismaInstance, emailServiceInstance);
  const scheduleConfigServiceInstance = dependencies.scheduleConfigService ?? new GroupScheduleConfigService(prismaInstance);

  // Create app
  const app = new OpenAPIHono<{ Variables: GroupVariables }>();

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================


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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Insufficient permissions',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid invite code',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Invalid invite code',
    },
    409: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Conflict - Already member or no family',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Not a group member',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group or family does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /groups/:groupId/invite - Invite family to group
 */
const inviteFamilyRoute = createRoute({
  method: 'post',
  path: '/{groupId}/invite',
  tags: ['Groups'],
  summary: 'Invite a family to join a group',
  description: 'Send an invitation to a family to join a group (group admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: InviteFamilySchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupInvitationSchema),
        },
      },
      description: 'Family invited successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Only group admins can send invitations',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group or family does not exist',
    },
    409: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Conflict - Family already invited or member',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /groups/:groupId/search-families - Search families for invitation
 */
const searchFamiliesRoute = createRoute({
  method: 'post',
  path: '/{groupId}/search-families',
  tags: ['Groups'],
  summary: 'Search families to invite to group',
  description: 'Search for families by name that can be invited to join a group (group admin only). Excludes families already members or with pending invitations.',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: SearchFamiliesQuerySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(FamilySearchResultSchema)),
        },
      },
      description: 'Families searched successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Only group admins can search families',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createSuccessSchema(GroupResponseSchema),
        },
      },
      description: 'Family removed from group successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid IDs',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group or family does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Not group admin',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Cannot leave as last admin',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Internal server error',
    },
  },
});

// ============================================================================
// SCHEDULE CONFIG ROUTES DEFINITIONS
// ============================================================================

/**
 * GET /groups/:groupId/schedule-config - Get schedule config
 */
const getScheduleConfigRoute = createRoute({
  method: 'get',
  path: '/{groupId}/schedule-config',
  tags: ['Groups'],
  summary: 'Get group schedule configuration',
  description: 'Get the schedule configuration for a group',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupScheduleConfigResponseSchema),
        },
      },
      description: 'Schedule configuration retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Access denied to group schedule configuration',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Schedule configuration not found',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * PUT /groups/:groupId/schedule-config - Update schedule config
 */
const updateScheduleConfigRoute = createRoute({
  method: 'put',
  path: '/{groupId}/schedule-config',
  tags: ['Groups'],
  summary: 'Update group schedule configuration',
  description: 'Update the schedule configuration for a group (group admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateScheduleConfigRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupScheduleConfigResponseSchema),
        },
      },
      description: 'Schedule configuration updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid input',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Only group administrators can modify schedule configuration',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /groups/:groupId/schedule-config/reset - Reset schedule config
 */
const resetScheduleConfigRoute = createRoute({
  method: 'post',
  path: '/{groupId}/schedule-config/reset',
  tags: ['Groups'],
  summary: 'Reset schedule configuration to default',
  description: 'Reset the schedule configuration to default values (group admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(GroupScheduleConfigResponseSchema),
        },
      },
      description: 'Schedule configuration reset successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Bad request - Invalid group ID',
    },
    401: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Unauthorized - Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Forbidden - Only group administrators can reset schedule configuration',
    },
    404: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
        },
      },
      description: 'Not found - Group does not exist',
    },
    500: {
      content: {
        'application/json': {
          schema: createErrorResponseSchema(),
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
 * POST /groups - Create group
 */
app.openapi(createGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  loggerInstance.info('createGroup', { userId, name: input.name, userEmail: user?.email });

  try {
    // Get user's family
    const userFamily = await prismaInstance.familyMember.findFirst({
      where: { userId },
      select: { familyId: true, role: true },
    });

    if (!userFamily) {
      loggerInstance.warn('createGroup: user without family', { userId });
      return c.json({
        success: false,
        error: 'User must belong to a family to create groups',
      code: 'NO_FAMILY' as const,
      }, 403);
    }

    if (userFamily.role !== 'ADMIN') {
      loggerInstance.warn('createGroup: insufficient permissions', { userId, familyId: userFamily.familyId });
      return c.json({
        success: false,
        error: 'Only family administrators can create groups',
      code: 'INSUFFICIENT_PERMISSIONS' as const,
      }, 403);
    }

    const group = await groupServiceInstance.createGroup({
      name: input.name,
      description: input.description,
      familyId: userFamily.familyId,
      createdBy: userId,
    });

    loggerInstance.info('createGroup: success', { userId, groupId: group.id });
    return c.json({
      success: true,
      data: group,
    }, 201);
  } catch (error) {
    loggerInstance.error('createGroup', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to create group',
      code: 'CREATE_FAILED' as const,
    }, 500);
  }
});

/**
 * POST /groups/join - Join group
 */
app.openapi(joinGroupRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const user = c.get('user');
  const input = c.req.valid('json');

  loggerInstance.info('joinGroup', { userId, inviteCode: `${input.inviteCode.substring(0, 8)}...`, userEmail: user?.email });

  try {
    const membership = await groupServiceInstance.joinGroupByInviteCode(input.inviteCode.trim(), userId);

    loggerInstance.info('joinGroup: success', { userId, membershipId: membership.id });
    return c.json({
      success: true,
      data: membership,
    }, 200);
  } catch (error) {
    loggerInstance.error('joinGroup', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'JOIN_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'JOIN_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * GET /groups/my-groups - Get user groups
 */
app.openapi(getMyGroupsRoute, async (c) => {
  const userId = c.get('userId');

  loggerInstance.info('getMyGroups', { userId });

  try {
    const groups = await groupServiceInstance.getUserGroups(userId);

    loggerInstance.info('getMyGroups: success', { userId, count: groups.length });
    return c.json({
      success: true,
      data: groups,
    }, 200);
  } catch (error) {
    loggerInstance.error('getMyGroups', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to retrieve user groups',
      code: 'RETRIEVE_FAILED' as const,
    }, 500);
  }
});

/**
 * GET /groups/:groupId/families - Get group families
 */
app.openapi(getGroupFamiliesRoute, async (c) => {
  const userId = c.get('userId');
  const { groupId } = c.req.valid('param');

  loggerInstance.info('getGroupFamilies', { userId, groupId });

  try {
    const families = await groupServiceInstance.getGroupFamilies(groupId, userId);

    loggerInstance.info('getGroupFamilies: success', { userId, groupId, count: families.length });
    return c.json({
      success: true,
      data: families,
    }, 200);
  } catch (error) {
    loggerInstance.error('getGroupFamilies', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'RETRIEVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RETRIEVE_FAILED' as const,
    }, statusCode as 500);
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

  loggerInstance.info('updateFamilyRole', { userId, groupId, familyId, role, userEmail: user?.email });

  try {
    const membership = await groupServiceInstance.updateFamilyRole(groupId, familyId, role as 'ADMIN' | 'MEMBER', userId);

    loggerInstance.info('updateFamilyRole: success', { userId, groupId, familyId, role });
    return c.json({
      success: true,
      data: membership,
    }, 200);
  } catch (error) {
    loggerInstance.error('updateFamilyRole', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'UPDATE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'UPDATE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * POST /groups/:groupId/invite - Invite family to group
 */
app.openapi(inviteFamilyRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');
  const inviteData = c.req.valid('json');

  loggerInstance.info('inviteFamilyById', {
    userId,
    groupId,
    familyId: inviteData.familyId,
    role: inviteData.role,
    userEmail: user?.email,
  });

  try {
    // Build inviteData conditionally to handle exactOptionalPropertyTypes
    const serviceInviteData: {
      familyId: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
      personalMessage?: string;
    } = {
      familyId: inviteData.familyId,
      role: inviteData.role,
    };
    if (inviteData.personalMessage !== undefined && inviteData.personalMessage !== null) {
      serviceInviteData.personalMessage = inviteData.personalMessage;
    }

    const invitation = await groupServiceInstance.inviteFamilyById(
      groupId,
      serviceInviteData,
      userId,
    );

    if (!invitation) {
      return c.json({
        success: false,
        error: 'Failed to create invitation',
      code: 'INVITE_FAILED' as const,
      }, 500);
    }

    loggerInstance.info('inviteFamilyById: success', {
      userId,
      groupId,
      familyId: inviteData.familyId,
      invitationId: invitation.id,
    });
    return c.json({
      success: true,
      data: invitation as any,
    }, 201);
  } catch (error) {
    loggerInstance.error('inviteFamilyById', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      groupId,
      familyId: inviteData.familyId,
    });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'INVITE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'INVITE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * POST /groups/:groupId/search-families - Search families for invitation
 */
app.openapi(searchFamiliesRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');
  const { searchTerm } = c.req.valid('json');

  loggerInstance.info('searchFamiliesForInvitation', {
    userId,
    groupId,
    searchTerm: `${searchTerm.substring(0, 20)}...`,
    userEmail: user?.email,
  });

  try {
    const families = await groupServiceInstance.searchFamiliesForInvitation(
      searchTerm,
      userId,
      groupId,
    );

    loggerInstance.info('searchFamiliesForInvitation: success', {
      userId,
      groupId,
      count: families.length,
    });
    return c.json({
      success: true,
      data: families,
    }, 200);
  } catch (error) {
    loggerInstance.error('searchFamiliesForInvitation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      groupId,
      searchTerm: `${searchTerm.substring(0, 20)}...`,
    });

    // Map error messages to expected error codes
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'Only group administrators can perform this action') {
      return c.json({
        success: false,
        error: 'User is not a group admin',
        code: 'FORBIDDEN' as const,
      }, 403);
    }
    if (errorMessage === 'Group not found') {
      return c.json({
        success: false,
        error: 'Group not found',
        code: 'GROUP_NOT_FOUND' as const,
      }, 404);
    }

    // Fallback to generic error
    return c.json({
      success: false,
      error: errorMessage,
      code: 'SEARCH_FAILED' as const,
    }, 500);
  }
});

/**
 * DELETE /groups/:groupId/families/:familyId - Remove family from group
 */
app.openapi(removeFamilyFromGroupRoute, async (c): Promise<any> => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId, familyId } = c.req.valid('param');

  loggerInstance.info('removeFamilyFromGroup', { userId, groupId, familyId, userEmail: user?.email });

  try {
    const updatedGroup = await groupServiceInstance.removeFamilyFromGroup(groupId, familyId, userId);

    loggerInstance.info('removeFamilyFromGroup: success', { userId, groupId, familyId });
    return c.json({
      success: true,
      data: updatedGroup,
    }, 200);
  } catch (error) {
    loggerInstance.error('removeFamilyFromGroup', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'REMOVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'REMOVE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 409 | 500);
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

  loggerInstance.info('updateGroup', { userId, groupId, userEmail: user?.email });

  try {
    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const filteredUpdateData: { name?: string; description?: string } = {};
    if (updateData.name !== undefined) {
      filteredUpdateData.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      filteredUpdateData.description = updateData.description;
    }
    const group = await groupServiceInstance.updateGroup(groupId, userId, filteredUpdateData);

    loggerInstance.info('updateGroup: success', { userId, groupId });
    return c.json({
      success: true,
      data: group,
    }, 200);
  } catch (error) {
    loggerInstance.error('updateGroup', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'UPDATE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'UPDATE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * DELETE /groups/:groupId - Delete group
 */
app.openapi(deleteGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');

  loggerInstance.info('deleteGroup', { userId, groupId, userEmail: user?.email });

  try {
    await groupServiceInstance.deleteGroup(groupId, userId);

    loggerInstance.info('deleteGroup: success', { userId, groupId });
    return c.json({
      success: true,
      message: 'Group deleted successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('deleteGroup', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'DELETE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'DELETE_FAILED' as const,
    }, statusCode as 403 | 404 | 500);
  }
});

/**
 * POST /groups/:groupId/leave - Leave group
 */
app.openapi(leaveGroupRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');

  loggerInstance.info('leaveGroup', { userId, groupId, userEmail: user?.email });

  try {
    await groupServiceInstance.leaveGroup(groupId, userId);

    loggerInstance.info('leaveGroup: success', { userId, groupId });
    return c.json({
      success: true,
      message: 'Left group successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('leaveGroup', { error: error instanceof Error ? error.message : String(error) });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'LEAVE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'LEAVE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

// ============================================================================
// SCHEDULE CONFIG HANDLERS
// ============================================================================

/**
 * GET /groups/:groupId/schedule-config - Get schedule config
 */
app.openapi(getScheduleConfigRoute, async (c) => {
  const userId = c.get('userId');
  const { groupId } = c.req.valid('param');

  loggerInstance.info('getScheduleConfig', { userId, groupId });

  try {
    const config = await scheduleConfigServiceInstance.getGroupScheduleConfig(groupId, userId) as GroupScheduleConfigWithGroup;

    // Transform Prisma JsonValue to expected format with explicit typing
    const scheduleHours = config.scheduleHours as Record<string, string[]>;
    const responseData = {
      id: config.id,  // null for default empty config (not persisted)
      groupId: config.groupId,
      scheduleHours: {
        MONDAY: scheduleHours.MONDAY || [],
        TUESDAY: scheduleHours.TUESDAY || [],
        WEDNESDAY: scheduleHours.WEDNESDAY || [],
        THURSDAY: scheduleHours.THURSDAY || [],
        FRIDAY: scheduleHours.FRIDAY || [],
      },
      group: config.group,
      createdAt: config.createdAt ? config.createdAt.toISOString() : null,
      updatedAt: config.updatedAt ? config.updatedAt.toISOString() : null,
    };

    loggerInstance.info('getScheduleConfig: success', { userId, groupId, configId: config.id || 'default-empty' });
    return c.json({
      success: true,
      data: responseData,
    }, 200);
  } catch (error) {
    loggerInstance.error('getScheduleConfig', { error: error instanceof Error ? error.message : String(error), userId, groupId });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'FETCH_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'FETCH_FAILED' as const,
    }, statusCode as 500);
  }
});

/**
 * PUT /groups/:groupId/schedule-config - Update schedule config
 */
app.openapi(updateScheduleConfigRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');
  const { scheduleHours } = c.req.valid('json');

  loggerInstance.info('updateScheduleConfig', { userId, groupId, userEmail: user?.email });

  try {
    const config = await scheduleConfigServiceInstance.updateGroupScheduleConfig(
      groupId,
      scheduleHours,
      userId,
      user?.timezone || 'UTC',
    ) as GroupScheduleConfigWithGroup;

    // Transform Prisma JsonValue to expected format with explicit typing
    const configScheduleHours = config.scheduleHours as Record<string, string[]>;
    const responseData = {
      id: config.id,
      groupId: config.groupId,
      scheduleHours: {
        MONDAY: configScheduleHours.MONDAY || [],
        TUESDAY: configScheduleHours.TUESDAY || [],
        WEDNESDAY: configScheduleHours.WEDNESDAY || [],
        THURSDAY: configScheduleHours.THURSDAY || [],
        FRIDAY: configScheduleHours.FRIDAY || [],
      },
      group: config.group,
      createdAt: (config.createdAt as Date).toISOString(),
      updatedAt: (config.updatedAt as Date).toISOString(),
    };

    loggerInstance.info('updateScheduleConfig: success', { userId, groupId, configId: config.id });
    return c.json({
      success: true,
      data: responseData,
    }, 200);
  } catch (error) {
    loggerInstance.error('updateScheduleConfig', { error: error instanceof Error ? error.message : String(error), userId, groupId });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'UPDATE_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'UPDATE_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

/**
 * POST /groups/:groupId/schedule-config/reset - Reset schedule config
 */
app.openapi(resetScheduleConfigRoute, async (c) => {
  const userId = c.get('userId');
  const user = c.get('user');
  const { groupId } = c.req.valid('param');

  loggerInstance.info('resetScheduleConfig', { userId, groupId, userEmail: user?.email });

  try {
    const config = await scheduleConfigServiceInstance.resetGroupScheduleConfig(groupId, userId) as GroupScheduleConfigWithGroup;

    // Transform Prisma JsonValue to expected format with explicit typing
    const configScheduleHours = config.scheduleHours as Record<string, string[]>;
    const responseData = {
      id: config.id,
      groupId: config.groupId,
      scheduleHours: {
        MONDAY: configScheduleHours.MONDAY || [],
        TUESDAY: configScheduleHours.TUESDAY || [],
        WEDNESDAY: configScheduleHours.WEDNESDAY || [],
        THURSDAY: configScheduleHours.THURSDAY || [],
        FRIDAY: configScheduleHours.FRIDAY || [],
      },
      group: config.group,
      createdAt: (config.createdAt as Date).toISOString(),
      updatedAt: (config.updatedAt as Date).toISOString(),
    };

    loggerInstance.info('resetScheduleConfig: success', { userId, groupId, configId: config.id });
    return c.json({
      success: true,
      data: responseData,
    }, 200);
  } catch (error) {
    loggerInstance.error('resetScheduleConfig', { error: error instanceof Error ? error.message : String(error), userId, groupId });
    const { statusCode, message: errorMessage } = getErrorInfo(error, 'RESET_FAILED');
    return c.json({
      success: false,
      error: errorMessage,
      code: 'RESET_FAILED' as const,
    }, statusCode as 400 | 403 | 404 | 500);
  }
});

  return app;
}

// Default export for backward compatibility (uses real services)
export default createGroupControllerRoutes();
