/**
 * Invitations Schemas with OpenAPI Extensions
 *
 * Zod schemas for invitations management endpoints with OpenAPI documentation
 * Phase 8: Invitations domain migration following Auth/Children/Vehicles/Groups/Families template pattern
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/registry';
import { BaseFamilySchema, BaseGroupSchema, BaseUserSchema, FamilyRoleEnum, GroupRoleEnum } from './_common';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const InvitationTypeEnum = z.enum(['FAMILY', 'GROUP']).openapi({
  description: 'Type of invitation',
  example: 'FAMILY',
});

export const InvitationStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).openapi({
  description: 'Status of an invitation',
  example: 'PENDING',
});


// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateFamilyInvitationSchema = z.object({
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier to invite to',
    }),
  email: z.email()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Email address of the person to invite',
    }),
  role: FamilyRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Role for the invited member in the family',
  }),
  personalMessage: z.string()
    .max(500, 'Personal message too long')
    .optional()
    .openapi({
      example: 'Welcome to our family!',
      description: 'Optional personal message for the invitation',
    }),
}).openapi({
  title: 'Create Family Invitation',
  description: 'Create a new family invitation',
});

export const CreateGroupInvitationSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier to invite to',
    }),
  targetFamilyId: z.cuid()
    .optional()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Target family identifier (optional)',
    }),
  email: z.email()
    .optional()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Email address of the person to invite (optional)',
    }),
  role: GroupRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Role for the invited member in the group',
  }),
  personalMessage: z.string()
    .max(500, 'Personal message too long')
    .optional()
    .openapi({
      example: 'Welcome to our group!',
      description: 'Optional personal message for the invitation',
    }),
}).openapi({
  title: 'Create Group Invitation',
  description: 'Create a new group invitation',
});

export const AcceptFamilyInvitationSchema = z.object({
  leaveCurrentFamily: z.boolean()
    .default(false)
    .openapi({
      example: false,
      description: 'Whether to leave current family when accepting invitation',
    }),
}).openapi({
  title: 'Accept Family Invitation',
  description: 'Accept a family invitation',
});

export const ValidateInvitationCodeSchema = z.object({
  code: z.string()
    .min(1, 'Invitation code is required')
    .openapi({
      example: 'ABC123XYZ789',
      description: 'Invitation code to validate',
    }),
}).openapi({
  title: 'Validate Invitation Code',
  description: 'Validate an invitation code',
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

export const InvitationCodeParamsSchema = z.object({
  code: z.string()
    .min(1, 'Invitation code is required')
    .openapi({
      example: 'ABC123XYZ789',
      description: 'Invitation code parameter',
    }),
}).openapi({
  title: 'Invitation Code Parameters',
  description: 'URL parameters for invitation code endpoints',
});

export const InvitationIdParamsSchema = z.object({
  invitationId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Unique invitation identifier (CUID format)',
    }),
}).openapi({
  title: 'Invitation ID Parameters',
  description: 'URL parameters for invitation-specific endpoints',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const UserSchema = BaseUserSchema.extend({
  name: z.string().openapi({
    example: 'John Smith',
    description: 'User display name',
  }),
}).omit({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  createdAt: true,
  updatedAt: true,
}).openapi({
  title: 'User',
  description: 'User information in invitation context',
});

// Re-export base schemas for invitation context
export const FamilySchema = BaseFamilySchema.extend({}).openapi({
  title: 'Family',
  description: 'Family information in invitation context',
});

export const GroupSchema = BaseGroupSchema.extend({}).openapi({
  title: 'Group',
  description: 'Group information in invitation context',
});

export const FamilyInvitationResponseSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Invitation identifier',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family identifier',
    }),
  email: z.string().email().nullable()
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
  expiresAt: z.iso.datetime()
    .openapi({
      example: '2023-01-08T00:00:00.000Z',
      description: 'Invitation expiration timestamp',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Invitation creation timestamp',
    }),
  family: FamilySchema.optional()
    .openapi({
      description: 'Family information (included in some responses)',
    }),
}).openapi({
  title: 'Family Invitation Response',
  description: 'Family invitation information',
});

export const GroupInvitationResponseSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Invitation identifier',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier',
    }),
  targetFamilyId: z.cuid()
    .nullable()
    .optional()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Target family identifier',
    }),
  email: z.email()
    .nullable()
    .optional()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Invited email address',
    }),
  role: GroupRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Invited role in the group',
  }),
  status: InvitationStatusEnum.openapi({
    example: 'PENDING',
    description: 'Invitation status',
  }),
  personalMessage: z.string().nullable().optional().openapi({
    example: 'Welcome to our group!',
    description: 'Personal message from inviter',
  }),
  expiresAt: z.iso.datetime()
    .openapi({
      example: '2023-01-08T00:00:00.000Z',
      description: 'Invitation expiration timestamp',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Invitation creation timestamp',
    }),
  group: GroupSchema.optional()
    .openapi({
      description: 'Group information (included in some responses)',
    }),
}).openapi({
  title: 'Group Invitation Response',
  description: 'Group invitation information',
});

// Family-specific validation response
export const FamilyInvitationValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the family invitation code is valid',
    }),
  type: z.literal('FAMILY')
    .openapi({
      description: 'Type of invitation - always FAMILY for this endpoint',
    }),
  family: BaseFamilySchema
    .optional()
    .openapi({
      description: 'Family information (if valid)',
    }),
  email: z.email()
    .optional()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Email address the invitation was sent to (if valid)',
    }),
  role: FamilyRoleEnum.optional()
    .openapi({
      example: 'MEMBER',
      description: 'Role in the family invitation (if valid)',
    }),
  personalMessage: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'Welcome to our family!',
      description: 'Personal message from inviter (if valid)',
    }),
  inviterName: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'John Doe',
      description: 'Name of the user who sent the invitation',
    }),
  existingUser: z.boolean()
    .optional()
    .openapi({
      example: false,
      description: 'Whether the invited email already corresponds to an existing user account',
    }),
}).openapi({
  title: 'Family Invitation Validation Response',
  description: 'Family invitation validation result',
});

// Group-specific validation response
export const GroupInvitationValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the group invitation code is valid',
    }),
  type: z.literal('GROUP')
    .openapi({
      description: 'Type of invitation - always GROUP for this endpoint',
    }),
  group: BaseGroupSchema
    .optional()
    .openapi({
      description: 'Group information (if valid)',
    }),
  email: z.email()
    .optional()
    .openapi({
      example: 'john.smith@example.com',
      description: 'Email address the invitation was sent to (if valid)',
    }),
  inviterName: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'John Doe',
      description: 'Name of the user who sent the invitation',
    }),
  existingUser: z.boolean()
    .optional()
    .openapi({
      example: false,
      description: 'Whether the invited email already corresponds to an existing user account',
    }),
  targetFamilyId: z.string()
    .optional()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Target family ID (present when a family is invited to join the group)',
    }),
  targetFamilyName: z.string()
    .optional()
    .openapi({
      example: 'Smith Family',
      description: 'Name of the invited family',
    }),
}).openapi({
  title: 'Group Invitation Validation Response',
  description: 'Group invitation validation result',
});

export const AcceptInvitationResponseSchema = z.object({
  success: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the invitation was accepted successfully',
    }),
  message: z.string()
    .optional()
    .openapi({
      example: 'Invitation accepted successfully',
      description: 'Success message',
    }),
}).openapi({
  title: 'Accept Invitation Response',
  description: 'Response when accepting an invitation',
});

export const CancelInvitationResponseSchema = z.object({
  message: z.string()
    .openapi({
      example: 'Invitation cancelled successfully',
      description: 'Success message',
    }),
}).openapi({
  title: 'Cancel Invitation Response',
  description: 'Response when cancelling an invitation',
});

// ============================================================================
// SCHEMA REGISTRATION
// ============================================================================

// Register request schemas
registry.register('CreateFamilyInvitationRequest', CreateFamilyInvitationSchema);
registry.register('CreateGroupInvitationRequest', CreateGroupInvitationSchema);
registry.register('AcceptFamilyInvitationRequest', AcceptFamilyInvitationSchema);

// Register parameter schemas

// Register response schemas

// ============================================================================
// API PATHS REGISTRATION
// ============================================================================

// Family invitation endpoints
registerPath({
  method: 'post',
  path: '/invitations/family',
  tags: ['Invitations'],
  summary: 'Create family invitation',
  description: 'Create a new family invitation. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateFamilyInvitationRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Family invitation created successfully',
      content: {
        'application/json': {
          schema: FamilyInvitationResponseSchema,
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
      description: 'Forbidden - Only family administrators can send invitations',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

registerPath({
  method: 'get',
  path: '/invitations/family/{code}/validate',
  tags: ['Invitations'],
  summary: 'Validate family invitation code',
  description: 'Validate a family invitation code. Authentication is optional.',
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      description: 'Family invitation validation result',
      content: {
        'application/json': {
          schema: FamilyInvitationValidationSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code',
    },
    404: {
      description: 'Invitation not found or invalid',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

registerPath({
  method: 'post',
  path: '/invitations/family/{code}/accept',
  tags: ['Invitations'],
  summary: 'Accept family invitation',
  description: 'Accept a family invitation using the invitation code',
  security: [{ BearerAuth: [] }],
  request: {
    params: InvitationCodeParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AcceptFamilyInvitationRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Family invitation accepted successfully',
      content: {
        'application/json': {
          schema: AcceptInvitationResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code or cannot accept',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Group invitation endpoints
registerPath({
  method: 'post',
  path: '/invitations/group',
  tags: ['Invitations'],
  summary: 'Create group invitation',
  description: 'Create a new group invitation. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateGroupInvitationRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Group invitation created successfully',
      content: {
        'application/json': {
          schema: GroupInvitationResponseSchema,
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
      description: 'Forbidden - Only group administrators can send invitations',
    },
    404: {
      description: 'Not found - Group or target family not found',
    },
    409: {
      description: 'Conflict - Family already a member or already has pending invitation',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

registerPath({
  method: 'get',
  path: '/invitations/group/{code}/validate',
  tags: ['Invitations'],
  summary: 'Validate group invitation code',
  description: 'Validate a group invitation code. Authentication is optional.',
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      description: 'Group invitation validation result',
      content: {
        'application/json': {
          schema: GroupInvitationValidationSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code',
    },
    404: {
      description: 'Invitation not found or invalid',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

registerPath({
  method: 'post',
  path: '/invitations/group/{code}/accept',
  tags: ['Invitations'],
  summary: 'Accept group invitation',
  description: 'Accept a group invitation using the invitation code',
  security: [{ BearerAuth: [] }],
  request: {
    params: InvitationCodeParamsSchema,
  },
  responses: {
    200: {
      description: 'Group invitation accepted successfully',
      content: {
        'application/json': {
          schema: AcceptInvitationResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code or cannot accept',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Cancel invitation endpoints
registerPath({
  method: 'delete',
  path: '/invitations/family/{invitationId}',
  tags: ['Invitations'],
  summary: 'Cancel family invitation',
  description: 'Cancel a pending family invitation. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: InvitationIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Family invitation cancelled successfully',
      content: {
        'application/json': {
          schema: CancelInvitationResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Only family administrators can cancel invitations',
    },
    404: {
      description: 'Not found - Invitation not found',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/invitations/group/{invitationId}',
  tags: ['Invitations'],
  summary: 'Cancel group invitation',
  description: 'Cancel a pending group invitation. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: InvitationIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Group invitation cancelled successfully',
      content: {
        'application/json': {
          schema: CancelInvitationResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Only group administrators can cancel invitations',
    },
    404: {
      description: 'Not found - Invitation not found',
    },
    500: {
      description: 'Internal server error',
    },
  },
});