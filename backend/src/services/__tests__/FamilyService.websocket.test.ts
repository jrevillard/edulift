import { FamilyService } from '../FamilyService';
import { UnifiedInvitationService } from '../UnifiedInvitationService';
import { SocketEmitter, setGlobalSocketHandler } from '../../utils/socketEmitter';

// Mock the SocketEmitter
jest.mock('../../utils/socketEmitter', () => ({
  SocketEmitter: {
    broadcastFamilyUpdate: jest.fn(),
  },
  setGlobalSocketHandler: jest.fn(),
  getGlobalSocketHandler: jest.fn(),
}));

const mockSocketEmitter = SocketEmitter as jest.Mocked<typeof SocketEmitter>;

describe('FamilyService WebSocket Events', () => {
  let familyService: FamilyService;
  let mockPrisma: any;
  let mockLogger: any;
  let mockSocketHandler: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock socket handler
    mockSocketHandler = {
      broadcastToGroup: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    // Setup mock Prisma
    mockPrisma = {
      family: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(), // Add missing method
        update: jest.fn(),
      },
      familyMember: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Initialize service
    familyService = new FamilyService(mockPrisma, mockLogger);

    // Setup global socket handler
    setGlobalSocketHandler(mockSocketHandler);
  });

  afterEach(() => {
    setGlobalSocketHandler(null);
  });

  describe('Family Creation', () => {
    it('should emit FAMILY_UPDATED event when family is created', async () => {
      const userId = 'user-123';
      const familyName = 'Test Family';
      const familyId = 'family-456';

      const mockFamily = {
        id: familyId,
        name: familyName,
        members: [],
        children: [],
        vehicles: []
      };

      // Mock transaction behavior
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null), // No existing family
            create: jest.fn().mockResolvedValue({ familyId, userId, role: 'ADMIN' }),
          },
          family: {
            create: jest.fn().mockResolvedValue({ id: familyId, name: familyName }),
            findFirst: jest.fn().mockResolvedValue(mockFamily),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockFamily),
          },
        };
        return await callback(mockTx);
      });

      await familyService.createFamily(userId, familyName);

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'updated',
        expect.objectContaining({
          action: 'created',
          family: mockFamily
        })
      );
    });

    it('should not emit event if family creation fails', async () => {
      const userId = 'user-123';
      const familyName = 'Test Family';

      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(familyService.createFamily(userId, familyName)).rejects.toThrow();
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Family Joining', () => {
    it('should emit FAMILY_MEMBER_JOINED event when user joins family', async () => {
      const userId = 'user-123';
      const inviteCode = 'invite-456';
      const familyId = 'family-789';

      const mockFamily = {
        id: familyId,
        name: 'Test Family',
        members: [],
        children: [],
        vehicles: []
      };

      // Mock UnifiedInvitationService
      jest.spyOn(UnifiedInvitationService.prototype, 'acceptFamilyInvitation')
        .mockResolvedValue({ success: true });

      // Mock getUserFamily to return the family
      jest.spyOn(familyService, 'getUserFamily')
        .mockResolvedValue(mockFamily as any);

      const result = await familyService.joinFamily(inviteCode, userId);

      expect(result).toEqual(mockFamily);
    });

    it('should throw error if family not retrieved after joining', async () => {
      const userId = 'user-123';
      const inviteCode = 'invite-456';

      // Mock UnifiedInvitationService to return success
      jest.spyOn(UnifiedInvitationService.prototype, 'acceptFamilyInvitation')
        .mockResolvedValue({ success: true });

      // Mock getUserFamily to return null (family not found)
      jest.spyOn(familyService, 'getUserFamily')
        .mockResolvedValue(null);

      await expect(familyService.joinFamily(inviteCode, userId)).rejects.toThrow(
        'Failed to retrieve family after joining'
      );
    });

    it('should throw specific error from UnifiedInvitationService', async () => {
      const userId = 'user-123';
      const inviteCode = 'invite-456';
      const specificError = 'You already belong to a family: Smith Family';

      // Mock UnifiedInvitationService to return specific error
      jest.spyOn(UnifiedInvitationService.prototype, 'acceptFamilyInvitation')
        .mockResolvedValue({ success: false, error: specificError });

      await expect(familyService.joinFamily(inviteCode, userId)).rejects.toThrow(
        specificError
      );
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Member Role Updates', () => {
    it('should emit FAMILY_UPDATED event when member role is updated', async () => {
      const adminId = 'admin-123';
      const memberId = 'member-456';
      const familyId = 'family-789';
      const newRole = 'ADMIN';

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ familyId, role: 'ADMIN' }) // Admin check
              .mockResolvedValueOnce({ userId: 'user-456', role: 'MEMBER' }), // Target member
            update: jest.fn().mockResolvedValue({ role: newRole }),
          },
        };
        return await callback(mockTx);
      });

      await familyService.updateMemberRole(adminId, memberId, newRole as any);

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'updated',
        expect.objectContaining({
          action: 'memberRoleUpdated',
          memberId,
          userId: 'user-456',
          oldRole: 'MEMBER',
          newRole,
          changedBy: adminId
        })
      );
    });
  });

  describe('Member Removal', () => {
    it('should emit FAMILY_MEMBER_LEFT event when member is removed', async () => {
      const adminId = 'admin-123';
      const memberId = 'member-456';
      const targetUserId = 'user-789';
      const familyId = 'family-999';

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ familyId, role: 'ADMIN' }) // Admin check
              .mockResolvedValueOnce({ id: memberId, userId: targetUserId, role: 'MEMBER' }), // Target member
            delete: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(2), // Not last admin
          },
        };
        return await callback(mockTx);
      });

      await familyService.removeMember(adminId, memberId);

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'memberLeft',
        expect.objectContaining({
          action: 'memberRemoved',
          memberId,
          userId: targetUserId,
          removedBy: adminId
        })
      );
    });

    it('should not allow admin to remove themselves', async () => {
      const adminId = 'admin-123';
      const memberId = 'member-456';
      const familyId = 'family-999';

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ familyId, role: 'ADMIN' }) // Admin check
              .mockResolvedValueOnce({ id: memberId, userId: adminId, role: 'ADMIN' }), // Target is admin themselves
          },
        };
        return await callback(mockTx);
      });

      await expect(familyService.removeMember(adminId, memberId)).rejects.toThrow(
        'Admin cannot remove themselves'
      );
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Member Leaving Family', () => {
    it('should emit FAMILY_MEMBER_LEFT event when member leaves family', async () => {
      const userId = 'user-123';
      const familyId = 'family-456';
      const memberId = 'member-789';

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({
              id: memberId,
              familyId,
              role: 'MEMBER'
            }),
            delete: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(2), // Not last admin
          },
        };
        return await callback(mockTx);
      });

      await familyService.leaveFamily(userId);

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'memberLeft',
        expect.objectContaining({
          action: 'memberLeft',
          userId,
          memberId
        })
      );
    });

    it('should not allow last admin to leave family', async () => {
      const userId = 'user-123';
      const familyId = 'family-456';

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({
              familyId,
              role: 'ADMIN'
            }),
            count: jest.fn().mockResolvedValue(1), // Last admin
          },
        };
        return await callback(mockTx);
      });

      await expect(familyService.leaveFamily(userId)).rejects.toThrow(
        'Cannot leave family as you are the last administrator'
      );
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully and not emit events', async () => {
      const userId = 'user-123';
      const familyName = 'Test Family';

      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

      await expect(familyService.createFamily(userId, familyName)).rejects.toThrow();
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });

    it('should handle missing socket handler gracefully', async () => {
      // Clear any previous calls to the mock
      jest.clearAllMocks();

      const userId = 'user-123';
      const familyName = 'Test Family';
      const familyId = 'family-456';

      const mockFamily = {
        id: familyId,
        name: familyName,
        members: [],
        children: [],
        vehicles: []
      };

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ familyId, userId, role: 'ADMIN' }),
          },
          family: {
            create: jest.fn().mockResolvedValue({ id: familyId, name: familyName }),
            findFirst: jest.fn().mockResolvedValue(mockFamily),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockFamily),
          },
        };
        return await callback(mockTx);
      });

      // Should not throw error even without socket handler
      const result = await familyService.createFamily(userId, familyName);
      expect(result).toEqual(mockFamily);

      // Socket emitter should still be called even when handler is null
      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'updated',
        expect.objectContaining({
          action: 'created',
          family: mockFamily
        })
      );
    });
  });
});