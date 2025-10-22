import { AuthorizationService } from '../AuthorizationService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
  familyMember: {
    findFirst: jest.fn(),
  },
  group: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  scheduleSlot: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AuthorizationService', () => {
  let authService: AuthorizationService;
  
  const TEST_USER_ID = 'test-user-123';
  const TEST_FAMILY_ID = 'test-family-456';
  const TEST_GROUP_ID = 'test-group-789';
  const TEST_SCHEDULE_SLOT_ID = 'test-slot-101';
  const UNAUTHORIZED_GROUP_ID = 'unauthorized-group-999';

  beforeEach(() => {
    authService = new AuthorizationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('canUserAccessGroup', () => {
    it('should allow access when user family owns the group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });

      // Mock group with user's family as owner
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        familyMembers: []
      });

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(true);
    });

    it('should allow access when user family is a member of the group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });

      // Mock group with user's family as member (not owner)
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_GROUP_ID,
        familyId: 'different-family-id',
        familyMembers: [{ familyId: TEST_FAMILY_ID }]
      });

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(true);
    });

    it('should deny access when user family has no relation to group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });

      // Mock group with no relationship to user's family
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: UNAUTHORIZED_GROUP_ID,
        familyId: 'different-family-id',
        familyMembers: []
      });

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, UNAUTHORIZED_GROUP_ID);
      expect(canAccess).toBe(false);
    });

    it('should deny access when user is not part of any family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(false);
    });

    it('should deny access when group does not exist', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, 'non-existent-group');
      expect(canAccess).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(false);
    });
  });

  describe('canUserAccessScheduleSlot', () => {
    it('should allow access when user can access the slot group', async () => {
      // Mock schedule slot
      (mockPrisma.scheduleSlot.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_SCHEDULE_SLOT_ID,
        groupId: TEST_GROUP_ID
      });

      // Mock user's family and group access
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        familyMembers: []
      });

      const canAccess = await authService.canUserAccessScheduleSlot(TEST_USER_ID, TEST_SCHEDULE_SLOT_ID);
      expect(canAccess).toBe(true);
    });

    it('should deny access when schedule slot does not exist', async () => {
      (mockPrisma.scheduleSlot.findUnique as jest.Mock).mockResolvedValue(null);

      const canAccess = await authService.canUserAccessScheduleSlot(TEST_USER_ID, 'non-existent-slot');
      expect(canAccess).toBe(false);
    });

    it('should deny access when user cannot access the slot group', async () => {
      // Mock schedule slot
      (mockPrisma.scheduleSlot.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_SCHEDULE_SLOT_ID,
        groupId: UNAUTHORIZED_GROUP_ID
      });

      // Mock user's family but no group access
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: UNAUTHORIZED_GROUP_ID,
        familyId: 'different-family-id',
        familyMembers: []
      });

      const canAccess = await authService.canUserAccessScheduleSlot(TEST_USER_ID, TEST_SCHEDULE_SLOT_ID);
      expect(canAccess).toBe(false);
    });
  });

  describe('canUserAccessFamily', () => {
    it('should allow access when user is part of the family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER_ID,
        familyId: TEST_FAMILY_ID
      });

      const canAccess = await authService.canUserAccessFamily(TEST_USER_ID, TEST_FAMILY_ID);
      expect(canAccess).toBe(true);
    });

    it('should deny access when user is not part of the family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const canAccess = await authService.canUserAccessFamily(TEST_USER_ID, 'other-family-id');
      expect(canAccess).toBe(false);
    });
  });

  describe('getUserAccessibleGroupIds', () => {
    it('should return groups owned by user family', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });

      // Mock groups accessible to the family
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([
        { id: 'group-1' },
        { id: 'group-2' },
        { id: 'group-3' }
      ]);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual(['group-1', 'group-2', 'group-3']);
    });

    it('should return empty array when user has no family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual([]);
    });

    it('should return empty array when family has no groups', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([]);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual([]);
    });
  });

  describe('canUserAccessGroups (batch authorization)', () => {
    it('should return authorization status for multiple groups', async () => {
      const groupIds = ['group-1', 'group-2', 'unauthorized-group'];
      
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID
      });

      // Mock accessible groups (only first two)
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([
        { id: 'group-1' },
        { id: 'group-2' }
      ]);

      const results = await authService.canUserAccessGroups(TEST_USER_ID, groupIds);
      
      expect(results).toEqual({
        'group-1': true,
        'group-2': true,
        'unauthorized-group': false
      });
    });
  });
});