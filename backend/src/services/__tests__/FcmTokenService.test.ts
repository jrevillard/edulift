import { FcmTokenService } from '../FcmTokenService';
import { FcmTokenData } from '../../types/PushNotificationInterface';

// Mock PrismaClient
const mockPrismaClient = {
  fcmToken: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('FcmTokenService', () => {
  let fcmTokenService: FcmTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    fcmTokenService = new FcmTokenService(mockPrismaClient as any);
  });

  describe('saveToken', () => {
    const mockTokenData: FcmTokenData = {
      userId: 'user-1',
      token: 'fcm-token-123',
      deviceId: 'device-1',
      platform: 'android',
    };

    it('should create new token when token does not exist', async () => {
      mockPrismaClient.fcmToken.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.fcmToken.create.mockResolvedValueOnce({
        id: 'token-id-1',
        userId: 'user-1',
        token: 'fcm-token-123',
        deviceId: 'device-1',
        platform: 'android',
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await fcmTokenService.saveToken(mockTokenData);

      expect(result.userId).toBe('user-1');
      expect(result.token).toBe('fcm-token-123');
      expect(mockPrismaClient.fcmToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: 'fcm-token-123',
          deviceId: 'device-1',
          platform: 'android',
          isActive: true,
        }),
      });
    });

    it('should update existing token', async () => {
      mockPrismaClient.fcmToken.findUnique.mockResolvedValueOnce({
        id: 'existing-token-id',
        token: 'fcm-token-123',
      });
      mockPrismaClient.fcmToken.update.mockResolvedValueOnce({
        id: 'existing-token-id',
        userId: 'user-1',
        token: 'fcm-token-123',
        deviceId: 'device-1',
        platform: 'android',
        isActive: true,
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await fcmTokenService.saveToken(mockTokenData);

      expect(result.token).toBe('fcm-token-123');
      expect(mockPrismaClient.fcmToken.update).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123' },
        data: expect.objectContaining({
          userId: 'user-1',
          deviceId: 'device-1',
          platform: 'android',
          isActive: true,
        }),
      });
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.findUnique.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.saveToken(mockTokenData)).rejects.toThrow('Failed to save FCM token');
    });
  });

  describe('getUserTokens', () => {
    it('should return active tokens for a user', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'fcm-token-1',
          platform: 'android',
          isActive: true,
          lastUsed: new Date(),
        },
        {
          id: 'token-2',
          userId: 'user-1',
          token: 'fcm-token-2',
          platform: 'ios',
          isActive: true,
          lastUsed: new Date(),
        },
      ];

      mockPrismaClient.fcmToken.findMany.mockResolvedValueOnce(mockTokens);

      const result = await fcmTokenService.getUserTokens('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].platform).toBe('android');
      expect(result[1].platform).toBe('ios');
      expect(mockPrismaClient.fcmToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        orderBy: { lastUsed: 'desc' },
      });
    });

    it('should return empty array when user has no tokens', async () => {
      mockPrismaClient.fcmToken.findMany.mockResolvedValueOnce([]);

      const result = await fcmTokenService.getUserTokens('user-1');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.findMany.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.getUserTokens('user-1')).rejects.toThrow('Failed to retrieve user tokens');
    });
  });

  describe('getUsersTokens', () => {
    it('should return tokens for multiple users', async () => {
      const mockTokens = [
        { id: 'token-1', userId: 'user-1', token: 'fcm-token-1', platform: 'android' },
        { id: 'token-2', userId: 'user-2', token: 'fcm-token-2', platform: 'ios' },
      ];

      mockPrismaClient.fcmToken.findMany.mockResolvedValueOnce(mockTokens);

      const result = await fcmTokenService.getUsersTokens(['user-1', 'user-2']);

      expect(result).toHaveLength(2);
      expect(mockPrismaClient.fcmToken.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ['user-1', 'user-2'] }, isActive: true },
        orderBy: { lastUsed: 'desc' },
      });
    });

    it('should return empty array for empty user ID array', async () => {
      const result = await fcmTokenService.getUsersTokens([]);

      expect(result).toEqual([]);
      expect(mockPrismaClient.fcmToken.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deactivateToken', () => {
    it('should deactivate a single token', async () => {
      mockPrismaClient.fcmToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await fcmTokenService.deactivateToken('fcm-token-123');

      expect(mockPrismaClient.fcmToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123' },
        data: { 
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.updateMany.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.deactivateToken('fcm-token-123')).rejects.toThrow('Failed to deactivate token');
    });
  });

  describe('deactivateTokens', () => {
    it('should deactivate multiple tokens', async () => {
      mockPrismaClient.fcmToken.updateMany.mockResolvedValueOnce({ count: 2 });

      await fcmTokenService.deactivateTokens(['token-1', 'token-2']);

      expect(mockPrismaClient.fcmToken.updateMany).toHaveBeenCalledWith({
        where: { token: { in: ['token-1', 'token-2'] } },
        data: { 
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle empty token array', async () => {
      await fcmTokenService.deactivateTokens([]);

      expect(mockPrismaClient.fcmToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteToken', () => {
    it('should delete a token', async () => {
      mockPrismaClient.fcmToken.deleteMany.mockResolvedValueOnce({ count: 1 });

      await fcmTokenService.deleteToken('fcm-token-123');

      expect(mockPrismaClient.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123' },
      });
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.deleteMany.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.deleteToken('fcm-token-123')).rejects.toThrow('Failed to delete token');
    });
  });

  describe('cleanupInactiveTokens', () => {
    it('should cleanup tokens older than specified days', async () => {
      mockPrismaClient.fcmToken.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await fcmTokenService.cleanupInactiveTokens(30);

      expect(result).toBe(5);
      expect(mockPrismaClient.fcmToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { isActive: false },
            { lastUsed: { lt: expect.any(Date) } },
          ],
        },
      });
    });

    it('should use default cleanup period when not specified', async () => {
      mockPrismaClient.fcmToken.deleteMany.mockResolvedValueOnce({ count: 3 });

      await fcmTokenService.cleanupInactiveTokens();

      expect(mockPrismaClient.fcmToken.deleteMany).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.deleteMany.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.cleanupInactiveTokens()).rejects.toThrow('Failed to cleanup inactive tokens');
    });
  });

  describe('updateTokenLastUsed', () => {
    it('should update token last used timestamp', async () => {
      mockPrismaClient.fcmToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await fcmTokenService.updateTokenLastUsed('fcm-token-123');

      expect(mockPrismaClient.fcmToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'fcm-token-123', isActive: true },
        data: { lastUsed: expect.any(Date) },
      });
    });

    it('should not throw error on database failure', async () => {
      mockPrismaClient.fcmToken.updateMany.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await fcmTokenService.updateTokenLastUsed('fcm-token-123');
    });
  });

  describe('getTokenStats', () => {
    it('should return token statistics', async () => {
      mockPrismaClient.fcmToken.count
        .mockResolvedValueOnce(10) // totalTokens
        .mockResolvedValueOnce(8)  // activeTokens
        .mockResolvedValueOnce(2); // inactiveTokens

      mockPrismaClient.fcmToken.groupBy.mockResolvedValueOnce([
        { platform: 'android', _count: 5 },
        { platform: 'ios', _count: 3 },
      ]);

      const stats = await fcmTokenService.getTokenStats();

      expect(stats.totalTokens).toBe(10);
      expect(stats.activeTokens).toBe(8);
      expect(stats.inactiveTokens).toBe(2);
      expect(stats.tokensByPlatform).toEqual({
        android: 5,
        ios: 3,
      });
    });

    it('should handle database errors', async () => {
      mockPrismaClient.fcmToken.count.mockRejectedValueOnce(new Error('Database error'));

      await expect(fcmTokenService.getTokenStats()).rejects.toThrow('Failed to retrieve token statistics');
    });
  });
});