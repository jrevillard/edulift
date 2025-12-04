/**
 * OpenAPI Group Family Transformation Utilities
 *
 * This module provides utilities to transform OpenAPI response data
 * into the expected frontend GroupFamily interface format.
 */

import type { operations } from '@/generated/api/types';
import type { GroupFamily } from '../types/api';

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
  openApiFamily: GetGroupFamiliesResponse,
  userFamilyId?: string,
  currentGroup?: { userRole: string; ownerFamily: { id: string } }
): GroupFamily => {
  // Check if this is the current user's family
  const isMyFamily = userFamilyId ? openApiFamily.familyId === userFamilyId : false;

  // Check if user can manage this family (admin or owner can manage others, but not themselves)
  const canManage = currentGroup && userFamilyId
    ? (currentGroup.userRole === 'ADMIN' || currentGroup.userRole === 'OWNER') && !isMyFamily
    : false;

  // Generate a name from family object if not directly available
  const familyName = openApiFamily.family?.name || 'Unknown Family';

  // Transform role: OpenAPI doesn't have OWNER or PENDING, so we need to handle these cases
  // If this is the owner family, set role to OWNER, otherwise use the OpenAPI role
  const isOwnerFamily = currentGroup && openApiFamily.familyId === currentGroup.ownerFamily.id;
  const role = isOwnerFamily
    ? 'OWNER' as const
    : openApiFamily.role === 'ADMIN' || openApiFamily.role === 'MEMBER'
      ? openApiFamily.role
      : 'MEMBER' as const; // Default fallback

  return {
    id: openApiFamily.familyId, // Use familyId as the primary ID for consistency
    name: familyName,
    role,
    familyId: openApiFamily.familyId,
    groupId: undefined, // Not available from OpenAPI
    joinedAt: openApiFamily.joinedAt,
    family: openApiFamily.family,
    isMyFamily,
    canManage,
    admins: [], // TODO: This needs to be populated from a separate API call or endpoint
    status: 'ACCEPTED' as const, // Active families are accepted
    // These fields are only relevant for pending invitations - not available from this endpoint
    invitationId: undefined,
    inviteCode: undefined,
    invitedAt: undefined,
    expiresAt: undefined,
  };
};