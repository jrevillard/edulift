import { PrismaClient } from '@prisma/client';

/**
 * Result of group access control verification
 */
export interface GroupAccessResult {
  hasAccess: true;
  familyId: string;
}

/**
 * Error result when access control fails
 * Note: This only returns 403 for access denial. Resource not found (404) should be checked separately.
 */
export interface GroupAccessError {
  hasAccess: false;
  error: string;
  statusCode: 403;
}

export type GroupAccessCheck = GroupAccessResult | GroupAccessError;

/**
 * Verifies that a user has access to a group through their family membership.
 *
 * This function performs the following checks:
 * 1. User belongs to a family (via familyMember table)
 * 2. User's family is a member of the specified group (via groupFamilyMember table)
 *
 * @param prisma - Prisma client instance
 * @param userId - ID of the user to verify
 * @param groupId - ID of the group to check access for
 * @returns GroupAccessResult if user has access, GroupAccessError otherwise
 */
export async function verifyGroupAccess(
  prisma: PrismaClient,
  userId: string,
  groupId: string,
): Promise<GroupAccessCheck> {
  // Check if user belongs to a family
  const userFamilyMember = await prisma.familyMember.findFirst({
    where: { userId },
    select: { familyId: true },
  });

  if (!userFamilyMember) {
    return {
      hasAccess: false,
      error: 'Access denied: user must belong to a family',
      statusCode: 403,
    };
  }

  // Check if user's family is a member of the group
  const groupMember = await prisma.groupFamilyMember.findFirst({
    where: {
      groupId,
      familyId: userFamilyMember.familyId,
    },
  });

  if (!groupMember) {
    return {
      hasAccess: false,
      error: 'Access denied: your family is not a member of this group',
      statusCode: 403,
    };
  }

  return {
    hasAccess: true,
    familyId: userFamilyMember.familyId,
  };
}

/**
 * Helper for Hono controllers that checks group access and returns early if denied.
 * Use this pattern in your controller handlers:
 *
 * @example
 * ```typescript
 * app.openapi(route, async (c) => {
 *   const userId = c.get('userId');
 *   const groupId = 'group-123';
 *
 *   const accessError = await verifyGroupAccess(prisma, userId, groupId);
 *   if (!accessError.hasAccess) {
 *     return c.json({ success: false, error: accessError.error }, accessError.statusCode);
 *   }
 *
 *   // Continue with controller logic...
 * });
 * ```
 *
 * @param prisma - Prisma client instance
 * @param userId - ID of the user to verify
 * @param groupId - ID of the group to check access for
 * @returns GroupAccessCheck - check hasAccess property to determine if access is granted
 */
export async function verifyGroupAccessOrThrow(
  prisma: PrismaClient,
  userId: string,
  groupId: string,
): Promise<GroupAccessCheck> {
  return verifyGroupAccess(prisma, userId, groupId);
}

/**
 * Result of vehicle ownership verification
 */
export interface VehicleAccessResult {
  hasAccess: true;
  familyId: string;
}

/**
 * Error result when vehicle ownership verification fails
 */
export interface VehicleAccessError {
  hasAccess: false;
  error: string;
  statusCode: 403 | 404;
}

export type VehicleAccessCheck = VehicleAccessResult | VehicleAccessError;

/**
 * Verifies that a user's family owns a vehicle.
 *
 * This function performs the following checks:
 * 1. Vehicle exists
 * 2. User belongs to a family
 * 3. User's family owns the vehicle
 *
 * @param prisma - Prisma client instance
 * @param userId - ID of user to verify
 * @param vehicleId - ID of vehicle to check ownership for
 * @returns VehicleAccessResult if user's family owns vehicle, VehicleAccessError otherwise
 */
export async function verifyVehicleOwnership(
  prisma: PrismaClient,
  userId: string,
  vehicleId: string,
): Promise<VehicleAccessCheck> {
  // Check if vehicle exists
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { familyId: true },
  });

  if (!vehicle) {
    return {
      hasAccess: false,
      error: 'Vehicle not found',
      statusCode: 404,
    };
  }

  // Check if user belongs to a family
  const userFamily = await prisma.familyMember.findFirst({
    where: { userId },
    select: { familyId: true },
  });

  if (!userFamily || userFamily.familyId !== vehicle.familyId) {
    return {
      hasAccess: false,
      error: 'Access denied: vehicle owned by another family',
      statusCode: 403,
    };
  }

  return {
    hasAccess: true,
    familyId: userFamily.familyId,
  };
}
