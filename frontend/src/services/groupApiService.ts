import { api } from './api';
import type { paths } from '@/generated/api/types';
import type { FamilySearchResult } from '@/types/api';

// OpenAPI generated types
export type UserGroup = paths['/api/v1/groups/my-groups']['get']['responses'][200]['content']['application/json']['data'][0];
export type GroupFamily = paths['/api/v1/groups/{groupId}/families']['get']['responses'][200]['content']['application/json']['data'][0];

// Type de réponse pour la validation d'invitation (sans auth)
// Basé sur le nouvel endpoint GET /invitations/group/{code}/validate
export type GroupValidationResponse = paths['/api/v1/invitations/group/{code}/validate']['get']['responses'][200]['content']['application/json'];

// Type de réponse pour la validation d'invitation (avec auth)
// Note: Le même endpoint est utilisé pour les deux cas (auth est optionnel)
export type GroupValidationAuthResponse = GroupValidationResponse;

/**
 * Group-specific API service
 * Wraps apiService methods for group operations
 */
export class GroupApiService {
  // Group validation using public endpoint
  // Uses new GET /invitations/group/{code}/validate endpoint
  async validateGroupInviteCode(inviteCode: string): Promise<GroupValidationResponse> {
    try {
      const { data } = await api.GET('/api/v1/invitations/group/{code}/validate', {
        params: { path: { code: inviteCode } },
      });

      if (data) {
        return data;
      } else {
        // Retourner une valeur par défaut cohérente avec le type
        return {
          valid: false,
          type: 'GROUP',
          group: undefined,
        };
      }
    } catch (error: unknown) {
      console.error('Error validating group invite code:', error);

      // Retourner une valeur par défaut cohérente avec le type
      return {
        valid: false,
        type: 'GROUP',
        group: undefined,
      };
    }
  }

  // Group validation with authenticated user context
  // Note: Utilise le même endpoint que validateGroupInviteCode car le backend
  // gère automatiquement l'authentification optionnelle
  async validateGroupInviteCodeWithAuth(inviteCode: string): Promise<GroupValidationAuthResponse> {
    // L'authentification est gérée automatiquement par le client API
    return this.validateGroupInviteCode(inviteCode);
  }

  // Join group by invite code
  async joinGroupByInviteCode(inviteCode: string) {
    try {
      const { data } = await api.POST('/api/v1/groups/join', {
        body: { inviteCode },
      });

      if (!data?.success || !data?.data) {
        throw new Error('Failed to join group');
      }
      return data.data;
    } catch (error: unknown) {
      console.error('Error joining group by invite code:', error);
      throw error;
    }
  }

  // Family search and invitation
  async searchFamiliesForInvitation(groupId: string, searchTerm: string): Promise<FamilySearchResult[]> {
    try {
      const { data } = await api.POST('/api/v1/groups/{groupId}/search-families', {
        params: { path: { groupId } },
        body: { searchTerm },
      });

      if (!data?.success) {
        throw new Error('Failed to search families');
      }
      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error searching families for invitation:', error);
      throw error;
    }
  }

  // Invite family to group
  async inviteFamilyToGroup(groupId: string, familyId: string, role: 'MEMBER' | 'ADMIN', personalMessage?: string) {
    try {
      const { data } = await api.POST('/api/v1/groups/{groupId}/invite', {
        params: { path: { groupId } },
        body: { familyId, role, personalMessage },
      });

      if (!data?.success) {
        throw new Error('Failed to invite family to group');
      }
      return data?.data;
    } catch (error: unknown) {
      console.error('Error inviting family to group:', error);
      throw error;
    }
  }

  // Group invitation eligibility - Note: No specific endpoint found, using validation endpoint
  async validateGroupInvitationEligibility(_groupId: string, inviteCode: string): Promise<GroupValidationAuthResponse> {
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
      const { data } = await api.GET('/api/v1/groups/my-groups');

      if (!data?.success) {
        throw new Error('Failed to get user groups');
      }
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
      const { data } = await api.POST('/api/v1/groups', {
        body: { name },
      });

      if (!data?.success) {
        throw new Error('Failed to create group');
      }
      return data?.data;
    } catch (error: unknown) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string) {
    try {
      const { data } = await api.DELETE('/api/v1/groups/{groupId}', {
        params: { path: { groupId } },
      });

      if (!data?.success) {
        throw new Error('Failed to delete group');
      }
      return { success: true };
    } catch (error: unknown) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Group families (family-based group management)
  async getGroupFamilies(groupId: string): Promise<GroupFamily[]> {
    try {
      const { data } = await api.GET('/api/v1/groups/{groupId}/families', {
        params: { path: { groupId } },
      });

      if (!data?.success) {
        throw new Error('Failed to get group families');
      }
      return data?.data || [];
    } catch (error: unknown) {
      console.error('Error getting group families:', error);
      throw error;
    }
  }

  // Cancel group invitation
  async cancelGroupInvitation(invitationId: string) {
    try {
      const { error } = await api.DELETE('/api/v1/invitations/group/{invitationId}', {
        params: { path: { invitationId } },
      });

      if (error) {
        throw new Error('Failed to cancel group invitation');
      }

      return { success: true };
    } catch (error: unknown) {
      console.error('Error canceling group invitation:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const groupApiService = new GroupApiService();