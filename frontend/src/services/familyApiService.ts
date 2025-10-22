import axios from 'axios';
import type { 
  Family, 
  FamilyMember, 
  FamilyPermissions,
  FamilyInvitation,
  CreateFamilyRequest,
  CreateFamilyResponse,
  JoinFamilyRequest,
  JoinFamilyResponse,
  InviteMemberRequest,
  InviteMemberResponse,
  UpdateMemberRoleRequest,
  GenerateInviteCodeResponse,
  Child,
  Vehicle
} from '../types/family';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

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
      console.log('🔍 FamilyApiService: API URL:', `${API_BASE_URL}/families`);
      const response = await axios.post<CreateFamilyResponse>(`${API_BASE_URL}/families`, data);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to create family');
      }

      return response.data.data;
    } catch (error) {
      console.error('🚨 FamilyApiService: Error creating family:', error);
      if (axios.isAxiosError(error)) {
        console.error('🚨 Axios error details:', {
          message: error.message,
          code: error.code,
          config: error.config?.url,
          response: error.response?.data
        });
      }
      throw error;
    }
  }

  async joinFamily(data: JoinFamilyRequest): Promise<Family> {
    try {
      const response = await axios.post<JoinFamilyResponse>(`${API_BASE_URL}/families/join`, data);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to join family');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;
        
        // Extract error message from API response
        const apiErrorMessage = data?.error || data?.message;
        
        switch (status) {
          case 400:
            if (apiErrorMessage?.includes('invitation') || apiErrorMessage?.includes('code')) {
              throw new Error('Invalid invitation code. Please check the code and try again.');
            }
            throw new Error(apiErrorMessage || 'Invalid invitation code. Please check and try again.');
          case 404:
            throw new Error('Invitation not found or has expired. Please check with the family member who sent it.');
          case 403:
            throw new Error('You do not have permission to join this family.');
          case 409:
            throw new Error('You are already a member of this family.');
          default:
            throw new Error(apiErrorMessage || 'Unable to join family. Please try again later.');
        }
      }
      
      // Network or other errors
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  async getCurrentFamily(): Promise<Family | null> {
    try {
      console.log('🔍 FamilyApiService: Fetching current family...');
      const response = await axios.get<CreateFamilyResponse>(`${API_BASE_URL}/families/current`);

      if (!response.data.success) {
        if (response.status === 404) {
          console.log('📝 FamilyApiService: User is not part of any family (404)');
          return null; // User is not part of any family
        }
        throw new Error(response.data.error || 'Failed to fetch current family');
      }

      const family = response.data.data || null;
      if (family) {
        console.log('✅ FamilyApiService: Current family fetched successfully:', {
          familyId: family.id,
          familyName: family.name,
          memberCount: family.members?.length || 0,
          adminCount: family.members?.filter(m => m.role === 'ADMIN').length || 0
        });
      } else {
        console.log('📝 FamilyApiService: No current family found');
      }

      return family;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('📝 FamilyApiService: User is not part of any family (404 error)');
        return null;
      }
      console.error('🚨 FamilyApiService: Error fetching current family:', error);
      throw error;
    }
  }

  async getFamilyById(familyId: string): Promise<Family> {
    const response = await axios.get<CreateFamilyResponse>(`${API_BASE_URL}/families/${familyId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch family');
    }

    return response.data.data;
  }

  async updateFamily(familyId: string, data: Partial<CreateFamilyRequest>): Promise<Family> {
    const response = await axios.patch<CreateFamilyResponse>(`${API_BASE_URL}/families/${familyId}`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update family');
    }

    return response.data.data;
  }

  async deleteFamily(familyId: string): Promise<void> {
    const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE_URL}/families/${familyId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete family');
    }
  }

  async leaveFamily(familyId: string): Promise<void> {
    const response = await axios.post<{ success: boolean; error?: string }>(`${API_BASE_URL}/families/${familyId}/leave`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to leave family');
    }
  }

  // Member Management
  async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    const response = await axios.get<{ success: boolean; data?: FamilyMember[]; error?: string }>(`${API_BASE_URL}/families/${familyId}/members`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch family members');
    }

    return response.data.data;
  }

  async inviteMember(familyId: string, data: InviteMemberRequest): Promise<FamilyInvitation> {
    const response = await axios.post<InviteMemberResponse>(`${API_BASE_URL}/families/${familyId}/invite`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to send invitation');
    }

    return response.data.data;
  }

  async updateMemberRole(_familyId: string, memberId: string, data: UpdateMemberRoleRequest): Promise<void> {
    const response = await axios.put<{ success: boolean; message?: string; error?: string }>(`${API_BASE_URL}/families/members/${memberId}/role`, data);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update member role');
    }
  }

  async removeMember(familyId: string, memberId: string): Promise<void> {
    const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE_URL}/families/${familyId}/members/${memberId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove member');
    }
  }

  async generateInviteCode(): Promise<string> {
    const response = await axios.post<GenerateInviteCodeResponse>(`${API_BASE_URL}/families/invite-code`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to generate invite code');
    }

    return response.data.data.inviteCode;
  }

  async updateFamilyName(name: string): Promise<Family> {
    const response = await axios.put<{ success: boolean; data?: Family; error?: string }>(`${API_BASE_URL}/families/name`, { name });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update family name');
    }

    return response.data.data;
  }

  // Permissions
  async getUserPermissions(familyId: string): Promise<FamilyPermissions> {
    const response = await axios.get<{ success: boolean; data?: FamilyPermissions; error?: string }>(`${API_BASE_URL}/families/${familyId}/permissions`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch permissions');
    }

    return response.data.data;
  }

  // Invitations
  async getInvitations(familyId: string): Promise<FamilyInvitation[]> {
    const response = await axios.get<{ success: boolean; data?: FamilyInvitation[]; error?: string }>(`${API_BASE_URL}/families/${familyId}/invitations`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch invitations');
    }

    return response.data.data;
  }

  async cancelInvitation(familyId: string, invitationId: string): Promise<void> {
    const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE_URL}/families/${familyId}/invitations/${invitationId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel invitation');
    }
  }

  async resendInvitation(familyId: string, invitationId: string): Promise<FamilyInvitation> {
    const response = await axios.post<InviteMemberResponse>(`${API_BASE_URL}/families/${familyId}/invitations/${invitationId}/resend`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to resend invitation');
    }

    return response.data.data;
  }

  // Validation and utility endpoints
  async validateInviteCode(inviteCode: string): Promise<{ valid: boolean; family?: { id: string; name: string }; error?: string }> {
    const rateLimitKey = `validateInviteCode-${inviteCode}`;
    
    if (!shouldAllowRequest(rateLimitKey)) {
      return { valid: false, error: 'Too many validation attempts. Please wait a moment.' };
    }
    
    try {
      const response = await axios.post<{ success: boolean; data?: { valid: boolean; family?: { id: string; name: string } }; error?: string }>(`${API_BASE_URL}/families/validate-invite`, { inviteCode });

      if (!response.data.success) {
        return { valid: false, error: response.data.error };
      }

      return response.data.data || { valid: false };
    } catch (error) {
      // Handle HTTP error responses (like 400) that contain the actual error message
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        return { valid: false, error: error.response.data.error };
      }
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
  async getFamilyChildren(familyId: string): Promise<Child[]> {
    const response = await axios.get<{ success: boolean; data?: Child[]; error?: string }>(`${API_BASE_URL}/families/${familyId}/children`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch family children');
    }

    return response.data.data;
  }

  async addFamilyChild(familyId: string, childData: { name: string; age?: number }): Promise<Child> {
    const response = await axios.post<{ success: boolean; data?: Child; error?: string }>(`${API_BASE_URL}/families/${familyId}/children`, childData);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to add child to family');
    }

    return response.data.data;
  }

  // Vehicles management with family context
  async getFamilyVehicles(familyId: string): Promise<Vehicle[]> {
    const response = await axios.get<{ success: boolean; data?: Vehicle[]; error?: string }>(`${API_BASE_URL}/families/${familyId}/vehicles`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch family vehicles');
    }

    return response.data.data;
  }

  async addFamilyVehicle(familyId: string, vehicleData: { name: string; capacity: number }): Promise<Vehicle> {
    const response = await axios.post<{ success: boolean; data?: Vehicle; error?: string }>(`${API_BASE_URL}/families/${familyId}/vehicles`, vehicleData);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to add vehicle to family');
    }

    return response.data.data;
  }
}

export const familyApiService = new FamilyApiService();
export default familyApiService;