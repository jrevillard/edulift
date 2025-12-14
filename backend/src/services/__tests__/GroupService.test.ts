import { GroupService } from '../GroupService';
import { MockEmailService } from '../MockEmailService';
import { TEST_IDS } from '../../utils/testHelpers';

describe('GroupService - Family-Based Architecture', () => {
  let groupService: GroupService;
  let mockPrisma: any;
  let mockEmailService: MockEmailService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(mockPrisma)),
      group: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      groupFamilyMember: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      groupChildMember: {
        deleteMany: jest.fn(),
      },
      groupInvitation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      familyMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      family: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      familyInvitation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    
    mockEmailService = new MockEmailService();
    groupService = new GroupService(mockPrisma, mockEmailService);
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a new group successfully when user is family admin', async () => {
      const groupData = {
        name: 'Test Group',
        familyId: TEST_IDS.FAMILY,
        createdBy: TEST_IDS.USER,
      };

      // Mock family admin check
      mockPrisma.familyMember.findUnique.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        userId: TEST_IDS.USER,
        role: 'ADMIN',
      });

      // Mock for enrichGroupWithUserContext
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        userId: TEST_IDS.USER,
        role: 'ADMIN',
      });

      // Mock group creation
      mockPrisma.group.create.mockResolvedValue({
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        description: null,
        familyId: TEST_IDS.FAMILY,
        inviteCode: 'INVITE123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family',
          members: [
            {
              user: { id: TEST_IDS.USER, name: 'Test User', email: 'test@example.com' },
              role: 'ADMIN',
            },
          ],
        },
        familyMembers: [],
        _count: {
          familyMembers: 0,
          scheduleSlots: 0,
        },
      });

      const result = await groupService.createGroup(groupData);

      expect(mockPrisma.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          familyId_userId: {
            familyId: TEST_IDS.FAMILY,
            userId: TEST_IDS.USER,
          },
        },
      });

      expect(mockPrisma.group.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Group',
          description: null,
          familyId: TEST_IDS.FAMILY,
          inviteCode: expect.any(String),
        },
        include: expect.any(Object),
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Group');
      expect(result.userRole).toBe('ADMIN');
      expect(result.familyCount).toBe(1);
      expect(result.scheduleCount).toBe(0);
      expect(result.ownerFamily).toEqual({
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      });
    });

    it('should throw error when user is not family admin', async () => {
      const groupData = {
        name: 'Test Group',
        familyId: TEST_IDS.FAMILY,
        createdBy: TEST_IDS.USER,
      };

      // Mock non-admin user
      mockPrisma.familyMember.findUnique.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        userId: TEST_IDS.USER,
        role: 'MEMBER',
      });

      await expect(groupService.createGroup(groupData)).rejects.toThrow(
        'Only family administrators can create groups',
      );
    });

    it('should throw error when user is not in family', async () => {
      const groupData = {
        name: 'Test Group',
        familyId: TEST_IDS.FAMILY,
        createdBy: TEST_IDS.USER,
      };

      // Mock user not in family
      mockPrisma.familyMember.findUnique.mockResolvedValue(null);

      await expect(groupService.createGroup(groupData)).rejects.toThrow(
        'Only family administrators can create groups',
      );
    });
  });

  describe('joinGroupByInviteCode', () => {
    it('should join group successfully when family is not already a member', async () => {
      const inviteCode = 'ABC123DEF456';
      const userId = TEST_IDS.USER;

      // Mock user's family (user is admin)
      mockPrisma.familyMember.findFirst
        .mockResolvedValueOnce({
          familyId: TEST_IDS.FAMILY,
          role: 'ADMIN',
          family: {
            id: TEST_IDS.FAMILY,
            name: 'Test Family',
            members: [
              {
                user: { id: TEST_IDS.USER, name: 'Test User', email: 'test@example.com' },
              },
            ],
          },
        })
        // Mock for enrichGroupWithUserContext
        .mockResolvedValueOnce({
          familyId: TEST_IDS.FAMILY,
          userId: TEST_IDS.USER,
          role: 'MEMBER',
        });

      // Mock group invitation exists and family is not a member
      mockPrisma.groupInvitation.findFirst.mockResolvedValue({
        id: TEST_IDS.INVITATION,
        role: 'MEMBER',
        // Note: inviteCode removed as per unified invitation system
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          familyId: TEST_IDS.FAMILY_2, // Different family owns it
          familyMembers: [], // Family not already a member
        },
      });

      // Mock successful family membership creation
      mockPrisma.groupFamilyMember.create.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        addedBy: TEST_IDS.USER,
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          inviteCode: 'ABC123DEF456',
        },
        family: { id: TEST_IDS.FAMILY, name: 'Test Family' },
      });

      // Mock for invitation update
      mockPrisma.groupInvitation.update.mockResolvedValue({
        id: TEST_IDS.INVITATION,
        status: 'ACCEPTED',
      });

      // Mock complete group fetch after joining
      mockPrisma.group.findUnique.mockResolvedValue({
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        description: 'Test Description',
        familyId: TEST_IDS.FAMILY_2,
        inviteCode: 'ABC123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ownerFamily: {
          id: TEST_IDS.FAMILY_2,
          name: 'Owner Family',
          members: [
            {
              user: { id: 'owner-user', email: 'owner@test.com', name: 'Owner' },
            },
          ],
        },
        familyMembers: [
          { familyId: TEST_IDS.FAMILY_2, role: 'ADMIN' },
          { familyId: TEST_IDS.FAMILY, role: 'MEMBER' },
        ],
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      });

      const result = await groupService.joinGroupByInviteCode(inviteCode, userId);

      expect(mockPrisma.groupInvitation.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { inviteCode },
            { inviteCode: inviteCode.toUpperCase() },
            { inviteCode: inviteCode.toLowerCase() },
          ],
          status: 'PENDING',
          expiresAt: { gt: expect.any(Date) },
        },
        include: {
          group: {
            include: {
              familyMembers: {
                where: { familyId: TEST_IDS.FAMILY },
              },
            },
          },
        },
      });

      expect(mockPrisma.groupFamilyMember.create).toHaveBeenCalledWith({
        data: {
          familyId: TEST_IDS.FAMILY,
          groupId: TEST_IDS.GROUP,
          role: 'MEMBER',
          addedBy: TEST_IDS.USER,
        },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_IDS.GROUP);
      expect(result.name).toBe('Test Group');
      expect(result.description).toBe('Test Description');
      expect(result.familyId).toBe(TEST_IDS.FAMILY_2);
      expect(result.inviteCode).toBe('ABC123');
      expect(result.userRole).toBe('MEMBER');
      expect(result.ownerFamily).toEqual({
        id: TEST_IDS.FAMILY_2,
        name: 'Owner Family',
      });
      expect(result.familyCount).toBe(2);
      expect(result.scheduleCount).toBe(0);
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should throw error when family is already a member', async () => {
      const inviteCode = 'ABC123DEF456';
      const userId = TEST_IDS.USER;

      // Mock user's family (user is admin)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
        family: { id: TEST_IDS.FAMILY, name: 'Test Family' },
      });

      // Mock group invitation where family is already a member
      mockPrisma.groupInvitation.findFirst.mockResolvedValue({
        id: TEST_IDS.INVITATION,
        // Note: inviteCode removed as per unified invitation system
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        group: {
          id: TEST_IDS.GROUP,
          familyId: TEST_IDS.FAMILY_2,
          familyMembers: [{ familyId: TEST_IDS.FAMILY }], // Family already a member
        },
      });

      await expect(groupService.joinGroupByInviteCode(inviteCode, userId)).rejects.toThrow(
        'Your family is already a member of this group',
      );
    });

    it('should throw error when family owns the group', async () => {
      const inviteCode = 'ABC123DEF456';
      const userId = TEST_IDS.USER;

      // Mock user's family (user is admin)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
        family: { id: TEST_IDS.FAMILY, name: 'Test Family' },
      });

      // Mock group invitation where family owns the group
      mockPrisma.groupInvitation.findFirst.mockResolvedValue({
        id: TEST_IDS.INVITATION,
        // Note: inviteCode removed as per unified invitation system
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        group: {
          id: TEST_IDS.GROUP,
          familyId: TEST_IDS.FAMILY, // Same family owns it
          familyMembers: [],
        },
      });

      await expect(groupService.joinGroupByInviteCode(inviteCode, userId)).rejects.toThrow(
        'Your family owns this group',
      );
    });
  });

  describe('getUserGroups', () => {
    it('should get all groups where user\'s family has access', async () => {
      const userId = TEST_IDS.USER;

      // Mock user's family
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
      });

      // Mock groups
      const mockDate = new Date('2024-01-01T00:00:00Z');
      mockPrisma.group.findMany.mockResolvedValue([
        {
          id: TEST_IDS.GROUP,
          name: 'Owned Group',
          familyId: TEST_IDS.FAMILY,
          inviteCode: 'INVITE123',
          createdAt: mockDate,
          updatedAt: mockDate,
          ownerFamily: { id: TEST_IDS.FAMILY, name: 'Test Family' },
          familyMembers: [],
          _count: { familyMembers: 0, scheduleSlots: 2 },
        },
        {
          id: TEST_IDS.GROUP_2,
          name: 'Member Group',
          familyId: TEST_IDS.FAMILY_2,
          inviteCode: 'INVITE456',
          createdAt: mockDate,
          updatedAt: mockDate,
          ownerFamily: { id: TEST_IDS.FAMILY_2, name: 'Other Family' },
          familyMembers: [{ familyId: TEST_IDS.FAMILY }],
          _count: { familyMembers: 2, scheduleSlots: 1 },
        },
      ]);

      const result = await groupService.getUserGroups(userId);

      expect(mockPrisma.group.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { familyId: TEST_IDS.FAMILY },
            {
              familyMembers: {
                some: { familyId: TEST_IDS.FAMILY },
              },
            },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no family', async () => {
      const userId = TEST_IDS.USER;

      // Mock user has no family
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      const result = await groupService.getUserGroups(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateFamilyRole', () => {
    it('should update family role when user has admin permissions', async () => {
      const groupId = TEST_IDS.GROUP;
      const targetFamilyId = TEST_IDS.FAMILY_2;
      const newRole = 'ADMIN';
      const requesterId = TEST_IDS.USER;

      // Mock admin permissions check
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      mockPrisma.group.findUnique.mockResolvedValue({
        id: TEST_IDS.GROUP,
        familyId: TEST_IDS.FAMILY, // Requester's family owns the group
        ownerFamily: {
          members: [{ userId: TEST_IDS.USER, role: 'ADMIN' }],
        },
        familyMembers: [],
      });

      // Mock successful update
      mockPrisma.groupFamilyMember.update.mockResolvedValue({
        familyId: TEST_IDS.FAMILY_2,
        groupId: TEST_IDS.GROUP,
        role: 'ADMIN',
        family: { id: TEST_IDS.FAMILY_2, name: 'Target Family' },
      });

      const result = await groupService.updateFamilyRole(groupId, targetFamilyId, newRole as any, requesterId);

      expect(mockPrisma.groupFamilyMember.update).toHaveBeenCalledWith({
        where: {
          familyId_groupId: {
            familyId: TEST_IDS.FAMILY_2,
            groupId: TEST_IDS.GROUP,
          },
        },
        data: { role: 'ADMIN' },
        include: { family: true },
      });

      expect(result).toBeDefined();
    });
  });

  describe('removeFamilyFromGroup', () => {
    it('should remove family from group when user has admin permissions', async () => {
      const groupId = TEST_IDS.GROUP;
      const targetFamilyId = TEST_IDS.FAMILY_2;
      const requesterId = TEST_IDS.USER;

      // Mock admin permissions and group ownership
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      mockPrisma.group.findUnique
        .mockResolvedValueOnce({
          id: TEST_IDS.GROUP,
          familyId: TEST_IDS.FAMILY,
          ownerFamily: {
            members: [{ userId: TEST_IDS.USER, role: 'ADMIN' }],
          },
          familyMembers: [],
        })
        .mockResolvedValueOnce({
          id: TEST_IDS.GROUP,
          familyId: TEST_IDS.FAMILY,
        });

      // Mock successful deletion
      mockPrisma.groupFamilyMember.delete.mockResolvedValue({});
      mockPrisma.groupChildMember.deleteMany.mockResolvedValue({ count: 0 });

      const result = await groupService.removeFamilyFromGroup(groupId, targetFamilyId, requesterId);

      expect(mockPrisma.groupFamilyMember.delete).toHaveBeenCalledWith({
        where: {
          familyId_groupId: {
            familyId: TEST_IDS.FAMILY_2,
            groupId: TEST_IDS.GROUP,
          },
        },
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should send invitation when user has admin permissions', async () => {
      const groupId = TEST_IDS.GROUP;
      const inviteData = {
        familyId: TEST_IDS.FAMILY_2,
        role: 'MEMBER' as any,
        personalMessage: 'Join our group!',
      };
      const invitedBy = TEST_IDS.USER;

      // Mock for hasGroupAdminPermissions call sequence
      // First call: get user's family for permission check
      mockPrisma.familyMember.findFirst
        .mockResolvedValueOnce({
          familyId: TEST_IDS.FAMILY,
          role: 'ADMIN',
        })
        // Second call: get target family data for invitation
        .mockResolvedValueOnce({
          id: 'family-member-1',
          familyId: inviteData.familyId,
          family: {
            id: TEST_IDS.FAMILY_2,
            name: 'Target Family',
            members: [
              {
                userId: 'admin-user-456',
                role: 'ADMIN',
                user: {
                  id: 'admin-user-456',
                  email: 'admin@targetfamily.com',
                  name: 'Family Admin',
                },
              },
            ],
          },
        });

      // Mock for hasGroupAdminPermissions group check
      mockPrisma.group.findUnique
        .mockResolvedValueOnce({
          id: TEST_IDS.GROUP,
          familyId: TEST_IDS.FAMILY, // Same as user's family (owner)
          familyMembers: [],
        })
        // Mock for main logic in inviteFamilyToGroup
        .mockResolvedValueOnce({
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          // Note: inviteCode removed as per unified invitation system
          ownerFamily: { name: 'Test Family' },
        })
        // Mock for the final group name lookup
        .mockResolvedValueOnce({
          name: 'Test Group',
        });

      // Mock family.findUnique for UnifiedInvitationService and family name lookup
      mockPrisma.family.findUnique
        .mockResolvedValueOnce({
          id: TEST_IDS.FAMILY_2,
          name: 'Target Family',
          members: [
            {
              id: 'family-member-1',
              userId: 'admin-user-456',
              role: 'ADMIN',
              user: {
                id: 'admin-user-456',
                email: 'admin@targetfamily.com',
                name: 'Family Admin',
              },
            },
          ],
        })
        // Mock for the final family name lookup
        .mockResolvedValueOnce({
          name: 'Target Family',
        });

      // Mock no existing membership
      mockPrisma.groupFamilyMember.findFirst.mockResolvedValue(null);
      
      // Mock no existing invitation
      mockPrisma.groupInvitation.findFirst.mockResolvedValue(null);

      // Mock invitation creation
      mockPrisma.groupInvitation.create.mockResolvedValue({
        id: TEST_IDS.INVITATION,
        groupId: TEST_IDS.GROUP,
        email: 'admin@targetfamily.com',
        role: 'MEMBER',
        personalMessage: 'Join our group!',
        invitedBy: TEST_IDS.USER,
        // Note: inviteCode removed as per unified invitation system
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
        group: { name: 'Test Group' },
        invitedByUser: { name: 'Inviter User' },
      });

      const result = await groupService.inviteFamilyToGroup(groupId, inviteData.familyId, invitedBy, inviteData.personalMessage);

      expect(mockPrisma.groupInvitation.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.invitationsSent).toBe(1);
      expect(result.familyName).toBe('Target Family');
      expect(result.groupName).toBe('Test Group');
    });
  });

  describe('getGroupFamilies', () => {
    it('should return family-based group members with proper permissions', async () => {
      const groupId = TEST_IDS.GROUP;
      const requesterId = TEST_IDS.USER;

      // Mock requester family membership (owner family admin)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock group with families
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: TEST_IDS.FAMILY, // Owner family
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Owner Family',
          members: [{
            user: {
              name: 'Admin User',
              email: 'admin@owner.com',
            },
          }],
        },
        familyMembers: [
          {
            family: {
              id: TEST_IDS.FAMILY_2,
              name: 'Member Family',
              members: [{
                user: {
                  name: 'Member Admin',
                  email: 'admin@member.com',
                },
              }],
            },
            role: 'MEMBER',
          },
        ],
        invitations: [], // No pending invitations in this test
      });

      const result = await groupService.getGroupFamilies(groupId, requesterId);

      expect(result).toHaveLength(2);
      
      // Check owner family
      expect(result[0]).toEqual({
        id: TEST_IDS.FAMILY,
        name: 'Owner Family',
        role: 'OWNER',
        isMyFamily: true,
        canManage: false,
        admins: [{
          name: 'Admin User',
          email: 'admin@owner.com',
        }],
      });

      // Check member family
      expect(result[1]).toEqual({
        id: TEST_IDS.FAMILY_2,
        name: 'Member Family',
        role: 'MEMBER',
        isMyFamily: false,
        canManage: true,
        admins: [{
          name: 'Member Admin',
          email: 'admin@member.com',
        }],
      });
    });

    it('should include families with pending invitations in the result', async () => {
      const groupId = TEST_IDS.GROUP;
      const requesterId = TEST_IDS.USER;

      // Mock requester family membership (owner family admin)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock group with owner, member families, and pending invitations
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: TEST_IDS.FAMILY,
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Owner Family',
          members: [{
            user: {
              name: 'Admin User',
              email: 'admin@owner.com',
            },
          }],
        },
        familyMembers: [{
          family: {
            id: TEST_IDS.FAMILY_2,
            name: 'Member Family',
            members: [{
              user: {
                name: 'Member Admin',
                email: 'admin@member.com',
              },
            }],
          },
          role: 'MEMBER',
        }],
        invitations: [{
          id: TEST_IDS.INVITATION,
          role: 'MEMBER', // The invited role
          status: 'PENDING', // Invitation status
          inviteCode: 'INV789', // Invite code
          targetFamily: {
            id: TEST_IDS.FAMILY,
            name: 'Pending Family',
            members: [{
              user: {
                name: 'Pending Admin',
                email: 'admin@pending.com',
              },
            }],
          },
          createdAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-12-31'),
        }],
      });

      const result = await groupService.getGroupFamilies(groupId, requesterId);

      expect(result).toHaveLength(3);
      
      // Check owner family
      expect(result[0]).toEqual({
        id: TEST_IDS.FAMILY,
        name: 'Owner Family',
        role: 'OWNER',
        isMyFamily: true,
        canManage: false,
        admins: [{
          name: 'Admin User',
          email: 'admin@owner.com',
        }],
      });

      // Check member family
      expect(result[1]).toEqual({
        id: TEST_IDS.FAMILY_2,
        name: 'Member Family',
        role: 'MEMBER',
        isMyFamily: false,
        canManage: true,
        admins: [{
          name: 'Member Admin',
          email: 'admin@member.com',
        }],
      });

      // Check pending family
      expect(result[2]).toEqual({
        id: TEST_IDS.FAMILY,
        name: 'Pending Family',
        role: 'MEMBER', // The invited role from the invitation
        status: 'PENDING', // The invitation status
        isMyFamily: true,
        canManage: false,
        admins: [{
          name: 'Pending Admin',
          email: 'admin@pending.com',
        }],
        invitationId: TEST_IDS.INVITATION,
        inviteCode: 'INV789', // Added inviteCode from invitation
        invitedAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-12-31T00:00:00.000Z',
      });
    });

    it('should return all admins for families with multiple administrators', async () => {
      const groupId = TEST_IDS.GROUP;
      const requesterId = TEST_IDS.USER;

      // Mock requester family membership
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
      });

      // Mock group with a family having multiple admins
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: TEST_IDS.FAMILY,
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Multi-Admin Family',
          members: [
            {
              user: {
                name: 'First Admin',
                email: 'first@admin.com',
              },
            },
            {
              user: {
                name: 'Second Admin',
                email: 'second@admin.com',
              },
            },
            {
              user: {
                name: 'Third Admin',
                email: 'third@admin.com',
              },
            },
          ],
        },
        familyMembers: [],
        invitations: [],
      });

      const result = await groupService.getGroupFamilies(groupId, requesterId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: TEST_IDS.FAMILY,
        name: 'Multi-Admin Family',
        role: 'OWNER',
        isMyFamily: true,
        canManage: false,
        admins: [
          {
            name: 'First Admin',
            email: 'first@admin.com',
          },
          {
            name: 'Second Admin',
            email: 'second@admin.com',
          },
          {
            name: 'Third Admin',
            email: 'third@admin.com',
          },
        ],
      });
    });

    it('should deny access for users not in the group', async () => {
      const groupId = TEST_IDS.GROUP;
      const requesterId = TEST_IDS.USER_2;

      // Mock requester family membership
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: TEST_IDS.FAMILY_2,
      });

      // Mock group without access for this family
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: TEST_IDS.FAMILY,
        familyMembers: [], // No member families
        invitations: [], // No invitations
      });

      await expect(groupService.getGroupFamilies(groupId, requesterId))
        .rejects.toThrow('Access denied');
    });
  });
});