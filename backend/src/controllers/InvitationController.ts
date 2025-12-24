/**
 * Invitation Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for invitation endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { UnifiedInvitationService, CreateFamilyInvitationData, CreateGroupInvitationData } from '../services/UnifiedInvitationService';
import { createLogger } from '../utils/logger';
import { EmailService } from '../services/EmailService';

// Import Hono-native schemas
import {
  CreateFamilyInvitationSchema,
  CreateGroupInvitationSchema,
  AcceptFamilyInvitationSchema,
  InvitationCodeParamsSchema,
  InvitationIdParamsSchema,
  FamilyInvitationResponseSchema,
  GroupInvitationResponseSchema,
  InvitationValidationSchema,
  UserInvitationsSchema,
  AcceptInvitationResponseSchema,
  CancelInvitationResponseSchema,
} from '../schemas/invitations';

const logger = createLogger('InvitationController');

// Type for Hono context with userId
type InvitationVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const app = new OpenAPIHono<{ Variables: InvitationVariables }>();

// Initialize services
const prisma = new PrismaClient();

// EmailService configuration for development (to be replaced with real configuration in production)
const emailService = new EmailService({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'test@example.com',
    pass: process.env.SMTP_PASS || 'test',
  },
});

const invitationService = new UnifiedInvitationService(prisma, logger, emailService);

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Invitation not found',
    description: 'Error message',
  }),
  code: z.string().optional().openapi({
    example: 'INVITATION_NOT_FOUND',
    description: 'Error code for programmatic handling',
  }),
});

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * GET /invitations/validate/:code - Validate invitation code (public)
 */
const validateInvitationRoute = createRoute({
  method: 'get',
  path: '/validate/{code}',
  tags: ['Invitations'],
  summary: 'Validate invitation code (public)',
  description: 'Validate an invitation code without authentication. Checks both family and group invitations.',
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: InvitationValidationSchema,
        },
      },
      description: 'Invitation validation result',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invitation not found or invalid',
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
 * POST /invitations/family - Create family invitation
 */
const createFamilyInvitationRoute = createRoute({
  method: 'post',
  path: '/family',
  tags: ['Invitations'],
  summary: 'Create family invitation',
  description: 'Create a new family invitation. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateFamilyInvitationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: FamilyInvitationResponseSchema,
        },
      },
      description: 'Family invitation created successfully',
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
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Conflict - Already a member or family full',
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
 * GET /invitations/family/:code/validate - Validate family invitation
 */
const validateFamilyInvitationRoute = createRoute({
  method: 'get',
  path: '/family/{code}/validate',
  tags: ['Invitations'],
  summary: 'Validate family invitation',
  description: 'Validate a family invitation code. Authentication is optional.',
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: InvitationValidationSchema,
        },
      },
      description: 'Family invitation validation result',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invitation not found or invalid',
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
 * POST /invitations/family/:code/accept - Accept family invitation
 */
