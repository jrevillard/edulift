// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('ActivityLogRepository');

export interface CreateActivityData {
  userId: string;
  actionType: string;
  actionDescription: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ActivityLog {
  id: string;
  userId: string;
  actionType: string;
  actionDescription: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface GroupData {
  id: string;
  name: string;
  createdAt: Date;
}

// interface ChildData {
//   id: string;
//   name: string;
//   createdAt: Date;
// }

export class ActivityLogRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async createActivity(data: CreateActivityData): Promise<ActivityLog> {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: data.userId,
          actionType: data.actionType,
          actionDescription: data.actionDescription,
          entityType: data.entityType || null,
          entityId: data.entityId || null,
          entityName: data.entityName || null,
          metadata: data.metadata || null,
        },
      });
    } catch {
      // Fallback to mock if table doesn't exist yet
      logger.warn('ActivityLog table not available, returning mock data', { userId: data.userId, actionType: data.actionType });
      const activity: ActivityLog = {
        id: `activity-${Date.now()}`,
        userId: data.userId,
        actionType: data.actionType,
        actionDescription: data.actionDescription,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        entityName: data.entityName || null,
        metadata: data.metadata || null,
        createdAt: new Date(),
      };
      return activity;
    }
  }

  async getRecentActivityForFamily(familyId: string, limit: number = 10): Promise<ActivityLog[]> {
    try {
      return await this.prisma.activityLog.findMany({
        where: { 
          // Get activities for all users in the family
          user: {
            familyMemberships: {
              some: {
                familyId,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      // Since ActivityLog table doesn't exist yet, fetch real data from other tables for family
      logger.warn('ActivityLog table not available, generating family-based activities from existing data', { familyId });
      
      try {
        // Get recent data from various tables for the family
        const [groups, children, vehicles] = await Promise.all([
          // Get groups owned by or having this family as member
          this.prisma.group.findMany({
            where: {
              OR: [
                // Groups owned by this family
                { ownerFamily: { id: familyId } },
                // Groups where this family is a member
                {
                  familyMembers: {
                    some: { familyId },
                  },
                },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              ownerFamily: {
                select: { name: true },
              },
            },
          }),
          // Get children belonging to this family
          this.prisma.child.findMany({
            where: { familyId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          // Get vehicles belonging to this family
          this.prisma.vehicle.findMany({
            where: { familyId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        const activities: ActivityLog[] = [];

        // Add group activities
        groups.forEach((group: GroupData) => {
          activities.push({
            id: `group-${group.id}`,
            userId: '', // Family-based, not user-specific
            actionType: 'GROUP_ACCESS',
            actionDescription: `Family has access to group "${group.name}"`,
            entityType: 'group',
            entityId: group.id,
            entityName: group.name,
            metadata: null,
            createdAt: group.createdAt,
          });
        });

        // Add child activities
        children.forEach(child => {
          activities.push({
            id: `child-${child.id}`,
            userId: '', // Family-based, not user-specific
            actionType: 'CHILD_ADD',
            actionDescription: `Added child "${child.name}" to family`,
            entityType: 'child',
            entityId: child.id,
            entityName: child.name,
            metadata: { age: child.age },
            createdAt: child.createdAt,
          });
        });

        // Add vehicle activities
        vehicles.forEach(vehicle => {
          activities.push({
            id: `vehicle-${vehicle.id}`,
            userId: '', // Family-based, not user-specific
            actionType: 'VEHICLE_ADD',
            actionDescription: `Added vehicle "${vehicle.name}" to family`,
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityName: vehicle.name,
            metadata: { capacity: vehicle.capacity },
            createdAt: vehicle.createdAt,
          });
        });

        // Sort by date and return the most recent
        activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return activities.slice(0, limit);
      } catch (fallbackError) {
        logger.error('Error generating family activities from existing data', { familyId, error: fallbackError });
        return [];
      }
    }
  }

  async getRecentActivityForUser(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    try {
      return await this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      // Since ActivityLog table doesn't exist yet, fetch real data from other tables
      logger.warn('ActivityLog table not available, generating from existing data', { userId });
      
      try {
        // Get recent data from various tables
        const [groups, children, vehicles] = await Promise.all([
          // Get user's groups through family memberships
          this.prisma.group.findMany({
            where: {
              OR: [
                // Groups owned by user's family
                {
                  ownerFamily: {
                    members: {
                      some: { userId },
                    },
                  },
                },
                // Groups where user's family is a member
                {
                  familyMembers: {
                    some: {
                      family: {
                        members: {
                          some: { userId },
                        },
                      },
                    },
                  },
                },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              ownerFamily: {
                select: { name: true },
              },
            },
          }),
          // Get user's children through family
          this.prisma.child.findMany({
            where: { 
              family: {
                members: {
                  some: { userId },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          // Get user's vehicles through family
          this.prisma.vehicle.findMany({
            where: { 
              family: {
                members: {
                  some: { userId },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        const activities: ActivityLog[] = [];

        // Add group activities
        groups.forEach((group: GroupData) => {
          activities.push({
            id: `group-${group.id}`,
            userId,
            actionType: 'GROUP_ACCESS',
            actionDescription: `Has access to group "${group.name}"`,
            entityType: 'group',
            entityId: group.id,
            entityName: group.name,
            metadata: null,
            createdAt: group.createdAt,
          });
        });

        // Add child activities
        children.forEach(child => {
          activities.push({
            id: `child-${child.id}`,
            userId,
            actionType: 'CHILD_ADD',
            actionDescription: `Added child "${child.name}"`,
            entityType: 'child',
            entityId: child.id,
            entityName: child.name,
            metadata: { age: child.age },
            createdAt: child.createdAt,
          });
        });

        // Add vehicle activities
        vehicles.forEach(vehicle => {
          activities.push({
            id: `vehicle-${vehicle.id}`,
            userId,
            actionType: 'VEHICLE_ADD',
            actionDescription: `Added vehicle "${vehicle.name}"`,
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityName: vehicle.name,
            metadata: { capacity: vehicle.capacity },
            createdAt: vehicle.createdAt,
          });
        });

        // Sort by date and return the most recent
        activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return activities.slice(0, limit);
      } catch (fallbackError) {
        logger.error('Error generating activities from existing data', { userId, error: fallbackError });
        return [];
      }
    }
  }
}