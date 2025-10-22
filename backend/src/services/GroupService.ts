import { PrismaClient, GroupRole } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { EmailService } from './EmailService';
import { MockEmailService } from './MockEmailService';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { UnifiedInvitationService } from './UnifiedInvitationService';
import { 
  CreateGroupData, 
  // InviteFamilyToGroupData, // Currently unused
  FamilySearchResult
} from '../types/GroupTypes';

interface GroupInviteValidationResponse {
  valid: boolean;
  error?: string;
  group?: {
    id: string;
    name: string;
  };
  invitation?: {
    id: string;
    expiresAt: Date;
    role: GroupRole;
  };
}

interface AuthenticatedInviteValidationResponse extends GroupInviteValidationResponse {
  userStatus?: 'NO_FAMILY' | 'FAMILY_MEMBER' | 'FAMILY_ADMIN' | 'ALREADY_MEMBER';
  familyInfo?: {
    id: string;
    name: string;
    role: string;
    adminName?: string;
  };
  canAccept?: boolean;
  message?: string;
  actionRequired?: 'CREATE_FAMILY' | 'CONTACT_ADMIN' | 'ALREADY_ACCEPTED' | 'READY_TO_JOIN';
}

export class GroupService {
  private activityLogRepo: ActivityLogRepository;
  private emailService: EmailServiceInterface;
  private unifiedInvitationService: UnifiedInvitationService;
  
  // Constants

  constructor(private prisma: PrismaClient, emailService?: EmailServiceInterface) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
    
