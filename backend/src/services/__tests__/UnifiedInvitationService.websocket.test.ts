// @ts-nocheck
/* tslint:disable */
import { jest } from '@jest/globals';

// Mock Prisma with explicit typing to avoid inference issues
const mockPrisma = {
  $transaction: jest.fn() as jest.MockedFunction<any>,
  familyInvitation: {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    update: jest.fn() as jest.MockedFunction<any>,
  },
  user: {
    findUnique: jest.fn() as jest.MockedFunction<any>,
  },
  familyMember: {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    delete: jest.fn() as jest.MockedFunction<any>,
    count: jest.fn() as jest.MockedFunction<any>,
  },
  family: {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findUnique: jest.fn() as jest.MockedFunction<any>,
  },
} as any;

// Mock socket emitter
const mockSocketEmitter = {
  broadcastFamilyUpdate: jest.fn(),
};

// Mock SocketHandler
const mockSocketHandler = {
  broadcastToGroup: jest.fn(),
  broadcastToUser: jest.fn(),
};

// Mock Prisma enums
const FamilyInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};

const GroupInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};

const FamilyRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  FamilyInvitationStatus,
  GroupInvitationStatus,
  FamilyRole,
}));

import { UnifiedInvitationService } from '../UnifiedInvitationService';
import { setGlobalSocketHandler } from '../../utils/socketEmitter';

jest.mock('../../utils/socketEmitter', () => ({
  setGlobalSocketHandler: jest.fn(),
  getGlobalSocketHandler: jest.fn(() => mockSocketHandler),
  SocketEmitter: {
    broadcastFamilyUpdate: jest.fn((...args: unknown[]) => mockSocketEmitter.broadcastFamilyUpdate(...args)),
    broadcastGroupUpdate: jest.fn(),
    broadcastScheduleUpdate: jest.fn(),
    broadcastChildUpdate: jest.fn(),
    broadcastVehicleUpdate: jest.fn(),
  },
}));

