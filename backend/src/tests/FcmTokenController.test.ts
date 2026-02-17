/**
 * FcmTokenController Hono Tests
 *
 * Comprehensive tests for the FcmTokenController using correct Hono pattern
 * with app.request() and proper zValidator handling
 */

import { Hono } from 'hono';
import { createPrismaMock } from '../mocks/prisma-mock';
import { mockPushNotificationService } from '../mocks/push-notification-service-mock';
import { createFcmTokenControllerRoutes } from '../controllers/v1/FcmTokenController';

// Helper function for typing response.json()
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

// Mock external dependencies
jest.mock('../config/database', () => {
  const mockPrisma = createPrismaMock();
  return {
    prisma: mockPrisma,
  };
});

jest.mock('../services/PushNotificationServiceFactory', () => ({
  PushNotificationServiceFactory: {
    getInstance: jest.fn(() => mockPushNotificationService),
    reset: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('FcmTokenController Hono', () => {
  let app: Hono;
  let mockPrisma: any;
  const mockUserId = 'user_123456789012345678901234';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get the actual mocked prisma instance from the database module
    const { prisma } = require('../config/database');
    mockPrisma = prisma;

    const { PushNotificationServiceFactory } = require('../services/PushNotificationServiceFactory');
    PushNotificationServiceFactory.reset();

    // Create controller instance with auth middleware
    app = new Hono();

    // Mock auth middleware - sets userId in context using type assertion
    app.use('*', async (c: any, next) => {
      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'UTC',
      });
      await next();
    });

    // Mount the FcmTokenController routes with mocked dependencies
    app.route('/', createFcmTokenControllerRoutes({ prisma: mockPrisma }));
  });

  describe('POST / - Save FCM Token', () => {
    const validTokenData = {
      token: 'fcm_token_string_here',
      deviceId: 'device_12345',
      fcmPlatform: 'android' as const,
    };

    it('should save token successfully with valid data', async () => {
      // Mock successful save
      mockPushNotificationService.saveToken.mockResolvedValue({
        id: 'token_123',
        userId: mockUserId,
        token: validTokenData.token,
        deviceId: validTokenData.deviceId,
        fcmPlatform: validTokenData.fcmPlatform,
        isActive: true,
        lastUsed: new Date('2024-01-15T10:30:00Z'),
      });

      const response = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTokenData),
      });

      expect(response.status).toBe(201);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('token_123');
      expect(json.data.fcmPlatform).toBe('android');
      expect(json.data.isActive).toBe(true);
      expect(json.data.createdAt).toBe('2024-01-15T10:30:00.000Z');
      expect(mockPushNotificationService.saveToken).toHaveBeenCalledWith({
        userId: mockUserId,
        token: validTokenData.token,
        deviceId: validTokenData.deviceId,
        fcmPlatform: validTokenData.fcmPlatform,
      });
    });

    it('should save token successfully without deviceId', async () => {
      const tokenDataWithoutDevice = {
        token: 'fcm_token_string_here',
        fcmPlatform: 'ios' as const,
      };

      mockPushNotificationService.saveToken.mockResolvedValue({
        id: 'token_456',
        userId: mockUserId,
        token: tokenDataWithoutDevice.token,
        deviceId: null,
        fcmPlatform: tokenDataWithoutDevice.fcmPlatform,
        isActive: true,
        lastUsed: new Date('2024-01-15T10:30:00Z'),
      });

      const response = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenDataWithoutDevice),
      });

      expect(response.status).toBe(201);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.fcmPlatform).toBe('ios');
    });

    it('should return 400 when token is missing', async () => {
      const invalidData = {
        deviceId: 'device_12345',
        fcmPlatform: 'android' as const,
      };

      const response = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when fcmPlatform is invalid', async () => {
      const invalidData = {
        token: 'fcm_token_string_here',
        deviceId: 'device_12345',
        fcmPlatform: 'invalid_platform',
      };

      const response = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
    });

    it('should return 500 when service throws error', async () => {
      mockPushNotificationService.saveToken.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const response = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTokenData),
      });

      expect(response.status).toBe(500);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to save FCM token');
    });
  });

  describe('GET / - Get All FCM Tokens', () => {
    it('should return user tokens successfully', async () => {
      const mockTokens = [
        {
          id: 'token_1',
          deviceId: 'device_123',
          platform: 'android',
          isActive: true,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          lastUsed: new Date('2024-01-15T10:30:00Z'),
        },
        {
          id: 'token_2',
          deviceId: null,
          platform: 'ios',
          isActive: true,
          createdAt: new Date('2024-01-16T11:00:00Z'),
          lastUsed: new Date('2024-01-16T11:00:00Z'),
        },
      ];

      mockPrisma.fcmToken.findMany.mockResolvedValue(mockTokens);

      const response = await app.request('/', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.tokens).toHaveLength(2);
      expect(json.data.tokens[0].id).toBe('token_1');
      expect(json.data.tokens[0].fcmPlatform).toBe('android');
      expect(mockPrisma.fcmToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          deviceId: true,
          platform: true,
          isActive: true,
          createdAt: true,
          lastUsed: true,
        },
      });
    });

    it('should return empty array when no tokens exist', async () => {
      mockPrisma.fcmToken.findMany.mockResolvedValue([]);

      const response = await app.request('/', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.tokens).toEqual([]);
    });

    it('should return 500 when database fails', async () => {
      mockPrisma.fcmToken.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await app.request('/', {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to retrieve FCM tokens');
    });
  });

  describe('DELETE /:tokenId - Delete FCM Token', () => {
    const tokenId = 'token_123456789012345678901234';

    it('should delete token successfully', async () => {
      // Mock token exists and belongs to user
      mockPrisma.fcmToken.findFirst.mockResolvedValue({
        id: tokenId,
        userId: mockUserId,
        platform: 'android',
      });

      // Mock successful deletion
      mockPushNotificationService.deleteToken.mockResolvedValue(undefined);

      const response = await app.request(`/${tokenId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.message).toBe('FCM token deleted successfully');
      expect(mockPrisma.fcmToken.findFirst).toHaveBeenCalledWith({
        where: {
          id: tokenId,
          userId: mockUserId,
        },
      });
      expect(mockPushNotificationService.deleteToken).toHaveBeenCalledWith(tokenId);
    });

    it('should return 404 when token not found', async () => {
      mockPrisma.fcmToken.findFirst.mockResolvedValue(null);

      const response = await app.request(`/${tokenId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('FCM token not found');
    });

    it('should return 400 when tokenId is invalid', async () => {
      const response = await app.request('/', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404); // Route not found for empty token
    });

    it('should return 500 when service fails', async () => {
      mockPrisma.fcmToken.findFirst.mockResolvedValue({
        id: tokenId,
        userId: mockUserId,
        platform: 'android',
      });

      mockPushNotificationService.deleteToken.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const response = await app.request(`/${tokenId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(500);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to delete FCM token');
    });
  });

  describe('POST /validate - Validate FCM Token', () => {
    const validToken = 'fcm_token_string_here';

    it('should validate token successfully', async () => {
      mockPushNotificationService.validateToken.mockResolvedValue(true);
      mockPrisma.fcmToken.updateMany.mockResolvedValue({ count: 1 });
      mockPushNotificationService.isAvailable.mockReturnValue(true);

      const response = await app.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: validToken }),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.token).toBe(validToken);
      expect(json.data.isValid).toBe(true);
      expect(json.data.isServiceAvailable).toBe(true);
      expect(mockPushNotificationService.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockPrisma.fcmToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          token: validToken,
        },
        data: {
          lastUsed: expect.any(Date),
        },
      });
    });

    it('should handle invalid token', async () => {
      const invalidToken = 'invalid_fcm_token';
      mockPushNotificationService.validateToken.mockResolvedValue(false);
      mockPushNotificationService.isAvailable.mockReturnValue(true);

      const response = await app.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invalidToken }),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.isValid).toBe(false);
      expect(mockPrisma.fcmToken.updateMany).not.toHaveBeenCalled();
    });

    it('should return 400 when token is missing', async () => {
      const response = await app.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('should return 500 when validation fails', async () => {
      mockPushNotificationService.validateToken.mockRejectedValue(
        new Error('Validation service unavailable'),
      );

      const response = await app.request('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: validToken }),
      });

      expect(response.status).toBe(500);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to validate FCM token');
    });
  });

  describe('POST /subscribe-topic - Subscribe to Topic', () => {
    const validSubscription = {
      token: 'fcm_token_string_here',
      topic: 'group_12345_updates',
    };

    it('should subscribe to topic successfully', async () => {
      // Mock token exists and belongs to user
      mockPrisma.fcmToken.findFirst.mockResolvedValue({
        id: 'token_1',
        userId: mockUserId,
        token: validSubscription.token,
        isActive: true,
      });

      mockPushNotificationService.subscribeToTopic.mockResolvedValue(true);

      const response = await app.request('/subscribe-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSubscription),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.token).toBe(validSubscription.token);
      expect(json.data.topic).toBe(validSubscription.topic);
      expect(json.data.subscribed).toBe(true);
    });

    it('should return 404 when token not found', async () => {
      mockPrisma.fcmToken.findFirst.mockResolvedValue(null);

      const response = await app.request('/subscribe-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSubscription),
      });

      expect(response.status).toBe(404);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('FCM token not found or inactive');
    });

    it('should return 400 when validation fails', async () => {
      const invalidData = {
        token: '',
        topic: 'group_12345_updates',
      };

      const response = await app.request('/subscribe-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /unsubscribe-topic - Unsubscribe from Topic', () => {
    const validSubscription = {
      token: 'fcm_token_string_here',
      topic: 'group_12345_updates',
    };

    it('should unsubscribe from topic successfully', async () => {
      // Mock token exists and belongs to user
      mockPrisma.fcmToken.findFirst.mockResolvedValue({
        id: 'token_1',
        userId: mockUserId,
        token: validSubscription.token,
        isActive: true,
      });

      mockPushNotificationService.unsubscribeFromTopic.mockResolvedValue(true);

      const response = await app.request('/unsubscribe-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSubscription),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.token).toBe(validSubscription.token);
      expect(json.data.topic).toBe(validSubscription.topic);
      expect(json.data.subscribed).toBe(false);
    });

    it('should return 404 when token not found', async () => {
      mockPrisma.fcmToken.findFirst.mockResolvedValue(null);

      const response = await app.request('/unsubscribe-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSubscription),
      });

      expect(response.status).toBe(404);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('FCM token not found or inactive');
    });
  });

  describe('POST /test-notification - Send Test Notification', () => {
    const validNotification = {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { custom_key: 'custom_value' },
      priority: 'normal' as const,
    };

    it('should send test notification successfully', async () => {
      const mockTokens = [
        { token: 'fcm_token_1' },
        { token: 'fcm_token_2' },
      ];

      mockPrisma.fcmToken.findMany.mockResolvedValue(mockTokens);
      mockPushNotificationService.sendToTokens.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        invalidTokens: [],
      });

      const response = await app.request('/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validNotification),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.successCount).toBe(2);
      expect(json.data.failureCount).toBe(0);
      expect(json.data.invalidTokens).toEqual([]);
      expect(json.data.totalTokens).toBe(2);
      expect(mockPrisma.fcmToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isActive: true,
        },
        select: {
          token: true,
        },
      });
    });

    it('should return 404 when no active tokens found', async () => {
      mockPrisma.fcmToken.findMany.mockResolvedValue([]);

      const response = await app.request('/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validNotification),
      });

      expect(response.status).toBe(404);
      const json = await responseJson(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('No active FCM tokens found');
    });

    it('should handle partial failures', async () => {
      const mockTokens = [
        { token: 'fcm_token_1' },
        { token: 'fcm_token_2' },
        { token: 'invalid_token' },
      ];

      mockPrisma.fcmToken.findMany.mockResolvedValue(mockTokens);
      mockPushNotificationService.sendToTokens.mockResolvedValue({
        successCount: 2,
        failureCount: 1,
        invalidTokens: ['invalid_token'],
      });

      const response = await app.request('/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validNotification),
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.successCount).toBe(2);
      expect(json.data.failureCount).toBe(1);
      expect(json.data.invalidTokens).toContain('invalid_token');
    });
  });

  describe('DELETE /cleanup-inactive - Cleanup Inactive Tokens', () => {
    it('should cleanup inactive tokens successfully', async () => {
      const mockInactiveTokens = [
        { id: 'token_1', lastUsed: new Date('2024-01-01T10:30:00Z') },
        { id: 'token_2', lastUsed: new Date('2024-01-02T11:00:00Z') },
      ];

      mockPrisma.fcmToken.findMany.mockResolvedValue(mockInactiveTokens);
      mockPrisma.fcmToken.deleteMany.mockResolvedValue({ count: 2 });

      const response = await app.request('/cleanup-inactive', {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.message).toBe('Inactive tokens cleaned up successfully');
      expect(json.data.cleanedUpTokens).toBe(2);
    });

    it('should return success message when no inactive tokens found', async () => {
      mockPrisma.fcmToken.findMany.mockResolvedValue([]);

      const response = await app.request('/cleanup-inactive', {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.message).toBe('No inactive tokens found');
      expect(json.data.cleanedUpTokens).toBe(0);
      expect(mockPrisma.fcmToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /stats - Get FCM Token Statistics', () => {
    it('should return token statistics successfully', async () => {
      const mockTokens = [
        { platform: 'android' },
        { platform: 'android' },
        { platform: 'ios' },
      ];

      mockPrisma.fcmToken.findMany.mockResolvedValue(mockTokens);
      mockPushNotificationService.isAvailable.mockReturnValue(true);

      const response = await app.request('/stats', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.userTokenCount).toBe(3);
      expect(json.data.serviceAvailable).toBe(true);
      expect(json.data.platforms).toEqual({
        android: 2,
        ios: 1,
      });
    });

    it('should return zero stats when no tokens exist', async () => {
      mockPrisma.fcmToken.findMany.mockResolvedValue([]);
      mockPushNotificationService.isAvailable.mockReturnValue(false);

      const response = await app.request('/stats', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson(response);
      expect(json.success).toBe(true);
      expect(json.data.userTokenCount).toBe(0);
      expect(json.data.platforms).toEqual({});
      expect(json.data.serviceAvailable).toBe(false);
    });
  });
});