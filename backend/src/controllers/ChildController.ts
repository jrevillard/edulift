import { Request, Response } from 'express';
import { ChildService } from '../services/ChildService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';
import { createLogger, Logger } from '../utils/logger';
import { sendSuccessResponse } from '../utils/responseValidation';
import {
  ChildSuccessResponseSchema,
  ChildrenSuccessResponseSchema,
  SimpleSuccessResponseSchema,
} from '../schemas/responses';

export class ChildController {
  constructor(
    private childService: ChildService,
    private childAssignmentService: ChildAssignmentService,
    private logger: Logger = createLogger('ChildController'),
  ) {}

  createChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { name, age } = req.body; // Validated by middleware

    this.logger.debug('createChild: Received request', {
      userId: authReq.userId,
      name,
      age,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('createChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('createChild: Authentication validated', { userId: authReq.userId });

    // Get user's family - children must belong to a family
    this.logger.debug('createChild: Getting user family', { userId: authReq.userId });
    const userFamily = await this.childService.getUserFamily(authReq.userId);
    if (!userFamily) {
      this.logger.warn('createChild: User not part of any family', { userId: authReq.userId });
      throw createError('User must belong to a family to add children', 403);
    }

    this.logger.debug('createChild: Family found', {
      userId: authReq.userId,
      familyId: userFamily.id,
      familyName: userFamily.name,
    });

    // Verify user has permission to add children to the family
    this.logger.debug('createChild: Checking permissions', {
      userId: authReq.userId,
      familyId: userFamily.id,
    });
    const canModifyChildren = await this.childService.canUserModifyFamilyChildren(authReq.userId, userFamily.id);
    if (!canModifyChildren) {
      this.logger.warn('createChild: Insufficient permissions', {
        userId: authReq.userId,
        familyId: userFamily.id,
      });
      throw createError('Insufficient permissions to add children to family', 403);
    }

    this.logger.debug('createChild: Permissions validated', { userId: authReq.userId });

    const childData: {
      name: string;
      familyId: string;
      age?: number;
    } = {
      name,
      familyId: userFamily.id,
    };

    if (age !== undefined) {
      childData.age = age;
    }

    this.logger.debug('createChild: Creating child', {
      userId: authReq.userId,
      childData: { name: childData.name, familyId: childData.familyId, age: childData.age },
    });
    const child = await this.childService.createChild(childData);

    this.logger.debug('createChild: Child created successfully', {
      userId: authReq.userId,
      childId: child.id,
      childName: child.name,
      familyId: child.familyId,
    });

    this.logger.debug('createChild: Sending response', {
      userId: authReq.userId,
      success: true,
      childId: child.id,
    });
    sendSuccessResponse(res, 201, ChildSuccessResponseSchema, {
      success: true,
      data: child,
    });
  };

  getChildren = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    this.logger.debug('getChildren: Received request', {
      userId: authReq.userId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getChildren: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getChildren: Calling service', { userId: authReq.userId });
    const children = await this.childService.getChildrenByUser(authReq.userId);

    this.logger.debug('getChildren: Service result', {
      userId: authReq.userId,
      childCount: children.length,
    });

    this.logger.debug('getChildren: Sending response', {
      userId: authReq.userId,
      success: true,
      childCount: children.length,
    });
    sendSuccessResponse(res, 200, ChildrenSuccessResponseSchema, {
      success: true,
      data: children,
    });
  };

  getChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    this.logger.debug('getChild: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getChild: Calling service', { childId, userId: authReq.userId });
    const child = await this.childService.getChildById(childId, authReq.userId);

    this.logger.debug('getChild: Child found', {
      childId,
      childName: child.name,
      familyId: child.familyId,
      hasFamilyId: !!child.familyId,
    });

    this.logger.debug('getChild: Sending response', {
      childId,
      success: true,
    });
    sendSuccessResponse(res, 200, ChildSuccessResponseSchema, {
      success: true,
      data: child,
    });
  };

  updateChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware
    const rawUpdateData = req.body; // Validated by middleware

    this.logger.debug('updateChild: Received request', {
      userId: authReq.userId,
      childId,
      updateData: rawUpdateData,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('updateChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const updateData: {
      name?: string;
      age?: number;
    } = {};
    if (rawUpdateData.name !== undefined) {
      updateData.name = rawUpdateData.name;
    }
    if (rawUpdateData.age !== undefined) {
      updateData.age = rawUpdateData.age;
    }

    if (Object.keys(updateData).length === 0) {
      this.logger.warn('updateChild: No update data provided', { userId: authReq.userId, childId });
      throw createError('No update data provided', 400);
    }

    this.logger.debug('updateChild: Calling service', { childId, userId: authReq.userId, updateData });
    const updatedChild = await this.childService.updateChild(childId, authReq.userId, updateData);

    this.logger.debug('updateChild: Child updated successfully', {
      childId,
      updatedName: updatedChild.name,
      updatedAge: updatedChild.age,
    });

    this.logger.debug('updateChild: Sending response', {
      childId,
      success: true,
    });
    sendSuccessResponse(res, 200, ChildSuccessResponseSchema, {
      success: true,
      data: updatedChild,
    });
  };

  deleteChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    this.logger.debug('deleteChild: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('deleteChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('deleteChild: Calling service', { childId, userId: authReq.userId });
    const result = await this.childService.deleteChild(childId, authReq.userId);

    this.logger.debug('deleteChild: Child deleted successfully', {
      childId,
      deleted: result.success,
    });

    this.logger.debug('deleteChild: Sending response', {
      childId,
      success: true,
    });
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: result,
    });
  };

  getChildAssignments = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware
    const { week } = req.query as { week?: string }; // Validated by middleware

    this.logger.debug('getChildAssignments: Received request', {
      userId: authReq.userId,
      childId,
      week,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getChildAssignments: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getChildAssignments: Calling service', { childId, userId: authReq.userId, week });
    const assignments = await this.childService.getChildScheduleAssignments(childId, authReq.userId, week);

    this.logger.debug('getChildAssignments: Assignments retrieved', {
      childId,
      assignmentCount: assignments.length,
      week,
    });

    this.logger.debug('getChildAssignments: Sending response', {
      childId,
      success: true,
      assignmentCount: assignments.length,
    });
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: assignments,
    });
  };

