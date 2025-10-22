/**
 * FAMILY SYSTEM TYPES
 * 
 * Purpose: Resource ownership and management system
 * 
 * The family system manages shared resources (children, vehicles) that can be used
 * across multiple scheduling groups. This is separate from the group system which
 * handles scheduling coordination.
 * 
 * Key Concepts:
 * - Families own resources (children, vehicles)
 * - Family members have roles with different permissions
 * - Resources can be shared across multiple scheduling groups
 * - One user can only be in one family at a time
 * - Family resources are accessible to authorized family members
 */

// Family role enum matching backend Prisma enum
export const FamilyRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER'
} as const;

export type FamilyRole = typeof FamilyRole[keyof typeof FamilyRole];

// Basic entities matching backend structure
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  members: FamilyMember[];
  children: Child[];
  vehicles: Vehicle[];
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  joinedAt: string;
  user: User;
}

export interface Child {
  id: string;
  name: string;
  age?: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

// Family permissions interface
export interface FamilyPermissions {
  canManageMembers: boolean;
  canModifyChildren: boolean;
  canModifyVehicles: boolean;
  canViewFamily: boolean;
}

// Frontend-specific types for UI state management
export interface FamilyState {
  currentFamily: Family | null;
  userPermissions: FamilyPermissions | null;
  isLoading: boolean;
  error: string | null;
}

// Extended state for family requirement checking
export interface FamilyContextState extends FamilyState {
  requiresFamily: boolean;      // User needs to create/join a family
  isCheckingFamily: boolean;    // Currently checking family status
}

export interface FamilyInvitation {
  id: string;
  familyId: string;
  email: string;
  role: FamilyRole;
  inviteCode: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  personalMessage?: string;
  createdAt: string;
}

// API request/response types
export interface CreateFamilyRequest {
  name: string;
}

export interface CreateFamilyResponse {
  success: boolean;
  data?: Family;
  error?: string;
}

export interface JoinFamilyRequest {
  inviteCode: string;
}

export interface JoinFamilyResponse {
  success: boolean;
  data?: Family;
  error?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: FamilyRole;
  personalMessage?: string;
}

export interface InviteMemberResponse {
  success: boolean;
  data?: FamilyInvitation;
  error?: string;
}

export interface UpdateMemberRoleRequest {
  role: FamilyRole;
}

export interface UpdateMemberRoleResponse {
  success: boolean;
  data?: FamilyMember;
  error?: string;
}

export interface GenerateInviteCodeResponse {
  success: boolean;
  data?: { inviteCode: string };
  error?: string;
}

// Frontend UI component props types
export interface FamilyCardProps {
  family: Family;
  onSelect?: (family: Family) => void;
  onEdit?: (family: Family) => void;
  onLeave?: (family: Family) => void;
  isSelected?: boolean;
}

export interface FamilyMemberCardProps {
  member: FamilyMember;
  currentUser: User;
  permissions: FamilyPermissions;
  onEdit?: (member: FamilyMember) => void;
  onRemove?: (member: FamilyMember) => void;
  onRoleChange?: (member: FamilyMember, newRole: FamilyRole) => void;
}

export interface FamilyInvitationFormProps {
  onSubmit: (data: InviteMemberRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface FamilySetupWizardProps {
  onComplete: (family: Family) => void;
  onCancel: () => void;
  initialStep?: number;
}

// Form data types
export interface CreateFamilyFormData {
  name: string;
  description?: string;
}

export interface JoinFamilyFormData {
  inviteCode: string;
}

export interface InviteMemberFormData {
  email: string;
  role: FamilyRole;
  personalMessage?: string;
}

// Error types
export interface FamilyError extends Error {
  code: string;
  statusCode: number;
}

export function createFamilyError(
  code: string,
  message: string,
  statusCode: number = 400
): FamilyError {
  const error = new Error(message) as FamilyError;
  error.name = 'FamilyError';
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Error codes matching backend
export const FAMILY_ERROR_CODES = {
  USER_ALREADY_IN_FAMILY: 'USER_ALREADY_IN_FAMILY',
  INVALID_FAMILY_NAME: 'INVALID_FAMILY_NAME',
  INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
  FAMILY_FULL: 'FAMILY_FULL',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  LAST_ADMIN: 'LAST_ADMIN',
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
} as const;

export type FamilyErrorCode = typeof FAMILY_ERROR_CODES[keyof typeof FAMILY_ERROR_CODES];

// Helper type guards
export const isFamilyAdmin = (member: FamilyMember): boolean => {
  return member.role === FamilyRole.ADMIN;
};

export const canManageMembers = (permissions: FamilyPermissions): boolean => {
  return permissions.canManageMembers;
};

export const canModifyChildren = (permissions: FamilyPermissions): boolean => {
  return permissions.canModifyChildren;
};

export const canModifyVehicles = (permissions: FamilyPermissions): boolean => {
  return permissions.canModifyVehicles;
};

// Role display helpers
export const getRoleDisplayName = (role: FamilyRole): string => {
  switch (role) {
    case FamilyRole.ADMIN:
      return 'Administrator';
    case FamilyRole.MEMBER:
      return 'Member';
    default:
      return 'Unknown';
  }
};

export const getRoleDescription = (role: FamilyRole): string => {
  switch (role) {
    case FamilyRole.ADMIN:
      return 'Can manage all family members, children, vehicles, settings, and permissions';
    case FamilyRole.MEMBER:
      return 'Can view family information and participate in activities';
    default:
      return '';
  }
};

export const getRoleIcon = (role: FamilyRole): string => {
  switch (role) {
    case FamilyRole.ADMIN:
      return '👑';
    case FamilyRole.MEMBER:
      return '👤';
    default:
      return '❓';
  }
};

// Family validation helpers
export const validateFamilyName = (name: string): string | null => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return 'Family name is required';
  }
  if (trimmedName.length < 2) {
    return 'Family name must be at least 2 characters';
  }
  if (trimmedName.length > 50) {
    return 'Family name must be less than 50 characters';
  }
  return null;
};

export const validateInviteCode = (code: string): string | null => {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return 'Invite code is required';
  }
  if (trimmedCode.length < 7) {
    return 'Invite code appears to be invalid';
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }
  return null;
};