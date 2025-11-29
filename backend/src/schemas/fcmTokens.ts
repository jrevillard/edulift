/**
 * FCM Tokens Schemas with OpenAPI Extensions
 *
 * Zod schemas for FCM token management endpoints with OpenAPI documentation
 * Phase 2.3: Migrating FcmTokens schemas to Zod-centric format
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, BearerAuthSecurity, registerPath } from '../config/openapi.js';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Request Schemas
export const SaveTokenSchema = z.object({
  token: z.string()
    .min(1, 'FCM token is required')
    .openapi({
      example: 'fcm_token_string_here',
      description: 'FCM registration token from device',
    }),
  deviceId: z.string()
    .optional()
    .openapi({
      example: 'device_12345',
      description: 'Unique device identifier',
    }),
  fcmPlatform: z.enum(['android', 'ios', 'web'], {
    error: () => 'FCM platform must be android, ios, or web',
  })
    .openapi({
      example: 'android',
      description: 'Platform type for the FCM token',
    }),
}).openapi({
  title: 'Save FCM Token',
  description: 'Request schema for saving or updating an FCM token',
});

export const ValidateTokenSchema = z.object({
  token: z.string()
    .min(1, 'FCM token is required')
    .openapi({
      example: 'fcm_token_string_here',
      description: 'FCM token to validate',
    }),
}).openapi({
  title: 'Validate FCM Token',
  description: 'Request schema for validating an FCM token',
});

export const SubscribeTopicSchema = z.object({
  token: z.string()
    .min(1, 'FCM token is required')
    .openapi({
      example: 'fcm_token_string_here',
      description: 'FCM token to subscribe/unsubscribe',
    }),
  topic: z.string()
    .min(1, 'Topic is required')
    .openapi({
      example: 'group_12345_updates',
      description: 'Topic name for subscription',
    }),
}).openapi({
  title: 'Subscribe/Unsubscribe Topic',
  description: 'Request schema for subscribing or unsubscribing from topics',
});

export const TestNotificationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .openapi({
      example: 'Test Notification',
      description: 'Notification title',
    }),
  body: z.string()
    .min(1, 'Body is required')
    .openapi({
      example: 'This is a test notification from EduLift',
      description: 'Notification body text',
    }),
  data: z.record(z.string(), z.string())
    .optional()
    .openapi({
      example: { custom_key: 'custom_value' },
      description: 'Additional data payload for the notification',
    }),
  priority: z.enum(['high', 'normal'], {
    error: () => 'Priority must be high or normal',
  })
    .optional()
    .openapi({
      example: 'normal',
      description: 'Notification priority level',
    }),
}).openapi({
  title: 'Send Test Notification',
  description: 'Request schema for sending test notifications',
});

// Parameter Schemas
export const FcmTokenParamsSchema = z.object({
  token: z.string()
    .min(1, 'FCM token is required')
    .openapi({
      example: 'fcm_token_string_here',
      description: 'FCM token parameter',
    }),
}).openapi({
  title: 'FCM Token Parameter',
  description: 'Path parameter for FCM token operations',
});

// Response Schemas
export const FcmTokenResponseSchema = z.object({
  id: z.string()
    .openapi({
      example: 'fcm_123456789012345678901234',
      description: 'FCM token unique identifier',
    }),
  fcmPlatform: z.enum(['android', 'ios', 'web'])
    .openapi({
      example: 'android',
      description: 'Platform type',
    }),
  deviceId: z.string()
    .nullable()
    .openapi({
      example: 'device_12345',
      description: 'Device identifier',
    }),
  isActive: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the token is currently active',
    }),
  lastUsed: z.string()
    .datetime()
    .openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'Last time the token was used',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'Token creation timestamp',
    }),
}).openapi({
  title: 'FCM Token Response',
  description: 'FCM token information response',
});

export const FcmTokenValidationResponseSchema = z.object({
  token: z.string()
    .openapi({
      example: 'fcm_token_string_here',
      description: 'The validated token',
    }),
  isValid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the token is valid',
    }),
  isServiceAvailable: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the push notification service is available',
    }),
}).openapi({
  title: 'FCM Token Validation Response',
  description: 'Response for FCM token validation',
});

export const TopicSubscriptionResponseSchema = z.object({
  token: z.string()
    .openapi({
      example: 'fcm_token_string_here',
      description: 'The FCM token',
    }),
  topic: z.string()
    .openapi({
      example: 'group_12345_updates',
      description: 'The topic name',
    }),
  subscribed: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the subscription was successful',
    }),
}).openapi({
  title: 'Topic Subscription Response',
  description: 'Response for topic subscription operations',
});

export const TestNotificationResponseSchema = z.object({
  successCount: z.number()
    .int()
    .openapi({
      example: 2,
      description: 'Number of successfully sent notifications',
    }),
  failureCount: z.number()
    .int()
    .openapi({
      example: 0,
      description: 'Number of failed notifications',
    }),
  invalidTokens: z.string()
    .array()
    .openapi({
      example: [],
      description: 'List of invalid tokens (if any)',
    }),
  totalTokens: z.number()
    .int()
    .openapi({
      example: 2,
      description: 'Total number of tokens attempted',
    }),
}).openapi({
  title: 'Test Notification Response',
  description: 'Response for test notification sending',
});

export const FcmTokenStatsResponseSchema = z.object({
  userTokenCount: z.number()
    .int()
    .openapi({
      example: 3,
      description: 'Number of active tokens for the user',
    }),
  serviceAvailable: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the push notification service is available',
    }),
  platforms: z.record(z.string(), z.number())
    .openapi({
      example: { android: 2, ios: 1 },
      description: 'Token count by platform',
    }),
}).openapi({
  title: 'FCM Token Statistics Response',
  description: 'Response for FCM token statistics',
});

// Success Response Wrappers
export const SaveTokenSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  data: z.object({
    id: z.string()
      .openapi({
        example: 'fcm_123456789012345678901234',
        description: 'FCM token unique identifier',
      }),
    fcmPlatform: z.enum(['android', 'ios', 'web'])
      .openapi({
        example: 'android',
        description: 'Platform type',
      }),
    isActive: z.boolean()
      .openapi({
        example: true,
        description: 'Whether the token is active',
      }),
    createdAt: z.string()
      .datetime()
      .openapi({
        example: '2024-01-15T10:30:00Z',
        description: 'Token creation timestamp',
      }),
  }),
}).openapi({
  title: 'Save Token Success Response',
  description: 'Success response for saving FCM token',
});

export const GetTokensSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  data: FcmTokenResponseSchema.array(),
}).openapi({
  title: 'Get FCM Tokens Success Response',
  description: 'Success response for retrieving user FCM tokens',
});

export const DeleteTokenSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  message: z.string()
    .openapi({
      example: 'FCM token deleted successfully',
      description: 'Success message',
    }),
}).openapi({
  title: 'Delete Token Success Response',
  description: 'Success response for deleting FCM token',
});

export const ValidateTokenSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  data: FcmTokenValidationResponseSchema,
}).openapi({
  title: 'Validate Token Success Response',
  description: 'Success response for validating FCM token',
});

export const TopicSubscriptionSuccessSchema = z.object({
  success: z.boolean()
    .openapi({ example: true }),
  data: TopicSubscriptionResponseSchema,
}).openapi({
  title: 'Topic Subscription Success Response',
  description: 'Success response for topic subscription operations',
});

export const TestNotificationSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  data: TestNotificationResponseSchema,
}).openapi({
  title: 'Test Notification Success Response',
  description: 'Success response for sending test notification',
});

export const FcmTokenStatsSuccessSchema = z.object({
  success: z.literal(true)
    .openapi({ example: true }),
  data: FcmTokenStatsResponseSchema,
}).openapi({
  title: 'FCM Token Statistics Success Response',
  description: 'Success response for FCM token statistics',
});

// Register all schemas with OpenAPI registry