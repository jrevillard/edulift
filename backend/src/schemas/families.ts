/**
 * Families Schemas with OpenAPI Extensions
 *
 * Zod schemas for families management endpoints with OpenAPI documentation
 * Phase 6: Families domain migration following Auth/Children/Vehicles/Groups template pattern
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/openapi.js';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const FamilyRoleEnum = z.enum(['ADMIN', 'MEMBER']).openapi({
  description: 'Role of a user within a family',
  example: 'MEMBER',
});

export const InvitationStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).openapi({
  description: 'Status of a family invitation',
  example: 'PENDING',
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateFamilySchema = z.object({
  name: z.string()
    .min(1, 'Family name is required')
    .max(100, 'Family name too long')
    .openapi({
      example: 'Johnson Family',
      description: 'Family display name',
    }),
}).openapi({
  title: 'Create Family',
  description: 'Create a new family',
});

export const JoinFamilySchema = z.object({
  inviteCode: z.string()
    .min(1, 'Invite code is required')
    .openapi({
      example: 'ABC123XYZ',
      description: 'Family invitation code',
    }),
}).openapi({
  title: 'Join Family',
  description: 'Join a family using invitation code',
});

export const UpdateMemberRoleSchema = z.object({
  role: FamilyRoleEnum.openapi({
    example: 'ADMIN',
    description: 'New role for the family member',
  }),
}).openapi({
  title: 'Update Member Role',
  description: 'Update a family member role',
});

export const UpdateFamilyNameSchema = z.object({
  name: z.string()
    .min(1, 'Family name is required')
    .max(100, 'Family name too long')
    .openapi({
      example: 'Updated Johnson Family',
      description: 'Updated family name',
    }),
}).openapi({
  title: 'Update Family Name',
  description: 'Update family name',
});

export const InviteMemberSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .openapi({
      example: 'john.smith@example.com',
      description: 'Email address of the person to invite',
    }),
  role: FamilyRoleEnum.default('MEMBER').openapi({
    example: 'MEMBER',
    description: 'Role for the invited member (defaults to MEMBER)',
  }),
  personalMessage: z.string()
    .max(500, 'Personal message too long')
    .nullable()
    .optional()
    .openapi({
      example: 'Welcome to our family!',
      description: 'Optional personal message for the invitation',
    }),
}).openapi({
  title: 'Invite Family Member',
  description: 'Invite a new member to join the family',
});

export const ValidateInviteCodeSchema = z.object({
  inviteCode: z.string()
    .min(1, 'Invite code is required')
    .openapi({
      example: 'ABC123XYZ',
      description: 'Family invitation code to validate',
    }),
}).openapi({
  title: 'Validate Invite Code',
  description: 'Validate a family invitation code',
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

export const FamilyIdParamsSchema = z.object({
  familyId: z.string()
    .cuid('Invalid family ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
}).openapi({
  title: 'Family ID Parameters',
  description: 'URL parameters for family-specific endpoints',
});

export const MemberIdParamsSchema = z.object({
  memberId: z.string()
    .cuid('Invalid member ID format')
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique member identifier (CUID format)',
    }),
}).openapi({
  title: 'Member ID Parameters',
  description: 'URL parameters for member-specific endpoints',
});

export const FamilyMemberParamsSchema = z.object({
  familyId: z.string()
    .cuid('Invalid family ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
  memberId: z.string()
    .cuid('Invalid member ID format')
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique member identifier (CUID format)',
    }),
}).openapi({
  title: 'Family Member Parameters',
  description: 'URL parameters for family member endpoints',
});

export const FamilyInvitationParamsSchema = z.object({
  familyId: z.string()
    .cuid('Invalid family ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
  invitationId: z.string()
    .cuid('Invalid invitation ID format')
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique invitation identifier (CUID format)',
    }),
}).openapi({
  title: 'Family Invitation Parameters',
  description: 'URL parameters for family invitation endpoints',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const UserSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'User identifier',
    }),
  email: z.string()
    .email()
    .openapi({
      example: 'john.smith@example.com',
      description: 'User email address',
    }),
  name: z.string()
    .openapi({
      example: 'John Smith',
      description: 'User display name',
    }),
}).openapi({
  title: 'User',
  description: 'User information',
});

export const FamilyMemberSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Family member identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier',
    }),
  userId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'User identifier',
    }),
  role: FamilyRoleEnum.openapi({
    example: 'ADMIN',
    description: 'Member role in the family',
  }),
  joinedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the member joined the family',
    }),
  user: UserSchema.openapi({
    description: 'User information',
  }),
}).openapi({
  title: 'Family Member',
  description: 'Family member information with user details',
});

export const ChildSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Child identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier',
    }),
  firstName: z.string()
    .openapi({
      example: 'Emma',
      description: 'Child first name',
    }),
  lastName: z.string()
    .openapi({
      example: 'Johnson',
      description: 'Child last name',
    }),
  dateOfBirth: z.string()
    .datetime()
    .nullable()
    .openapi({
      example: '2015-05-15T00:00:00.000Z',
      description: 'Child date of birth',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Child creation timestamp',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Child update timestamp',
    }),
}).openapi({
  title: 'Child',
  description: 'Child information',
});

export const VehicleSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Vehicle identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier',
    }),
  make: z.string()
    .openapi({
      example: 'Toyota',
      description: 'Vehicle make',
    }),
  model: z.string()
    .openapi({
      example: 'Sienna',
      description: 'Vehicle model',
    }),
  year: z.number()
    .int()
    .min(1900)
    .max(2100)
    .openapi({
      example: 2020,
      description: 'Vehicle year',
    }),
  color: z.string()
    .optional()
    .openapi({
      example: 'Blue',
      description: 'Vehicle color',
    }),
  licensePlate: z.string()
    .optional()
    .openapi({
      example: 'ABC-123',
      description: 'Vehicle license plate',
    }),
  capacity: z.number()
    .int()
    .min(1)
    .max(20)
    .openapi({
      example: 7,
      description: 'Vehicle seating capacity',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Vehicle creation timestamp',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Vehicle update timestamp',
    }),
}).openapi({
  title: 'Vehicle',
  description: 'Vehicle information',
});

export const FamilyResponseSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Johnson Family',
      description: 'Family display name',
    }),
  inviteCode: z.string()
    .nullable()
    .optional()
    .openapi({
      example: null,
      description: 'Family invite code (deprecated - using unified invitation system)',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Family creation timestamp',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Family update timestamp',
    }),
  members: z.array(FamilyMemberSchema).openapi({
    description: 'Family members with user information',
  }),
  children: z.array(ChildSchema).openapi({
    description: 'Family children',
  }),
  vehicles: z.array(VehicleSchema).openapi({
    description: 'Family vehicles',
  }),
  _count: z.object({
    members: z.number()
      .openapi({
        example: 3,
        description: 'Number of members in the family',
      }),
    children: z.number()
      .openapi({
        example: 2,
        description: 'Number of children in the family',
      }),
    vehicles: z.number()
      .openapi({
        example: 1,
        description: 'Number of vehicles in the family',
      }),
  }).optional()
    .openapi({
      description: 'Count information (included in some responses)',
    }),
}).openapi({
  title: 'Family Response',
  description: 'Complete family information with members, children, and vehicles',
});

export const FamilyPermissionsSchema = z.object({
  canManageMembers: z.boolean()
    .openapi({
      example: true,
      description: 'Can manage family members',
    }),
  canModifyChildren: z.boolean()
    .openapi({
      example: true,
      description: 'Can modify family children',
    }),
  canModifyVehicles: z.boolean()
    .openapi({
      example: true,
      description: 'Can modify family vehicles',
    }),
  canViewFamily: z.boolean()
    .openapi({
      example: true,
      description: 'Can view family information',
    }),
}).openapi({
  title: 'Family Permissions',
  description: 'User permissions within a family',
});

export const FamilyInvitationSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Invitation identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier',
    }),
  email: z.string()
    .email()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Invited email address',
    }),
  role: FamilyRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Invited role in the family',
  }),
  status: InvitationStatusEnum.openapi({
    example: 'PENDING',
    description: 'Invitation status',
  }),
  personalMessage: z.string().nullable().optional().openapi({
    example: 'Welcome to our family!',
    description: 'Personal message from inviter',
  }),
  expiresAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-08T00:00:00.000Z',
      description: 'Invitation expiration timestamp',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Invitation creation timestamp',
    }),
  family: z.object({
    id: z.string().cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Family information (included in some responses)',
    }),
}).openapi({
  title: 'Family Invitation',
  description: 'Family invitation information',
});

export const InviteCodeValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the invitation code is valid',
    }),
  family: z.object({
    id: z.string()
      .cuid()
      .openapi({
        example: 'cl123456789012345678901234',
        description: 'Family identifier (if valid)',
      }),
    name: z.string()
      .openapi({
        example: 'Johnson Family',
        description: 'Family name (if valid)',
      }),
  }).optional()
    .openapi({
      description: 'Family information (if valid)',
    }),
}).openapi({
  title: 'Invite Code Validation Response',
  description: 'Invitation code validation result',
});

export const LeaveFamilyResponseSchema = z.object({
  message: z.string()
    .openapi({
      example: 'Successfully left the family',
      description: 'Success message',
    }),
}).openapi({
  title: 'Leave Family Response',
  description: 'Response when leaving a family',
});

// ============================================================================
// SCHEMA REGISTRATION
// ============================================================================

// Register request schemas
registry.register('CreateFamilyRequest', CreateFamilySchema);
registry.register('JoinFamilyRequest', JoinFamilySchema);
registry.register('UpdateMemberRoleRequest', UpdateMemberRoleSchema);
registry.register('UpdateFamilyNameRequest', UpdateFamilyNameSchema);
registry.register('InviteMemberRequest', InviteMemberSchema);
registry.register('ValidateInviteCodeRequest', ValidateInviteCodeSchema);

// Register parameter schemas

// Register response schemas

// ============================================================================
// API PATHS REGISTRATION
// ============================================================================

// Public route (no auth required)
registerPath({
  method: 'post',
  path: '/families/validate-invite',
  tags: ['Families'],
  summary: 'Validate family invite code (public)',
  description: 'Validate a family invitation code without authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidateInviteCodeRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invite code validation result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: InviteCodeValidationSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invite code',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            data: z.object({
              valid: z.literal(false),
            }),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Authenticated routes
registerPath({
  method: 'post',
  path: '/families',
  tags: ['Families'],
  summary: 'Create family',
  description: 'Create a new family',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateFamilyRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Family created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - User already has a family',
    },
  },
});

registerPath({
  method: 'post',
  path: '/families/join',
  tags: ['Families'],
  summary: 'Join family by invite code',
  description: 'Join a family using an invitation code',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/JoinFamilyRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Family joined successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invite code or already a family member',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'get',
  path: '/families/current',
  tags: ['Families'],
  summary: 'Get current family',
  description: 'Retrieve the current family of the authenticated user',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Family retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyResponseSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    404: {
      description: 'Not found - User is not part of any family',
    },
  },
});

registerPath({
  method: 'get',
  path: '/families/{familyId}/permissions',
  tags: ['Families'],
  summary: 'Get user permissions in family',
  description: 'Retrieve user permissions for a specific family',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Permissions retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyPermissionsSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid family ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a member of this family',
    },
  },
});

registerPath({
  method: 'put',
  path: '/families/members/{memberId}/role',
  tags: ['Families'],
  summary: 'Update member role',
  description: 'Update a family member role. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: MemberIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateMemberRoleRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Member role updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or member ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
  },
});

registerPath({
  method: 'post',
  path: '/families/invite-code',
  tags: ['Families'],
  summary: 'Generate invite code (deprecated)',
  description: 'Generate permanent invite code for family. This endpoint is deprecated.',
  security: [{ BearerAuth: [] }],
  responses: {
    400: {
      description: 'Bad request - Feature deprecated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
  },
});

registerPath({
  method: 'post',
  path: '/families/{familyId}/invite',
  tags: ['Families'],
  summary: 'Invite family member',
  description: 'Invite a new member to join the family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/InviteMemberRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Member invited successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyInvitationSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions or not a family member',
    },
  },
});

registerPath({
  method: 'get',
  path: '/families/{familyId}/invitations',
  tags: ['Families'],
  summary: 'Get pending invitations',
  description: 'Retrieve all pending invitations for a family. Requires family membership.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Pending invitations retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(FamilyInvitationSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid family ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a family member',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/families/{familyId}/invitations/{invitationId}',
  tags: ['Families'],
  summary: 'Cancel invitation',
  description: 'Cancel a pending family invitation. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyInvitationParamsSchema,
  },
  responses: {
    200: {
      description: 'Invitation cancelled successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid family or invitation ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
  },
});

registerPath({
  method: 'put',
  path: '/families/name',
  tags: ['Families'],
  summary: 'Update family name',
  description: 'Update family name. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateFamilyNameRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Family name updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyResponseSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/families/{familyId}/members/{memberId}',
  tags: ['Families'],
  summary: 'Remove family member',
  description: 'Remove a member from the family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyMemberParamsSchema,
  },
  responses: {
    200: {
      description: 'Member removed successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid family or member ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions or not a family member',
    },
  },
});

registerPath({
  method: 'post',
  path: '/families/{familyId}/leave',
  tags: ['Families'],
  summary: 'Leave family',
  description: 'Leave the current family as a member',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Family left successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: LeaveFamilyResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Cannot leave as last admin or not a family member',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});