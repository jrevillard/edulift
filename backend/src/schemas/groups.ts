/**
 * Groups Hono Native Schemas - OpenAPI Phase 2
 *
 * Hono-native schemas for groups management endpoints with OpenAPI documentation
 * Converted from registry-based schemas to direct OpenAPI schemas
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const GroupRoleEnum = z.enum(['ADMIN', 'MEMBER']).openapi({
  enum: ['ADMIN', 'MEMBER'],
  example: 'ADMIN',
  description: 'Group member role with different permission levels',
});

export const UserRoleEnum = z.enum(['PARENT', 'DRIVER']).openapi({
  enum: ['PARENT', 'DRIVER'],
  example: 'PARENT',
  description: 'User role within group context',
});

export const WeekdayEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).openapi({
  enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
  example: 'MONDAY',
  description: 'Day of the week',
});

export const InvitationStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED']).openapi({
  enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
  example: 'PENDING',
  description: 'Status of a group invitation',
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateGroupSchema = z.object({
  name: z.string()
    .min(1, 'Group name is required')
    .max(100, 'Group name too long')
    .openapi({
      example: 'Morning School Run',
      description: 'Group display name',
    }),
  description: z.string()
    .max(500, 'Description too long')
    .optional()
    .openapi({
      example: 'Carpool group for morning school transportation',
      description: 'Optional group description',
    }),
}).openapi({
  title: 'Create Group',
  description: 'Create a new group. Requires family admin permissions.',
});

export const JoinGroupSchema = z.object({
  inviteCode: z.string()
    .min(1, 'Invite code is required')
    .openapi({
      example: 'ABC123XYZ',
      description: 'Group invitation code',
    }),
}).openapi({
  title: 'Join Group',
  description: 'Join a group using invitation code',
});

export const UpdateGroupSchema = z.object({
  name: z.string()
    .min(1, 'Group name is required')
    .max(100, 'Group name too long')
    .optional()
    .openapi({
      example: 'Updated Morning School Run',
      description: 'Updated group name',
    }),
  description: z.string()
    .max(500, 'Description too long')
    .optional()
    .openapi({
      example: 'Updated description for the group',
      description: 'Updated group description',
    }),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined,
  { message: 'At least one field must be provided' },
).openapi({
  title: 'Update Group',
  description: 'Update group information',
});

export const UpdateFamilyRoleSchema = z.object({
  role: GroupRoleEnum.openapi({
    example: 'ADMIN',
    description: 'New role for the family in the group',
  }),
}).openapi({
  title: 'Update Family Role',
  description: 'Update a family role in the group',
});

export const InviteFamilySchema = z.object({
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Family ID to invite',
    }),
  role: GroupRoleEnum.default('MEMBER').openapi({
    example: 'MEMBER',
    description: 'Role for the invited family (defaults to MEMBER)',
  }),
  personalMessage: z.string()
    .max(500, 'Personal message too long')
    .nullable()
    .optional()
    .openapi({
      example: 'Welcome to our carpool group!',
      description: 'Optional personal message for the invitation',
    }),
}).openapi({
  title: 'Invite Family',
  description: 'Invite a family to join the group',
});

export const SearchFamiliesQuerySchema = z.object({
  searchTerm: z.string()
    .min(1, 'Search term is required')
    .openapi({
      example: 'Smith',
      description: 'Search term to filter families by name',
    }),
}).openapi({
  title: 'Search Families Query',
  description: 'Query parameters for searching families',
});

export const ValidateInviteSchema = z.object({
  inviteCode: z.string()
    .min(1, 'Invite code is required')
    .openapi({
      example: 'ABC123XYZ',
      description: 'Group invitation code to validate',
    }),
}).openapi({
  title: 'Validate Invite Code',
  description: 'Validate a group invitation code',
});

export const UpdateGroupScheduleConfigSchema = z.object({
  defaultTimeSlots: z.array(z.object({
    weekday: WeekdayEnum,
    pickupTime: z.string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
      .openapi({
        example: '08:00',
        description: 'Pickup time in HH:MM format',
      }),
    dropoffTime: z.string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
      .openapi({
        example: '16:30',
        description: 'Dropoff time in HH:MM format',
      }),
    maxChildren: z.number()
      .int()
      .min(1)
      .max(20)
      .openapi({
        example: 4,
        description: 'Maximum number of children per time slot',
      }),
  })).optional()
    .openapi({
      description: 'Default time slots for the group schedule',
    }),
  rules: z.object({
    advanceBookingHours: z.number()
      .int()
      .min(0)
      .max(168)
      .optional()
      .openapi({
        example: 24,
        description: 'Minimum hours in advance for booking',
      }),
    cancellationDeadlineHours: z.number()
      .int()
      .min(0)
      .max(168)
      .optional()
      .openapi({
        example: 2,
        description: 'Hours before trip when cancellation is still allowed',
      }),
    maxTripsPerWeek: z.number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .openapi({
        example: 10,
        description: 'Maximum trips per family per week',
      }),
  }).optional()
    .openapi({
      description: 'Group scheduling rules and constraints',
    }),
}).openapi({
  title: 'Update Group Schedule Config',
  description: 'Update group schedule configuration',
});

export const WeekdayQuerySchema = z.object({
  weekday: WeekdayEnum.optional()
    .openapi({
      example: 'MONDAY',
      description: 'Filter by specific weekday',
    }),
}).openapi({
  title: 'Weekday Query',
  description: 'Query parameter for weekday filtering',
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================

export const GroupParamsSchema = z.object({
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
}).openapi({
  title: 'Group Parameters',
  description: 'URL parameters for group-specific endpoints',
});

export const InvitationParamsSchema = z.object({
  invitationId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique invitation identifier (CUID format)',
    }),
}).openapi({
  title: 'Invitation Parameters',
  description: 'URL parameters for invitation-specific endpoints',
});

export const FamilyRoleParamsSchema = z.object({
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique family identifier (CUID format)',
    }),
}).openapi({
  title: 'Group and Family Role Parameters',
  description: 'URL parameters for family role endpoints',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const GroupResponseSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Morning School Run',
      description: 'Group display name',
    }),
  description: z.string()
    .nullable()
    .optional()
    .openapi({
      example: 'Carpool group for morning school transportation',
      description: 'Group description',
    }),
  inviteCode: z.string()
    .optional()
    .openapi({
      example: 'ABC123XYZ',
      description: 'Group invitation code',
    }),
  familyId: z.string()
    .cuid()
    .optional()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Owner family ID',
    }),
  userRole: GroupRoleEnum.optional()
    .openapi({
      example: 'ADMIN',
      description: "User's role in the group (ADMIN or MEMBER, never OWNER)",
    }),
  ownerFamily: z.object({
    id: z.string().cuid().openapi({
      example: 'cl123456789012345678901238',
      description: 'Owner family ID',
    }),
    name: z.string().openapi({
      example: 'Smith Family',
      description: 'Owner family name',
    }),
  }).optional()
    .openapi({
      description: 'Owner family information',
    }),
  familyCount: z.number()
    .optional()
    .openapi({
      example: 3,
      description: 'Total number of families in the group (including owner)',
    }),
  scheduleCount: z.number()
    .optional()
    .openapi({
      example: 5,
      description: 'Number of schedule slots configured for the group',
    }),
  createdAt: z.string()
    .datetime()
    .optional()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the group was created',
    }),
  updatedAt: z.string()
    .datetime()
    .optional()
    .openapi({
      example: '2023-01-15T10:30:00.000Z',
      description: 'When the group was last updated',
    }),
  _count: z.object({
    families: z.number().openapi({
      example: 3,
      description: 'Number of families in the group',
    }),
    children: z.number().openapi({
      example: 8,
      description: 'Number of children in the group',
    }),
  }).optional()
    .openapi({
      description: 'Counts of related entities',
    }),
}).openapi({
  title: 'Group Response',
  description: 'Complete group information with user context',
});

export const GroupMembershipSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Unique membership identifier (CUID format)',
    }),
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Family identifier',
    }),
  role: GroupRoleEnum
    .openapi({
      example: 'MEMBER',
      description: 'Family role in the group',
    }),
  joinedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the family joined the group',
    }),
  family: z.object({
    id: z.string().cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Family information (included when fetching memberships)',
    }),
}).openapi({
  title: 'Group Membership',
  description: 'Family membership in a group',
});

/**
 * Update Family Role Response Schema
 * Matches the actual Prisma GroupFamilyMember return type with nested family object and ISO dates
 * Returned by GroupService.updateFamilyRole()
 */
export const UpdateFamilyRoleResponseSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Unique membership identifier (CUID format)',
    }),
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Family identifier',
    }),
  role: GroupRoleEnum
    .openapi({
      example: 'ADMIN',
      description: 'Updated family role in the group',
    }),
  joinedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the family joined the group (ISO 8601 format)',
    }),
  addedBy: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'User who added the family to the group',
    }),
  family: z.object({
    id: z.string()
      .cuid()
      .openapi({
        example: 'cl123456789012345678901239',
        description: 'Family identifier',
      }),
    name: z.string()
      .openapi({
        example: 'Smith Family',
        description: 'Family display name',
      }),
    createdAt: z.string()
      .datetime()
      .openapi({
        example: '2023-01-01T00:00:00.000Z',
        description: 'When the family was created (ISO 8601 format)',
      }),
    updatedAt: z.string()
      .datetime()
      .openapi({
        example: '2023-01-15T10:30:00.000Z',
        description: 'When the family was last updated (ISO 8601 format)',
      }),
  }).openapi({
    description: 'Nested family object with full details',
  }),
}).openapi({
  title: 'Update Family Role Response',
  description: 'Response after updating a family role in a group, with nested family details',
});

/**
 * Enriched Group Family Schema for getGroupFamilies endpoint
 * Contains all GroupMembershipSchema fields plus additional context:
 * - isMyFamily: Whether this is the requester's family
 * - canManage: Whether the requester can manage this family
 * - admins: List of family admin contacts
 * - Optional invitation fields for pending invitations
 *
 * Note: Using discriminated union by making all fields optional to avoid
 * Zod union type inference issues with .optional() fields
 */
