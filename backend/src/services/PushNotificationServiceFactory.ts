import { PrismaClient } from '@prisma/client';
import { PushNotificationService } from './PushNotificationService';
import { FirebaseConfig } from './FirebaseService';

export class PushNotificationServiceFactory {
  private static instance: PushNotificationService | null = null;

  static getInstance(prisma: PrismaClient): PushNotificationService {
    if (!this.instance) {
      this.instance = this.createPushNotificationService(prisma);
    }
    return this.instance;
  }

  private static createPushNotificationService(prisma: PrismaClient): PushNotificationService {
    const isEnabled = process.env.FIREBASE_NOTIFICATIONS_ENABLED === 'true';
    
    console.log('🔍 PushNotificationServiceFactory configuration check:');
    console.log(`FIREBASE_NOTIFICATIONS_ENABLED: ${process.env.FIREBASE_NOTIFICATIONS_ENABLED || 'NOT SET'}`);
    console.log(`FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
    console.log(`FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL || 'NOT SET'}`);
    console.log(`FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'}`);

    if (isEnabled && this.hasFirebaseConfig()) {
      const firebaseConfig: FirebaseConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!,
      };

      console.log(`🔔 PushNotificationServiceFactory: Using Firebase push notifications for project: ${firebaseConfig.projectId}`);
      return new PushNotificationService(prisma, firebaseConfig);
    } else {
      console.log('🔔 PushNotificationServiceFactory: Push notifications disabled or Firebase not configured');
      return new PushNotificationService(prisma);
    }
  }

  private static hasFirebaseConfig(): boolean {
    return !!(
      process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PRIVATE_KEY
    );
  }

  // For testing purposes - allow resetting the instance
  static reset(): void {
    this.instance = null;
  }
}