/**
 * Family Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for families endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { FamilyService } from '../services/FamilyService';
import { FamilyAuthService } from '../services/FamilyAuthService';
import { FamilyRole } from '../types/family';
import { createLogger } from '../utils/logger';
import { normalizeError } from '../utils/errorHandler';
import { EmailServiceFactory } from '../services/EmailServiceFactory';

// Import Hono-native schemas
import {
  CreateFamilySchema,
  JoinFamilySchema,
  UpdateMemberRoleSchema,
  UpdateFamilyNameSchema,
  InviteMemberSchema,
  ValidateInviteCodeSchema,
  FamilyIdParamsSchema,
  MemberIdParamsSchema,
  FamilyMemberParamsSchema,
  FamilyInvitationParamsSchema,
  FamilyResponseSchema,
  FamilyPermissionsSchema,
  FamilyInvitationSchema,
  InviteCodeValidationSchema,
} from '../schemas/families';

// Hono type for context with userId
type FamilyVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Error message',
    description: 'Error message',
  }),
  code: z.string().optional().openapi({
    example: 'ERROR_CODE',
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

// Simple success response schema
const SimpleSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string()
    .openapi({
      example: 'Operation completed successfully',
      description: 'Success message',
    }),
});

// Family permissions success response schema (non-generic to avoid type inference issues)
const FamilyPermissionsSuccessSchema = z.object({
  success: z.literal(true),
  data: FamilyPermissionsSchema,
}).openapi({
  title: 'Family Permissions Success',
  description: 'Successful response with family permissions',
});

/**
 * Transform family data to ISO strings for OpenAPI compliance
 */
const transformFamilyForResponse = (family: any): any => {
  if (!family) return family;

  const now = new Date().toISOString();

  return {
    ...family,
    createdAt: family.createdAt ? new Date(family.createdAt).toISOString() : now,
    updatedAt: family.updatedAt ? new Date(family.updatedAt).toISOString() : now,
  };
};

// Mock cache service for now (should be replaced with real cache service)
const createMockCacheService = () => ({
  async get(_key: string): Promise<null> { return null; },
  async set(_key: string, _value: any, _ttl: number): Promise<void> { return; },
});

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create FamilyController with injected dependencies
 * For production: call without params (uses real services)
 * For tests: inject mocked services
 */
export function createFamilyControllerRoutes(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  emailService?: any;
  cacheService?: any;
  familyService?: FamilyService;
  familyAuthService?: FamilyAuthService;
} = {}): OpenAPIHono<{ Variables: FamilyVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('FamilyController');
  const emailServiceInstance = dependencies.emailService ?? EmailServiceFactory.getInstance();
  const cacheServiceInstance = dependencies.cacheService ?? createMockCacheService();

  // Initialize familyService with dependencies
  const familyServiceInstance = dependencies.familyService ?? new FamilyService(
    prismaInstance,
    loggerInstance,
    undefined,
    emailServiceInstance
  );

  // Initialize familyAuthService with dependencies
  const familyAuthServiceInstance = dependencies.familyAuthService ?? new FamilyAuthService(
    prismaInstance,
    cacheServiceInstance
  );

  // Create app
  const app = new OpenAPIHono<{ Variables: FamilyVariables }>();

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * POST /families/validate-invite - Validate invitation code (public)
 */
const validateInviteCodeRoute = createRoute({
  method: 'post',
  path: '/validate-invite',
  tags: ['Families'],
  summary: 'Validate family invitation code',
  description: 'Validate a family invitation code without authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidateInviteCodeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: InviteCodeValidationSchema,
        },
      },
      description: 'Invitation code validation result',
    },
    400: {
      content: {
        'application/json': {
          schema: InviteCodeValidationSchema,
        },
      },
      description: 'Bad request - Invalid invite code (returns valid: false)',
    },
    500: {
      content: {
        'application/json': {
          schema: InviteCodeValidationSchema,
        },
      },
      description: 'Internal server error (returns valid: false)',
    },
  },
});

/**
 * POST /families - Create family
 */
const createFamilyRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Families'],
  summary: 'Create a new family',
  description: 'Create a new family with the authenticated user as admin',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateFamilySchema,
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
      description: 'Family created successfully',
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
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Conflict - Already belongs to a family',
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
 * POST /families/join - Join family
 */