/**
 * Family Search Result Schema
 * Returned by searchFamiliesForInvitation endpoint
 * Matches FamilySearchResult interface from GroupTypes.ts
 */
export const FamilySearchResultSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Family identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Smith Family',
      description: 'Family display name',
    }),
  adminContacts: z.array(z.object({
    name: z.string().openapi({
      example: 'John Smith',
      description: 'Admin name',
    }),
    email: z.string().email().openapi({
      example: 'john.smith@example.com',
      description: 'Admin email',
    }),
  })).openapi({
    example: [
      { name: 'John Smith', email: 'john.smith@example.com' },
      { name: 'Jane Smith', email: 'jane.smith@example.com' },
    ],
    description: 'List of family admin contacts',
  }),
  memberCount: z.number()
    .openapi({
      example: 4,
      description: 'Number of members in the family',
    }),
  canInvite: z.boolean()
    .openapi({
      example: true,
      description: 'Whether this family can be invited (false if already has pending invitation)',
    }),
}).openapi({
  title: 'Family Search Result',
  description: 'Family search result for group invitations',
});

export const EnrichedGroupFamilySchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Family identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Smith Family',
      description: 'Family display name',
    }),
  role: z.enum(['ADMIN', 'MEMBER', 'OWNER'])
    .openapi({
      example: 'ADMIN',
      description: 'Family role in the group (OWNER for the owning family, ADMIN or MEMBER for other families)',
    }),
  isMyFamily: z.boolean()
    .openapi({
      example: false,
      description: 'Whether this is the requester\'s family',
    }),
  canManage: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the requester can manage this family (only for admins and not their own family)',
    }),
  admins: z.array(z.object({
    name: z.string().openapi({
      example: 'John Smith',
      description: 'Admin name',
    }),
    email: z.string().email().openapi({
      example: 'john.smith@example.com',
      description: 'Admin email',
    }),
  })).openapi({
    example: [
      { name: 'John Smith', email: 'john.smith@example.com' },
      { name: 'Jane Smith', email: 'jane.smith@example.com' },
    ],
    description: 'List of family admin contacts',
  }),
  // Optional invitation fields (only present for pending invitations)
  status: InvitationStatusEnum.optional()
    .openapi({
      example: 'PENDING',
      description: 'Invitation status (only for families with pending invitations)',
    }),
  invitationId: z.string().cuid().optional()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Invitation ID (only for families with pending invitations)',
    }),
  inviteCode: z.string().optional()
    .openapi({
      example: 'ABC123XYZ',
      description: 'Invitation code (only for families with pending invitations)',
    }),
  invitedAt: z.string().datetime().optional()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the invitation was sent (only for families with pending invitations)',
    }),
  expiresAt: z.string().datetime().optional()
    .openapi({
      example: '2023-02-01T00:00:00.000Z',
      description: 'When the invitation expires (only for families with pending invitations)',
    }),
}).openapi({
  title: 'Enriched Group Family',
  description: 'Family in a group with enriched context including admin contacts and invitation status',
});

