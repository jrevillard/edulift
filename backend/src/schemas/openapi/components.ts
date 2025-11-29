/**
 * OpenAPI 3.1 Components Schema
 *
 * This file contains all reusable OpenAPI schemas manually defined based on Zod definitions.
 * Phase 3.2: Schema Conversion - Manual OpenAPI schema definitions
 */

// User-related schemas (manually defined based on Zod schemas)
const UserSchemas = {
  CreateUserRequest: {
    type: 'object',
    required: ['email', 'name'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'User display name',
      },
    },
  },
  UpdateProfileRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'User display name',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      timezone: {
        type: 'string',
        description: 'User timezone (IANA format)',
        example: 'America/New_York',
      },
    },
    description: 'At least one field must be provided',
  },
  RequestMagicLinkRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      name: {
        type: 'string',
        minLength: 1,
        description: 'User display name (optional for registration)',
      },
      timezone: {
        type: 'string',
        description: 'User timezone (IANA format)',
        example: 'America/New_York',
      },
      inviteCode: {
        type: 'string',
        description: 'Invitation code for joining family or group (optional)',
      },
      code_challenge: {
        type: 'string',
        minLength: 43,
        maxLength: 128,
        description: 'PKCE code challenge for security (optional but recommended)',
      },
    },
  },
  UpdateTimezoneRequest: {
    type: 'object',
    required: ['timezone'],
    properties: {
      timezone: {
        type: 'string',
        minLength: 1,
        description: 'Valid IANA timezone (e.g., America/New_York, Europe/Paris)',
      },
    },
  },
};

// Group-related schemas (manually defined based on Zod schemas)
const GroupSchemas = {
  CreateGroupRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Group name',
      },
    },
  },
  GroupInviteRequest: {
    type: 'object',
    required: ['inviteCode'],
    properties: {
      inviteCode: {
        type: 'string',
        description: 'Group invitation code (CUID format)',
      },
    },
  },
  ValidateInviteRequest: {
    type: 'object',
    required: ['inviteCode'],
    properties: {
      inviteCode: {
        type: 'string',
        description: 'Invitation code to validate',
      },
    },
  },
};

// Child-related schemas (manually defined based on Zod schemas)
const ChildSchemas = {
  CreateChildRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Child name',
      },
      age: {
        type: 'integer',
        minimum: 3,
        maximum: 18,
        description: 'Child age',
      },
    },
  },
  UpdateChildRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Child name',
      },
      age: {
        type: 'integer',
        minimum: 3,
        maximum: 18,
        description: 'Child age',
      },
    },
  },
  TripAssignmentRequest: {
    type: 'object',
    required: ['childId'],
    properties: {
      childId: {
        type: 'string',
        description: 'Child ID (CUID format)',
      },
    },
  },
};

// Vehicle-related schemas (manually defined based on Zod schemas)
const VehicleSchemas = {
  CreateVehicleRequest: {
    type: 'object',
    required: ['name', 'capacity'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Vehicle name',
      },
      capacity: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Vehicle capacity',
      },
    },
  },
  UpdateVehicleRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Vehicle name',
      },
      capacity: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Vehicle capacity',
      },
    },
  },
};

// Schedule-related schemas (manually defined based on Zod schemas)
const ScheduleSchemas = {
  CreateScheduleSlotRequest: {
    type: 'object',
    required: ['datetime'],
    properties: {
      datetime: {
        type: 'string',
        format: 'date-time',
        description: 'Schedule slot datetime (ISO 8601 UTC)',
      },
    },
  },
  CreateTripRequest: {
    type: 'object',
    properties: {
      vehicleId: {
        type: 'string',
        description: 'Vehicle ID (optional)',
      },
      driverId: {
        type: 'string',
        description: 'Driver ID (optional)',
      },
    },
  },
  WeekQueryParams: {
    type: 'object',
    properties: {
      week: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}$',
        description: 'Week in YYYY-WW format (e.g., 2025-05)',
        example: '2025-05',
      },
    },
  },
};

// Common parameter schemas
const ParameterSchemas = {
  // CUID parameter pattern for database entities
  CUIDParam: {
    type: 'string',
    pattern: '^[a-z0-9]{25}$',
    description: 'Database entity ID (CUID format)',
    example: 'cl123456789012345678901234',
  },

  // Pagination parameters
  PaginationParams: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number for pagination',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Number of items per page',
      },
    },
  },

  // Date range parameters
  DateRangeParams: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date for filtering (ISO 8601)',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date for filtering (ISO 8601)',
      },
    },
  },
};

