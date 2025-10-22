import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { SocketEmitter } from '../utils/socketEmitter';

export interface CreateChildData {
  name: string;
  age?: number;
  familyId: string;
}

export interface UpdateChildData {
  name?: string;
  age?: number;
}

export class ChildService {
  constructor(private prisma: PrismaClient) {}

  async createChild(data: CreateChildData) {
    try {
      const child = await this.prisma.child.create({
        data: {
          name: data.name,
          age: data.age ?? null,  // Convert undefined to null for Prisma
          familyId: data.familyId
        }
      });

      // Emit WebSocket event for child creation
      SocketEmitter.broadcastChildUpdate('system', data.familyId, 'added', {
        child,
        familyId: data.familyId
      });

      return child;
    } catch (error) {
      console.error('Create child error:', error);
      throw new AppError('Failed to create child', 500);
    }
  }

  async getUserFamily(userId: string) {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: {
          family: true
        }
      });
      
      return familyMember?.family || null;
    } catch (error) {
      console.error('Get user family error:', error);
      throw new AppError('Failed to get user family', 500);
    }
  }

  async canUserModifyFamilyChildren(userId: string, familyId: string): Promise<boolean> {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { 
          userId,
          familyId
        }
      });

      // Only Admins can modify children
      return familyMember?.role === 'ADMIN';
    } catch (error) {
      console.error('Check user permissions error:', error);
      return false;
    }
  }

  async getChildrenByUser(userId: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return []; // User has no family, so no children
      }

      const children = await this.prisma.child.findMany({
        where: { familyId: userFamily.id },
        include: {
          groupMemberships: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: [
          { name: 'asc' }
        ]
      });

      return children;
    } catch (error) {
      console.error('Get children error:', error);
      throw new AppError('Failed to fetch children', 500);
    }
  }

  async getChildById(childId: string, userId: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to access children', 403);
      }

      const child = await this.prisma.child.findFirst({
        where: {
          id: childId,
          familyId: userFamily.id // Ensure child belongs to user's family
        }
      });

      if (!child) {
        throw new AppError('Child not found or access denied', 404);
      }

      return child;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get child error:', error);
      throw new AppError('Failed to fetch child', 500);
    }
  }

  async updateChild(childId: string, userId: string, data: UpdateChildData) {
    try {
      // Get user's family and verify permissions
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to modify children', 403);
      }

      // Verify user has permission to modify children in the family
      const canModifyChildren = await this.canUserModifyFamilyChildren(userId, userFamily.id);
      if (!canModifyChildren) {
        throw new AppError('Insufficient permissions to modify children in family', 403);
      }

      // Verify child exists and belongs to user's family
      const existingChild = await this.getChildById(childId, userId);
      
      if (!existingChild) {
        throw new AppError('Child not found or access denied', 404);
      }

      const updatedChild = await this.prisma.child.update({
        where: { id: childId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.age !== undefined && { age: data.age ?? null })
        }
      });

      // Emit WebSocket event for child update
      SocketEmitter.broadcastChildUpdate(userId, userFamily.id, 'updated', {
        child: updatedChild,
        familyId: userFamily.id,
        previousData: existingChild
      });

      return updatedChild;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Update child error:', error);
      throw new AppError('Failed to update child', 500);
    }
  }

  async deleteChild(childId: string, userId: string) {
    try {
      // Get user's family and verify permissions
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to delete children', 403);
      }

      // Verify user has permission to modify children in the family
      const canModifyChildren = await this.canUserModifyFamilyChildren(userId, userFamily.id);
      if (!canModifyChildren) {
        throw new AppError('Insufficient permissions to delete children in family', 403);
      }

      // Verify child exists and belongs to user's family
      const existingChild = await this.getChildById(childId, userId);
      
      if (!existingChild) {
        throw new AppError('Child not found or access denied', 404);
      }

      // TODO: Add schedule slot assignment check when relationships are finalized
      // For now, allow deletion without checking assignments

      await this.prisma.child.delete({
        where: { id: childId }
      });

      // Emit WebSocket event for child deletion
      SocketEmitter.broadcastChildUpdate(userId, userFamily.id, 'deleted', {
        childId,
        familyId: userFamily.id,
        deletedChild: existingChild
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Delete child error:', error);
      throw new AppError('Failed to delete child', 500);
    }
  }

  // TODO: Implement when ScheduleSlotChild relationships are finalized
  async getChildScheduleAssignments(childId: string, userId: string, _week?: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to access child assignments', 403);
      }

      // Verify child exists and belongs to user's family
      const child = await this.getChildById(childId, userId);
      
      if (!child) {
        throw new AppError('Child not found or access denied', 404);
      }

      // Temporarily return empty array until proper relationships are established
      return [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get child assignments error:', error);
      throw new AppError('Failed to fetch child assignments', 500);
    }
  }
}