export const GroupInvitationSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Unique invitation identifier (CUID format)',
    }),
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901241',
      description: 'Family identifier being invited',
    }),
  role: GroupRoleEnum
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
      example: 'Welcome to our carpool group!',
      description: 'Personal invitation message',
    }),
  invitedBy: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'User who sent the invitation',
    }),
  invitedByUser: z.object({
    id: z.string().cuid(),
    name: z.string(),
    email: z.string().email(),
  }).optional()
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
  title: 'Group Invitation',
  description: 'Group invitation details',
});

export const InvitationValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the invite code is valid',
    }),
  group: GroupResponseSchema.nullable()
    .openapi({
      description: 'Group information if valid, null if invalid',
    }),
  userStatus: z.enum(['NO_FAMILY', 'FAMILY_MEMBER', 'FAMILY_ADMIN', 'ALREADY_MEMBER'])
    .openapi({
      example: 'FAMILY_MEMBER',
      description: 'User family status',
    }),
  actionRequired: z.enum(['CREATE_FAMILY', 'CONTACT_ADMIN', 'ALREADY_ACCEPTED', 'READY_TO_JOIN'])
    .openapi({
      example: 'READY_TO_JOIN',
      description: 'Action required for user to join',
    }),
}).openapi({
  title: 'Invitation Validation',
  description: 'Result of invitation code validation',
});

export const GroupScheduleConfigSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
    .openapi({
      example: 'Schedule configuration updated successfully',
      description: 'Success message',
    }),
  data: z.object({
    timeSlotsUpdated: z.number()
      .openapi({
        example: 5,
        description: 'Number of time slots updated',
      }),
    rulesUpdated: z.boolean()
      .openapi({
        example: true,
        description: 'Whether rules were updated',
      }),
  }).optional()
    .openapi({
      description: 'Additional response data',
    }),
}).openapi({
  title: 'Group Schedule Config Success Response',
  description: 'Success response for schedule configuration operations',
});

// ============================================================================
// SCHEDULE CONFIG SCHEMAS
// ============================================================================

/**
 * Schedule Hours Schema - Maps weekdays to time slot arrays
 * All times are stored as UTC times (e.g., "07:00" means 07:00 UTC)
 */
export const ScheduleHoursSchema = z.record(
  z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
  z.array(z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'))
).openapi({
  example: {
    MONDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
    TUESDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
    WEDNESDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
    THURSDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
    FRIDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
  },
  description: 'Schedule hours mapping weekdays to UTC time slots',
});

/**
 * Update Schedule Config Request Schema
 */
export const UpdateScheduleConfigRequestSchema = z.object({
  scheduleHours: ScheduleHoursSchema.openapi({
    description: 'Schedule hours configuration',
  }),
}).openapi({
  title: 'Update Schedule Config Request',
  description: 'Request body for updating group schedule configuration',
});

/**
 * Group Schedule Config Response Schema
 */
export const GroupScheduleConfigResponseSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'Config ID',
  }),
  groupId: z.string().cuid().openapi({
    example: 'cl123456789012345678901235',
    description: 'Group ID',
  }),
  scheduleHours: ScheduleHoursSchema.openapi({
    description: 'Schedule hours configuration',
  }),
  group: z.object({
    id: z.string().cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Group information',
    }),
  createdAt: z.string().datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  }),
  updatedAt: z.string().datetime().openapi({
    example: '2023-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  }),
}).openapi({
  title: 'Group Schedule Config Response',
  description: 'Group schedule configuration with full details',
});

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

/**
 * Helper function to create a success response schema with data
 * Wraps any data schema in { success: true, data: T }
 */
export const createSuccessSchema = <T extends z.ZodType>(schema: T) => {
  return z.object({
    success: z.boolean(),
    data: schema,
  });
};

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
  code: z.string().optional().openapi({
    example: 'BAD_REQUEST',
    description: 'Error code for programmatic handling',
  }),
}).openapi({
  title: 'Error Response',
  description: 'Standard error response',
});