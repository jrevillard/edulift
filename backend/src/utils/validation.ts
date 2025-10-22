import { z } from 'zod';
import { isValidTimezone } from './timezoneUtils';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long')
});

export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100, 'Group name too long')
});

export const CreateChildSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100, 'Child name too long'),
  age: z.number().int().min(3).max(18).optional()
});

export const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Vehicle name too long'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(20, 'Capacity too high')
});

export const CreateScheduleSlotSchema = z.object({
  datetime: z.string().datetime('DateTime must be a valid ISO 8601 UTC datetime string')
});

export const CreateTripSchema = z.object({
  vehicleId: z.string().cuid().optional(),
  driverId: z.string().cuid().optional()
}).optional();

export const TripAssignmentSchema = z.object({
  childId: z.string().cuid('Invalid child ID format')
});

export const WeekQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid week format (YYYY-WW)')
});

export const GroupInviteSchema = z.object({
  inviteCode: z.string().cuid('Invalid invite code format')
});

// Timezone validation schemas
export const UpdateTimezoneSchema = z.object({
  timezone: z.string()
    .min(1, 'Timezone is required')
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"' }
    )
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Valid email required').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"' }
    )
    .optional()
}).refine(
  (data) => data.name || data.email || data.timezone,
  { message: 'At least one field (name, email, or timezone) must be provided' }
);

export const RequestMagicLinkSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Name is required').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid IANA timezone format' }
    )
    .optional(),
  inviteCode: z.string().optional(),
  platform: z.enum(['web', 'native']).default('web'),
  code_challenge: z.string().min(43).max(128) // PKCE
});