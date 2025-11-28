import { prisma } from '../config/database';
import { Router, Response } from 'express';
import { PushNotificationServiceFactory } from '../services/PushNotificationServiceFactory';
import { FcmTokenData } from '../types/PushNotificationInterface';
import { createLogger } from '../utils/logger';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams } from '../middleware/validation';

// Import centralized schemas to trigger OpenAPI registration (Pattern 100%)
// This ensures all FCM schemas are properly documented in the OpenAPI specification
import {
  SaveTokenSchema,
  ValidateTokenSchema,
  SubscribeTopicSchema,
  TestNotificationSchema,
  FcmTokenParamsSchema,
} from '../schemas/fcmTokens';

const logger = createLogger('FCMTokensRoute');

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/fcm-tokens:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Save or update an FCM token
 *     description: Save or update an FCM token for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveToken'
 *     responses:
 *       '201':
 *         description: FCM token saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SaveTokenSuccess'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/',
  validateBody(SaveTokenSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, deviceId, fcmPlatform } = req.body;
    const userId = req.user.id;

    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokenData: FcmTokenData = {
      userId,
      token,
      deviceId: deviceId || null,
      fcmPlatform,
    };

    const savedToken = await pushService.saveToken(tokenData);

    res.status(201).json({
      success: true,
      data: {
        id: savedToken.id,
        fcmPlatform: savedToken.fcmPlatform,
        isActive: savedToken.isActive,
        createdAt: savedToken.lastUsed,
      },
    });
  } catch (error) {
    logger.error('Error saving FCM token:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'SAVE_TOKEN_ERROR',
        message: 'Failed to save FCM token',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens:
 *   get:
 *     tags:
 *       - FCM Tokens
 *     summary: Get all FCM tokens for the authenticated user
 *     description: Retrieve all active FCM tokens associated with the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: FCM tokens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetTokensSuccess'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokens = await pushService.getUserTokens(userId);

    const responseData = tokens.map(token => ({
      id: token.id,
      fcmPlatform: token.fcmPlatform,
      deviceId: token.deviceId,
      isActive: token.isActive,
      lastUsed: token.lastUsed,
      createdAt: token.lastUsed, // Using lastUsed as createdAt for simplicity
    }));

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Error fetching FCM tokens:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TOKENS_ERROR',
        message: 'Failed to fetch FCM tokens',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/{token}:
 *   delete:
 *     tags:
 *       - FCM Tokens
 *     summary: Delete a specific FCM token
 *     description: Delete a specific FCM token that belongs to the authenticated user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: FCM token to delete
 *     responses:
 *       '200':
 *         description: FCM token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteTokenSuccess'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: FCM token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:token',
  validateParams(FcmTokenParamsSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const userId = req.user.id;

    // Verify the token belongs to the authenticated user
    const userTokens = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
      },
    });

    if (!userTokens) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'FCM token not found or does not belong to user',
        },
      });
      return;
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    await pushService.deleteToken(token);

    res.json({
      success: true,
      message: 'FCM token deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting FCM token:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_TOKEN_ERROR',
        message: 'Failed to delete FCM token',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/validate:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Validate an FCM token
 *     description: Validate an FCM token that belongs to the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidateToken'
 *     responses:
 *       '200':
 *         description: FCM token validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidateTokenSuccess'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: FCM token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/validate',
  validateBody(ValidateTokenSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
      },
    });

    if (!userToken) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'FCM token not found or does not belong to user',
        },
      });
      return;
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    const isValid = await pushService.validateToken(token);

    res.json({
      success: true,
      data: {
        token,
        isValid,
        isServiceAvailable: pushService.isAvailable(),
      },
    });
  } catch (error) {
    logger.error('Error validating FCM token:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATE_TOKEN_ERROR',
        message: 'Failed to validate FCM token',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/subscribe:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Subscribe a token to a topic
 *     description: Subscribe an FCM token to a specific topic for notifications
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscribeTopic'
 *     responses:
 *       '200':
 *         description: Topic subscription result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TopicSubscriptionSuccess'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: FCM token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/subscribe',
  validateBody(SubscribeTopicSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, topic } = req.body;
    const userId = req.user.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
        isActive: true,
      },
    });

    if (!userToken) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Active FCM token not found or does not belong to user',
        },
      });
      return;
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    const success = await pushService.subscribeToTopic(token, topic);

    res.json({
      success,
      data: {
        token,
        topic,
        subscribed: success,
      },
    });
  } catch (error) {
    logger.error('Error subscribing to topic:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIBE_ERROR',
        message: 'Failed to subscribe to topic',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/unsubscribe:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Unsubscribe a token from a topic
 *     description: Unsubscribe an FCM token from a specific topic
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscribeTopic'
 *     responses:
 *       '200':
 *         description: Topic unsubscription result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TopicSubscriptionSuccess'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: FCM token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/unsubscribe',
  validateBody(SubscribeTopicSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, topic } = req.body;
    const userId = req.user.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
        isActive: true,
      },
    });

    if (!userToken) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Active FCM token not found or does not belong to user',
        },
      });
      return;
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    const success = await pushService.unsubscribeFromTopic(token, topic);

    res.json({
      success,
      data: {
        token,
        topic,
        unsubscribed: success,
      },
    });
  } catch (error) {
    logger.error('Error unsubscribing from topic:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'UNSUBSCRIBE_ERROR',
        message: 'Failed to unsubscribe from topic',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/test:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Send a test notification
 *     description: Send a test notification to the authenticated user's devices
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestNotification'
 *     responses:
 *       '200':
 *         description: Test notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestNotificationSuccess'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/test',
  validateBody(TestNotificationSchema),
  asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, body, data, priority } = req.body;
    const userId = req.user.id;

    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    if (!pushService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Push notification service is not available',
        },
      });
      return;
    }

    const notificationData = {
      title,
      body,
      data: {
        type: 'test_notification',
        timestamp: Date.now().toString(),
        ...data,
      },
      priority: priority || 'normal' as const,
    };

    const result = await pushService.sendToUser(userId, notificationData);

    res.json({
      success: true,
      data: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        invalidTokens: result.invalidTokens,
        totalTokens: result.results.length,
      },
    });
  } catch (error) {
    logger.error('Error sending test notification:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_TEST_NOTIFICATION_ERROR',
        message: 'Failed to send test notification',
        details: (error as Error).message,
      },
    });
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/stats:
 *   get:
 *     tags:
 *       - FCM Tokens
 *     summary: Get FCM token statistics
 *     description: Get FCM token statistics for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: FCM token statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FcmTokenStatsSuccess'
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/stats', asyncHandler<AuthenticatedRequest>(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    // Get user's token count
    const userId = req.user.id;
    const userTokens = await pushService.getUserTokens(userId);

    res.json({
      success: true,
      data: {
        userTokenCount: userTokens.length,
        serviceAvailable: pushService.isAvailable(),
        platforms: userTokens.reduce((acc, token) => {
          acc[token.fcmPlatform] = (acc[token.fcmPlatform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    logger.error('Error fetching FCM token stats:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATS_ERROR',
        message: 'Failed to fetch FCM token statistics',
        details: (error as Error).message,
      },
    });
  }
}));

export default router;