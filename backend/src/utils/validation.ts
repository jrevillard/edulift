import { z } from 'zod';

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

// Note: Auth-related schemas have been moved to src/schemas/auth.ts
// to consolidate schema definitions and improve maintainability