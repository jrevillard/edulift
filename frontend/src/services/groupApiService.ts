import { apiService } from './apiService';
import type { ApiResponse } from '@/types';
import type {
  UserGroup,
  GroupFamily,
  GroupInvitation,
  FamilySearchResult,
  GroupInvitationEligibility
} from './apiService';

interface GroupValidationResponse {
  valid: boolean;
  group?: UserGroup;
  invitation?: GroupInvitation;
  error?: string;
}

interface GroupValidationAuthResponse extends GroupValidationResponse {
  userStatus?: string;
  familyInfo?: {
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  };
  canAccept?: boolean;
  message?: string;
  actionRequired?: string;
}

/**
 * Group-specific API service
 * Wraps apiService methods for group operations
 */
export class GroupApiService {
  // Group validation using public endpoint
  async validateGroupInviteCode(inviteCode: string): Promise<GroupValidationResponse> {
    try {
      const response = await apiService.post('/groups/validate-invite', { inviteCode });

      // Backend returns { success: true, data: { valid, group, invitation } }
      const apiResponse = response.data as ApiResponse<GroupValidationResponse>;
      if (apiResponse.success && apiResponse.data) {
        return apiResponse.data;
      } else {
        return {
          valid: false,
          error: apiResponse.error || 'Invalid invitation code'
        };
      }
    } catch (error: unknown) {
      console.error('Error validating group invite code:', error);

      // Handle specific error responses
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        return {
          valid: false,
          error: axiosError.response?.data?.error || 'Failed to validate invitation code'
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
      const response = await apiService.post('/groups/validate-invite-auth', { inviteCode });
      const apiResponse = response.data as ApiResponse<GroupValidationAuthResponse>;
      if (apiResponse.success && apiResponse.data) {
        return apiResponse.data;
      } else {
        return {
          valid: false,
          error: apiResponse.error || 'Failed to validate invitation code'
        };
      }
    } catch (error: unknown) {
      console.error('Error validating group invite code with auth:', error);

      // Handle specific error responses
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        return {
          valid: false,
          error: axiosError.response?.data?.error || 'Failed to validate invitation code'
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
    return apiService.joinGroup(inviteCode);
  }

  // Pending invitations
  async storePendingGroupInvitation(email: string, inviteCode: string) {
    // Extract group ID from invite code or use API to resolve it
    const groupId = 'mock-group'; // This should be resolved from the invite code
    return apiService.storePendingGroupInvitation(email, groupId, inviteCode);
  }

  async getPendingGroupInvitationByEmail(email: string) {
    return apiService.getPendingGroupInvitationByEmail(email);
  }

  // Family search and invitation
  async searchFamiliesForInvitation(groupId: string, searchTerm: string): Promise<FamilySearchResult[]> {
    return apiService.searchFamiliesForInvitation(groupId, searchTerm);
  }

  async inviteFamilyToGroup(groupId: string, familyId: string, role: 'MEMBER' | 'ADMIN', personalMessage?: string) {
    return apiService.inviteFamilyToGroup(groupId, familyId, role, personalMessage);
  }

  // Group invitation eligibility
  async validateGroupInvitationEligibility(groupId: string, inviteCode: string): Promise<GroupInvitationEligibility> {
    return apiService.validateGroupInvitationEligibility(groupId, inviteCode);
  }

  async joinGroupWithFamily(groupId: string, inviteCode: string) {
    return apiService.joinGroupWithFamily(groupId, inviteCode);
  }

  // Group management
  async getUserGroups(): Promise<UserGroup[]> {
    return apiService.getUserGroups();
  }

  // Note: getGroupDetails doesn't exist, we can get details from getUserGroups
  async getGroupDetails(groupId: string) {
    const groups = await apiService.getUserGroups();
    return groups.find(g => g.id === groupId);
  }

  async createGroup(name: string) {
    return apiService.createGroup(name);
  }

  async deleteGroup(groupId: string) {
    return apiService.deleteGroup(groupId);
  }

  // Group families (family-based group management)
  async getGroupFamilies(groupId: string): Promise<GroupFamily[]> {
    return apiService.getGroupFamilies(groupId);
  }

  // Group invitations
  async getGroupInvitations(groupId: string): Promise<GroupInvitation[]> {
    return apiService.getGroupInvitations(groupId);
  }

  async deleteGroupInvitation(groupId: string, invitationId: string) {
    return apiService.cancelGroupInvitation(groupId, invitationId);
  }
}

// Export singleton instance
export const groupApiService = new GroupApiService();