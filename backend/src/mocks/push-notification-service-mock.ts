/**
 * PushNotificationService Mock
 *
 * Mock complet pour PushNotificationService utilisable dans les tests
 */

import { FcmTokenData } from '../types/PushNotificationInterface';

export interface PushNotificationServiceMock {
  saveToken: jest.MockedFunction<(tokenData: FcmTokenData) => Promise<any>>
  deleteToken: jest.MockedFunction<(tokenId: string) => Promise<void>>
  validateToken: jest.MockedFunction<(token: string) => Promise<boolean>>
  subscribeToTopic: jest.MockedFunction<(token: string, topic: string) => Promise<boolean>>
  unsubscribeFromTopic: jest.MockedFunction<(token: string, topic: string) => Promise<boolean>>
  sendToTokens: jest.MockedFunction<(tokens: string[], notification: any) => Promise<{
    successCount: number
    failureCount: number
    invalidTokens?: string[]
  }>>
  isAvailable: jest.MockedFunction<() => boolean>
  sendToTopic: jest.MockedFunction<(topic: string, notification: any) => Promise<any>>
  sendToDevice: jest.MockedFunction<(deviceToken: string, notification: any) => Promise<any>>
}

export const mockPushNotificationService: PushNotificationServiceMock = {
  saveToken: jest.fn(),
  deleteToken: jest.fn(),
  validateToken: jest.fn(),
  subscribeToTopic: jest.fn(),
  unsubscribeFromTopic: jest.fn(),
  sendToTokens: jest.fn(),
  isAvailable: jest.fn(),
  sendToTopic: jest.fn(),
  sendToDevice: jest.fn(),
};

// Configure default return values
mockPushNotificationService.saveToken.mockResolvedValue({
  id: 'default_token_id',
  userId: 'default_user_id',
  token: 'default_fcm_token',
  deviceId: 'default_device_id',
  fcmPlatform: 'android',
  isActive: true,
  lastUsed: new Date(),
});

mockPushNotificationService.validateToken.mockResolvedValue(true);
mockPushNotificationService.subscribeToTopic.mockResolvedValue(true);
mockPushNotificationService.unsubscribeFromTopic.mockResolvedValue(true);
mockPushNotificationService.sendToTokens.mockResolvedValue({
  successCount: 1,
  failureCount: 0,
  invalidTokens: [],
});
mockPushNotificationService.isAvailable.mockReturnValue(true);

export default mockPushNotificationService;