const joinFamilyRoute = createRoute({
  method: 'post',
  path: '/join',
  tags: ['Families'],
  summary: 'Join a family',
  description: 'Join a family using invitation code',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: JoinFamilySchema,
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
      description: 'Joined family successfully',
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
      description: 'Conflict - Already belongs to a family',
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
 * GET /families/current - Get current family
 */
const getCurrentFamilyRoute = createRoute({
  method: 'get',
  path: '/current',
  tags: ['Families'],
  summary: 'Get current family',
  description: 'Get the authenticated user current family',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(FamilyResponseSchema),
        },
      },
      description: 'Current family retrieved successfully',
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
      description: 'Not found - No family found',
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
 * GET /families/{familyId}/permissions - Get family permissions
 */
const getFamilyPermissionsRoute = createRoute({
  method: 'get',
  path: '/{familyId}/permissions',
  tags: ['Families'],
  summary: 'Get family permissions',
  description: 'Get authenticated user permissions within a family',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FamilyPermissionsSuccessSchema,
        },
      },
      description: 'Family permissions retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid family ID',
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
      description: 'Forbidden - Not a family member',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Family does not exist',
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
 * PUT /families/members/{memberId}/role - Update member role
 */
const updateMemberRoleRoute = createRoute({
  method: 'put',
  path: '/members/{memberId}/role',
  tags: ['Families'],
  summary: 'Update member role',
  description: 'Update a family member role',
  security: [{ Bearer: [] }],
  request: {
    params: MemberIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateMemberRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Member role updated successfully',
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
      description: 'Not found - Member does not exist',
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
 * POST /families/{familyId}/invite - Invite member
 */
const inviteMemberRoute = createRoute({
  method: 'post',
  path: '/{familyId}/invite',
  tags: ['Families'],
  summary: 'Invite family member',
  description: 'Send invitation to join family',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: InviteMemberSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(FamilyInvitationSchema),
        },
      },
      description: 'Invitation sent successfully',
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
      description: 'Not found - Family does not exist',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Conflict - User already invited or member',
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
 * GET /families/{familyId}/invitations - Get family invitations
 */
const getFamilyInvitationsRoute = createRoute({
  method: 'get',
  path: '/{familyId}/invitations',
  tags: ['Families'],
  summary: 'Get family invitations',
  description: 'Get all pending invitations for a family',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(z.array(FamilyInvitationSchema)),
        },
      },
      description: 'Family invitations retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid family ID',
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
      description: 'Not found - Family does not exist',
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
 * DELETE /families/{familyId}/invitations/{invitationId} - Delete invitation
 */
const deleteInvitationRoute = createRoute({
  method: 'delete',
  path: '/{familyId}/invitations/{invitationId}',
  tags: ['Families'],
  summary: 'Delete family invitation',
  description: 'Delete a pending family invitation',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyInvitationParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Invitation deleted successfully',
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
      description: 'Not found - Invitation does not exist',
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
 * PUT /families/name - Update family name
 */
const updateFamilyNameRoute = createRoute({
  method: 'put',
  path: '/name',
  tags: ['Families'],
  summary: 'Update family name',
  description: 'Update the current family name',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateFamilyNameSchema,
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
      description: 'Family name updated successfully',
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
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - No family found',
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
 * DELETE /families/{familyId}/members/{memberId} - Remove member
 */
const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/{familyId}/members/{memberId}',
  tags: ['Families'],
  summary: 'Remove family member',
  description: 'Remove a member from the family',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyMemberParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Member removed successfully',
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
      description: 'Forbidden - Insufficient permissions or cannot remove last admin',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Not found - Member or family does not exist',
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
 * POST /families/{familyId}/leave - Leave family
 */
const leaveFamilyRoute = createRoute({
  method: 'post',
  path: '/{familyId}/leave',
  tags: ['Families'],
  summary: 'Leave family',
  description: 'Leave the current family',
  security: [{ Bearer: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SimpleSuccessResponseSchema,
        },
      },
      description: 'Left family successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid family ID',
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
      description: 'Not found - Family does not exist',
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
 * POST /families/validate-invite - Validate invitation code (public)
 */
app.openapi(validateInviteCodeRoute, async (c) => {
  const { inviteCode } = c.req.valid('json');

  loggerInstance.info('validateInviteCode', { inviteCode: `${inviteCode.substring(0, 8)}...` });

  try {
    const result = await familyServiceInstance.validateInviteCode(inviteCode.trim());

    if (!result) {
      loggerInstance.warn('validateInviteCode: invalid code', { inviteCode: `${inviteCode.substring(0, 8)}...` });
      return c.json({
        valid: false,
        family: null,
      }, 400);
    }

    loggerInstance.info('validateInviteCode: success', { inviteCode: `${inviteCode.substring(0, 8)}...` });

    // Return basic family info from validateInviteCode
    const now = new Date().toISOString();
    return c.json({
      valid: true,
      family: {
        id: result.id,
        name: result.name,
        inviteCode: '',
        createdAt: now,
        updatedAt: now,
        members: [],
        vehicles: [],
        children: [],
      },
    }, 200);
  } catch (error) {
    loggerInstance.error('validateInviteCode: error', { error });
    return c.json({
      valid: false,
      family: null,
    }, 500);
  }
});

/**
 * POST /families - Create family
 */
app.openapi(createFamilyRoute, async (c) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  loggerInstance.info('createFamily', { userId, name });

  try {
    // Check if user already belongs to a family
    const existingFamily = await familyServiceInstance.getUserFamily(userId);
    if (existingFamily) {
      loggerInstance.warn('createFamily: user already belongs to a family', { userId });
      return c.json({
        success: false,
        error: 'User already belongs to a family',
        code: 'ALREADY_IN_FAMILY',
      }, 409);
    }

    const family = await familyServiceInstance.createFamily(name, userId);

    loggerInstance.info('createFamily: success', { userId, familyId: family.id });
    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 201);
  } catch (error) {
    loggerInstance.error('createFamily: error', { userId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * POST /families/join - Join family
 */
app.openapi(joinFamilyRoute, async (c) => {
  const userId = c.get('userId');
  const { inviteCode } = c.req.valid('json');

  loggerInstance.info('joinFamily', { userId, inviteCode: `${inviteCode.substring(0, 8)}...` });

  try {
    const family = await familyServiceInstance.joinFamily(inviteCode.trim(), userId);

    loggerInstance.info('joinFamily: success', { userId, familyId: family.id });
    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 200);
  } catch (error) {
    loggerInstance.error('joinFamily: error', { userId, error });
    const normalizedError = normalizeError(error);
    const statusCode = normalizedError.statusCode === 404 ? 404 : 400;
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'JOIN_FAILED',
    }, statusCode);
  }
});

/**
 * GET /families/current - Get current family
 */
app.openapi(getCurrentFamilyRoute, async (c) => {
  const userId = c.get('userId');

  loggerInstance.info('getCurrentFamily', { userId });

  try {
    const family = await familyServiceInstance.getUserFamily(userId);
    if (!family) {
      loggerInstance.warn('getCurrentFamily: no family found', { userId });
      return c.json({
        success: false,
        error: 'No family found',
        code: 'NO_FAMILY',
      }, 404);
    }

    loggerInstance.info('getCurrentFamily: success', { userId, familyId: family.id });
    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 200);
  } catch (error) {
    loggerInstance.error('getCurrentFamily: error', { userId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * GET /families/{familyId}/permissions - Get family permissions
 */
app.openapi(getFamilyPermissionsRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId } = c.req.valid('param');

  loggerInstance.info('getFamilyPermissions', { userId, familyId });

  try {
    // Verify user belongs to this family
    const userFamily = await familyServiceInstance.getUserFamily(userId);

    if (!userFamily || userFamily.id !== familyId) {
      loggerInstance.warn('getFamilyPermissions: access denied', { userId, familyId });
      return c.json({
        success: false,
        error: 'Access denied: not a member of this family',
        code: 'ACCESS_DENIED',
      }, 403);
    }

    const permissions = await familyAuthServiceInstance.getUserPermissions(userId);

    loggerInstance.info('getFamilyPermissions: success', { userId, familyId });
    return c.json({
      success: true,
      data: permissions,
    }, 200);
  } catch (error) {
    loggerInstance.error('getFamilyPermissions: error', { userId, familyId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'PERMISSION_CHECK_FAILED',
    }, 500);
  }
});

/**
 * PUT /families/members/{memberId}/role - Update member role
 */
app.openapi(updateMemberRoleRoute, async (c) => {
  const userId = c.get('userId');
  const { memberId } = c.req.valid('param');
  const { role } = c.req.valid('json');

  loggerInstance.info('updateMemberRole', { userId, memberId, role });

  try {
    // Check permissions (only admins can change roles)
    await familyAuthServiceInstance.requireFamilyRole(userId, FamilyRole.ADMIN);

    await familyServiceInstance.updateMemberRole(userId, memberId, role as FamilyRole);

    loggerInstance.info('updateMemberRole: success', { userId, memberId, role });
    return c.json({
      success: true,
      message: 'Member role updated successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('updateMemberRole: error', { userId, memberId, error });
    const normalizedError = normalizeError(error);
    const statusCode = normalizedError.message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 500;
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'UPDATE_FAILED',
    }, statusCode);
  }
});

/**
 * POST /families/{familyId}/invite - Invite member
 */
app.openapi(inviteMemberRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId } = c.req.valid('param');
  const { email, role, personalMessage } = c.req.valid('json');

  loggerInstance.info('inviteMember', { userId, familyId, email, role });

  try {
    const inviteData: { email: string; role: FamilyRole; personalMessage?: string } = {
      email,
      role: role as FamilyRole,
    };
    if (personalMessage) {
      inviteData.personalMessage = personalMessage;
    }

    const invitation = await familyServiceInstance.inviteMember(familyId, inviteData, userId);

    loggerInstance.info('inviteMember: success', { userId, familyId, email, role });
    return c.json({
      success: true,
      data: invitation,
    }, 201);
  } catch (error) {
    loggerInstance.error('inviteMember: error', { userId, familyId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'INVITE_FAILED',
    }, 400);
  }
});

/**
 * GET /families/{familyId}/invitations - Get family invitations
 */
app.openapi(getFamilyInvitationsRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId } = c.req.valid('param');

  loggerInstance.info('getFamilyInvitations', { userId, familyId });

  try {
    // Verify user belongs to this family
    const userFamily = await familyServiceInstance.getUserFamily(userId);

    if (!userFamily || userFamily.id !== familyId) {
      loggerInstance.warn('getFamilyInvitations: access denied', { userId, familyId });
      return c.json({
        success: false,
        error: 'Access denied: not a member of this family',
        code: 'ACCESS_DENIED',
      }, 403);
    }

    const invitations = await familyServiceInstance.getPendingInvitations(familyId);

    loggerInstance.info('getFamilyInvitations: success', { userId, familyId, count: invitations.length });
    return c.json({
      success: true,
      data: invitations,
    }, 200);
  } catch (error) {
    loggerInstance.error('getFamilyInvitations: error', { userId, familyId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * DELETE /families/{familyId}/invitations/{invitationId} - Delete invitation
 */
app.openapi(deleteInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId, invitationId } = c.req.valid('param');

  loggerInstance.info('deleteInvitation', { userId, familyId, invitationId });

  try {
    // Verify user belongs to this family
    const userFamily = await familyServiceInstance.getUserFamily(userId);

    if (!userFamily || userFamily.id !== familyId) {
      loggerInstance.warn('deleteInvitation: access denied', { userId, familyId });
      return c.json({
        success: false,
        error: 'Access denied: not a member of this family',
        code: 'ACCESS_DENIED',
      }, 403);
    }

    await familyServiceInstance.cancelInvitation(familyId, invitationId, userId);

    loggerInstance.info('deleteInvitation: success', { userId, familyId, invitationId });
    return c.json({
      success: true,
      message: 'Invitation deleted successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('deleteInvitation: error', { userId, familyId, invitationId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'DELETE_FAILED',
    }, 400);
  }
});

/**
 * PUT /families/name - Update family name
 */
app.openapi(updateFamilyNameRoute, async (c) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  loggerInstance.info('updateFamilyName', { userId, name });

  try {
    const family = await familyServiceInstance.updateFamilyName(userId, name);

    loggerInstance.info('updateFamilyName: success', { userId, familyId: family.id, name });
    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 200);
  } catch (error) {
    loggerInstance.error('updateFamilyName: error', { userId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'UPDATE_FAILED',
    }, 400);
  }
});

/**
 * DELETE /families/{familyId}/members/{memberId} - Remove member
 */
app.openapi(removeMemberRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId, memberId } = c.req.valid('param');

  loggerInstance.info('removeMember', { userId, familyId, memberId });

  try {
    // Verify user belongs to this family and has admin permissions
    await familyAuthServiceInstance.requireFamilyRole(userId, FamilyRole.ADMIN);

    await familyServiceInstance.removeMember(userId, memberId);

    loggerInstance.info('removeMember: success', { userId, familyId, memberId });
    return c.json({
      success: true,
      message: 'Member removed successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('removeMember: error', { userId, familyId, memberId, error });
    const normalizedError = normalizeError(error);
    const statusCode = normalizedError.message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 500;
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'REMOVE_FAILED',
    }, statusCode);
  }
});

/**
 * POST /families/{familyId}/leave - Leave family
 */
app.openapi(leaveFamilyRoute, async (c) => {
  const userId = c.get('userId');
  const { familyId } = c.req.valid('param');

  loggerInstance.info('leaveFamily', { userId, familyId });

  try {
    // Verify user belongs to this family
    const userFamily = await familyServiceInstance.getUserFamily(userId);

    if (!userFamily || userFamily.id !== familyId) {
      loggerInstance.warn('leaveFamily: access denied', { userId, familyId });
      return c.json({
        success: false,
        error: 'Access denied: not a member of this family',
        code: 'ACCESS_DENIED',
      }, 403);
    }

    await familyServiceInstance.leaveFamily(userId);

    loggerInstance.info('leaveFamily: success', { userId, familyId });
    return c.json({
      success: true,
      message: 'Left family successfully',
    }, 200);
  } catch (error) {
    loggerInstance.error('leaveFamily: error', { userId, familyId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'LEAVE_FAILED',
    }, 400);
  }
});

  return app;
}

// Default export for backward compatibility (uses real services)
export default createFamilyControllerRoutes();

// Export the type for use in other files
export type { FamilyVariables };
