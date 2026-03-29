/**
 * Unified Invitation Service - Frontend Client
 *
 * This service interfaces with the backend UnifiedInvitationService
 * and provides methods for handling family and group invitations
 * using the pure OpenAPI generated client and types.
 */

import { api } from './api';
import type {
  components,
} from '../generated/api/types';

// Import role types from generated schemas
export type FamilyRole = components['schemas']['CreateFamilyInvitationRequest']['role'];
export type GroupRole = components['schemas']['CreateGroupInvitationRequest']['role'];

// Type for conditional fields sent by backend but not in OpenAPI spec
// NestJS doesn't expose conditional spread fields in OpenAPI
type ConditionalFamilyValidationFields = {
  userCurrentFamily?: { id: string; name: string };
  canLeaveCurrentFamily?: boolean;
  cannotLeaveReason?: string;
};

// Type aliases for generated types to maintain compatibility
interface FamilyInvitationValidation {
  valid: boolean;
  familyName?: string;
  role?: FamilyRole;
  personalMessage?: string;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
  userCurrentFamily?: {
    id: string;
    name: string;
  };
  canLeaveCurrentFamily?: boolean;
  cannotLeaveReason?: string;
}

interface GroupInvitationValidation {
  valid: boolean;
  groupName?: string;
  description?: string;
  ownerFamily?: string;
  requiresAuth?: boolean;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
}

interface AcceptFamilyResult {
  success: boolean;
  familyId?: string;
  leftPreviousFamily?: boolean;
  message?: string;
}

interface AcceptGroupResult {
  success?: boolean;
  familyJoined?: boolean;
  membersAdded?: number;
  alreadyMember?: boolean;
  alreadyAccepted?: boolean;
  acceptedBy?: string;
  message?: string;
}

class UnifiedInvitationService {
  /**
   * Validate a family invitation code
   */
  async validateFamilyInvitation(inviteCode: string): Promise<FamilyInvitationValidation> {
    try {
      const { data, error } = await api.GET('/api/v1/invitations/family/{code}/validate', {
        params: {
          path: {
            code: inviteCode,
          },
        },
      });

      if (error) {
        return {
          valid: false,
          error: typeof error === 'string' ? error : 'Failed to validate invitation',
          errorCode: undefined, // API errors don't have standard code property
        };
      }

      // Transform the response to match the expected interface
      // The API response is directly the object (no nested 'data' property)
      const validationData = data;
      if (!validationData) {
        return {
          valid: false,
          error: 'Invalid response from server',
        };
      }

      // The OpenAPI spec has a different structure, we need to adapt it
      // Cast to access conditional fields sent by backend but not in OpenAPI spec
      const extendedData = validationData as typeof validationData & ConditionalFamilyValidationFields;

      return {
        valid: validationData.valid,
        familyName: validationData.family?.name,
        email: validationData.email,
        role: validationData.role as FamilyRole,
        personalMessage: validationData.personalMessage || undefined,
        existingUser: validationData.existingUser ?? false,
        // These fields are sent by the backend but not in OpenAPI spec (conditional fields)
        userCurrentFamily: extendedData.userCurrentFamily,
        canLeaveCurrentFamily: extendedData.canLeaveCurrentFamily,
        cannotLeaveReason: extendedData.cannotLeaveReason,
        errorCode: validationData.errorCode,
      };
    } catch (error) {
      console.error('Error validating family invitation:', error);
      return {
        valid: false,
        error: 'Network error: Failed to validate invitation',
      };
    }
  }

