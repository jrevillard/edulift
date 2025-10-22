import { Request, Response } from 'express';
import { ChildService } from '../services/ChildService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const CreateChildSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100, 'Name too long'),
  age: z.number().int().min(0).max(18).optional()
});

const UpdateChildSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100, 'Name too long').optional(),
  age: z.number().int().min(0).max(18).optional()
});

const ChildParamsSchema = z.object({
  childId: z.string().cuid('Invalid child ID format')
});

const WeekQuerySchema = z.object({
  week: z.string().optional()
});

const GroupParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format')
});

export class ChildController {
  constructor(
    private childService: ChildService,
    private childAssignmentService: ChildAssignmentService
  ) {}

  createChild = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, age } = CreateChildSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Get user's family - children must belong to a family
      const userFamily = await this.childService.getUserFamily(authReq.userId);
      if (!userFamily) {
        throw createError('User must belong to a family to add children', 403);
      }

      // Verify user has permission to add children to the family
      const canModifyChildren = await this.childService.canUserModifyFamilyChildren(authReq.userId, userFamily.id);
      if (!canModifyChildren) {
        throw createError('Insufficient permissions to add children to family', 403);
      }

      const childData: any = {
        name,
        familyId: userFamily.id
      };
      
      if (age !== undefined) {
        childData.age = age;
      }
      
      const child = await this.childService.createChild(childData);

      const response: ApiResponse = {
        success: true,
        data: child
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getChildren = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const children = await this.childService.getChildrenByUser(authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: children
      };

      res.status(200).json(response);
    } catch (error) {
      throw error;
    }
  };

  getChild = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const child = await this.childService.getChildById(childId, authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: child
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  updateChild = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      const rawUpdateData = UpdateChildSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Filter out undefined values for exactOptionalPropertyTypes compatibility
      const updateData: any = {};
      if (rawUpdateData.name !== undefined) {
        updateData.name = rawUpdateData.name;
      }
      if (rawUpdateData.age !== undefined) {
        updateData.age = rawUpdateData.age;
      }

      if (Object.keys(updateData).length === 0) {
        throw createError('No update data provided', 400);
      }

      const updatedChild = await this.childService.updateChild(childId, authReq.userId, updateData);

      const response: ApiResponse = {
        success: true,
        data: updatedChild
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  deleteChild = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const result = await this.childService.deleteChild(childId, authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getChildAssignments = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      const { week } = WeekQuerySchema.parse(req.query);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const assignments = await this.childService.getChildScheduleAssignments(childId, authReq.userId, week);

      const response: ApiResponse = {
        success: true,
        data: assignments
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  // Group membership methods
  addChildToGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      const { groupId } = GroupParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const membership = await this.childAssignmentService.addChildToGroup(
        childId, 
        groupId, 
        authReq.userId
      );

      const response: ApiResponse = {
        success: true,
        data: membership
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  removeChildFromGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      const { groupId } = GroupParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const result = await this.childAssignmentService.removeChildFromGroup(
        childId, 
        groupId, 
        authReq.userId
      );

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getChildGroupMemberships = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { childId } = ChildParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const memberships = await this.childAssignmentService.getChildGroupMemberships(
        childId, 
        authReq.userId
      );

      const response: ApiResponse = {
        success: true,
        data: memberships
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };
}

// Factory function to create controller with dependencies
export const createChildController = () => {
  const { PrismaClient } = require('@prisma/client');
  
  const prisma = new PrismaClient();
  const childService = new ChildService(prisma);
  const childAssignmentService = new ChildAssignmentService(prisma);

  return new ChildController(childService, childAssignmentService);
};