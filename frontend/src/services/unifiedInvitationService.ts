/**
 * Unified Invitation Service - Frontend Client
 *
 * This service interfaces with the backend UnifiedInvitationService
 * and provides methods for handling family and group invitations
 */

import { API_BASE_URL } from '@/config/runtime';

// Import proper types for roles
export type FamilyRole = 'ADMIN' | 'MEMBER';
export type GroupRole = 'ADMIN' | 'MEMBER';


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
  private baseUrl = API_BASE_URL;

  /**
   * Validate a family invitation code
   */
  async validateFamilyInvitation(inviteCode: string): Promise<FamilyInvitationValidation> {
    try {
      const url = `${this.baseUrl}/invitations/family/${inviteCode}/validate`;
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to validate invitation';
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }

        return {
          valid: false,
          error: errorMessage
        };
      }

      const result = await response.json();
      return result.data;
    } catch {
      return {
        valid: false,
        error: 'Network error: Failed to validate invitation'
      };
    }
  }

  /**
   * Validate a group invitation code
   */
  async validateGroupInvitation(inviteCode: string): Promise<GroupInvitationValidation> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations/group/${inviteCode}/validate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 400) {
          const error = await response.json();
          return {
            valid: false,
            error: error.message || 'Invalid invitation code'
          };
        }
        throw new Error('Failed to validate invitation');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error validating group invitation:', error);
      return {
        valid: false,
        error: 'Failed to validate invitation'
      };
    }
  }

  /**
   * Accept a family invitation
   */
  async acceptFamilyInvitation(
    inviteCode: string, 
    options?: { leaveCurrentFamily?: boolean }
  ): Promise<AcceptFamilyResult> {
    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}/invitations/family/${inviteCode}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(options || {})
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw { status: 409, message: error.message };
        }
        throw new Error(error.message || 'Failed to accept invitation');
      }

      const result = await response.json();
      return result.data;
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
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}/invitations/group/${inviteCode}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept invitation');
      }

      const result = await response.json();
      return result.data;
    } catch (error: unknown) {
      console.error('Error accepting group invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      throw new Error(errorMessage);
    }
  }


  /**
   * Get client IP address (simplified for demo)
   */
  // private async getClientIP(): Promise<string> {
  //   try {
  //     // In a real implementation, this might call an IP service
  //     // For now, return a placeholder
  //     return 'client-ip';
  //   } catch {
  //     return 'unknown';
  //   }
  // }

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
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const { ...bodyData } = data;
      const response = await fetch(`${this.baseUrl}/invitations/family`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create invitation');
      }

      const result = await response.json();
      return result.data;
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
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const { ...bodyData } = data;
      const response = await fetch(`${this.baseUrl}/invitations/group`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create invitation');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error creating group invitation:', error);
      throw error;
    }
  }
}

export const unifiedInvitationService = new UnifiedInvitationService();