const acceptFamilyInvitationRoute = createRoute({
  method: 'post',
  path: '/family/{code}/accept',
  tags: ['Invitations'],
  summary: 'Accept family invitation',
  description: 'Accept a family invitation using the invitation code',
  security: [{ Bearer: [] }],
  request: {
    params: InvitationCodeParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: AcceptFamilyInvitationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AcceptInvitationResponseSchema,
        },
      },
      description: 'Family invitation accepted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Cannot accept invitation',
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
 * POST /invitations/group - Create group invitation
 */
const createGroupInvitationRoute = createRoute({
  method: 'post',
  path: '/group',
  tags: ['Invitations'],
  summary: 'Create group invitation',
  description: 'Create a new group invitation. Requires group admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateGroupInvitationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: GroupInvitationResponseSchema,
        },
      },
      description: 'Group invitation created successfully',
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
      description: 'Not found - Group or target family not found',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Conflict - Already a member or pending invitation',
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
 * GET /invitations/group/:code/validate - Validate group invitation
 */
const validateGroupInvitationRoute = createRoute({
  method: 'get',
  path: '/group/{code}/validate',
  tags: ['Invitations'],
  summary: 'Validate group invitation',
  description: 'Validate a group invitation code. Authentication is optional.',
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: InvitationValidationSchema,
        },
      },
      description: 'Group invitation validation result',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invitation not found or invalid',
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
 * POST /invitations/group/:code/accept - Accept group invitation
 */
const acceptGroupInvitationRoute = createRoute({
  method: 'post',
  path: '/group/{code}/accept',
  tags: ['Invitations'],
  summary: 'Accept group invitation',
  description: 'Accept a group invitation using the invitation code',
  security: [{ Bearer: [] }],
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AcceptInvitationResponseSchema,
        },
      },
      description: 'Group invitation accepted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Cannot accept invitation',
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
 * GET /invitations/user - Get user invitations
 */
const getUserInvitationsRoute = createRoute({
  method: 'get',
  path: '/user',
  tags: ['Invitations'],
  summary: 'Get user invitations',
  description: 'Retrieve all pending invitations for the authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserInvitationsSchema,
        },
      },
      description: 'User invitations retrieved successfully',
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
 * DELETE /invitations/family/:invitationId - Cancel family invitation
 */
const cancelFamilyInvitationRoute = createRoute({
  method: 'delete',
  path: '/family/{invitationId}',
  tags: ['Invitations'],
  summary: 'Cancel family invitation',
  description: 'Cancel a pending family invitation. Requires family admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    params: InvitationIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CancelInvitationResponseSchema,
        },
      },
      description: 'Family invitation cancelled successfully',
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
      description: 'Invitation not found',
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
 * DELETE /invitations/group/:invitationId - Cancel group invitation
 */
const cancelGroupInvitationRoute = createRoute({
  method: 'delete',
  path: '/group/{invitationId}',
  tags: ['Invitations'],
  summary: 'Cancel group invitation',
  description: 'Cancel a pending group invitation. Requires group admin permissions.',
  security: [{ Bearer: [] }],
  request: {
    params: InvitationIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CancelInvitationResponseSchema,
        },
      },
      description: 'Group invitation cancelled successfully',
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
      description: 'Invitation not found',
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
 * GET /invitations/validate/:code - Validate invitation code (public)
 */
app.openapi(validateInvitationRoute, async (c) => {
  const { code } = c.req.valid('param');
  const currentUserId = c.get('userId');

  logger.info('validateInvitationCode', { code, hasAuth: !!currentUserId });

  try {
    // Try family validation
    const familyValidation = await invitationService.validateFamilyInvitation(code, currentUserId);
    if (familyValidation.valid) {
      logger.info('validateInvitationCode: valid family invitation', { code });
      return c.json({
        valid: true,
        type: 'FAMILY' as const,
        family: {
          id: familyValidation.familyId!,
          name: familyValidation.familyName!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        email: familyValidation.email,
        role: familyValidation.role,
        personalMessage: familyValidation.personalMessage,
      }, 200);
    }

    // Try group validation
    const groupValidation = await invitationService.validateGroupInvitation(code, currentUserId);
    if (groupValidation.valid) {
      logger.info('validateInvitationCode: valid group invitation', { code });
      return c.json({
        valid: true,
        type: 'GROUP' as const,
        group: {
          id: groupValidation.groupId!,
          name: groupValidation.groupName!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        email: groupValidation.email,
      }, 200);
    }

    // No valid invitation found
    logger.info('validateInvitationCode: invalid invitation', { code });
    return c.json({
      success: false as const,
      error: familyValidation.error || groupValidation.error || 'Invalid invitation code',
    }, 404);

  } catch (error) {
    logger.error('validateInvitationCode: server error', { code, error });
    return c.json({
      success: false,
      error: 'Validation failed. Please try again.',
      code: 'VALIDATION_FAILED',
    }, 500);
  }
});

/**
 * POST /invitations/family - Create family invitation
 */
app.openapi(createFamilyInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const input = c.req.valid('json');

  logger.info('createFamilyInvitation', { userId, familyId: input.familyId, email: input.email, role: input.role });

  try {
    const invitationData: CreateFamilyInvitationData = {
      email: input.email,
      role: input.role,
      ...(input.personalMessage && { personalMessage: input.personalMessage }),
    };

    const invitation = await invitationService.createFamilyInvitation(
      input.familyId,
      invitationData,
      userId
    );

    logger.info('createFamilyInvitation: family invitation created', {
      userId,
      invitationId: invitation.id,
      familyId: input.familyId,
      email: input.email
    });

    // Transform Prisma response to match schema
    const response = {
      ...invitation,
      email: invitation.email || input.email,
    };

    return c.json(response, 201);

  } catch (error) {
    logger.error('createFamilyInvitation: error', { userId, error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to create family invitation';

    if (errorMessage.includes('Only family administrators can send invitations')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'FORBIDDEN',
      }, 403);
    }
    if (errorMessage.includes('already a member') || errorMessage.includes('already exists') || errorMessage.includes('Family has reached maximum capacity')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'CONFLICT',
      }, 409);
    }

    return c.json({
      success: false,
      error: 'Failed to create family invitation',
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * GET /invitations/family/:code/validate - Validate family invitation
 */
app.openapi(validateFamilyInvitationRoute, async (c) => {
  const { code } = c.req.valid('param');
  const currentUserId = c.get('userId');

  logger.info('validateFamilyInvitation', { code, hasAuth: !!currentUserId });

  try {
    const validation = await invitationService.validateFamilyInvitation(code, currentUserId);

    if (validation.valid) {
      logger.info('validateFamilyInvitation: valid family invitation', { code });
      return c.json({
        valid: true,
        type: 'FAMILY' as const,
        family: {
          id: validation.familyId!,
          name: validation.familyName!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        email: validation.email,
        role: validation.role,
        personalMessage: validation.personalMessage,
      }, 200);
    } else {
      logger.info('validateFamilyInvitation: invalid family invitation', { code, error: validation.error });
      return c.json({
        success: false as const,
        error: validation.error || 'Invalid family invitation',
        code: 'INVALID_INVITATION',
      }, 404);
    }
  } catch (error) {
    logger.error('validateFamilyInvitation: error', { code, error });
    return c.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
    }, 500);
  }
});

/**
 * POST /invitations/family/:code/accept - Accept family invitation
 */
app.openapi(acceptFamilyInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const { code } = c.req.valid('param');
  const { leaveCurrentFamily } = c.req.valid('json');

  logger.info('acceptFamilyInvitation', { userId, code, leaveCurrentFamily });

  try {
    const result = await invitationService.acceptFamilyInvitation(code, userId, { leaveCurrentFamily });

    if (result.success) {
      logger.info('acceptFamilyInvitation: family invitation accepted', { userId, code });
      return c.json({
        success: true,
        message: 'Family invitation accepted successfully',
      }, 200);
    } else {
      logger.warn('acceptFamilyInvitation: accept failed', { userId, code, error: result.error });
      return c.json({
        success: false,
        error: result.error || 'Failed to accept family invitation',
        code: 'ACCEPT_FAILED',
      }, 400);
    }
  } catch (error) {
    logger.error('acceptFamilyInvitation: error', { userId, code, error });
    return c.json({
      success: false,
      error: 'Failed to accept family invitation',
      code: 'ACCEPT_FAILED',
    }, 500);
  }
});

/**
 * POST /invitations/group - Create group invitation
 */
app.openapi(createGroupInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const input = c.req.valid('json');

  logger.info('createGroupInvitation', { userId, groupId: input.groupId, targetFamilyId: input.targetFamilyId, email: input.email, role: input.role });

  try {
    const invitationData: CreateGroupInvitationData = {
      role: input.role,
      ...(input.targetFamilyId && { targetFamilyId: input.targetFamilyId }),
      ...(input.email && { email: input.email }),
      ...(input.personalMessage && { personalMessage: input.personalMessage }),
    };

    const invitation = await invitationService.createGroupInvitation(
      input.groupId,
      invitationData,
      userId
    );

    logger.info('createGroupInvitation: group invitation created', {
      userId,
      invitationId: invitation.id,
      groupId: input.groupId,
      targetFamilyId: input.targetFamilyId,
      email: input.email
    });

    // Transform Prisma response to match schema
    const response = {
      ...invitation,
      // Ensure role matches the enum type
      role: invitation.role as 'ADMIN' | 'MEMBER',
    };

    return c.json(response, 201);

  } catch (error) {
    logger.error('createGroupInvitation: error', { userId, error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to create group invitation';

    if (errorMessage.includes('Only') && errorMessage.includes('administrators can')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'FORBIDDEN',
      }, 403);
    }
    if (errorMessage.includes('not found')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'NOT_FOUND',
      }, 404);
    }
    if (errorMessage.includes('already') || errorMessage.includes('pending invitation')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'CONFLICT',
      }, 409);
    }
    if (errorMessage.includes('Either targetFamilyId or email must be provided')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'INVALID_INPUT',
      }, 400);
    }

    return c.json({
      success: false,
      error: 'Failed to create group invitation',
      code: 'CREATE_FAILED',
    }, 500);
  }
});

