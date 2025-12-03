import { prisma } from '../config/database';
import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PushNotificationServiceFactory } from '../services/PushNotificationServiceFactory';
import { FcmTokenData } from '../types/PushNotificationInterface';
import { createLogger } from '../utils/logger';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams } from '../middleware/validation';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseValidation';
import { SimpleSuccessResponseSchema } from '../schemas/responses';

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
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', validateBody(SaveTokenSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, deviceId, fcmPlatform } = req.body;
  const userId = req.userId;

  logger.info('Saving FCM token:', { userId, deviceId, fcmPlatform });

  if (!token || !fcmPlatform) {
    return sendErrorResponse(res, 400, 'FCM token and platform are required');
  }

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokenData: FcmTokenData = {
      userId: userId!,
      token,
      deviceId: deviceId || null,
      fcmPlatform,
    };

    const savedToken = await pushService.saveToken(tokenData);

    sendSuccessResponse(res, 201, SimpleSuccessResponseSchema, {
      id: savedToken.id,
      fcmPlatform: savedToken.fcmPlatform,
      isActive: savedToken.isActive,
      createdAt: savedToken.lastUsed,
    });
  } catch (error) {
    logger.error('Error saving FCM token:', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to save FCM token');
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
 *               $ref: '#/components/schemas/TokensList'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;

  try {
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId: userId!,
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
        // Don't return the actual token in list for security
      },
    });

    logger.info('Retrieved FCM tokens:', { userId, tokenCount: tokens.length });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { tokens });
  } catch (error) {
    logger.error('Error retrieving FCM tokens:', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to retrieve FCM tokens');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/{tokenId}:
 *   delete:
 *     tags:
 *       - FCM Tokens
 *     summary: Delete an FCM token
 *     description: Delete a specific FCM token for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: FCM token ID
 *     responses:
 *       '200':
 *         description: FCM token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteTokenSuccess'
 *       '404':
 *         description: Token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:tokenId', validateParams(FcmTokenParamsSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tokenId } = req.params;
  const userId = req.userId;

  try {
    // First check if the token belongs to the authenticated user
    const token = await prisma.fcmToken.findFirst({
      where: {
        id: tokenId,
        userId: userId!,
      },
    });

    if (!token) {
      return sendErrorResponse(res, 404, 'FCM token not found');
    }

    // Get the platform service to unsubscribe from all topics
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    // Delete the token (this will also handle platform-specific cleanup)
    await pushService.deleteToken(tokenId);

    logger.info('FCM token deleted successfully:', { tokenId, userId, platform: token.platform });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      message: 'FCM token deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting FCM token:', { error: error instanceof Error ? error.message : String(error), tokenId });
    sendErrorResponse(res, 500, 'Failed to delete FCM token');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/validate:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Validate an FCM token
 *     description: Validate if an FCM token is still valid and active
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
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidateTokenSuccess'
 *       '400':
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/validate', validateBody(ValidateTokenSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, fcmPlatform } = req.body;
  const userId = req.userId;

  if (!token || !fcmPlatform) {
    return sendErrorResponse(res, 400, 'FCM token and platform are required');
  }

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const isValid = await pushService.validateToken(token);

    // Update lastUsed timestamp if token is valid
    if (isValid) {
      await prisma.fcmToken.updateMany({
        where: {
          userId: userId!,
          token,
          platform: fcmPlatform,
        },
        data: {
          lastUsed: new Date(),
        },
      });
    }

    logger.info('Token validation result:', { userId, fcmPlatform, isValid });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      isValid,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error validating FCM token:', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to validate FCM token');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/subscribe-topic:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Subscribe to a topic
 *     description: Subscribe the authenticated user's FCM token(s) to a specific topic
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
 *         description: Successfully subscribed to topic
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscribeTopicSuccess'
 *       '400':
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/subscribe-topic', validateBody(SubscribeTopicSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { topic, fcmPlatform, deviceId } = req.body;
  const userId = req.userId;

  if (!topic || !fcmPlatform) {
    return sendErrorResponse(res, 400, 'Topic and platform are required');
  }

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    // Get active tokens for the user, optionally filtered by device
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId: userId!,
        platform: fcmPlatform,
        isActive: true,
        ...(deviceId && { deviceId }),
      },
    });

    if (tokens.length === 0) {
      return sendErrorResponse(res, 404, 'No active FCM tokens found for this platform');
    }

    // Subscribe each token individually since batch method doesn't exist
    const subscriptionPromises = tokens.map((t: Prisma.FcmTokenGetPayload<{ select: { token: true } }>) =>
      pushService.subscribeToTopic(t.token, topic),
    );
    const subscriptionResults = await Promise.all(subscriptionPromises);

    const successfulSubscriptions = subscriptionResults.filter(Boolean).length;
    const results = tokens.map((t: Prisma.FcmTokenGetPayload<{ select: { token: true } }>, index: number) => ({
      token: t.token,
      success: subscriptionResults[index] || false,
    }));

    if (successfulSubscriptions === 0) {
      return sendErrorResponse(res, 500, 'Failed to subscribe to topic');
    }

    logger.info('Topic subscription completed:', {
      userId,
      topic,
      fcmPlatform,
      totalTokens: tokens.length,
      successfulSubscriptions,
    });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      topic,
      subscribedTokens: successfulSubscriptions,
      totalTokens: tokens.length,
      results,
    });
  } catch (error) {
    logger.error('Error subscribing to topic:', { error: error instanceof Error ? error.message : String(error), topic });
    sendErrorResponse(res, 500, 'Failed to subscribe to topic');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/unsubscribe-topic:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Unsubscribe from a topic
 *     description: Unsubscribe the authenticated user's FCM token(s) from a specific topic
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscribeTopic' // Reuse same schema for unsubscribe
 *     responses:
 *       '200':
 *         description: Successfully unsubscribed from topic
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscribeTopicSuccess'
 *       '400':
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/unsubscribe-topic', validateBody(SubscribeTopicSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { topic, fcmPlatform, deviceId } = req.body;
  const userId = req.userId;

  if (!topic || !fcmPlatform) {
    return sendErrorResponse(res, 400, 'Topic and platform are required');
  }

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    // Get active tokens for the user, optionally filtered by device
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId: userId!,
        platform: fcmPlatform,
        isActive: true,
        ...(deviceId && { deviceId }),
      },
    });

    if (tokens.length === 0) {
      return sendErrorResponse(res, 404, 'No active FCM tokens found for this platform');
    }

    // Unsubscribe each token individually since batch method doesn't exist
    const unsubscriptionPromises = tokens.map((t: Prisma.FcmTokenGetPayload<{ select: { token: true } }>) =>
      pushService.unsubscribeFromTopic(t.token, topic),
    );
    const unsubscriptionResults = await Promise.all(unsubscriptionPromises);

    const successfulUnsubscriptions = unsubscriptionResults.filter(Boolean).length;
    const results = tokens.map((t: Prisma.FcmTokenGetPayload<{ select: { token: true } }>, index: number) => ({
      token: t.token,
      success: unsubscriptionResults[index] || false,
    }));

    logger.info('Topic unsubscription completed:', {
      userId,
      topic,
      fcmPlatform,
      totalTokens: tokens.length,
      successfulUnsubscriptions,
    });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      topic,
      unsubscribedTokens: successfulUnsubscriptions,
      totalTokens: tokens.length,
      results,
    });
  } catch (error) {
    logger.error('Error unsubscribing from topic:', { error: error instanceof Error ? error.message : String(error), topic });
    sendErrorResponse(res, 500, 'Failed to unsubscribe from topic');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/test-notification:
 *   post:
 *     tags:
 *       - FCM Tokens
 *     summary: Send a test notification
 *     description: Send a test notification to the authenticated user's device(s)
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
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: No active tokens found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/test-notification', validateBody(TestNotificationSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title, body, fcmPlatform, deviceId } = req.body;
  const userId = req.userId;

  if (!title || !body || !fcmPlatform) {
    return sendErrorResponse(res, 400, 'Title, body, and platform are required');
  }

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    // Get active tokens for the user, optionally filtered by device
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId: userId!,
        platform: fcmPlatform,
        isActive: true,
        ...(deviceId && { deviceId }),
      },
    });

    if (tokens.length === 0) {
      return sendErrorResponse(res, 404, 'No active FCM tokens found for this platform');
    }

    const notification = {
      title,
      body,
      data: {
        type: 'test_notification',
        timestamp: new Date().toISOString(),
      },
    };

    const results = await pushService.sendToTokens(tokens.map((t: Prisma.FcmTokenGetPayload<{ select: { token: true } }>) => t.token), notification);

    const successfulSends = results.successCount;

    logger.info('Test notification sent:', {
      userId,
      title,
      fcmPlatform,
      totalTokens: tokens.length,
      successfulSends,
    });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      message: 'Test notification sent',
      totalTokens: tokens.length,
      successfulSends,
      failedSends: tokens.length - successfulSends,
      results,
    });
  } catch (error) {
    logger.error('Error sending test notification:', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to send test notification');
  }
}));

