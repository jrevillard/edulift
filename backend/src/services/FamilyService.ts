// @ts-nocheck
import { PrismaClient, FamilyRole } from '@prisma/client';
import { Family, IFamilyService, FamilyError } from '../types/family';
import { NotificationService } from './NotificationService';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { UnifiedInvitationService } from './UnifiedInvitationService';
import { SocketEmitter } from '../utils/socketEmitter';

interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export class FamilyService implements IFamilyService {
  // private static readonly MAX_FAMILY_MEMBERS = 6; // Currently unused
  private static readonly FAMILY_INCLUDE = {
    members: {
      include: { user: true },
    },
    children: true,
    vehicles: true,
  };

  private unifiedInvitationService: UnifiedInvitationService;

  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
    private notificationService?: NotificationService,
    emailService?: EmailServiceInterface,
  ) {
    this.unifiedInvitationService = new UnifiedInvitationService(
      prisma,
      logger,
      emailService as any, // Cast to satisfy interface
    );
  }

  async createFamily(userId: string, name: string): Promise<Family> {
    this.validateFamilyName(name);
    this.logger.info(`Creating family for user ${userId}`, { name });

    return await this.prisma.$transaction(async (tx: any) => {
      await this.ensureUserHasNoFamily(tx, userId);

      const family = await tx.family.create({
        data: {
          name: name.trim(),
          // Remove inviteCode generation - using unified invitation system only
        },
      });

      await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId,
          role: FamilyRole.ADMIN,
        },
      });

      this.logger.info('Family created successfully', { familyId: family.id, userId });
      const familyWithMembers = await this.getFamilyWithMembers(family.id, tx);
      
      // Emit WebSocket event for family creation
      SocketEmitter.broadcastFamilyUpdate(family.id, 'updated', {
        action: 'created',
        family: familyWithMembers,
      });
      
      return familyWithMembers;
    });
  }

  // Method overload for joining via invitation code
  async joinFamily(inviteCode: string, userId: string): Promise<Family> {
    this.logger.info(`User ${userId} joining family via invitation code ${inviteCode}`);

    // Use unified invitation system for all joins
    const result = await this.unifiedInvitationService.acceptFamilyInvitation(inviteCode, userId);

    // CRITICAL FIX: Return the actual error from UnifiedInvitationService instead of masking it
    if (!result.success) {
      const errorMessage = result.error || 'Failed to join family';
      this.logger.error(`Family join failed: ${errorMessage}`, { userId, inviteCode, result });
      throw new Error(errorMessage);
    }

    // Get the family the user just joined
    const family = await this.getUserFamily(userId);
    if (!family) {
      throw new Error('Failed to retrieve family after joining');
    }

    return family;
  }


  async getUserFamily(userId: string): Promise<Family | null> {
    return await this.prisma.family.findFirst({
      where: {
        members: {
          some: { userId },
        },
      },
      include: FamilyService.FAMILY_INCLUDE,
    });
  }

  async updateMemberRole(adminId: string, memberId: string, newRole: FamilyRole): Promise<void> {
    this.logger.info(`Admin ${adminId} updating member ${memberId} role to ${newRole}`);

    return await this.prisma.$transaction(async (tx: any) => {
      // Verify admin is in a family and has admin role
      const adminMember = await tx.familyMember.findFirst({
        where: { userId: adminId, role: FamilyRole.ADMIN },
      });

      if (!adminMember) {
        throw new FamilyError('UNAUTHORIZED', 'User is not a family admin');
      }

      // Find target member in the same family
      const targetMember = await tx.familyMember.findFirst({
        where: { id: memberId, familyId: adminMember.familyId },
      });

      if (!targetMember) {
        throw new FamilyError('MEMBER_NOT_FOUND', 'Member not found in family');
      }

      // NEW: Prevent admin from demoting themselves
      if (targetMember.userId === adminId && targetMember.role === FamilyRole.ADMIN && newRole !== FamilyRole.ADMIN) {
        throw new FamilyError('CANNOT_DEMOTE_SELF', 'You cannot change your own admin role');
      }

      // Prevent removing the last admin
      if (targetMember.role === FamilyRole.ADMIN && newRole !== FamilyRole.ADMIN) {
        const adminCount = await tx.familyMember.count({
          where: { familyId: adminMember.familyId, role: FamilyRole.ADMIN },
        });

        if (adminCount <= 1) {
          throw new FamilyError('LAST_ADMIN', 'Cannot remove the last admin from family');
        }
      }

      // Update the role
      await tx.familyMember.update({
        where: { id: memberId },
        data: { role: newRole },
      });

      this.logger.info(`Member ${memberId} role updated to ${newRole}`);
      
      // Emit WebSocket event for member role update
      SocketEmitter.broadcastFamilyUpdate(adminMember.familyId, 'updated', {
        action: 'memberRoleUpdated',
        memberId,
        userId: targetMember.userId,
        oldRole: targetMember.role,
        newRole,
        changedBy: adminId,
      });
    });
  }

  async removeMember(adminId: string, memberId: string): Promise<void> {
    this.logger.info(`Admin ${adminId} removing member ${memberId}`);

    return await this.prisma.$transaction(async (tx: any) => {
      // Verify admin permissions
      const adminMember = await tx.familyMember.findFirst({
        where: { userId: adminId, role: FamilyRole.ADMIN },
      });

      if (!adminMember) {
        throw new FamilyError('UNAUTHORIZED', 'User is not a family admin');
      }

      // Find and remove target member
      const targetMember = await tx.familyMember.findFirst({
        where: { id: memberId, familyId: adminMember.familyId },
      });

      if (!targetMember) {
        throw new FamilyError('MEMBER_NOT_FOUND', 'Member not found in family');
      }

      // Prevent admin from removing themselves
      if (targetMember.userId === adminId) {
        throw new FamilyError('CANNOT_REMOVE_SELF', 'Admin cannot remove themselves');
      }

      // Prevent removing the last admin
      if (targetMember.role === FamilyRole.ADMIN) {
        const adminCount = await tx.familyMember.count({
          where: { familyId: adminMember.familyId, role: FamilyRole.ADMIN },
        });

        if (adminCount <= 1) {
          throw new FamilyError('LAST_ADMIN', 'Cannot remove the last admin from family');
        }
      }

      await tx.familyMember.delete({
        where: { id: memberId },
      });

      this.logger.info(`Member ${memberId} removed from family`);
      
      // Emit WebSocket event for member removal
      SocketEmitter.broadcastFamilyUpdate(adminMember.familyId, 'memberLeft', {
        action: 'memberRemoved',
        memberId,
        userId: targetMember.userId,
        removedBy: adminId,
      });
    });
  }


  async leaveFamily(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Find user's family membership
      const memberRecord = await tx.familyMember.findFirst({
        where: { userId },
      });

      if (!memberRecord) {
        throw new FamilyError('NOT_FAMILY_MEMBER', 'User is not a member of any family');
      }

      // If user is an admin, check if they are the last admin
      if (memberRecord.role === FamilyRole.ADMIN) {
        const adminCount = await tx.familyMember.count({
          where: { familyId: memberRecord.familyId, role: FamilyRole.ADMIN },
        });

        if (adminCount <= 1) {
          throw new FamilyError('LAST_ADMIN', 'Cannot leave family as you are the last administrator. Please appoint another admin first.');
        }
      }

      // Remove the user from the family
      await tx.familyMember.delete({
        where: { id: memberRecord.id },
      });

      this.logger.info(`User ${userId} left family ${memberRecord.familyId}`);
      
      // Emit WebSocket event for member leaving family
      SocketEmitter.broadcastFamilyUpdate(memberRecord.familyId, 'memberLeft', {
        action: 'memberLeft',
        userId,
        memberId: memberRecord.id,
      });
    });
  }

  async inviteMember(familyId: string, inviteData: {
    email: string;
    role: FamilyRole;
    personalMessage?: string;
  }, invitedBy: string, platform: 'web' | 'native' = 'web'): Promise<any> {
    this.logger.info(`Inviting member to family ${familyId}`, { email: inviteData.email });

    try {
      // Delegate to UnifiedInvitationService
      const invitation = await this.unifiedInvitationService.createFamilyInvitation(
        familyId,
        inviteData,
        invitedBy,
        platform,
      );

      // Get complete invitation with relations from database
      const completeInvitation = await this.prisma.familyInvitation.findUnique({
        where: { id: invitation.id },
        include: {
          invitedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!completeInvitation) {
        throw new Error('Failed to retrieve complete invitation after creation');
      }

      // Return complete invitation
      return {
        id: completeInvitation.id,
        familyId: completeInvitation.familyId,
        email: completeInvitation.email,
        role: completeInvitation.role,
        personalMessage: completeInvitation.personalMessage,
        invitedBy: completeInvitation.invitedBy,
        createdBy: completeInvitation.createdBy,
        acceptedBy: completeInvitation.acceptedBy,
        status: completeInvitation.status,
        inviteCode: completeInvitation.inviteCode,
        expiresAt: completeInvitation.expiresAt,
        acceptedAt: completeInvitation.acceptedAt,
        createdAt: completeInvitation.createdAt,
        updatedAt: completeInvitation.updatedAt,
        invitedByUser: completeInvitation.invitedByUser,
      };
    } catch (error: any) {
      // Convert UnifiedInvitationService errors to FamilyError format for backward compatibility
      if (error.message?.includes('Only family administrators')) {
        throw new FamilyError('UNAUTHORIZED', error.message);
      }
      if (error.message?.includes('already a member')) {
        throw new FamilyError('USER_ALREADY_MEMBER', error.message);
      }
      if (error.message?.includes('maximum capacity')) {
        throw new FamilyError('FAMILY_FULL', error.message);
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  async getPendingInvitations(familyId: string): Promise<any[]> {
    this.logger.info(`Getting pending invitations for family ${familyId}`);

    // Clean up expired invitations first using UnifiedInvitationService
    await this.unifiedInvitationService.cleanupExpiredInvitations();

    const invitations = await this.prisma.familyInvitation.findMany({
      where: {
        familyId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(), // Only non-expired invitations
        },
      },
      include: {
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invitations;
  }

  /**
   * Global cleanup method to remove old invitations across all families
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupAllInvitations(): Promise<void> {
    await this.unifiedInvitationService.cleanupExpiredInvitations();
  }

  async cancelInvitation(familyId: string, invitationId: string, adminId: string): Promise<void> {
    this.logger.info(`Cancelling invitation ${invitationId} for family ${familyId}`);

    try {
      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.cancelFamilyInvitation(invitationId, adminId);
    } catch (error: any) {
      // Convert UnifiedInvitationService errors to FamilyError format for backward compatibility
      if (error.message?.includes('Only family administrators')) {
        throw new FamilyError('UNAUTHORIZED', error.message);
      }
      if (error.message?.includes('not found')) {
        throw new FamilyError('INVITATION_NOT_FOUND', error.message);
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  async updateFamilyName(adminId: string, newName: string): Promise<Family> {
    this.logger.info(`Admin ${adminId} updating family name to: ${newName}`);

    try {
      // Validate the new name
      this.logger.info(`Validating family name: "${newName}" (length: ${newName.length})`);
      this.validateFamilyName(newName);
      this.logger.info('Family name validation passed');

      return await this.prisma.$transaction(async (tx: any) => {
        this.logger.info('Starting database transaction');
        
        // Verify admin permissions
        this.logger.info(`Looking for admin member with userId: ${adminId}`);
        const adminMember = await tx.familyMember.findFirst({
          where: { userId: adminId, role: FamilyRole.ADMIN },
          include: { family: true, user: true },
        });

        if (!adminMember) {
          this.logger.error(`Admin member not found for userId: ${adminId}`);
          throw new FamilyError('UNAUTHORIZED', 'User is not a family admin');
        }

        this.logger.info(`Admin member found for family: ${adminMember.familyId}`);

        // Verify that user data is properly loaded
        if (!adminMember.user || !adminMember.user.name) {
          throw new FamilyError('DATA_INTEGRITY_ERROR', 'Admin user data not properly loaded from database');
        }

        const adminUserName = adminMember.user.name;
        const oldName = adminMember.family.name;

      // Update family name
      const updatedFamily = await tx.family.update({
        where: { id: adminMember.familyId },
        data: { 
          name: newName,
          updatedAt: new Date(),
        },
        include: FamilyService.FAMILY_INCLUDE,
      });

      // Log the activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          actionType: 'FAMILY_NAME_CHANGED',
          actionDescription: `Family name changed from "${oldName}" to "${newName}"`,
          entityType: 'family',
          entityId: adminMember.familyId,
          entityName: newName,
          metadata: {
            oldName,
            newName,
            changedBy: adminUserName,
            familyId: adminMember.familyId,
          },
        },
      });

      // Send notifications to all family members
      if (this.notificationService) {
        try {
          await this.notificationService.notifyFamilyNameChange(
            adminMember.familyId,
            oldName,
            newName,
            adminUserName,
          );
        } catch (notificationError) {
          // Log but don't fail the entire operation if notifications fail
          this.logger.error(
            `Failed to send family name change notifications: ${(notificationError as Error).message}`,
            { familyId: adminMember.familyId, oldName, newName },
          );
        }
      }

        this.logger.info(`Family name updated from "${oldName}" to "${newName}" for family ${adminMember.familyId}`);
        
        // Emit WebSocket event for family name update
        SocketEmitter.broadcastFamilyUpdate(adminMember.familyId, 'updated', {
          action: 'nameUpdated',
          oldName,
          newName,
          changedBy: adminId,
          family: updatedFamily,
        });
        
        return updatedFamily;
      });
    } catch (error) {
      this.logger.error(`Error updating family name: ${(error as Error).message}`, { adminId, newName, error });
      throw error;
    }
  }

  private async getFamilyWithMembers(familyId: string, tx?: unknown): Promise<Family> {
    const client = tx || this.prisma;
    return await client.family.findUniqueOrThrow({
      where: { id: familyId },
      include: FamilyService.FAMILY_INCLUDE,
    });
  }

  // Validation helpers
  private validateFamilyName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new FamilyError('INVALID_FAMILY_NAME', 'Family name is required');
    }
    if (name.trim().length > 100) {
      throw new FamilyError('INVALID_FAMILY_NAME', 'Family name too long (max 100 characters)');
    }
  }


  // Transaction helpers
  private async ensureUserHasNoFamily(tx: any, userId: string): Promise<void> {
    const existingMembership = await tx.familyMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new FamilyError('USER_ALREADY_IN_FAMILY', 'You are already a member of a family');
    }
  }



  async validateInviteCode(inviteCode: string): Promise<{ id: string; name: string } | null> {
    try {
      // Delegate to UnifiedInvitationService for validation
      const validation = await this.unifiedInvitationService.validateFamilyInvitation(inviteCode);
      
      if (!validation.valid) {
        return null;
      }

      // Return family info from the validation result
      return {
        id: validation.familyId || '',
        name: validation.familyName || '',
      };
    } catch (error) {
      this.logger.error('Error validating invite code:', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

}