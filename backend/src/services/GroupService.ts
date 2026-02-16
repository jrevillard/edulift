// @ts-nocheck
import { PrismaClient, GroupRole } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { EmailServiceFactory } from './EmailServiceFactory';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { UnifiedInvitationService } from './UnifiedInvitationService';
import {
  CreateGroupData,
  // InviteFamilyToGroupData, // Currently unused
  FamilySearchResult,
} from '../types/GroupTypes';
import { createLogger } from '../utils/logger';

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
  private logger = createLogger('group');

  // Consistent include pattern for fetching complete Group objects
  private static readonly GROUP_INCLUDE = {
    familyMembers: {
      include: {
        family: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    },
    _count: {
      select: {
        familyMembers: true,
        scheduleSlots: true,
      },
    },
  };

  // Constants

  constructor(private prisma: PrismaClient, emailService?: EmailServiceInterface) {
    this.activityLogRepo = new ActivityLogRepository(prisma);

    // Use provided email service or use EmailServiceFactory for consistent configuration
    this.emailService = emailService ?? EmailServiceFactory.getInstance();

    // Initialize UnifiedInvitationService
    this.unifiedInvitationService = new UnifiedInvitationService(
      prisma,
      {
        info: (message: string, meta?: unknown) => this.logger.info(message, meta as Record<string, unknown>),
        error: (message: string, meta?: unknown) => this.logger.error(message, meta as Record<string, unknown>),
        warn: (message: string, meta?: unknown) => this.logger.warn(message, meta as Record<string, unknown>),
        debug: (message: string, meta?: unknown) => this.logger.debug(message, meta as Record<string, unknown>),
      },
      this.emailService,
    );
  }

  // Get user's family
  async getUserFamily(userId: string) {
    const familyMember = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { family: true },
    });
    return familyMember;
  }

  // Check if user is a family admin
  private async isFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
    const member = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
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
      select: { familyId: true, role: true },
    });

    if (!userFamily) return false;

    // Only family ADMINs can have group admin permissions
    if (userFamily.role !== 'ADMIN') return false;

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        familyMembers: {
          where: {
            familyId: userFamily.familyId,
          },
        },
      },
    });

    if (!group) return false;

    // Rule: Family ADMIN = Group ADMIN (only if family has ADMIN GroupRole)
    // Owner family admins always have permissions (role='OWNER')
    const familyMembership = group.familyMembers.find(fm => fm.familyId === userFamily.familyId);

    // Owner or Admin families have admin permissions
    return familyMembership?.role === 'OWNER' || familyMembership?.role === 'ADMIN';
  }

  /**
   * Calculate user's role in a specific group
   * @param group - Group with ownerFamily and familyMembers
   * @param userId - User ID to check role for
   * @returns User's role: 'ADMIN' or 'MEMBER' (users can never be 'OWNER' in groups)
   */
  private async calculateUserRoleInGroup(
    group: any, // Prisma group with familyMembers included
    userId: string,
  ): Promise<'ADMIN' | 'MEMBER'> {
    // Get user's family to determine role
    const userFamily = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: { familyId: true, role: true },
    });

    if (!userFamily) {
      throw new AppError('User has no family', 400);
    }

    // Calculate userRole using family membership in the group
    let userRole: 'ADMIN' | 'MEMBER' = 'MEMBER';

    // Find this family's membership in the group (including OWNER role)
    const familyMembership = group.familyMembers?.find(
      (fm: unknown) => fm.familyId === userFamily.familyId,
    );

    if (familyMembership) {
      // Owner or Admin families get ADMIN if user is family admin
      if (familyMembership.role === 'OWNER' || familyMembership.role === 'ADMIN') {
        userRole = userFamily.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
      }
      // For MEMBER role families, users are always members
    }

    // Note: userRole never returns 'OWNER' - only ADMIN or MEMBER
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
    group: any, // Prisma group with familyMembers includes
    userId: string,
  ) {
    // Calculate userRole using shared logic
    const userRole = await this.calculateUserRoleInGroup(group, userId);

    // All families are now in familyMembers (including owner with role='OWNER')
    const familyCount = group._count?.familyMembers ?? 0;

    // Find owner family from membership with role='OWNER'
    const ownerMembership = group.familyMembers?.find(
      (fm: unknown) => fm.role === 'OWNER'
    );

    // Return enriched format matching getUserGroups() response
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      userRole,
      familyCount,
      scheduleCount: group._count?.scheduleSlots ?? 0,
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
          inviteCode,
          // Create owner membership in group_family_members
          familyMembers: {
            create: {
              familyId: data.familyId,
              role: 'OWNER',
              addedBy: data.createdBy,
            },
          },
        },
        include: {
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    where: { role: 'ADMIN' },
                    include: { user: true },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true,
            },
          },
        },
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
      this.logger.error('Create group error:', { error: error instanceof Error ? error.message : String(error) });
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
                  user: true,
                },
              },
            },
          },
        },
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
            { inviteCode: cleanCode.toLowerCase() },
          ],
          status: 'PENDING',
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          group: {
            include: {
              familyMembers: {
                where: { familyId: userFamily.familyId },
              },
            },
          },
        },
      });

      if (!invitation) {
        throw new AppError('Invalid or expired invitation code', 404);
      }

      const group = invitation.group;

      // Check if family is already a member
      if (group.familyMembers.length > 0) {
        throw new AppError('Your family is already a member of this group', 400);
      }

      // Check if this is the owner family (look for role='OWNER')
      const ownerMembership = group.familyMembers.find(fm => fm.role === 'OWNER');
      if (ownerMembership?.familyId === userFamily.familyId) {
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
          addedBy: userId,
        },
      });

      // Mark invitation as ACCEPTED
      await this.prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // Fetch the complete group with all includes for enrichment
      const completeGroup = await this.prisma.group.findUnique({
        where: { id: group.id },
        include: {
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true,
            },
          },
        },
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
      this.logger.error('Join group error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to join group', 500);
    }
  }

  async getUserGroups(userId: string) {
    try {
      // First, get the user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: { family: true },
      });

      if (!userFamily) {
        return []; // User has no family, so no groups
      }

      // Get all groups where the user's family is a member or owner
      const groups = await this.prisma.group.findMany({
        where: {
          familyMembers: {
            some: { familyId: userFamily.familyId },
          },
        },
        include: {
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              familyMembers: true,
              scheduleSlots: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Transform groups using shared enrichment logic (DRY)
      const userGroups = await Promise.all(
        groups.map(group => this.enrichGroupWithUserContext(group, userId)),
      );

      return userGroups;
    } catch (error) {
      this.logger.error('Get user groups error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to fetch user groups', 500);
    }
  }


  // Get group families (not individual members) - for family-based group management UI
  async getGroupFamilies(groupId: string, requesterId: string) {
    try {
      // Verify requester has access to the group
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId: requesterId },
        select: { familyId: true, role: true },
      });

      if (!userFamily) {
        throw new AppError('Access denied', 403);
      }

      // Check if requester is admin (needed for canManage flag)
      const requesterIsAdmin = await this.hasGroupAdminPermissions(requesterId, groupId);

      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          familyMembers: {
            include: {
              family: {
                include: {
                  members: {
                    where: { role: 'ADMIN' },
                    include: { user: true },
                  },
                },
              },
            },
          },
          invitations: {
            where: {
              status: 'PENDING',
              expiresAt: {
                gt: new Date(),
              },
              targetFamilyId: {
                not: null,
              },
            },
            include: {
              targetFamily: {
                include: {
                  members: {
                    where: { role: 'ADMIN' },
                    include: { user: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Check if requester's family has access (now includes owner via role='OWNER')
      const hasAccess = group.familyMembers.some(fm => fm.familyId === userFamily.familyId);

      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }

      const families = [];

      // Add all families from familyMembers (owner is now included with role='OWNER')
      for (const familyMember of group.familyMembers) {
        const familyAdmins = familyMember.family.members.map(member => ({
          name: member.user.name,
          email: member.user.email,
        }));
        const isMyFamily = familyMember.family.id === userFamily.familyId;
        const isOwner = familyMember.role === 'OWNER';

        families.push({
          id: familyMember.family.id,
          name: familyMember.family.name,
          role: familyMember.role as 'OWNER' | 'ADMIN' | 'MEMBER',
          isMyFamily,
          canManage: !isOwner && !isMyFamily && requesterIsAdmin, // Cannot manage owner family or self
          admins: familyAdmins,
        });
      }

      // Add families with pending invitations
      for (const invitation of group.invitations) {
        if (invitation.targetFamily) {
          const familyAdmins = invitation.targetFamily.members.map(member => ({
            name: member.user.name,
            email: member.user.email,
          }));
          const isMyFamily = invitation.targetFamily.id === userFamily.familyId;

          families.push({
            id: invitation.targetFamily.id,
            name: invitation.targetFamily.name,
            role: invitation.role as 'ADMIN' | 'MEMBER', // The invited role (MEMBER or ADMIN)
            status: invitation.status, // Invitation status (PENDING, ACCEPTED, etc.)
            isMyFamily,
            canManage: !isMyFamily && requesterIsAdmin, // Can manage invitations only if requester is admin
            admins: familyAdmins,
            invitationId: invitation.id,
            inviteCode: invitation.inviteCode, // Invite code for display/sharing
            invitedAt: invitation.createdAt.toISOString(),
            expiresAt: invitation.expiresAt.toISOString(),
          });
        }
      }

      return families;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get group families error:', { error: error instanceof Error ? error.message : String(error) });
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

      // Get the current membership to check if it's the owner
      const currentMembership = await this.prisma.groupFamilyMember.findUnique({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId,
          },
        },
      });

      if (!currentMembership) {
        throw new AppError('Family is not a member of this group', 404);
      }

      // Cannot change role of owner family
      if (currentMembership.role === 'OWNER') {
        throw new AppError('Cannot change role of group owner family', 400);
      }

      // Update the family's role
      const updatedMembership = await this.prisma.groupFamilyMember.update({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId,
          },
        },
        data: { role: newRole },
        include: {
          family: true,
        },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_ROLE_UPDATE',
        actionDescription: `Updated ${updatedMembership.family.name}'s role to ${newRole}`,
        entityType: 'group',
        entityId: groupId,
      });

      // Convert Date objects to ISO strings for JSON serialization
      // Return in schema order: groupId, familyId, role, joinedAt, addedBy, family
      // Note: GroupFamilyMember uses composite key (familyId+groupId), not separate id field
      return {
        groupId: updatedMembership.groupId,
        familyId: updatedMembership.familyId,
        role: updatedMembership.role,
        joinedAt: updatedMembership.joinedAt.toISOString(),
        addedBy: updatedMembership.addedBy,
        family: {
          id: updatedMembership.family.id,
          name: updatedMembership.family.name,
          createdAt: updatedMembership.family.createdAt.toISOString(),
          updatedAt: updatedMembership.family.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Update family role error:', { error: error instanceof Error ? error.message : String(error) });
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

      // Get the current membership to check if it's the owner
      const currentMembership = await this.prisma.groupFamilyMember.findUnique({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId,
          },
        },
      });

      if (!currentMembership) {
        throw new AppError('Family is not a member of this group', 404);
      }

      // Cannot remove owner family
      if (currentMembership.role === 'OWNER') {
        throw new AppError('Cannot remove group owner family', 400);
      }

      // Remove the family membership
      await this.prisma.groupFamilyMember.delete({
        where: {
          familyId_groupId: {
            familyId: targetFamilyId,
            groupId,
          },
        },
      });

      // Remove all children from this family that are assigned to group schedules
      await this.prisma.groupChildMember.deleteMany({
        where: {
          groupId,
          child: {
            familyId: targetFamilyId,
          },
        },
      });

      // Fetch the complete updated Group with all includes
      const updatedGroup = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: GroupService.GROUP_INCLUDE,
      });

      if (!updatedGroup) {
        throw new AppError('Group not found after removing family', 500);
      }

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_MEMBER_REMOVE',
        actionDescription: 'Removed family from group',
        entityType: 'group',
        entityId: groupId,
      });

      // Return enriched Group with userRole (RESTful consistency)
      return await this.enrichGroupWithUserContext(updatedGroup, requesterId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Remove family from group error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to remove family from group', 500);
    }
  }

  async updateGroup(groupId: string, requesterId: string, updateData: { name?: string; description?: string }) {
    try {
      // Only OWNER and ADMIN roles can update group settings
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          familyMembers: true,
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Check if user has ADMIN role in the group
      // Note: OWNER is not a user role - it's a display role for the owning family in getGroupFamilies()
      // Users can only be ADMIN or MEMBER (see calculateUserRoleInGroup documentation)
      const userRole = await this.calculateUserRoleInGroup(group, requesterId);
      if (userRole !== 'ADMIN') {
        throw new AppError('Only group owners and administrators can update group settings', 403);
      }

      // Build update data
      const dataToUpdate: any = {
        updatedAt: new Date(),
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
        include: GroupService.GROUP_INCLUDE,
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
      this.logger.error('Update group error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to update group', 500);
    }
  }

  async deleteGroup(groupId: string, requesterId: string) {
    try {
      // Find the group with owner membership
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          familyMembers: {
            where: { role: 'OWNER' },
          },
        },
      });

      if (!group || group.familyMembers.length === 0) {
        throw new AppError('Group not found', 404);
      }

      // Get the owner family ID from the membership with role='OWNER'
      const ownerFamilyId = group.familyMembers[0].familyId;
      const isOwnerAdmin = await this.isFamilyAdmin(requesterId, ownerFamilyId);
      if (!isOwnerAdmin) {
        throw new AppError('Only administrators of the owner family can delete the group', 403);
      }

      // Delete the group (cascades will handle related records)
      await this.prisma.group.delete({
        where: { id: groupId },
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: requesterId,
        actionType: 'GROUP_DELETE',
        actionDescription: 'Deleted group',
        entityType: 'group',
        entityId: groupId,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Delete group error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to delete group', 500);
    }
  }


  async leaveGroup(groupId: string, userId: string) {
    try {
      // Get user's family
      const userFamily = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: { family: true },
      });

      if (!userFamily) {
        throw new AppError('User not part of a family', 400);
      }

      // Get the family's membership in the group
      const familyMembership = await this.prisma.groupFamilyMember.findUnique({
        where: {
          familyId_groupId: {
            familyId: userFamily.familyId,
            groupId,
          },
        },
      });

      if (!familyMembership) {
        throw new AppError('Your family is not a member of this group', 404);
      }

      // Owner family cannot leave their own group
      if (familyMembership.role === 'OWNER') {
        throw new AppError('Owner family cannot leave their own group', 400);
      }

      // Remove family membership
      await this.prisma.groupFamilyMember.delete({
        where: {
          familyId_groupId: {
            familyId: userFamily.familyId,
            groupId,
          },
        },
      });

      // Remove all children from this family that are assigned to group schedules
      await this.prisma.groupChildMember.deleteMany({
        where: {
          groupId,
          child: {
            familyId: userFamily.familyId,
          },
        },
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
      this.logger.error('Leave group error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to leave group', 500);
    }
  }


  async searchFamiliesForInvitation(searchTerm: string, requesterId: string, groupId: string): Promise<FamilySearchResult[]> {
    try {
      // Check group admin permissions (refactorised)
      await this.validateGroupAdminPermissions(requesterId, groupId);

      // Get requester's family
      const requesterFamily = await this.prisma.familyMember.findFirst({
        where: { userId: requesterId },
        select: { familyId: true },
      });

      // Search for families
      const whereClause: any = {
        name: { contains: searchTerm, mode: 'insensitive' },
        groupMembers: {
          none: { groupId }, // Exclude families already members
        },
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
                  email: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
        take: 10, // Limit results
      });

      // Get all pending invitations for this group to check canInvite
      const pendingInvitations = await this.unifiedInvitationService.getGroupInvitations(groupId);
      const invitedFamilyIds = new Set(
        pendingInvitations
          .filter((inv: { status: string; targetFamilyId: string }) => inv.status === 'PENDING')
          .map((inv: { status: string; targetFamilyId: string }) => inv.targetFamilyId),
      );

      return families.map(family => ({
        id: family.id,
        name: family.name,
        adminContacts: family.members.map((m: { user: { name: string; email: string } }) => ({
          name: m.user.name,
          email: m.user.email,
        })),
        memberCount: family._count.members,
        canInvite: !invitedFamilyIds.has(family.id), // Check if family already has pending invitation
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Error searching families for invitation:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to search families', 500);
    }
  }

  async inviteFamilyToGroup(groupId: string, familyId: string, inviterId: string, personalMessage?: string): Promise<any> {
    try {
      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          targetFamilyId: familyId,
          role: GroupRole.MEMBER,
          ...(personalMessage !== undefined && { personalMessage }),
        },
        inviterId,
      );

      // Get actual family and group names for response
      const targetFamily = await this.prisma.family.findUnique({
        where: { id: familyId },
        select: { name: true },
      });

      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true },
      });

      // Return compatible format for backward compatibility
      return {
        invitationsSent: 1, // UnifiedInvitationService creates one invitation per family
        familyName: targetFamily?.name || 'Family',
        groupName: group?.name || 'Group',
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
        select: { familyId: true },
      });

      // Search families by name, excluding requester's family
      const whereClause: any = {
        name: { contains: searchTerm, mode: 'insensitive' },
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
                  email: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
        take: 10, // Limit results
      });

      return families.map(family => ({
        id: family.id,
        name: family.name,
        adminContacts: family.members.map((m: { user: { name: string; email: string } }) => ({
          name: m.user.name,
          email: m.user.email,
        })),
        memberCount: family._count.members,
      }));
    } catch (error) {
      this.logger.error('Search families error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to search families', 500);
    }
  }


  async inviteFamilyById(groupId: string, inviteData: { familyId: string; role: GroupRole; personalMessage?: string }, invitedBy: string) {
    try {
      // Delegate to UnifiedInvitationService
      const invitation = await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          targetFamilyId: inviteData.familyId,
          role: inviteData.role,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage }),
        },
        invitedBy,
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

  async inviteFamilyByEmail(groupId: string, inviteData: { email: string; role?: GroupRole; personalMessage?: string }, invitedBy: string) {
    try {
      // Delegate to UnifiedInvitationService
      await this.unifiedInvitationService.createGroupInvitation(
        groupId,
        {
          email: inviteData.email,
          role: inviteData.role || GroupRole.MEMBER,
          ...(inviteData.personalMessage !== undefined && { personalMessage: inviteData.personalMessage }),
        },
        invitedBy,
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
      this.logger.error('Get pending invitations error:', { error: error instanceof Error ? error.message : String(error) });
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
      this.logger.error('Cancel invitation error:', { error: error instanceof Error ? error.message : String(error) });
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
        membersAdded: true,
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
          canAccept: false,
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
            actionRequired: 'CREATE_FAMILY',
          };
        }

        if (acceptResult.requiresAdminAction) {
          return {
            ...baseValidation,
            userStatus: 'FAMILY_MEMBER',
            canAccept: false,
            message: acceptResult.message || 'Only your family admin can accept this invitation',
            actionRequired: 'CONTACT_ADMIN',
          };
        }

        if (acceptResult.alreadyMember) {
          return {
            ...baseValidation,
            userStatus: 'ALREADY_MEMBER',
            canAccept: false,
            message: acceptResult.message || 'Your family is already a member of this group',
            actionRequired: 'ALREADY_ACCEPTED',
          };
        }

        // If we get here, user can accept
        return {
          ...baseValidation,
          userStatus: 'FAMILY_ADMIN',
          canAccept: true,
          message: `Ready to join ${baseValidation.group!.name} as family admin`,
          actionRequired: 'READY_TO_JOIN',
        };
      } catch {
        // If acceptance would fail, user likely can't accept
        return {
          ...baseValidation,
          userStatus: 'NO_FAMILY',
          canAccept: false,
          message: 'Unable to accept invitation',
          actionRequired: 'CREATE_FAMILY',
        };
      }
    } catch (error) {
      this.logger.error('Error validating group invitation with user context:', { error: error instanceof Error ? error.message : String(error) });
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
          error: validation.error || 'Invalid invitation code',
        };
      }

      // Return compatible format for backward compatibility
      return {
        valid: true,
        group: {
          id: validation.groupId || '',
          name: validation.groupName || '',
        },
        invitation: {
          id: '', // Invitation ID not available from validation interface
          expiresAt: new Date(), // Would need to be added to interface
          role: GroupRole.MEMBER, // Default role
        },
      };
    } catch (error) {
      this.logger.error('Error validating group invitation code:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}