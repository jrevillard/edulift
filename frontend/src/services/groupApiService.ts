import { api } from './api';
import type { UserGroup, GroupInvitation, FamilySearchResult, GroupFamily } from '@/types/api';

interface GroupValidationResponse {
  valid: boolean;
  group?: { id: string; name: string };
  invitation?: {
    id: string;
    expiresAt: string;
    role: 'MEMBER' | 'ADMIN';
  };
  error?: string;
}

interface GroupValidationAuthResponse extends GroupValidationResponse {
  userStatus?: "NO_FAMILY" | "FAMILY_MEMBER" | "FAMILY_ADMIN" | "ALREADY_MEMBER";
  familyInfo?: {
    id: string;
    name: string;
    role: string;
    adminName?: string;
  };
  canAccept?: boolean;
  message?: string;
  actionRequired?: "CREATE_FAMILY" | "CONTACT_ADMIN" | "ALREADY_ACCEPTED" | "READY_TO_JOIN";
}

/**
 * Group-specific API service
 * Wraps apiService methods for group operations
 */
export class GroupApiService {
  // Group validation using public endpoint
  async validateGroupInviteCode(inviteCode: string): Promise<GroupValidationResponse> {
    try {
      const { data } = await api.POST('/groups/validate-invite', {
        body: { inviteCode }
      });

      if (data?.data) {
        return data.data;
      } else {
        return {
          valid: false,
          error: 'Invalid invitation code'
        };
      }
    } catch (error: unknown) {
      console.error('Error validating group invite code:', error);

      // Handle OpenAPI client error format
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        return {
          valid: false,
          error: apiError.message || 'Failed to validate invitation code'
        };
      }

      return {
        valid: false,
        error: 'Failed to validate invitation code'
      };
    }
  }

  // Group validation with authenticated user context
  async validateGroupInviteCodeWithAuth(inviteCode: string): Promise<GroupValidationAuthResponse> {
    try {
      const { data } = await api.POST('/groups/validate-invite-auth', {
        body: { inviteCode }
      });

      if (data?.data) {
        return data.data;
      } else {
        return {
          valid: false,
          error: 'Failed to validate invitation code'
        };
      }
    } catch (error: unknown) {
      console.error('Error validating group invite code with auth:', error);

      // Handle OpenAPI client error format
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        return {
          valid: false,
          error: apiError.message || 'Failed to validate invitation code'
        };
      }

      return {
        valid: false,
        error: 'Failed to validate invitation code'
      };
    }
  }

  // Join group by invite code
  async joinGroupByInviteCode(inviteCode: string) {
    try {
      const { data } = await api.POST('/groups/join', {
        body: { inviteCode }
      });

      return data?.data;
    } catch (error: unknown) {
      console.error('Error joining group by invite code:', error);
      throw error;
    }
  }

  // Pending invitations - Note: These endpoints don't exist in OpenAPI schema
  // These methods are deprecated and should be removed or replaced
  async storePendingGroupInvitation() {
    console.warn('storePendingGroupInvitation: This method is deprecated - no corresponding OpenAPI endpoint found');
    throw new Error('Method not supported - no corresponding OpenAPI endpoint');
  }

  async getPendingGroupInvitationByEmail() {
    console.warn('getPendingGroupInvitationByEmail: This method is deprecated - no corresponding OpenAPI endpoint found');
    throw new Error('Method not supported - no corresponding OpenAPI endpoint');
  }

  // Family search and invitation
  async searchFamiliesForInvitation(groupId: string, searchTerm: string): Promise<FamilySearchResult[]> {
    try {
      const { data } = await api.POST('/groups/{groupId}/search-families', {
        params: { path: { groupId } },
        body: { searchTerm }
      });

      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error searching families for invitation:', error);
      throw error;
    }
  }

  async inviteFamilyToGroup(groupId: string, familyId: string, role: 'MEMBER' | 'ADMIN', personalMessage?: string) {
    try {
      const { data } = await api.POST('/groups/{groupId}/invite', {
        params: { path: { groupId } },
        body: { familyId, role, personalMessage }
      });

      return data?.data;
    } catch (error: unknown) {
      console.error('Error inviting family to group:', error);
      throw error;
    }
  }

  // Group invitation eligibility - Note: No specific endpoint found, using validation endpoint
  async validateGroupInvitationEligibility(_groupId: string, inviteCode: string): Promise<any> {
    console.warn('validateGroupInvitationEligibility: Using validation endpoint as no specific eligibility endpoint found');
    return this.validateGroupInviteCodeWithAuth(inviteCode);
  }

  async joinGroupWithFamily(_groupId: string, inviteCode: string) {
    console.warn('joinGroupWithFamily: Using join group endpoint as no family-specific join endpoint found');
    return this.joinGroupByInviteCode(inviteCode);
  }

  // Group management
  async getUserGroups(): Promise<UserGroup[]> {
    try {
      const { data } = await api.GET('/groups/my-groups');
      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  }

  // Note: getGroupDetails doesn't exist, we can get details from getUserGroups
  async getGroupDetails(groupId: string) {
    try {
      const groups = await this.getUserGroups();
      return groups.find(g => g.id === groupId);
    } catch (error: unknown) {
      console.error('Error getting group details:', error);
      throw error;
    }
  }

  async createGroup(name: string) {
    try {
      const { data } = await api.POST('/groups', {
        body: { name }
      });

      return data?.data;
    } catch (error: unknown) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string) {
    try {
      await api.DELETE('/groups/{groupId}', {
        params: { path: { groupId } }
      });

      return { success: true };
    } catch (error: unknown) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Group families (family-based group management)
  async getGroupFamilies(groupId: string): Promise<GroupFamily[]> {
    try {
      const { data } = await api.GET('/groups/{groupId}/families', {
        params: { path: { groupId } }
      });

      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error getting group families:', error);
      throw error;
    }
  }

  // Group invitations
  async getGroupInvitations(groupId: string): Promise<GroupInvitation[]> {
    try {
      const { data } = await api.GET('/groups/{groupId}/invitations', {
        params: { path: { groupId } }
      });

      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error getting group invitations:', error);
      throw error;
    }
  }

  async deleteGroupInvitation(groupId: string, invitationId: string) {
    try {
      await api.DELETE('/groups/{groupId}/invitations/{invitationId}', {
        params: { path: { groupId, invitationId } }
      });

      return { success: true };
    } catch (error: unknown) {
      console.error('Error deleting group invitation:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const groupApiService = new GroupApiService();