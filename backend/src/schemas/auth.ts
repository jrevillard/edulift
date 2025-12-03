/**
 * Authentication Schemas with OpenAPI Extensions
 *
 * Zod schemas for authentication endpoints with OpenAPI documentation
 * Phase 2.3: Migrating Auth schemas to Zod-centric format
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Request Schemas
export const RequestMagicLinkSchema = z.object({
  email: z.email()
    .openapi({
      example: 'user@example.com',
      description: 'User email address for authentication',
    }),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional()
    .openapi({
      example: 'John Doe',
      description: 'User display name (required for new users, optional for existing users)',
    }),
  timezone: z.string()
    .optional()
    .openapi({
      example: 'America/New_York',
      description: 'User timezone (IANA format, optional)',
    }),
  inviteCode: z.string()
    .optional()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Invitation code for joining family or group (optional)',
    }),
  code_challenge: z.string()
    .min(43, 'PKCE code challenge must be at least 43 characters')
    .max(128, 'PKCE code challenge must be at most 128 characters')
    .openapi({
      example: 'aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG',
      description: 'PKCE code challenge for security (optional but recommended)',
    }),
}).openapi({
  title: 'Request Magic Link',
  description: 'Request a magic link for passwordless authentication',
});

export const VerifyMagicLinkSchema = z.object({
  token: z.string()
    .min(1, 'Token is required')
    .openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'Magic link token received in email',
    }),
  code_verifier: z.string()
    .min(43, 'PKCE code verifier must be at least 43 characters')
    .max(128, 'PKCE code verifier must be at most 128 characters')
    .openapi({
      example: 'aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG',
      description: 'PKCE code verifier for security (required)',
    }),
}).openapi({
  title: 'Verify Magic Link',
  description: 'Verify magic link token and get JWT tokens',
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string()
    .min(1, 'Refresh token is required')
    .openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'Valid refresh token for token rotation',
    }),
}).openapi({
  title: 'Refresh Token',
  description: 'Refresh JWT access token using refresh token',
});

export const LogoutSchema = z.object({
  token: z.string()
    .optional()
    .openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'Refresh token to revoke (optional, will revoke all tokens for user if not provided)',
    }),
  token_type_hint: z.enum(['refresh_token'])
    .optional()
    .openapi({
      example: 'refresh_token',
      description: 'Token type hint (optional)',
    }),
}).openapi({
  title: 'Logout Request',
  description: 'RFC 7009 compliant token revocation request',
});

export const UpdateProfileSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional()
    .openapi({
      example: 'John Doe',
      description: 'User display name',
    }),
  email: z.email()
    .optional()
    .openapi({
      example: 'user@example.com',
      description: 'User email address',
    }),
  timezone: z.string()
    .optional()
    .openapi({
      example: 'America/New_York',
      description: 'User timezone (IANA format)',
    }),
}).refine(
  (data) => data.name || data.email || data.timezone,
  { message: 'At least one field (name, email, or timezone) must be provided' },
).openapi({
  title: 'Update Profile',
  description: 'Update user profile information',
});

export const UpdateTimezoneSchema = z.object({
  timezone: z.string()
    .min(1, 'Timezone is required')
    .openapi({
      example: 'America/New_York',
      description: 'Valid IANA timezone (e.g., America/New_York, Europe/Paris)',
    }),
}).openapi({
  title: 'Update Timezone',
  description: 'Update user timezone setting',
});


export const RequestAccountDeletionSchema = z.object({
  code_challenge: z.string()
    .min(43, 'PKCE code challenge must be at least 43 characters')
    .max(128, 'PKCE code challenge must be at most 128 characters')
    .openapi({
      example: 'aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG',
      description: 'PKCE code challenge for secure account deletion confirmation email',
    }),
}).openapi({
  title: 'Request Account Deletion',
  description: 'Request a secure account deletion confirmation email with PKCE-protected link',
});

export const ConfirmAccountDeletionSchema = z.object({
  token: z.string()
    .min(1, 'Deletion token is required')
    .openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'Deletion confirmation token received in email',
    }),
  code_verifier: z.string()
    .min(43, 'PKCE code verifier must be at least 43 characters')
    .max(128, 'PKCE code verifier must be at most 128 characters')
    .openapi({
      example: 'aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG',
      description: 'PKCE code verifier to validate the deletion token',
    }),
}).openapi({
  title: 'Confirm Account Deletion',
  description: 'Confirm account deletion using PKCE-protected token from email',
});

// Response Schemas
export const UserResponseSchema = z.object({
  id: z.string()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'User ID',
    }),
  email: z.email()
    .openapi({
      example: 'user@example.com',
      description: 'User email address',
    }),
  name: z.string()
    .openapi({
      example: 'John Doe',
      description: 'User display name',
    }),
  timezone: z.string()
    .nullable()
    .openapi({
      example: 'America/New_York',
      description: 'User timezone (IANA format)',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'User creation timestamp',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Last update timestamp',
    }),
}).openapi({
  title: 'User Response',
  description: 'User profile information',
});

export const AuthResponseSchema = z.object({
  success: z.boolean()
    .openapi({
      example: true,
      description: 'Request success status',
    }),
  data: z.object({
    user: UserResponseSchema,
    accessToken: z.string()
      .openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'JWT access token (15 minute lifetime)',
      }),
    refreshToken: z.string()
      .openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'JWT refresh token (7 day lifetime)',
      }),
    expiresIn: z.number()
      .openapi({
        example: 900,
        description: 'Access token expiration time in seconds',
      }),
    tokenType: z.string()
      .openapi({
        example: 'Bearer',
        description: 'Token type',
      }),
    // Legacy fields for backward compatibility
    token: z.string()
      .optional()
      .openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Legacy access token field (deprecated, use accessToken)',
      }),
    expiresAt: z.iso.datetime()
      .optional()
      .openapi({
        example: '2023-01-01T00:15:00.000Z',
        description: 'Legacy expiration timestamp (deprecated, use expiresIn)',
      }),
    invitationResult: z.object({
      processed: z.boolean()
        .openapi({
          example: true,
          description: 'Whether invitation was processed',
        }),
      invitationType: z.enum(['FAMILY', 'GROUP'])
        .optional()
        .openapi({
          example: 'FAMILY',
          description: 'Type of invitation processed',
        }),
      redirectUrl: z.string()
        .optional()
        .openapi({
          example: '/dashboard',
          description: 'URL to redirect after processing',
        }),
      requiresFamilyOnboarding: z.boolean()
        .optional()
        .openapi({
          example: false,
          description: 'Whether family onboarding is required',
        }),
      reason: z.string()
        .optional()
        .openapi({
          example: 'Already a member of this family',
          description: 'Reason if invitation processing failed',
        }),
    })
      .nullable()
      .optional()
      .openapi({
        description: 'Invitation processing result (if applicable)',
      }),
  }),
}).openapi({
  title: 'Authentication Response',
  description: 'Authentication response with JWT tokens and user information',
});

export const RefreshTokenResponseSchema = z.object({
  success: z.boolean()
    .openapi({
      example: true,
      description: 'Request success status',
    }),
  data: z.object({
    accessToken: z.string()
      .openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'New JWT access token',
      }),
    refreshToken: z.string()
      .openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'New JWT refresh token (rotated for security)',
      }),
    expiresIn: z.number()
      .openapi({
        example: 900,
        description: 'Access token expiration time in seconds',
      }),
    tokenType: z.string()
      .openapi({
        example: 'Bearer',
        description: 'Token type',
      }),
  }),
}).openapi({
  title: 'Refresh Token Response',
  description: 'Token refresh response with new JWT tokens',
});

// Dedicated response schemas for profile endpoints
export const ProfileUpdateResponseSchema = z.object({
  success: z.literal(true),
  data: UserResponseSchema,
}).openapi({
  title: 'Profile Update Response',
  description: 'Successful profile update response with user data',
});

export const ProfileGetResponseSchema = z.object({
  success: z.literal(true),
  data: UserResponseSchema,
}).openapi({
  title: 'Profile Get Response',
  description: 'Successful profile retrieval response with user data',
});

export const DeleteAccountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string()
      .openapi({
        example: 'Account deleted successfully',
        description: 'Confirmation message indicating successful account deletion',
      }),
    deletedAt: z.string()
      .openapi({
        example: '2023-12-01T12:00:00.000Z',
        description: 'Timestamp when the account was deleted (ISO 8601 format)',
      }),
  }),
}).openapi({
  title: 'Account Deletion Response',
  description: 'Successful account deletion response with confirmation details',
});


// Register schemas with OpenAPI registry
registry.register('RequestMagicLink', RequestMagicLinkSchema);
registry.register('VerifyMagicLink', VerifyMagicLinkSchema);
registry.register('RefreshTokenRequest', RefreshTokenSchema);
registry.register('LogoutRequest', LogoutSchema);
registry.register('UpdateProfileRequest', UpdateProfileSchema);
registry.register('UpdateTimezoneRequest', UpdateTimezoneSchema);
registry.register('RequestAccountDeletion', RequestAccountDeletionSchema);
registry.register('ConfirmAccountDeletion', ConfirmAccountDeletionSchema);
registry.register('AuthResponse', AuthResponseSchema);
registry.register('RefreshTokenResponse', RefreshTokenResponseSchema);
registry.register('ProfileUpdateResponse', ProfileUpdateResponseSchema);
registry.register('ProfileGetResponse', ProfileGetResponseSchema);
registry.register('DeleteAccountResponse', DeleteAccountResponseSchema);


// Register API paths with simplified response schemas
registerPath({
  method: 'post',
  path: '/auth/magic-link',
  tags: ['Authentication'],
  summary: 'Request magic link for authentication',
  description: 'Send a magic link to the user email for passwordless authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RequestMagicLink' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Magic link sent successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              message: z.string(),
              userExists: z.boolean(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    422: {
      description: 'Unprocessable entity - Validation failed',
    },
  },
});

registerPath({
  method: 'post',
  path: '/auth/verify',
  tags: ['Authentication'],
  summary: 'Verify magic link and get JWT token',
  description: 'Verify the magic link token and code verifier to authenticate the user and receive JWT tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/VerifyMagicLink' },
        },
      },
    },
    query: z.object({
      inviteCode: z.string().optional().describe('Invitation code for joining family or group'),
    }),
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AuthResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Invalid or expired magic link',
    },
  },
});

registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh JWT token',
  description: 'Refresh the JWT access token using a valid refresh token with token rotation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Token refreshed successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RefreshTokenResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Refresh token required',
    },
    401: {
      description: 'Unauthorized - Invalid or expired refresh token',
    },
  },
});

registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Authentication'],
  summary: 'Logout and revoke refresh tokens',
  description: 'Revoke the refresh token to logout the user (RFC 7009 compliant)',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/LogoutRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Logout successful',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'put',
  path: '/auth/profile',
  tags: ['Authentication'],
  summary: 'Update user profile',
  description: 'Update the authenticated user profile information',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ProfileUpdateResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or timezone',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'patch',
  path: '/auth/timezone',
  tags: ['Authentication'],
  summary: 'Update user timezone',
  description: 'Update the authenticated user timezone setting',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateTimezoneRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Timezone updated successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ProfileUpdateResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Invalid timezone format',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'get',
  path: '/auth/profile',
  tags: ['Authentication'],
  summary: 'Get user profile',
  description: 'Get the authenticated user profile information',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Profile retrieved successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ProfileGetResponse' },
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});


registerPath({
  method: 'post',
  path: '/auth/profile/delete-request',
  tags: ['Authentication'],
  summary: 'Request account deletion confirmation',
  description: 'Send a confirmation email with PKCE-protected link for account deletion. This initiates a secure two-step deletion process to prevent accidental account loss.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RequestAccountDeletion' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Account deletion confirmation email sent successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              message: z.string()
                .openapi({
                  example: 'Account deletion confirmation email sent. Please check your inbox and follow the link to confirm deletion.',
                  description: 'Success message indicating the confirmation email has been sent',
                }),
              expiresAt: z.string()
                .openapi({
                  example: '2023-12-01T12:00:00.000Z',
                  description: 'Expiration time of the deletion confirmation link (ISO 8601 format)',
                }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid PKCE code challenge',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string()
              .openapi({
                example: 'Invalid PKCE code challenge format',
                description: 'Error message explaining the validation failure',
              }),
            validationErrors: z.array(z.object({
              field: z.string(),
              message: z.string(),
              code: z.string(),
            })).optional(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Not found - User account not found',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error - Failed to send confirmation email',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registerPath({
  method: 'post',
  path: '/auth/profile/delete-confirm',
  tags: ['Authentication'],
  summary: 'Confirm account deletion',
  description: 'Confirm account deletion using PKCE-protected token from email. This permanently deletes the user account and all associated data including family relationships, group memberships, and personal information. This action is irreversible.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ConfirmAccountDeletion' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Account deleted successfully',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/DeleteAccountResponse' },
        },
      },
    },
    400: {
      description: 'Bad request - Invalid token or PKCE code verifier',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string()
              .openapi({
                example: 'Invalid deletion token or PKCE verification failed',
                description: 'Error message explaining the validation failure',
              }),
            validationErrors: z.array(z.object({
              field: z.string(),
              message: z.string(),
              code: z.string(),
            })).optional(),
          }),
        },
      },
    },
    403: {
      description: 'Forbidden - Token expired or already used',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string()
              .openapi({
                example: 'Deletion token has expired or already been used',
                description: 'Error message indicating token is no longer valid',
              }),
          }),
        },
      },
    },
    404: {
      description: 'Not found - Invalid deletion token or user not found',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error - Failed to complete account deletion',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

// Export schemas for use in other parts of the application
export {
  RequestMagicLinkSchema as MagicLinkRequest,
  VerifyMagicLinkSchema as MagicLinkVerifyRequest,
  RefreshTokenSchema as RefreshTokenRequest,
  LogoutSchema as LogoutRequest,
  RequestAccountDeletionSchema as AccountDeletionRequest,
  ConfirmAccountDeletionSchema as AccountDeletionConfirm,
};