import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { PushNotificationServiceFactory } from '../services/PushNotificationServiceFactory';
import { FcmTokenData } from '../types/PushNotificationInterface';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const SaveTokenSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  deviceId: z.string().optional(),
  platform: z.enum(['android', 'ios', 'web'], {
    errorMap: () => ({ message: 'Platform must be android, ios, or web' })
  })
});

const ValidateTokenSchema = z.object({
  token: z.string().min(1, 'FCM token is required')
});

const SubscribeTopicSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  topic: z.string().min(1, 'Topic is required')
});

const TestNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  data: z.record(z.string()).optional(),
  priority: z.enum(['high', 'normal']).optional()
});

// Middleware to ensure user is authenticated
const requireAuth = (req: Request, res: Response, next: Function): void => {
  if (!req.user || !req.user.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

/**
 * Save or update an FCM token for the authenticated user
 * POST /api/fcm-tokens
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = SaveTokenSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
      return;
    }

    const { token, deviceId, platform } = validation.data;
    const userId = req.user!.id;

    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokenData: FcmTokenData = {
      userId,
      token,
      deviceId: deviceId || null,
      platform
    };

    const savedToken = await pushService.saveToken(tokenData);

    res.status(201).json({
      success: true,
      data: {
        id: savedToken.id,
        platform: savedToken.platform,
        isActive: savedToken.isActive,
        createdAt: savedToken.lastUsed
      }
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({
      error: 'Failed to save FCM token',
      message: (error as Error).message
    });
  }
});

/**
 * Get all active FCM tokens for the authenticated user
 * GET /api/fcm-tokens
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokens = await pushService.getUserTokens(userId);

    const responseData = tokens.map(token => ({
      id: token.id,
      platform: token.platform,
      deviceId: token.deviceId,
      isActive: token.isActive,
      lastUsed: token.lastUsed,
      createdAt: token.lastUsed // Using lastUsed as createdAt for simplicity
    }));

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching FCM tokens:', error);
    res.status(500).json({
      error: 'Failed to fetch FCM tokens',
      message: (error as Error).message
    });
  }
});

/**
 * Delete a specific FCM token
 * DELETE /api/fcm-tokens/:token
 */
router.delete('/:token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const userId = req.user!.id;

    // Verify the token belongs to the authenticated user
    const userTokens = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId
      }
    });

    if (!userTokens) {
      res.status(404).json({
        error: 'FCM token not found or does not belong to user'
      });
      return;
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    await pushService.deleteToken(token);

    res.json({
      success: true,
      message: 'FCM token deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    res.status(500).json({
      error: 'Failed to delete FCM token',
      message: (error as Error).message
    });
  }
});

/**
 * Validate an FCM token
 * POST /api/fcm-tokens/validate
 */
router.post('/validate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ValidateTokenSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
      return;
    }

    const { token } = validation.data;
    const userId = req.user!.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId
      }
    });

    if (!userToken) {
      res.status(404).json({
        error: 'FCM token not found or does not belong to user'
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
        isServiceAvailable: pushService.isAvailable()
      }
    });
  } catch (error) {
    console.error('Error validating FCM token:', error);
    res.status(500).json({
      error: 'Failed to validate FCM token',
      message: (error as Error).message
    });
  }
});

/**
 * Subscribe a token to a topic
 * POST /api/fcm-tokens/subscribe
 */
router.post('/subscribe', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = SubscribeTopicSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
      return;
    }

    const { token, topic } = validation.data;
    const userId = req.user!.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
        isActive: true
      }
    });

    if (!userToken) {
      res.status(404).json({
        error: 'Active FCM token not found or does not belong to user'
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
        subscribed: success
      }
    });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({
      error: 'Failed to subscribe to topic',
      message: (error as Error).message
    });
  }
});

/**
 * Unsubscribe a token from a topic
 * POST /api/fcm-tokens/unsubscribe
 */
router.post('/unsubscribe', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = SubscribeTopicSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
      return;
    }

    const { token, topic } = validation.data;
    const userId = req.user!.id;

    // Verify the token belongs to the authenticated user
    const userToken = await prisma.fcmToken.findFirst({
      where: {
        token,
        userId,
        isActive: true
      }
    });

    if (!userToken) {
      res.status(404).json({
        error: 'Active FCM token not found or does not belong to user'
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
        unsubscribed: success
      }
    });
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({
      error: 'Failed to unsubscribe from topic',
      message: (error as Error).message
    });
  }
});

/**
 * Send a test notification to the user's devices
 * POST /api/fcm-tokens/test
 */
router.post('/test', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = TestNotificationSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors
      });
      return;
    }

    const { title, body, data, priority } = validation.data;
    const userId = req.user!.id;

    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    if (!pushService.isAvailable()) {
      res.status(503).json({
        error: 'Push notification service is not available'
      });
      return;
    }

    const notificationData = {
      title,
      body,
      data: {
        type: 'test_notification',
        timestamp: Date.now().toString(),
        ...data
      },
      priority: priority || 'normal' as 'normal'
    };

    const result = await pushService.sendToUser(userId, notificationData);

    res.json({
      success: true,
      data: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        invalidTokens: result.invalidTokens,
        totalTokens: result.results.length
      }
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      message: (error as Error).message
    });
  }
});

/**
 * Get FCM token statistics (admin endpoint - could be restricted further)
 * GET /api/fcm-tokens/stats
 */
router.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    
    // Get user's token count
    const userId = req.user!.id;
    const userTokens = await pushService.getUserTokens(userId);

    res.json({
      success: true,
      data: {
        userTokenCount: userTokens.length,
        serviceAvailable: pushService.isAvailable(),
        platforms: userTokens.reduce((acc, token) => {
          acc[token.platform] = (acc[token.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Error fetching FCM token stats:', error);
    res.status(500).json({
      error: 'Failed to fetch FCM token statistics',
      message: (error as Error).message
    });
  }
});

export default router;