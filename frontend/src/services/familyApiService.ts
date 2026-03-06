import { api } from './api';
import type { paths, components } from '../generated/api/types';
import { throwApiError, getApiError, isHttpError } from '../utils/apiError';

// Extract types from OpenAPI generated types for backward compatibility
type BaseFamily = paths['/api/v1/families/current']['get']['responses']['200']['content']['application/json']['data'];
export type FamilyMember = NonNullable<BaseFamily['members']>[0];
export type FamilyInvitation = paths['/api/v1/families/{familyId}/invite']['post']['responses']['201']['content']['application/json']['data'];
export type FamilyPermissions = paths['/api/v1/families/{familyId}/permissions']['get']['responses']['200']['content']['application/json']['data'];
export type Child = NonNullable<BaseFamily['children']>[0];
export type Vehicle = NonNullable<BaseFamily['vehicles']>[0];

// Use BaseFamily directly since inviteCode is no longer returned by the API
export type Family = BaseFamily;

// Request types from components schemas
export type CreateFamilyRequest = components['schemas']['CreateFamilyRequest'];
export type JoinFamilyRequest = components['schemas']['JoinFamilyRequest'];
export type UpdateMemberRoleRequest = components['schemas']['UpdateMemberRoleRequest'];
export type UpdateFamilyNameRequest = components['schemas']['UpdateFamilyNameRequest'];
export type CreateFamilyInvitationRequest = components['schemas']['CreateFamilyInvitationRequest'];
export type CreateChildRequest = components['schemas']['CreateChildRequest'];
export type CreateVehicleRequest = components['schemas']['CreateVehicleRequest'];

// Response types for backward compatibility
export type CreateFamilyResponse = Family;
export type JoinFamilyResponse = Family;
export type InviteMemberRequest = CreateFamilyInvitationRequest;
export type InviteMemberResponse = FamilyInvitation;
export type GenerateInviteCodeResponse = { success: boolean; data?: { inviteCode?: string } };

// Simple rate limiting for API calls
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second

const shouldAllowRequest = (key: string): boolean => {
  const now = Date.now();
  const lastCall = rateLimitMap.get(key);

  if (!lastCall || (now - lastCall) > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, now);
    return true;
  }

  return false;
};

class FamilyApiService {
  // Family Management
  async createFamily(data: CreateFamilyRequest): Promise<Family> {
    try {
      console.log('🔍 FamilyApiService: Creating family with data:', data);
      const { data: response, error } = await api.POST('/api/v1/families', {
        body: data,
      });

      if (error) {
        console.error('🚨 FamilyApiService: API error creating family:', error);
        throwApiError(error, 'Failed to create family');
      }

      if (!response?.success || !response?.data) {
        throw new Error('Failed to create family');
      }

      const familyData = response.data;
      return familyData;
    } catch (error) {
      console.error('🚨 FamilyApiService: Error creating family:', error);
      throw error;
    }
  }

  async joinFamily(data: JoinFamilyRequest): Promise<Family> {
    const { data: response, error } = await api.POST('/api/v1/families/join', {
      body: data,
    });

    if (error) {
      // Handle different HTTP status codes with user-friendly messages
      if (isHttpError(error, 400)) {
        const apiError = getApiError(error);
        if (apiError.message?.includes('invitation') || apiError.message?.includes('code')) {
          throw new Error('Invalid invitation code. Please check the code and try again.');
        }
        throw new Error(apiError.message || 'Invalid invitation code. Please check and try again.');
      }
      if (isHttpError(error, 404)) {
        throw new Error('Invitation not found or has expired. Please check with the family member who sent it.');
      }
      if (isHttpError(error, 403)) {
        throw new Error('You do not have permission to join this family.');
      }
      if (isHttpError(error, 409)) {
        throw new Error('You are already a member of this family.');
      }
      throwApiError(error, 'Unable to join family. Please try again later.');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to join family');
    }

    return response.data;
  }

