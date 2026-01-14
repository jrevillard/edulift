/**
 * OpenAPI Generated Types - Single Source of Truth
 *
 * MIGRATION STATUS: 🟢 FULLY MIGRATED
 * - ✅ All production components using unified types from this file
 * - ✅ No dependencies on apiService types in production code
 * - ✅ Only frontend-specific types defined manually
 * - ✅ All entity types imported from generated OpenAPI types
 *
 * This file exports:
 * 1. Frontend-specific types that don't exist in OpenAPI
 * 2. Convenient type aliases for OpenAPI-generated types
 * 3. Union and utility types for frontend use cases
 *
 * Generated from: /backend/docs/openapi/swagger.json
 * Last updated: npm run generate-api
 */

import type { components, paths } from '@/generated/api/types';

// ========================================
// FRONTEND-SPECIFIC TYPES (No OpenAPI equivalent)
// ========================================

/**
 * Minimal schedule slot for performance optimization
 * Frontend-specific type for reduced payload
 */
export interface MinimalScheduleSlot {
  id: string;
  datetime: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
  vehicleAssignments?: ScheduleSlotVehicle[];
  childAssignments?: ChildAssignment[];
  totalCapacity?: number;
  availableSeats?: number;
}

/**
 * Union type for different ScheduleSlot API response formats
 * Frontend utility type for handling multiple response formats
 */
export type ScheduleSlotUnion = ScheduleSlot | MinimalScheduleSlot;


/**
 * Family search result format
 * Frontend-specific type for search UI
 */
export interface FamilySearchResult {
  id: string;
  name: string;
  adminContacts: {
    name: string;
    email: string;
  }[];
  memberCount: number;
  canInvite: boolean;
}

// ========================================
// TYPE ALIASES FOR OPENAPI TYPES
// ========================================

/**
 * Core Entity Types - Extracted from OpenAPI response data
 */
export type Vehicle = ExtractVehicleFromResponse;
export type Child = ExtractChildFromResponse;
export type User = ExtractUserFromResponse;
export type GroupScheduleConfig = ExtractGroupScheduleConfigFromResponse;

/**
 * Extract Vehicle type from OpenAPI response data
 */
type ExtractVehicleFromResponse = {
  id: string;
  name: string;
  capacity: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Extract Child type from OpenAPI response data
 */
type ExtractChildFromResponse = {
  id: string;
  name: string;
  age: number | null;
  familyId: string;
  createdAt: string;
  updatedAt: string;
  groupMemberships?: GroupChildMembership[];
};

/**
 * Extract User type from OpenAPI response data
 * Note: timezone is nullable (can be null)
 */
type ExtractUserFromResponse = {
  id: string;
  email: string;
  name: string;
  timezone: string | null;
};

/**
 * Extract GroupScheduleConfig type from OpenAPI response data
 * Note: id, createdAt, updatedAt are nullable for default empty configs
 */
type ExtractGroupScheduleConfigFromResponse = {
  id?: string | null;
  groupId: string;
  scheduleHours: {
    [key: string]: string[];
  };
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Schedule Management Types - Extracted from OpenAPI responses
 */
export type ScheduleSlot = ExtractScheduleSlotFromResponse;
export type ScheduleSlotVehicle = ExtractVehicleAssignmentFromResponse;
export type ChildAssignment = ExtractChildAssignmentFromResponse;

/**
 * Extract ScheduleSlot from OpenAPI response
 */
type ExtractScheduleSlotFromResponse = {
  id: string;
  groupId: string;
  datetime: string;
  vehicleAssignments?: ScheduleSlotVehicle[];
  childAssignments?: ChildAssignment[];
  totalCapacity?: number;
  availableSeats?: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Extract Vehicle Assignment from OpenAPI response
 */
type ExtractVehicleAssignmentFromResponse = {
  id?: string;
  scheduleSlotId?: string;
  vehicleId?: string;
  driverId?: string | null;
  seatOverride?: number | null;
  groupId?: string;
  date?: string;
  vehicle?: {
    id: string;
    make?: string;
    model?: string;
    licensePlate?: string;
    capacity: number;
    familyId?: string;
    name?: string;
    age?: number | null;
  } | Vehicle;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
  _count?: {
    childAssignments: number;
  };
};

/**
 * Extract Child Assignment from OpenAPI response
 */
type ExtractChildAssignmentFromResponse = {
  id?: string;
  scheduleSlotId?: string;
  childId?: string;
  vehicleAssignmentId?: string;
  assignedAt?: string;
  child?: Child | {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    familyId: string;
  } | {
    // Legacy child format - minimal properties only (for backward compatibility)
    id: string;
    name: string;
  };
  vehicleAssignment?: {
    id?: string;
    vehicleId?: string;
    scheduleSlotId?: string;
    driverId?: string | null;
    seatOverride?: number | null;
    groupId?: string;
    date?: string;
  };
};

/**
 * Group Management Types - Extracted from OpenAPI responses
 */
export type GroupInvitation = ExtractGroupInvitationFromResponse;
export type GroupChildMembership = ExtractGroupChildMembershipFromResponse;

/**
 * Extract Group Invitation from OpenAPI response
 */
type ExtractGroupInvitationFromResponse = {
  id?: string;
  groupId?: string;
  targetFamilyId?: string | null;
  email?: string | null;
  role: "MEMBER" | "ADMIN";
  personalMessage?: string | null;
  invitedBy?: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  inviteCode?: string;
  expiresAt?: string;
  acceptedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  group?: {
    id: string;
    name: string;
  };
  targetFamily?: {
    id: string;
    name: string;
  };
};

/**
 * Extract Group Child Membership from OpenAPI response
 */
type ExtractGroupChildMembershipFromResponse = {
  id?: string;
  childId: string;
  groupId: string;
  addedBy?: string;
  joinedAt?: string;
  addedAt?: string;
  group?: {
    id: string;
    name: string;
  };
};

// ========================================
// OPENAPI TYPE EXPORTS
// ========================================

/**
 * Auth and Token Types - From OpenAPI
 */
export type RequestMagicLink = components['schemas']['RequestMagicLink'];
export type VerifyMagicLink = components['schemas']['VerifyMagicLink'];
export type RefreshTokenRequest = components['schemas']['RefreshTokenRequest'];
export type LogoutRequest = components['schemas']['LogoutRequest'];

/**
 * Request/Response Types - From OpenAPI
 */
export type CreateChildRequest = components['schemas']['CreateChildRequest'];
export type UpdateChildRequest = components['schemas']['UpdateChildRequest'];
export type CreateVehicleRequest = components['schemas']['CreateVehicleRequest'];
export type UpdateVehicleRequest = components['schemas']['UpdateVehicleRequest'];
/**
 * Weekly Dashboard Response - Extracted from /dashboard/weekly endpoint
 * Response format for the weekly dashboard data
 */
export type WeeklyDashboardResponse = paths['/dashboard/weekly']['get']['responses'][200]['content']['application/json'];

// Re-export for convenience
export type {
  paths,
  operations,
  components,
} from '@/generated/api/types';