  /**
   * Validate a group invitation code
   */
  async validateGroupInvitation(inviteCode: string): Promise<GroupInvitationValidation> {
    try {
      const { data, error } = await api.GET('/api/v1/invitations/group/{code}/validate', {
        params: {
          path: {
            code: inviteCode,
          },
        },
      });

      if (error) {
        return {
          valid: false,
          error: typeof error === 'string' ? error : 'Failed to validate invitation',
          errorCode: undefined, // API errors don't have standard code property
        };
      }

      // The API response is directly the object (no nested 'data' property)
      const validationData = data;
      if (!validationData) {
        return {
          valid: false,
          error: 'Invalid response from server',
        };
      }

      return {
        valid: validationData.valid,
        groupName: validationData.group?.name,
        email: validationData.email,
        // role: validationData.role, // Removed - not part of GroupInvitationValidation interface
        // personalMessage: validationData.personalMessage || undefined, // Removed - not part of GroupInvitationValidation interface
        // Note: Some fields like description, ownerFamily, requiresAuth
        // might not be in the OpenAPI response, need to verify the actual API
      };
    } catch (error) {
      console.error('Error validating group invitation:', error);
      return {
        valid: false,
        error: 'Failed to validate invitation',
      };
    }
  }

  /**
   * Accept a family invitation
   */
  async acceptFamilyInvitation(
    inviteCode: string,
    options?: { leaveCurrentFamily?: boolean },
  ): Promise<AcceptFamilyResult> {
    try {
      const { data, error } = await api.POST('/api/v1/invitations/family/{code}/accept', {
        params: {
          path: {
            code: inviteCode,
          },
        },
        body: {
          leaveCurrentFamily: options?.leaveCurrentFamily ?? false,
        },
      });

      if (error) {
        // For now, just throw a generic error since we can't access the status safely
        throw new Error(typeof error === 'string' ? error : 'Failed to accept invitation');
      }

      // API returns {success: boolean, message?: string} directly (no nested 'data')
      return data || { success: false, message: 'No data received' };
    } catch (error: unknown) {
      console.error('Error accepting family invitation:', error);
      if (error && typeof error === 'object' && 'status' in error) {
        throw error;
      }
      throw new Error('Network error');
    }
  }

  /**
   * Accept a group invitation (family joins group)
   */
  async acceptGroupInvitation(inviteCode: string): Promise<AcceptGroupResult> {
    try {
      const { data, error } = await api.POST('/api/v1/invitations/group/{code}/accept', {
        params: {
          path: {
            code: inviteCode,
          },
        },
        // body: {}, // Don't send empty body if not expected
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Failed to accept invitation');
      }

      // API returns {success: boolean, message?: string} directly (no nested 'data')
      return data || { success: false, message: 'No data received' };
    } catch (error: unknown) {
      console.error('Error accepting group invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      throw new Error(errorMessage);
    }
  }

  /**
   * Create a family invitation
   */
  async createFamilyInvitation(data: {
    familyId: string;
    email?: string;
    role: 'ADMIN' | 'MEMBER';
    personalMessage?: string;
    createdBy: string;
  }) {
    try {
      const { data: responseData, error } = await api.POST('/api/v1/invitations/family', {
        body: {
          familyId: data.familyId,
          email: data.email!,
          role: data.role as FamilyRole,
          personalMessage: data.personalMessage,
        },
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Failed to create invitation');
      }

      // API returns the created invitation object directly (no nested 'data')
      return responseData;
    } catch (error) {
      console.error('Error creating family invitation:', error);
      throw error;
    }
  }

  /**
   * Create a group invitation
   */
  async createGroupInvitation(data: {
    groupId: string;
    targetFamilyId: string;
    role: 'ADMIN' | 'MEMBER';
    personalMessage?: string;
    createdBy: string;
  }) {
    try {
      const { data: responseData, error } = await api.POST('/api/v1/invitations/group', {
        body: {
          groupId: data.groupId,
          targetFamilyId: data.targetFamilyId,
          role: data.role as GroupRole,
          personalMessage: data.personalMessage,
        },
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Failed to create invitation');
      }

      // API returns the created invitation object directly (no nested 'data')
      return responseData;
    } catch (error) {
      console.error('Error creating group invitation:', error);
      throw error;
    }
  }
}

export const unifiedInvitationService = new UnifiedInvitationService();