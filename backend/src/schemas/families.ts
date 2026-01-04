/**
 * Families Hono Native Schemas - OpenAPI Phase 2
 *
 * Hono-native schemas for families management endpoints with OpenAPI documentation
 * Converted from registry-based schemas to direct OpenAPI schemas
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { VehicleResponseSchema } from './vehicles';
import { BaseChildSchema } from './children';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const FamilyRoleEnum = z.enum(['ADMIN', 'MEMBER', 'VIEWER']).openapi({
  enum: ['ADMIN', 'MEMBER', 'VIEWER'],
  example: 'ADMIN',
  description: 'Family member role with different permission levels',
});

export const InvitationStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']).openapi({
  enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  example: 'PENDING',
  description: 'Status of a family invitation',
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
  email: z.email()
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
  title: 'Invite Member',
  description: 'Invite a new member to the family',
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
    .cuid()
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
    .cuid()
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
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
  memberId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique member identifier (CUID format)',
    }),
}).openapi({
  title: 'Family and Member Parameters',
  description: 'URL parameters for family member endpoints',
});

export const FamilyInvitationParamsSchema = z.object({
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique family identifier (CUID format)',
    }),
  invitationId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique invitation identifier (CUID format)',
    }),
}).openapi({
  title: 'Family and Invitation Parameters',
  description: 'URL parameters for family invitation endpoints',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// User Schema (simplified version)
const UserSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Unique user identifier (CUID format)',
    }),
  email: z.string()
    .email()
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
    .optional()
    .openapi({
      example: 'America/New_York',
      description: 'User timezone',
    }),
});

// Use centralized VehicleSchema from vehicles.ts
const VehicleSchema = VehicleResponseSchema;

// Use centralized ChildSchema from children.ts (simplified for family context)
const ChildSchema = BaseChildSchema.pick({
  id: true,
  name: true,
}).extend({
  age: z.number()
    .nullable()
    .optional()
    .openapi({
      example: 8,
      description: 'Child age (nullable)',
    }),
});

// Core Family Schema
const BaseFamilySchema = z.object({
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
    .openapi({
      example: 'ABC123XYZ',
      description: 'Family invitation code',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the family was created',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-15T10:30:00.000Z',
      description: 'When the family was last updated',
    }),
});

export const FamilyResponseSchema = BaseFamilySchema.extend({
  members: z.array(z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    familyId: z.string().cuid(),
    role: FamilyRoleEnum,
    joinedAt: z.string().datetime(),
    user: UserSchema.optional(),
  })).optional()
    .openapi({
      description: 'Family members (included in detailed responses)',
    }),
  vehicles: z.array(VehicleSchema).optional()
    .openapi({
      description: 'Family vehicles (included in detailed responses)',
    }),
  children: z.array(ChildSchema).optional()
    .openapi({
      description: 'Family children (included in detailed responses)',
    }),
}).openapi({
  title: 'Family Response',
  description: 'Complete family information with optional related data',
});

export const FamilyPermissionsSchema = z.object({
  canManageMembers: z.boolean()
    .openapi({
      example: true,
      description: 'Can add/remove family members',
    }),
  canModifyChildren: z.boolean()
    .openapi({
      example: true,
      description: 'Can add/remove family children',
    }),
  canModifyVehicles: z.boolean()
    .openapi({
      example: true,
      description: 'Can add/remove family vehicles',
    }),
  canViewFamily: z.boolean()
    .openapi({
      example: true,
      description: 'Can view family information',
    }),
}).openapi({
  title: 'Family Permissions',
  description: 'User permissions within the family',
});

export const FamilyInvitationSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Unique invitation identifier (CUID format)',
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
      example: 'invitee@example.com',
      description: 'Invited email address',
    }),
  role: FamilyRoleEnum
    .openapi({
      example: 'MEMBER',
      description: 'Invited role',
    }),
  status: InvitationStatusEnum
    .openapi({
      example: 'PENDING',
      description: 'Invitation status',
    }),
  personalMessage: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'Welcome to our family!',
      description: 'Personal invitation message',
    }),
  invitedBy: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'User who sent the invitation',
    }),
  invitedByUser: UserSchema.optional()
    .openapi({
      description: 'User details who sent the invitation',
    }),
  expiresAt: z.string()
    .datetime()
    .openapi({
      example: '2023-02-01T00:00:00.000Z',
      description: 'When the invitation expires',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the invitation was created',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the invitation was last updated',
    }),
}).openapi({
  title: 'Family Invitation',
  description: 'Family invitation details',
});

export const InviteCodeValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the invite code is valid',
    }),
  family: FamilyResponseSchema.nullable()
    .openapi({
      description: 'Family information if valid, null if invalid',
    }),
}).openapi({
  title: 'Invite Code Validation',
  description: 'Result of invite code validation',
});

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

export const SimpleSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
    .openapi({
      example: 'Operation completed successfully',
      description: 'Success message',
    }),
}).openapi({
  title: 'Simple Success Response',
  description: 'Standard success response with message',
});

export const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string()
    .openapi({
      example: 'Bad request',
      description: 'Error message',
    }),
  code: z.string().optional()
    .openapi({
      example: 'ERROR_CODE',
      description: 'Error code for programmatic handling',
    }),
}).openapi({
  title: 'Error Response',
  description: 'Standard error response',
});