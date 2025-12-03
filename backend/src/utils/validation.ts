import { z } from 'zod';
import { isValidTimezone } from './timezoneUtils';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
});

export const JoinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN'], { error: () => 'Valid role is required' }),
});

export const InviteFamilySchema = z.object({
  familyId: z.string().min(1, 'Family ID is required'),
  role: z.enum(['MEMBER', 'ADMIN'], { error: () => 'Valid role is required' }).default('MEMBER'),
  personalMessage: z.string().optional(),
});

export const CreateChildSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100, 'Child name too long'),
  age: z.number().int().min(0).max(18).optional(),
});

export const UpdateChildSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100, 'Child name too long').optional(),
  age: z.number().int().min(0).max(18).optional(),
});

export const ChildParamsSchema = z.object({
  childId: z.string().cuid('Invalid child ID format'),
});

export const GroupParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
});

export const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Vehicle name too long'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50'),
});

export const UpdateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Vehicle name too long').optional(),
  capacity: z.number().int().min(1).max(50, 'Capacity cannot exceed 50').optional(),
});

export const VehicleParamsSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format'),
});

export const AvailableVehiclesParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
  timeSlotId: z.string().cuid('Invalid time slot ID format'),
});

export const CreateScheduleSlotSchema = z.object({
  datetime: z.string().datetime('DateTime must be a valid ISO 8601 UTC datetime string'),
});

export const CreateTripSchema = z.object({
  vehicleId: z.string().cuid().optional(),
  driverId: z.string().cuid().optional(),
}).optional();

export const TripAssignmentSchema = z.object({
  childId: z.string().cuid('Invalid child ID format'),
});

export const WeekQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid week format (YYYY-WW)'),
});

export const GroupInviteSchema = z.object({
  inviteCode: z.string().cuid('Invalid invite code format'),
});

// Timezone validation schemas
export const UpdateTimezoneSchema = z.object({
  timezone: z.string()
    .min(1, 'Timezone is required')
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"' },
    ),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Valid email required').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"' },
    )
    .optional(),
}).refine(
  (data) => data.name || data.email || data.timezone,
  { message: 'At least one field (name, email, or timezone) must be provided' },
);

export const RequestMagicLinkSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Name is required').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format' },
    )
    .optional(),
  inviteCode: z.string().optional(),
  code_challenge: z.string().min(43).max(128), // PKCE
});

export const VerifyMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  code_verifier: z.string().min(43).max(128), // PKCE: Original random string used to generate code_challenge - REQUIRED
  // inviteCode is now extracted from query parameters, not request body
});

// Account deletion request validation
export const RequestAccountDeletionSchema = z.object({
  code_challenge: z.string().min(43, 'PKCE code_challenge must be at least 43 characters').max(128, 'PKCE code_challenge must be at most 128 characters'),
});

// Account deletion confirmation validation
export const ConfirmAccountDeletionSchema = z.object({
  token: z.string().min(1, 'Deletion token is required'),
  code_verifier: z.string().min(43, 'PKCE code_verifier must be at least 43 characters').max(128, 'PKCE code_verifier must be at most 128 characters'),
});