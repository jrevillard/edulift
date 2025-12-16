/**
 * Common Schema Utilities and Shared Types
 *
 * This file contains shared utilities, enums, and base schemas
 * used across all schema files to ensure consistency and reduce duplication.
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../config/registry';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

/**
 * Common Enums
 */

// User roles across the system
export const UserRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']).openapi({
  description: 'User role within family or group context',
  example: 'MEMBER',
});

// Family-specific role enum
export const FamilyRoleEnum = z.enum(['ADMIN', 'MEMBER']).openapi({
  description: 'User role within family context',
  example: 'MEMBER',
});

// Group-specific role enum
export const GroupRoleEnum = z.enum(['MEMBER', 'ADMIN']).openapi({
  description: 'User role within group context',
  example: 'MEMBER',
});

// Invitation status enum
export const InvitationStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).openapi({
  description: 'Status of an invitation',
  example: 'PENDING',
});

// Week days enum
export const WeekdayEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']).openapi({
  description: 'Days of the week for scheduling',
  example: 'MONDAY',
});

// Time format enum (24h format)
export const TimeFormatEnum = z.enum(['24h', '12h']).openapi({
  description: 'Time format preference',
  example: '24h',
});

// Recurring pattern enum
export const RecurringPatternEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).openapi({
  description: 'Recurring pattern for events',
  example: 'WEEKLY',
});

/**
 * Common Base Schemas
 */

// Base entity schema with common audit fields
export const BaseEntitySchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'Unique identifier (CUID format)',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  }),
}).openapi({
  title: 'Base Entity',
  description: 'Common entity fields with audit timestamps',
});

// Base user schema with common fields
export const BaseUserSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'User identifier (CUID format)',
  }),
  email: z.string().email().openapi({
    example: 'user@example.com',
    description: 'User email address',
  }),
  firstName: z.string().min(1).max(50).openapi({
    example: 'John',
    description: 'User first name',
  }),
  lastName: z.string().min(1).max(50).openapi({
    example: 'Doe',
    description: 'User last name',
  }),
  phoneNumber: z.string().nullable().openapi({
    example: '+1234567890',
    description: 'User phone number',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Account last update timestamp',
  }),
}).openapi({
  title: 'Base User',
  description: 'Common user fields shared across schemas',
});

// Base child schema with common fields
export const BaseChildSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901239',
    description: 'Child identifier (CUID format)',
  }),
  familyId: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'Family identifier',
  }),
  firstName: z.string().openapi({
    example: 'Emma',
    description: 'Child first name',
  }),
  lastName: z.string().openapi({
    example: 'Johnson',
    description: 'Child last name',
  }),
  dateOfBirth: z.iso.datetime().nullable().openapi({
    example: '2015-05-15T00:00:00.000Z',
    description: 'Child date of birth',
  }),
  joinedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Date child joined the family',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Child creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Child update timestamp',
  }),
}).openapi({
  title: 'Base Child',
  description: 'Common child fields shared across schemas',
});

// Base vehicle schema with common fields - MATCHES PRISMA DATABASE STRUCTURE
export const BaseVehicleSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901240',
    description: 'Vehicle identifier (CUID format)',
  }),
  name: z.string().openapi({
    example: 'School Bus 1',
    description: 'Vehicle name',
  }),
  capacity: z.number().int().min(1).max(50).openapi({
    example: 30,
    description: 'Vehicle seat capacity',
  }),
  familyId: z.string().cuid().optional().openapi({
    example: 'cl123456789012345678901234',
    description: 'Family identifier that owns the vehicle',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Vehicle creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Vehicle update timestamp',
  }),
}).openapi({
  title: 'Base Vehicle',
  description: 'Common vehicle fields matching Prisma database structure',
});

// Base family schema with common fields
export const BaseFamilySchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'Family identifier (CUID format)',
  }),
  name: z.string().min(1).max(100).openapi({
    example: 'Johnson Family',
    description: 'Family display name',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Family creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Family update timestamp',
  }),
}).openapi({
  title: 'Base Family',
  description: 'Common family fields shared across schemas',
});

// Base group schema with common fields
export const BaseGroupSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901235',
    description: 'Group identifier (CUID format)',
  }),
  name: z.string().min(1).max(100).openapi({
    example: 'Carpool Group',
    description: 'Group display name',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Group creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Group update timestamp',
  }),
}).openapi({
  title: 'Base Group',
  description: 'Common group fields shared across schemas',
});

// Common week query schema for filtering
export const WeekQuerySchema = z.object({
  week: z.string().optional().openapi({
    example: '2023-W15',
    description: 'Week in ISO format (YYYY-W##) for filtering assignments',
  }),
}).openapi({
  title: 'Week Query Parameters',
  description: 'Query parameters for week-based filtering',
});