// Database entity response schemas
const EntitySchemas = {
  // User response schema
  UserResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'User ID',
        example: 'cl123456789012345678901234',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      name: {
        type: 'string',
        description: 'User display name',
      },
      timezone: {
        type: 'string',
        description: 'User timezone (IANA format)',
        example: 'America/New_York',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'User creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Child response schema
  ChildResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Child ID',
      },
      name: {
        type: 'string',
        description: 'Child name',
      },
      age: {
        type: 'integer',
        minimum: 3,
        maximum: 18,
        description: 'Child age',
      },
      familyId: {
        type: 'string',
        description: 'Family ID',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Child creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Vehicle response schema
  VehicleResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Vehicle ID',
      },
      name: {
        type: 'string',
        description: 'Vehicle name',
      },
      capacity: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Vehicle capacity',
      },
      familyId: {
        type: 'string',
        description: 'Family ID',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Vehicle creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Group response schema
  GroupResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID',
      },
      name: {
        type: 'string',
        description: 'Group name',
      },
      inviteCode: {
        type: 'string',
        description: 'Group invitation code',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Group creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Family response schema
  FamilyResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Family ID',
      },
      name: {
        type: 'string',
        description: 'Family name',
      },
      inviteCode: {
        type: 'string',
        description: 'Family invitation code',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Family creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Schedule slot response schema
  ScheduleSlotResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Schedule slot ID',
      },
      datetime: {
        type: 'string',
        format: 'date-time',
        description: 'Schedule slot datetime (ISO 8601 UTC)',
      },
      groupId: {
        type: 'string',
        description: 'Group ID',
      },
      vehicleId: {
        type: 'string',
        description: 'Vehicle ID (if assigned)',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Schedule slot creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },
};

// List response schemas
const ListSchemas = {
  PaginatedResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
            },
            description: 'List of items',
          },
          pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'integer',
                description: 'Current page number',
              },
              limit: {
                type: 'integer',
                description: 'Items per page',
              },
              total: {
                type: 'integer',
                description: 'Total number of items',
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages',
              },
            },
          },
        },
      },
    },
  },
};

// Authentication schemas
const AuthSchemas = {
  // Magic link request
  MagicLinkRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      name: {
        type: 'string',
        minLength: 1,
        description: 'User display name (optional for registration)',
      },
      timezone: {
        type: 'string',
        description: 'User timezone (IANA format)',
        example: 'America/New_York',
      },
      inviteCode: {
        type: 'string',
        description: 'Invitation code for joining family or group (optional)',
      },
      code_challenge: {
        type: 'string',
        minLength: 43,
        maxLength: 128,
        description: 'PKCE code challenge for security (optional but recommended)',
      },
    },
  },

  // Magic link verification
  MagicLinkVerifyRequest: {
    type: 'object',
    required: ['token', 'code_verifier'],
    properties: {
      token: {
        type: 'string',
        description: 'Magic link token from email',
      },
      code_verifier: {
        type: 'string',
        minLength: 43,
        maxLength: 128,
        description: 'PKCE code verifier for security',
      },
    },
  },

  // Token refresh request
  RefreshTokenRequest: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        description: 'Valid refresh token',
      },
    },
  },

  // Logout request (RFC 7009 compliant)
  LogoutRequest: {
    type: 'object',
    required: ['token'],
    properties: {
      token: {
        type: 'string',
        description: 'Refresh token to revoke',
      },
      token_type_hint: {
        type: 'string',
        enum: ['refresh_token'],
        description: 'Token type hint (optional)',
      },
    },
  },

  // Authentication response
  AuthResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/UserResponse',
          },
          accessToken: {
            type: 'string',
            description: 'JWT access token',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token',
          },
          expiresIn: {
            type: 'integer',
            description: 'Token expiration time in seconds',
            example: 900,
          },
          tokenType: {
            type: 'string',
            example: 'Bearer',
          },
          invitationResult: {
            type: 'object',
            properties: {
              processed: {
                type: 'boolean',
                description: 'Whether invitation was processed',
              },
              invitationType: {
                type: 'string',
                enum: ['FAMILY', 'GROUP'],
                description: 'Type of invitation processed',
              },
              redirectUrl: {
                type: 'string',
                description: 'URL to redirect after processing',
              },
              requiresFamilyOnboarding: {
                type: 'boolean',
                description: 'Whether family onboarding is required',
              },
              reason: {
                type: 'string',
                description: 'Reason if invitation processing failed',
              },
            },
          },
        },
      },
    },
  },
};

// Export all schemas organized by category
export const openApiComponents = {
  schemas: {
    // Request schemas
    ...UserSchemas,
    ...GroupSchemas,
    ...ChildSchemas,
    ...VehicleSchemas,
    ...ScheduleSchemas,
    ...AuthSchemas,

    // Response schemas
    ...EntitySchemas,
    ...ListSchemas,

    // Common schemas
    CUIDParam: ParameterSchemas.CUIDParam,
    PaginationParams: ParameterSchemas.PaginationParams,
    DateRangeParams: ParameterSchemas.DateRangeParams,
  },
};

// Export individual categories for easier imports
export {
  UserSchemas,
  GroupSchemas,
  ChildSchemas,
  VehicleSchemas,
  ScheduleSchemas,
  EntitySchemas,
  ListSchemas,
  AuthSchemas,
  ParameterSchemas,
};