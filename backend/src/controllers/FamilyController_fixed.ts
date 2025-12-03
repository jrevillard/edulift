import { Request, Response } from 'express';
import { FamilyService } from '../services/FamilyService';
import { FamilyAuthService } from '../services/FamilyAuthService';
import { FamilyRole } from '../types/family';
import { createLogger, Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseValidation';
import {
  FamilySuccessResponseSchema,
  SimpleSuccessResponseSchema,
} from '../schemas/responses';

const familyLogger = createLogger('FamilyController');

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export class FamilyController {
  constructor(
    private familyService: FamilyService,
    private familyAuthService: FamilyAuthService,
    private logger: Logger = familyLogger,
  ) {}

  createFamily = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.body;

      this.logger.debug('createFamily: Received request', {
        userId: req.user?.id,
        name,
        userEmail: req.user?.email,
      });

      // Validation is handled by middleware (CreateFamilySchema)
      // No need for manual validation - Zod ensures name is valid and non-empty

      this.logger.debug('createFamily: Creating family', { userId: req.user.id, name: name.trim() });
      const family = await this.familyService.createFamily(req.user.id, name);

      this.logger.debug('createFamily: Family created successfully', {
        userId: req.user.id,
        familyId: family.id,
        familyName: family.name,
      });

      sendSuccessResponse(res, 201, FamilySuccessResponseSchema, family);
    } catch (error) {
      this.logger.error('createFamily: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      sendErrorResponse(res, 400, (error as Error).message);
    }
  };

  joinFamily = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode) {
        sendErrorResponse(res, 400, 'Invite code is required');
        return;
      }

      const family = await this.familyService.joinFamily(inviteCode, req.user.id);

      sendSuccessResponse(res, 200, FamilySuccessResponseSchema, family);
    } catch (error) {
      sendErrorResponse(res, 400, (error as Error).message);
    }
  };

  getCurrentFamily = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const family = await this.familyService.getUserFamily(req.user.id);

      if (!family) {
        sendErrorResponse(res, 404, 'User is not part of any family');
        return;
      }

      sendSuccessResponse(res, 200, FamilySuccessResponseSchema, family);
    } catch (error) {
      sendErrorResponse(res, 500, (error as Error).message);
    }
  };

  getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { familyId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);

      if (!userFamily || userFamily.id !== familyId) {
        sendErrorResponse(res, 403, 'Access denied: not a member of this family');
        return;
      }

      const permissions = await this.familyAuthService.getUserPermissions(req.user.id);

      sendSuccessResponse(res, 200, undefined as any, permissions);
    } catch (error) {
      sendErrorResponse(res, 500, (error as Error).message);
    }
  };

  updateMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      const { role } = req.body;

      // Validate role
      if (!Object.values(FamilyRole).includes(role)) {
        sendErrorResponse(res, 400, 'Invalid role');
        return;
      }

      // Check permissions (only admins can change roles)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.updateMemberRole(req.user.id, memberId, role);

      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Member role updated successfully' });
    } catch (error) {
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  generateInviteCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check permissions (only admins can generate invite codes)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      // NOTE: Permanent invite codes are deprecated as per unified invitation system
      sendErrorResponse(res, 400, 'Permanent invite codes are no longer supported. Use invitation system instead.');
    } catch (error) {
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  inviteMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { familyId } = req.params;
      const { email, role, personalMessage } = req.body;

      // Validate input
      if (!email) {
        sendErrorResponse(res, 400, 'Email is required');
        return;
      }

      // Validate role if provided
      if (role && !Object.values(FamilyRole).includes(role)) {
        sendErrorResponse(res, 400, 'Invalid role');
        return;
      }

      // Verify user belongs to this family and has admin permissions
      const userFamily = await this.familyService.getUserFamily(req.user.id);

      if (!userFamily || userFamily.id !== familyId) {
        sendErrorResponse(res, 403, 'Access denied: not a member of this family');
        return;
      }

      // Check permissions (only admins can invite members)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      const invitation = await this.familyService.inviteMember(familyId, {
        email,
        role: role || FamilyRole.MEMBER,
        personalMessage,
      }, req.user.id);

      sendSuccessResponse(res, 201, undefined as any, { ...invitation, message: 'Invitation sent successfully' });
    } catch (error) {
      this.logger.error('Family invitation error:', { error: error instanceof Error ? error.message : String(error) });
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  getPendingInvitations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { familyId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);

      if (!userFamily || userFamily.id !== familyId) {
        sendErrorResponse(res, 403, 'Access denied: not a member of this family');
        return;
      }

      const invitations = await this.familyService.getPendingInvitations(familyId);

      sendSuccessResponse(res, 200, undefined as any, invitations);
    } catch (error) {
      this.logger.error('Get pending invitations error:', { error: error instanceof Error ? error.message : String(error) });
      sendErrorResponse(res, 500, (error as Error).message);
    }
  };

  cancelInvitation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { familyId, invitationId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);

      if (!userFamily || userFamily.id !== familyId) {
        sendErrorResponse(res, 403, 'Access denied: not a member of this family');
        return;
      }

      // Check permissions (only admins can cancel invitations)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.cancelInvitation(familyId, invitationId, req.user.id);

      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Invitation cancelled successfully' });
    } catch (error) {
      this.logger.error('Cancel invitation error:', { error: error instanceof Error ? error.message : String(error) });
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  updateFamilyName = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      this.logger.debug('updateFamilyName called', { name, userId: req.user.id });

      if (!name || name.trim().length === 0) {
        this.logger.warn('Validation failed: Family name is required', { userId: req.user.id });
        sendErrorResponse(res, 400, 'Family name is required');
        return;
      }

      if (name.trim().length > 100) {
        this.logger.warn('Validation failed: Family name too long', {
          length: name.trim().length,
          userId: req.user.id,
        });
        sendErrorResponse(res, 400, 'Family name must be 100 characters or less');
        return;
      }

      this.logger.debug('Controller validation passed, checking permissions', { userId: req.user.id });
      // Check permissions (only admins can update family name)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);
      this.logger.debug('Permissions check passed, calling service', { userId: req.user.id });

      const updatedFamily = await this.familyService.updateFamilyName(req.user.id, name.trim());
      this.logger.debug('Service call successful, sending response', { userId: req.user.id });

      sendSuccessResponse(res, 200, FamilySuccessResponseSchema, updatedFamily);
    } catch (error) {
      this.logger.error('FamilyController.updateFamilyName error:', { error: error instanceof Error ? error.message : String(error) });
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { familyId, memberId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);

      if (!userFamily || userFamily.id !== familyId) {
        sendErrorResponse(res, 403, 'Access denied: not a member of this family');
        return;
      }

      // Check permissions (only admins can remove members)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.removeMember(req.user.id, memberId);

      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Member removed successfully' });
    } catch (error) {
      this.logger.error('Remove member error:', { error: error instanceof Error ? error.message : String(error) });
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      sendErrorResponse(res, statusCode, (error as Error).message);
    }
  };

  validateInviteCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode || typeof inviteCode !== 'string') {
        sendErrorResponse(res, 400, 'Invite code is required');
        return;
      }

      // Try to find the family with this invite code
      const family = await this.familyService.validateInviteCode(inviteCode.trim().toUpperCase());

      if (family) {
        sendSuccessResponse(res, 200, undefined as any, {
          valid: true,
          family: {
            id: family.id,
            name: family.name,
          },
        });
      } else {
        sendErrorResponse(res, 400, 'Invalid or expired invite code', [{
          field: 'inviteCode',
          message: 'Invalid or expired invite code',
          code: 'invalid_code',
        }]);
      }
    } catch (error) {
      this.logger.error('Validate invite code error:', { error: error instanceof Error ? error.message : String(error) });
      sendErrorResponse(res, 400, (error as Error).message);
    }
  };

  leaveFamily = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await this.familyService.leaveFamily(req.user.id);

      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Successfully left the family' });
    } catch (error) {
      this.logger.error('Leave family error:', { error: error instanceof Error ? error.message : String(error) });

      // Handle specific business rule errors
      if (error instanceof Error && error.message.includes('LAST_ADMIN')) {
        sendErrorResponse(res, 400, 'Cannot leave family as you are the last administrator. Please appoint another admin first.');
        return;
      }

      if (error instanceof Error && error.message.includes('NOT_FAMILY_MEMBER')) {
        sendErrorResponse(res, 400, 'You are not a member of any family');
        return;
      }

      sendErrorResponse(res, 500, 'Failed to leave family');
    }
  };

}

// Factory function to create controller with dependencies
export const createFamilyController = (): FamilyController => {
  const prisma = new PrismaClient();
  const logger = createLogger('FamilyController');
  const emailService = EmailServiceFactory.getInstance();

  // Mock cache service for now (should be replaced with real cache service)
  const mockCacheService = {
    async get(_key: string): Promise<null> { return null; },
    async set(_key: string, _value: any, _ttl: number): Promise<void> { return; },
  };

  const familyService = new FamilyService(prisma, logger, undefined, emailService);
  const familyAuthService = new FamilyAuthService(prisma, mockCacheService);

  return new FamilyController(familyService, familyAuthService, familyLogger);
};