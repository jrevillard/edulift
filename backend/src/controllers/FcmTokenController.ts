/**
 * FCM Token Controller - OpenAPI Hono Native
 *
 * OpenAPI native Hono controller for FCM token management endpoints
 * Pattern: createRoute + app.openapi() + c.req.valid() automatic
 * Workaround for Issue #723: Use c.json(data, status) explicitly
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../config/database';
import { PushNotificationServiceFactory } from '../services/PushNotificationServiceFactory';
import { FcmTokenData, PushNotificationData } from '../types/PushNotificationInterface';
import { createLogger } from '../utils/logger';
import {
  SaveTokenSchema,
  ValidateTokenSchema,
  SubscribeTopicSchema,
  TestNotificationSchema,
  FcmTokenParamsSchema,
  FcmTokenResponseSchema,
  FcmTokenValidationResponseSchema,
  TopicSubscriptionResponseSchema,
  TestNotificationResponseSchema,
  FcmTokenStatsResponseSchema,
} from '../schemas/fcmTokens';

const logger = createLogger('FcmTokenController');

// Hono context type with userId
type FcmTokenVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

// Initialize OpenAPIHono
const app = new OpenAPIHono<{ Variables: FcmTokenVariables }>();

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Error message',
    description: 'Error message',
  }),
  code: z.string().optional().openapi({
    example: 'ERROR_CODE',
    description: 'Error code for programmatic handling',
  }),
});

// Success response schema helper
const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
  return z.object({
    success: z.literal(true),
    data: schema,
  });
};

// Response schema for tokens list
const TokensListResponseSchema = z.object({
  tokens: z.array(FcmTokenResponseSchema),
});

// Response schema for cleanup
const CleanupResponseSchema = z.object({
  message: z.string(),
  cleanedUpTokens: z.number(),
});

// Response schema for delete
const DeleteResponseSchema = z.object({
  message: z.string(),
});

// ============================================================================
// OPENAPI ROUTES DEFINITIONS
// ============================================================================

/**
 * POST / - Save or update an FCM token
 */
const saveTokenRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['FCM Tokens'],
  summary: 'Save FCM token',
  description: 'Save or update an FCM token for the authenticated user',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SaveTokenSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createSuccessSchema(FcmTokenResponseSchema),
        },
      },
      description: 'FCM token saved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * GET / - Get all FCM tokens for the authenticated user
 */
const getTokensRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['FCM Tokens'],
  summary: 'Get user FCM tokens',
  description: 'Get all FCM tokens for the authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(TokensListResponseSchema),
        },
      },
      description: 'FCM tokens retrieved successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * DELETE /cleanup-inactive - Clean up inactive FCM tokens
 */
const cleanupInactiveRoute = createRoute({
  method: 'delete',
  path: '/cleanup-inactive',
  tags: ['FCM Tokens'],
  summary: 'Clean up inactive tokens',
  description: 'Clean up inactive FCM tokens (not used in 30 days)',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(CleanupResponseSchema),
        },
      },
      description: 'Inactive tokens cleaned up successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * DELETE /:tokenId - Delete an FCM token
 */
const deleteTokenRoute = createRoute({
  method: 'delete',
  path: '/{tokenId}',
  tags: ['FCM Tokens'],
  summary: 'Delete FCM token',
  description: 'Delete an FCM token for the authenticated user',
  security: [{ Bearer: [] }],
  request: {
    params: FcmTokenParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(DeleteResponseSchema),
        },
      },
      description: 'FCM token deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'FCM token not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /validate - Validate an FCM token
 */
const validateTokenRoute = createRoute({
  method: 'post',
  path: '/validate',
  tags: ['FCM Tokens'],
  summary: 'Validate FCM token',
  description: 'Validate an FCM token',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidateTokenSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(FcmTokenValidationResponseSchema),
        },
      },
      description: 'Token validation result',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /subscribe-topic - Subscribe to a topic
 */
const subscribeTopicRoute = createRoute({
  method: 'post',
  path: '/subscribe-topic',
  tags: ['FCM Tokens'],
  summary: 'Subscribe to topic',
  description: 'Subscribe an FCM token to a topic',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SubscribeTopicSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(TopicSubscriptionResponseSchema),
        },
      },
      description: 'Successfully subscribed to topic',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'FCM token not found or inactive',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /unsubscribe-topic - Unsubscribe from a topic
 */
const unsubscribeTopicRoute = createRoute({
  method: 'post',
  path: '/unsubscribe-topic',
  tags: ['FCM Tokens'],
  summary: 'Unsubscribe from topic',
  description: 'Unsubscribe an FCM token from a topic',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SubscribeTopicSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(TopicSubscriptionResponseSchema),
        },
      },
      description: 'Successfully unsubscribed from topic',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'FCM token not found or inactive',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * POST /test-notification - Send a test notification
 */
const testNotificationRoute = createRoute({
  method: 'post',
  path: '/test-notification',
  tags: ['FCM Tokens'],
  summary: 'Send test notification',
  description: 'Send a test push notification to user tokens',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: TestNotificationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(TestNotificationResponseSchema),
        },
      },
      description: 'Test notification sent successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'No active FCM tokens found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

/**
 * GET /stats - Get FCM token statistics
 */
const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['FCM Tokens'],
  summary: 'Get FCM statistics',
  description: 'Get FCM token statistics for the authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(FcmTokenStatsResponseSchema),
        },
      },
      description: 'FCM statistics retrieved successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * POST / - Save or update an FCM token
 */
