import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';

const prisma = new PrismaClient();

// Mock logger for now
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

const router = Router();

// Initialize services
const emailService = EmailServiceFactory.getInstance();
const invitationService = new UnifiedInvitationService(prisma, mockLogger, emailService);

// Public validation endpoint (no auth required)
router.get('/validate/:code', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  console.log('General invitation validation endpoint called with code:', code);
  
  // Try family invitation first
  const familyValidation = await invitationService.validateFamilyInvitation(code);
  console.log('Family validation result:', { code, valid: familyValidation.valid, error: familyValidation.error });
  
  if (familyValidation.valid) {
    return res.json({
      success: true,
      data: {
        type: 'FAMILY',
        ...familyValidation
      }
    });
  }
  
  // Try group invitation
  const groupValidation = await invitationService.validateGroupInvitation(code);
  console.log('Group validation result:', { code, valid: groupValidation.valid, error: groupValidation.error });
  
  if (groupValidation.valid) {
    return res.json({
      success: true,
      data: {
        type: 'GROUP',
        ...groupValidation
      }
    });
  }
  
  // Neither found
  console.log('No valid invitation found for code:', code);
  return res.status(404).json({
    success: false,
    error: 'Invalid invitation code'
  });
}));


// Family invitation endpoints
router.post('/family', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { familyId, email, role, personalMessage, platform } = req.body;
  const adminId = req.user.id;
  
  if (!familyId || !role) {
    return res.status(400).json({
      success: false,
      error: 'Family ID and role are required'
    });
  }
  
  // Validate platform parameter if provided
  const validPlatform = platform === 'native' ? 'native' : 'web';
  
  try {
    const invitation = await invitationService.createFamilyInvitation(
      familyId,
      { email, role, personalMessage },
      adminId,
      validPlatform
    );
    
    return res.status(201).json({
      success: true,
      data: invitation
    });
  } catch (error: any) {
    // Handle permission errors specifically
    if (error.message === 'Only family administrators can send invitations') {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    // Re-throw other errors to be handled by global error handler
    throw error;
  }
}));

router.get('/family/:code/validate', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Invitation code is required'
    });
  }
  
  try {
    // Extract user ID from token if present (optional authentication)
    let currentUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        currentUserId = (decoded as any).userId;
      } catch (jwtError) {
        // Invalid token - continue without authentication
      }
    }
    
    const validation = await invitationService.validateFamilyInvitation(code, currentUserId);
    
    return res.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to validate invitation',
      details: error?.message || 'Unknown error'
    });
  }
}));

router.post('/family/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;
  const { leaveCurrentFamily } = req.body;
  const userId = req.user.id;
  
  try {
    const result = await invitationService.acceptFamilyInvitation(
      code,
      userId,
      { leaveCurrentFamily }
    );
    
    return res.json({
      success: true,
      data: {
        success: result.success
      }
    });
  } catch (error: any) {
    // Handle business logic errors with proper status codes
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }
    // Re-throw unexpected errors to be handled by error middleware
    throw error;
  }
}));

// Group invitation endpoints
router.post('/group', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupId, targetFamilyId, email, role, personalMessage, platform } = req.body;
  const adminId = req.user.id;
  
  if (!groupId || !role) {
    return res.status(400).json({
      success: false,
      error: 'Group ID and role are required'
    });
  }
  
  // Validate platform parameter if provided
  const validPlatform = platform === 'native' ? 'native' : 'web';
  
  try {
    const invitation = await invitationService.createGroupInvitation(
      groupId,
      { targetFamilyId, email, role, personalMessage },
      adminId,
      validPlatform
    );
    
    return res.status(201).json({
      success: true,
      data: invitation
    });
  } catch (error: any) {
    // Handle permission errors specifically
    if (error.message === 'Only family administrators can send group invitations' ||
        error.message === 'Only group administrators can perform this action') {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message === 'Group not found' ||
        error.message === 'Target family not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message === 'Family is already a member of this group' ||
        error.message === 'This family already has a pending invitation to this group') {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    
    // Generic server error
    return res.status(500).json({
      success: false,
      error: 'Failed to create group invitation'
    });
  }
}));

router.get('/group/:code/validate', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Invitation code is required'
    });
  }
  
  try {
    // Extract user ID from token if present (optional authentication)
    let currentUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        currentUserId = (decoded as any).userId;
      } catch (jwtError) {
        // Invalid token - continue without authentication
      }
    }
    
    const validation = await invitationService.validateGroupInvitation(code, currentUserId);
    
    return res.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to validate invitation',
      details: error?.message || 'Unknown error'
    });
  }
}));

router.post('/group/:code/accept', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user.id;
  
  const result = await invitationService.acceptGroupInvitation(code, userId);
  
  return res.json({
    success: true,
    data: result
  });
}));

// List user invitations
router.get('/user', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  
  const invitations = await invitationService.listUserInvitations(userId);
  
  return res.json({
    success: true,
    data: invitations
  });
}));

// Cancel family invitation
router.delete('/family/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invitationId } = req.params;
  const adminId = req.user.id;
  
  await invitationService.cancelFamilyInvitation(invitationId, adminId);
  
  return res.json({
    success: true,
    message: 'Invitation cancelled successfully'
  });
}));

// Cancel group invitation
router.delete('/group/:invitationId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invitationId } = req.params;
  const adminId = req.user.id;
  
  await invitationService.cancelGroupInvitation(invitationId, adminId);
  
  return res.json({
    success: true,
    message: 'Invitation cancelled successfully'
  });
}));

export default router;