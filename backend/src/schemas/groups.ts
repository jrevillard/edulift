/**
 * Groups Schemas with OpenAPI Extensions
 *
 * Zod schemas for groups management endpoints with OpenAPI documentation
 * Phase 5: Groups domain migration following Auth/Children/Vehicles template pattern
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry, registerPath } from '../config/openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// ============================================================================
// ENUMS
// ============================================================================

export const GroupRoleEnum = z.enum(['MEMBER', 'ADMIN']).openapi({
  description: 'Role of a family within a group',
  example: 'MEMBER',
});

export const UserRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']).openapi({
  description: 'User\'s role within a group context',
  example: 'MEMBER',
});

export const WeekdayEnum = z.enum([
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'FRIDAY', 'SATURDAY', 'SUNDAY',
]).openapi({
  description: 'Day of the week',
  example: 'MONDAY',
});

const UserStatusEnum = z.enum([
  'NO_FAMILY', 'FAMILY_MEMBER', 'FAMILY_ADMIN', 'ALREADY_MEMBER',
]).openapi({
  description: 'User family status for invitation validation',
  example: 'FAMILY_MEMBER',
});

const ActionRequiredEnum = z.enum([
  'CREATE_FAMILY', 'CONTACT_ADMIN', 'ALREADY_ACCEPTED', 'READY_TO_JOIN',
]).openapi({
  description: 'Action required for user to join group',
  example: 'READY_TO_JOIN',
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// Request Schemas
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
  description: 'Update group information (partial)',
});

export const UpdateFamilyRoleSchema = z.object({
  role: GroupRoleEnum.openapi({
    example: 'ADMIN',
    description: 'New role for the family in the group',
  }),
}).openapi({
  title: 'Update Family Role',
  description: 'Update a family role within a group',
});

export const InviteFamilySchema = z.object({
  familyId: z.string()
    .min(1, 'Family ID is required')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Target family ID to invite',
    }),
  role: GroupRoleEnum.default('MEMBER').openapi({
    example: 'MEMBER',
    description: 'Role for the invited family (defaults to MEMBER)',
  }),
  personalMessage: z.string()
    .max(500, 'Personal message too long')
    .optional()
    .openapi({
      example: 'Looking forward to carpooling with you!',
      description: 'Optional personal message for the invitation',
    }),
}).openapi({
  title: 'Invite Family',
  description: 'Invite a family to join the group',
});

export const SearchFamiliesSchema = z.object({
  searchTerm: z.string()
    .min(1, 'Search term is required')
    .openapi({
      example: 'Johnson',
      description: 'Search term to find families by name',
    }),
}).openapi({
  title: 'Search Families',
  description: 'Search for families to invite to the group',
});

export const ValidateInviteSchema = z.object({
  inviteCode: z.string()
    .min(1, 'Invite code is required')
    .openapi({
      example: 'ABC123XYZ',
      description: 'Invitation code to validate',
    }),
}).openapi({
  title: 'Validate Invite Code',
  description: 'Validate a group invitation code',
});

// Helper functions for schedule validation
const isValidWeekday = (day: string): boolean => {
  const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  return validDays.includes(day);
};

const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const UpdateScheduleConfigSchema = z.object({
  scheduleHours: z.record(z.string(), z.array(z.string()))
    .refine(
      (schedule) => Object.entries(schedule).every(([day, times]) =>
        isValidWeekday(day) && times.every(isValidTimeFormat),
      ),
      { message: 'Invalid schedule hours format - require valid weekdays and HH:MM time format' },
    )
    .openapi({
      example: {
        MONDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
        TUESDAY: ['07:00', '08:00', '15:00', '16:00'],
        FRIDAY: ['07:00', '07:30', '08:00', '15:00', '16:00'],
      },
      description: 'Schedule hours by day of week (HH:MM format)',
    }),
}).openapi({
  title: 'Update Schedule Configuration',
  description: 'Update group schedule configuration',
});

// ============================================================================
// PARAMETER SCHEMAS
// ============================================================================
export const GroupParamsSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
}).openapi({
  title: 'Group Parameters',
  description: 'URL parameters for group-specific endpoints',
});

export const InvitationParamsSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
  invitationId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique invitation identifier (CUID format)',
    }),
}).openapi({
  title: 'Invitation Parameters',
  description: 'URL parameters for invitation-specific endpoints',
});

export const FamilyRoleParamsSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique group identifier (CUID format)',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Unique family identifier (CUID format)',
    }),
}).openapi({
  title: 'Family Role Parameters',
  description: 'URL parameters for family role endpoints',
});

export const WeekdayQuerySchema = z.object({
  weekday: WeekdayEnum.openapi({
    example: 'MONDAY',
    description: 'Day of the week to get time slots for',
  }),
}).openapi({
  title: 'Weekday Query Parameters',
  description: 'Query parameters for weekday-based filtering',
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
export const OwnerFamilySchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Owner family identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Johnson Family',
      description: 'Owner family name',
    }),
}).openapi({
  title: 'Owner Family',
  description: 'Owner family information',
});

export const FamilyGroupMemberSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Family member identifier',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Family identifier',
    }),
  role: GroupRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Family role in the group',
  }),
  joinedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the family joined the group',
    }),
  family: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Family information (included when fetching group families)',
    }),
}).openapi({
  title: 'Family Group Member',
  description: 'Family membership in a group',
});

export const GroupResponseSchema = z.object({
  id: z.cuid()
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
    .openapi({
      example: 'Carpool group for morning school transportation',
      description: 'Group description (null if not set)',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Owner family identifier',
    }),
  inviteCode: z.string()
    .openapi({
      example: 'ABC123XYZ',
      description: 'Group invitation code',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Group creation timestamp',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Last update timestamp',
    }),
  userRole: UserRoleEnum.openapi({
    example: 'ADMIN',
    description: 'Current user\'s role in this group',
  }),
  ownerFamily: OwnerFamilySchema.openapi({
    description: 'Owner family information',
  }),
  _count: z.object({
    familyMembers: z.number()
      .openapi({
        example: 3,
        description: 'Number of families in the group',
      }),
  }).optional()
    .openapi({
      description: 'Count information (included in some responses)',
    }),
  familyCount: z.number()
    .openapi({
      example: 3,
      description: 'Total number of families in the group',
    }),
  familyMembers: z.array(FamilyGroupMemberSchema).optional()
    .openapi({
      description: 'Family members (included when fetching group families)',
    }),
}).openapi({
  title: 'Group Response',
  description: 'Complete group information with user context',
});

export const FamilySearchResultSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Family identifier',
    }),
  name: z.string()
    .openapi({
      example: 'Smith Family',
      description: 'Family name',
    }),
  adminContacts: z.array(z.object({
    name: z.string()
      .openapi({
        example: 'John Smith',
        description: 'Admin contact name',
      }),
    email: z.email()
      .openapi({
        example: 'john.smith@example.com',
        description: 'Admin contact email',
      }),
  })).openapi({
    description: 'Family admin contacts for invitations',
  }),
  memberCount: z.number()
    .openapi({
      example: 4,
      description: 'Number of members in the family',
    }),
  canInvite: z.boolean()
    .openapi({
      example: true,
      description: 'Whether this family can be invited',
    }),
}).openapi({
  title: 'Family Search Result',
  description: 'Family search result for invitations',
});

export const GroupInvitationSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901239',
      description: 'Invitation identifier',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  targetFamilyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Target family identifier',
    }),
  role: GroupRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Invited role in the group',
  }),
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).openapi({
    example: 'PENDING',
    description: 'Invitation status',
  }),
  personalMessage: z.string().nullable().optional().openapi({
    example: 'Looking forward to carpooling with you!',
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
  group: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Group information (included in some responses)',
    }),
  targetFamily: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Target family information (included in some responses)',
    }),
}).openapi({
  title: 'Group Invitation',
  description: 'Group invitation information',
});

export const InvitationValidationSchema = z.object({
  valid: z.boolean()
    .openapi({
      example: true,
      description: 'Whether the invitation code is valid',
    }),
  error: z.string().optional().openapi({
    example: 'Invitation code is required',
    description: 'Error message if invalid',
  }),
  group: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Group information (if valid)',
    }),
  invitation: z.object({
    id: z.cuid(),
    expiresAt: z.iso.datetime(),
    role: GroupRoleEnum,
  }).optional()
    .openapi({
      description: 'Invitation information (if valid)',
    }),
  userStatus: UserStatusEnum.optional().openapi({
    example: 'FAMILY_MEMBER',
    description: 'User family status (authenticated validation only)',
  }),
  familyInfo: z.object({
    id: z.cuid(),
    name: z.string(),
    role: z.string(),
    adminName: z.string().optional(),
  }).optional()
    .openapi({
      description: 'User family information (authenticated validation only)',
    }),
  canAccept: z.boolean().optional().openapi({
    example: true,
    description: 'Whether user can accept invitation (authenticated validation only)',
  }),
  message: z.string().optional().openapi({
    example: 'You are ready to join this group',
    description: 'Message for user (authenticated validation only)',
  }),
  actionRequired: ActionRequiredEnum.optional().openapi({
    example: 'READY_TO_JOIN',
    description: 'Action required for user to join (authenticated validation only)',
  }),
}).openapi({
  title: 'Invitation Validation Response',
  description: 'Invitation code validation result',
});

export const GroupMembershipSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Membership identifier',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Family identifier',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  role: GroupRoleEnum.openapi({
    example: 'MEMBER',
    description: 'Family role in the group',
  }),
  joinedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the family joined the group',
    }),
  family: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Family information',
    }),
  group: z.object({
    id: z.cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Group information',
    }),
}).openapi({
  title: 'Group Membership',
  description: 'Family membership in a group',
});

export const ScheduleConfigSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901240',
      description: 'Schedule configuration identifier',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  scheduleHours: z.record(z.string(), z.array(z.string())).openapi({
    example: {
      MONDAY: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
      FRIDAY: ['07:00', '07:30', '08:00', '15:00', '16:00'],
    },
    description: 'Schedule hours by day of week (HH:MM format)',
  }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Configuration creation timestamp',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Configuration update timestamp',
    }),
  isDefault: z.boolean().optional().openapi({
    example: false,
    description: 'Whether this is default configuration',
  }),
}).openapi({
  title: 'Group Schedule Configuration',
  description: 'Group schedule configuration',
});

export const TimeSlotsResponseSchema = z.object({
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Group identifier',
    }),
  weekday: WeekdayEnum.openapi({
    example: 'MONDAY',
    description: 'Day of the week',
  }),
  timeSlots: z.array(z.string()).openapi({
    example: ['07:00', '07:30', '08:00', '15:00', '15:30', '16:00'],
    description: 'Available time slots for the weekday',
  }),
}).openapi({
  title: 'Time Slots Response',
  description: 'Time slots for a specific weekday',
});

export const DefaultScheduleResponseSchema = z.object({
  scheduleHours: z.record(z.string(), z.array(z.string())).openapi({
    example: {
      MONDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
      FRIDAY: ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
    },
    description: 'Default schedule hours by day of week',
  }),
  isDefault: z.literal(true).openapi({
    description: 'Always true for default schedule',
  }),
}).openapi({
  title: 'Default Schedule Response',
  description: 'Default schedule configuration',
});

// Register schemas with OpenAPI registry
registry.register('CreateGroupRequest', CreateGroupSchema);
registry.register('JoinGroupRequest', JoinGroupSchema);
registry.register('UpdateGroupRequest', UpdateGroupSchema);
registry.register('UpdateFamilyRoleRequest', UpdateFamilyRoleSchema);
registry.register('InviteFamilyRequest', InviteFamilySchema);
registry.register('SearchFamiliesRequest', SearchFamiliesSchema);
registry.register('ValidateInviteRequest', ValidateInviteSchema);
registry.register('UpdateScheduleConfigRequest', UpdateScheduleConfigSchema);



// Register API paths following Auth pattern

// Public route (no auth required)
registerPath({
  method: 'post',
  path: '/groups/validate-invite',
  tags: ['Groups'],
  summary: 'Validate invitation code (public)',
  description: 'Validate a group invitation code without authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidateInviteRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invitation code validation result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: InvitationValidationSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Authenticated invitation validation
registerPath({
  method: 'post',
  path: '/groups/validate-invite-auth',
  tags: ['Groups'],
  summary: 'Validate invitation code (authenticated)',
  description: 'Validate a group invitation code with user context',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidateInviteRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invitation code validation result with user context',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: InvitationValidationSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invitation code',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

// Group CRUD operations
registerPath({
  method: 'post',
  path: '/groups',
  tags: ['Groups'],
  summary: 'Create group',
  description: 'Create a new group. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateGroupRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Group created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: GroupResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or insufficient permissions',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions or no family',
    },
  },
});

registerPath({
  method: 'post',
  path: '/groups/join',
  tags: ['Groups'],
  summary: 'Join group by invite code',
  description: 'Join a group using an invitation code',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/JoinGroupRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Group joined successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: GroupMembershipSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid invite code or already member',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'get',
  path: '/groups/my-groups',
  tags: ['Groups'],
  summary: 'Get user groups',
  description: 'Retrieve all groups the authenticated user belongs to',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Groups retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(GroupResponseSchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'get',
  path: '/groups/{groupId}/families',
  tags: ['Groups'],
  summary: 'Get group families',
  description: 'Retrieve all families in a group. Requires group membership.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Group families retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(FamilyGroupMemberSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a group member',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'patch',
  path: '/groups/{groupId}',
  tags: ['Groups'],
  summary: 'Update group (PATCH)',
  description: 'Update group information. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateGroupRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Group updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: GroupResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or no update data provided',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/groups/{groupId}',
  tags: ['Groups'],
  summary: 'Delete group',
  description: 'Delete a group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Group deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              success: z.literal(true),
              message: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'post',
  path: '/groups/{groupId}/leave',
  tags: ['Groups'],
  summary: 'Leave group',
  description: 'Leave a group as a family member',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Group left successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              success: z.literal(true),
              message: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a group member or cannot leave (owner)',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

// Family management endpoints
registerPath({
  method: 'patch',
  path: '/groups/{groupId}/families/{familyId}/role',
  tags: ['Groups'],
  summary: 'Update family role',
  description: 'Update a family role within a group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyRoleParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateFamilyRoleRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Family role updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: FamilyGroupMemberSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or IDs',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group, family, or membership does not exist',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/groups/{groupId}/families/{familyId}',
  tags: ['Groups'],
  summary: 'Remove family from group',
  description: 'Remove a family from a group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: FamilyRoleParamsSchema,
  },
  responses: {
    200: {
      description: 'Family removed from group successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              success: z.literal(true),
              message: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group or family ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group, family, or membership does not exist',
    },
  },
});

// Invitation management endpoints
registerPath({
  method: 'post',
  path: '/groups/{groupId}/search-families',
  tags: ['Groups'],
  summary: 'Search families for invitation',
  description: 'Search for families to invite to the group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SearchFamiliesRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Families found successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(FamilySearchResultSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid search term or group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'post',
  path: '/groups/{groupId}/invite',
  tags: ['Groups'],
  summary: 'Invite family to group',
  description: 'Invite a family to join the group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/InviteFamilyRequest' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Family invited successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: GroupInvitationSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or family already invited',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group or family does not exist',
    },
  },
});

registerPath({
  method: 'get',
  path: '/groups/{groupId}/invitations',
  tags: ['Groups'],
  summary: 'Get pending invitations',
  description: 'Retrieve all pending invitations for a group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Pending invitations retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(GroupInvitationSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'delete',
  path: '/groups/{groupId}/invitations/{invitationId}',
  tags: ['Groups'],
  summary: 'Cancel invitation',
  description: 'Cancel a pending group invitation. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: InvitationParamsSchema,
  },
  responses: {
    200: {
      description: 'Invitation cancelled successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              success: z.literal(true),
              message: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group or invitation ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group or invitation does not exist',
    },
  },
});

// Schedule configuration endpoints
registerPath({
  method: 'get',
  path: '/groups/schedule-config/default',
  tags: ['Groups'],
  summary: 'Get default schedule hours',
  description: 'Retrieve default schedule hours configuration',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Default schedule hours retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: DefaultScheduleResponseSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registerPath({
  method: 'get',
  path: '/groups/{groupId}/schedule-config',
  tags: ['Groups'],
  summary: 'Get group schedule configuration',
  description: 'Retrieve schedule configuration for a group. Requires group membership.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Group schedule configuration retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ScheduleConfigSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a group member',
    },
    404: {
      description: 'Not found - Group or configuration does not exist',
    },
  },
});

registerPath({
  method: 'get',
  path: '/groups/{groupId}/schedule-config/time-slots',
  tags: ['Groups'],
  summary: 'Get time slots for weekday',
  description: 'Retrieve available time slots for a specific weekday. Requires group membership.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
    query: WeekdayQuerySchema,
  },
  responses: {
    200: {
      description: 'Time slots retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TimeSlotsResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID or weekday',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Not a group member',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'put',
  path: '/groups/{groupId}/schedule-config',
  tags: ['Groups'],
  summary: 'Update group schedule configuration',
  description: 'Update schedule configuration for a group. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateScheduleConfigRequest' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Group schedule configuration updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ScheduleConfigSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data or group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});

registerPath({
  method: 'post',
  path: '/groups/{groupId}/schedule-config/reset',
  tags: ['Groups'],
  summary: 'Reset group schedule configuration',
  description: 'Reset group schedule configuration to default. Requires group admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: GroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Group schedule configuration reset successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ScheduleConfigSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Group does not exist',
    },
  },
});