app.openapi(saveTokenRoute, async (c) => {
  const input = c.req.valid('json');
  const userId = c.get('userId');

  logger.info('Saving FCM token:', { userId, deviceId: input.deviceId, fcmPlatform: input.fcmPlatform });

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokenData: FcmTokenData = {
      userId,
      token: input.token,
      deviceId: input.deviceId || null,
      fcmPlatform: input.fcmPlatform,
    };

    const savedToken = await pushService.saveToken(tokenData);

    logger.info('FCM token saved successfully', { userId, tokenId: savedToken.id });

    return c.json({
      success: true,
      data: {
        id: savedToken.id || 'unknown',
        fcmPlatform: savedToken.fcmPlatform,
        deviceId: savedToken.deviceId || null,
        isActive: savedToken.isActive ?? true,
        lastUsed: savedToken.lastUsed?.toISOString() || new Date().toISOString(),
        createdAt: savedToken.lastUsed?.toISOString() || new Date().toISOString(),
      },
    }, 201);
  } catch (error) {
    logger.error('Error saving FCM token:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to save FCM token',
      code: 'SAVE_FAILED',
    }, 500);
  }
});

/**
 * GET / - Get all FCM tokens for the authenticated user
 */
app.openapi(getTokensRoute, async (c) => {
  const userId = c.get('userId');

  try {
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId,
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

    logger.info('Retrieved FCM tokens:', { userId, tokenCount: tokens.length });

    // Map platform to fcmPlatform to match schema
    const tokensWithFcmPlatform = tokens.map(token => ({
      ...token,
      fcmPlatform: token.platform as 'android' | 'ios' | 'web',
      platform: undefined,
    }));

    return c.json({
      success: true,
      data: { tokens: tokensWithFcmPlatform },
    }, 200);
  } catch (error) {
    logger.error('Error retrieving FCM tokens:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve FCM tokens',
      code: 'RETRIEVE_FAILED',
    }, 500);
  }
});

/**
 * DELETE /cleanup-inactive - Clean up inactive FCM tokens
 */
app.openapi(cleanupInactiveRoute, async (c) => {
  const userId = c.get('userId');

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveTokens = await prisma.fcmToken.findMany({
      where: {
        userId,
        lastUsed: {
          lt: thirtyDaysAgo,
        },
      },
    });

    if (inactiveTokens.length === 0) {
      return c.json({
        success: true,
        data: {
          message: 'No inactive tokens found',
          cleanedUpTokens: 0,
        },
      }, 200);
    }

    await prisma.fcmToken.deleteMany({
      where: {
        userId,
        lastUsed: {
          lt: thirtyDaysAgo,
        },
      },
    });

    logger.info('Inactive FCM tokens cleaned up:', {
      userId,
      cleanedUpTokens: inactiveTokens.length,
    });

    return c.json({
      success: true,
      data: {
        message: 'Inactive tokens cleaned up successfully',
        cleanedUpTokens: inactiveTokens.length,
      },
    }, 200);
  } catch (error) {
    logger.error('Error cleaning up inactive tokens:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to clean up inactive tokens',
      code: 'CLEANUP_FAILED',
    }, 500);
  }
});

/**
 * DELETE /:tokenId - Delete an FCM token
 */
app.openapi(deleteTokenRoute, async (c) => {
  const { tokenId } = c.req.valid('param');
  const userId = c.get('userId');

  try {
    const token = await prisma.fcmToken.findFirst({
      where: {
        id: tokenId,
        userId,
      },
    });

    if (!token) {
      logger.warn('FCM token not found:', { tokenId, userId });
      return c.json({
        success: false,
        error: 'FCM token not found',
        code: 'TOKEN_NOT_FOUND',
      }, 404);
    }

    const pushService = PushNotificationServiceFactory.getInstance(prisma);
    await pushService.deleteToken(tokenId);

    logger.info('FCM token deleted successfully:', { tokenId, userId, platform: token.platform });

    return c.json({
      success: true,
      data: {
        message: 'FCM token deleted successfully',
      },
    }, 200);
  } catch (error) {
    logger.error('Error deleting FCM token:', { userId, tokenId, error });
    return c.json({
      success: false,
      error: 'Failed to delete FCM token',
      code: 'DELETE_FAILED',
    }, 500);
  }
});

/**
 * POST /validate - Validate an FCM token
 */
