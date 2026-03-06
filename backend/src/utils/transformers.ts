/**
 * Utility functions for transforming Prisma objects to API responses
 */

/**
 * Transform a Family object from Prisma to API response format
 * Converts Date objects to ISO 8601 strings for consistent API responses
 *
 * @param family - Family object from Prisma (may contain Date objects)
 * @returns Transformed family with ISO date strings
 */
export const transformFamilyForResponse = (family: any): any => {
  if (!family) return family;

  const now = new Date().toISOString();

  // Helper to transform date fields to ISO strings
  const toDateISOString = (date: Date | string | null | undefined): string => {
    if (!date) return now;
    if (date instanceof Date) return date.toISOString();
    const d = new Date(date);
    return !isNaN(d.getTime()) ? d.toISOString() : now;
  };

  // Transform nested arrays - members, children, vehicles
  const transformedMembers = family.members?.map((member: any) => ({
    ...member,
    joinedAt: toDateISOString(member.joinedAt),
  }));

  const transformedChildren = family.children?.map((child: any) => ({
    ...child,
    createdAt: toDateISOString(child.createdAt),
    updatedAt: toDateISOString(child.updatedAt),
  }));

  const transformedVehicles = family.vehicles?.map((vehicle: any) => ({
    ...vehicle,
    createdAt: toDateISOString(vehicle.createdAt),
    updatedAt: toDateISOString(vehicle.updatedAt),
  }));

  return {
    ...family,
    createdAt: toDateISOString(family.createdAt),
    updatedAt: toDateISOString(family.updatedAt),
    members: transformedMembers,
    children: transformedChildren,
    vehicles: transformedVehicles,
  };
};
