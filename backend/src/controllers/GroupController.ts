import { Request, Response } from 'express';
import { GroupService } from '../services/GroupService';
import { SchedulingService } from '../services/SchedulingService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { createLogger, Logger } from '../utils/logger';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseValidation';
import {
  GroupSuccessResponseSchema,
  GroupsSuccessResponseSchema,
  SimpleSuccessResponseSchema,
  ScheduleSuccessResponseSchema,
  PendingInvitationsSuccessResponseSchema,
  InviteCodeValidationSuccessResponseSchema,
} from '../schemas/responses';
import { GroupFamiliesResponseSchema } from '../schemas/groups';

export class GroupController {
  constructor(
    private groupService: GroupService,
    private schedulingService: SchedulingService,
    private logger: Logger = createLogger('group-controller'),
  ) { }

  // Group Management Methods

  createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, description } = req.body;

      this.logger.debug('createGroup: Received request', {
        userId: authReq.userId,
        name,
        description,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('createGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('createGroup: Getting user family', { userId: authReq.userId });
      // Get user's family first
      const userFamily = await this.groupService.getUserFamily(authReq.userId);

      if (!userFamily) {
        this.logger.warn('createGroup: User not part of any family', { userId: authReq.userId });
        throw createError('User must be part of a family to create groups', 400);
      }

      this.logger.debug('createGroup: Family found, creating group', {
        userId: authReq.userId,
        familyId: userFamily.familyId,
        familyName: userFamily.family?.name,
      });

      const group = await this.groupService.createGroup({
        name,
        description: description || undefined,
        familyId: userFamily.familyId,
        createdBy: authReq.userId,
      });

      this.logger.debug('createGroup: Group created successfully', {
        userId: authReq.userId,
        groupId: group.id,
        groupName: group.name,
      });

      this.logger.debug('createGroup: Sending response', {
        userId: authReq.userId,
        groupId: group.id,
        success: true,
      });
      sendSuccessResponse(res, 201, GroupSuccessResponseSchema, group);
    } catch (error) {
      this.logger.error('createGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
      });
      throw error;
    }
  };

  joinGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { inviteCode } = req.body;

      this.logger.debug('joinGroup: Received request', {
        userId: authReq.userId,
        inviteCode: `${inviteCode.substring(0, 8)}...`, // Only log partial code for security
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('joinGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('joinGroup: Authentication validated', {
        userId: authReq.userId,
        inviteCode: `${inviteCode.substring(0, 8)}...`,
      });

      this.logger.debug('joinGroup: Calling service', {
        userId: authReq.userId,
        inviteCode: `${inviteCode.substring(0, 8)}...`,
      });

      const membership = await this.groupService.joinGroupByInviteCode(inviteCode, authReq.userId);

      this.logger.debug('joinGroup: Group joined successfully', {
        userId: authReq.userId,
        groupId: membership.id,
        groupName: membership.name,
      });

      this.logger.debug('joinGroup: Sending response', {
        userId: authReq.userId,
        groupId: membership.id,
        groupName: membership.name,
        success: true,
      });

      sendSuccessResponse(res, 200, GroupSuccessResponseSchema, membership);
    } catch (error) {
      this.logger.error('joinGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        inviteCode: req.body?.inviteCode ? `${req.body.inviteCode.substring(0, 8)}...` : undefined,
      });
      throw error;
    }
  };

  getUserGroups = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    this.logger.debug('getUserGroups: Received request', {
      userId: authReq.userId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getUserGroups: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getUserGroups: Calling service', { userId: authReq.userId });
    const groups = await this.groupService.getUserGroups(authReq.userId);

    this.logger.debug('getUserGroups: Groups retrieved', {
      userId: authReq.userId,
      groupCount: groups.length,
    });

    this.logger.debug('getUserGroups: Sending response', {
      userId: authReq.userId,
      success: true,
      groupCount: groups.length,
    });
    sendSuccessResponse(res, 200, GroupsSuccessResponseSchema, groups);
  };

  getGroupFamilies = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;

    this.logger.debug('getGroupFamilies: Received request', {
      userId: authReq.userId,
      groupId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getGroupFamilies: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getGroupFamilies: Calling service', { groupId, userId: authReq.userId });
    const families = await this.groupService.getGroupFamilies(groupId, authReq.userId);

    this.logger.debug('getGroupFamilies: Families retrieved', {
      groupId,
      userId: authReq.userId,
      familyCount: families.length,
    });

    this.logger.debug('getGroupFamilies: Sending response', {
      groupId,
      success: true,
      familyCount: families.length,
    });
    sendSuccessResponse(res, 200, GroupFamiliesResponseSchema, families);
  };

  updateFamilyRole = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId, familyId } = req.params;
    const { role } = req.body;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    await this.groupService.updateFamilyRole(
      groupId,
      familyId,
      role,
      authReq.userId,
    );

    // Fetch and return the updated family data
    const groupFamilies = await this.groupService.getGroupFamilies(groupId, authReq.userId);
    const updatedFamily = groupFamilies.find(f => f.id === familyId);

    if (!updatedFamily) {
      sendErrorResponse(res, 404, 'Family not found after update');
      return;
    }

    sendSuccessResponse(res, 200, GroupSuccessResponseSchema, updatedFamily);
  };

  removeFamilyFromGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId, familyId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    await this.groupService.removeFamilyFromGroup(groupId, familyId, authReq.userId);

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Family removed from group successfully' });
  };

  updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;
      const updateData = req.body;

      this.logger.debug('updateGroup: Received request', {
        userId: authReq.userId,
        groupId,
        updateData,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('updateGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('updateGroup: Authentication validated', {
        userId: authReq.userId,
        groupId,
      });

      // Filter out undefined values for strict typing
      const filteredUpdateData: { name?: string; description?: string } = {};
      if (updateData.name !== undefined && updateData.name.trim()) {
        filteredUpdateData.name = updateData.name.trim();
      }
      if (updateData.description !== undefined && updateData.description !== null) {
        filteredUpdateData.description = updateData.description.trim();
      }

      // Check if there's actually something to update
      if (Object.keys(filteredUpdateData).length === 0) {
        this.logger.warn('updateGroup: No update data provided', {
          userId: authReq.userId,
          groupId,
        });
        sendErrorResponse(res, 400, 'No update data provided');
        return;
      }

      this.logger.debug('updateGroup: Calling service to update group', {
        groupId,
        userId: authReq.userId,
        updateFields: Object.keys(filteredUpdateData),
      });

      const result = await this.groupService.updateGroup(groupId, authReq.userId, filteredUpdateData);

      this.logger.debug('updateGroup: Group updated successfully', {
        groupId,
        userId: authReq.userId,
        updatedName: result.name,
        updatedDescription: result.description,
      });

      this.logger.debug('updateGroup: Sending response', {
        groupId,
        userId: authReq.userId,
        success: true,
      });

      sendSuccessResponse(res, 200, GroupSuccessResponseSchema, result);
    } catch (error) {
      this.logger.error('updateGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        groupId: req.params?.groupId,
        updateData: req.body,
      });
      throw error;
    }
  };

  deleteGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;

      this.logger.debug('deleteGroup: Received request', {
        userId: authReq.userId,
        groupId,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('deleteGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('deleteGroup: Authentication validated', {
        userId: authReq.userId,
        groupId,
      });

      this.logger.debug('deleteGroup: Calling service to delete group', {
        groupId,
        userId: authReq.userId,
      });

      const result = await this.groupService.deleteGroup(groupId, authReq.userId);

      this.logger.debug('deleteGroup: Group deleted successfully', {
        groupId,
        userId: authReq.userId,
        deleted: result.success,
      });

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, result);

      this.logger.debug('deleteGroup: Sending response', {
        groupId,
        userId: authReq.userId,
        success: true,
      });
    } catch (error) {
      this.logger.error('deleteGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        groupId: req.params?.groupId,
      });
      throw error;
    }
  };


  leaveGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;

      this.logger.debug('leaveGroup: Received request', {
        userId: authReq.userId,
        groupId,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('leaveGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('leaveGroup: Authentication validated', {
        userId: authReq.userId,
        groupId,
      });

      this.logger.debug('leaveGroup: Calling service to leave group', {
        groupId,
        userId: authReq.userId,
      });

      const result = await this.groupService.leaveGroup(groupId, authReq.userId);

      this.logger.debug('leaveGroup: Group left successfully', {
        groupId,
        userId: authReq.userId,
        leftGroup: result.success,
      });

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, result);

      this.logger.debug('leaveGroup: Sending response', {
        groupId,
        userId: authReq.userId,
        success: true,
      });
    } catch (error) {
      this.logger.error('leaveGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        groupId: req.params?.groupId,
      });
      throw error;
    }
  };

  // NOTE: Schedule slot creation moved to ScheduleSlotController 
  // to enforce business rule that schedule slots must contain at least 1 vehicle

  getWeeklySchedule = async (req: Request, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { week } = req.query as { week: string };

    const schedule = await this.schedulingService.getWeeklySchedule(groupId, week);

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, ScheduleSuccessResponseSchema, schedule);
  };

  // Group Invitation Methods

  inviteFamilyToGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;
      const inviteData = req.body;

      this.logger.debug('inviteFamilyToGroup: Received request', {
        userId: authReq.userId,
        groupId,
        familyId: inviteData.familyId,
        role: inviteData.role,
        hasPersonalMessage: !!inviteData.personalMessage,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        this.logger.error('inviteFamilyToGroup: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      this.logger.debug('inviteFamilyToGroup: Authentication validated', {
        userId: authReq.userId,
        groupId,
      });

      this.logger.debug('inviteFamilyToGroup: Calling group service to invite family', {
        groupId,
        invitingUserId: authReq.userId,
        targetFamilyId: inviteData.familyId,
        role: inviteData.role,
      });

      const result = await this.groupService.inviteFamilyById(
        groupId,
        {
          familyId: inviteData.familyId,
          role: inviteData.role,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage }),
        },
        authReq.userId,
      );

      this.logger.debug('inviteFamilyToGroup: Family invited successfully', {
        groupId,
        familyId: inviteData.familyId,
        invitationId: result.id,
        role: inviteData.role,
      });

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 201, GroupSuccessResponseSchema, result);

      this.logger.debug('inviteFamilyToGroup: Sending response', {
        groupId,
        familyId: inviteData.familyId,
        success: true,
        invitationId: result.id,
      });
    } catch (error) {
      this.logger.error('inviteFamilyToGroup: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        groupId: req.params?.groupId,
        familyId: req.body?.familyId,
      });

      if (error instanceof AppError) {
        this.logger.warn('inviteFamilyToGroup: Application error', {
          errorMessage: error.message,
          statusCode: error.statusCode,
          userId: (req as AuthenticatedRequest).userId,
        });
        sendErrorResponse(res, error.statusCode, error.message);
        return;
      }

      sendErrorResponse(res, 500, 'Failed to invite family to group');
    }
  };


  getPendingInvitations = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const invitations = await this.groupService.getPendingInvitations(
      groupId,
      authReq.userId,
    );

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, PendingInvitationsSuccessResponseSchema, invitations);
  };

  cancelInvitation = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId, invitationId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const result = await this.groupService.cancelInvitation(
      groupId,
      invitationId,
      authReq.userId,
    );

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, result);
  };

  // Public endpoint for validating group invitation codes
  validateInviteCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode || typeof inviteCode !== 'string') {
        sendErrorResponse(res, 400, 'Invitation code is required');
        return;
      }

      const result = await this.groupService.validateInvitationCode(inviteCode.trim());

      if (!result.valid) {
        sendErrorResponse(res, 400, result.error || 'Invalid invitation');
        return;
      }

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, InviteCodeValidationSuccessResponseSchema, result);
    } catch (error) {
      this.logger.error('Validate invitation code error:', { error: error instanceof Error ? error.message : String(error) });
      sendErrorResponse(res, 500, 'Failed to validate invitation code');
    }
  };

  // Authenticated endpoint for validating group invitation codes with user context
  validateInviteCodeWithAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { inviteCode } = req.body;

      if (!authReq.userId) {
        sendErrorResponse(res, 401, 'Authentication required');
        return;
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        sendErrorResponse(res, 400, 'Invitation code is required');
        return;
      }

      const result = await this.groupService.validateInvitationCodeWithUser(inviteCode.trim(), authReq.userId);

      // Send validated response ensuring OpenAPI compliance
      if (result.valid) {
        sendSuccessResponse(res, 200, InviteCodeValidationSuccessResponseSchema, result);
      } else {
        sendErrorResponse(res, 400, result.error || 'Invalid invitation code');
      }
    } catch (error) {
      this.logger.error('Validate invitation code with auth error:', { error: error instanceof Error ? error.message : String(error) });
      sendErrorResponse(res, 500, 'Failed to validate invitation code');
    }
  };

  // Family Search Methods

  searchFamilies = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;

      // Support both query parameter and body parameter for search term
      const searchTerm = (req.query.q as string) || req.body.searchTerm;

      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      if (!searchTerm || typeof searchTerm !== 'string') {
        throw createError('Search term is required', 400);
      }

      // Use the existing searchFamiliesForInvitation method which is more appropriate for group context
      const families = await this.groupService.searchFamiliesForInvitation(
        searchTerm,
        authReq.userId,
        groupId,
      );

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, GroupsSuccessResponseSchema, families);
    } catch (error: any) {
      this.logger.error('Error searching families:', { error: error instanceof Error ? error.message : String(error) });
      const statusCode = (error as Error & { statusCode?: number })?.statusCode || 500;
      const errorMessage = error instanceof Error ? error.message : 'Failed to search families';
      sendErrorResponse(res, statusCode, errorMessage);
    }
  };
}