// Common vehicle assignment schema
export const VehicleAssignmentSchema = z.object({
  id: z.string().cuid().openapi({
    example: 'cl123456789012345678901236',
    description: 'Vehicle assignment identifier (CUID format)',
  }),
  vehicleId: z.string().cuid().openapi({
    example: 'cl123456789012345678901234',
    description: 'Vehicle identifier',
  }),
  scheduleSlotId: z.string().cuid().openapi({
    example: 'cl123456789012345678901237',
    description: 'Schedule slot identifier',
  }),
  driverId: z.string().cuid().nullable().openapi({
    example: 'cl123456789012345678901239',
    description: 'Driver identifier (null if not assigned)',
  }),
  groupId: z.string().cuid().openapi({
    example: 'cl123456789012345678901235',
    description: 'Group identifier',
  }),
  date: z.iso.date().openapi({
    example: '2023-04-15',
    description: 'Date of the assignment',
  }),
  assignedSeats: z.number().int().min(0).openapi({
    example: 3,
    description: 'Number of assigned seats',
  }),
  seatOverride: z.number().int().nullable().openapi({
    example: 8,
    description: 'Override for vehicle capacity',
  }),
  notes: z.string().optional().openapi({
    example: 'Extra space for sports equipment',
    description: 'Additional notes for the assignment',
  }),
  createdAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Assignment creation timestamp',
  }),
  updatedAt: z.iso.datetime().openapi({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Assignment update timestamp',
  }),
}).openapi({
  title: 'Vehicle Assignment',
  description: 'Vehicle assignment to a schedule slot',
});

// Base address schema
export const BaseAddressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).optional(), // ISO 3166-1 alpha-2
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
}).openapi({
  title: 'Base Address',
  description: 'Common address fields',
});

// Base pagination schema
export const BasePaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).openapi({
  title: 'Pagination Parameters',
  description: 'Common pagination parameters',
});

// Base paginated response schema
export const BasePaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => {
  return z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });
};

// Common date range query schema
export const DateRangeQuerySchema = z.object({
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
}).openapi({
  title: 'Date Range Query',
  description: 'Common date range filter parameters',
});

/**
 * Common Validation Patterns
 */

// Email validation with detailed message
export const EmailSchema = z.string().email('Invalid email format');

// Phone number validation (basic pattern)
export const PhoneNumberSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format',
).nullable().optional();

// Password validation
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// UUID validation
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * Error Response Schemas
 */

// Standard error response
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Validation failed',
    description: 'Human-readable error message',
  }),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
  })).optional().openapi({
    description: 'Detailed validation errors (when applicable)',
  }),
}).openapi({
  title: 'Error Response',
  description: 'Standard error response format',
});

// Success response wrapper factory
export const createSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).openapi({
    title: 'Success Response',
    description: 'Standard success response format',
  });
};

/**
 * Common Field Definitions
 */

export const CommonFields = {
  // Audit fields
  id: z.string().uuid().openapi({ description: 'Unique identifier' }),
  createdAt: z.iso.datetime().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.iso.datetime().openapi({ description: 'Last update timestamp' }),

  // Status fields
  isActive: z.boolean().default(true).openapi({ description: 'Whether the record is active' }),

  // Metadata
  metadata: z.record(z.string(), z.any()).optional().openapi({
    description: 'Additional metadata',
  }),
};

/**
 * Utility Functions
 */

// Create a schema with common fields
export const withCommonFields = <T extends z.ZodObject<any>>(schema: T) => {
  return schema.merge(z.object(CommonFields));
};

// Register a schema with OpenAPI registry
export const registerSchema = (name: string, schema: z.ZodType) => {
  return schema.openapi(name);
};

// Register common schemas with OpenAPI registry
registry.register('UserRole', UserRoleEnum);
registry.register('FamilyRole', FamilyRoleEnum);
registry.register('GroupRole', GroupRoleEnum);
registry.register('InvitationStatus', InvitationStatusEnum);
registry.register('Weekday', WeekdayEnum);
registry.register('TimeFormat', TimeFormatEnum);
registry.register('RecurringPattern', RecurringPatternEnum);

// Register base schemas
registry.register('BaseEntity', BaseEntitySchema);
registry.register('BaseUser', BaseUserSchema);
registry.register('BaseChild', BaseChildSchema);
registry.register('BaseVehicle', BaseVehicleSchema);
registry.register('BaseFamily', BaseFamilySchema);
registry.register('BaseGroup', BaseGroupSchema);
registry.register('WeekQuery', WeekQuerySchema);
registry.register('VehicleAssignment', VehicleAssignmentSchema);
registry.register('BaseAddress', BaseAddressSchema);
registry.register('BasePagination', BasePaginationSchema);
registry.register('DateRangeQuery', DateRangeQuerySchema);

// Register error and response schemas
registry.register('ErrorResponse', ErrorResponseSchema);

/**
 * Exports
 */
export {
  z,
};

// Re-export commonly used OpenAPI utilities
export type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';