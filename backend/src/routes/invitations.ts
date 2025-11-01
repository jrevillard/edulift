import { prisma } from '../config/database';
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { createLogger } from '../utils/logger';


const logger = createLogger('InvitationsRoute');

const router = Router();

// Initialize services
const emailService = EmailServiceFactory.getInstance();
const invitationService = new UnifiedInvitationService(prisma, logger, emailService);

// Public validation endpoint (no auth required)
router.get('/validate/:code', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { code } = req.params;

  logger.debug('General invitation validation endpoint called with code:', { code });

  try {
    // Try family invitation first
    const familyValidation = await invitationService.validateFamilyInvitation(code);
    logger.debug('Family validation result:', { code, valid: familyValidation.valid, error: familyValidation.error });

    if (familyValidation.valid) {
      res.json({
        success: true,
        data: {
          type: 'FAMILY',
          ...familyValidation,
        },
      });
      return;
    }

    // Try group invitation
    const groupValidation = await invitationService.validateGroupInvitation(code);
    logger.debug('Group validation result:', { code, valid: groupValidation.valid, error: groupValidation.error });

    if (groupValidation.valid) {
      res.json({
        success: true,
        data: {
          type: 'GROUP',
          ...groupValidation,
        },
      });
      return;
    }

    // Neither found
    logger.debug('No valid invitation found for code:', { code });
    res.status(404).json({
      success: false,
      error: 'Invalid invitation code',
    });
  } catch (error: any) {
    next(error);
  }
}));


// Family invitation endpoints
router.post('/family', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { familyId, email, role, personalMessage, platform } = req.body;
  const adminId = req.user.id;

  if (!familyId || !role) {
    res.status(400).json({
      success: false,
      error: 'Family ID and role are required',
    });
    return;
  }

  // Validate platform parameter if provided
  const validPlatform = platform === 'native' ? 'native' : 'web';

  try {
    const invitation = await invitationService.createFamilyInvitation(
      familyId,
      { email, role, personalMessage },
      adminId,
      validPlatform,
    );

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error: any) {
    // Handle permission errors specifically
    const err = error as Error;
    if (err.message === 'Only family administrators can send invitations') {
      res.status(403).json({
        success: false,
        error: err.message,
      });
      return;
    }
    // Re-throw other errors to be handled by global error handler
    next(error);
  }
}));

router.get('/family/:code/validate', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      success: false,
      error: 'Invitation code is required',
    });
    return;
  }

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

    res.json({
      success: true,
      data: validation,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

router.post('/family/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { code } = req.params;
  const { leaveCurrentFamily } = req.body;
  const userId = req.user.id;

  try {
    const result = await invitationService.acceptFamilyInvitation(
      code,
      userId,
      { leaveCurrentFamily },
    );

    res.json({
      success: true,
      data: {
        success: result.success,
      },
    });
    return;
  } catch (error: any) {
    // Handle business logic errors with proper status codes
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
      return;
    }
    // Re-throw unexpected errors to be handled by error middleware
    next(error);
  }
}));

// Group invitation endpoints
router.post('/group', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
  const { groupId, targetFamilyId, email, role, personalMessage, platform } = req.body;
  const adminId = req.user.id;

  if (!groupId || !role) {
    res.status(400).json({
      success: false,
      error: 'Group ID and role are required',
    });
    return;
  }

  // Validate platform parameter if provided
  const validPlatform = platform === 'native' ? 'native' : 'web';

  try {
    const invitation = await invitationService.createGroupInvitation(
      groupId,
      { targetFamilyId, email, role, personalMessage },
      adminId,
      validPlatform,
    );

    res.status(201).json({
      success: true,
      data: invitation,
    });
    return;
  } catch (error: any) {
    // Handle permission errors specifically
    if (error.message === 'Only family administrators can send group invitations' ||
        error.message === 'Only group administrators can perform this action') {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message === 'Group not found' ||
        error.message === 'Target family not found') {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message === 'Family is already a member of this group' ||
        error.message === 'This family already has a pending invitation to this group') {
      res.status(409).json({
        success: false,
        error: error.message,
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Failed to create group invitation',
    });
    return;
  }
}));

router.get('/group/:code/validate', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { code } = req.params;

  if (!code) {
    res.status(400).json({
      success: false,
      error: 'Invitation code is required',
    });
    return;
  }

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

    res.json({
      success: true,
      data: validation,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

router.post('/group/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { code } = req.params;
  const userId = req.user.id;

  try {
    const result = await invitationService.acceptGroupInvitation(code, userId);

    res.json({
      success: true,
      data: result,
    });
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

    res.json({
      success: true,
      data: invitations,
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

// Cancel family invitation
router.delete('/family/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { invitationId } = req.params;
  const adminId = req.user.id;

  try {
    await invitationService.cancelFamilyInvitation(invitationId, adminId);

    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

// Cancel group invitation
router.delete('/group/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { invitationId } = req.params;
  const adminId = req.user.id;

  try {
    await invitationService.cancelGroupInvitation(invitationId, adminId);

    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
    return;
  } catch (error: any) {
    next(error);
  }
}));

export default router;