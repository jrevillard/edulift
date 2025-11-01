import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { isDateInPastWithTimezone } from '../utils/dateValidation';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChildAssignmentService');

export interface GroupChildMemberData {
  childId: string;
  groupId: string;
  addedBy: string;
}

export interface ScheduleSlotChildData {
  scheduleSlotId: string;
  childId: string;
}

export class ChildAssignmentService {
  private activityLogRepo: ActivityLogRepository;

  constructor(private prisma: PrismaClient) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
  }

  async addChildToGroup(childId: string, groupId: string, userId: string) {
    try {
      // 1. Verify child ownership through family membership
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        include: {
          family: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!child || !child.family || child.family.members.length === 0) {
        throw new AppError('Child not found or permission denied', 404);
      }

      // 2. Verify user's family has group access
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        select: { familyId: true },
      });

      if (!userFamily) {
        throw new AppError('User must be part of a family', 403);
      }

      const group = await this.prisma.group.findFirst({
        where: {
          id: groupId,
          OR: [
            { familyId: userFamily.familyId }, // User's family owns the group
            {
              familyMembers: {
                some: { familyId: userFamily.familyId }, // User's family is a member
              },
            },
          ],
        },
      });

      if (!group) {
        throw new AppError('User\'s family must have access to group', 403);
      }

      // 3. Check if child is already in group
      const existingMembership = await this.prisma.groupChildMember.findUnique({
        where: {
          childId_groupId: {
            childId,
            groupId,
          },
        },
      });

      if (existingMembership) {
        throw new AppError('Child is already member of this group', 400);
      }

      // 4. Add child to group
      const childGroupMember = await this.prisma.groupChildMember.create({
        data: {
          childId,
          groupId,
          addedBy: userId,
        },
        include: {
          child: true,
          group: true,
        },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'CHILD_GROUP_ADD',
        actionDescription: `Added child "${childGroupMember.child.name}" to group "${childGroupMember.group.name}"`,
        entityType: 'child',
        entityId: childId,
        entityName: childGroupMember.child.name,
        metadata: { groupId, groupName: childGroupMember.group.name },
      });

      return childGroupMember;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to add child to group', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, childId, groupId });
      throw new AppError('Failed to add child to group', 500);
    }
  }

  async removeChildFromGroup(childId: string, groupId: string, userId: string) {
    try {
      // Verify child ownership through family membership
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        include: {
          family: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!child || !child.family || child.family.members.length === 0) {
        throw new AppError('Child not found or permission denied', 404);
      }

      // Remove child from group
      await this.prisma.groupChildMember.delete({
        where: {
          childId_groupId: {
            childId,
            groupId,
          },
        },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to remove child from group', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, childId, groupId });
      throw new AppError('Failed to remove child from group', 500);
    }
  }

  async assignChildToScheduleSlot(scheduleSlotId: string, childId: string, vehicleAssignmentId: string, userId: string) {
    try {
      // ✅ PRODUCTION: Use SERIALIZABLE transaction to prevent race conditions
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Verify child ownership through family membership and get user info with timezone
          const [child, user] = await Promise.all([
            tx.child.findUnique({
              where: { id: childId },
              include: {
                family: {
                  include: {
                    members: {
                      where: { userId },
                    },
                  },
                },
              },
            }),
            tx.user.findUnique({
              where: { id: userId },
              select: { timezone: true },
            }),
          ]);

          if (!child || !child.family || child.family.members.length === 0) {
            throw new AppError('Child not found or permission denied', 404);
          }

          // 2. Get schedule slot and verify group membership
          const scheduleSlot = await tx.scheduleSlot.findUnique({
            where: { id: scheduleSlotId },
          });

          if (!scheduleSlot) {
            throw new AppError('Schedule slot not found', 404);
          }

          // 2.1. Validate that the schedule slot is not in the past (timezone-aware)
          const userTimezone = user?.timezone || 'UTC';
          if (isDateInPastWithTimezone(scheduleSlot.datetime, userTimezone)) {
            throw new AppError('Cannot assign children to schedule slots in the past', 400);
          }

          // Verify user's family has group access
          const userFamily = await tx.familyMember.findFirst({
            where: { userId },
            select: { familyId: true },
          });

          if (!userFamily) {
            throw new AppError('User must be part of a family', 403);
          }

          const group = await tx.group.findFirst({
            where: {
              id: scheduleSlot.groupId,
              OR: [
                { familyId: userFamily.familyId }, // User's family owns the group
                {
                  familyMembers: {
                    some: { familyId: userFamily.familyId }, // User's family is a member
                  },
                },
              ],
            },
          });

          if (!group) {
            throw new AppError('User\'s family must have access to group', 403);
          }

          // 3. ✅ CRITICAL: Lock vehicle assignment and validate capacity INSIDE transaction
          const vehicleAssignment = await tx.scheduleSlotVehicle.findUnique({
            where: { id: vehicleAssignmentId },
            include: {
              vehicle: {
                select: { id: true, name: true, capacity: true },
              },
              childAssignments: true,
            },
          });

          if (!vehicleAssignment || vehicleAssignment.scheduleSlotId !== scheduleSlotId) {
            throw new AppError('Vehicle assignment not found in this schedule slot', 404);
          }

          // ✅ CRITICAL: Calculate capacity with seat override support
          const effectiveCapacity = vehicleAssignment.seatOverride ?? vehicleAssignment.vehicle.capacity;
          const currentOccupancy = vehicleAssignment.childAssignments.length;

          // ✅ PRODUCTION: Return 409 Conflict (not 400) for capacity issues
          if (currentOccupancy >= effectiveCapacity) {
            throw new AppError(
              `Vehicle ${vehicleAssignment.vehicle.name} is at full capacity (${currentOccupancy}/${effectiveCapacity})`,
              409, // Status code for conflict
            );
          }

          // 4. Check if child is already assigned
          const existingAssignment = await tx.scheduleSlotChild.findUnique({
            where: {
              scheduleSlotId_childId: {
                scheduleSlotId,
                childId,
              },
            },
          });

          if (existingAssignment) {
            throw new AppError('Child already assigned to this slot', 409);
          }

          // 5. Create assignment (always inside transaction)
          const assignment = await tx.scheduleSlotChild.create({
            data: {
              scheduleSlotId,
              childId,
              vehicleAssignmentId,
            },
            include: {
              child: true,
              scheduleSlot: true,
              vehicleAssignment: {
                include: { vehicle: true },
              },
            },
          });

          return assignment;
        },
        {
          // ✅ SERIALIZABLE = Maximum isolation - prevents race conditions
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000, // 10s timeout to avoid deadlocks
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to assign child to schedule slot', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, scheduleSlotId, childId, vehicleAssignmentId });
      throw new AppError('Failed to assign child to schedule slot', 500);
    }
  }

  async removeChildFromScheduleSlot(scheduleSlotId: string, childId: string, userId: string) {
    try {
      // ✅ PRODUCTION: Use SERIALIZABLE transaction for consistency
      return await this.prisma.$transaction(
        async (tx) => {
          // Verify child ownership through family membership
          const child = await tx.child.findUnique({
            where: { id: childId },
            include: {
              family: {
                include: {
                  members: {
                    where: { userId },
                  },
                },
              },
            },
          });

          if (!child || !child.family || child.family.members.length === 0) {
            throw new AppError('Child not found or permission denied', 404);
          }

          // Remove assignment
          await tx.scheduleSlotChild.delete({
            where: {
              scheduleSlotId_childId: {
                scheduleSlotId,
                childId,
              },
            },
          });

          return { success: true };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to remove child from schedule slot', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, scheduleSlotId, childId });
      throw new AppError('Failed to remove child from schedule slot', 500);
    }
  }

  async getAvailableChildrenForScheduleSlot(scheduleSlotId: string, userId: string) {
    try {
      // Get schedule slot
      const scheduleSlot = await this.prisma.scheduleSlot.findUnique({
        where: { id: scheduleSlotId },
      });

      if (!scheduleSlot) {
        throw new AppError('Schedule slot not found', 404);
      }

      // Get user's children that are members of this group
      const children = await this.prisma.child.findMany({
        where: {
          family: {
            members: {
              some: { userId },
            },
          },
          groupMemberships: {
            some: {
              groupId: scheduleSlot.groupId,
            },
          },
        },
        include: {
          groupMemberships: true,
        },
      });

      // Get already assigned children
      const assignedChildren = await this.prisma.scheduleSlotChild.findMany({
        where: { scheduleSlotId },
        select: { childId: true },
      });

      const assignedChildIds = assignedChildren.map(a => a.childId);

      // Filter out already assigned children
      const availableChildren = children.filter(
        child => !assignedChildIds.includes(child.id),
      );

      return availableChildren;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get available children', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, scheduleSlotId });
      throw new AppError('Failed to get available children', 500);
    }
  }

  async getChildGroupMemberships(childId: string, userId: string) {
    try {
      // Verify child ownership through family membership
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        include: {
          family: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!child || !child.family || child.family.members.length === 0) {
        throw new AppError('Child not found or permission denied', 404);
      }

      const memberships = await this.prisma.groupChildMember.findMany({
        where: { childId },
        include: {
          group: {
            select: { id: true, name: true },
          },
        },
      });

      return memberships;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get child group memberships', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, childId });
      throw new AppError('Failed to get child group memberships', 500);
    }
  }
}