/**
 * GET /invitations/group/:code/validate - Validate group invitation
 */
app.openapi(validateGroupInvitationRoute, async (c) => {
  const { code } = c.req.valid('param');
  const currentUserId = c.get('userId');

  logger.info('validateGroupInvitation', { code, hasAuth: !!currentUserId });

  try {
    const validation = await invitationService.validateGroupInvitation(code, currentUserId);

    if (validation.valid) {
      logger.info('validateGroupInvitation: valid group invitation', { code });
      return c.json({
        valid: true,
        type: 'GROUP' as const,
        group: {
          id: validation.groupId!,
          name: validation.groupName!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        email: validation.email,
      }, 200);
    } else {
      logger.info('validateGroupInvitation: invalid group invitation', { code, error: validation.error });
      return c.json({
        success: false as const,
        error: validation.error || 'Invalid group invitation',
        code: 'INVALID_INVITATION',
      }, 404);
    }
  } catch (error) {
    logger.error('validateGroupInvitation: error', { code, error });
    return c.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
    }, 500);
  }
});

/**
 * POST /invitations/group/:code/accept - Accept group invitation
 */
app.openapi(acceptGroupInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const { code } = c.req.valid('param');

  logger.info('acceptGroupInvitation', { userId, code });

  try {
    const result = await invitationService.acceptGroupInvitation(code, userId);

    if (result.success) {
      logger.info('acceptGroupInvitation: group invitation accepted', { userId, code });
      return c.json({
        success: true,
        message: 'Group invitation accepted successfully',
      }, 200);
    } else {
      logger.warn('acceptGroupInvitation: accept failed', { userId, code, error: result.error });

      return c.json({
        success: false,
        error: result.error || 'Failed to accept group invitation',
        code: result.error?.includes('Family onboarding required') ? 'FAMILY_ONBOARDING_REQUIRED' : 'ACCEPT_FAILED',
        requiresFamilyOnboarding: result.error?.includes('Family onboarding required') ? true : undefined,
      }, 400);
    }
  } catch (error) {
    logger.error('acceptGroupInvitation: error', { userId, code, error });
    return c.json({
      success: false,
      error: 'Failed to accept group invitation',
      code: 'ACCEPT_FAILED',
    }, 500);
  }
});

