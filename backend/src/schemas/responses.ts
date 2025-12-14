/**
 * Standard API Response Schemas with OpenAPI Extensions
 *
 * This file provides standardized response schemas that wrap the existing
 * response schemas to ensure consistent ApiResponse format across all endpoints
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../config/registry';

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
import { GroupResponseSchema, ScheduleConfigSchema, FamilyGroupMemberSchema, FamilySearchResultSchema, GroupInvitationSchema } from './groups';
import { TodayScheduleResponseSchema, RecentActivityResponseSchema, DashboardStatsSchema } from './dashboard';
import { FcmTokenResponseSchema } from './fcmTokens';
import { ScheduleResponseSchema, ScheduleSlotSchema, ChildAssignmentSchema, AvailableChildSchema, ScheduleVehicleAssignmentSchema } from './scheduleSlots';

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
 * Weekly dashboard data schema (matches DashboardService.getWeeklyDashboard response data)
 * CORRECTED: Now matches the original DayTransportSummary structure from backend/src/types/DashboardTypes.ts
 */
export const WeeklyDashboardDataSchema = z.object({
  days: z.array(z.object({
    date: z.string()
      .openapi({
        example: '2023-01-01',
        description: 'Date in YYYY-MM-DD format',
      }),
    transports: z.array(z.object({
      time: z.string()
        .openapi({
          example: '08:30',
          description: 'Time in HH:mm format',
        }),
      groupId: z.cuid()
        .openapi({
          description: 'Group identifier',
        }),
      groupName: z.string()
        .openapi({
          example: 'School Carpool Group A',
          description: 'Group name',
        }),
      scheduleSlotId: z.cuid()
        .openapi({
          description: 'Schedule slot identifier',
        }),
      vehicleAssignmentSummaries: z.array(z.object({
        vehicleId: z.cuid()
          .openapi({
            description: 'Vehicle identifier',
          }),
        vehicleName: z.string()
          .openapi({
            example: 'Toyota Sienna',
            description: 'Vehicle name',
          }),
        vehicleCapacity: z.number().int().min(0)
          .openapi({
            example: 7,
            description: 'Vehicle seating capacity',
          }),
        assignedChildrenCount: z.number().int().min(0)
          .openapi({
            example: 3,
            description: 'Number of children assigned to this vehicle',
          }),
        availableSeats: z.number().int()
          .openapi({
            example: 4,
            description: 'Number of available seats remaining',
          }),
        capacityStatus: z.enum(['available', 'limited', 'full', 'overcapacity'])
          .openapi({
            example: 'available',
            description: 'Capacity status based on seat availability',
          }),
        vehicleFamilyId: z.cuid()
          .openapi({
            description: 'Family ID that owns the vehicle',
          }),
        isFamilyVehicle: z.boolean()
          .openapi({
            example: true,
            description: 'Whether this vehicle belongs to the user\'s family',
          }),
        driver: z.object({
          id: z.cuid(),
          name: z.string(),
        }).optional()
          .openapi({
            description: 'Driver information if assigned',
          }),
        children: z.array(z.object({
          childId: z.cuid()
            .openapi({
              description: 'Child identifier',
            }),
          childName: z.string()
            .openapi({
              example: 'Emma Johnson',
              description: 'Child name',
            }),
          childFamilyId: z.cuid()
            .openapi({
              description: 'Family ID that owns the child',
            }),
          isFamilyChild: z.boolean()
            .openapi({
              example: true,
              description: 'Whether this child belongs to the user\'s family',
            }),
        })).optional()
          .openapi({
            description: 'Children assigned to this vehicle',
          }),
      }))
        .openapi({
          description: 'Vehicle assignment summaries for this transport slot',
        }),
      totalChildrenAssigned: z.number().int().min(0)
        .openapi({
          example: 5,
          description: 'Total number of children assigned across all vehicles',
        }),
      totalCapacity: z.number().int().min(0)
        .openapi({
          example: 14,
          description: 'Total seating capacity across all vehicles',
        }),
      overallCapacityStatus: z.enum(['available', 'limited', 'full', 'overcapacity'])
        .openapi({
          example: 'available',
          description: 'Overall capacity status across all vehicles',
        }),
    }))
      .openapi({
        description: 'Transport slots for this day',
      }),
    totalChildrenInVehicles: z.number().int().min(0)
      .openapi({
        example: 8,
        description: 'Total number of children in vehicles across all transport slots',
      }),
    totalVehiclesWithAssignments: z.number().int().min(0)
      .openapi({
        example: 2,
        description: 'Total number of vehicles with assignments across all transport slots',
      }),
    hasScheduledTransports: z.boolean()
      .openapi({
        example: true,
        description: 'Whether this day has any scheduled transport slots',
      }),
  }))
    .openapi({
      description: 'Array of days in the week with their transport summaries',
    }),
  startDate: z.string()
    .openapi({
      example: '2023-01-01',
      description: 'Week start date in YYYY-MM-DD format',
    }),
  endDate: z.string()
    .openapi({
      example: '2023-01-07',
      description: 'Week end date in YYYY-MM-DD format',
    }),
  generatedAt: z.string()
    .openapi({
      example: '2023-01-01T12:00:00.000Z',
      description: 'Timestamp when the dashboard was generated (ISO 8601 format)',
    }),
  metadata: z.object({
    familyId: z.cuid()
      .openapi({
        description: 'Family identifier',
      }),
    familyName: z.string()
      .openapi({
        example: 'Johnson Family',
        description: 'Family name',
      }),
    totalGroups: z.number().int().min(0)
      .openapi({
        example: 3,
        description: 'Total number of groups the family belongs to',
      }),
    totalChildren: z.number().int().min(0)
      .openapi({
        example: 2,
        description: 'Total number of children in the family',
      }),
  }).optional()
    .openapi({
      description: 'Optional metadata about the family and dashboard',
    }),
});