describe('UnifiedInvitationService WebSocket Events', () => {
  let invitationService: UnifiedInvitationService;
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  const mockEmailService = {
    sendFamilyInvitation: jest.fn(),
    sendGroupInvitation: jest.fn(),
    sendMagicLink: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    invitationService = new UnifiedInvitationService(mockPrisma, mockLogger, mockEmailService as any);
    setGlobalSocketHandler(mockSocketHandler as any);
  });

  afterEach(() => {
    setGlobalSocketHandler(null);
  });

  describe('Family Invitation Acceptance', () => {
    it('should emit FAMILY_MEMBER_JOINED event when invitation is accepted', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
        family: {
          id: familyId,
          name: 'Test Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockFamily = {
        id: familyId,
        name: 'Test Family',
        members: [{ userId, role: 'MEMBER' }],
        children: [],
        vehicles: [],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        const txMock = {
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
            update: jest.fn().mockResolvedValue({
              ...mockInvitation,
              status: 'ACCEPTED',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null), // User not already member
            create: jest.fn().mockResolvedValue({
              userId,
              familyId,
              role: 'MEMBER',
            }),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(mockFamily),
          },
        } as any;
        return await callback(txMock);
      });

      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

      expect(result.success).toBe(true);
      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'memberJoined',
        expect.objectContaining({
          userId,
          action: 'invitationAccepted',
          invitationId: mockInvitation.id,
          role: 'MEMBER',
        }),
      );
    });

    it('should emit FAMILY_MEMBER_LEFT event when user leaves previous family', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const newFamilyId = 'family-789';
      const oldFamilyId = 'family-999';

      const mockInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId: newFamilyId,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        family: {
          id: newFamilyId,
          name: 'New Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockExistingMembership = {
        id: 'membership-456',
        userId,
        familyId: oldFamilyId,
        role: 'MEMBER',
      };

      const mockNewFamily = {
        id: newFamilyId,
        name: 'New Family',
        members: [{ userId, role: 'MEMBER' }],
        children: [],
        vehicles: [],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
            update: jest.fn().mockResolvedValue({
              ...mockInvitation,
              status: 'ACCEPTED',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(mockExistingMembership), // User has existing membership
            delete: jest.fn().mockResolvedValue(mockExistingMembership),
            create: jest.fn().mockResolvedValue({
              userId,
              familyId: newFamilyId,
              role: 'MEMBER',
            }),
            count: jest.fn().mockResolvedValue(2), // Not last admin
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(mockNewFamily),
          },
        }) as any;
      });

      const result = await invitationService.acceptFamilyInvitation(
        inviteCode, 
        userId, 
        { leaveCurrentFamily: true },
      );

      expect(result.success).toBe(true);

      // Should emit two events: member left old family and member joined new family
      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledTimes(2);
      
      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenNthCalledWith(
        1,
        oldFamilyId,
        'memberLeft',
        expect.objectContaining({
          userId,
          action: 'leftForNewFamily',
          leftTo: newFamilyId,
        }),
      );

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenNthCalledWith(
        2,
        newFamilyId,
        'memberJoined',
        expect.objectContaining({
          userId,
          action: 'invitationAccepted',
          invitationId: mockInvitation.id,
          role: 'MEMBER',
        }),
      );
    });

    it('should not emit events when invitation is invalid', async () => {
      const inviteCode = 'invalid-invite';
      const userId = 'user-456';

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(null), // No invitation found
          },
          user: {
            findUnique: jest.fn(),
          },
          familyMember: {
            findFirst: jest.fn(),
          },
        }) as any;
      });

      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid invitation code');
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });

    it('should not emit events when invitation is expired', async () => {
      const inviteCode = 'expired-invite';
      const userId = 'user-456';

      const mockExpiredInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId: 'family-789',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 86400000), // Expired 24 hours ago
        family: {
          id: 'family-789',
          name: 'Test Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockExpiredInvitation),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn(),
          },
        }) as any;
      });

      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invitation has expired');
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });

    it('should not allow last admin to leave their family via invitation', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const currentFamilyId = 'family-999';
      const newFamilyId = 'family-789';

      const mockInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId: newFamilyId,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        family: {
          id: newFamilyId,
          name: 'New Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockExistingMembership = {
        id: 'membership-456',
        userId,
        familyId: currentFamilyId,
        role: 'ADMIN',
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(mockExistingMembership),
            count: jest.fn().mockResolvedValue(1), // Last admin
          },
        }) as any;
      });

      const result = await invitationService.acceptFamilyInvitation(
        inviteCode, 
        userId, 
        { leaveCurrentFamily: true },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot leave family as you are the last administrator');
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Event Data Structure Validation', () => {
    it('should include all required fields in FAMILY_MEMBER_JOINED event', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const familyId = 'family-789';
      const invitationId = 'invitation-123';
      const role = 'MEMBER';

      const mockInvitation = {
        id: invitationId,
        inviteCode,
        familyId,
        role,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        family: {
          id: familyId,
          name: 'Test Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockFamily = {
        id: familyId,
        name: 'Test Family',
        members: [{ userId, role }],
        children: [],
        vehicles: [],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
            update: jest.fn().mockResolvedValue({
              ...mockInvitation,
              status: 'ACCEPTED',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              userId,
              familyId,
              role,
            }),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(mockFamily),
          },
        }) as any;
      });

      await invitationService.acceptFamilyInvitation(inviteCode, userId);

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalledWith(
        familyId,
        'memberJoined',
        {
          userId,
          action: 'invitationAccepted',
          invitationId,
          role,
        },
      );
    });

    it('should include all required fields in FAMILY_MEMBER_LEFT event', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const oldFamilyId = 'family-999';
      const newFamilyId = 'family-789';

      const mockInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId: newFamilyId,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        family: {
          id: newFamilyId,
          name: 'New Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockExistingMembership = {
        id: 'membership-456',
        userId,
        familyId: oldFamilyId,
        role: 'MEMBER',
      };

      const mockNewFamily = {
        id: newFamilyId,
        name: 'New Family',
        members: [{ userId, role: 'MEMBER' }],
        children: [],
        vehicles: [],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
            update: jest.fn().mockResolvedValue({
              ...mockInvitation,
              status: 'ACCEPTED',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(mockExistingMembership),
            delete: jest.fn().mockResolvedValue(mockExistingMembership),
            create: jest.fn().mockResolvedValue({
              userId,
              familyId: newFamilyId,
              role: 'MEMBER',
            }),
            count: jest.fn().mockResolvedValue(2),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(mockNewFamily),
          },
        }) as any;
      });

      await invitationService.acceptFamilyInvitation(
        inviteCode, 
        userId, 
        { leaveCurrentFamily: true },
      );

      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenNthCalledWith(
        1,
        oldFamilyId,
        'memberLeft',
        {
          userId,
          action: 'leftForNewFamily',
          leftTo: newFamilyId,
        },
      );
    });
  });

  describe('Error Handling with Socket Events', () => {
    it('should handle missing socket handler gracefully', async () => {
      setGlobalSocketHandler(null);

      const inviteCode = 'invite-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockInvitation = {
        id: 'invitation-123',
        inviteCode,
        familyId,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        family: {
          id: familyId,
          name: 'Test Family',
        },
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockFamily = {
        id: familyId,
        name: 'Test Family',
        members: [{ userId, role: 'MEMBER' }],
        children: [],
        vehicles: [],
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<any>) => {
        return await callback({
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(mockInvitation),
            update: jest.fn().mockResolvedValue({
              ...mockInvitation,
              status: 'ACCEPTED',
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              userId,
              familyId,
              role: 'MEMBER',
            }),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(mockFamily),
          },
        }) as any;
      });

      // Should not throw error even without socket handler
      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);
      expect(result.success).toBe(true);

      // SocketEmitter should still be called (it handles null socket handler internally)
      expect(mockSocketEmitter.broadcastFamilyUpdate).toHaveBeenCalled();
    });

    it('should not emit events when database transaction fails', async () => {
      const inviteCode = 'invite-123';
      const userId = 'user-456';

      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(mockSocketEmitter.broadcastFamilyUpdate).not.toHaveBeenCalled();
    });
  });
});