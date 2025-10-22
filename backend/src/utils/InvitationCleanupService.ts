import { PrismaClient } from '@prisma/client';

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface InvitationCleanupConfig {
  retentionDays: number; // How long to keep cancelled/declined invitations
}

export class InvitationCleanupService {
  private static readonly DEFAULT_RETENTION_DAYS = 30;

  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
    private config: InvitationCleanupConfig = { retentionDays: InvitationCleanupService.DEFAULT_RETENTION_DAYS }
  ) {}

  /**
   * Clean up expired and old invitations for a specific family
   */
  async cleanupFamilyInvitations(familyId: string): Promise<{ expired: number; oldCancelled: number }> {
    try {
      const now = new Date();
      const retentionPeriod = new Date(now.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Clean up expired PENDING invitations
      const expiredCount = await this.prisma.familyInvitation.deleteMany({
        where: {
          familyId,
          status: 'PENDING',
          expiresAt: {
            lte: now
          }
        }
      });

      // Clean up old CANCELLED invitations
      const oldCancelledCount = await this.prisma.familyInvitation.deleteMany({
        where: {
          familyId,
          status: 'CANCELLED',
          createdAt: {
            lte: retentionPeriod
          }
        }
      });

      const totalDeleted = expiredCount.count + oldCancelledCount.count;
      if (totalDeleted > 0) {
        this.logger.info(`Cleaned up ${expiredCount.count} expired and ${oldCancelledCount.count} old cancelled family invitations for family ${familyId}`);
      }

      return { expired: expiredCount.count, oldCancelled: oldCancelledCount.count };
    } catch (error) {
      this.logger.error(`Failed to cleanup family invitations for family ${familyId}:`, error);
      // Don't throw - this is cleanup, not critical to the main operation
      return { expired: 0, oldCancelled: 0 };
    }
  }

  /**
   * Clean up expired and old invitations for a specific group
   */
  async cleanupGroupInvitations(groupId: string): Promise<{ expired: number; oldCancelled: number }> {
    try {
      const now = new Date();
      const retentionPeriod = new Date(now.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Clean up expired PENDING invitations
      const expiredCount = await this.prisma.groupInvitation.deleteMany({
        where: {
          groupId,
          status: 'PENDING',
          expiresAt: {
            lte: now
          }
        }
      });

      // Clean up old CANCELLED invitations
      const oldCancelledCount = await this.prisma.groupInvitation.deleteMany({
        where: {
          groupId,
          status: 'CANCELLED',
          createdAt: {
            lte: retentionPeriod
          }
        }
      });

      const totalDeleted = expiredCount.count + oldCancelledCount.count;
      if (totalDeleted > 0) {
        this.logger.info(`Cleaned up ${expiredCount.count} expired and ${oldCancelledCount.count} old cancelled group invitations for group ${groupId}`);
      }

      return { expired: expiredCount.count, oldCancelled: oldCancelledCount.count };
    } catch (error) {
      this.logger.error(`Failed to cleanup group invitations for group ${groupId}:`, error);
      // Don't throw - this is cleanup, not critical to the main operation
      return { expired: 0, oldCancelled: 0 };
    }
  }

  /**
   * Global cleanup method to remove old invitations across all families
   */
  async cleanupAllFamilyInvitations(): Promise<{ expired: number; oldCancelled: number }> {
    this.logger.info('Starting global family invitation cleanup');
    
    try {
      const now = new Date();
      const retentionPeriod = new Date(now.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Clean up expired PENDING invitations
      const expiredCount = await this.prisma.familyInvitation.deleteMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lte: now
          }
        }
      });

      // Clean up old CANCELLED invitations
      const oldCancelledCount = await this.prisma.familyInvitation.deleteMany({
        where: {
          status: 'CANCELLED',
          createdAt: {
            lte: retentionPeriod
          }
        }
      });

      this.logger.info(`Global family cleanup completed: removed ${expiredCount.count} expired and ${oldCancelledCount.count} old cancelled invitations`);
      
      return { expired: expiredCount.count, oldCancelled: oldCancelledCount.count };
    } catch (error) {
      this.logger.error('Failed to perform global family invitation cleanup:', error);
      throw error;
    }
  }

  /**
   * Global cleanup method to remove old invitations across all groups
   */
  async cleanupAllGroupInvitations(): Promise<{ expired: number; oldCancelled: number }> {
    this.logger.info('Starting global group invitation cleanup');
    
    try {
      const now = new Date();
      const retentionPeriod = new Date(now.getTime() - this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Clean up expired PENDING invitations
      const expiredCount = await this.prisma.groupInvitation.deleteMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lte: now
          }
        }
      });

      // Clean up old CANCELLED invitations
      const oldCancelledCount = await this.prisma.groupInvitation.deleteMany({
        where: {
          status: 'CANCELLED',
          createdAt: {
            lte: retentionPeriod
          }
        }
      });

      this.logger.info(`Global group cleanup completed: removed ${expiredCount.count} expired and ${oldCancelledCount.count} old cancelled invitations`);
      
      return { expired: expiredCount.count, oldCancelled: oldCancelledCount.count };
    } catch (error) {
      this.logger.error('Failed to perform global group invitation cleanup:', error);
      throw error;
    }
  }

  /**
   * Comprehensive cleanup for both families and groups
   */
  async cleanupAllInvitations(): Promise<{
    families: { expired: number; oldCancelled: number };
    groups: { expired: number; oldCancelled: number };
  }> {
    this.logger.info('Starting comprehensive invitation cleanup for all families and groups');
    
    const familyResults = await this.cleanupAllFamilyInvitations();
    const groupResults = await this.cleanupAllGroupInvitations();

    const totalExpired = familyResults.expired + groupResults.expired;
    const totalOldCancelled = familyResults.oldCancelled + groupResults.oldCancelled;

    this.logger.info(`Comprehensive cleanup completed: ${totalExpired} expired and ${totalOldCancelled} old cancelled invitations removed across all families and groups`);

    return {
      families: familyResults,
      groups: groupResults
    };
  }

  /**
   * Remove old invitation before creating new one (for re-invitations)
   * Only removes CANCELLED and EXPIRED invitations, not PENDING ones
   */
  async cleanupOldInvitation(type: 'family' | 'group', entityId: string, email: string): Promise<boolean> {
    try {
      let deletedInvitation = null;

      if (type === 'family') {
        const existingInvitation = await this.prisma.familyInvitation.findFirst({
          where: {
            familyId: entityId,
            email: email,
            status: { in: ['CANCELLED', 'EXPIRED'] }
          }
        });

        if (existingInvitation) {
          await this.prisma.familyInvitation.delete({
            where: { id: existingInvitation.id }
          });
          deletedInvitation = existingInvitation;
        }
      } else {
        const existingInvitation = await this.prisma.groupInvitation.findFirst({
          where: {
            groupId: entityId,
            email: email,
            status: { in: ['CANCELLED', 'EXPIRED'] }
          }
        });

        if (existingInvitation) {
          await this.prisma.groupInvitation.delete({
            where: { id: existingInvitation.id }
          });
          deletedInvitation = existingInvitation;
        }
      }

      if (deletedInvitation) {
        this.logger.info(`Removed old ${deletedInvitation.status} ${type} invitation for ${email} to allow re-invitation`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to cleanup old ${type} invitation for ${email}:`, error);
      return false;
    }
  }

  /**
   * Remove old family-based group invitations before creating new ones
   */
  async cleanupOldFamilyInvitation(_type: 'group', groupId: string, familyId: string): Promise<boolean> {
    try {
      // Get all admin emails for the family
      const family = await this.prisma.family.findUnique({
        where: { id: familyId },
        include: {
          members: {
            where: { role: 'ADMIN' },
            include: { user: true }
          }
        }
      });

      if (!family) {
        return false;
      }

      const adminEmails = family.members.map(m => m.user.email);
      let deletedCount = 0;

      // Clean up existing group invitations for all family admins
      for (const email of adminEmails) {
        const existingInvitations = await this.prisma.groupInvitation.deleteMany({
          where: {
            groupId,
            email,
            status: { in: ['CANCELLED', 'EXPIRED'] }
          }
        });
        deletedCount += existingInvitations.count;
      }

      if (deletedCount > 0) {
        this.logger.info(`Removed ${deletedCount} old group invitations for family ${family.name} to allow re-invitation`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to cleanup old family group invitations for family ${familyId}:`, error);
      return false;
    }
  }
}