/**
 * @swagger
 * /api/fcm-tokens/cleanup-inactive:
 *   delete:
 *     tags:
 *       - FCM Tokens
 *     summary: Clean up inactive FCM tokens
 *     description: Remove inactive FCM tokens for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Inactive tokens cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CleanupSuccess'
 *       '500':
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/cleanup-inactive', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;

  try {
    // Find tokens that haven't been used in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveTokens = await prisma.fcmToken.findMany({
      where: {
        userId: userId!,
        lastUsed: {
          lt: thirtyDaysAgo,
        },
      },
    });

    if (inactiveTokens.length === 0) {
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
        message: 'No inactive tokens found',
        cleanedUpTokens: 0,
      });
      return;
    }

    // Delete inactive tokens
    await prisma.fcmToken.deleteMany({
      where: {
        userId: userId!,
        lastUsed: {
          lt: thirtyDaysAgo,
        },
      },
    });

    logger.info('Inactive FCM tokens cleaned up:', {
      userId,
      cleanedUpTokens: inactiveTokens.length,
    });

    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      message: 'Inactive tokens cleaned up successfully',
      cleanedUpTokens: inactiveTokens.length,
    });
  } catch (error) {
    logger.error('Error cleaning up inactive tokens:', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to clean up inactive tokens');
  }
}));

export default router;