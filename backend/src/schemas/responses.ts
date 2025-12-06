/**
 * Standard API Response Schemas with OpenAPI Extensions
 *
 * This file provides standardized response schemas that wrap the existing
 * response schemas to ensure consistent ApiResponse format across all endpoints
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../config/openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

/**
 * Generic Success Response Wrapper
 * This ensures all success responses have consistent structure
 */
export const createSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).openapi({
    title: 'Success Response',
    description: 'Standard success response format with data payload',
  });
};

/**
 * Generic Error Response
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
    .openapi({
      example: 'Validation failed',
      description: 'Human-readable error message',
    }),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
  })).optional()
    .openapi({
      example: [{
        field: 'email',
        message: 'Invalid email format',
        code: 'invalid_string',
      }],
      description: 'Detailed validation errors (when applicable)',
    }),
}).openapi({
  title: 'Error Response',
  description: 'Standard error response format with optional validation details',
});

/**
 * Import existing response schemas to wrap them
 */
import { UserResponseSchema } from './auth';
import { VehicleResponseSchema } from './vehicles';
import { ChildResponseSchema } from './children';
import { FamilyResponseSchema } from './families';
import { GroupResponseSchema, ScheduleConfigSchema, FamilyGroupMemberSchema, FamilySearchResultSchema } from './groups';
import { TodayScheduleResponseSchema, RecentActivityResponseSchema, DashboardStatsSchema, WeeklyDashboardResponseSchema } from './dashboard';
import { FcmTokenResponseSchema } from './fcmTokens';
import { ScheduleResponseSchema, ScheduleSlotSchema, ChildAssignmentSchema, AvailableChildSchema, ScheduleSlotConflictSchema } from './scheduleSlots';

/**
 * Wrapped Response Schemas for Endpoints
 */
export const MagicLinkSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
    userExists: z.boolean(),
  }),
);

// Raw auth response data (without success/data wrapper)
const AuthDataSchema = z.object({
  user: UserResponseSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.string(),
  // Legacy fields for backward compatibility
  token: z.string(),
  expiresAt: z.string(),
  // Optional invitation result
  invitationResult: z.any().optional(),
});

export const AuthSuccessResponseSchema = createSuccessResponseSchema(AuthDataSchema);

export const RefreshTokenSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
    tokenType: z.string(),
  }),
);

export const ProfileSuccessResponseSchema = createSuccessResponseSchema(UserResponseSchema);

export const DeleteAccountSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
    deletedAt: z.string(),
  }),
);

export const VehicleSuccessResponseSchema = createSuccessResponseSchema(VehicleResponseSchema);

export const VehiclesSuccessResponseSchema = createSuccessResponseSchema(
  z.array(VehicleResponseSchema),
);

export const ChildSuccessResponseSchema = createSuccessResponseSchema(ChildResponseSchema);

export const ChildrenSuccessResponseSchema = createSuccessResponseSchema(
  z.array(ChildResponseSchema),
);

export const FamilySuccessResponseSchema = createSuccessResponseSchema(FamilyResponseSchema);

export const GroupSuccessResponseSchema = createSuccessResponseSchema(GroupResponseSchema);

export const GroupsSuccessResponseSchema = createSuccessResponseSchema(
  z.array(GroupResponseSchema),
);

export const DashboardStatsSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    totalUsers: z.number(),
    totalFamilies: z.number(),
    totalGroups: z.number(),
    totalVehicles: z.number(),
    totalChildren: z.number(),
  }),
);

export const TodayScheduleSuccessResponseSchema = createSuccessResponseSchema(TodayScheduleResponseSchema);

export const RecentActivitySuccessResponseSchema = createSuccessResponseSchema(RecentActivityResponseSchema);

/**
 * Dashboard stats response schema for user dashboard
 */
export const UserDashboardStatsSuccessResponseSchema = createSuccessResponseSchema(DashboardStatsSchema);

/**
 * Weekly dashboard data schema (extracted from WeeklyDashboardResponseSchema)
 */
export const WeeklyDashboardDataSchema = WeeklyDashboardResponseSchema.shape.data;

export const FcmTokenSuccessResponseSchema = createSuccessResponseSchema(FcmTokenResponseSchema);

export const FcmTokensSuccessResponseSchema = createSuccessResponseSchema(
  z.array(FcmTokenResponseSchema),
);

export const ScheduleSuccessResponseSchema = createSuccessResponseSchema(ScheduleResponseSchema);

export const ScheduleSlotSuccessResponseSchema = createSuccessResponseSchema(ScheduleSlotSchema);

export const ChildAssignmentSuccessResponseSchema = createSuccessResponseSchema(ChildAssignmentSchema);

export const AvailableChildrenSuccessResponseSchema = createSuccessResponseSchema(z.array(AvailableChildSchema));

export const ScheduleSlotConflictsSuccessResponseSchema = createSuccessResponseSchema(z.array(ScheduleSlotConflictSchema));

export const ScheduleVehicleSuccessResponseSchema = createSuccessResponseSchema(VehicleResponseSchema);

export const GroupScheduleConfigSuccessResponseSchema = createSuccessResponseSchema(ScheduleConfigSchema);

