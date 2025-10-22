import { PushNotificationService } from '../PushNotificationService';
import { FirebaseService } from '../FirebaseService';
import { FcmTokenService } from '../FcmTokenService';
import { PushNotificationData } from '../../types/PushNotificationInterface';

// Mock the dependencies
jest.mock('../FirebaseService');
jest.mock('../FcmTokenService');

const mockPrismaClient = {} as any;

describe('PushNotificationService', () => {
  let pushNotificationService: PushNotificationService;
  let mockFirebaseService: jest.Mocked<FirebaseService>;
  let mockFcmTokenService: jest.Mocked<FcmTokenService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variable
    process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'true';

    mockFirebaseService = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendToToken: jest.fn(),
      sendToTokens: jest.fn(),
      sendToTopic: jest.fn(),
      validateToken: jest.fn(),
      subscribeToTopic: jest.fn(),
      unsubscribeFromTopic: jest.fn(),
      sendToUser: jest.fn(),
      sendToUsers: jest.fn()
    } as any;

    mockFcmTokenService = {
      saveToken: jest.fn().mockResolvedValue({}),
      getUserTokens: jest.fn().mockResolvedValue([]),
      getUsersTokens: jest.fn().mockResolvedValue([]),
      updateTokenLastUsed: jest.fn().mockResolvedValue(undefined),
      deactivateToken: jest.fn().mockResolvedValue(undefined),
      deactivateTokens: jest.fn().mockResolvedValue(undefined),
      deleteToken: jest.fn().mockResolvedValue(undefined),
      cleanupInactiveTokens: jest.fn().mockResolvedValue(0)
    } as any;

    // Mock the constructors to return our mock instances
    (FirebaseService as jest.Mock).mockImplementation(() => mockFirebaseService);
    (FcmTokenService as jest.Mock).mockImplementation(() => mockFcmTokenService);

    const mockFirebaseConfig = {
      projectId: 'test-project',
      clientEmail: 'test@test-project.iam.gserviceaccount.com',
      privateKey: 'test-key'
    };

    pushNotificationService = new PushNotificationService(mockPrismaClient, mockFirebaseConfig);
    
    // Explicitly set the firebaseService to our mock after construction
    (pushNotificationService as any).firebaseService = mockFirebaseService;
  });

  describe('Service availability', () => {
    it('should be available when Firebase is configured and enabled', () => {
      expect(pushNotificationService.isAvailable()).toBe(true);
    });

    it('should not be available when Firebase notifications are disabled', () => {
      process.env.FIREBASE_NOTIFICATIONS_ENABLED = 'false';
      const service = new PushNotificationService(mockPrismaClient);
      expect(service.isAvailable()).toBe(false);
    });

    it('should not be available when Firebase service is not available', () => {
      mockFirebaseService.isAvailable.mockReturnValue(false);
      expect(pushNotificationService.isAvailable()).toBe(false);
    });
  });

  describe('sendToToken', () => {
    const mockNotification: PushNotificationData = {
      title: 'Test Title',
      body: 'Test Body'
    };

    it('should send notification and update token last used on success', async () => {
      mockFirebaseService.sendToToken.mockResolvedValueOnce({
        success: true,
        messageId: 'msg-123'
      });

      const result = await pushNotificationService.sendToToken('test-token', mockNotification);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockFcmTokenService.updateTokenLastUsed).toHaveBeenCalledWith('test-token');
    });

    it('should deactivate invalid tokens', async () => {
      mockFirebaseService.sendToToken.mockResolvedValueOnce({
        success: false,
        error: 'Token invalid',
        invalidTokens: ['invalid-token']
      });

      const result = await pushNotificationService.sendToToken('invalid-token', mockNotification);

      expect(result.success).toBe(false);
      expect(mockFcmTokenService.deactivateTokens).toHaveBeenCalledWith(['invalid-token']);
    });

    it('should return error when service is not available', async () => {
      mockFirebaseService.isAvailable.mockReturnValue(false);

      const result = await pushNotificationService.sendToToken('test-token', mockNotification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Push notification service is not available');
    });
  });

  describe('sendToTokens', () => {
    const mockNotification: PushNotificationData = {
      title: 'Batch Test',
      body: 'Batch Body'
    };

    it('should send notifications to multiple tokens and handle results', async () => {
      mockFirebaseService.sendToTokens.mockResolvedValueOnce({
        successCount: 2,
        failureCount: 1,
        invalidTokens: ['invalid-token'],
        results: [
          { token: 'token1', success: true, messageId: 'msg-1' },
          { token: 'token2', success: true, messageId: 'msg-2' },
          { token: 'invalid-token', success: false, error: 'Invalid token' }
        ]
      });

      const result = await pushNotificationService.sendToTokens(
        ['token1', 'token2', 'invalid-token'], 
        mockNotification
      );

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.invalidTokens).toEqual(['invalid-token']);
      expect(mockFcmTokenService.deactivateTokens).toHaveBeenCalledWith(['invalid-token']);
    });

    it('should handle service unavailability', async () => {
      mockFirebaseService.isAvailable.mockReturnValue(false);

      const result = await pushNotificationService.sendToTokens(['token1'], mockNotification);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.results[0].error).toBe('Push notification service is not available');
    });
  });

  describe('sendToUser', () => {
    const mockNotification: PushNotificationData = {
      title: 'User Test',
      body: 'User Body'
    };

    it('should send notifications to all user tokens', async () => {
      
      mockFcmTokenService.getUserTokens.mockResolvedValueOnce([
        { token: 'token1', platform: 'android' },
        { token: 'token2', platform: 'ios' }
      ] as any);

      mockFirebaseService.sendToTokens.mockResolvedValueOnce({
        successCount: 2,
        failureCount: 0,
        invalidTokens: [],
        results: [
          { token: 'token1', success: true, messageId: 'msg-1' },
          { token: 'token2', success: true, messageId: 'msg-2' }
        ]
      });

      const result = await pushNotificationService.sendToUser('user-1', mockNotification);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(mockFcmTokenService.getUserTokens).toHaveBeenCalledWith('user-1');
    });

    it('should return empty result when user has no tokens', async () => {
      mockFcmTokenService.getUserTokens.mockResolvedValueOnce([]);

      const result = await pushNotificationService.sendToUser('user-1', mockNotification);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('sendToUsers', () => {
    const mockNotification: PushNotificationData = {
      title: 'Users Test',
      body: 'Users Body'
    };

    it('should send notifications to all users tokens', async () => {
      
      mockFcmTokenService.getUsersTokens.mockResolvedValueOnce([
        { token: 'token1', userId: 'user-1' },
        { token: 'token2', userId: 'user-2' }
      ] as any);

      mockFirebaseService.sendToTokens.mockResolvedValueOnce({
        successCount: 2,
        failureCount: 0,
        invalidTokens: [],
        results: [
          { token: 'token1', success: true, messageId: 'msg-1' },
          { token: 'token2', success: true, messageId: 'msg-2' }
        ]
      });

      const result = await pushNotificationService.sendToUsers(['user-1', 'user-2'], mockNotification);

      expect(result.successCount).toBe(2);
      expect(mockFcmTokenService.getUsersTokens).toHaveBeenCalledWith(['user-1', 'user-2']);
    });
  });

  describe('validateToken', () => {
    it('should validate token and update last used on valid token', async () => {
      mockFirebaseService.validateToken.mockResolvedValueOnce(true);

      const result = await pushNotificationService.validateToken('valid-token');

      expect(result).toBe(true);
      expect(mockFcmTokenService.updateTokenLastUsed).toHaveBeenCalledWith('valid-token');
    });

    it('should deactivate invalid token', async () => {
      mockFirebaseService.validateToken.mockResolvedValueOnce(false);

      const result = await pushNotificationService.validateToken('invalid-token');

      expect(result).toBe(false);
      expect(mockFcmTokenService.deactivateToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should return false when service is not available', async () => {
      mockFirebaseService.isAvailable.mockReturnValue(false);

      const result = await pushNotificationService.validateToken('test-token');

      expect(result).toBe(false);
    });
  });

  describe('Topic management', () => {
    it('should subscribe token to topic', async () => {
      mockFirebaseService.subscribeToTopic.mockResolvedValueOnce(true);

      const result = await pushNotificationService.subscribeToTopic('test-token', 'test-topic');

      expect(result).toBe(true);
      expect(mockFirebaseService.subscribeToTopic).toHaveBeenCalledWith('test-token', 'test-topic');
    });

    it('should unsubscribe token from topic', async () => {
      mockFirebaseService.unsubscribeFromTopic.mockResolvedValueOnce(true);

      const result = await pushNotificationService.unsubscribeFromTopic('test-token', 'test-topic');

      expect(result).toBe(true);
      expect(mockFirebaseService.unsubscribeFromTopic).toHaveBeenCalledWith('test-token', 'test-topic');
    });

    it('should return false when service is not available', async () => {
      mockFirebaseService.isAvailable.mockReturnValue(false);

      const subscribeResult = await pushNotificationService.subscribeToTopic('test-token', 'test-topic');
      const unsubscribeResult = await pushNotificationService.unsubscribeFromTopic('test-token', 'test-topic');

      expect(subscribeResult).toBe(false);
      expect(unsubscribeResult).toBe(false);
    });
  });

  describe('Convenience methods', () => {
    describe('sendScheduleSlotNotification', () => {
      it('should send schedule slot notification with proper formatting', async () => {
        // Spy on sendToUsers method
        const sendToUsersSpy = jest.spyOn(pushNotificationService, 'sendToUsers').mockResolvedValueOnce({
          successCount: 1,
          failureCount: 0,
          invalidTokens: [],
          results: [{ token: 'token1', success: true, messageId: 'msg-1' }]
        });

        const result = await pushNotificationService.sendScheduleSlotNotification(
          ['user-1'],
          {
            groupName: 'Test Group',
            datetime: '2024-03-15T08:00:00Z',
            changeType: 'SLOT_CREATED',
            assignedChildren: ['Child 1'],
            vehicles: [{ name: 'Car 1', driverName: 'Driver 1' }]
          }
        );

        expect(result.successCount).toBe(1);
        expect(sendToUsersSpy).toHaveBeenCalledWith(
          ['user-1'],
          expect.objectContaining({
            title: 'EduLift - Test Group',
            body: expect.stringContaining('New slot created'),
            data: expect.objectContaining({
              type: 'schedule_slot_change',
              groupName: 'Test Group',
              changeType: 'SLOT_CREATED'
            })
          })
        );
        
        sendToUsersSpy.mockRestore();
      });
    });

    describe('sendFamilyInvitationNotification', () => {
      it('should send family invitation notification', async () => {
        // Spy on sendToUser method
        const sendToUserSpy = jest.spyOn(pushNotificationService, 'sendToUser').mockResolvedValueOnce({
          successCount: 1,
          failureCount: 0,
          invalidTokens: [],
          results: [{ token: 'token1', success: true, messageId: 'msg-1' }]
        });

        const result = await pushNotificationService.sendFamilyInvitationNotification(
          'user-1',
          {
            familyName: 'Test Family',
            inviterName: 'John Doe',
            inviteCode: 'ABC123'
          }
        );

        expect(result.successCount).toBe(1);
        expect(sendToUserSpy).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            title: 'EduLift - Family Invitation',
            body: 'John Doe invited you to join family "Test Family"',
            data: expect.objectContaining({
              type: 'family_invitation',
              familyName: 'Test Family',
              inviteCode: 'ABC123'
            })
          })
        );
        
        sendToUserSpy.mockRestore();
      });
    });

    describe('sendGroupInvitationNotification', () => {
      it('should send group invitation notification', async () => {
        // Spy on sendToUser method
        const sendToUserSpy = jest.spyOn(pushNotificationService, 'sendToUser').mockResolvedValueOnce({
          successCount: 1,
          failureCount: 0,
          invalidTokens: [],
          results: [{ token: 'token1', success: true, messageId: 'msg-1' }]
        });

        const result = await pushNotificationService.sendGroupInvitationNotification(
          'user-1',
          {
            groupName: 'Test Group',
            inviterName: 'Jane Smith',
            inviteCode: 'XYZ789'
          }
        );

        expect(result.successCount).toBe(1);
        expect(sendToUserSpy).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            title: 'EduLift - Group Invitation',
            body: 'Jane Smith invited you to join group "Test Group"',
            data: expect.objectContaining({
              type: 'group_invitation',
              groupName: 'Test Group',
              inviteCode: 'XYZ789'
            })
          })
        );
        
        sendToUserSpy.mockRestore();
      });
    });
  });

  describe('Token management delegation', () => {
    it('should delegate saveToken to FcmTokenService', async () => {
      const tokenData = { userId: 'user-1', token: 'token-1', platform: 'android' } as any;
      mockFcmTokenService.saveToken.mockResolvedValueOnce(tokenData);

      const result = await pushNotificationService.saveToken(tokenData);

      expect(result).toBe(tokenData);
      expect(mockFcmTokenService.saveToken).toHaveBeenCalledWith(tokenData);
    });

    it('should delegate getUserTokens to FcmTokenService', async () => {
      const tokens = [{ token: 'token-1' }] as any;
      mockFcmTokenService.getUserTokens.mockResolvedValueOnce(tokens);

      const result = await pushNotificationService.getUserTokens('user-1');

      expect(result).toBe(tokens);
      expect(mockFcmTokenService.getUserTokens).toHaveBeenCalledWith('user-1');
    });

    it('should delegate deleteToken to FcmTokenService', async () => {
      await pushNotificationService.deleteToken('token-1');

      expect(mockFcmTokenService.deleteToken).toHaveBeenCalledWith('token-1');
    });

    it('should delegate cleanupInactiveTokens to FcmTokenService', async () => {
      mockFcmTokenService.cleanupInactiveTokens.mockResolvedValueOnce(5);

      const result = await pushNotificationService.cleanupInactiveTokens(30);

      expect(result).toBe(5);
      expect(mockFcmTokenService.cleanupInactiveTokens).toHaveBeenCalledWith(30);
    });
  });
});