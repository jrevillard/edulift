import { Request, Response } from 'express';
import { ChildService } from '../services/ChildService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const childLogger = createLogger('ChildController');

export class ChildController {
  constructor(
    private childService: ChildService,
    private childAssignmentService: ChildAssignmentService,
  ) {}

  createChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { name, age } = req.body; // Validated by middleware

    childLogger.debug('createChild: Received request', {
      userId: authReq.userId,
      name,
      age,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('createChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('createChild: Authentication validated', { userId: authReq.userId });

    // Get user's family - children must belong to a family
    childLogger.debug('createChild: Getting user family', { userId: authReq.userId });
    const userFamily = await this.childService.getUserFamily(authReq.userId);
    if (!userFamily) {
      childLogger.warn('createChild: User not part of any family', { userId: authReq.userId });
      throw createError('User must belong to a family to add children', 403);
    }

    childLogger.debug('createChild: Family found', {
      userId: authReq.userId,
      familyId: userFamily.id,
      familyName: userFamily.name,
    });

    // Verify user has permission to add children to the family
    childLogger.debug('createChild: Checking permissions', {
      userId: authReq.userId,
      familyId: userFamily.id,
    });
    const canModifyChildren = await this.childService.canUserModifyFamilyChildren(authReq.userId, userFamily.id);
    if (!canModifyChildren) {
      childLogger.warn('createChild: Insufficient permissions', {
        userId: authReq.userId,
        familyId: userFamily.id,
      });
      throw createError('Insufficient permissions to add children to family', 403);
    }

    childLogger.debug('createChild: Permissions validated', { userId: authReq.userId });

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

    childLogger.debug('createChild: Creating child', {
      userId: authReq.userId,
      childData: { name: childData.name, familyId: childData.familyId, age: childData.age },
    });
    const child = await this.childService.createChild(childData);

    childLogger.debug('createChild: Child created successfully', {
      userId: authReq.userId,
      childId: child.id,
      childName: child.name,
      familyId: child.familyId,
    });

    const response: ApiResponse = {
      success: true,
      data: child,
    };

    childLogger.debug('createChild: Sending response', {
      userId: authReq.userId,
      success: true,
      childId: child.id,
    });
    res.status(201).json(response);
  };

  getChildren = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    childLogger.debug('getChildren: Received request', {
      userId: authReq.userId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('getChildren: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('getChildren: Calling service', { userId: authReq.userId });
    const children = await this.childService.getChildrenByUser(authReq.userId);

    childLogger.debug('getChildren: Service result', {
      userId: authReq.userId,
      childCount: children.length,
    });

    const response: ApiResponse = {
      success: true,
      data: children,
    };

    childLogger.debug('getChildren: Sending response', {
      userId: authReq.userId,
      success: true,
      childCount: children.length,
    });
    res.status(200).json(response);
  };

  getChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    childLogger.debug('getChild: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('getChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('getChild: Calling service', { childId, userId: authReq.userId });
    const child = await this.childService.getChildById(childId, authReq.userId);

    childLogger.debug('getChild: Child found', {
      childId,
      childName: child.name,
      familyId: child.familyId,
      hasFamilyId: !!child.familyId,
    });

    const response: ApiResponse = {
      success: true,
      data: child,
    };

    childLogger.debug('getChild: Sending response', {
      childId,
      success: true,
    });
    res.status(200).json(response);
  };

  updateChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware
    const rawUpdateData = req.body; // Validated by middleware

    childLogger.debug('updateChild: Received request', {
      userId: authReq.userId,
      childId,
      updateData: rawUpdateData,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('updateChild: Authentication required', { userId: authReq.userId });
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
      childLogger.warn('updateChild: No update data provided', { userId: authReq.userId, childId });
      throw createError('No update data provided', 400);
    }

    childLogger.debug('updateChild: Calling service', { childId, userId: authReq.userId, updateData });
    const updatedChild = await this.childService.updateChild(childId, authReq.userId, updateData);

    childLogger.debug('updateChild: Child updated successfully', {
      childId,
      updatedName: updatedChild.name,
      updatedAge: updatedChild.age,
    });

    const response: ApiResponse = {
      success: true,
      data: updatedChild,
    };

    childLogger.debug('updateChild: Sending response', {
      childId,
      success: true,
    });
    res.status(200).json(response);
  };

  deleteChild = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    childLogger.debug('deleteChild: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('deleteChild: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('deleteChild: Calling service', { childId, userId: authReq.userId });
    const result = await this.childService.deleteChild(childId, authReq.userId);

    childLogger.debug('deleteChild: Child deleted successfully', {
      childId,
      deleted: result.success,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    childLogger.debug('deleteChild: Sending response', {
      childId,
      success: true,
    });
    res.status(200).json(response);
  };

  getChildAssignments = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware
    const { week } = req.query as { week?: string }; // Validated by middleware

    childLogger.debug('getChildAssignments: Received request', {
      userId: authReq.userId,
      childId,
      week,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('getChildAssignments: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('getChildAssignments: Calling service', { childId, userId: authReq.userId, week });
    const assignments = await this.childService.getChildScheduleAssignments(childId, authReq.userId, week);

    childLogger.debug('getChildAssignments: Assignments retrieved', {
      childId,
      assignmentCount: assignments.length,
      week,
    });

    const response: ApiResponse = {
      success: true,
      data: assignments,
    };

    childLogger.debug('getChildAssignments: Sending response', {
      childId,
      success: true,
      assignmentCount: assignments.length,
    });
    res.status(200).json(response);
  };

  // Group membership methods
  addChildToGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId, groupId } = req.params; // Validated by middleware

    childLogger.debug('addChildToGroup: Received request', {
      userId: authReq.userId,
      childId,
      groupId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('addChildToGroup: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('addChildToGroup: Calling service', { childId, groupId, userId: authReq.userId });
    const membership = await this.childAssignmentService.addChildToGroup(
      childId,
      groupId,
      authReq.userId,
    );

    childLogger.debug('addChildToGroup: Child added to group', {
      childId,
      groupId,
      membershipId: (membership as any).id,
    });

    const response: ApiResponse = {
      success: true,
      data: membership,
    };

    childLogger.debug('addChildToGroup: Sending response', {
      childId,
      groupId,
      success: true,
    });
    res.status(201).json(response);
  };

  removeChildFromGroup = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId, groupId } = req.params; // Validated by middleware

    childLogger.debug('removeChildFromGroup: Received request', {
      userId: authReq.userId,
      childId,
      groupId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('removeChildFromGroup: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('removeChildFromGroup: Calling service', { childId, groupId, userId: authReq.userId });
    const result = await this.childAssignmentService.removeChildFromGroup(
      childId,
      groupId,
      authReq.userId,
    );

    childLogger.debug('removeChildFromGroup: Child removed from group', {
      childId,
      groupId,
      removed: result.success,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    childLogger.debug('removeChildFromGroup: Sending response', {
      childId,
      groupId,
      success: true,
    });
    res.status(200).json(response);
  };

  getChildGroupMemberships = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { childId } = req.params; // Validated by middleware

    childLogger.debug('getChildGroupMemberships: Received request', {
      userId: authReq.userId,
      childId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      childLogger.error('getChildGroupMemberships: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    childLogger.debug('getChildGroupMemberships: Calling service', { childId, userId: authReq.userId });
    const memberships = await this.childAssignmentService.getChildGroupMemberships(
      childId,
      authReq.userId,
    );

    childLogger.debug('getChildGroupMemberships: Memberships retrieved', {
      childId,
      membershipCount: memberships.length,
    });

    const response: ApiResponse = {
      success: true,
      data: memberships,
    };

    childLogger.debug('getChildGroupMemberships: Sending response', {
      childId,
      success: true,
      membershipCount: memberships.length,
    });
    res.status(200).json(response);
  };
}

// Factory function to create controller with dependencies
export const createChildController = (): ChildController => {
  
  const prisma = new PrismaClient();
  const childService = new ChildService(prisma);
  const childAssignmentService = new ChildAssignmentService(prisma);

  return new ChildController(childService, childAssignmentService);
};