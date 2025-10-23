import { InvitationCleanupService } from '../InvitationCleanupService';

describe('InvitationCleanupService - Duplicate Invitation Fix', () => {
  let cleanupService: InvitationCleanupService;
  let mockPrisma: any;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      groupInvitation: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      familyInvitation: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    cleanupService = new InvitationCleanupService(mockPrisma, mockLogger);
    jest.clearAllMocks();
  });

  describe('cleanupOldInvitation', () => {
    it('should remove CANCELLED group invitation', async () => {
      const existingInvitation = {
        id: 'invitation-123',
        groupId: 'group-123',
        email: 'test@example.com',
        status: 'CANCELLED',
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(existingInvitation);
      mockPrisma.groupInvitation.delete.mockResolvedValue(existingInvitation);

      const result = await cleanupService.cleanupOldInvitation('group', 'group-123', 'test@example.com');

      expect(result).toBe(true);
      expect(mockPrisma.groupInvitation.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'group-123',
          email: 'test@example.com',
          status: { in: ['CANCELLED', 'EXPIRED'] },
        },
      });
      expect(mockPrisma.groupInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed old CANCELLED group invitation for test@example.com to allow re-invitation',
      );
    });

    it('should remove EXPIRED group invitation', async () => {
      const existingInvitation = {
        id: 'invitation-123',
        groupId: 'group-123',
        email: 'test@example.com',
        status: 'EXPIRED',
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(existingInvitation);
      mockPrisma.groupInvitation.delete.mockResolvedValue(existingInvitation);

      const result = await cleanupService.cleanupOldInvitation('group', 'group-123', 'test@example.com');

      expect(result).toBe(true);
      expect(mockPrisma.groupInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
      });
    });

    it('should remove CANCELLED group invitation', async () => {
      const existingInvitation = {
        id: 'invitation-123',
        groupId: 'group-123',
        email: 'test@example.com',
        status: 'CANCELLED',
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(existingInvitation);
      mockPrisma.groupInvitation.delete.mockResolvedValue(existingInvitation);

      const result = await cleanupService.cleanupOldInvitation('group', 'group-123', 'test@example.com');

      expect(result).toBe(true);
      expect(mockPrisma.groupInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
      });
    });

    it('should handle no existing invitation', async () => {
      mockPrisma.groupInvitation.findFirst.mockResolvedValue(null);

      const result = await cleanupService.cleanupOldInvitation('group', 'group-123', 'test@example.com');

      expect(result).toBe(false);
      expect(mockPrisma.groupInvitation.delete).not.toHaveBeenCalled();
    });

    it('should handle family invitations the same way', async () => {
      const existingInvitation = {
        id: 'invitation-123',
        familyId: 'family-123',
        email: 'test@example.com',
        status: 'PENDING',
      };

      mockPrisma.familyInvitation.findFirst.mockResolvedValue(existingInvitation);
      mockPrisma.familyInvitation.delete.mockResolvedValue(existingInvitation);

      const result = await cleanupService.cleanupOldInvitation('family', 'family-123', 'test@example.com');

      expect(result).toBe(true);
      expect(mockPrisma.familyInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
      });
    });
  });
});