import { GroupService } from '../GroupService';
import { UnifiedInvitationService } from '../UnifiedInvitationService';

describe('GroupService - searchFamiliesForInvitation', () => {
  let groupService: GroupService;
  let mockPrisma: any;
  let mockUnifiedInvitationService: jest.Mocked<UnifiedInvitationService>;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(mockPrisma)),
      group: {
        findUnique: jest.fn()
      },
      groupFamilyMember: {
        findFirst: jest.fn()
      },
      familyMember: {
        findFirst: jest.fn()
      },
      family: {
        findMany: jest.fn()
      }
    };

    mockUnifiedInvitationService = {
      getGroupInvitations: jest.fn()
    } as any;

    groupService = new GroupService(
      mockPrisma,
      {} as any // emailService
    );

    // Inject mock UnifiedInvitationService
    (groupService as any).unifiedInvitationService = mockUnifiedInvitationService;
  });

  describe('canInvite flag calculation', () => {
    const groupId = 'group-123';
    const requesterId = 'user-admin';
    const searchTerm = 'Test';

    beforeEach(() => {
      // Mock hasGroupAdminPermissions - requester is family admin
      // This is called twice: once for permission check, once to get requester's family
      mockPrisma.familyMember.findFirst.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          familyId: 'requester-family',
          role: 'ADMIN',
          userId: where.userId
        });
      });

      // Mock group - requester's family is owner
      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: 'requester-family',
        name: 'Test Group',
        familyMembers: [] // Include relation for hasGroupAdminPermissions
      });

      // Mock groupFamilyMember for fallback check
      mockPrisma.groupFamilyMember.findFirst.mockResolvedValue({
        role: 'ADMIN',
        familyId: 'requester-family',
        groupId
      });
    });

    it('should set canInvite=false for families with PENDING invitations', async () => {
      // Mock families search result
      mockPrisma.family.findMany.mockResolvedValue([
        {
          id: 'family-1',
          name: 'Test Family 1',
          members: [{ user: { name: 'Admin 1', email: 'admin1@test.com' } }],
          _count: { members: 5 }
        },
        {
          id: 'family-2',
          name: 'Test Family 2',
          members: [{ user: { name: 'Admin 2', email: 'admin2@test.com' } }],
          _count: { members: 3 }
        }
      ]);

      // Mock pending invitations - family-1 has pending invitation
      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([
        {
          id: 'inv-1',
          targetFamilyId: 'family-1',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000) // Not expired
        }
      ] as any);

      const result = await groupService.searchFamiliesForInvitation(searchTerm, requesterId, groupId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('family-1');
      expect(result[0].canInvite).toBe(false); // Has pending invitation
      expect(result[1].id).toBe('family-2');
      expect(result[1].canInvite).toBe(true); // No pending invitation
    });

    it('should set canInvite=true for families with EXPIRED invitations', async () => {
      mockPrisma.family.findMany.mockResolvedValue([
        {
          id: 'family-1',
          name: 'Test Family 1',
          members: [{ user: { name: 'Admin 1', email: 'admin1@test.com' } }],
          _count: { members: 5 }
        }
      ]);

      // Mock expired invitation - status is EXPIRED
      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([
        {
          id: 'inv-1',
          targetFamilyId: 'family-1',
          status: 'EXPIRED',
          expiresAt: new Date(Date.now() - 86400000) // Expired yesterday
        }
      ] as any);

      const result = await groupService.searchFamiliesForInvitation(searchTerm, requesterId, groupId);

      expect(result).toHaveLength(1);
      expect(result[0].canInvite).toBe(true); // Can reinvite because invitation expired
    });

    it('should set canInvite=true for families with REJECTED invitations', async () => {
      mockPrisma.family.findMany.mockResolvedValue([
        {
          id: 'family-1',
          name: 'Test Family 1',
          members: [{ user: { name: 'Admin 1', email: 'admin1@test.com' } }],
          _count: { members: 5 }
        }
      ]);

      // Mock rejected invitation
      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([
        {
          id: 'inv-1',
          targetFamilyId: 'family-1',
          status: 'REJECTED',
          expiresAt: new Date(Date.now() + 86400000)
        }
      ] as any);

      const result = await groupService.searchFamiliesForInvitation(searchTerm, requesterId, groupId);

      expect(result).toHaveLength(1);
      expect(result[0].canInvite).toBe(true); // Can reinvite because invitation was rejected
    });

    it('should set canInvite=true when no invitations exist', async () => {
      mockPrisma.family.findMany.mockResolvedValue([
        {
          id: 'family-1',
          name: 'Test Family 1',
          members: [{ user: { name: 'Admin 1', email: 'admin1@test.com' } }],
          _count: { members: 5 }
        }
      ]);

      // No invitations
      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([]);

      const result = await groupService.searchFamiliesForInvitation(searchTerm, requesterId, groupId);

      expect(result).toHaveLength(1);
      expect(result[0].canInvite).toBe(true); // No invitation exists
    });

    it('should handle multiple families with mixed invitation statuses', async () => {
      mockPrisma.family.findMany.mockResolvedValue([
        { id: 'family-1', name: 'Family 1', members: [{ user: { name: 'A1', email: 'a1@test.com' } }], _count: { members: 3 } },
        { id: 'family-2', name: 'Family 2', members: [{ user: { name: 'A2', email: 'a2@test.com' } }], _count: { members: 4 } },
        { id: 'family-3', name: 'Family 3', members: [{ user: { name: 'A3', email: 'a3@test.com' } }], _count: { members: 2 } },
        { id: 'family-4', name: 'Family 4', members: [{ user: { name: 'A4', email: 'a4@test.com' } }], _count: { members: 5 } }
      ]);

      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([
        { id: 'inv-1', targetFamilyId: 'family-1', status: 'PENDING', expiresAt: new Date(Date.now() + 86400000) },
        { id: 'inv-2', targetFamilyId: 'family-2', status: 'EXPIRED', expiresAt: new Date(Date.now() - 86400000) },
        { id: 'inv-3', targetFamilyId: 'family-3', status: 'REJECTED', expiresAt: new Date(Date.now() + 86400000) }
        // family-4 has no invitation
      ] as any);

      const result = await groupService.searchFamiliesForInvitation(searchTerm, requesterId, groupId);

      expect(result).toHaveLength(4);
      expect(result.find(f => f.id === 'family-1')?.canInvite).toBe(false); // PENDING
      expect(result.find(f => f.id === 'family-2')?.canInvite).toBe(true);  // EXPIRED
      expect(result.find(f => f.id === 'family-3')?.canInvite).toBe(true);  // REJECTED
      expect(result.find(f => f.id === 'family-4')?.canInvite).toBe(true);  // No invitation
    });
  });

  describe('excludes already member families', () => {
    it('should not return families that are already group members', async () => {
      const groupId = 'group-123';
      const requesterId = 'user-admin';

      // Mock admin permissions
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: 'requester-family',
        role: 'ADMIN'
      });

      mockPrisma.group.findUnique.mockResolvedValue({
        id: groupId,
        familyId: 'requester-family',
        familyMembers: []
      });

      mockPrisma.groupFamilyMember.findFirst.mockResolvedValue({
        role: 'ADMIN',
        familyId: 'requester-family'
      });

      // The where clause should exclude families with groupMembers for this groupId
      mockPrisma.family.findMany.mockResolvedValue([]);
      mockUnifiedInvitationService.getGroupInvitations.mockResolvedValue([]);

      await groupService.searchFamiliesForInvitation('Test', requesterId, groupId);

      const findManyCall = mockPrisma.family.findMany.mock.calls[0][0];
      expect(findManyCall.where.groupMembers).toEqual({ none: { groupId } });
    });
  });
});
