/**
 * Children Schemas with OpenAPI Extensions
 *
 * Zod schemas for children management endpoints with OpenAPI documentation
 * Phase 3: Children domain migration following Auth template pattern
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from '../config/openapi.js';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

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
  childId: z.string()
    .cuid('Invalid child ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
}).openapi({
  title: 'Child Parameters',
  description: 'URL parameters for child-specific endpoints',
});

export const ChildGroupParamsSchema = z.object({
  childId: z.string()
    .cuid('Invalid child ID format')
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
  groupId: z.string()
    .cuid('Invalid group ID format')
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Unique group identifier (CUID format)',
    }),
}).openapi({
  title: 'Child and Group Parameters',
  description: 'URL parameters for child-group membership endpoints',
});

export const WeekQuerySchema = z.object({
  week: z.string()
    .optional()
    .openapi({
      example: '2023-W15',
      description: 'Week in ISO format (YYYY-W##) for filtering assignments',
    }),
}).openapi({
  title: 'Week Query Parameters',
  description: 'Query parameters for week-based filtering',
});

// Response Schemas
export const ChildResponseSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Unique child identifier (CUID format)',
    }),
  name: z.string()
    .openapi({
      example: 'Emma Johnson',
      description: 'Child full name',
    }),
  age: z.number()
    .nullable()
    .openapi({
      example: 8,
      description: 'Child age (null if not specified)',
    }),
  familyId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901236',
      description: 'Family identifier the child belongs to',
    }),
  createdAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Child creation timestamp',
    }),
  updatedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'Last update timestamp',
    }),
  groupMemberships: z.array(z.object({
    id: z.string().cuid(),
    childId: z.string().cuid(),
    groupId: z.string().cuid(),
    joinedAt: z.string().datetime(),
    group: z.object({
      id: z.string().cuid(),
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
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901237',
      description: 'Unique membership identifier (CUID format)',
    }),
  childId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Child identifier',
    }),
  groupId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901235',
      description: 'Group identifier',
    }),
  joinedAt: z.string()
    .datetime()
    .openapi({
      example: '2023-01-01T00:00:00.000Z',
      description: 'When the child joined the group',
    }),
  group: z.object({
    id: z.string()
      .cuid()
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

export const ChildAssignmentSchema = z.object({
  id: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901238',
      description: 'Unique assignment identifier (CUID format)',
    }),
  childId: z.string()
    .cuid()
    .openapi({
      example: 'cl123456789012345678901234',
      description: 'Child identifier',
    }),
  tripDate: z.string()
    .date()
    .openapi({
      example: '2023-04-15',
      description: 'Date of the assigned trip',
    }),
  tripType: z.enum(['PICKUP', 'DROPOFF'])
    .openapi({
      example: 'PICKUP',
      description: 'Type of trip assignment',
    }),
  status: z.enum(['ASSIGNED', 'COMPLETED', 'CANCELLED'])
    .openapi({
      example: 'ASSIGNED',
      description: 'Assignment status',
    }),
  group: z.object({
    id: z.string().cuid(),
    name: z.string(),
  }).optional()
    .openapi({
      description: 'Group information for the assignment',
    }),
}).openapi({
  title: 'Child Assignment',
  description: 'Child trip assignment information',
});

// Register schemas with OpenAPI registry
registry.register('CreateChildRequest', CreateChildSchema);
registry.register('UpdateChildRequest', UpdateChildSchema);
registry.register('ChildParams', ChildParamsSchema);
registry.register('ChildGroupParams', ChildGroupParamsSchema);
registry.register('WeekQuery', WeekQuerySchema);
registry.register('ChildResponse', ChildResponseSchema);
registry.register('ChildGroupMembership', ChildGroupMembershipSchema);
registry.register('ChildAssignment', ChildAssignmentSchema);

// Register API paths following Auth pattern
registry.registerPath({
  method: 'post',
  path: '/api/v1/children',
  tags: ['Children'],
  summary: 'Create a new child',
  description: 'Add a new child to the authenticated user family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateChildSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Child created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ChildResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions or no family',
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/children',
  tags: ['Children'],
  summary: 'Get user children',
  description: 'Retrieve all children belonging to the authenticated user family',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Children retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(ChildResponseSchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/children/{childId}',
  tags: ['Children'],
  summary: 'Get specific child',
  description: 'Retrieve detailed information about a specific child by ID',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
      description: 'Child retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ChildResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid child ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Child not accessible',
    },
    404: {
      description: 'Not found - Child does not exist',
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/children/{childId}',
  tags: ['Children'],
  summary: 'Update child (PUT)',
  description: 'Update child information completely. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateChildSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Child updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ChildResponseSchema,
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
      description: 'Not found - Child does not exist',
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/children/{childId}',
  tags: ['Children'],
  summary: 'Update child (PATCH)',
  description: 'Partially update child information. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateChildSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Child updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ChildResponseSchema,
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
      description: 'Not found - Child does not exist',
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/children/{childId}',
  tags: ['Children'],
  summary: 'Delete child',
  description: 'Remove a child from the family. Requires family admin permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
      description: 'Child deleted successfully',
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
      description: 'Bad request - Invalid child ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Child does not exist',
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/children/{childId}/assignments',
  tags: ['Children'],
  summary: 'Get child trip assignments',
  description: 'Retrieve all trip assignments for a specific child, optionally filtered by week',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
    query: WeekQuerySchema,
  },
  responses: {
    200: {
      description: 'Assignments retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(ChildAssignmentSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid child ID or week format',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Child not accessible',
    },
    404: {
      description: 'Not found - Child does not exist',
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/children/{childId}/groups/{groupId}',
  tags: ['Children'],
  summary: 'Add child to group',
  description: 'Add a child to a group. Requires appropriate permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildGroupParamsSchema,
  },
  responses: {
    201: {
      description: 'Child added to group successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ChildGroupMembershipSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid child or group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Child or group does not exist',
    },
    409: {
      description: 'Conflict - Child already belongs to group',
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/children/{childId}/groups/{groupId}',
  tags: ['Children'],
  summary: 'Remove child from group',
  description: 'Remove a child from a group. Requires appropriate permissions.',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildGroupParamsSchema,
  },
  responses: {
    200: {
      description: 'Child removed from group successfully',
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
      description: 'Bad request - Invalid child or group ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Insufficient permissions',
    },
    404: {
      description: 'Not found - Child or group does not exist or membership does not exist',
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/children/{childId}/groups',
  tags: ['Children'],
  summary: 'Get child group memberships',
  description: 'Retrieve all group memberships for a specific child',
  security: [{ BearerAuth: [] }],
  request: {
    params: ChildParamsSchema,
  },
  responses: {
    200: {
      description: 'Group memberships retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(ChildGroupMembershipSchema),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid child ID',
    },
    401: {
      description: 'Unauthorized - Authentication required',
    },
    403: {
      description: 'Forbidden - Child not accessible',
    },
    404: {
      description: 'Not found - Child does not exist',
    },
  },
});