app.openapi(validateTokenRoute, async (c) => {
  const { token } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const isValid = await pushService.validateToken(token);

    if (isValid) {
      await prisma.fcmToken.updateMany({
        where: {
          userId,
          token,
        },
        data: {
          lastUsed: new Date(),
        },
      });
    }

    logger.info('Token validation result:', { userId, isValid });

    return c.json({
      success: true,
      data: {
        token,
        isValid,
        isServiceAvailable: pushService.isAvailable(),
      },
    }, 200);
  } catch (error) {
    logger.error('Error validating FCM token:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to validate FCM token',
      code: 'VALIDATION_FAILED',
    }, 500);
  }
});

/**
 * POST /subscribe-topic - Subscribe to a topic
 */
app.openapi(subscribeTopicRoute, async (c) => {
  const { topic, token } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const userToken = await prisma.fcmToken.findFirst({
      where: {
        userId,
        token,
        isActive: true,
      },
    });

    if (!userToken) {
      logger.warn('FCM token not found or inactive:', { userId });
      return c.json({
        success: false,
        error: 'FCM token not found or inactive',
        code: 'TOKEN_NOT_FOUND',
      }, 404);
    }

    const subscribed = await pushService.subscribeToTopic(token, topic);

    logger.info('Topic subscription completed:', {
      userId,
      topic,
      token: token.substring(0, 10) + '...',
      subscribed,
    });

    return c.json({
      success: true,
      data: {
        token,
        topic,
        subscribed,
      },
    }, 200);
  } catch (error) {
    logger.error('Error subscribing to topic:', { userId, topic, error });
    return c.json({
      success: false,
      error: 'Failed to subscribe to topic',
      code: 'SUBSCRIBE_FAILED',
    }, 500);
  }
});

/**
 * POST /unsubscribe-topic - Unsubscribe from a topic
 */
app.openapi(unsubscribeTopicRoute, async (c) => {
  const { topic, token } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const userToken = await prisma.fcmToken.findFirst({
      where: {
        userId,
        token,
        isActive: true,
      },
    });

    if (!userToken) {
      logger.warn('FCM token not found or inactive:', { userId });
      return c.json({
        success: false,
        error: 'FCM token not found or inactive',
        code: 'TOKEN_NOT_FOUND',
      }, 404);
    }

    const subscribed = !(await pushService.unsubscribeFromTopic(token, topic));

    logger.info('Topic unsubscription completed:', {
      userId,
      topic,
      token: token.substring(0, 10) + '...',
      unsubscribed: !subscribed,
    });

    return c.json({
      success: true,
      data: {
        token,
        topic,
        subscribed,
      },
    }, 200);
  } catch (error) {
    logger.error('Error unsubscribing from topic:', { userId, topic, error });
    return c.json({
      success: false,
      error: 'Failed to unsubscribe from topic',
      code: 'UNSUBSCRIBE_FAILED',
    }, 500);
  }
});

/**
 * POST /test-notification - Send a test notification
 */
app.openapi(testNotificationRoute, async (c) => {
  const { title, body, data, priority } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const pushService = PushNotificationServiceFactory.getInstance(prisma);

    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    if (tokens.length === 0) {
      logger.warn('No active FCM tokens found:', { userId });
      return c.json({
        success: false,
        error: 'No active FCM tokens found',
        code: 'NO_TOKENS',
      }, 404);
    }

    const notification: PushNotificationData = {
      title,
      body,
      data: {
        type: 'test_notification',
        timestamp: new Date().toISOString(),
        ...data,
      },
    };

    if (priority) {
      notification.priority = priority;
    }

    const results = await pushService.sendToTokens(tokens.map(t => t.token), notification);

    logger.info('Test notification sent:', {
      userId,
      title,
      totalTokens: tokens.length,
      successCount: results.successCount,
      failureCount: results.failureCount,
    });

    return c.json({
      success: true,
      data: {
        successCount: results.successCount,
        failureCount: results.failureCount,
        invalidTokens: results.invalidTokens || [],
        totalTokens: tokens.length,
      },
    }, 200);
  } catch (error) {
    logger.error('Error sending test notification:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to send test notification',
      code: 'SEND_FAILED',
    }, 500);
  }
});

/**
 * GET /stats - Get FCM token statistics
 */
app.openapi(getStatsRoute, async (c) => {
  const userId = c.get('userId');

  try {
    const [userTokens, serviceAvailable] = await Promise.all([
      prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          platform: true,
        },
      }),
      PushNotificationServiceFactory.getInstance(prisma).isAvailable(),
    ]);

    const platforms: Record<string, number> = {};
    userTokens.forEach(token => {
      platforms[token.platform] = (platforms[token.platform] || 0) + 1;
    });

    logger.info('Retrieved FCM token statistics:', { userId, tokenCount: userTokens.length });

    return c.json({
      success: true,
      data: {
        userTokenCount: userTokens.length,
        serviceAvailable,
        platforms,
      },
    }, 200);
  } catch (error) {
    logger.error('Error getting token stats:', { userId, error });
    return c.json({
      success: false,
      error: 'Failed to retrieve token statistics',
      code: 'STATS_FAILED',
    }, 500);
  }
});

export default app;
