import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import * as firebaseAdmin from 'firebase-admin';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    name: 'test-app',
  }),
  credential: {
    cert: jest.fn().mockReturnValue({}),
  },
  messaging: jest.fn().mockReturnValue({
    send: jest.fn(),
    sendEachForMulticast: jest.fn(),
    subscribeToTopic: jest.fn(),
    unsubscribeFromTopic: jest.fn(),
  }),
}));

describe('FCM Tokens API Integration Tests', () => {
  let prisma: PrismaClient;
  let testUser: any;
  let _authToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Set environment variables for testing
    process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'true';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
  });

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        name: 'Test User',
      },
    });

    // Mock authentication middleware
    jest.doMock('../../src/middleware/auth', () => ({
      requireAuth: (req: any, _res: any, _next: any) => {
        req.user = { id: testUser.id, email: testUser.email };
        next();
      },
    }));
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.fcmToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/fcm-tokens', () => {
    it('should save a new FCM token', async () => {
      const tokenData = {
        token: 'fcm-token-123',
        deviceId: 'device-123',
        fcmPlatform: 'android',
      };

      const response = await request(app)
        .post('/api/v1/fcm-tokens')
        .send(tokenData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fcmPlatform).toBe('android');
      expect(response.body.data.isActive).toBe(true);

      // Verify token was saved in database
      const savedToken = await prisma.fcmToken.findUnique({
        where: { token: 'fcm-token-123' },
      });
      expect(savedToken).toBeTruthy();
      expect(savedToken!.userId).toBe(testUser.id);
    });

    it('should update existing FCM token', async () => {
      // Create existing token
      await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'fcm-token-123',
          platform: 'android',
        },
      });

      const updateData = {
        token: 'fcm-token-123',
        deviceId: 'new-device-123',
        fcmPlatform: 'ios',
      };

      const response = await request(app)
        .post('/api/v1/fcm-tokens')
        .send(updateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fcmPlatform).toBe('ios');

      // Verify token was updated in database
      const updatedToken = await prisma.fcmToken.findUnique({
        where: { token: 'fcm-token-123' },
      });
      expect(updatedToken!.platform).toBe('ios');
      expect(updatedToken!.deviceId).toBe('new-device-123');
    });

    it('should reject invalid fcmPlatform', async () => {
      const tokenData = {
        token: 'fcm-token-123',
        fcmPlatform: 'invalid-platform',
      };

      const response = await request(app)
        .post('/api/v1/fcm-tokens')
        .send(tokenData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeDefined();
    });

    it('should require authentication', async () => {
      // Remove auth mock temporarily
      jest.doMock('../../src/middleware/auth', () => ({
        requireAuth: (req: any, res: any, _next: any) => {
          res.status(401).json({ error: 'Authentication required' });
        },
      }));

      const tokenData = {
        token: 'fcm-token-123',
        fcmPlatform: 'android',
      };

      await request(app)
        .post('/api/v1/fcm-tokens')
        .send(tokenData)
        .expect(401);
    });
  });

  describe('GET /api/v1/fcm-tokens', () => {
    beforeEach(async () => {
      // Create test tokens
      await prisma.fcmToken.createMany({
        data: [
          {
            userId: testUser.id,
            token: 'token-1',
            platform: 'android',
            deviceId: 'device-1',
            isActive: true,
          },
          {
            userId: testUser.id,
            token: 'token-2',
            platform: 'ios',
            deviceId: 'device-2',
            isActive: true,
          },
          {
            userId: testUser.id,
            token: 'token-3',
            platform: 'web',
            isActive: false, // Inactive token
          },
        ],
      });
    });

    it('should return user FCM tokens', async () => {
      const response = await request(app)
        .get('/api/v1/fcm-tokens')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only active tokens
      expect(response.body.data[0].fcmPlatform).toMatch(/android|ios/);
      expect(response.body.data[1].fcmPlatform).toMatch(/android|ios/);
    });

    it('should return empty array when user has no active tokens', async () => {
      // Deactivate all tokens
      await prisma.fcmToken.updateMany({
        where: { userId: testUser.id },
        data: { isActive: false },
      });

      const response = await request(app)
        .get('/api/v1/fcm-tokens')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('DELETE /api/v1/fcm-tokens/:token', () => {
    let _testToken: any;

    beforeEach(async () => {
      _testToken = await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'token-to-delete',
          platform: 'android',
        },
      });
    });

    it('should delete user FCM token', async () => {
      const response = await request(app)
        .delete('/api/v1/fcm-tokens/token-to-delete')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('FCM token deleted successfully');

      // Verify token was deleted
      const deletedToken = await prisma.fcmToken.findUnique({
        where: { token: 'token-to-delete' },
      });
      expect(deletedToken).toBeNull();
    });

    it('should reject deleting token that does not belong to user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          name: 'Other User',
        },
      });

      // Create token for other user
      await prisma.fcmToken.create({
        data: {
          userId: otherUser.id,
          token: 'other-user-token',
          platform: 'android',
        },
      });

      const response = await request(app)
        .delete('/api/v1/fcm-tokens/other-user-token')
        .expect(404);

      expect(response.body.error).toBe('FCM token not found or does not belong to user');

      // Cleanup
      await prisma.fcmToken.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should return 404 for non-existent token', async () => {
      const response = await request(app)
        .delete('/api/v1/fcm-tokens/non-existent-token')
        .expect(404);

      expect(response.body.error).toBe('FCM token not found or does not belong to user');
    });
  });

  describe('POST /api/v1/fcm-tokens/validate', () => {
    let _testToken: any;

    beforeEach(async () => {
      _testToken = await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'token-to-validate',
          platform: 'android',
        },
      });

      // Mock Firebase validation
      const admin = firebaseAdmin;
      const mockMessaging = admin.messaging();
      mockMessaging.send.mockResolvedValue('validation-message-id');
    });

    it('should validate user FCM token', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/validate')
        .send({ token: 'token-to-validate' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('token-to-validate');
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.isServiceAvailable).toBe(true);
    });

    it('should reject validating token that does not belong to user', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/validate')
        .send({ token: 'non-existent-token' })
        .expect(404);

      expect(response.body.error).toBe('FCM token not found or does not belong to user');
    });

    it('should require token in request body', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/validate')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/v1/fcm-tokens/subscribe', () => {
    let _testToken: any;

    beforeEach(async () => {
      _testToken = await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'token-to-subscribe',
          platform: 'android',
          isActive: true,
        },
      });

      // Mock Firebase subscription
      const admin = firebaseAdmin;
      const mockMessaging = admin.messaging();
      mockMessaging.subscribeToTopic.mockResolvedValue(undefined);
    });

    it('should subscribe token to topic', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/subscribe')
        .send({ 
          token: 'token-to-subscribe',
          topic: 'test-topic',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscribed).toBe(true);
      expect(response.body.data.topic).toBe('test-topic');
    });

    it('should reject subscribing inactive token', async () => {
      // Deactivate token
      await prisma.fcmToken.update({
        where: { token: 'token-to-subscribe' },
        data: { isActive: false },
      });

      const response = await request(app)
        .post('/api/v1/fcm-tokens/subscribe')
        .send({ 
          token: 'token-to-subscribe',
          topic: 'test-topic',
        })
        .expect(404);

      expect(response.body.error).toBe('Active FCM token not found or does not belong to user');
    });

    it('should require both token and topic', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/subscribe')
        .send({ token: 'token-to-subscribe' })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/v1/fcm-tokens/unsubscribe', () => {
    let _testToken: any;

    beforeEach(async () => {
      _testToken = await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'token-to-unsubscribe',
          platform: 'android',
          isActive: true,
        },
      });

      // Mock Firebase unsubscription
      const admin = firebaseAdmin;
      const mockMessaging = admin.messaging();
      mockMessaging.unsubscribeFromTopic.mockResolvedValue(undefined);
    });

    it('should unsubscribe token from topic', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/unsubscribe')
        .send({ 
          token: 'token-to-unsubscribe',
          topic: 'test-topic',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unsubscribed).toBe(true);
      expect(response.body.data.topic).toBe('test-topic');
    });
  });

  describe('POST /api/v1/fcm-tokens/test', () => {
    beforeEach(async () => {
      await prisma.fcmToken.create({
        data: {
          userId: testUser.id,
          token: 'test-notification-token',
          platform: 'android',
          isActive: true,
        },
      });

      // Mock Firebase test notification
      const admin = firebaseAdmin;
      const mockMessaging = admin.messaging();
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'test-msg-id' },
        ],
      });
    });

    it('should send test notification to user', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/test')
        .send({ 
          title: 'Test Title',
          body: 'Test Body',
          priority: 'high',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successCount).toBe(1);
      expect(response.body.data.failureCount).toBe(0);
      expect(response.body.data.totalTokens).toBe(1);
    });

    it('should require title and body', async () => {
      const response = await request(app)
        .post('/api/v1/fcm-tokens/test')
        .send({ title: 'Test Title' })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return error when service is unavailable', async () => {
      // Disable Firebase notifications
      process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'false';

      const response = await request(app)
        .post('/api/v1/fcm-tokens/test')
        .send({ 
          title: 'Test Title',
          body: 'Test Body',
        })
        .expect(503);

      expect(response.body.error).toBe('Push notification service is not available');

      // Re-enable for other tests
      process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'true';
    });
  });

  describe('GET /api/v1/fcm-tokens/stats', () => {
    beforeEach(async () => {
      await prisma.fcmToken.createMany({
        data: [
          {
            userId: testUser.id,
            token: 'android-token',
            platform: 'android',
            isActive: true,
          },
          {
            userId: testUser.id,
            token: 'ios-token',
            platform: 'ios',
            isActive: true,
          },
        ],
      });
    });

    it('should return user token statistics', async () => {
      const response = await request(app)
        .get('/api/v1/fcm-tokens/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userTokenCount).toBe(2);
      expect(response.body.data.serviceAvailable).toBe(true);
      expect(response.body.data.platforms.android).toBe(1);
      expect(response.body.data.platforms.ios).toBe(1);
    });
  });
});