  // Group membership methods
  addChildToGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId, groupId } = req.params; // Validated by middleware

    this.logger.debug('addChildToGroup: Received request', {
      userId: authReq.userId,
      childId,
      groupId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('addChildToGroup: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('addChildToGroup: Calling service', { childId, groupId, userId: authReq.userId });
    const membership = await this.childAssignmentService.addChildToGroup(
      childId,
      groupId,
      authReq.userId,
    );

    this.logger.debug('addChildToGroup: Child added to group', {
      childId,
      groupId,
      membershipId: (membership as any).id,
    });

    this.logger.debug('addChildToGroup: Sending response', {
      childId,
      groupId,
      success: true,
    });
    sendSuccessResponse(res, 201, SimpleSuccessResponseSchema, {
      success: true,
      data: membership,
    });
  };

  removeChildFromGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId, groupId } = req.params; // Validated by middleware

    this.logger.debug('removeChildFromGroup: Received request', {
      userId: authReq.userId,
      childId,
      groupId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('removeChildFromGroup: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('removeChildFromGroup: Calling service', { childId, groupId, userId: authReq.userId });
    const result = await this.childAssignmentService.removeChildFromGroup(
      childId,
      groupId,
      authReq.userId,
    );

    this.logger.debug('removeChildFromGroup: Child removed from group', {
      childId,
      groupId,
      removed: result.success,
    });

    this.logger.debug('removeChildFromGroup: Sending response', {
      childId,
      groupId,
      success: true,
    });
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: result,
    });
  };

  getChildGroupMemberships = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    this.logger.debug('getChildGroupMemberships: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getChildGroupMemberships: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getChildGroupMemberships: Calling service', { childId, userId: authReq.userId });
    const memberships = await this.childAssignmentService.getChildGroupMemberships(
      childId,
      authReq.userId,
    );

    this.logger.debug('getChildGroupMemberships: Memberships retrieved', {
      childId,
      membershipCount: memberships.length,
    });

    this.logger.debug('getChildGroupMemberships: Sending response', {
      childId,
      success: true,
      membershipCount: memberships.length,
    });
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: memberships,
    });
  };
}

// Factory function to create controller with dependencies
export const createChildController = (): ChildController => {
  
  const prisma = new PrismaClient();
  const childService = new ChildService(prisma);
  const childAssignmentService = new ChildAssignmentService(prisma);

  return new ChildController(childService, childAssignmentService);
};