import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

/**
 * AuthorizationService - Handles authorization checks for WebSocket events and API endpoints
 * Ensures users can only access resources they have permission for
 */
export class AuthorizationService {
  private logger = createLogger('authorization');

  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a user can access a specific group
   * User can access if their family is a member of the group (including owner with role='OWNER')
   */
  async canUserAccessGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      // Get user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        select: { familyId: true },
      });

      if (!userFamily) {
        return false;
      }

      // Check if user's family is a member of the group (owner included via role='OWNER')
      const groupMember = await this.prisma.groupFamilyMember.findFirst({
        where: {
          groupId,
          familyId: userFamily.familyId,
        },
      });

      return !!groupMember;
    } catch (error) {
      this.logger.error(`Error checking group access for user ${userId}, group ${groupId}:`, { error: error instanceof Error ? error.message : String(error) });
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
        select: { groupId: true },
      });

      if (!scheduleSlot) {
        return false;
      }

      // Check if user can access the group
      return this.canUserAccessGroup(userId, scheduleSlot.groupId);
    } catch (error) {
      this.logger.error(`Error checking schedule slot access for user ${userId}, slot ${scheduleSlotId}:`, { error: error instanceof Error ? error.message : String(error) });
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
          familyId,
        },
      });

      return !!familyMember;
    } catch (error) {
      this.logger.error(`Error checking family access for user ${userId}, family ${familyId}:`, { error: error instanceof Error ? error.message : String(error) });
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
        select: { familyId: true },
      });

      if (!userFamily) {
        return [];
      }

      // Get all groups where the user's family is a member (including owned groups via role='OWNER')
      const accessibleGroups = await this.prisma.group.findMany({
        where: {
          familyMembers: {
            some: { familyId: userFamily.familyId },
          },
        },
        select: { id: true },
      });

      return accessibleGroups.map(group => group.id);
    } catch (error) {
      this.logger.error(`Error getting accessible groups for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
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

  /**
   * Get all family IDs that a user belongs to
   * Used during WebSocket connection setup to join family rooms
   */
  async getUserFamilies(userId: string): Promise<string[]> {
    try {
      const familyMemberships = await this.prisma.familyMember.findMany({
        where: { userId },
        select: { familyId: true },
      });

      return familyMemberships.map(fm => fm.familyId);
    } catch (error) {
      this.logger.error(`Error getting families for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}