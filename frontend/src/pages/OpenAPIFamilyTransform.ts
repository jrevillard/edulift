/**
 * OpenAPI Group Family Transformation Utilities
 *
 * This module provides utilities to transform OpenAPI response data
 * into the expected frontend GroupFamily interface format.
 */

import type { operations, paths } from '@/generated/api/types';

// OpenAPI generated types
export type GroupFamily = paths['/groups/{groupId}/families']['get']['responses'][200]['content']['application/json']['data'][0];

// Type for OpenAPI group families response
export type GetGroupFamiliesResponse = operations['getgroupsByGroupIdFamilies']['responses']['200']['content']['application/json']['data'][0];

/**
 * Transform OpenAPI response to match expected GroupFamily interface
 *
 * @param openApiFamily - The family data from OpenAPI response
 * @param userFamilyId - The current user's family ID (if available)
 * @param currentGroup - Current group information including user role and owner family
 * @returns Transformed GroupFamily object compatible with the frontend interface
 */
export const transformGroupFamily = (
  openApiFamily: GetGroupFamiliesResponse
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