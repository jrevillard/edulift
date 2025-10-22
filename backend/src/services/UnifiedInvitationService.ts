import { PrismaClient, FamilyRole, GroupRole, FamilyInvitationStatus, GroupInvitationStatus } from '@prisma/client';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { randomBytes } from 'crypto';
import { SocketEmitter } from '../utils/socketEmitter';


export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Family Invitation Interfaces
export interface CreateFamilyInvitationData {
  email?: string;
  role: FamilyRole;
  personalMessage?: string;
}

export interface FamilyInvitationValidation {
  valid: boolean;
  familyId?: string;
  familyName?: string;
  inviterName?: string | null;
  role?: FamilyRole;
  personalMessage?: string;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
  userCurrentFamily?: {
    id: string;
    name: string;
  };
  canLeaveCurrentFamily?: boolean;
  cannotLeaveReason?: string;
}

export interface AcceptFamilyInvitationResult {
  success: boolean;
  error?: string;
  // Note: Frontends only use success flag, no need for detailed data
}

export interface AcceptFamilyInvitationOptions {
  leaveCurrentFamily?: boolean;
}

// Group Invitation Interfaces
export interface CreateGroupInvitationData {
  targetFamilyId?: string;
  email?: string;
  role: GroupRole;
  personalMessage?: string;
}

export interface GroupInvitationValidation {
  valid: boolean;
  groupId?: string;
  groupName?: string;
  requiresAuth?: boolean;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
}

export interface AcceptGroupInvitationResult {
  success: boolean;
  error?: string;
  // Special cases that frontends check
  requiresFamilyOnboarding?: boolean;
  requiresAdminAction?: boolean;
  alreadyMember?: boolean;
  adminContact?: string;
  message?: string;
  redirectUrl?: string;
  // Note: Frontends only use success flag for happy path
}


// Management Interfaces
export interface UserInvitationsResult {
  familyInvitations: Array<{
    id: string;
    inviteCode: string;
    role: FamilyRole;
    familyName: string;
    expiresAt: Date;
  }>;
  groupInvitations: Array<{
    id: string;
    inviteCode: string;
    role: GroupRole;
    groupName: string;
    expiresAt: Date;
  }>;
}

export interface CleanupResult {
  familyInvitationsExpired: number;
  groupInvitationsExpired: number;
}