// Factory function to create controller with dependencies
export const createGroupController = (): GroupController => {
  const prisma = new PrismaClient();
  const scheduleSlotRepository = new ScheduleSlotRepository(prisma);

  // Use centralized EmailServiceFactory for consistent email behavior
  // This ensures group invitations work correctly in E2E tests (use Mailpit)
  // and production (use real SMTP) without NODE_ENV checks
  const emailService = EmailServiceFactory.getInstance();

  const groupService = new GroupService(prisma, emailService);
  const schedulingService = new SchedulingService(scheduleSlotRepository, prisma);

  const controller = new GroupController(groupService, schedulingService);

  // Bind all methods to maintain correct 'this' context
  return {
    createGroup: controller.createGroup.bind(controller),
    joinGroup: controller.joinGroup.bind(controller),
    getUserGroups: controller.getUserGroups.bind(controller),
    getGroupFamilies: controller.getGroupFamilies.bind(controller),
    // @ts-expect-error - Alias for backward compatibility
    getFamilies: controller.getGroupFamilies.bind(controller),
    updateFamilyRole: controller.updateFamilyRole.bind(controller),
    removeFamilyFromGroup: controller.removeFamilyFromGroup.bind(controller),
    deleteGroup: controller.deleteGroup.bind(controller),
    updateGroup: controller.updateGroup.bind(controller),
    leaveGroup: controller.leaveGroup.bind(controller),
    getWeeklySchedule: controller.getWeeklySchedule.bind(controller),
    inviteFamilyToGroup: controller.inviteFamilyToGroup.bind(controller),
    getPendingInvitations: controller.getPendingInvitations.bind(controller),
    cancelInvitation: controller.cancelInvitation.bind(controller),
    validateInviteCode: controller.validateInviteCode.bind(controller),
    validateInviteCodeWithAuth: controller.validateInviteCodeWithAuth.bind(controller),
    searchFamilies: controller.searchFamilies.bind(controller),
  };
};