/**
 * GET /invitations/user - Get user invitations
 */
app.openapi(getUserInvitationsRoute, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('user').email;

  logger.info('listUserInvitations', { userId });

  try {
    // Get full invitation data with family/group info directly from Prisma
    const [familyInvitations, groupInvitations] = await Promise.all([
      prisma.familyInvitation.findMany({
        where: {
          email: userEmail,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: { family: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.groupInvitation.findMany({
        where: {
          email: userEmail,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: { group: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    logger.info('listUserInvitations: invitations retrieved', {
      userId,
      familyCount: familyInvitations.length,
      groupCount: groupInvitations.length
    });

    return c.json({
      family: familyInvitations.map(inv => ({
        id: inv.id,
        familyId: inv.familyId,
        email: inv.email,
        role: inv.role as 'ADMIN' | 'MEMBER',
        status: 'PENDING' as const,
        personalMessage: inv.personalMessage,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        family: {
          id: inv.family.id,
          name: inv.family.name,
          createdAt: inv.family.createdAt.toISOString(),
          updatedAt: inv.family.updatedAt.toISOString(),
        },
      })),
      group: groupInvitations.map(inv => ({
        id: inv.id,
        groupId: inv.groupId,
        targetFamilyId: inv.targetFamilyId,
        email: inv.email,
        role: inv.role as 'ADMIN' | 'MEMBER',
        status: 'PENDING' as const,
        personalMessage: inv.personalMessage,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        group: {
          id: inv.group.id,
          name: inv.group.name,
          createdAt: inv.group.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: inv.group.updatedAt?.toISOString() || new Date().toISOString(),
        },
      })),
    }, 200);
  } catch (error) {
    logger.error('listUserInvitations: error', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve invitations',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * DELETE /invitations/family/:invitationId - Cancel family invitation
 */
app.openapi(cancelFamilyInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const { invitationId } = c.req.valid('param');

  logger.info('cancelFamilyInvitation', { userId, invitationId });

  try {
    await invitationService.cancelFamilyInvitation(invitationId, userId);

    logger.info('cancelFamilyInvitation: family invitation cancelled', { userId, invitationId });

    return c.json({
      message: 'Family invitation cancelled successfully'
    }, 200);

  } catch (error) {
    logger.error('cancelFamilyInvitation: error', { userId, invitationId, error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel family invitation';

    if (errorMessage.includes('Only family administrators can cancel invitations')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'FORBIDDEN',
      }, 403);
    }
    if (errorMessage.includes('not found')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'NOT_FOUND',
      }, 404);
    }

    return c.json({
      success: false,
      error: 'Failed to cancel family invitation',
      code: 'CANCEL_FAILED',
    }, 500);
  }
});

/**
 * DELETE /invitations/group/:invitationId - Cancel group invitation
 */
app.openapi(cancelGroupInvitationRoute, async (c) => {
  const userId = c.get('userId');
  const { invitationId } = c.req.valid('param');

  logger.info('cancelGroupInvitation', { userId, invitationId });

  try {
    await invitationService.cancelGroupInvitation(invitationId, userId);

    logger.info('cancelGroupInvitation: group invitation cancelled', { userId, invitationId });

    return c.json({
      message: 'Group invitation cancelled successfully'
    }, 200);

  } catch (error) {
    logger.error('cancelGroupInvitation: error', { userId, invitationId, error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel group invitation';

    if (errorMessage.includes('Only group administrators can cancel invitations')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'FORBIDDEN',
      }, 403);
    }
    if (errorMessage.includes('not found')) {
      return c.json({
        success: false,
        error: errorMessage,
        code: 'NOT_FOUND',
      }, 404);
    }

    return c.json({
      success: false,
      error: 'Failed to cancel group invitation',
      code: 'CANCEL_FAILED',
    }, 500);
  }
});

export default app;
