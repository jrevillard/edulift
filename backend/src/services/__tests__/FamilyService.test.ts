import { FamilyService } from '../FamilyService';
import { FamilyError, FamilyRole } from '../../types/family';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  $transaction: jest.fn(),
  family: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  familyMember: {
    create: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
} as any;

// Mock NotificationService
const mockNotificationService = {
  emailService: {},
  userRepository: {},
  scheduleSlotRepository: {},
  prisma: {},
  processEmailJob: jest.fn(),
  scheduleNotification: jest.fn(),
  cancelNotification: jest.fn(),
  getAllPendingNotifications: jest.fn(),
  processPendingNotifications: jest.fn(),
  handleEmail: jest.fn(),
  handlePush: jest.fn(),
  handleSms: jest.fn(),
  createNotificationLog: jest.fn(),
} as any;

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('FamilyService', () => {
  let familyService: FamilyService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    familyService = new FamilyService(
      mockPrisma as PrismaClient,
      mockLogger,
      mockNotificationService,
    );
  });

  describe('createFamily', () => {
    const userId = 'user-123';
    const familyName = 'Famille Test';

    it('should create family and add user as admin', async () => {
      // Setup mocks
      const mockFamily = {
        id: 'family-123',
        name: familyName,
        inviteCode: 'TEST1234',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFamilyWithMembers = {
        ...mockFamily,
        members: [{
          id: 'member-123',
          familyId: 'family-123',
          userId,
          role: FamilyRole.ADMIN,
          joinedAt: new Date(),
          user: { id: userId, name: 'Test User', email: 'test@example.com' },
        }],
        children: [],
        vehicles: [],
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(1),
          },
          family: {
            create: jest.fn().mockResolvedValue(mockFamily),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockFamilyWithMembers),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(mockFamilyWithMembers);

      // Execute
      const result = await familyService.createFamily(userId, familyName);

      // Assertions
      expect(result).toEqual(mockFamilyWithMembers);
      expect(result.name).toBe(familyName);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBe(FamilyRole.ADMIN);
      expect(result.members[0].userId).toBe(userId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Creating family for user ${userId}`,
        { name: familyName },
      );
    });

    it('should throw error if user already has family', async () => {
      // Mock transaction with existing membership
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing-membership' }),
            count: jest.fn().mockResolvedValue(1),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.createFamily(userId, familyName))
        .rejects
        .toThrow(new FamilyError('USER_ALREADY_IN_FAMILY', 'You are already a member of a family'));
    });

    it('should trim family name and generate invite code', async () => {
      const familyNameWithSpaces = '  Famille Test  ';
      
      // Setup mocks similar to first test
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(1),
          },
          family: {
            create: jest.fn().mockResolvedValue({
              id: 'family-123',
              name: 'Famille Test', // trimmed
              inviteCode: 'TEST1234',
            }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'family-123',
              name: 'Famille Test',
              inviteCode: 'TEST1234',
              members: [],
              children: [],
              vehicles: [],
            }),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue({
        id: 'family-123',
        name: 'Famille Test',
        inviteCode: 'TEST1234',
        members: [],
        children: [],
        vehicles: [],
      });

      // Execute
      await familyService.createFamily(userId, familyNameWithSpaces);

      // Note: Invite codes are no longer generated automatically with the unified invitation system
    });
  });

  // Note: joinFamily tests commented out as invitation logic is now tested in UnifiedInvitationService.test.ts
  /*
  describe('joinFamily', () => {
    const userId = 'user-456';
    const inviteCode = 'INVITE123';

    it('should add user to family with MEMBER role', async () => {
      const mockFamily = {
        id: 'family-123',
        name: 'Test Family',
        inviteCode,
        members: [
          { id: 'member-1', userId: 'admin-user', role: FamilyRole.ADMIN }
        ]
      };

      const mockFamilyWithNewMember = {
        ...mockFamily,
        members: [
          ...mockFamily.members,
          {
            id: 'member-456',
            familyId: 'family-123',
            userId,
            role: FamilyRole.MEMBER,
            joinedAt: new Date(),
            user: { id: userId, name: 'New User', email: 'new@example.com' }
          }
        ],
        children: [],
        vehicles: []
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(2)
          },
          family: {
            findFirst: jest.fn().mockResolvedValue(mockFamily),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockFamilyWithNewMember)
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ id: userId, email: 'test@example.com' })
          },
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(null), // No pending invitation by default
            update: jest.fn().mockResolvedValue({})
          }
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);
      mockPrisma.family.findUniqueOrThrow.mockResolvedValue(mockFamilyWithNewMember);

      // Execute
      const result = await familyService.joinFamily(userId, inviteCode) as unknown as Family;

      // Assertions
      expect(result).toEqual(mockFamilyWithNewMember);
      expect(result.members.find((m: unknown) => m.userId === userId)?.role).toBe(FamilyRole.MEMBER);
    });

    it('should throw error for invalid invite code', async () => {
      // Mock transaction with no family found
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(0)
          },
          family: {
            findFirst: jest.fn().mockResolvedValue(null)
          }
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.joinFamily(userId, 'INVALID'))
        .rejects
        .toThrow(new FamilyError('INVALID_INVITE_CODE', 'Invalid or expired invite code'));
    });

    it('should throw error if family is full', async () => {
      const fullFamily = {
        id: 'family-123',
        inviteCode,
        members: new Array(6).fill(null).map((_, i) => ({ id: `member-${i}` }))
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockResolvedValue(6)
          },
          family: {
            findFirst: jest.fn().mockResolvedValue(fullFamily)
          }
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.joinFamily(userId, inviteCode))
        .rejects
        .toThrow(new FamilyError('FAMILY_FULL', 'Family has reached maximum member limit'));
    });
  });
  */

  describe('removeMember', () => {
    const adminId = 'admin-123';
    const memberId = 'member-456';
    const familyId = 'family-789';

    it('should remove member successfully', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target member
                id: memberId,
                familyId,
                userId: 'target-user-123',
                role: FamilyRole.MEMBER,
              }),
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.removeMember(adminId, memberId);

      // Assertions
      expect(mockLogger.info).toHaveBeenCalledWith(`Admin ${adminId} removing member ${memberId}`);
      expect(mockLogger.info).toHaveBeenCalledWith(`Member ${memberId} removed from family`);
    });

    it('should throw error if admin is not found', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null), // No admin found
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.removeMember(adminId, memberId))
        .rejects
        .toThrow(new FamilyError('UNAUTHORIZED', 'User is not a family admin'));
    });

    it('should throw error if target member is not found', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member found
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce(null), // Target member not found
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.removeMember(adminId, memberId))
        .rejects
        .toThrow(new FamilyError('MEMBER_NOT_FOUND', 'Member not found in family'));
    });

    it('should throw error if admin tries to remove themselves', async () => {
      const selfMemberId = 'admin-member-123';
      
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target member (same as admin)
                id: selfMemberId,
                familyId,
                userId: adminId, // Same user ID as admin
                role: FamilyRole.ADMIN,
              }),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.removeMember(adminId, selfMemberId))
        .rejects
        .toThrow(new FamilyError('CANNOT_REMOVE_SELF', 'Admin cannot remove themselves'));
    });

    it('should allow removing a regular member', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target member (regular member)
                id: memberId,
                familyId,
                userId: 'regular-user-456',
                role: FamilyRole.MEMBER,
              }),
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.removeMember(adminId, memberId);

      // Should complete successfully without throwing
      expect(mockLogger.info).toHaveBeenCalledWith(`Member ${memberId} removed from family`);
    });

    it('should allow admin to remove another admin when multiple admins exist', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target admin to be removed
                id: memberId,
                familyId,
                userId: 'other-admin-456',
                role: FamilyRole.ADMIN,
              }),
            count: jest.fn().mockResolvedValue(2), // 2 admins in family
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.removeMember(adminId, memberId);

      // Should complete successfully
      expect(mockLogger.info).toHaveBeenCalledWith(`Member ${memberId} removed from family`);
    });

    it('should prevent removing the last admin', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target admin to be removed (last admin)
                id: memberId,
                familyId,
                userId: 'other-admin-456',
                role: FamilyRole.ADMIN,
              }),
            count: jest.fn().mockResolvedValue(1), // Only 1 admin in family
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.removeMember(adminId, memberId))
        .rejects
        .toThrow(new FamilyError('LAST_ADMIN', 'Cannot remove the last admin from family'));
    });
  });

  describe('updateMemberRole', () => {
    const adminId = 'admin-123';
    const memberId = 'member-456';
    const familyId = 'family-789';

    it('should prevent admin from demoting themselves', async () => {
      const adminMemberId = 'admin-member-123';
      
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: adminMemberId,
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target member (same admin)
                id: adminMemberId,
                familyId,
                userId: adminId, // Same user as admin
                role: FamilyRole.ADMIN,
              }),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.updateMemberRole(adminId, adminMemberId, FamilyRole.MEMBER))
        .rejects
        .toThrow(new FamilyError('CANNOT_DEMOTE_SELF', 'You cannot change your own admin role'));
    });

    it('should prevent removing the last admin', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target admin to be demoted
                id: memberId,
                familyId,
                userId: 'other-admin-456',
                role: FamilyRole.ADMIN,
              }),
            count: jest.fn().mockResolvedValue(1), // Only 1 admin in family
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.updateMemberRole(adminId, memberId, FamilyRole.MEMBER))
        .rejects
        .toThrow(new FamilyError('LAST_ADMIN', 'Cannot remove the last admin from family'));
    });

    it('should allow demoting admin when multiple admins exist', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ // Admin member
                id: 'admin-member-123',
                familyId,
                userId: adminId,
                role: FamilyRole.ADMIN,
              })
              .mockResolvedValueOnce({ // Target admin to be demoted
                id: memberId,
                familyId,
                userId: 'other-admin-456',
                role: FamilyRole.ADMIN,
              }),
            count: jest.fn().mockResolvedValue(2), // 2 admins in family
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.updateMemberRole(adminId, memberId, FamilyRole.MEMBER);

      // Should complete successfully
      expect(mockLogger.info).toHaveBeenCalledWith(`Member ${memberId} role updated to ${FamilyRole.MEMBER}`);
    });
  });

  describe('getUserFamily', () => {
    it('should return user family with all relations', async () => {
      const userId = 'user-123';
      const mockFamily = {
        id: 'family-123',
        name: 'Test Family',
        inviteCode: 'CODE123',
        members: [],
        children: [],
        vehicles: [],
      };

      mockPrisma.family.findFirst = jest.fn().mockResolvedValue(mockFamily);

      const result = await familyService.getUserFamily(userId);

      expect(result).toEqual(mockFamily);
      expect(mockPrisma.family.findFirst).toHaveBeenCalledWith({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            include: { user: true },
          },
          children: true,
          vehicles: true,
        },
      });
    });

    it('should return null if user has no family', async () => {
      mockPrisma.family.findFirst = jest.fn().mockResolvedValue(null);

      const result = await familyService.getUserFamily('user-123');

      expect(result).toBeNull();
    });
  });

  describe('leaveFamily', () => {
    const userId = 'user-123';

    it('should allow regular member to leave family', async () => {
      const memberRecord = {
        id: 'member-456',
        userId,
        familyId: 'family-123',
        role: FamilyRole.MEMBER,
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(memberRecord),
            count: jest.fn().mockResolvedValue(2), // Not relevant for members
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.leaveFamily(userId);

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`User ${userId} left family ${memberRecord.familyId}`);
    });

    it('should allow admin to leave family if not the last admin', async () => {
      const adminRecord = {
        id: 'member-456',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN,
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(adminRecord),
            count: jest.fn().mockResolvedValue(2), // 2 admins, safe to leave
            delete: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute
      await familyService.leaveFamily(userId);

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`User ${userId} left family ${adminRecord.familyId}`);
    });

    it('should prevent last admin from leaving family', async () => {
      const lastAdminRecord = {
        id: 'member-456',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN,
      };

      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(lastAdminRecord),
            count: jest.fn().mockResolvedValue(1), // Only 1 admin
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.leaveFamily(userId))
        .rejects
        .toThrow(new FamilyError('LAST_ADMIN', 'Cannot leave family as you are the last administrator. Please appoint another admin first.'));
    });

    it('should throw error if user is not a family member', async () => {
      // Mock transaction
      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null), // No membership found
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      // Execute & Assert
      await expect(familyService.leaveFamily(userId))
        .rejects
        .toThrow(new FamilyError('NOT_FAMILY_MEMBER', 'User is not a member of any family'));
    });
  });
});