  async getCurrentFamily(): Promise<Family | null> {
    console.log('🔍 FamilyApiService: Fetching current family...');
    const { data: response, error } = await api.GET('/api/v1/families/current');

    if (error) {
      // Handle 404 as "no family" case
      if (isHttpError(error, 404)) {
        console.log('📝 FamilyApiService: User is not part of any family (404)');
        return null;
      }
      throwApiError(error, 'Failed to fetch current family');
    }

    if (!response?.success) {
      if (response === null) {
        console.log('📝 FamilyApiService: No current family found');
        return null;
      }
      throw new Error('Failed to fetch current family');
    }

    const familyData = response.data || null;
    if (familyData) {
      console.log('✅ FamilyApiService: Current family fetched successfully:', {
        familyId: familyData.id,
        familyName: familyData.name,
        memberCount: familyData.members?.length || 0,
        adminCount: familyData.members?.filter(m => m.role === 'ADMIN').length || 0
      });
    } else {
      console.log('📝 FamilyApiService: No current family found');
    }

    return familyData as Family | null;
  }

  async getFamilyById(familyId: string): Promise<Family> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Using getCurrentFamily() as a workaround for now
    // This should be added to the OpenAPI spec
    console.warn('⚠️ getFamilyById endpoint not available in OpenAPI client. Using getCurrentFamily() instead.');
    const family = await this.getCurrentFamily();
    if (!family || family.id !== familyId) {
      throw new Error('Family not found');
    }
    return family;
  }

  async updateFamily(): Promise<Family> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be PATCH /families/{familyId}
    throw new Error('Update family endpoint not available in OpenAPI client. Please add to API specification.');
  }

  async deleteFamily(): Promise<void> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be DELETE /families/{familyId}
    throw new Error('Delete family endpoint not available in OpenAPI client. Please add to API specification.');
  }

  async leaveFamily(familyId: string): Promise<void> {
    const { data: response, error } = await api.POST('/api/v1/families/{familyId}/leave', {
      params: {
        path: { familyId },
      },
    });

    if (error) {
      throwApiError(error, 'Failed to leave family');
    }

    if (!response?.success) {
      throw new Error('Failed to leave family');
    }
  }

  // Member Management
  async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be GET /families/{familyId}/members
    // Workaround: Extract from family data
    const family = await this.getFamilyById(familyId);
    return family.members || [];
  }

  async inviteMember(familyId: string, data: InviteMemberRequest): Promise<FamilyInvitation> {
    const { data: response, error } = await api.POST('/api/v1/families/{familyId}/invite', {
      params: {
        path: { familyId },
      },
      body: data,
    });

    if (error) {
      throwApiError(error, 'Failed to send invitation');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to send invitation');
    }

    return response.data;
  }

  async updateMemberRole(memberId: string, data: UpdateMemberRoleRequest): Promise<void> {
    const { data: response, error } = await api.PUT('/api/v1/families/members/{memberId}/role', {
      params: {
        path: { memberId },
      },
      body: data,
    });

    if (error) {
      throwApiError(error, 'Failed to update member role');
    }

    if (!response?.success) {
      throw new Error('Failed to update member role');
    }
  }

  async removeMember(familyId: string, memberId: string): Promise<void> {
    const { data: response, error } = await api.DELETE('/api/v1/families/{familyId}/members/{memberId}', {
      params: {
        path: { familyId, memberId },
      },
    });

    if (error) {
      throwApiError(error, 'Failed to remove member');
    }

    if (!response?.success) {
      throw new Error('Failed to remove member');
    }
  }

  async generateInviteCode(): Promise<string> {
    // This endpoint is deprecated
    throw new Error('Generate invite code feature is deprecated. Please use member invitations instead.');
  }

  async updateFamilyName(name: string): Promise<Family> {
    const { data: response, error } = await api.PUT('/api/v1/families/name', {
      body: { name },
    });

    if (error) {
      throwApiError(error, 'Failed to update family name');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to update family name');
    }

    const familyData = response.data;
    return familyData as Family;
  }

  // Permissions
  async getUserPermissions(familyId: string): Promise<FamilyPermissions> {
    const { data: response, error } = await api.GET('/api/v1/families/{familyId}/permissions', {
      params: {
        path: { familyId },
      },
    });

    if (error) {
      throwApiError(error, 'Failed to fetch permissions');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to fetch permissions');
    }

    return response.data;
  }

  // Invitations
  async getInvitations(familyId: string): Promise<FamilyInvitation[]> {
    const { data: response, error } = await api.GET('/api/v1/families/{familyId}/invitations', {
      params: {
        path: { familyId },
      },
    });

    if (error) {
      throwApiError(error, 'Failed to fetch invitations');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to fetch invitations');
    }

    return response.data;
  }

  async cancelInvitation(familyId: string, invitationId: string): Promise<void> {
    const { data: response, error } = await api.DELETE('/api/v1/families/{familyId}/invitations/{invitationId}', {
      params: {
        path: { familyId, invitationId },
      },
    });

    if (error) {
      throwApiError(error, 'Failed to cancel invitation');
    }

    if (!response?.success) {
      throw new Error('Failed to cancel invitation');
    }
  }

  async resendInvitation(): Promise<FamilyInvitation> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be POST /families/{familyId}/invitations/{invitationId}/resend
    throw new Error('Resend invitation endpoint not available in OpenAPI client. Please add to API specification.');
  }

  // Validation and utility endpoints
  async validateInviteCode(inviteCode: string): Promise<{ valid: boolean; family?: { id: string; name: string }; error?: string }> {
    const rateLimitKey = `validateInviteCode-${inviteCode}`;

    if (!shouldAllowRequest(rateLimitKey)) {
      return { valid: false, error: 'Too many validation attempts. Please wait a moment.' };
    }

    try {
      const { data, error } = await api.GET('/api/v1/invitations/family/{code}/validate', {
        params: { path: { code: inviteCode } }
      });

      if (error) {
        // Handle HTTP error responses (like 404) that contain the actual error message
        if (typeof error === 'object' && error !== null) {
          const errorMessage = (error as { message?: string; error?: string }).message || (error as { message?: string; error?: string }).error;
          return { valid: false, error: errorMessage || 'Failed to validate invite code' };
        }
        return { valid: false, error: getApiError(error).message || 'Failed to validate invite code' };
      }

      if (!data?.valid) {
        return { valid: false, error: 'Invalid invite code' };
      }

      return {
        valid: true,
        family: data.family ? { id: data.family.id, name: data.family.name } : undefined,
      };
    } catch (error) {
      console.error('Error validating invite code:', error);
      return { valid: false, error: 'Failed to validate invite code' };
    }
  }

  async checkFamilyMembership(): Promise<{ hasFamily: boolean; family?: Family }> {
    try {
      const family = await this.getCurrentFamily();
      return { hasFamily: !!family, family: family || undefined };
    } catch {
      return { hasFamily: false };
    }
  }

  // Children management with family context
  async getFamilyChildren(): Promise<Child[]> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be GET /families/{familyId}/children
    // Workaround: Use the general /children endpoint which returns user's family children
    const { data: response, error } = await api.GET('/api/v1/children');

    if (error) {
      throwApiError(error, 'Failed to fetch family children');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to fetch family children');
    }

    // API returns: { id, name, age, familyId, createdAt, updatedAt }
    // OpenAPI Child type expects: { id, name, age?, familyId, createdAt, updatedAt }
    return response.data;
  }

  async addFamilyChild(childData: { name: string; age?: number }): Promise<Child> {
    // NOTE: This uses the general /children endpoint as family-specific endpoint is not available
    const { data: response, error } = await api.POST('/api/v1/children', {
      body: childData,
    });

    if (error) {
      throwApiError(error, 'Failed to add child to family');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to add child to family');
    }

    // API returns: { id, name, age, familyId, createdAt, updatedAt }
    // OpenAPI Child type expects: { id, name, age?, familyId, createdAt, updatedAt }
    return response.data;
  }

  // Vehicles management with family context
  async getFamilyVehicles(): Promise<Vehicle[]> {
    // NOTE: This endpoint is not available in the generated OpenAPI client
    // Should be GET /families/{familyId}/vehicles
    // Workaround: Use the general /vehicles endpoint which returns user's family vehicles
    const { data: response, error } = await api.GET('/api/v1/vehicles');

    if (error) {
      throwApiError(error, 'Failed to fetch family vehicles');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to fetch family vehicles');
    }

    // API returns: { id, name, capacity, familyId, createdAt, updatedAt }
    // OpenAPI Vehicle type expects: { id, name, capacity, familyId, createdAt, updatedAt }
    return response.data;
  }

  async addFamilyVehicle(vehicleData: { name: string; capacity: number }): Promise<Vehicle> {
    // NOTE: This uses the general /vehicles endpoint as family-specific endpoint is not available
    const { data: response, error } = await api.POST('/api/v1/vehicles', {
      body: vehicleData,
    });

    if (error) {
      throwApiError(error, 'Failed to add vehicle to family');
    }

    if (!response?.success || !response?.data) {
      throw new Error('Failed to add vehicle to family');
    }

    // API returns: { id, name, capacity, familyId, createdAt, updatedAt }
    return response.data as Vehicle;
  }
}

export const familyApiService = new FamilyApiService();
export default familyApiService;