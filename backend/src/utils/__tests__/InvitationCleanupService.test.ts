import { InvitationCleanupService } from '../InvitationCleanupService';

describe('InvitationCleanupService', () => {
  let prisma: any;
  let cleanupService: InvitationCleanupService;
  let mockLogger: any;

  beforeEach(() => {
    prisma = {
      familyInvitation: {
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      groupInvitation: {
        deleteMany: jest.fn(),
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

    cleanupService = new InvitationCleanupService(prisma, mockLogger);
  });

  describe('cleanupFamilyInvitations', () => {
    it('should clean up expired and old cancelled family invitations', async () => {
      const mockExpiredResult = { count: 3 };
      const mockOldCancelledResult = { count: 2 };
      
      (prisma.familyInvitation.deleteMany as jest.Mock)
        .mockResolvedValueOnce(mockExpiredResult)
        .mockResolvedValueOnce(mockOldCancelledResult);

      const result = await cleanupService.cleanupFamilyInvitations('family-1');

      expect(result).toEqual({ expired: 3, oldCancelled: 2 });
      expect(prisma.familyInvitation.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up 3 expired and 2 old cancelled family invitations for family family-1'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Database error');
      (prisma.familyInvitation.deleteMany as jest.Mock).mockRejectedValue(error);

      const result = await cleanupService.cleanupFamilyInvitations('family-1');

      expect(result).toEqual({ expired: 0, oldCancelled: 0 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup family invitations for family family-1:',
        error
      );
    });

    it('should not log when no invitations are deleted', async () => {
      (prisma.familyInvitation.deleteMany as jest.Mock)
        .mockResolvedValue({ count: 0 });

      await cleanupService.cleanupFamilyInvitations('family-1');

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('cleanupGroupInvitations', () => {
    it('should clean up expired and old cancelled group invitations', async () => {
      const mockExpiredResult = { count: 1 };
      const mockOldCancelledResult = { count: 4 };
      
      (prisma.groupInvitation.deleteMany as jest.Mock)
        .mockResolvedValueOnce(mockExpiredResult)
        .mockResolvedValueOnce(mockOldCancelledResult);

      const result = await cleanupService.cleanupGroupInvitations('group-1');

      expect(result).toEqual({ expired: 1, oldCancelled: 4 });
      expect(prisma.groupInvitation.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up 1 expired and 4 old cancelled group invitations for group group-1'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Database error');
      (prisma.groupInvitation.deleteMany as jest.Mock).mockRejectedValue(error);

      const result = await cleanupService.cleanupGroupInvitations('group-1');

      expect(result).toEqual({ expired: 0, oldCancelled: 0 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup group invitations for group group-1:',
        error
      );
    });
  });

  describe('cleanupAllFamilyInvitations', () => {
    it('should perform global family invitation cleanup', async () => {
      const mockExpiredResult = { count: 5 };
      const mockOldCancelledResult = { count: 3 };
      
      (prisma.familyInvitation.deleteMany as jest.Mock)
        .mockResolvedValueOnce(mockExpiredResult)
        .mockResolvedValueOnce(mockOldCancelledResult);

      const result = await cleanupService.cleanupAllFamilyInvitations();

      expect(result).toEqual({ expired: 5, oldCancelled: 3 });
      expect(mockLogger.info).toHaveBeenCalledWith('Starting global family invitation cleanup');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Global family cleanup completed: removed 5 expired and 3 old cancelled invitations'
      );
    });

    it('should throw error on global cleanup failure', async () => {
      const error = new Error('Global cleanup failed');
      (prisma.familyInvitation.deleteMany as jest.Mock).mockRejectedValue(error);

      await expect(cleanupService.cleanupAllFamilyInvitations()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to perform global family invitation cleanup:',
        error
      );
    });
  });

  describe('cleanupAllGroupInvitations', () => {
    it('should perform global group invitation cleanup', async () => {
      const mockExpiredResult = { count: 2 };
      const mockOldCancelledResult = { count: 1 };
      
      (prisma.groupInvitation.deleteMany as jest.Mock)
        .mockResolvedValueOnce(mockExpiredResult)
        .mockResolvedValueOnce(mockOldCancelledResult);

      const result = await cleanupService.cleanupAllGroupInvitations();

      expect(result).toEqual({ expired: 2, oldCancelled: 1 });
      expect(mockLogger.info).toHaveBeenCalledWith('Starting global group invitation cleanup');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Global group cleanup completed: removed 2 expired and 1 old cancelled invitations'
      );
    });
  });

  describe('cleanupAllInvitations', () => {
    it('should perform comprehensive cleanup for both families and groups', async () => {
      (prisma.familyInvitation.deleteMany as jest.Mock)
        .mockResolvedValue({ count: 3 });
      (prisma.groupInvitation.deleteMany as jest.Mock)
        .mockResolvedValue({ count: 2 });

      const result = await cleanupService.cleanupAllInvitations();

      expect(result).toEqual({
        families: { expired: 3, oldCancelled: 3 },
        groups: { expired: 2, oldCancelled: 2 }
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting comprehensive invitation cleanup for all families and groups'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Comprehensive cleanup completed: 5 expired and 5 old cancelled invitations removed across all families and groups'
      );
    });
  });

  describe('cleanupOldInvitation', () => {
    it('should remove old family invitation when status is CANCELLED', async () => {
      const mockInvitation = {
        id: 'inv-1',
        status: 'CANCELLED',
        email: 'test@example.com'
      };
      
      (prisma.familyInvitation.findFirst as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.familyInvitation.delete as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await cleanupService.cleanupOldInvitation('family', 'family-1', 'test@example.com');

      expect(result).toBe(true);
      expect(prisma.familyInvitation.findFirst).toHaveBeenCalledWith({
        where: { 
          familyId: 'family-1', 
          email: 'test@example.com',
          status: { in: ['CANCELLED', 'EXPIRED'] }
        }
      });
      expect(prisma.familyInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv-1' }
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed old CANCELLED family invitation for test@example.com to allow re-invitation'
      );
    });

    it('should remove old group invitation when status is EXPIRED', async () => {
      const mockInvitation = {
        id: 'inv-2',
        status: 'EXPIRED',
        email: 'test@example.com'
      };
      
      (prisma.groupInvitation.findFirst as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.groupInvitation.delete as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await cleanupService.cleanupOldInvitation('group', 'group-1', 'test@example.com');

      expect(result).toBe(true);
      expect(prisma.groupInvitation.findFirst).toHaveBeenCalledWith({
        where: { 
          groupId: 'group-1', 
          email: 'test@example.com',
          status: { in: ['CANCELLED', 'EXPIRED'] }
        }
      });
      expect(prisma.groupInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv-2' }
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed old EXPIRED group invitation for test@example.com to allow re-invitation'
      );
    });

    it('should remove invitation when status is PENDING (duplicate fix)', async () => {
      const mockInvitation = {
        id: 'inv-3',
        status: 'PENDING',
        email: 'test@example.com'
      };
      
      (prisma.familyInvitation.findFirst as jest.Mock).mockResolvedValue(mockInvitation);
      (prisma.familyInvitation.delete as jest.Mock).mockResolvedValue(mockInvitation);

      const result = await cleanupService.cleanupOldInvitation('family', 'family-1', 'test@example.com');

      expect(result).toBe(true);
      expect(prisma.familyInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv-3' }
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed old PENDING family invitation for test@example.com to allow re-invitation'
      );
    });

    it('should return false when no invitation exists', async () => {
      (prisma.familyInvitation.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await cleanupService.cleanupOldInvitation('family', 'family-1', 'test@example.com');

      expect(result).toBe(false);
      expect(prisma.familyInvitation.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      (prisma.familyInvitation.findFirst as jest.Mock).mockRejectedValue(error);

      const result = await cleanupService.cleanupOldInvitation('family', 'family-1', 'test@example.com');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup old family invitation for test@example.com:',
        error
      );
    });
  });

  describe('configuration', () => {
    it('should use custom retention period', () => {
      const customService = new InvitationCleanupService(
        prisma,
        mockLogger,
        { retentionDays: 60 }
      );

      expect(customService).toBeDefined();
      // The retention period is used internally in the cleanup methods
    });

    it('should use default retention period when not specified', () => {
      const defaultService = new InvitationCleanupService(prisma, mockLogger);
      expect(defaultService).toBeDefined();
    });
  });
});