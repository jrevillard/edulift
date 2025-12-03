import { prisma } from '../config/database';
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { createLogger } from '../utils/logger';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseValidation';
import { SimpleSuccessResponseSchema, InvitationCreationResponseSchema } from '../schemas/responses';
import {
  // Request schemas
  CreateFamilyInvitationSchema,
  CreateGroupInvitationSchema,
  AcceptFamilyInvitationSchema,
  // Parameter schemas
  InvitationCodeParamsSchema,
  InvitationIdParamsSchema,
} from '../schemas/invitations';


const logger = createLogger('InvitationsRoute');

const router = Router();

// Initialize services
const emailService = EmailServiceFactory.getInstance();
const invitationService = new UnifiedInvitationService(prisma, logger, emailService);

// Public validation endpoint (no auth required)
router.get('/validate/:code', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationCodeParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation code format');
    return;
  }

  const { code } = paramsValidation.data;

  logger.debug('General invitation validation endpoint called with code:', { code });

  try {
    // Try family invitation first
    const familyValidation = await invitationService.validateFamilyInvitation(code);
    logger.debug('Family validation result:', { code, valid: familyValidation.valid, error: familyValidation.error });

    if (familyValidation.valid) {
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
        type: 'FAMILY',
        ...familyValidation,
      });
      return;
    }

    // Try group invitation
    const groupValidation = await invitationService.validateGroupInvitation(code);
    logger.debug('Group validation result:', { code, valid: groupValidation.valid, error: groupValidation.error });

    if (groupValidation.valid) {
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
        type: 'GROUP',
        ...groupValidation,
      });
      return;
    }

    // Neither found
    logger.debug('No valid invitation found for code:', { code });
    sendErrorResponse(res, 404, 'Invalid invitation code');
  } catch (error: any) {
    next(error);
  }
}));


// Family invitation endpoints
router.post('/family', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Validate request body
  const bodyValidation = CreateFamilyInvitationSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    sendErrorResponse(res, 400, 'Invalid request data');
    return;
  }

  const { familyId, email, role, personalMessage } = bodyValidation.data;
  const adminId = req.user.id;

  try {
    const invitationData: any = { email, role };
    if (personalMessage !== undefined) {
      invitationData.personalMessage = personalMessage;
    }

    const invitation = await invitationService.createFamilyInvitation(
      familyId,
      invitationData,
      adminId,
    );

    sendSuccessResponse(res, 201, InvitationCreationResponseSchema, invitation);
  } catch (error: any) {
    // Handle permission errors specifically
    const err = error as Error;
    if (err.message === 'Only family administrators can send invitations') {
      sendErrorResponse(res, 403, err.message);
      return;
    }
    // Re-throw other errors to be handled by global error handler
    next(error);
  }
}));

router.get('/family/:code/validate', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationCodeParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation code format');
    return;
  }

  const { code } = paramsValidation.data;

  try {
    // Extract user ID from token if present (optional authentication)
    let currentUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'default-secret';
        const decoded = jwt.verify(token, jwtAccessSecret);
        currentUserId = (decoded as any).userId;
      } catch {
        // Invalid token - continue without authentication
      }
    }

    const validation = await invitationService.validateFamilyInvitation(code, currentUserId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, validation);
    return;
  } catch (error: any) {
    next(error);
  }
}));

router.post('/family/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationCodeParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation code format');
    return;
  }

  // Validate request body
  const bodyValidation = AcceptFamilyInvitationSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    sendErrorResponse(res, 400, 'Invalid request data');
    return;
  }

  const { code } = paramsValidation.data;
  const { leaveCurrentFamily } = bodyValidation.data;
  const userId = req.user.id;

  try {
    const result = await invitationService.acceptFamilyInvitation(
      code,
      userId,
      { leaveCurrentFamily },
    );

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: result.success,
    });
    return;
  } catch (error: any) {
    // Handle business logic errors with proper status codes
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      sendErrorResponse(res, error.statusCode, error.message);
      return;
    }
    // Re-throw unexpected errors to be handled by error middleware
    next(error);
  }
}));

// Group invitation endpoints
router.post('/group', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
  // Validate request body
  const bodyValidation = CreateGroupInvitationSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    sendErrorResponse(res, 400, 'Invalid request data');
    return;
  }

  const { groupId, targetFamilyId, email, role, personalMessage } = bodyValidation.data;
  const adminId = req.user.id;

  try {
    const invitationData: any = { role };
    if (targetFamilyId !== undefined) {
      invitationData.targetFamilyId = targetFamilyId;
    }
    if (email !== undefined) {
      invitationData.email = email;
    }
    if (personalMessage !== undefined) {
      invitationData.personalMessage = personalMessage;
    }

    const invitation = await invitationService.createGroupInvitation(
      groupId,
      invitationData,
      adminId,
    );

    sendSuccessResponse(res, 201, InvitationCreationResponseSchema, invitation);
    return;
  } catch (error: any) {
    // Handle permission errors specifically
    if (error.message === 'Only family administrators can send group invitations' ||
        error.message === 'Only group administrators can perform this action') {
      sendErrorResponse(res, 403, error.message);
      return;
    }

    if (error.message === 'Group not found' ||
        error.message === 'Target family not found') {
      sendErrorResponse(res, 404, error.message);
      return;
    }

    if (error.message === 'Family is already a member of this group' ||
        error.message === 'This family already has a pending invitation to this group') {
      sendErrorResponse(res, 409, error.message);
      return;
    }

    // Generic server error
    sendErrorResponse(res, 500, 'Failed to create group invitation');
    return;
  }
}));

router.get('/group/:code/validate', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationCodeParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation code format');
    return;
  }

  const { code } = paramsValidation.data;

  try {
    // Extract user ID from token if present (optional authentication)
    let currentUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'default-secret';
        const decoded = jwt.verify(token, jwtAccessSecret);
        currentUserId = (decoded as any).userId;
      } catch {
        // Invalid token - continue without authentication
      }
    }

    const validation = await invitationService.validateGroupInvitation(code, currentUserId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, validation);
    return;
  } catch (error: any) {
    next(error);
  }
}));

router.post('/group/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationCodeParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation code format');
    return;
  }

  const { code } = paramsValidation.data;
  const userId = req.user.id;

  try {
    const result = await invitationService.acceptGroupInvitation(code, userId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, result);
    return;
  } catch (error: any) {
    next(error);
  }
}));

// List user invitations
router.get('/user', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user.id;

  try {
    const invitations = await invitationService.listUserInvitations(userId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, invitations);
    return;
  } catch (error: any) {
    next(error);
  }
}));

// Cancel family invitation
router.delete('/family/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationIdParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation ID format');
    return;
  }

  const { invitationId } = paramsValidation.data;
  const adminId = req.user.id;

  try {
    await invitationService.cancelFamilyInvitation(invitationId, adminId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      message: 'Invitation cancelled successfully',
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

// Cancel group invitation
router.delete('/group/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Validate parameters
  const paramsValidation = InvitationIdParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    sendErrorResponse(res, 400, 'Invalid invitation ID format');
    return;
  }

  const { invitationId } = paramsValidation.data;
  const adminId = req.user.id;

  try {
    await invitationService.cancelGroupInvitation(invitationId, adminId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      message: 'Invitation cancelled successfully',
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

export default router;