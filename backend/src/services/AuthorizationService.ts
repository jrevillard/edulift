import { PrismaClient } from '@prisma/client';

/**
 * AuthorizationService - Handles authorization checks for WebSocket events and API endpoints
 * Ensures users can only access resources they have permission for
 */
export class AuthorizationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a user can access a specific group
   * User can access if their family owns the group OR is a member of the group
   */
  async canUserAccessGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      // Get user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        select: { familyId: true }
      });

      if (!userFamily) {
        return false;
      }

      // Check if group exists and user's family has access
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          familyMembers: {
            where: {
              familyId: userFamily.familyId
            }
          }
        }
      });

      if (!group) {
        return false;
      }

      // User can access if:
      // 1. Their family owns the group, OR
      // 2. Their family is a member of the group
      const isOwnerFamily = group.familyId === userFamily.familyId;
      const isMemberFamily = group.familyMembers.length > 0;

      return isOwnerFamily || isMemberFamily;
    } catch (error) {
      console.error(`Error checking group access for user ${userId}, group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Check if a user can access a specific schedule slot
   * User can access if they can access the group that owns the schedule slot
   */
  async canUserAccessScheduleSlot(userId: string, scheduleSlotId: string): Promise<boolean> {
    try {
      // Get the schedule slot and its group
      const scheduleSlot = await this.prisma.scheduleSlot.findUnique({
        where: { id: scheduleSlotId },
        select: { groupId: true }
      });

      if (!scheduleSlot) {
        return false;
      }

      // Check if user can access the group
      return this.canUserAccessGroup(userId, scheduleSlot.groupId);
    } catch (error) {
      console.error(`Error checking schedule slot access for user ${userId}, slot ${scheduleSlotId}:`, error);
      return false;
    }
  }

  /**
   * Check if a user is part of a specific family
   */
  async canUserAccessFamily(userId: string, familyId: string): Promise<boolean> {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: {
          userId,
          familyId
        }
      });

      return !!familyMember;
    } catch (error) {
      console.error(`Error checking family access for user ${userId}, family ${familyId}:`, error);
      return false;
    }
  }

  /**
   * Get all group IDs that a user has access to
   * Used during WebSocket connection setup
   */
  async getUserAccessibleGroupIds(userId: string): Promise<string[]> {
    try {
      // Get user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        select: { familyId: true }
      });

      if (!userFamily) {
        return [];
      }

      // Get all groups where the user's family has access
      const accessibleGroups = await this.prisma.group.findMany({
        where: {
          OR: [
            { familyId: userFamily.familyId }, // Groups owned by the family
            {
              familyMembers: {
                some: { familyId: userFamily.familyId } // Groups the family participates in
              }
            }
          ]
        },
        select: { id: true }
      });

      return accessibleGroups.map(group => group.id);
    } catch (error) {
      console.error(`Error getting accessible groups for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Batch authorization check for multiple groups
   */
  async canUserAccessGroups(userId: string, groupIds: string[]): Promise<{[groupId: string]: boolean}> {
    const results: {[groupId: string]: boolean} = {};
    
    // Get accessible group IDs for the user
    const accessibleGroupIds = await this.getUserAccessibleGroupIds(userId);
    
    // Check each requested group
    for (const groupId of groupIds) {
      results[groupId] = accessibleGroupIds.includes(groupId);
    }
    
    return results;
  }
}