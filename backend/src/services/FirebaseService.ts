// @ts-nocheck
import * as admin from 'firebase-admin';
import { PushNotificationServiceInterface, PushNotificationData, PushNotificationResult, BatchPushNotificationResult } from '../types/PushNotificationInterface';
import { logger } from '../utils/logger';

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export class FirebaseService implements PushNotificationServiceInterface {
  private app: admin.app.App | null = null;
  private messaging: admin.messaging.Messaging | null = null;
  private isInitialized = false;
  private initError: Error | null = null;

  constructor(private config: FirebaseConfig) {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Check if Firebase app already exists
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.config.projectId,
            clientEmail: this.config.clientEmail,
            privateKey: this.config.privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        this.app = admin.apps[0];
      }

      this.messaging = admin.messaging(this.app);
      this.isInitialized = true;
      
      if (process.env.NODE_ENV !== 'test') {
        logger.info('🔥 FirebaseService: Successfully initialized Firebase Admin SDK');
      }
    } catch (error) {
      this.initError = error as Error;
      this.isInitialized = false;
      
      if (process.env.NODE_ENV !== 'test') {
        logger.error('🔥 FirebaseService: Failed to initialize Firebase Admin SDK:', error);
      }
    }
  }

  isAvailable(): boolean {
    return this.isInitialized && this.messaging !== null;
  }

  private getMessaging(): admin.messaging.Messaging {
    if (!this.isAvailable()) {
      throw new Error(`Firebase service not available: ${this.initError?.message || 'Not initialized'}`);
    }
    return this.messaging!;
  }

  async sendToToken(token: string, notification: PushNotificationData): Promise<PushNotificationResult> {
    try {
      const messaging = this.getMessaging();
      
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
        data: notification.data || {},
        android: {
          notification: {
            sound: notification.sound || 'default',
            priority: notification.priority === 'high' ? 'high' : 'default',
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
          ...(notification.timeToLive && { ttl: notification.timeToLive * 1000 }),
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              ...(notification.badge !== undefined && { badge: notification.badge }),
              ...(notification.clickAction && { category: notification.clickAction }),
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl && { icon: notification.imageUrl }),
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
        },
      };

      const messageId = await messaging.send(message);
      
      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check for invalid token errors
      const isInvalidToken = errorMessage.includes('registration-token-not-registered') ||
                           errorMessage.includes('invalid-registration-token') ||
                           errorMessage.includes('not-found');

      return {
        success: false,
        error: errorMessage,
        ...(isInvalidToken && { invalidTokens: [token] }),
      };
    }
  }

  async sendToTokens(tokens: string[], notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    if (tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        results: [],
      };
    }

    try {
      const messaging = this.getMessaging();
      
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
        data: notification.data || {},
        android: {
          notification: {
            sound: notification.sound || 'default',
            priority: notification.priority === 'high' ? 'high' : 'default',
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
          ...(notification.timeToLive && { ttl: notification.timeToLive * 1000 }),
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              ...(notification.badge !== undefined && { badge: notification.badge }),
              ...(notification.clickAction && { category: notification.clickAction }),
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl && { icon: notification.imageUrl }),
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);
      
      const results = response.responses.map((result, index) => ({
        token: tokens[index],
        success: result.success,
        ...(result.messageId && { messageId: result.messageId }),
        ...(result.error?.message && { error: result.error.message }),
      }));

      const invalidTokens = response.responses
        .map((result, index) => {
          if (result.error) {
            const errorCode = result.error.code;
            if (errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/not-found') {
              return tokens[index];
            }
          }
          return null;
        })
        .filter((token): token is string => token !== null);

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        results,
      };
    } catch (error) {
      // If the entire batch failed, return all tokens as failed
      const results = tokens.map(token => ({
        token,
        success: false,
        error: (error as Error).message,
      }));

      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        results,
      };
    }
  }

  async sendToUser(_userId: string, _notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    // This method will be implemented in PushNotificationService
    // as it requires database access to get user tokens
    throw new Error('sendToUser should be called on PushNotificationService, not FirebaseService directly');
  }

  async sendToUsers(_userIds: string[], _notification: PushNotificationData): Promise<BatchPushNotificationResult> {
    // This method will be implemented in PushNotificationService
    // as it requires database access to get user tokens
    throw new Error('sendToUsers should be called on PushNotificationService, not FirebaseService directly');
  }

  async sendToTopic(topic: string, notification: PushNotificationData): Promise<PushNotificationResult> {
    try {
      const messaging = this.getMessaging();
      
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
        data: notification.data || {},
        android: {
          notification: {
            sound: notification.sound || 'default',
            priority: notification.priority === 'high' ? 'high' : 'default',
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
          ...(notification.timeToLive && { ttl: notification.timeToLive * 1000 }),
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              ...(notification.badge !== undefined && { badge: notification.badge }),
              ...(notification.clickAction && { category: notification.clickAction }),
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl && { icon: notification.imageUrl }),
            ...(notification.clickAction && { clickAction: notification.clickAction }),
          },
        },
      };

      const messageId = await messaging.send(message);
      
      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const messaging = this.getMessaging();
      
      // Send a data-only message to validate the token
      const message: admin.messaging.Message = {
        token,
        data: { 
          type: 'token_validation',
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'normal',
        },
        apns: {
          headers: {
            'apns-priority': '5',
          },
          payload: {
            aps: {
              'content-available': 1,
            },
          },
        },
      };

      await messaging.send(message);
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Token is invalid if we get these specific errors
      const isInvalidToken = errorMessage.includes('registration-token-not-registered') ||
                           errorMessage.includes('invalid-registration-token') ||
                           errorMessage.includes('not-found');
      
      return !isInvalidToken;
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      const messaging = this.getMessaging();
      await messaging.subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error(`Failed to subscribe token to topic ${topic}:`, error);
      }
      return false;
    }
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    try {
      const messaging = this.getMessaging();
      await messaging.unsubscribeFromTopic([token], topic);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error(`Failed to unsubscribe token from topic ${topic}:`, error);
      }
      return false;
    }
  }
}