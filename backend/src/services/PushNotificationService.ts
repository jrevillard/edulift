import { PrismaClient } from '@prisma/client';
import { FirebaseService, FirebaseConfig } from './FirebaseService';
import { FcmTokenService } from './FcmTokenService';
import { 
  PushNotificationServiceInterface, 
  PushNotificationData, 
  PushNotificationResult, 
  BatchPushNotificationResult,
  FcmTokenData,
} from '../types/PushNotificationInterface';

export class PushNotificationService implements PushNotificationServiceInterface {
  private firebaseService: FirebaseService | null = null;
  private fcmTokenService: FcmTokenService;
  private isEnabled: boolean;

  constructor(
    prisma: PrismaClient,
    firebaseConfig?: FirebaseConfig,
  ) {
    this.fcmTokenService = new FcmTokenService(prisma);
    this.isEnabled = process.env.FIREBASE_NOTIFICATIONS_ENABLED === 'true';

    if (this.isEnabled && firebaseConfig) {
      this.firebaseService = new FirebaseService(firebaseConfig);
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`🔔 PushNotificationService: ${this.isEnabled ? 'Enabled' : 'Disabled'}`);
    }
  }

  isAvailable(): boolean {
    return this.isEnabled && this.firebaseService?.isAvailable() === true;
  }

  private getFirebaseService(): FirebaseService {
    if (!this.isAvailable()) {
      throw new Error('Push notification service is not available');
    }
    return this.firebaseService!;
  }

  async sendToToken(token: string, notification: PushNotificationData): Promise<PushNotificationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Push notification service is not available',
      };
    }

    try {
      const firebase = this.getFirebaseService();
      const result = await firebase.sendToToken(token, notification);

      // Update token last used if successful
      if (result.success) {
        await this.fcmTokenService.updateTokenLastUsed(token);
      }

      // Deactivate invalid tokens
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        await this.fcmTokenService.deactivateTokens(result.invalidTokens);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendToTokens(tokens: string[], notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    if (!this.isAvailable()) {
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        results: tokens.map(token => ({
          token,
          success: false,
          error: 'Push notification service is not available',
        })),
      };
    }

    try {
      const firebase = this.getFirebaseService();
      const result = await firebase.sendToTokens(tokens, notification);

      // Update last used for successful tokens
      const successfulTokens = result.results
        .filter(r => r.success)
        .map(r => r.token);

      if (successfulTokens.length > 0) {
        await Promise.all(
          successfulTokens.map(token => 
            this.fcmTokenService.updateTokenLastUsed(token).catch(() => {
              // Ignore errors for non-critical operation
            }),
          ),
        );
      }

      // Deactivate invalid tokens
      if (result.invalidTokens.length > 0) {
        await this.fcmTokenService.deactivateTokens(result.invalidTokens);
      }

      return result;
    } catch (error) {
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        results: tokens.map(token => ({
          token,
          success: false,
          error: (error as Error).message,
        })),
      };
    }
  }

  async sendToUser(userId: string, notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    if (!this.isAvailable()) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        results: [],
      };
    }

    try {
      // Get all active tokens for the user
      const userTokens = await this.fcmTokenService.getUserTokens(userId);
      
      if (userTokens.length === 0) {
        return {
          successCount: 0,
          failureCount: 0,
          invalidTokens: [],
          results: [],
        };
      }

      const tokens = userTokens.map(t => t.token);
      return await this.sendToTokens(tokens, notification);
    } catch {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        results: [],
      };
    }
  }

  async sendToUsers(userIds: string[], notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    if (!this.isAvailable()) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        results: [],
      };
    }

    try {
      // Get all active tokens for the users
      const userTokens = await this.fcmTokenService.getUsersTokens(userIds);
      
      if (userTokens.length === 0) {
        return {
          successCount: 0,
          failureCount: 0,
          invalidTokens: [],
          results: [],
        };
      }

      const tokens = userTokens.map(t => t.token);
      return await this.sendToTokens(tokens, notification);
    } catch {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        results: [],
      };
    }
  }

  async sendToTopic(topic: string, notification: PushNotificationData): Promise<PushNotificationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Push notification service is not available',
      };
    }

    try {
      const firebase = this.getFirebaseService();
      return await firebase.sendToTopic(topic, notification);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async validateToken(token: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const firebase = this.getFirebaseService();
      const isValid = await firebase.validateToken(token);
      
      if (!isValid) {
        // Deactivate invalid token
        await this.fcmTokenService.deactivateToken(token);
      } else {
        // Update last used for valid token
        await this.fcmTokenService.updateTokenLastUsed(token);
      }

      return isValid;
    } catch {
      return false;
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const firebase = this.getFirebaseService();
      return await firebase.subscribeToTopic(token, topic);
    } catch {
      return false;
    }
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const firebase = this.getFirebaseService();
      return await firebase.unsubscribeFromTopic(token, topic);
    } catch {
      return false;
    }
  }

  // Token management methods
  async saveToken(tokenData: FcmTokenData): Promise<FcmTokenData> {
    return await this.fcmTokenService.saveToken(tokenData);
  }

  async getUserTokens(userId: string): Promise<FcmTokenData[]> {
    return await this.fcmTokenService.getUserTokens(userId);
  }

  async deleteToken(token: string): Promise<void> {
    await this.fcmTokenService.deleteToken(token);
  }

  async cleanupInactiveTokens(olderThanDays?: number): Promise<number> {
    return await this.fcmTokenService.cleanupInactiveTokens(olderThanDays);
  }

  // Convenience methods for common notification types
  async sendScheduleSlotNotification(
    userIds: string[],
    scheduleSlotData: {
      groupName: string;
      datetime: string;
      changeType: string;
      assignedChildren?: string[];
      vehicles?: Array<{ name: string; driverName?: string }>;
    },
  ): Promise<BatchPushNotificationResult> {
    const notification: PushNotificationData = {
      title: `EduLift - ${scheduleSlotData.groupName}`,
      body: this.getScheduleSlotNotificationBody(scheduleSlotData),
      data: {
        type: 'schedule_slot_change',
        groupName: scheduleSlotData.groupName,
        datetime: scheduleSlotData.datetime,
        changeType: scheduleSlotData.changeType,
      },
      clickAction: '/dashboard',
      priority: 'high',
    };

    return await this.sendToUsers(userIds, notification);
  }

  async sendFamilyInvitationNotification(
    userId: string,
    invitationData: {
      familyName: string;
      inviterName: string;
      inviteCode: string;
    },
  ): Promise<BatchPushNotificationResult> {
    const notification: PushNotificationData = {
      title: 'EduLift - Family Invitation',
      body: `${invitationData.inviterName} invited you to join family "${invitationData.familyName}"`,
      data: {
        type: 'family_invitation',
        familyName: invitationData.familyName,
        inviterName: invitationData.inviterName,
        inviteCode: invitationData.inviteCode,
      },
      clickAction: `/families/join?code=${invitationData.inviteCode}`,
      priority: 'high',
    };

    return await this.sendToUser(userId, notification);
  }

  async sendGroupInvitationNotification(
    userId: string,
    invitationData: {
      groupName: string;
      inviterName: string;
      inviteCode: string;
    },
  ): Promise<BatchPushNotificationResult> {
    const notification: PushNotificationData = {
      title: 'EduLift - Group Invitation',
      body: `${invitationData.inviterName} invited you to join group "${invitationData.groupName}"`,
      data: {
        type: 'group_invitation',
        groupName: invitationData.groupName,
        inviterName: invitationData.inviterName,
        inviteCode: invitationData.inviteCode,
      },
      clickAction: `/groups/join?code=${invitationData.inviteCode}`,
      priority: 'high',
    };

    return await this.sendToUser(userId, notification);
  }

  private getScheduleSlotNotificationBody(data: {
    changeType: string;
    datetime: string;
    assignedChildren?: string[];
    vehicles?: Array<{ name: string; driverName?: string }>;
  }): string {
    const dateTime = new Date(data.datetime).toLocaleString();
    
    switch (data.changeType) {
      case 'SLOT_CREATED':
        return `New slot created for ${dateTime}`;
      case 'DRIVER_ASSIGNED':
        return `Driver assigned for ${dateTime}`;
      case 'VEHICLE_ASSIGNED':
        return `Vehicle assigned for ${dateTime}`;
      case 'CHILD_ADDED':
        return `Child added to slot at ${dateTime}`;
      case 'CHILD_REMOVED':
        return `Child removed from slot at ${dateTime}`;
      case 'SLOT_CANCELLED':
        return `Slot cancelled for ${dateTime}`;
      default:
        return `Schedule updated for ${dateTime}`;
    }
  }
}