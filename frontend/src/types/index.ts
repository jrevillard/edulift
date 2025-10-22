/**
 * ARCHITECTURE OVERVIEW:
 * 
 * 1. FAMILIES (Resource Ownership):
 *    - Manage shared resources (children, vehicles)
 *    - Family members have roles (ADMIN, PARENT, MEMBER)
 *    - Resources belong to the family, not individual users
 *    - Family members can access shared resources across multiple groups
 * 
 * 2. GROUPS (Scheduling Coordination):
 *    - Manage schedules, time slots, and trips
 *    - Group members collaborate on transportation scheduling
 *    - Groups can use family-owned resources for scheduling
 *    - Separate from families - a family can participate in multiple groups
 * 
 * RELATIONSHIP:
 * - Family owns resources (children, vehicles)
 * - Groups coordinate schedules using those resources
 * - Users can be in one family but multiple groups
 */

// Export family types for resource management (children, vehicles ownership)
export * from './family';

// Group types for scheduling coordination system
export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string; // IANA timezone (e.g., 'Europe/Paris', 'America/New_York')
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  familyId: string;  // Owning family (creator/owner of the group)
  ownerFamily?: {
    id: string;
    name: string;
    members: Array<{
      user: User;
      role: string;
    }>;
  };
  familyMembers?: Array<{
    family: {
      id: string;
      name: string;
      members: Array<{
        user: User;
        role: string;
      }>;
    };
    role: string;
  }>;
}

// Modern schedule types are now defined in apiService.ts
// This file only contains shared types and legacy compatibility types if needed

export interface ApiResponse<T> {
  success?: boolean;
  status?: number;
  message?: string;
  data?: T;
  error?: string;
}

// Legacy type for backward compatibility - USE ONLY IN TESTS OR SPECIFIC CASES
export interface ApiResponseLegacy<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface DragItem {
  type: 'child';
  childId: string;
  childName: string;
  sourceTrip?: string;
}