    // Use provided email service or create appropriate one based on environment
    if (emailService) {
      this.emailService = emailService;
    } else {
      const hasEmailCredentials = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
      
      if (process.env.NODE_ENV === 'production' && hasEmailCredentials) {
        this.emailService = new EmailService({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.EMAIL_USER!,
            pass: process.env.EMAIL_PASSWORD!
          }
        });
      } else {
        this.emailService = new MockEmailService();
      }
    }

    // Initialize UnifiedInvitationService
    this.unifiedInvitationService = new UnifiedInvitationService(
      prisma,
      {
        info: (message: string, meta?: any) => console.log(message, meta),
        error: (message: string, meta?: any) => console.error(message, meta),
        warn: (message: string, meta?: any) => console.warn(message, meta),
        debug: (message: string, meta?: any) => console.debug(message, meta)
      },
      this.emailService
    );
  }

  // Get user's family
  async getUserFamily(userId: string) {
    const familyMember = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { family: true }
    });
    return familyMember;
  }

  // Check if user is a family admin
  private async isFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
    const member = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId
        }
      }
    });
    return member?.role === 'ADMIN';
  }

  // Centralized permission checking with proper error handling
  private async validateGroupAdminPermissions(userId: string, groupId: string): Promise<void> {
    const hasPermissions = await this.hasGroupAdminPermissions(userId, groupId);
    if (!hasPermissions) {
      throw new AppError('Only group administrators can perform this action', 403);
    }
  }

  // Validate that a group exists and return it
  /* // Currently unused\n  private async getGroupOrThrow(groupId: string): Promise<any> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId }
    });
    
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    
    return group;
  }

  // Calculate expiration date for invitations
  /* // Currently unused\n  private getInvitationExpiryDate(): Date {
    return new Date(Date.now() + UnifiedInvitationService.INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  */
  // Check if user has group admin permissions based on family role inheritance
  async hasGroupAdminPermissions(userId: string, groupId: string): Promise<boolean> {
    // Get user's family first
    const userFamily = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: { familyId: true, role: true }
    });

    if (!userFamily) return false;

    // Only family ADMINs can have group admin permissions
    if (userFamily.role !== 'ADMIN') return false;

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

    if (!group) return false;

    // Rule: Family ADMIN = Group ADMIN (only if family has ADMIN GroupRole)
    // Owner family admins always have permissions
    if (group.familyId === userFamily.familyId) {
      return true;
    }

    // For member families, check if they have ADMIN GroupRole
    const familyMembership = group.familyMembers.find(fm => fm.familyId === userFamily.familyId);
    return familyMembership?.role === 'ADMIN';
  }

  /**
   * Calculate user's role in a specific group
   * @param group - Group with ownerFamily and familyMembers
   * @param userId - User ID to check role for
   * @returns User's role: 'OWNER', 'ADMIN', or 'MEMBER'
   */
  private async calculateUserRoleInGroup(
    group: any, // Prisma group with familyMembers included
    userId: string
  ): Promise<'OWNER' | 'ADMIN' | 'MEMBER'> {
    // Get user's family to determine role
    const userFamily = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: { familyId: true, role: true }
    });

    if (!userFamily) {
      throw new AppError('User has no family', 400);
    }

    // Calculate userRole using same logic as getUserGroups()
    let userRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';

    if (group.familyId === userFamily.familyId) {
      // Owner family: family ADMIN → group ADMIN/OWNER
      userRole = userFamily.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    } else {
      // Member family: use GroupRole from GroupFamilyMember
      const familyMembership = group.familyMembers?.find(
        (fm: any) => fm.familyId === userFamily.familyId
      );
      if (familyMembership) {
        userRole = familyMembership.role;
      }
    }

    return userRole;
  }

  /**
   * Enrich a raw Prisma group with user-specific context (userRole, counts, etc.)
   * This ensures consistent response format across all endpoints (REST principle).
   *
   * @param group - Raw Prisma group with includes
   * @param userId - User ID for calculating userRole
   * @returns Enriched group object matching getUserGroups() format
   */
  private async enrichGroupWithUserContext(
    group: any, // Prisma group with ownerFamily and familyMembers includes
    userId: string
  ) {
    // Calculate userRole using shared logic
    const userRole = await this.calculateUserRoleInGroup(group, userId);

    // Return enriched format matching getUserGroups() response
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      familyId: group.familyId,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      userRole,
      ownerFamily: group.ownerFamily ? {
        id: group.ownerFamily.id,
        name: group.ownerFamily.name
      } : undefined,
      familyCount: group._count?.familyMembers ?? 0,
      scheduleCount: group._count?.scheduleSlots ?? 0
    };
  }

  async createGroup(data: CreateGroupData) {
    try {
      // Verify that the user is an ADMIN of the family
      const isAdmin = await this.isFamilyAdmin(data.createdBy, data.familyId);
      if (!isAdmin) {
        throw new AppError('Only family administrators can create groups', 403);
      }

      // Generate unique invite code for the group
      const inviteCode = UnifiedInvitationService.generateInviteCode();

      // Create group owned by the family
      const group = await this.prisma.group.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          familyId: data.familyId,
          inviteCode: inviteCode
        },
        include: {
          ownerFamily: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          familyMembers: true, // Include for enrichment
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true
            }
          }
        }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: data.createdBy,
        actionType: 'GROUP_CREATE',
        actionDescription: `Created group "${data.name}" for family`,
        entityType: 'group',
        entityId: group.id,
        entityName: data.name,
      });

      // Return enriched group with userRole (RESTful consistency)
      return await this.enrichGroupWithUserContext(group, data.createdBy);
    } catch (error) {
      console.error('Create group error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create group', 500);
    }
  }

  async joinGroupByInviteCode(inviteCode: string, userId: string) {
    try {
      // First, get the user's family and validate admin role
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: { 
          family: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      if (!userFamily) {
        throw new AppError('You must be part of a family to join groups', 400);
      }

      // CRITICAL: Only family ADMINs can accept group invitations
      if (userFamily.role !== 'ADMIN') {
        throw new AppError('Only family administrators can accept group invitations', 403);
      }

      // Find the group invitation by invite code (try both formats for compatibility)
      const cleanCode = inviteCode.trim();
      
      const invitation = await this.prisma.groupInvitation.findFirst({
        where: {
          OR: [
            { inviteCode: cleanCode },
            { inviteCode: cleanCode.toUpperCase() },
            { inviteCode: cleanCode.toLowerCase() }
          ],
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          group: {
            include: {
              familyMembers: {
                where: { familyId: userFamily.familyId }
              }
            }
          }
        }
      });

      if (!invitation) {
        throw new AppError('Invalid or expired invitation code', 404);
      }

      const group = invitation.group;

      // Check if family is already a member
      if (group.familyMembers.length > 0) {
        throw new AppError('Your family is already a member of this group', 400);
      }

      // Check if this is the owner family
      if (group.familyId === userFamily.familyId) {
        throw new AppError('Your family owns this group', 400);
      }

      // Complete family enrollment with role inheritance
      // Convert invitation role string to GroupRole enum
      const groupRole = invitation.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

      await this.prisma.groupFamilyMember.create({
        data: {
          familyId: userFamily.familyId,
          groupId: group.id,
          role: groupRole, // Use role from invitation (converted to enum)
          addedBy: userId
        }
      });

      // Mark invitation as ACCEPTED
      await this.prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      });

      // Fetch the complete group with all includes for enrichment
      const completeGroup = await this.prisma.group.findUnique({
        where: { id: group.id },
        include: {
          ownerFamily: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true
            }
          }
        }
      });

      if (!completeGroup) {
        throw new AppError('Group not found after joining', 500);
      }

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'GROUP_JOIN',
        actionDescription: `Family "${userFamily.family.name}" joined group "${group.name}" via invitation`,
        entityType: 'group',
        entityId: group.id,
        entityName: group.name,
      });

      // Return enriched group with userRole (RESTful consistency)
      return await this.enrichGroupWithUserContext(completeGroup, userId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Join group error:', error);
      throw new AppError('Failed to join group', 500);
    }
  }

  async getUserGroups(userId: string) {
    try {
      // First, get the user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: { family: true }
      });

      if (!userFamily) {
        return []; // User has no family, so no groups
      }

      // Get all groups where the user's family is a member or owner
      const groups = await this.prisma.group.findMany({
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
        include: {
          ownerFamily: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: { 
              familyMembers: true,
              scheduleSlots: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform groups using shared enrichment logic (DRY)
      const userGroups = await Promise.all(
        groups.map(group => this.enrichGroupWithUserContext(group, userId))
      );

      return userGroups;
    } catch (error) {
      console.error('Get user groups error:', error);
      throw new AppError('Failed to fetch user groups', 500);
    }
  }


  // Get group families (not individual members) - for family-based group management UI
  async getGroupFamilies(groupId: string, requesterId: string) {
    try {
      // Verify requester has access to the group
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId: requesterId },
        select: { familyId: true, role: true }
      });

      if (!userFamily) {
        throw new AppError('Access denied', 403);
      }

      // Check if requester is admin (needed for canManage flag)
      const requesterIsAdmin = await this.hasGroupAdminPermissions(requesterId, groupId);

      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          ownerFamily: {
            include: {
              members: {
                where: { role: 'ADMIN' },
                include: { user: true }
              }
            }
          },
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    where: { role: 'ADMIN' },
                    include: { user: true }
                  }
                }
              }
            }
          },
          invitations: {
            where: {
              status: 'PENDING',
              expiresAt: {
                gt: new Date()
              },
              targetFamilyId: {
                not: null
              }
            },
            include: {
              targetFamily: {
                include: {
                  members: {
                    where: { role: 'ADMIN' },
                    include: { user: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Check if requester's family has access
      const hasAccess = group.familyId === userFamily.familyId ||
                       group.familyMembers.some(fm => fm.familyId === userFamily.familyId);

      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }

      const families = [];
      
      // Add owner family
      const ownerFamilyAdmins = group.ownerFamily.members.map(member => ({
        name: member.user.name,
        email: member.user.email
      }));
      
      families.push({
        id: group.ownerFamily.id,
        name: group.ownerFamily.name,
        role: 'OWNER',
        isMyFamily: group.ownerFamily.id === userFamily.familyId,
        canManage: false, // Cannot manage owner family
        admins: ownerFamilyAdmins
      });

      // Add member families  
      for (const familyMember of group.familyMembers) {
        const familyAdmins = familyMember.family.members.map(member => ({
          name: member.user.name,
          email: member.user.email
        }));
        const isMyFamily = familyMember.family.id === userFamily.familyId;
        
        families.push({
          id: familyMember.family.id,
          name: familyMember.family.name,
          role: familyMember.role,
          isMyFamily,
          canManage: !isMyFamily && requesterIsAdmin, // Can manage other families only if requester is admin
          admins: familyAdmins
        });
      }

      // Add families with pending invitations
      for (const invitation of group.invitations) {
        if (invitation.targetFamily) {
          const familyAdmins = invitation.targetFamily.members.map(member => ({
            name: member.user.name,
            email: member.user.email
          }));
          const isMyFamily = invitation.targetFamily.id === userFamily.familyId;
          
          families.push({
            id: invitation.targetFamily.id,
            name: invitation.targetFamily.name,
            role: invitation.role, // The invited role (MEMBER or ADMIN)
            status: invitation.status, // Invitation status (PENDING, ACCEPTED, etc.)
            isMyFamily,
            canManage: !isMyFamily && requesterIsAdmin, // Can manage invitations only if requester is admin
            admins: familyAdmins,
            invitationId: invitation.id,
            inviteCode: invitation.inviteCode, // Invite code for display/sharing
            invitedAt: invitation.createdAt.toISOString(),
            expiresAt: invitation.expiresAt.toISOString()
          });
        }
      }

      return families;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get group families error:', error);
      throw new AppError('Failed to fetch group families', 500);
    }
  }

  async updateFamilyRole(groupId: string, targetFamilyId: string, newRole: GroupRole, requesterId: string) {
    try {
      // Verify requester has admin permissions
      const hasAdminPermissions = await this.hasGroupAdminPermissions(requesterId, groupId);
      if (!hasAdminPermissions) {
        throw new AppError('Only group administrators can update roles', 403);
      }

      const group = await this.prisma.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Cannot change role of owner family
      if (group.familyId === targetFamilyId) {
        throw new AppError('Cannot change role of group owner family', 400);
      }

      // Update the family's role
      const updatedMembership = await this.prisma.groupFamilyMember.update({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId: groupId
          }
        },
        data: { role: newRole },
        include: {
          family: true
        }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_ROLE_UPDATE',
        actionDescription: `Updated ${updatedMembership.family.name}'s role to ${newRole}`,
        entityType: 'group',
        entityId: groupId,
      });

      return updatedMembership;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Update family role error:', error);
      throw new AppError('Failed to update family role', 500);
    }
  }

  async removeFamilyFromGroup(groupId: string, targetFamilyId: string, requesterId: string) {
    try {
      // Verify requester has admin permissions
      const hasAdminPermissions = await this.hasGroupAdminPermissions(requesterId, groupId);
      if (!hasAdminPermissions) {
        throw new AppError('Only group administrators can remove families', 403);
      }

      const group = await this.prisma.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Cannot remove owner family
      if (group.familyId === targetFamilyId) {
        throw new AppError('Cannot remove group owner family', 400);
      }

      // Remove the family membership
      await this.prisma.groupFamilyMember.delete({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId: groupId
          }
        }
      });

      // Remove all children from this family that are assigned to group schedules
      await this.prisma.groupChildMember.deleteMany({
        where: {
          groupId,
          child: {
            familyId: targetFamilyId
          }
        }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_MEMBER_REMOVE',
        actionDescription: `Removed family from group`,
        entityType: 'group',
        entityId: groupId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Remove family from group error:', error);
      throw new AppError('Failed to remove family from group', 500);
    }
  }

  async updateGroup(groupId: string, requesterId: string, updateData: { name?: string; description?: string }) {
    try {
      // Only OWNER and ADMIN roles can update group settings
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          familyMembers: true
        }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Check if user has ADMIN or OWNER role in the group
      const userRole = await this.calculateUserRoleInGroup(group, requesterId);
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        throw new AppError('Only group owners and administrators can update group settings', 403);
      }

      // Build update data
      const dataToUpdate: any = {
        updatedAt: new Date()
      };
      
      if (updateData.name) {
        dataToUpdate.name = updateData.name;
      }
      
      if (updateData.description !== undefined) {
        dataToUpdate.description = updateData.description || null;
      }

      // Update the group
      await this.prisma.group.update({
        where: { id: groupId },
        data: dataToUpdate,
      });

      // Fetch the complete group with all relations for enrichment
      const updatedGroup = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          ownerFamily: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          familyMembers: true,
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true
            }
          }
        }
      });

      if (!updatedGroup) {
        throw new AppError('Group not found after update', 404);
      }

      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_UPDATE',
        actionDescription: `Updated group ${updatedGroup.name}`,
        entityType: 'group',
        entityId: groupId,
        entityName: updatedGroup.name,
      });

      // Use shared enrichment logic for consistent REST response
      return await this.enrichGroupWithUserContext(updatedGroup, requesterId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Update group error:', error);
      throw new AppError('Failed to update group', 500);
    }
  }

  async deleteGroup(groupId: string, requesterId: string) {
    try {
      // Only owner family admins can delete a group
      const group = await this.prisma.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const isOwnerAdmin = await this.isFamilyAdmin(requesterId, group.familyId);
      if (!isOwnerAdmin) {
        throw new AppError('Only administrators of the owner family can delete the group', 403);
      }

      // Delete the group (cascades will handle related records)
      await this.prisma.group.delete({
        where: { id: groupId }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_DELETE',
        actionDescription: `Deleted group`,
        entityType: 'group',
        entityId: groupId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Delete group error:', error);
      throw new AppError('Failed to delete group', 500);
    }
  }


  async leaveGroup(groupId: string, userId: string) {
    try {
      // Get user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: { family: true }
      });

      if (!userFamily) {
        throw new AppError('User not part of a family', 400);
      }

      const group = await this.prisma.group.findUnique({
        where: { id: groupId }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Owner family cannot leave their own group
      if (group.familyId === userFamily.familyId) {
        throw new AppError('Owner family cannot leave their own group', 400);
      }

      // Remove family membership
      await this.prisma.groupFamilyMember.delete({
        where: {
          familyId_groupId: {
            familyId: userFamily.familyId,
            groupId: groupId
          }
        }
      });

      // Remove all children from this family that are assigned to group schedules
      await this.prisma.groupChildMember.deleteMany({
        where: {
          groupId,
          child: {
            familyId: userFamily.familyId
          }
        }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'GROUP_LEAVE',
        actionDescription: `Family "${userFamily.family.name}" left group`,
        entityType: 'group',
        entityId: groupId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Leave group error:', error);
      throw new AppError('Failed to leave group', 500);
    }
  }


  async searchFamiliesForInvitation(searchTerm: string, requesterId: string, groupId: string): Promise<FamilySearchResult[]> {
    try {
      // Vérifier permissions admin groupe (refactorised)
      await this.validateGroupAdminPermissions(requesterId, groupId);

      // Obtenir famille du demandeur
      const requesterFamily = await this.prisma.familyMember.findFirst({
        where: { userId: requesterId },
        select: { familyId: true }
      });

      // Rechercher familles
      const whereClause: any = {
        name: { contains: searchTerm, mode: 'insensitive' },
        groupMembers: {
          none: { groupId } // Exclure familles déjà membres
        }
      };
      
      if (requesterFamily?.familyId) {
        whereClause.id = { not: requesterFamily.familyId };
      }

      const families = await this.prisma.family.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          members: {
            where: { role: 'ADMIN' },
            select: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: { members: true }
          }
        },
        take: 10 // Limit results
      });

      // Get all pending invitations for this group to check canInvite
      const pendingInvitations = await this.unifiedInvitationService.getGroupInvitations(groupId);
      const invitedFamilyIds = new Set(
        pendingInvitations
          .filter((inv: any) => inv.status === 'PENDING')
          .map((inv: any) => inv.targetFamilyId)
      );

      return families.map(family => ({
        id: family.id,
        name: family.name,
        adminContacts: family.members.map((m: any) => ({
          name: m.user.name,
          email: m.user.email
        })),
        memberCount: family._count.members,
        canInvite: !invitedFamilyIds.has(family.id) // Check if family already has pending invitation
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error searching families for invitation:', error);
      throw new AppError('Failed to search families', 500);
    }
  }

  async inviteFamilyToGroup(groupId: string, familyId: string, inviterId: string, personalMessage?: string, platform: 'web' | 'native' = 'web'): Promise<any> {
    try {
      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          targetFamilyId: familyId,
          role: GroupRole.MEMBER,
          ...(personalMessage !== undefined && { personalMessage })
        },
        inviterId,
        platform
      );

      // Get actual family and group names for response
      const targetFamily = await this.prisma.family.findUnique({
        where: { id: familyId },
        select: { name: true }
      });

      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true }
      });

      // Return compatible format for backward compatibility
      return {
        invitationsSent: 1, // UnifiedInvitationService creates one invitation per family
        familyName: targetFamily?.name || 'Family',
        groupName: group?.name || 'Group'
      };
    } catch (error) {
      // Convert UnifiedInvitationService errors to AppError format for backward compatibility
      if (error instanceof Error) {
        throw new AppError(error.message, 400);
      }
      throw new AppError('Failed to invite family to group', 500);
    }
  }

  async searchFamilies(searchTerm: string, requesterId: string) {
    try {
      // Get requester's family to exclude from results
      const requesterFamily = await this.prisma.familyMember.findFirst({
        where: { userId: requesterId },
        select: { familyId: true }
      });

      // Search families by name, excluding requester's family
      const whereClause: any = {
        name: { contains: searchTerm, mode: 'insensitive' }
      };
      
      if (requesterFamily?.familyId) {
        whereClause.id = { not: requesterFamily.familyId };
      }

      const families = await this.prisma.family.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          members: {
            where: { role: 'ADMIN' },
            select: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: { members: true }
          }
        },
        take: 10 // Limit results
      });

      return families.map(family => ({
        id: family.id,
        name: family.name,
        adminContacts: family.members.map((m: any) => ({
          name: m.user.name,
          email: m.user.email
        })),
        memberCount: family._count.members
      }));
    } catch (error) {
      console.error('Search families error:', error);
      throw new AppError('Failed to search families', 500);
    }
  }


  async inviteFamilyById(groupId: string, inviteData: { familyId: string; role: GroupRole; personalMessage?: string }, invitedBy: string, platform: 'web' | 'native' = 'web') {
    try {
      // Delegate to UnifiedInvitationService
      const invitation = await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          targetFamilyId: inviteData.familyId,
          role: inviteData.role,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage })
        },
        invitedBy,
        platform
      );

      // Return the created invitation for mobile app compatibility
      return invitation;
    } catch (error) {
      // Convert UnifiedInvitationService errors to AppError format for backward compatibility
      if (error instanceof Error) {
        throw new AppError(error.message, 400);
      }
      throw new AppError('Failed to send invitation', 500);
    }
  }

  async inviteFamilyByEmail(groupId: string, inviteData: { email: string; role?: GroupRole; personalMessage?: string }, invitedBy: string, platform: 'web' | 'native' = 'web') {
    try {
      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          email: inviteData.email,
          role: inviteData.role || GroupRole.MEMBER,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage })
        },
        invitedBy,
        platform
      );

      return []; // Return empty array - invitation created successfully
    } catch (error) {
      // Convert UnifiedInvitationService errors to AppError format for backward compatibility
      if (error instanceof Error) {
        throw new AppError(error.message, 400);
      }
      throw new AppError('Failed to send invitation', 500);
    }
  }

  async getPendingInvitations(groupId: string, requesterId: string) {
    try {
      // Verify requester has admin permissions for the group
      await this.validateGroupAdminPermissions(requesterId, groupId);

      // Delegate to UnifiedInvitationService
      const invitations = await this.unifiedInvitationService.getGroupInvitations(groupId);

      return invitations;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get pending invitations error:', error);
      throw new AppError('Failed to fetch invitations', 500);
    }
  }

  async cancelInvitation(groupId: string, invitationId: string, requesterId: string) {
    try {
      // Verify requester has admin permissions
      await this.validateGroupAdminPermissions(requesterId, groupId);

      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.cancelGroupInvitation(invitationId, requesterId);

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Cancel invitation error:', error);
      throw new AppError('Failed to cancel invitation', 500);
    }
  }

  async acceptGroupInvitation(inviteCode: string, _userEmail: string, userId: string) {
    try {
      // Delegate to UnifiedInvitationService
      const result = await this.unifiedInvitationService.acceptGroupInvitation(inviteCode, userId);

      if (!result.success) {
        throw new AppError(result.error || 'Failed to accept invitation', 400);
      }

      // Return compatible format for backward compatibility
      return {
        membersAdded: true
      };
    } catch (error) {
      // Convert UnifiedInvitationService errors to AppError format for backward compatibility
      if (error instanceof Error) {
        throw new AppError(error.message, 400);
      }
      throw new AppError('Failed to accept invitation', 500);
    }
  }

  async cleanupAllInvitations(): Promise<void> {
    await this.unifiedInvitationService.cleanupExpiredInvitations();
  }

  /**
   * Validate group invitation code with authenticated user context
   */
  async validateInvitationCodeWithUser(inviteCode: string, userId: string): Promise<AuthenticatedInviteValidationResponse> {
    try {
      // First validate the invitation code itself
      const baseValidation = await this.validateInvitationCode(inviteCode);
      
      if (!baseValidation.valid) {
        return {
          ...baseValidation,
          userStatus: 'NO_FAMILY',
          canAccept: false
        };
      }

      // Try to get acceptance preview from UnifiedInvitationService
      // This will tell us about family requirements and eligibility
      try {
        const acceptResult = await this.unifiedInvitationService.acceptGroupInvitation(inviteCode, userId);
        
        if (acceptResult.requiresFamilyOnboarding) {
          return {
            ...baseValidation,
            userStatus: 'NO_FAMILY',
            canAccept: false,
            message: 'You must be part of a family to join groups',
            actionRequired: 'CREATE_FAMILY'
          };
        }

        if (acceptResult.requiresAdminAction) {
          return {
            ...baseValidation,
            userStatus: 'FAMILY_MEMBER',
            canAccept: false,
            message: acceptResult.message || 'Only your family admin can accept this invitation',
            actionRequired: 'CONTACT_ADMIN'
          };
        }

        if (acceptResult.alreadyMember) {
          return {
            ...baseValidation,
            userStatus: 'ALREADY_MEMBER',
            canAccept: false,
            message: acceptResult.message || 'Your family is already a member of this group',
            actionRequired: 'ALREADY_ACCEPTED'
          };
        }

        // If we get here, user can accept
        return {
          ...baseValidation,
          userStatus: 'FAMILY_ADMIN',
          canAccept: true,
          message: `Ready to join ${baseValidation.group!.name} as family admin`,
          actionRequired: 'READY_TO_JOIN'
        };
      } catch (error) {
        // If acceptance would fail, user likely can't accept
        return {
          ...baseValidation,
          userStatus: 'NO_FAMILY',
          canAccept: false,
          message: 'Unable to accept invitation',
          actionRequired: 'CREATE_FAMILY'
        };
      }
    } catch (error) {
      console.error('Error validating group invitation with user context:', error);
      throw error;
    }
  }

  /**
   * Validate group invitation code (public method for unauthenticated users)
   */
  async validateInvitationCode(inviteCode: string): Promise<GroupInviteValidationResponse> {
    try {
      // Delegate to UnifiedInvitationService
      const validation = await this.unifiedInvitationService.validateGroupInvitation(inviteCode);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error || 'Invalid invitation code'
        };
      }

      // Return compatible format for backward compatibility
      return {
        valid: true,
        group: {
          id: validation.groupId || '',
          name: validation.groupName || ''
        },
        invitation: {
          id: '', // Invitation ID not available from validation interface
          expiresAt: new Date(), // Would need to be added to interface
          role: GroupRole.MEMBER // Default role
        }
      };
    } catch (error) {
      console.error('Error validating group invitation code:', error);
      throw error;
    }
  }
}