export const WeeklyDashboardSuccessResponseSchema = createSuccessResponseSchema(WeeklyDashboardDataSchema);

export const FcmTokenSuccessResponseSchema = createSuccessResponseSchema(FcmTokenResponseSchema);

export const FcmTokensSuccessResponseSchema = createSuccessResponseSchema(
  z.array(FcmTokenResponseSchema),
);

export const ScheduleSuccessResponseSchema = createSuccessResponseSchema(ScheduleResponseSchema);

export const ScheduleSlotSuccessResponseSchema = createSuccessResponseSchema(ScheduleSlotSchema);

export const ChildAssignmentSuccessResponseSchema = createSuccessResponseSchema(ChildAssignmentSchema);

export const AvailableChildrenSuccessResponseSchema = createSuccessResponseSchema(z.array(AvailableChildSchema));

export const ScheduleSlotConflictsSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    conflicts: z.array(z.string()).openapi({
      description: 'Array of conflict identifiers',
      example: ['CAPACITY_EXCEEDED', 'DRIVER_DOUBLE_BOOKING'],
    }),
  })
);

export const ScheduleVehicleSuccessResponseSchema = createSuccessResponseSchema(ScheduleVehicleAssignmentSchema);

export const GroupScheduleConfigSuccessResponseSchema = createSuccessResponseSchema(ScheduleConfigSchema);

/**
 * Generic responses for simple operations
 */
export const SimpleSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
  }),
);

export const VehicleRemovedSuccessResponseSchema = createSuccessResponseSchema(
  z.object({
    message: z.string(),
    slotDeleted: z.boolean(),
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
    invitedByUser: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }).optional(),
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
 * Family invitation validation response schema
 * Based on FamilyInvitationValidation interface from UnifiedInvitationService
 */
export const FamilyInvitationValidationResponseSchema = z.object({
  valid: z.boolean(),
  familyId: z.string().optional(),
  familyName: z.string().optional(),
  inviterName: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  personalMessage: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  email: z.string().optional(),
  existingUser: z.boolean().optional(),
  userCurrentFamily: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  canLeaveCurrentFamily: z.boolean().optional(),
  cannotLeaveReason: z.string().optional(),
});

/**
 * Group invitation validation response schema
 * Based on GroupInvitationValidation interface from UnifiedInvitationService
 */
export const GroupInvitationValidationResponseSchema = z.object({
  valid: z.boolean(),
  groupId: z.string().optional(),
  groupName: z.string().optional(),
  inviterName: z.string().nullable().optional(),
  requiresAuth: z.boolean().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  email: z.string().optional(),
  existingUser: z.boolean().optional(),
});

/**
 * Wrapped family invitation validation response
 */
export const FamilyInvitationValidationSuccessResponseSchema = createSuccessResponseSchema(
  FamilyInvitationValidationResponseSchema,
);

/**
 * Wrapped group invitation validation response
 */
export const GroupInvitationValidationSuccessResponseSchema = createSuccessResponseSchema(
  GroupInvitationValidationResponseSchema,
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

/**
 * Group invitation response schema
 */
export const GroupInvitationSuccessResponseSchema = createSuccessResponseSchema(
  GroupInvitationSchema,
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
registry.register('WeeklyDashboardSuccessResponse', WeeklyDashboardSuccessResponseSchema);
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
registry.register('VehicleRemovedSuccessResponse', VehicleRemovedSuccessResponseSchema);
registry.register('CreationSuccessResponse', CreationSuccessResponseSchema);
registry.register('InvitationCreationResponse', InvitationCreationResponseSchema);
registry.register('PermissionsSuccessResponse', PermissionsSuccessResponseSchema);
registry.register('FamilyInvitationSuccessResponse', FamilyInvitationSuccessResponseSchema);
registry.register('PendingInvitationsSuccessResponse', PendingInvitationsSuccessResponseSchema);
registry.register('InviteCodeValidationSuccessResponse', InviteCodeValidationSuccessResponseSchema);
registry.register('FamilyGroupMemberSuccessResponse', FamilyGroupMemberSuccessResponseSchema);
registry.register('FamilySearchSuccessResponse', FamilySearchSuccessResponseSchema);
registry.register('GroupInvitationSuccessResponse', GroupInvitationSuccessResponseSchema);
registry.register('FamilyInvitationValidationResponse', FamilyInvitationValidationResponseSchema);
registry.register('GroupInvitationValidationResponse', GroupInvitationValidationResponseSchema);
registry.register('FamilyInvitationValidationSuccessResponse', FamilyInvitationValidationSuccessResponseSchema);
registry.register('GroupInvitationValidationSuccessResponse', GroupInvitationValidationSuccessResponseSchema);