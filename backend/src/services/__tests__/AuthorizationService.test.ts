import { AuthorizationService } from '../AuthorizationService';
import { PrismaClient } from '@prisma/client';
import { TEST_IDS } from '../../utils/testHelpers';

// Mock Prisma client
const mockPrisma = {
  familyMember: {
    findFirst: jest.fn(),
  },
  group: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  groupFamilyMember: {
    findFirst: jest.fn(),
  },
  scheduleSlot: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AuthorizationService', () => {
  let authService: AuthorizationService;
  
  const TEST_USER_ID = TEST_IDS.USER;
  const TEST_FAMILY_ID = TEST_IDS.FAMILY;
  const TEST_GROUP_ID = TEST_IDS.GROUP;
  const TEST_SCHEDULE_SLOT_ID = TEST_IDS.SLOT;
  const UNAUTHORIZED_GROUP_ID = 'cltestunauthorized1234567890';

  beforeEach(() => {
    authService = new AuthorizationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('canUserAccessGroup', () => {
    it('should allow access when user family owns the group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });

      // Mock group membership with OWNER role
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue({
        groupId: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        role: 'OWNER',
      });

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(true);
    });

    it('should allow access when user family is a member of the group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });

      // Mock group membership with ADMIN role (not owner)
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue({
        groupId: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        role: 'ADMIN',
      });

      const canAccess = await authService.canUserAccessGroup(TEST_USER_ID, TEST_GROUP_ID);
      expect(canAccess).toBe(true);
    });

    it('should deny access when user family has no relation to group', async () => {
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });

      // Mock no group membership
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue(null);

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
        familyId: TEST_FAMILY_ID,
      });
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue(null);

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
        groupId: TEST_GROUP_ID,
      });

      // Mock user's family and group access
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue({
        groupId: TEST_GROUP_ID,
        familyId: TEST_FAMILY_ID,
        role: 'OWNER',
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
        groupId: UNAUTHORIZED_GROUP_ID,
      });

      // Mock user's family but no group access
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });
      (mockPrisma.groupFamilyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const canAccess = await authService.canUserAccessScheduleSlot(TEST_USER_ID, TEST_SCHEDULE_SLOT_ID);
      expect(canAccess).toBe(false);
    });
  });

  describe('canUserAccessFamily', () => {
    it('should allow access when user is part of the family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId: TEST_USER_ID,
        familyId: TEST_FAMILY_ID,
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
        familyId: TEST_FAMILY_ID,
      });

      // Mock groups accessible to the family
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([
        { id: TEST_IDS.GROUP },
        { id: TEST_IDS.GROUP_2 },
        { id: 'cltestgroup312345678901234' },
      ]);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual([TEST_IDS.GROUP, TEST_IDS.GROUP_2, 'cltestgroup312345678901234']);
    });

    it('should return empty array when user has no family', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual([]);
    });

    it('should return empty array when family has no groups', async () => {
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([]);

      const groupIds = await authService.getUserAccessibleGroupIds(TEST_USER_ID);
      expect(groupIds).toEqual([]);
    });
  });

  describe('canUserAccessGroups (batch authorization)', () => {
    it('should return authorization status for multiple groups', async () => {
      const groupIds = [TEST_IDS.GROUP, TEST_IDS.GROUP_2, 'cltestunauthorized1234567890'];
      
      // Mock user's family membership
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        familyId: TEST_FAMILY_ID,
      });

      // Mock accessible groups (only first two)
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([
        { id: TEST_IDS.GROUP },
        { id: TEST_IDS.GROUP_2 },
      ]);

      const results = await authService.canUserAccessGroups(TEST_USER_ID, groupIds);
      
      expect(results).toEqual({
        [TEST_IDS.GROUP]: true,
        [TEST_IDS.GROUP_2]: true,
        cltestunauthorized1234567890: false,
      });
    });
  });
});