/**
 * Generic responses for simple operations
 */
export const SimpleSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
  }),
);

export const CreationSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
    id: z.string(),
  }),
);

export const InvitationCreationResponseSchema = createSuccessResponseSchema(
  z.object({
    id: z.string(),
    inviteCode: z.string(),
    invitationUrl: z.string(),
  }),
);

/**
 * Permissions response schema
 */
export const PermissionsSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    permissions: z.array(z.string()),
    role: z.string(),
  }),
);

/**
 * Family invitation response schema
 */
export const FamilyInvitationSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    id: z.string(),
    familyId: z.string(),
    email: z.string(),
    role: z.string(),
    personalMessage: z.string().optional(),
    invitedBy: z.string(),
    createdBy: z.string(),
    acceptedBy: z.string().nullable(),
    status: z.string(),
    inviteCode: z.string(),
    expiresAt: z.string(),
    acceptedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    message: z.string(),
  }),
);

/**
 * Pending invitations response schema
 */
export const PendingInvitationsSuccessResponseSchema = createSuccessResponseSchema(
  z.array(z.object({
    id: z.string(),
    familyId: z.string(),
    email: z.string(),
    role: z.string(),
    personalMessage: z.string().optional(),
    invitedBy: z.string(),
    status: z.string(),
    inviteCode: z.string(),
    expiresAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    invitedByUser: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }).optional(),
  })),
);

/**
 * Invite code validation response schema
 */
export const InviteCodeValidationSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    valid: z.literal(true),
    family: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
);

/**
 * Family group member response schema
 */
export const FamilyGroupMemberSuccessResponseSchema = createSuccessResponseSchema(
  FamilyGroupMemberSchema,
);

/**
 * Family search results response schema
 */
export const FamilySearchSuccessResponseSchema = createSuccessResponseSchema(
  z.array(FamilySearchResultSchema),
);

// Register all response schemas with OpenAPI registry
registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('MagicLinkSuccessResponse', MagicLinkSuccessResponseSchema);
registry.register('AuthSuccessResponse', AuthSuccessResponseSchema);
registry.register('RefreshTokenSuccessResponse', RefreshTokenSuccessResponseSchema);
registry.register('ProfileSuccessResponse', ProfileSuccessResponseSchema);
registry.register('DeleteAccountSuccessResponse', DeleteAccountSuccessResponseSchema);
registry.register('VehicleSuccessResponse', VehicleSuccessResponseSchema);
registry.register('VehiclesSuccessResponse', VehiclesSuccessResponseSchema);
registry.register('ChildSuccessResponse', ChildSuccessResponseSchema);
registry.register('ChildrenSuccessResponse', ChildrenSuccessResponseSchema);
registry.register('FamilySuccessResponse', FamilySuccessResponseSchema);
registry.register('GroupSuccessResponse', GroupSuccessResponseSchema);
registry.register('GroupsSuccessResponse', GroupsSuccessResponseSchema);
registry.register('DashboardStatsSuccessResponse', DashboardStatsSuccessResponseSchema);
registry.register('TodayScheduleSuccessResponse', TodayScheduleSuccessResponseSchema);
registry.register('RecentActivitySuccessResponse', RecentActivitySuccessResponseSchema);
registry.register('UserDashboardStatsSuccessResponse', UserDashboardStatsSuccessResponseSchema);
registry.register('WeeklyDashboardData', WeeklyDashboardDataSchema);
registry.register('FcmTokenSuccessResponse', FcmTokenSuccessResponseSchema);
registry.register('FcmTokensSuccessResponse', FcmTokensSuccessResponseSchema);
registry.register('ScheduleSuccessResponse', ScheduleSuccessResponseSchema);
registry.register('ScheduleSlotSuccessResponse', ScheduleSlotSuccessResponseSchema);
registry.register('ChildAssignmentSuccessResponse', ChildAssignmentSuccessResponseSchema);
registry.register('AvailableChildrenSuccessResponse', AvailableChildrenSuccessResponseSchema);
registry.register('ScheduleSlotConflictsSuccessResponse', ScheduleSlotConflictsSuccessResponseSchema);
registry.register('ScheduleVehicleSuccessResponse', ScheduleVehicleSuccessResponseSchema);
registry.register('GroupScheduleConfigSuccessResponse', GroupScheduleConfigSuccessResponseSchema);
registry.register('SimpleSuccessResponse', SimpleSuccessResponseSchema);
registry.register('CreationSuccessResponse', CreationSuccessResponseSchema);
registry.register('InvitationCreationResponse', InvitationCreationResponseSchema);
registry.register('PermissionsSuccessResponse', PermissionsSuccessResponseSchema);
registry.register('FamilyInvitationSuccessResponse', FamilyInvitationSuccessResponseSchema);
registry.register('PendingInvitationsSuccessResponse', PendingInvitationsSuccessResponseSchema);
registry.register('InviteCodeValidationSuccessResponse', InviteCodeValidationSuccessResponseSchema);
registry.register('FamilyGroupMemberSuccessResponse', FamilyGroupMemberSuccessResponseSchema);
registry.register('FamilySearchSuccessResponse', FamilySearchSuccessResponseSchema);