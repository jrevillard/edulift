/**
 * OpenAPI Group Family Transformation Utilities
 *
 * This module provides utilities to transform OpenAPI response data
 * into the expected frontend GroupFamily interface format.
 */

import type { paths } from '@/generated/api/types';

// OpenAPI generated types
export type GroupFamily = paths['/api/v1/groups/{groupId}/families']['get']['responses'][200]['content']['application/json']['data'][0];

/**
 * Transform OpenAPI response to match expected GroupFamily interface
 *
 * @param openApiFamily - The family data from OpenAPI response
 * @returns Transformed GroupFamily object compatible with the frontend interface
 */
export const transformGroupFamily = (
  openApiFamily: GroupFamily,
): GroupFamily => {
  // The OpenAPI response already provides all the needed properties
  // No transformation needed for this endpoint since it returns the exact structure we need

  return {
    id: openApiFamily.id,
    name: openApiFamily.name,
    role: openApiFamily.role,
    isMyFamily: openApiFamily.isMyFamily,
    canManage: openApiFamily.canManage,
    admins: openApiFamily.admins || [],
  };
};