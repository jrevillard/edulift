// @ts-nocheck
import { Request, Response } from 'express';
import { GroupService } from '../services/GroupService';
import { SchedulingService } from '../services/SchedulingService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError, AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';

const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

const JoinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

const UpdateMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN'], { required_error: 'Valid role is required' }),
});


const InviteFamilySchema = z.object({
  familyId: z.string().min(1, 'Family ID is required'),
  role: z.enum(['MEMBER', 'ADMIN'], { required_error: 'Valid role is required' }).default('MEMBER'),
  personalMessage: z.string().optional(),
  platform: z.enum(['web', 'native']).default('web'),
});

const UpdateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
});

export class GroupController {
  constructor(
    private groupService: GroupService,
    private schedulingService: SchedulingService,
  ) {}

  // Group Management Methods

  createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, description } = CreateGroupSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Get user's family first
      const userFamily = await this.groupService.getUserFamily(authReq.userId);

      if (!userFamily) {
        throw createError('User must be part of a family to create groups', 400);
      }

      const group = await this.groupService.createGroup({
        name,
        description: description || undefined,
        familyId: userFamily.familyId,
        createdBy: authReq.userId,
      });

      const response: ApiResponse = {
        success: true,
        data: group,
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  joinGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { inviteCode } = JoinGroupSchema.parse(req.body);

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const membership = await this.groupService.joinGroupByInviteCode(inviteCode, authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: membership,
    };

    res.status(200).json(response);
  };

  getUserGroups = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const groups = await this.groupService.getUserGroups(authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: groups,
    };

    res.status(200).json(response);
  };

  getGroupFamilies = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const families = await this.groupService.getGroupFamilies(groupId, authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: families,
    };

    res.status(200).json(response);
  };

  updateFamilyRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId, familyId } = req.params;
      const { role } = UpdateMemberRoleSchema.parse(req.body);
      
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
        const response: ApiResponse = {
          success: false,
          error: 'Family not found after update',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: updatedFamily,
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  removeFamilyFromGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId, familyId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    await this.groupService.removeFamilyFromGroup(groupId, familyId, authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Family removed from group successfully' },
    };

    res.status(200).json(response);
  };

  updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;
      const updateData = UpdateGroupSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Filter out undefined values for strict typing
      const filteredUpdateData: { name?: string; description?: string } = {};
      if (updateData.name !== undefined && updateData.name.trim()) {
        filteredUpdateData.name = updateData.name.trim();
      }
      if (updateData.description !== undefined) {
        filteredUpdateData.description = updateData.description.trim();
      }

      // Check if there's actually something to update
      if (Object.keys(filteredUpdateData).length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'No update data provided',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.groupService.updateGroup(groupId, authReq.userId, filteredUpdateData);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  deleteGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const result = await this.groupService.deleteGroup(groupId, authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };


  leaveGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const result = await this.groupService.leaveGroup(groupId, authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };

  // NOTE: Schedule slot creation moved to ScheduleSlotController 
  // to enforce business rule that schedule slots must contain at least 1 vehicle

  getWeeklySchedule = async (req: Request, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { week } = req.query as { week: string };

    const schedule = await this.schedulingService.getWeeklySchedule(groupId, week);

    const response: ApiResponse = {
      success: true,
      data: schedule,
    };

    res.status(200).json(response);
  };

  // Group Invitation Methods

  inviteFamilyToGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId } = req.params;
      const inviteData = InviteFamilySchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const result = await this.groupService.inviteFamilyById(
        groupId,
        {
          familyId: inviteData.familyId,
          role: inviteData.role,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage }),
        },
        authReq.userId,
        inviteData.platform,
      );

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Invite family to group error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invite family to group',
      });
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

    const response: ApiResponse = {
      success: true,
      data: invitations,
    };

    res.status(200).json(response);
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

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  };

  // Public endpoint for validating group invitation codes
  validateInviteCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode || typeof inviteCode !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: 'Invitation code is required',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.groupService.validateInvitationCode(inviteCode.trim());

      if (!result.valid) {
        const response: ApiResponse = {
          success: false,
          error: result.error || 'Invalid invitation',
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Validate invitation code error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to validate invitation code',
      };
      res.status(500).json(response);
    }
  };

  // Authenticated endpoint for validating group invitation codes with user context
  validateInviteCodeWithAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { inviteCode } = req.body;

      if (!authReq.userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Authentication required',
        };
        res.status(401).json(response);
        return;
      }

      if (!inviteCode || typeof inviteCode !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: 'Invitation code is required',
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.groupService.validateInvitationCodeWithUser(inviteCode.trim(), authReq.userId);

      const response: ApiResponse = {
        success: result.valid,
        data: result,
        ...(result.valid ? {} : { error: result.error || 'Invalid invitation code' }),
      };
      
      res.status(result.valid ? 200 : 400).json(response);
    } catch (error) {
      console.error('Validate invitation code with auth error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to validate invitation code',
      };
      res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: families,
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error searching families:', error);
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search families',
      };
      // @ts-expect-error - error type handling
      res.status((error as Error & { statusCode?: number })?.statusCode || 500).json(response);
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
    // @ts-expect-error - getGroupFamilies method exists but TypeScript can't see it
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