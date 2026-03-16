import { GroupService } from '../GroupService';
import { MockEmailService } from '../MockEmailService';
import { TEST_IDS } from '../../utils/testHelpers';
import { setGlobalSocketHandler } from '../../utils/socketEmitter';
import { SOCKET_EVENTS } from '../../shared/events';

// Mock the logger module
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('GroupService - WebSocket Events', () => {
  let groupService: GroupService;
  let mockPrisma: any;
  let mockEmailService: MockEmailService;
  let mockSocketHandler: jest.Mocked<any>;

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
    };

    mockEmailService = new MockEmailService();
    groupService = new GroupService(mockPrisma, mockEmailService);
    jest.clearAllMocks();

    // Create mock socket handler
    mockSocketHandler = {
      broadcastToGroup: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    // Set global socket handler
    setGlobalSocketHandler(mockSocketHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    setGlobalSocketHandler(null);
  });

  describe('Group Creation', () => {
    it('should emit GROUP_CREATED event when group is created', async () => {
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
        inviteCode: 'INVITE123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER',
            addedBy: TEST_IDS.USER,
            joinedAt: new Date('2024-01-01'),
            family: {
              id: TEST_IDS.FAMILY,
              name: 'Test Family',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              members: [],
            },
          },
        ],
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      });

      // Mock for enrichGroupWithUserContext
      mockPrisma.group.findUnique.mockResolvedValue({
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        description: null,
        inviteCode: 'INVITE123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER',
            addedBy: TEST_IDS.USER,
            joinedAt: new Date('2024-01-01'),
            family: {
              id: TEST_IDS.FAMILY,
              name: 'Test Family',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              members: [],
            },
          },
        ],
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      });

      await groupService.createGroup(groupData);

      // Verify GROUP_CREATED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        SOCKET_EVENTS.GROUP_CREATED,
        expect.objectContaining({
          groupId: TEST_IDS.GROUP,
          action: 'created',
          createdBy: TEST_IDS.USER,
        }),
      );
    });
  });

  describe('Group Deletion', () => {
    it('should emit GROUP_DELETED event when group is deleted', async () => {
      // Mock group with owner membership
      mockPrisma.group.findUnique.mockResolvedValue({
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER',
          },
        ],
      });

      // Mock family admin check
      mockPrisma.familyMember.findUnique.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        userId: TEST_IDS.USER,
        role: 'ADMIN',
      });

      // Mock group deletion
      mockPrisma.group.delete.mockResolvedValue({ id: TEST_IDS.GROUP });

      await groupService.deleteGroup(TEST_IDS.GROUP, TEST_IDS.USER);

      // Verify GROUP_DELETED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        SOCKET_EVENTS.GROUP_DELETED,
        expect.objectContaining({
          groupId: TEST_IDS.GROUP,
          action: 'deleted',
          deletedBy: TEST_IDS.USER,
        }),
      );
    });
  });

  describe('Family Membership', () => {
    it('should emit GROUP_FAMILY_ADDED when family joins via invite code', async () => {
      const inviteCode = 'TEST123';
      const userId = TEST_IDS.USER;
      const familyId = TEST_IDS.FAMILY;

      // Mock user family with admin role (findFirst)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId,
        userId,
        role: 'ADMIN',
        family: {
          id: familyId,
          name: 'Test Family',
          members: [],
        },
      });

      // Mock for enrichGroupWithUserContext (called at the end)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId,
        userId,
        role: 'ADMIN',
        family: {
          id: familyId,
          name: 'Test Family',
          members: [],
        },
      });

      // Mock invitation
      mockPrisma.groupInvitation.findFirst.mockResolvedValue({
        id: 'inv-123',
        inviteCode,
        role: 'MEMBER',
        expiresAt: new Date(Date.now() + 3600000),
        status: 'PENDING',
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          familyMembers: [], // No existing members
        },
      });

      // Mock family membership creation
      mockPrisma.groupFamilyMember.create.mockResolvedValue({});

      // Mock invitation update
      mockPrisma.groupInvitation.update.mockResolvedValue({});

      // Mock complete group fetch (called after invitation accepted)
      mockPrisma.group.findUnique.mockResolvedValue({
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        inviteCode: 'TEST123',
        description: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        familyMembers: [
          {
            familyId,
            role: 'MEMBER',
            addedBy: userId,
            joinedAt: new Date('2024-01-01'),
            family: {
              id: familyId,
              name: 'Test Family',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              members: [],
            },
          },
        ],
        _count: { familyMembers: 1, scheduleSlots: 0 },
      });

      await groupService.joinGroupByInviteCode(inviteCode, userId);

      // Verify GROUP_FAMILY_ADDED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        SOCKET_EVENTS.GROUP_FAMILY_ADDED,
        expect.objectContaining({
          groupId: TEST_IDS.GROUP,
          familyId,
          action: 'joined',
          joinedBy: userId,
        }),
      );
    });

    it('should emit GROUP_FAMILY_LEFT when family leaves group', async () => {
      const groupId = TEST_IDS.GROUP;
      const userId = TEST_IDS.USER;
      const familyId = TEST_IDS.FAMILY;

      // Mock user family
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId,
        userId,
        role: 'ADMIN',
        family: {
          id: familyId,
          name: 'Test Family',
        },
      });

      // Mock family membership
      mockPrisma.groupFamilyMember.findUnique.mockResolvedValue({
        familyId,
        groupId,
        role: 'MEMBER',
      });

      // Mock family membership deletion
      mockPrisma.groupFamilyMember.delete.mockResolvedValue({});

      // Mock child member deletion
      mockPrisma.groupChildMember.deleteMany.mockResolvedValue({ count: 0 });

      await groupService.leaveGroup(groupId, userId);

      // Verify GROUP_FAMILY_LEFT event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_FAMILY_LEFT,
        expect.objectContaining({
          groupId,
          familyId,
          action: 'left',
        }),
      );
    });

    it('should emit GROUP_FAMILY_REMOVED when family is removed by admin', async () => {
      const groupId = TEST_IDS.GROUP;
      const targetFamilyId = 'family-target-123';
      const requesterId = TEST_IDS.USER;

      // Mock admin permissions check - hasGroupAdminPermissions needs familyMember.findFirst with select
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: requesterId,
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock group fetch for admin check - needs family with role='OWNER' or 'ADMIN'
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: groupId,
        name: 'Test Group',
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER', // Owner family has admin permissions
          },
        ],
      });

      // Mock current membership
      mockPrisma.groupFamilyMember.findUnique.mockResolvedValue({
        familyId: targetFamilyId,
        groupId,
        role: 'MEMBER',
      });

      // Mock family membership deletion
      mockPrisma.groupFamilyMember.delete.mockResolvedValue({});

      // Mock child member deletion
      mockPrisma.groupChildMember.deleteMany.mockResolvedValue({ count: 0 });

      // Mock for enrichGroupWithUserContext - needs family member again
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: requesterId,
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock updated group fetch
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: groupId,
        name: 'Test Group',
        inviteCode: 'TEST123',
        description: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER',
            addedBy: requesterId,
            joinedAt: new Date('2024-01-01'),
            family: {
              id: TEST_IDS.FAMILY,
              name: 'Test Family',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              members: [],
            },
          },
        ],
        _count: { familyMembers: 1, scheduleSlots: 0 },
      });

      await groupService.removeFamilyFromGroup(groupId, targetFamilyId, requesterId);

      // Verify GROUP_FAMILY_REMOVED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_FAMILY_REMOVED,
        expect.objectContaining({
          groupId,
          familyId: targetFamilyId,
          action: 'removed',
          removedBy: requesterId,
        }),
      );
    });

    it('should emit GROUP_FAMILY_ROLE_UPDATED when family role changes', async () => {
      const groupId = TEST_IDS.GROUP;
      const targetFamilyId = 'family-target-123';
      const newRole = 'ADMIN';
      const requesterId = TEST_IDS.USER;

      // Mock admin permissions check - hasGroupAdminPermissions needs familyMember.findFirst with select
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: requesterId,
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock group fetch for admin check - needs family with role='OWNER' or 'ADMIN'
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'OWNER', // Owner family has admin permissions
          },
        ],
      });

      // Mock current membership
      mockPrisma.groupFamilyMember.findUnique.mockResolvedValue({
        familyId: targetFamilyId,
        groupId,
        role: 'MEMBER',
      });

      // Mock family membership update
      mockPrisma.groupFamilyMember.update.mockResolvedValue({
        familyId: targetFamilyId,
        groupId,
        role: newRole,
        joinedAt: new Date('2024-01-01'),
        addedBy: requesterId,
        family: {
          id: targetFamilyId,
          name: 'Target Family',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      });

      await groupService.updateFamilyRole(groupId, targetFamilyId, newRole, requesterId);

      // Verify GROUP_FAMILY_ROLE_UPDATED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_FAMILY_ROLE_UPDATED,
        expect.objectContaining({
          groupId,
          familyId: targetFamilyId,
          newRole,
          action: 'roleUpdated',
          changedBy: requesterId,
          oldRole: 'MEMBER',
        }),
      );
    });
  });

  describe('Group Updates', () => {
    it('should emit GROUP_UPDATED when group details change', async () => {
      const groupId = TEST_IDS.GROUP;
      const requesterId = TEST_IDS.USER;
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
      };

      // Mock group fetch (initial)
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: groupId,
        name: 'Old Group Name',
        description: 'Old description',
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'ADMIN',
          },
        ],
      });

      // Mock user role calculation (returns ADMIN) via findFirst
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: requesterId,
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      // Mock group update
      mockPrisma.group.update.mockResolvedValue({});

      // Mock updated group fetch (after update)
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: groupId,
        name: updateData.name,
        description: updateData.description,
        inviteCode: 'TEST123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        familyMembers: [
          {
            familyId: TEST_IDS.FAMILY,
            role: 'ADMIN',
            addedBy: requesterId,
            joinedAt: new Date('2024-01-01'),
            family: {
              id: TEST_IDS.FAMILY,
              name: 'Test Family',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              members: [],
            },
          },
        ],
        _count: { familyMembers: 1, scheduleSlots: 0 },
      });

      // Mock for enrichGroupWithUserContext - needs family member again
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: requesterId,
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      });

      await groupService.updateGroup(groupId, requesterId, updateData);

      // Verify GROUP_UPDATED event was emitted
      expect(mockSocketHandler.broadcastToGroup).toHaveBeenCalledWith(
        groupId,
        SOCKET_EVENTS.GROUP_UPDATED,
        expect.objectContaining({
          groupId,
          action: 'updated',
          changes: updateData,
          changedBy: requesterId,
        }),
      );
    });
  });
});
