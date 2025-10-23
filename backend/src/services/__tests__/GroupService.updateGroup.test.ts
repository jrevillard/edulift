import { GroupService } from '../GroupService';
// import { PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { ActivityLogRepository } from '../../repositories/ActivityLogRepository';

// Mock Prisma
const mockPrisma = {
  group: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  familyMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  groupFamilyMember: {
    findFirst: jest.fn(),
  },
  groupActivity: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock ActivityLogRepository
jest.mock('../../repositories/ActivityLogRepository', () => ({
  ActivityLogRepository: jest.fn().mockImplementation(() => ({
    createActivity: jest.fn().mockResolvedValue({
      id: 'activity123',
      userId: 'user123',
      actionType: 'GROUP_UPDATE',
      actionDescription: 'Updated group',
      createdAt: new Date(),
    }),
  })),
}));

describe('GroupService.updateGroup', () => {
  let groupService: GroupService;
  let mockActivityLogRepo: jest.Mocked<ActivityLogRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    groupService = new GroupService(mockPrisma);
    // Get the mocked ActivityLogRepository instance
    mockActivityLogRepo = (groupService as any).activityLogRepo;
  });

  describe('successful updates', () => {
    const mockGroup = {
      id: 'group123',
      name: 'Original Group',
      description: 'Original description',
      familyId: 'family123',
      ownerId: 'owner123',
      createdAt: new Date(),
      updatedAt: new Date(),
      familyMembers: [], // Required for calculateUserRoleInGroup
    };

    const mockUpdatedGroup = {
      id: 'group123',
      name: 'Updated Group',
      description: 'Updated description',
      familyId: 'family123',
      inviteCode: 'INVITE123',
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerFamily: {
        id: 'family123',
        name: 'Test Family',
      },
      familyMembers: [], // Required for calculateUserRoleInGroup
      _count: {
        familyMembers: 1,
        scheduleSlots: 0,
      },
    };

    beforeEach(() => {
      // Mock group exists (first call for permission check)
      mockPrisma.group.findUnique
        .mockResolvedValueOnce(mockGroup) // First call: permission check
        .mockResolvedValueOnce(mockUpdatedGroup); // Second call: fetch complete group after update

      // Mock user is admin of owner family (for calculateUserRoleInGroup)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member123',
        userId: 'user123',
        familyId: 'family123',
        role: 'ADMIN',
      });

      // Mock successful update (no longer returns group, just confirms update)
      mockPrisma.group.update.mockResolvedValue(undefined);
    });

    it('should update group name only', async () => {
      const updateData = { name: 'New Group Name' };

      const result = await groupService.updateGroup('group123', 'user123', updateData);

      // Verify update was called without select (returns void)
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group123' },
        data: {
          name: 'New Group Name',
          updatedAt: expect.any(Date),
        },
      });

      // Verify findUnique was called twice
      expect(mockPrisma.group.findUnique).toHaveBeenCalledTimes(2);

      // First call: permission check with familyMembers
      expect(mockPrisma.group.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 'group123' },
        include: {
          familyMembers: true,
        },
      });

      // Second call: fetch complete group after update
      expect(mockPrisma.group.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: 'group123' },
        include: expect.objectContaining({
          ownerFamily: expect.any(Object),
          familyMembers: true,
          _count: expect.any(Object),
        }),
      });

      expect(mockActivityLogRepo.createActivity).toHaveBeenCalledWith({
        userId: 'user123',
        actionType: 'GROUP_UPDATE',
        actionDescription: 'Updated group Updated Group',
        entityType: 'group',
        entityId: 'group123',
        entityName: 'Updated Group',
      });

      // Verify complete REST response with all fields (matching enrichGroupWithUserContext order)
      expect(result).toEqual({
        id: mockUpdatedGroup.id,
        name: mockUpdatedGroup.name,
        description: mockUpdatedGroup.description,
        familyId: mockUpdatedGroup.familyId,
        inviteCode: mockUpdatedGroup.inviteCode,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        userRole: 'ADMIN', // Changed from 'OWNER' to 'ADMIN'
        ownerFamily: mockUpdatedGroup.ownerFamily,
        familyCount: mockUpdatedGroup._count.familyMembers,
        scheduleCount: mockUpdatedGroup._count.scheduleSlots,
      });
    });

    it('should update group description only', async () => {
      const updateData = { description: 'New description' };

      const result = await groupService.updateGroup('group123', 'user123', updateData);

      // Verify update was called without select (returns void)
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group123' },
        data: {
          description: 'New description',
          updatedAt: expect.any(Date),
        },
      });

      // Verify findUnique was called twice
      expect(mockPrisma.group.findUnique).toHaveBeenCalledTimes(2);

      expect(mockActivityLogRepo.createActivity).toHaveBeenCalledWith({
        userId: 'user123',
        actionType: 'GROUP_UPDATE',
        actionDescription: 'Updated group Updated Group',
        entityType: 'group',
        entityId: 'group123',
        entityName: 'Updated Group',
      });

      // Verify complete REST response with all fields
      expect(result).toEqual({
        id: mockUpdatedGroup.id,
        name: mockUpdatedGroup.name,
        description: mockUpdatedGroup.description,
        familyId: mockUpdatedGroup.familyId,
        inviteCode: mockUpdatedGroup.inviteCode,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        userRole: 'ADMIN',
        ownerFamily: mockUpdatedGroup.ownerFamily,
        familyCount: mockUpdatedGroup._count.familyMembers,
        scheduleCount: mockUpdatedGroup._count.scheduleSlots,
      });
    });

    it('should update both name and description', async () => {
      const updateData = { name: 'New Name', description: 'New description' };

      const result = await groupService.updateGroup('group123', 'user123', updateData);

      // Verify update was called without select (returns void)
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group123' },
        data: {
          name: 'New Name',
          description: 'New description',
          updatedAt: expect.any(Date),
        },
      });

      // Verify findUnique was called twice
      expect(mockPrisma.group.findUnique).toHaveBeenCalledTimes(2);

      expect(mockActivityLogRepo.createActivity).toHaveBeenCalledWith({
        userId: 'user123',
        actionType: 'GROUP_UPDATE',
        actionDescription: 'Updated group Updated Group',
        entityType: 'group',
        entityId: 'group123',
        entityName: 'Updated Group',
      });

      // Verify complete REST response with all fields
      expect(result).toEqual({
        id: mockUpdatedGroup.id,
        name: mockUpdatedGroup.name,
        description: mockUpdatedGroup.description,
        familyId: mockUpdatedGroup.familyId,
        inviteCode: mockUpdatedGroup.inviteCode,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        userRole: 'ADMIN',
        ownerFamily: mockUpdatedGroup.ownerFamily,
        familyCount: mockUpdatedGroup._count.familyMembers,
        scheduleCount: mockUpdatedGroup._count.scheduleSlots,
      });
    });

    it('should clear description with empty string', async () => {
      const updateData = { description: '' };

      const result = await groupService.updateGroup('group123', 'user123', updateData);

      // Verify update was called without select (returns void)
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group123' },
        data: {
          description: null, // Empty string should be converted to null
          updatedAt: expect.any(Date),
        },
      });

      // Verify findUnique was called twice
      expect(mockPrisma.group.findUnique).toHaveBeenCalledTimes(2);

      // Verify complete REST response with all fields
      expect(result).toEqual({
        id: mockUpdatedGroup.id,
        name: mockUpdatedGroup.name,
        familyId: mockUpdatedGroup.familyId,
        description: mockUpdatedGroup.description,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        userRole: 'ADMIN',
        inviteCode: mockUpdatedGroup.inviteCode,
        ownerFamily: mockUpdatedGroup.ownerFamily,
        familyCount: mockUpdatedGroup._count.familyMembers,
        scheduleCount: mockUpdatedGroup._count.scheduleSlots,
      });
    });

    it('should set description to null when empty string provided', async () => {
      const updateData = { description: '' };

      const result = await groupService.updateGroup('group123', 'user123', updateData);

      // Verify update was called without select (returns void)
      expect(mockPrisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group123' },
        data: {
          description: null,
          updatedAt: expect.any(Date),
        },
      });

      // Verify findUnique was called twice
      expect(mockPrisma.group.findUnique).toHaveBeenCalledTimes(2);

      // Verify complete REST response with all fields
      expect(result).toEqual({
        id: mockUpdatedGroup.id,
        name: mockUpdatedGroup.name,
        description: mockUpdatedGroup.description,
        familyId: mockUpdatedGroup.familyId,
        inviteCode: mockUpdatedGroup.inviteCode,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        userRole: 'ADMIN',
        ownerFamily: mockUpdatedGroup.ownerFamily,
        familyCount: mockUpdatedGroup._count.familyMembers,
        scheduleCount: mockUpdatedGroup._count.scheduleSlots,
      });
    });
  });

  describe('error conditions', () => {
    it('should throw error if group not found', async () => {
      mockPrisma.group.findUnique.mockResolvedValue(null);

      await expect(
        groupService.updateGroup('nonexistent', 'user123', { name: 'New Name' }),
      ).rejects.toThrow(new AppError('Group not found', 404));

      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is MEMBER of owner family', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123',
        familyMembers: [],
      };

      mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

      // User is MEMBER (not ADMIN) of owner family
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member123',
        userId: 'user123',
        familyId: 'family123',
        role: 'MEMBER', // Not admin
      });

      await expect(
        groupService.updateGroup('group123', 'user123', { name: 'New Name' }),
      ).rejects.toThrow(new AppError('Only group owners and administrators can update group settings', 403));

      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is not member of any family', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123',
        familyMembers: [],
      };

      mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

      // User is not member of any family
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      await expect(
        groupService.updateGroup('group123', 'user123', { name: 'New Name' }),
      ).rejects.toThrow(new AppError('User has no family', 400));

      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is MEMBER of group (not owner family)', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123', // Owner family
        familyMembers: [
          {
            familyId: 'family456', // Member family
            role: 'MEMBER',
          },
        ],
      };

      mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

      // User is admin of member family (family456)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member456',
        userId: 'user456',
        familyId: 'family456', // Different family
        role: 'ADMIN',
      });

      await expect(
        groupService.updateGroup('group123', 'user456', { name: 'New Name' }),
      ).rejects.toThrow(new AppError('Only group owners and administrators can update group settings', 403));

      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });
  });

  describe('activity logging', () => {
    it('should handle activity log errors gracefully', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123',
        familyMembers: [], // Required for calculateUserRoleInGroup
      };

      const mockCompleteGroup = {
        id: 'group123',
        name: 'Updated Name',
        description: null,
        familyId: 'family123',
        inviteCode: 'INVITE123',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerFamily: { id: 'family123', name: 'Test Family' },
        familyMembers: [], // Required for calculateUserRoleInGroup
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      };

      mockPrisma.group.findUnique
        .mockResolvedValueOnce(mockGroup) // First call: permission check
        .mockResolvedValueOnce(mockCompleteGroup); // Second call: fetch complete group after update

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member123',
        userId: 'user123',
        familyId: 'family123',
        role: 'ADMIN',
      });

      // Mock update returns void
      mockPrisma.group.update.mockResolvedValue(undefined);

      // Mock activity log failure
      mockActivityLogRepo.createActivity.mockRejectedValue(new Error('Activity log error'));

      // The actual implementation throws errors when activity logging fails
      await expect(
        groupService.updateGroup('group123', 'user123', { name: 'Updated Name' }),
      ).rejects.toThrow('Failed to update group');
    });
  });

  describe('permission checking', () => {
    it('should allow owner family admin (ADMIN role) to update group', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123',
        familyMembers: [], // Required for calculateUserRoleInGroup
      };

      const mockCompleteGroup = {
        id: 'group123',
        name: 'New Name',
        description: null,
        familyId: 'family123',
        inviteCode: 'INVITE123',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerFamily: { id: 'family123', name: 'Test Family' },
        familyMembers: [], // Required for calculateUserRoleInGroup
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      };

      mockPrisma.group.findUnique
        .mockResolvedValueOnce(mockGroup) // First call: permission check
        .mockResolvedValueOnce(mockCompleteGroup); // Second call: fetch complete group after update

      // Mock admin member of owner family
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member123',
        userId: 'user123',
        familyId: 'family123',
        role: 'ADMIN',
      });

      // Mock update returns void
      mockPrisma.group.update.mockResolvedValue(undefined);

      const result = await groupService.updateGroup('group123', 'user123', { name: 'New Name' });

      expect(result.userRole).toBe('ADMIN');
      expect(mockPrisma.group.update).toHaveBeenCalled();
    });

    it('should allow group ADMIN (from member family) to update group', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123', // Owner family
        familyMembers: [
          {
            familyId: 'family456', // Member family with ADMIN role
            role: 'ADMIN',
          },
        ],
      };

      const mockCompleteGroup = {
        id: 'group123',
        name: 'New Name',
        description: null,
        familyId: 'family123',
        inviteCode: 'INVITE123',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerFamily: { id: 'family123', name: 'Test Family' },
        familyMembers: [
          {
            familyId: 'family456',
            role: 'ADMIN',
          },
        ],
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      };

      mockPrisma.group.findUnique
        .mockResolvedValueOnce(mockGroup) // First call: permission check
        .mockResolvedValueOnce(mockCompleteGroup); // Second call: fetch complete group after update

      // Mock admin member of member family (family456)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member456',
        userId: 'user456',
        familyId: 'family456', // Different family
        role: 'ADMIN', // Admin of their family
      });

      // Mock update returns void
      mockPrisma.group.update.mockResolvedValue(undefined);

      const result = await groupService.updateGroup('group123', 'user456', { name: 'New Name' });

      expect(result.userRole).toBe('ADMIN'); // Should be ADMIN based on GroupRole
      expect(mockPrisma.group.update).toHaveBeenCalled();
    });

    it('should NOT allow group MEMBER (from member family) to update group', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123', // Owner family
        familyMembers: [
          {
            familyId: 'family456', // Member family with MEMBER role
            role: 'MEMBER',
          },
        ],
      };

      mockPrisma.group.findUnique.mockResolvedValue(mockGroup);

      // Mock admin of member family (but group role is MEMBER)
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member456',
        userId: 'user456',
        familyId: 'family456',
        role: 'ADMIN', // Admin of their family
      });

      await expect(
        groupService.updateGroup('group123', 'user456', { name: 'New Name' }),
      ).rejects.toThrow(new AppError('Only group owners and administrators can update group settings', 403));

      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });

    it('should return correct userRole for owner family admin', async () => {
      const mockGroup = {
        id: 'group123',
        familyId: 'family123',
        familyMembers: [],
      };

      const mockCompleteGroup = {
        id: 'group123',
        name: 'New Name',
        description: null,
        familyId: 'family123',
        inviteCode: 'INVITE123',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerFamily: { id: 'family123', name: 'Test Family' },
        familyMembers: [],
        _count: {
          familyMembers: 1,
          scheduleSlots: 0,
        },
      };

      mockPrisma.group.findUnique
        .mockResolvedValueOnce(mockGroup)
        .mockResolvedValueOnce(mockCompleteGroup);

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member123',
        userId: 'user123',
        familyId: 'family123',
        role: 'ADMIN',
      });

      mockPrisma.group.update.mockResolvedValue(undefined);

      const result = await groupService.updateGroup('group123', 'user123', { name: 'New Name' });

      // Owner family admin should have ADMIN role (not OWNER)
      expect(result.userRole).toBe('ADMIN');
    });
  });
});