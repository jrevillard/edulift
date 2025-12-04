/**
 * OpenAPI Generated Types - Single Source of Truth
 *
 * MIGRATION STATUS: 🟢 PARTIALLY MIGRATED
 * - ✅ All production components using unified types from this file
 * - ✅ No dependencies on apiService types in production code
 * - ⚠️ Some legacy format compatibility preserved for complex components (SchedulePage)
 * - 📋 Test files still use apiService for complex scenario testing
 *
 * This file exports all the generated OpenAPI types that are used throughout the application.
 * All type definitions should come from here, not from manual definitions.
 *
 * Generated from: /backend/docs/openapi/swagger.json
 * Last updated: npm run generate-api
 */

import type { components } from '@/generated/api/types';

// NOTE: The OpenAPI generation currently only produces request/response types.
// Entity types (Vehicle, Child, User, Group, etc.) need to be defined manually
// until the OpenAPI schema is updated to include them.

// Core Entity Types - Manual definitions until OpenAPI schema includes entities
export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Child {
  id: string;
  name: string;
  age: number | null | undefined;
  familyId: string;
  createdAt: string;
  updatedAt: string;
  groupMemberships?: GroupChildMembership[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  familyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  familyId: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  userRole: "OWNER" | "ADMIN" | "MEMBER";
  ownerFamily: {
    id: string;
    name: string;
  };
  _count?: {
    familyMembers: number;
  };
}

// Schedule Management Types - Manual definitions
export interface ScheduleSlot {
  id: string;
  groupId: string;
  datetime: string;
  vehicleAssignments: ScheduleSlotVehicle[];
  childAssignments: ChildAssignment[];
  totalCapacity: number;
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

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

// Union type for different ScheduleSlot API response formats
export type ScheduleSlotUnion = ScheduleSlot | MinimalScheduleSlot;

export interface ScheduleSlotVehicle {
  id: string;
  scheduleSlotId: string;
  vehicleId: string;
  driverId?: string | null;
  seatOverride?: number | null;
  vehicle?: {
    id: string;
    make?: string;
    model?: string;
    licensePlate?: string;
    capacity: number;
    familyId?: string; // TODO: OpenAPI schema needs to include familyId for vehicles
    name?: string;
  } | Vehicle;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  _count?: {
    childAssignments: number;
  };
}

export interface ChildAssignment {
  id?: string;
  scheduleSlotId?: string;
  childId?: string;
  vehicleAssignmentId: string;
  assignedAt?: string;
  child?: Child | {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    familyId: string;
  } | {
    // FIXME: Legacy child format - minimal properties only (needs OpenAPI standardization)
    id: string;
    name: string;
  };
  vehicleAssignment?: {
    id: string;
    scheduleSlotId: string;
    vehicleId: string;
    driverId: string | null;
    seatOverride: number | null;
  };
}

// Group Management Types - Manual definitions
export interface UserGroup extends Group {
  userRole: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt?: string;
  ownerFamily: {
    id: string;
    name: string;
  };
  familyCount?: number;
  scheduleCount?: number;
  familyMembers?: Array<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  } | {
    id: string;
    familyId: string;
    role: "ADMIN" | "MEMBER";
    joinedAt: string;
    family?: {
      id: string;
      name: string;
    };
  }>;
}

export interface GroupFamily {
  id: string;
  name?: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "PENDING";
  familyId?: string;
  groupId?: string;
  joinedAt?: string;
  family?: {
    id: string;
    name: string;
  };
  isMyFamily?: boolean;
  canManage?: boolean;
  admins?: Array<{
    name: string;
    email: string;
  }>;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  invitationId?: string;
  inviteCode?: string;
  invitedAt?: string;
  expiresAt?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  targetFamilyId: string;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  personalMessage?: string | null;
  expiresAt: string;
  createdAt: string;
  group?: {
    id: string;
    name: string;
  };
  targetFamily?: {
    id: string;
    name: string;
  };
}

export interface GroupChildMembership {
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
}

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

// Dashboard Types - Manual definitions
export interface WeeklyDashboardResponse {
  data?: {
    days: Array<{
      date: string;
      transportSlots: Array<{
        id: string;
        time: string;
        groupId: string | null;
        groupName: string;
        vehicleId: string | null;
        vehicleName: string | null;
        driverId: string | null;
        driverName: string | null;
        children: Array<{
          id: string;
          name: string;
          familyId: string;
        }>;
        capacity: number;
        capacityStatus: "FULL" | "AVAILABLE" | "OVERFLOW";
        isMorning: boolean;
      }>;
    }>;
  };
}

// Auth and Token Types - From OpenAPI
export type RequestMagicLink = components['schemas']['RequestMagicLink'];
export type VerifyMagicLink = components['schemas']['VerifyMagicLink'];
export type RefreshTokenRequest = components['schemas']['RefreshTokenRequest'];
export type LogoutRequest = components['schemas']['LogoutRequest'];

// Request/Response Types - From OpenAPI
export type CreateChildRequest = components['schemas']['CreateChildRequest'];
export type UpdateChildRequest = components['schemas']['UpdateChildRequest'];
export type CreateVehicleRequest = components['schemas']['CreateVehicleRequest'];
export type UpdateVehicleRequest = components['schemas']['UpdateVehicleRequest'];

// Re-export for convenience
export type {
  paths,
  operations,
  components,
} from '@/generated/api/types';