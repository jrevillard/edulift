/**
 * Invitation Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for invitation endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { UnifiedInvitationService, CreateFamilyInvitationData, CreateGroupInvitationData } from '../../services/UnifiedInvitationService';
import { createLogger } from '../../utils/logger';
import { getErrorInfo } from '../../middleware/errorHandler';
import { EmailServiceFactory } from '../../services/EmailServiceFactory';
import {
  createControllerLogger,
} from '../../utils/controllerLogging';

// Import Hono-native schemas
import {
  CreateFamilyInvitationSchema,
  CreateGroupInvitationSchema,
  AcceptFamilyInvitationSchema,
  InvitationCodeParamsSchema,
  InvitationIdParamsSchema,
  FamilyInvitationResponseSchema,
  GroupInvitationResponseSchema,
  FamilyInvitationValidationSchema,
  GroupInvitationValidationSchema,
  AcceptInvitationResponseSchema,
  CancelInvitationResponseSchema,
} from '../../schemas/invitations';
import { ErrorResponseSchema } from '../../schemas/responses';

// Type for Hono context with userId
type InvitationVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create InvitationController with injected dependencies
 * For production: call without params (uses real services)
 * For tests: inject mocked services
 */
export const createInvitationControllerRoutes = function(dependencies: {
  prisma?: PrismaClient;
  logger?: any;
  emailService?: any;
  invitationService?: UnifiedInvitationService;
} = {}): OpenAPIHono<{ Variables: InvitationVariables }> {

  // Create or use injected services
  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = dependencies.logger ?? createLogger('InvitationController');

  // Use EmailServiceFactory for consistent email configuration
  const emailServiceInstance = dependencies.emailService ?? EmailServiceFactory.getInstance();

  const invitationServiceInstance = dependencies.invitationService ?? new UnifiedInvitationService(prismaInstance, loggerInstance, emailServiceInstance);

  // Create controller logger for comprehensive request logging
  const invitationLogger = createControllerLogger('InvitationController');

  // Create app
  const app = new OpenAPIHono<{ Variables: InvitationVariables }>();

  // ============================================================================
  // OPENAPI ROUTES DEFINITIONS
  // ============================================================================


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
      503: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
        description: 'Email service temporarily unavailable',
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
            schema: FamilyInvitationValidationSchema,
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
      503: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
        description: 'Email service temporarily unavailable',
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
            schema: GroupInvitationValidationSchema,
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
   * POST /invitations/family - Create family invitation
   */
  app.openapi(createFamilyInvitationRoute, async (c) => {
    const userId = c.get('userId');
    const input = c.req.valid('json');

    invitationLogger.logStart('createFamilyInvitation', c, {
      businessContext: {
        userId,
        familyId: input.familyId,
        email: input.email,
        role: input.role,
      },
    });

    try {
      const invitationData: CreateFamilyInvitationData = {
        email: input.email,
        role: input.role,
        ...(input.personalMessage && { personalMessage: input.personalMessage }),
      };

      const invitation = await invitationServiceInstance.createFamilyInvitation(
        input.familyId,
        invitationData,
        userId,
      );

      invitationLogger.logSuccess('createFamilyInvitation', c, {
        userId,
        invitationId: invitation.id,
        familyId: input.familyId,
      });

      // Transform Prisma response to match schema
      const response = {
        ...invitation,
        email: invitation.email || input.email,
      };

      return c.json(response, 201);

    } catch (error: unknown) {
      invitationLogger.logError('createFamilyInvitation', c, error as Error | string);

      const { message: errorMessage, code: errorCode } = getErrorInfo(error, 'CREATE_FAILED');

      // Check if this is an email service error
      if (errorCode === 'EMAIL_SERVICE_UNAVAILABLE') {
        return c.json({
          success: false as const,
          error: 'Email service temporarily unavailable. Please try again later.',
      code: 'EMAIL_SERVICE_UNAVAILABLE' as const,
          retryable: true,
        }, 503);
      }

      if (errorMessage.includes('Only family administrators can send invitations')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'FORBIDDEN' as const,
        }, 403);
      }
      if (errorMessage.includes('already a member') || errorMessage.includes('already exists') || errorMessage.includes('Family has reached maximum capacity')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'CONFLICT' as const,
        }, 409);
      }

      return c.json({
        success: false as const,
        error: 'Failed to create family invitation',
      code: 'CREATE_FAILED' as const,
      }, 500);
    }
  });

  /**
   * GET /invitations/family/:code/validate - Validate family invitation
   */
  app.openapi(validateFamilyInvitationRoute, async (c) => {
    const { code } = c.req.valid('param');
    const currentUserId = c.get('userId');

    invitationLogger.logStart('validateFamilyInvitation', c, {
      businessContext: { code, hasAuth: !!currentUserId, currentUserId },
    });

    try {
      const validation = await invitationServiceInstance.validateFamilyInvitation(code, currentUserId);
      

      if (validation.valid) {
        invitationLogger.logSuccess('validateFamilyInvitation', c, { code, valid: true });
        return c.json({
          valid: true,
          type: 'FAMILY' as const,
          family: {
            id: validation.familyId!,
            name: validation.familyName!,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          email: validation.email ?? undefined,
          role: validation.role ?? undefined,
          personalMessage: validation.personalMessage ?? undefined,
          ...(validation.inviterName && { inviterName: validation.inviterName }),
          ...(validation.existingUser !== undefined && { existingUser: validation.existingUser }),
          ...(validation.userCurrentFamily !== undefined && { userCurrentFamily: validation.userCurrentFamily }),
          ...(validation.canLeaveCurrentFamily !== undefined && { canLeaveCurrentFamily: validation.canLeaveCurrentFamily }),
          ...(validation.cannotLeaveReason !== undefined && { cannotLeaveReason: validation.cannotLeaveReason }),
        }, 200);
      } else {
        invitationLogger.logWarning('validateFamilyInvitation', c, 'Invalid family invitation', {
          code,
          error: validation.error,
          errorCode: validation.errorCode,
        });
        return c.json({
          valid: false,
          type: 'FAMILY' as const,
          ...(validation.email && { email: validation.email }),
          ...(validation.inviterName && { inviterName: validation.inviterName }),
          ...(validation.existingUser !== undefined && { existingUser: validation.existingUser }),
          ...(validation.errorCode && { errorCode: validation.errorCode }),
        }, 200);
      }
    } catch (error: unknown) {
      invitationLogger.logError('validateFamilyInvitation', c, error as Error | string);
      return c.json({
        success: false as const,
        error: 'Validation failed',
      code: 'VALIDATION_FAILED' as const,
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

    invitationLogger.logStart('acceptFamilyInvitation', c, {
      businessContext: {
        userId,
        code,
        leaveCurrentFamily,
      },
    });

    try {
      const result = await invitationServiceInstance.acceptFamilyInvitation(code, userId, { leaveCurrentFamily });

      if (result.success) {
        invitationLogger.logSuccess('acceptFamilyInvitation', c, { userId, code });
        return c.json({
          success: true,
          message: 'Family invitation accepted successfully',
        }, 200);
      } else {
        invitationLogger.logWarning('acceptFamilyInvitation', c, result.error || 'Accept failed');
        return c.json({
          success: false as const,
          error: result.error || 'Failed to accept family invitation',
      code: 'ACCEPT_FAILED' as const,
        }, 400);
      }
    } catch (error: unknown) {
      invitationLogger.logError('acceptFamilyInvitation', c, error as Error | string);
      return c.json({
        success: false as const,
        error: 'Failed to accept family invitation',
      code: 'ACCEPT_FAILED' as const,
      }, 500);
    }
  });

  /**
   * POST /invitations/group - Create group invitation
   */
  app.openapi(createGroupInvitationRoute, async (c) => {
    const userId = c.get('userId');
    const input = c.req.valid('json');

    invitationLogger.logStart('createGroupInvitation', c, {
      businessContext: {
        userId,
        groupId: input.groupId,
        targetFamilyId: input.targetFamilyId,
        email: input.email,
        role: input.role,
      },
    });

    try {
      const invitationData: CreateGroupInvitationData = {
        role: input.role,
        ...(input.targetFamilyId && { targetFamilyId: input.targetFamilyId }),
        ...(input.email && { email: input.email }),
        ...(input.personalMessage && { personalMessage: input.personalMessage }),
      };

      const invitation = await invitationServiceInstance.createGroupInvitation(
        input.groupId,
        invitationData,
        userId,
      );

      if (!invitation) {
        invitationLogger.logWarning('createGroupInvitation', c, 'Failed to create - no invitation returned');
        return c.json({
          success: false,
          error: 'Failed to create group invitation',
      code: 'CREATE_FAILED' as const,
        }, 500);
      }

      invitationLogger.logSuccess('createGroupInvitation', c, {
        userId,
        invitationId: invitation.id,
        groupId: input.groupId,
      });

      // Transform Prisma response to match schema
      const response = {
        ...invitation,
        // Ensure role matches the enum type
        role: invitation.role as 'ADMIN' | 'MEMBER',
      };

      return c.json(response, 201);

    } catch (error: unknown) {
      invitationLogger.logError('createGroupInvitation', c, error as Error | string);

      const { message: errorMessage, code: errorCode } = getErrorInfo(error, 'CREATE_FAILED');

      // Check if this is an email service error
      if (errorCode === 'EMAIL_SERVICE_UNAVAILABLE') {
        return c.json({
          success: false as const,
          error: 'Email service temporarily unavailable. Please try again later.',
      code: 'EMAIL_SERVICE_UNAVAILABLE' as const,
          retryable: true,
        }, 503);
      }

      if (errorMessage.includes('Only') && errorMessage.includes('administrators can')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'FORBIDDEN' as const,
        }, 403);
      }
      if (errorMessage.includes('not found')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'NOT_FOUND' as const,
        }, 404);
      }
      if (errorMessage.includes('already') || errorMessage.includes('pending invitation')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'CONFLICT' as const,
        }, 409);
      }
      if (errorMessage.includes('Either targetFamilyId or email must be provided')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'INVALID_INPUT' as const,
        }, 400);
      }

      return c.json({
        success: false as const,
        error: 'Failed to create group invitation',
      code: 'CREATE_FAILED' as const,
      }, 500);
    }
  });

  /**
   * GET /invitations/group/:code/validate - Validate group invitation
   */
  app.openapi(validateGroupInvitationRoute, async (c) => {
    const { code } = c.req.valid('param');
    const currentUserId = c.get('userId');

    invitationLogger.logStart('validateGroupInvitation', c, {
      businessContext: { code, hasAuth: !!currentUserId },
    });

    try {
      const validation = await invitationServiceInstance.validateGroupInvitation(code, currentUserId);

      if (validation.valid) {
        invitationLogger.logSuccess('validateGroupInvitation', c, { code, valid: true });
        return c.json({
          valid: true,
          type: 'GROUP' as const,
          group: {
            id: validation.groupId!,
            name: validation.groupName!,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          email: validation.email ?? undefined,
          ...(validation.inviterName && { inviterName: validation.inviterName }),
          ...(validation.existingUser !== undefined && { existingUser: validation.existingUser }),
          ...(validation.targetFamilyId && {
            targetFamilyId: validation.targetFamilyId ?? undefined,
            targetFamilyName: validation.targetFamilyName ?? undefined,
          }),
        }, 200);
      } else {
        invitationLogger.logWarning('validateGroupInvitation', c, 'Invalid group invitation', {
          code,
          error: validation.error,
          errorCode: validation.errorCode,
        });
        return c.json({
          valid: false,
          type: 'GROUP' as const,
          ...(validation.email && { email: validation.email }),
          ...(validation.inviterName && { inviterName: validation.inviterName }),
          ...(validation.existingUser !== undefined && { existingUser: validation.existingUser }),
          ...(validation.targetFamilyId && { targetFamilyId: validation.targetFamilyId }),
          ...(validation.targetFamilyName && { targetFamilyName: validation.targetFamilyName }),
          ...(validation.errorCode && { errorCode: validation.errorCode }),
        }, 200);
      }
    } catch (error: unknown) {
      invitationLogger.logError('validateGroupInvitation', c, error as Error | string);
      return c.json({
        success: false as const,
        error: 'Validation failed',
      code: 'VALIDATION_FAILED' as const,
      }, 500);
    }
  });

  /**
   * POST /invitations/group/:code/accept - Accept group invitation
   */
  app.openapi(acceptGroupInvitationRoute, async (c) => {
    const userId = c.get('userId');
    const { code } = c.req.valid('param');

    invitationLogger.logStart('acceptGroupInvitation', c, {
      businessContext: { userId, code },
    });

    try {
      const result = await invitationServiceInstance.acceptGroupInvitation(code, userId);

      if (result.success) {
        invitationLogger.logSuccess('acceptGroupInvitation', c, { userId, code });
        return c.json({
          success: true,
          message: 'Group invitation accepted successfully',
        }, 200);
      } else {
        invitationLogger.logWarning('acceptGroupInvitation', c, result.error || 'Accept failed');
        return c.json({
          success: false as const,
          error: result.error || 'Failed to accept group invitation',
          code: result.error?.includes('Family onboarding required') ? 'FAMILY_ONBOARDING_REQUIRED' : 'ACCEPT_FAILED',
          requiresFamilyOnboarding: result.error?.includes('Family onboarding required') ? true : undefined,
        }, 400);
      }
    } catch (error: unknown) {
      invitationLogger.logError('acceptGroupInvitation', c, error as Error | string);
      return c.json({
        success: false as const,
        error: 'Failed to accept group invitation',
      code: 'ACCEPT_FAILED' as const,
      }, 500);
    }
  });

  /**
   * DELETE /invitations/family/:invitationId - Cancel family invitation
   */
  app.openapi(cancelFamilyInvitationRoute, async (c) => {
    const userId = c.get('userId');
    const { invitationId } = c.req.valid('param');

    invitationLogger.logStart('cancelFamilyInvitation', c, {
      businessContext: { userId, invitationId },
    });

    try {
      await invitationServiceInstance.cancelFamilyInvitation(invitationId, userId);

      invitationLogger.logSuccess('cancelFamilyInvitation', c, { userId, invitationId });

      return c.json({
        message: 'Family invitation cancelled successfully',
      }, 200);

    } catch (error: unknown) {
      invitationLogger.logError('cancelFamilyInvitation', c, error as Error | string);

      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel family invitation';

      if (errorMessage.includes('Only family administrators can cancel invitations')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'FORBIDDEN' as const,
        }, 403);
      }
      if (errorMessage.includes('not found')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'NOT_FOUND' as const,
        }, 404);
      }

      return c.json({
        success: false as const,
        error: 'Failed to cancel family invitation',
      code: 'CANCEL_FAILED' as const,
      }, 500);
    }
  });

  /**
   * DELETE /invitations/group/:invitationId - Cancel group invitation
   */
  app.openapi(cancelGroupInvitationRoute, async (c) => {
    const userId = c.get('userId');
    const { invitationId } = c.req.valid('param');

    invitationLogger.logStart('cancelGroupInvitation', c, {
      businessContext: { userId, invitationId },
    });

    try {
      await invitationServiceInstance.cancelGroupInvitation(invitationId, userId);

      invitationLogger.logSuccess('cancelGroupInvitation', c, { userId, invitationId });

      return c.json({
        message: 'Group invitation cancelled successfully',
      }, 200);

    } catch (error: unknown) {
      invitationLogger.logError('cancelGroupInvitation', c, error as Error | string);

      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel group invitation';

      if (errorMessage.includes('Only group administrators can cancel invitations')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'FORBIDDEN' as const,
        }, 403);
      }
      if (errorMessage.includes('not found')) {
        return c.json({
          success: false as const,
          error: errorMessage,
      code: 'NOT_FOUND' as const,
        }, 404);
      }

      return c.json({
        success: false as const,
        error: 'Failed to cancel group invitation',
      code: 'CANCEL_FAILED' as const,
      }, 500);
    }
  });

  return app;
};

// Default export for backward compatibility (uses real services)
export default createInvitationControllerRoutes();
