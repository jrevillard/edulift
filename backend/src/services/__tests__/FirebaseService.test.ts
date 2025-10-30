// Mock firebase-admin avant toute import
jest.mock('firebase-admin', () => {
  const mockAdmin = {
    apps: [],
    getApps: jest.fn().mockReturnValue([]),
    initializeApp: jest.fn().mockReturnValue({
      name: 'test-app',
      getOrInitService: jest.fn(),
    }),
    credential: {
      cert: jest.fn().mockReturnValue({}),
    },
    messaging: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({ messageId: 'message-id-123' }),
      sendEachForMulticast: jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        results: [
          { success: true, messageId: 'message-id-1' },
          { success: true, messageId: 'message-id-2' },
        ],
      }),
      subscribeToTopic: jest.fn().mockResolvedValue({}),
      unsubscribeFromTopic: jest.fn().mockResolvedValue({}),
    }),
  };

  // @ts-ignore
  return mockAdmin;
});

import admin from 'firebase-admin';
import { FirebaseService, FirebaseConfig } from '../FirebaseService';
import { PushNotificationData } from '../../types/PushNotificationInterface';

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;
  let mockMessaging: any;
  const mockConfig: FirebaseConfig = {
    projectId: 'test-project',
    clientEmail: 'test@test-project.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessaging = {
      send: jest.fn(),
      sendEachForMulticast: jest.fn(),
      subscribeToTopic: jest.fn(),
      unsubscribeFromTopic: jest.fn(),
    };

    // Update the admin.messaging mock to return our mockMessaging
    (admin.messaging as jest.Mock).mockReturnValue(mockMessaging);

    firebaseService = new FirebaseService(mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize Firebase service successfully', () => {
      expect(firebaseService.isAvailable()).toBe(true);
    });

    it('should handle initialization errors gracefully', () => {
            // @ts-expect-error - mock of Firebase admin
            admin.initializeApp.mockImplementationOnce(() => {
        throw new Error('Init error');
      });

      const failedService = new FirebaseService(mockConfig);
      expect(failedService.isAvailable()).toBe(false);
    });
  });

  describe('sendToToken', () => {
    const mockNotification: PushNotificationData = {
      title: 'Test Title',
      body: 'Test Body',
      data: { test: 'data' },
    };

    it('should send notification to a single token successfully', async () => {
      mockMessaging.send.mockResolvedValueOnce('message-id-123');

      const result = await firebaseService.sendToToken('test-token', mockNotification);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('message-id-123');
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          notification: {
            title: 'Test Title',
            body: 'Test Body',
          },
          data: { test: 'data' },
        }),
      );
    });

    it('should handle invalid token errors', async () => {
      mockMessaging.send.mockRejectedValueOnce(
        new Error('registration-token-not-registered'),
      );

      const result = await firebaseService.sendToToken('invalid-token', mockNotification);

      expect(result.success).toBe(false);
      expect(result.invalidTokens).toEqual(['invalid-token']);
    });

    it('should handle general send errors', async () => {
      mockMessaging.send.mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await firebaseService.sendToToken('test-token', mockNotification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.invalidTokens).toBeUndefined();
    });
  });

  describe('sendToTokens', () => {
    const mockNotification: PushNotificationData = {
      title: 'Batch Test',
      body: 'Batch Body',
    };

    it('should send notifications to multiple tokens successfully', async () => {
      const mockResponse = {
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'msg-1' },
          { success: true, messageId: 'msg-2' },
        ],
      };
      mockMessaging.sendEachForMulticast.mockResolvedValueOnce(mockResponse);

      const result = await firebaseService.sendToTokens(['token1', 'token2'], mockNotification);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.invalidTokens).toEqual([]);
    });

    it('should handle mixed success/failure responses', async () => {
      const mockResponse = {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true, messageId: 'msg-1' },
          { 
            success: false, 
            error: { 
              code: 'messaging/registration-token-not-registered',
              message: 'Token not registered',
            },
          },
        ],
      };
      mockMessaging.sendEachForMulticast.mockResolvedValueOnce(mockResponse);

      const result = await firebaseService.sendToTokens(['token1', 'invalid-token'], mockNotification);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.invalidTokens).toEqual(['invalid-token']);
    });

    it('should return empty result for empty token array', async () => {
      const result = await firebaseService.sendToTokens([], mockNotification);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.invalidTokens).toEqual([]);
    });
  });

  describe('sendToTopic', () => {
    const mockNotification: PushNotificationData = {
      title: 'Topic Test',
      body: 'Topic Body',
    };

    it('should send notification to topic successfully', async () => {
      mockMessaging.send.mockResolvedValueOnce('topic-message-id');

      const result = await firebaseService.sendToTopic('test-topic', mockNotification);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('topic-message-id');
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
        }),
      );
    });

    it('should handle topic send errors', async () => {
      mockMessaging.send.mockRejectedValueOnce(new Error('Topic error'));

      const result = await firebaseService.sendToTopic('test-topic', mockNotification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Topic error');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockMessaging.send.mockResolvedValueOnce('validation-message-id');

      const result = await firebaseService.validateToken('valid-token');

      expect(result).toBe(true);
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'valid-token',
          data: expect.objectContaining({
            type: 'token_validation',
          }),
        }),
      );
    });

    it('should return false for invalid token', async () => {
      mockMessaging.send.mockRejectedValueOnce(
        new Error('registration-token-not-registered'),
      );

      const result = await firebaseService.validateToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should return true for other errors (token might still be valid)', async () => {
      mockMessaging.send.mockRejectedValueOnce(new Error('Network error'));

      const result = await firebaseService.validateToken('test-token');

      expect(result).toBe(true);
    });
  });

  describe('Topic subscription management', () => {
    it('should subscribe token to topic successfully', async () => {
      mockMessaging.subscribeToTopic.mockResolvedValueOnce(undefined);

      const result = await firebaseService.subscribeToTopic('test-token', 'test-topic');

      expect(result).toBe(true);
      expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(['test-token'], 'test-topic');
    });

    it('should handle subscription errors', async () => {
      mockMessaging.subscribeToTopic.mockRejectedValueOnce(new Error('Subscription error'));

      const result = await firebaseService.subscribeToTopic('test-token', 'test-topic');

      expect(result).toBe(false);
    });

    it('should unsubscribe token from topic successfully', async () => {
      mockMessaging.unsubscribeFromTopic.mockResolvedValueOnce(undefined);

      const result = await firebaseService.unsubscribeFromTopic('test-token', 'test-topic');

      expect(result).toBe(true);
      expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith(['test-token'], 'test-topic');
    });

    it('should handle unsubscription errors', async () => {
      mockMessaging.unsubscribeFromTopic.mockRejectedValueOnce(new Error('Unsubscription error'));

      const result = await firebaseService.unsubscribeFromTopic('test-token', 'test-topic');

      expect(result).toBe(false);
    });
  });

  describe('Service availability', () => {
    it('should throw error when service is not available', () => {
            // @ts-expect-error - mock of Firebase admin
            admin.initializeApp.mockImplementationOnce(() => {
        throw new Error('Init error');
      });

      const failedService = new FirebaseService(mockConfig);

      expect(() => {
        (failedService as any).getMessaging();
      }).toThrow('Firebase service not available: Init error');
    });
  });
});