export class UnifiedInvitationService {
  private static readonly INVITATION_EXPIRY_DAYS = 7;
  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
    private emailService: EmailServiceInterface
  ) {}

  // Static method for generating invite codes (moved from InviteCodeGenerator)
  static generateInviteCode(length?: number): string {
    // Default to 8 bytes (16 hex chars) for family/group codes, 
    // or 4 bytes (7 chars after substring) for invitation codes
    const bytes = length === 7 ? 4 : 8;
    const code = randomBytes(bytes).toString('hex').toUpperCase();
    return length === 7 ? code.substring(0, 7) : code;
  }

  // Family Invitation Methods
  async createFamilyInvitation(
    familyId: string,
    inviteData: CreateFamilyInvitationData,
    adminId: string,
    platform: 'web' | 'native' = 'web'
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Verify admin permissions
      const adminMember = await tx.familyMember.findFirst({
        where: { userId: adminId, familyId },
        include: { family: true, user: true }
      });

      if (!adminMember || adminMember.role !== FamilyRole.ADMIN) {
        throw new Error('Only family administrators can send invitations');
      }

      // Check for existing user if email provided
      if (inviteData.email) {
        const existingUser = await tx.user.findUnique({
          where: { email: inviteData.email }
        });

        if (existingUser) {
          // Check if user already in family
          const existingMember = await tx.familyMember.findFirst({
            where: { userId: existingUser.id }
          });

          if (existingMember?.familyId === familyId) {
            throw new Error('User is already a member of this family');
          }
        }

        // Check for existing active invitation
        const existingInvitation = await tx.familyInvitation.findFirst({
          where: {
            familyId,
            email: inviteData.email,
            status: FamilyInvitationStatus.PENDING,
            expiresAt: { gt: new Date() }
          }
        });

        if (existingInvitation) {
          throw new Error('An active invitation already exists for this email');
        }
      }

      // Check family capacity
      const memberCount = await tx.familyMember.count({
        where: { familyId }
      });

      if (memberCount >= 6) {
        throw new Error('Family has reached maximum capacity (6 members)');
      }

      // Create invitation
      const inviteCode = UnifiedInvitationService.generateInviteCode(7);
      const expiresAt = new Date(Date.now() + UnifiedInvitationService.INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invitation = await tx.familyInvitation.create({
        data: {
          familyId,
          email: inviteData.email || null,
          role: inviteData.role,
          inviteCode,
          personalMessage: inviteData.personalMessage || null,
          status: FamilyInvitationStatus.PENDING,
          expiresAt,
          createdBy: adminId,
          invitedBy: adminId
        }
      });

      // Send email if email provided
      if (inviteData.email) {
        const emailData: any = {
          familyName: adminMember.family.name,
          inviterName: adminMember.user.name,
          inviteCode,
          role: inviteData.role,
          platform
        };
        if (inviteData.personalMessage) {
          emailData.personalMessage = inviteData.personalMessage;
        }
        await this.emailService.sendFamilyInvitation(inviteData.email, emailData);
      }

      this.logger.info('Family invitation created', {
        invitationId: invitation.id,
        familyId,
        email: inviteData.email,
        hasEmail: !!inviteData.email,
        hasPersonalMessage: !!inviteData.personalMessage,
        personalMessageLength: inviteData.personalMessage?.length || 0
      });

      return invitation;
    });
  }

  async validateFamilyInvitation(inviteCode: string, currentUserId?: string): Promise<FamilyInvitationValidation> {
    try {
      this.logger.debug('Validating family invitation', { inviteCode });
      
      
      // Find pending invitation with this code
      const invitation = await this.prisma.familyInvitation.findFirst({
        where: {
          inviteCode,
          status: FamilyInvitationStatus.PENDING
        },
        include: {
          family: true,
          createdByUser: true
        }
      });

      if (!invitation) {
        return { valid: false, error: 'Invalid invitation code', errorCode: 'INVALID_CODE' };
      }

      if (invitation.expiresAt < new Date()) {
        return { valid: false, error: 'Invitation has expired' };
      }

      const result: any = {
        valid: true,
        familyId: invitation.familyId,
        familyName: invitation.family.name,
        role: invitation.role,
        inviterName: invitation.createdByUser?.name || null
      };

      if (invitation.personalMessage) {
        result.personalMessage = invitation.personalMessage;
      }

      // SECURITY CHECK: If there's a current authenticated user and the invitation has an email
      if (currentUserId && invitation.email) {
        const currentUser = await this.prisma.user.findUnique({
          where: { id: currentUserId },
          include: {
            familyMemberships: {
              include: {
                family: true
              }
            }
          }
        });
        
        if (currentUser && currentUser.email !== invitation.email) {
          return { 
            valid: false, 
            error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
            errorCode: 'EMAIL_MISMATCH'
          };
        }
      }

      // Check if invitation has email and if user exists
      if (invitation.email) {
        result.email = invitation.email;
        const existingUser = await this.prisma.user.findUnique({
          where: { email: invitation.email },
          include: {
            familyMemberships: {
              include: {
                family: true
              }
            }
          }
        });
        result.existingUser = !!existingUser;
        
        // If user exists, check if they already belong to a family
        if (existingUser && existingUser.familyMemberships && existingUser.familyMemberships.length > 0) {
          const currentFamilyMembership = existingUser.familyMemberships[0];
          const currentFamily = currentFamilyMembership.family;
          result.userCurrentFamily = {
            id: currentFamily.id,
            name: currentFamily.name
          };

          // Check if user can leave current family (not last admin)
          if (currentFamilyMembership.role === 'ADMIN') {
            const adminCount = await this.prisma.familyMember.count({
              where: {
                familyId: currentFamily.id,
                role: 'ADMIN'
              }
            });
            
            result.canLeaveCurrentFamily = adminCount > 1;
            if (adminCount === 1) {
              result.cannotLeaveReason = 'You are the last administrator of your current family';
            }
          } else {
            result.canLeaveCurrentFamily = true;
          }
        }
      }

      // If there's a current authenticated user, check their family status
      if (currentUserId) {
        const currentUser = await this.prisma.user.findUnique({
          where: { id: currentUserId },
          include: {
            familyMemberships: {
              include: {
                family: true
              }
            }
          }
        });

        if (currentUser && currentUser.familyMemberships && currentUser.familyMemberships.length > 0) {
          const currentUserFamily = currentUser.familyMemberships[0];
          
          // If the current user has a family and it's different from the invitation's family
          if (currentUserFamily.familyId !== invitation.familyId) {
            result.userCurrentFamily = {
              id: currentUserFamily.family.id,
              name: currentUserFamily.family.name
            };

            // Check if user can leave current family (not last admin)
            if (currentUserFamily.role === 'ADMIN') {
              const adminCount = await this.prisma.familyMember.count({
                where: {
                  familyId: currentUserFamily.familyId,
                  role: 'ADMIN'
                }
              });
              
              result.canLeaveCurrentFamily = adminCount > 1;
              if (adminCount === 1) {
                result.cannotLeaveReason = 'You are the last administrator of your current family';
              }
            } else {
              result.canLeaveCurrentFamily = true;
            }
          }
        }
      }

      this.logger.debug('Family invitation validation successful', { inviteCode, valid: true });
      return result;
    
    } catch (error: any) {
      this.logger.error('Family invitation validation failed', { 
        inviteCode, 
        error: error?.message || 'Unknown error', 
        stack: error?.stack 
      });
      
      // Return graceful failure instead of throwing
      return {
        valid: false,
        error: 'Temporary validation error. Please try again.'
      };
    }
  }

  async acceptFamilyInvitation(
    inviteCode: string,
    userId: string,
    options: AcceptFamilyInvitationOptions = {}
  ): Promise<AcceptFamilyInvitationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Find and validate invitation
        const invitation = await tx.familyInvitation.findFirst({
          where: {
            inviteCode,
            status: FamilyInvitationStatus.PENDING
          },
          include: { family: true }
        });

        if (!invitation) {
          return {
            success: false,
            error: 'Invalid invitation code'
          };
        }

        // Check if invitation is expired
        if (invitation.expiresAt < new Date()) {
          return {
            success: false,
            error: 'Invitation has expired'
          };
        }

        // Get user
        const user = await tx.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          return {
            success: false,
            error: 'User not found'
          };
        }

        // SECURITY CHECK: If the invitation has an email, verify it matches the current user
        if (invitation.email && user.email !== invitation.email) {
          return {
            success: false,
            error: 'This invitation was sent to a different email address'
          };
        }

        // Check if user already in a family
        const existingMembership = await tx.familyMember.findFirst({
          where: { userId },
          include: { family: true }
        });

        if (existingMembership) {
          if (existingMembership.familyId === invitation.familyId) {
            return {
              success: false,
              error: 'You are already a member of this family'
            };
          }

          if (!options.leaveCurrentFamily) {
            return {
              success: false,
              error: `You already belong to a family: ${existingMembership.family.name}`
            };
          }

          // Check if user is last admin of current family
          if (existingMembership.role === FamilyRole.ADMIN) {
            const adminCount = await tx.familyMember.count({
              where: {
                familyId: existingMembership.familyId,
                role: FamilyRole.ADMIN
              }
            });

            if (adminCount === 1) {
              return {
                success: false,
                error: 'Cannot leave family as you are the last administrator'
              };
            }
          }

          // Emit left family event BEFORE removing membership
          SocketEmitter.broadcastFamilyUpdate(existingMembership.familyId, 'memberLeft', {
            userId,
            action: 'leftForNewFamily',
            leftTo: invitation.familyId
          });

          // Remove from current family
          await tx.familyMember.delete({
            where: {
              familyId_userId: {
                familyId: existingMembership.familyId,
                userId
              }
            }
          });
        }

        // Accept invitation and add to family
        await tx.familyInvitation.update({
          where: { id: invitation.id },
          data: {
            status: FamilyInvitationStatus.ACCEPTED,
            acceptedBy: userId,
            acceptedAt: new Date()
          }
        });

        await tx.familyMember.create({
          data: {
            userId,
            familyId: invitation.familyId,
            role: invitation.role
          }
        });

        this.logger.info('Family invitation accepted', {
          invitationId: invitation.id,
          userId,
          familyId: invitation.familyId,
          leftPreviousFamily: !!existingMembership
        });

        // Emit WebSocket event for family invitation acceptance
        SocketEmitter.broadcastFamilyUpdate(invitation.familyId, 'memberJoined', {
          userId,
          action: 'invitationAccepted',
          invitationId: invitation.id,
          role: invitation.role
        });

        return {
          success: true
        };
      });
    } catch (error: any) {
      this.logger.error('Family invitation acceptance failed', {
        inviteCode,
        userId,
        error: error?.message || 'Unknown error'
      });

      return {
        success: false,
        error: error?.message || 'Failed to accept invitation'
      };
    }
  }

  // Group Invitation Methods
  async createGroupInvitation(
    groupId: string,
    inviteData: CreateGroupInvitationData,
    adminId: string,
    platform: 'web' | 'native' = 'web'
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Verify group exists and admin permissions
      const group = await tx.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        throw new Error('Group not found');
      }

      // Check if user is group admin
      const adminMember = await tx.familyMember.findFirst({
        where: { userId: adminId },
        include: { family: true, user: true }
      });

      if (!adminMember || adminMember.role !== FamilyRole.ADMIN) {
        throw new Error('Only family administrators can send group invitations');
      }

      // Check if admin's family owns the group or is group admin
      const groupMembership = await tx.groupFamilyMember.findFirst({
        where: {
          groupId,
          familyId: adminMember.familyId
        }
      });

      if (group.familyId !== adminMember.familyId && (!groupMembership || groupMembership.role !== 'ADMIN')) {
        throw new Error('Only group administrators can perform this action');
      }

      let targetFamily = null;
      if (inviteData.targetFamilyId) {
        // Check if target family exists
        targetFamily = await tx.family.findUnique({
          where: { id: inviteData.targetFamilyId },
          include: {
            members: {
              where: { role: FamilyRole.ADMIN },
              include: { user: true }
            }
          }
        });

        if (!targetFamily) {
          throw new Error('Target family not found');
        }

        // Check if family already member
        const existingMembership = await tx.groupFamilyMember.findFirst({
          where: {
            groupId,
            familyId: inviteData.targetFamilyId
          }
        });

        if (existingMembership) {
          throw new Error('Family is already a member of this group');
        }

        // Check for existing invitation
        const existingInvitation = await tx.groupInvitation.findFirst({
          where: {
            groupId,
            targetFamilyId: inviteData.targetFamilyId,
            status: GroupInvitationStatus.PENDING,
            expiresAt: { gt: new Date() }
          }
        });

        if (existingInvitation) {
          throw new Error('This family already has a pending invitation to this group');
        }
      }

      // Create invitation
      const inviteCode = UnifiedInvitationService.generateInviteCode(7);
      const expiresAt = new Date(Date.now() + UnifiedInvitationService.INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invitation = await tx.groupInvitation.create({
        data: {
          groupId,
          targetFamilyId: inviteData.targetFamilyId || null,
          email: inviteData.email || null,
          role: inviteData.role,
          inviteCode,
          personalMessage: inviteData.personalMessage || null,
          status: GroupInvitationStatus.PENDING,
          expiresAt,
          createdBy: adminId,
          invitedBy: adminId
        }
      });

      // Send emails to family admins if target family specified
      if (targetFamily) {
        const admins = targetFamily.members.filter(member => member.role === FamilyRole.ADMIN);
        for (const admin of admins) {
          const emailData: any = {
            to: admin.user.email,
            groupName: group.name,
            inviteCode,
            role: inviteData.role,
            platform
          };
          if (inviteData.personalMessage) {
            emailData.personalMessage = inviteData.personalMessage;
          }
          await this.emailService.sendGroupInvitation(emailData);
        }
        this.logger.info('Group invitation created (family admins)', {
          invitationId: invitation.id,
          groupId,
          targetFamilyId: inviteData.targetFamilyId,
          hasTargetFamily: !!inviteData.targetFamilyId,
          hasPersonalMessage: !!inviteData.personalMessage,
          personalMessageLength: inviteData.personalMessage?.length || 0
        });
      } else if (inviteData.email) {
        // Send email to invited user if email provided
        const emailData: any = {
            to: inviteData.email,
            groupName: group.name,
            inviteCode,
            role: inviteData.role,
            platform
          };
          if (inviteData.personalMessage) {
            emailData.personalMessage = inviteData.personalMessage;
          }
          await this.emailService.sendGroupInvitation(emailData);
            this.logger.info('Group invitation created (email)', {
            invitationId: invitation.id,
            groupId,
            email: inviteData.email,
            hasTargetFamily: !!inviteData.targetFamilyId,
            hasPersonalMessage: !!inviteData.personalMessage,
            personalMessageLength: inviteData.personalMessage?.length || 0
          });
      } else{
        //error if no target family or email provided
        throw new Error('Either targetFamilyId or email must be provided for group invitations');
      } 
      return invitation;
    });
  }

  async validateGroupInvitation(inviteCode: string, currentUserId?: string): Promise<GroupInvitationValidation> {
    
    const invitation = await this.prisma.groupInvitation.findFirst({
      where: {
        inviteCode,
        status: GroupInvitationStatus.PENDING
      },
      include: {
        group: true,
        invitedByUser: true  // Include inviter information
      }
    });

    if (!invitation) {
      return { valid: false, error: 'Invalid invitation code', errorCode: 'INVALID_CODE' };
    }

    if (invitation.expiresAt < new Date()) {
      return { valid: false, error: 'Invitation has expired' };
    }

    const result: any = {
      valid: true,
      groupId: invitation.group.id,
      groupName: invitation.group.name,
      inviterName: invitation.invitedByUser?.name || null
    };

    // SECURITY CHECK: If there's a current authenticated user and the invitation has an email
    if (currentUserId && invitation.email) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: currentUserId }
      });

      if (currentUser && currentUser.email !== invitation.email) {
        return {
          valid: false,
          error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
          errorCode: 'EMAIL_MISMATCH'
        };
      }
    }

    // Check if invitation has email and if user exists
    if (invitation.email) {
      result.email = invitation.email;
      const existingUser = await this.prisma.user.findUnique({
        where: { email: invitation.email }
      });
      result.existingUser = !!existingUser;
    }

    return result;
  }

  async acceptGroupInvitation(
    inviteCode: string,
    userId: string
  ): Promise<AcceptGroupInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      // Find and validate invitation
      const invitation = await tx.groupInvitation.findFirst({
        where: {
          inviteCode,
          status: GroupInvitationStatus.PENDING,
          expiresAt: { gt: new Date() }
        },
        include: { group: true }
      });

      if (!invitation) {
        return { success: false, error: 'Invalid or expired invitation' };
      }

      // Get user and family membership
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const familyMember = await tx.familyMember.findFirst({
        where: { userId },
        include: {
          family: {
            include: {
              members: {
                where: { role: FamilyRole.ADMIN },
                include: { user: true }
              }
            }
          }
        }
      });

      if (!familyMember) {
        return {
          success: false,
          error: 'Family onboarding required'
        };
      }

      // Check if family already member
      const existingMembership = await tx.groupFamilyMember.findFirst({
        where: {
          groupId: invitation.groupId,
          familyId: familyMember.familyId
        }
      });

      if (existingMembership) {
        return {
          success: false,
          error: `Your family is already a member of ${invitation.group.name}`
        };
      }

      // Check if user is family admin
      if (familyMember.role !== FamilyRole.ADMIN) {
        const adminContact = familyMember.family.members[0]?.user.name || 'your family admin';
        return {
          success: false,
          error: `Only your family admin can accept this invitation. Please contact ${adminContact}.`
        };
      }

      // Accept invitation for entire family
      await tx.groupInvitation.update({
        where: { id: invitation.id },
        data: {
          status: GroupInvitationStatus.ACCEPTED,
          acceptedBy: userId,
          acceptedAt: new Date()
        }
      });

      // Add family to group
      await tx.groupFamilyMember.create({
        data: {
          familyId: familyMember.familyId,
          groupId: invitation.groupId,
          role: invitation.role as GroupRole,
          addedBy: userId
        }
      });

      // Get family members count
      const familyMembers = await tx.familyMember.findMany({
        where: { familyId: familyMember.familyId }
      });

      // Add family children to group (if any)
      const familyChildren = await tx.child.findMany({
        where: { familyId: familyMember.familyId }
      });

      if (familyChildren.length > 0) {
        await tx.groupChildMember.createMany({
          data: familyChildren.map(child => ({
            childId: child.id,
            groupId: invitation.groupId,
            addedBy: userId
          }))
        });
      }

      this.logger.info('Group invitation accepted', {
        invitationId: invitation.id,
        userId,
        familyId: familyMember.familyId,
        groupId: invitation.groupId,
        membersAdded: familyMembers.length
      });

      // Emit WebSocket event for group invitation acceptance
      SocketEmitter.broadcastGroupUpdate(invitation.groupId, {
        action: 'invitationAccepted',
        userId,
        familyId: familyMember.familyId,
        groupId: invitation.groupId,
        membersAdded: familyMembers.length,
        invitationId: invitation.id
      });

      return {
        success: true
      };
    });
  }


  // Management Methods
  async listUserInvitations(userId: string): Promise<UserInvitationsResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.email) {
      return { familyInvitations: [], groupInvitations: [] };
    }

    const [familyInvitations, groupInvitations] = await Promise.all([
      this.prisma.familyInvitation.findMany({
        where: {
          email: user.email,
          status: FamilyInvitationStatus.PENDING,
          expiresAt: { gt: new Date() }
        },
        include: { family: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.groupInvitation.findMany({
        where: {
          email: user.email,
          status: GroupInvitationStatus.PENDING,
          expiresAt: { gt: new Date() }
        },
        include: { group: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      familyInvitations: familyInvitations.map(inv => ({
        id: inv.id,
        inviteCode: inv.inviteCode,
        role: inv.role,
        familyName: inv.family.name,
        expiresAt: inv.expiresAt
      })),
      groupInvitations: groupInvitations.map(inv => ({
        id: inv.id,
        inviteCode: inv.inviteCode,
        role: inv.role as GroupRole,
        groupName: inv.group.name,
        expiresAt: inv.expiresAt
      }))
    };
  }

  async cancelFamilyInvitation(invitationId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.familyInvitation.findUnique({
        where: { id: invitationId }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Verify admin permissions
      const adminMember = await tx.familyMember.findFirst({
        where: {
          userId: adminId,
          familyId: invitation.familyId,
          role: FamilyRole.ADMIN
        }
      });

      if (!adminMember) {
        throw new Error('Only family administrators can cancel invitations');
      }

      await tx.familyInvitation.update({
        where: { id: invitationId },
        data: { status: FamilyInvitationStatus.CANCELLED }
      });
    });
  }

  async cancelGroupInvitation(invitationId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.groupInvitation.findUnique({
        where: { id: invitationId },
        include: { group: true }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Verify admin permissions
      const adminMember = await tx.familyMember.findFirst({
        where: { userId: adminId },
        include: { family: true }
      });

      if (!adminMember || adminMember.role !== FamilyRole.ADMIN) {
        throw new Error('Only family administrators can cancel invitations');
      }

      // Check if admin's family owns the group or is group admin
      if (invitation.group.familyId !== adminMember.familyId) {
        const groupMembership = await tx.groupFamilyMember.findFirst({
          where: {
            groupId: invitation.groupId,
            familyId: adminMember.familyId,
            role: 'ADMIN'
          }
        });

        if (!groupMembership) {
          throw new Error('Only group administrators can cancel invitations');
        }
      }

      await tx.groupInvitation.update({
        where: { id: invitationId },
        data: { status: GroupInvitationStatus.CANCELLED }
      });
    });
  }

  async getGroupInvitations(groupId: string) {
    return await this.prisma.groupInvitation.findMany({
      where: {
        groupId,
        status: GroupInvitationStatus.PENDING,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  // Cleanup Methods
  async cleanupExpiredInvitations(): Promise<CleanupResult> {
    const now = new Date();

    const [familyResult, groupResult] = await Promise.all([
      this.prisma.familyInvitation.updateMany({
        where: {
          status: FamilyInvitationStatus.PENDING,
          expiresAt: { lt: now }
        },
        data: { status: FamilyInvitationStatus.EXPIRED }
      }),
      this.prisma.groupInvitation.updateMany({
        where: {
          status: GroupInvitationStatus.PENDING,
          expiresAt: { lt: now }
        },
        data: { status: GroupInvitationStatus.EXPIRED }
      })
    ]);

    this.logger.info('Cleaned up expired invitations', {
      familyInvitations: familyResult.count,
      groupInvitations: groupResult.count
    });

    return {
      familyInvitationsExpired: familyResult.count,
      groupInvitationsExpired: groupResult.count
    };
  }
}