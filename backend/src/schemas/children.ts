/**
 * Children Hono Native Schemas - OpenAPI Phase 2
 *
 * Hono-native schemas for children management endpoints with OpenAPI documentation
 * Converted from registry-based schemas to direct OpenAPI schemas
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Import common schemas
export const WeekQuerySchema = z.object({
  week: z.string()
    .optional()
    .openapi({
      example: '2023-W15',
      description: 'Week number in YYYY-WWW format',
    }),
}).openapi({
  title: 'Week Query',
  description: 'Query parameter for week filtering',
});

// Request Schemas
export const CreateChildSchema = z.object({
  name: z.string()
    .min(1, 'Child name is required')
    .max(100, 'Name too long')
    .openapi({
      example: 'Emma Johnson',
      description: 'Child full name',
    }),
  age: z.number()
    .int()
    .min(0)
    .max(18)
    .optional()
    .openapi({
      example: 8,
      description: 'Child age (0-18 years, optional)',
    }),
}).openapi({
  title: 'Create Child',
  description: 'Create a new child record in the family',
});

export const UpdateChildSchema = z.object({
  name: z.string()
    .min(1, 'Child name is required')
    .max(100, 'Name too long')
    .optional()
    .openapi({
      example: 'Emma Johnson-Smith',
      description: 'Updated child full name',
    }),
  age: z.number()
    .int()
    .min(0)
    .max(18)
    .optional()
    .openapi({
      example: 9,
      description: 'Updated child age (0-18 years, optional)',
    }),
}).refine(
  (data) => data.name !== undefined || data.age !== undefined,
  { message: 'At least one field (name or age) must be provided' },
).openapi({
  title: 'Update Child',
  description: 'Update child information',
});

export const ChildParamsSchema = z.object({
  childId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
}).openapi({
  title: 'Child Parameters',
  description: 'URL parameters for child-specific endpoints',
});

export const ChildGroupParamsSchema = z.object({
  childId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique group identifier (CUID format)',
    }),
}).openapi({
  title: 'Child and Group Parameters',
  description: 'URL parameters for child-group membership endpoints',
});

// Response Schemas
export const BaseChildSchema = z.object({
  id: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Emma Johnson',
      description: 'Child full name',
    }),
  familyId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901233',
      description: 'Family identifier the child belongs to',
    }),
  createdAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the child record was created',
    }),
  updatedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-15T10:30:00.000Z',
      description: 'When the child record was last updated',
    }),
});

export const ChildResponseSchema = BaseChildSchema.extend({
  age: z.number()
    .nullable()
    .openapi({
      example: 8,
      description: 'Child age (null if not specified)',
    }),
  groupMemberships: z.array(z.object({
    childId: z.cuid(),
    groupId: z.cuid(),
    addedBy: z.cuid(),
    addedAt: z.iso.datetime(),
    group: z.object({
      id: z.cuid(),
      name: z.string(),
    }),
  })).optional()
    .openapi({
      description: 'Group memberships (included when fetching all children)',
    }),
}).openapi({
  title: 'Child Response',
  description: 'Complete child information with optional group memberships',
});

export const ChildGroupMembershipSchema = z.object({
  childId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Child identifier',
    }),
  groupId: z.cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier',
    }),
  addedBy: z.cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'User ID who added the child to the group',
    }),
  addedAt: z.iso.datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the child was added to the group',
    }),
  child: z.object({
    id: z.cuid()
      .openapi({
        example: 'cl123456789012345678901234',
        description: 'Child identifier',
      }),
    name: z.string()
      .openapi({
        example: 'Emma Johnson',
        description: 'Child name',
      }),
    familyId: z.cuid()
      .openapi({
        example: 'cl123456789012345678901233',
        description: 'Family identifier',
      }),
    createdAt: z.iso.datetime()
      .openapi({
        example: '2023-01-01T00:00:00.000Z',
        description: 'When the child was created',
      }),
    updatedAt: z.iso.datetime()
      .openapi({
        example: '2023-01-15T10:30:00.000Z',
        description: 'When the child was last updated',
      }),
    age: z.number()
      .nullable()
      .openapi({
        example: 8,
        description: 'Child age (null if not specified)',
      }),
  }).optional()
    .openapi({
      description: 'Child information (included when adding child to group)',
    }),
  group: z.object({
    id: z.cuid()
      .openapi({
        example: 'cl123456789012345678901235',
        description: 'Group identifier',
      }),
    name: z.string()
      .openapi({
        example: 'Morning School Run',
        description: 'Group name',
      }),
  }).optional()
    .openapi({
      description: 'Group information (included when fetching memberships)',
    }),
}).openapi({
  title: 'Child Group Membership',
  description: 'Child membership in a group',
});

// Success/Error Response Schemas
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
  error: z.string()
    .openapi({
      example: 'Bad request',
      description: 'Error message',
    }),
}).openapi({
  title: 'Error Response',
  description: 'Standard error response',
});