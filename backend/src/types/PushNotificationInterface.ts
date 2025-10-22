export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  timeToLive?: number; // TTL in seconds
}

export interface FcmTokenData {
  id?: string;
  userId: string;
  token: string;
  deviceId?: string | null;
  platform: 'android' | 'ios' | 'web';
  isActive?: boolean;
  lastUsed?: Date;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidTokens?: string[];
}

export interface BatchPushNotificationResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  results: Array<{
    token: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface PushNotificationServiceInterface {
  /**
   * Send push notification to a single FCM token
   */
  sendToToken(token: string, notification: PushNotificationData): Promise<PushNotificationResult>;

  /**
   * Send push notification to multiple FCM tokens
   */
  sendToTokens(tokens: string[], notification: PushNotificationData): Promise<BatchPushNotificationResult>;

  /**
   * Send push notification to a specific user (all their active tokens)
   */
  sendToUser(userId: string, notification: PushNotificationData): Promise<BatchPushNotificationResult>;

  /**
   * Send push notification to multiple users
   */
  sendToUsers(userIds: string[], notification: PushNotificationData): Promise<BatchPushNotificationResult>;

  /**
   * Send push notification to a topic
   */
  sendToTopic(topic: string, notification: PushNotificationData): Promise<PushNotificationResult>;

  /**
   * Validate an FCM token
   */
  validateToken(token: string): Promise<boolean>;

  /**
   * Subscribe a token to a topic
   */
  subscribeToTopic(token: string, topic: string): Promise<boolean>;

  /**
   * Unsubscribe a token from a topic
   */
  unsubscribeFromTopic(token: string, topic: string): Promise<boolean>;

  /**
   * Check if the service is properly configured and operational
   */
  isAvailable(): boolean;
}

export interface FcmTokenServiceInterface {
  /**
   * Save or update an FCM token
   */
  saveToken(tokenData: FcmTokenData): Promise<FcmTokenData>;

  /**
   * Get all active tokens for a user
   */
  getUserTokens(userId: string): Promise<FcmTokenData[]>;

  /**
   * Get all active tokens for multiple users
   */
  getUsersTokens(userIds: string[]): Promise<FcmTokenData[]>;

  /**
   * Mark a token as inactive
   */
  deactivateToken(token: string): Promise<void>;

  /**
   * Mark multiple tokens as inactive
   */
  deactivateTokens(tokens: string[]): Promise<void>;

  /**
   * Delete a token completely
   */
  deleteToken(token: string): Promise<void>;

  /**
   * Clean up old/inactive tokens
   */
  cleanupInactiveTokens(olderThanDays?: number): Promise<number>;

  /**
   * Update token's last used timestamp
   */
  updateTokenLastUsed(token: string): Promise<void>;
}