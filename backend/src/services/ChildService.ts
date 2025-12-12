import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
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
  private logger = createLogger('child');

  constructor(private prisma: PrismaClient) {}

  async createChild(data: CreateChildData) {
    try {
      const child = await this.prisma.child.create({
        data: {
          name: data.name,
          age: data.age ?? null,  // Convert undefined to null for Prisma
          familyId: data.familyId,
        },
      });

      // Emit WebSocket event for child creation
      SocketEmitter.broadcastChildUpdate('system', data.familyId, 'added', {
        child,
        familyId: data.familyId,
      });

      return child;
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
        groupMemberships: child.groupMemberships.map(membership => ({
          ...membership,
          addedAt: membership.addedAt ? membership.addedAt.toISOString() : new Date().toISOString(),
        })),
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
        previousData: existingChild,
      });

      return updatedChild;
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

      // Emit WebSocket event for child deletion
      SocketEmitter.broadcastChildUpdate(userId, userFamily.id, 'deleted', {
        childId,
        familyId: userFamily.id,
        deletedChild: existingChild,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Delete child error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to delete child', 500);
    }
  }

  async getChildScheduleAssignments(childId: string, userId: string, week?: string) {
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

      // Build date filter for the week if provided
      let dateFilter: { gte?: Date; lte?: Date } = {};
      if (week) {
        // Parse week format (YYYY-W##) to get date range
        const weekMatch = week.match(/^(\d{4})-W(\d{2})$/);
        if (weekMatch) {
          const year = parseInt(weekMatch[1]);
          const weekNumber = parseInt(weekMatch[2]);

          // Get start of week (Monday)
          const startDate = new Date(year, 0, 1 + (weekNumber - 1) * 7);
          startDate.setDate(startDate.getDate() - startDate.getDay() + 1);

          // Get end of week (Sunday)
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);

          dateFilter = {
            gte: startDate,
            lte: endDate,
          };
        }
      }

      // Get child's schedule assignments through ScheduleSlotChild relationships
      const assignments = await this.prisma.scheduleSlotChild.findMany({
        where: {
          childId,
          scheduleSlot: {
            datetime: dateFilter,
          },
        },
        include: {
          scheduleSlot: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          vehicleAssignment: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  capacity: true,
                  familyId: true,
                },
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          scheduleSlot: {
            datetime: 'asc',
          },
        },
      });

      // Transform assignments to match the expected schema format
      const transformedAssignments = assignments.map((assignment) => {
        const scheduleDate = assignment.scheduleSlot.datetime.toISOString().split('T')[0];
        const timeOfDay = assignment.scheduleSlot.datetime.toTimeString().slice(0, 5);

        // Determine trip type based on time (simplified logic)
        const tripType = parseInt(timeOfDay.replace(':', '')) < 1200 ? 'PICKUP' : 'DROPOFF';

        return {
          id: `${assignment.scheduleSlotId}_${assignment.childId}`, // Composite identifier
          childId: assignment.childId,
          tripDate: scheduleDate,
          tripType: tripType as 'PICKUP' | 'DROPOFF',
          status: 'ASSIGNED' as const, // Since we're fetching assigned slots
          group: assignment.scheduleSlot.group ? {
            id: assignment.scheduleSlot.group.id,
            name: assignment.scheduleSlot.group.name,
          } : undefined,
          vehicle: assignment.vehicleAssignment ? {
            id: assignment.vehicleAssignment.vehicle.id,
            name: assignment.vehicleAssignment.vehicle.name,
            capacity: assignment.vehicleAssignment.vehicle.capacity,
            driver: assignment.vehicleAssignment.driver ? {
              id: assignment.vehicleAssignment.driver.id,
              name: assignment.vehicleAssignment.driver.name,
            } : undefined,
          } : undefined,
          assignedAt: assignment.assignedAt.toISOString(),
        };
      });

      this.logger.info('Child assignments retrieved successfully', {
        childId,
        userId,
        week,
        assignmentCount: transformedAssignments.length,
      });

      return transformedAssignments;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get child assignments error:', {
        error: error instanceof Error ? error.message : String(error),
        childId,
        userId,
        week,
      });
      throw new AppError('Failed to fetch child assignments', 500);
    }
  }
}