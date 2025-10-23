// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { FcmTokenServiceInterface, FcmTokenData } from '../types/PushNotificationInterface';

export class FcmTokenService implements FcmTokenServiceInterface {
  constructor(private prisma: PrismaClient) {}

  async saveToken(tokenData: FcmTokenData): Promise<FcmTokenData> {
    try {
      // Check if token already exists
      const existingToken = await this.prisma.fcmToken.findUnique({
        where: { token: tokenData.token },
      });

      if (existingToken) {
        // Update existing token
        const updated = await this.prisma.fcmToken.update({
          where: { token: tokenData.token },
          data: {
            userId: tokenData.userId,
            deviceId: tokenData.deviceId ?? null,
            platform: tokenData.platform,
            isActive: tokenData.isActive ?? true,
            lastUsed: tokenData.lastUsed || new Date(),
          },
        });

        return this.mapPrismaToTokenData(updated);
      } else {
        // Create new token
        const created = await this.prisma.fcmToken.create({
          data: {
            userId: tokenData.userId,
            token: tokenData.token,
            deviceId: tokenData.deviceId ?? null,
            platform: tokenData.platform,
            isActive: tokenData.isActive ?? true,
            lastUsed: tokenData.lastUsed || new Date(),
          },
        });

        return this.mapPrismaToTokenData(created);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to save FCM token:', error);
      }
      throw new Error('Failed to save FCM token');
    }
  }

  async getUserTokens(userId: string): Promise<FcmTokenData[]> {
    try {
      const tokens = await this.prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: {
          lastUsed: 'desc',
        },
      });

      return tokens.map(token => this.mapPrismaToTokenData(token));
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to get tokens for user ${userId}:`, error);
      }
      throw new Error('Failed to retrieve user tokens');
    }
  }

  async getUsersTokens(userIds: string[]): Promise<FcmTokenData[]> {
    if (userIds.length === 0) {
      return [];
    }

    try {
      const tokens = await this.prisma.fcmToken.findMany({
        where: {
          userId: { in: userIds },
          isActive: true,
        },
        orderBy: {
          lastUsed: 'desc',
        },
      });

      return tokens.map(token => this.mapPrismaToTokenData(token));
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to get tokens for users:', error);
      }
      throw new Error('Failed to retrieve users tokens');
    }
  }

  async deactivateToken(token: string): Promise<void> {
    try {
      await this.prisma.fcmToken.updateMany({
        where: { token },
        data: { 
          isActive: false,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to deactivate token ${token}:`, error);
      }
      throw new Error('Failed to deactivate token');
    }
  }

  async deactivateTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    try {
      await this.prisma.fcmToken.updateMany({
        where: { 
          token: { in: tokens },
        },
        data: { 
          isActive: false,
          updatedAt: new Date(),
        },
      });
      
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Deactivated ${tokens.length} FCM tokens`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to deactivate tokens:', error);
      }
      throw new Error('Failed to deactivate tokens');
    }
  }

  async deleteToken(token: string): Promise<void> {
    try {
      await this.prisma.fcmToken.deleteMany({
        where: { token },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to delete token ${token}:`, error);
      }
      throw new Error('Failed to delete token');
    }
  }

  async cleanupInactiveTokens(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.fcmToken.deleteMany({
        where: {
          OR: [
            { isActive: false },
            { lastUsed: { lt: cutoffDate } },
          ],
        },
      });

      if (process.env.NODE_ENV !== 'test') {
        console.log(`Cleaned up ${result.count} inactive FCM tokens`);
      }

      return result.count;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to cleanup inactive tokens:', error);
      }
      throw new Error('Failed to cleanup inactive tokens');
    }
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    try {
      await this.prisma.fcmToken.updateMany({
        where: { 
          token,
          isActive: true,
        },
        data: { 
          lastUsed: new Date(),
        },
      });
    } catch (error) {
      // Don't throw error for this operation as it's not critical
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to update last used for token ${token}:`, error);
      }
    }
  }

  /**
   * Get tokens that might be invalid (haven't been used recently)
   */
  async getPotentiallyInvalidTokens(olderThanDays: number = 7): Promise<FcmTokenData[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const tokens = await this.prisma.fcmToken.findMany({
        where: {
          isActive: true,
          lastUsed: { lt: cutoffDate },
        },
        orderBy: {
          lastUsed: 'asc',
        },
      });

      return tokens.map(token => this.mapPrismaToTokenData(token));
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to get potentially invalid tokens:', error);
      }
      throw new Error('Failed to retrieve potentially invalid tokens');
    }
  }

  /**
   * Get statistics about FCM tokens
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    inactiveTokens: number;
    tokensByPlatform: Record<string, number>;
  }> {
    try {
      const [totalTokens, activeTokens, inactiveTokens, platformStats] = await Promise.all([
        this.prisma.fcmToken.count(),
        this.prisma.fcmToken.count({ where: { isActive: true } }),
        this.prisma.fcmToken.count({ where: { isActive: false } }),
        this.prisma.fcmToken.groupBy({
          by: ['platform'],
          where: { isActive: true },
          _count: true,
        }),
      ]);

      const tokensByPlatform: Record<string, number> = {};
      platformStats.forEach(stat => {
        tokensByPlatform[stat.platform] = stat._count;
      });

      return {
        totalTokens,
        activeTokens,
        inactiveTokens,
        tokensByPlatform,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to get token stats:', error);
      }
      throw new Error('Failed to retrieve token statistics');
    }
  }

  private mapPrismaToTokenData(token: unknown): FcmTokenData {
    return {
      id: token.id,
      userId: token.userId,
      token: token.token,
      deviceId: token.deviceId,
      platform: token.platform as 'android' | 'ios' | 'web',
      isActive: token.isActive,
      lastUsed: token.lastUsed,
    };
  }
}