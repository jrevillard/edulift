import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { SocketEmitter } from '../utils/socketEmitter';
import { createLogger } from '../utils/logger';

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
  private activityLogRepo: ActivityLogRepository;
  private logger = createLogger('child');

  // Same include pattern as FamilyService for consistency
  private static readonly FAMILY_INCLUDE = {
    members: {
      include: { user: true },
    },
    children: true,
    vehicles: true,
  };

  constructor(private prisma: PrismaClient) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
  }

  async createChild(data: CreateChildData, userId: string) {
    try {
      const child = await this.prisma.child.create({
        data: {
          name: data.name,
          age: data.age ?? null,  // Convert undefined to null for Prisma
          familyId: data.familyId,
        },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'CHILD_ADD',
        actionDescription: `Added child "${data.name}"`,
        entityType: 'child',
        entityId: child.id,
        entityName: data.name,
        metadata: { age: data.age },
      });

      // Emit WebSocket event for child creation
      SocketEmitter.broadcastChildUpdate(userId, data.familyId, 'added', {
        child,
        familyId: data.familyId,
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: data.familyId },
        include: ChildService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Failed to retrieve updated family', 500);
      }

      return updatedFamily;
    } catch (error) {
      this.logger.error('Create child error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to create child', 500);
    }
  }

  async getUserFamily(userId: string) {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: {
          family: true,
        },
      });
      
      return familyMember?.family || null;
    } catch (error) {
      this.logger.error('Get user family error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to get user family', 500);
    }
  }

  async canUserModifyFamilyChildren(userId: string, familyId: string): Promise<boolean> {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { 
          userId,
          familyId,
        },
      });

      // Only Admins can modify children
      return familyMember?.role === 'ADMIN';
    } catch (error) {
      this.logger.error('Check user permissions error:', { error: error instanceof Error ? error.message : String(error) });
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
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          { name: 'asc' },
        ],
      });

      // Transform the response to match schema expectations (convert Date to ISO string)
      const transformedChildren = children.map(child => ({
        ...child,
        groupMemberships: child.groupMemberships?.map(membership => ({
          ...membership,
          addedAt: membership.addedAt ? membership.addedAt.toISOString() : new Date().toISOString(),
        })) ?? [],
      }));

      return transformedChildren;
    } catch (error) {
      this.logger.error('Get children error:', { error: error instanceof Error ? error.message : String(error) });
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
          familyId: userFamily.id, // Ensure child belongs to user's family
        },
      });

      if (!child) {
        throw new AppError('Child not found or access denied', 404);
      }

      return child;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get child error:', { error: error instanceof Error ? error.message : String(error) });
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
          ...(data.age !== undefined && { age: data.age ?? null }),
        },
      });

      // Emit WebSocket event for child update
      SocketEmitter.broadcastChildUpdate(userId, userFamily.id, 'updated', {
        child: updatedChild,
        familyId: userFamily.id,
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: userFamily.id },
        include: ChildService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Failed to retrieve updated family', 500);
      }

      return updatedFamily;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Update child error:', { error: error instanceof Error ? error.message : String(error) });
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
        where: { id: childId },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'CHILD_DELETE',
        actionDescription: `Deleted child "${existingChild.name}"`,
        entityType: 'child',
        entityId: childId,
        entityName: existingChild.name,
      });

      // Emit WebSocket event for child deletion
      SocketEmitter.broadcastChildUpdate(userId, userFamily.id, 'deleted', {
        childId,
        familyId: userFamily.id,
        child: existingChild,
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: userFamily.id },
        include: ChildService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Family not found after child deletion', 500);
      }

      return updatedFamily;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Delete child error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to delete child', 500);
    }
  }
}