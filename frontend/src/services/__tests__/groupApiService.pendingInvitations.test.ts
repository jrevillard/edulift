import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groupApiService } from '../groupApiService';
import { api } from '../api';

// Mock the OpenAPI client
vi.mock('../api');
const mockedApi = vi.mocked(api);

describe('GroupApiService - Pending Invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('storePendingGroupInvitation (deprecated)', () => {
    it('should throw deprecation error when called', async () => {
      // Act & Assert
      await expect(groupApiService.storePendingGroupInvitation())
        .rejects.toThrow('Method not supported - no corresponding OpenAPI endpoint');

      expect(console.warn).toHaveBeenCalledWith(
        'storePendingGroupInvitation: This method is deprecated - no corresponding OpenAPI endpoint found'
      );
    });
  });

  describe('getPendingGroupInvitationByEmail (deprecated)', () => {
    it('should throw deprecation error when called', async () => {
      // Act & Assert
      await expect(groupApiService.getPendingGroupInvitationByEmail())
        .rejects.toThrow('Method not supported - no corresponding OpenAPI endpoint');

      expect(console.warn).toHaveBeenCalledWith(
        'getPendingGroupInvitationByEmail: This method is deprecated - no corresponding OpenAPI endpoint found'
      );
    });
  });

  describe('searchFamiliesForInvitation', () => {
    it('should search families for group invitation', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';

      const mockFamilies = [
        {
          id: 'family-1',
          name: 'Famille Martin',
          adminContacts: [
            { name: 'Pierre Martin', email: 'pierre@martin.com' }
          ],
          memberCount: 4,
          canInvite: true
        },
        {
          id: 'family-2',
          name: 'Martin & Co',
          adminContacts: [
            { name: 'Marie Martin', email: 'marie@martin.com' }
          ],
          memberCount: 3,
          canInvite: true
        }
      ];

      mockedApi.POST.mockResolvedValue({
        data: { data: mockFamilies },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.searchFamiliesForInvitation(groupId, searchTerm);

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/{groupId}/search-families',
        {
          params: { path: { groupId } },
          body: { searchTerm }
        }
      );
      expect(result).toEqual(mockFamilies);
    });

    it('should handle API errors when searching families', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';

      const error = new Error('Authentication required');
      mockedApi.POST.mockRejectedValue(error);

      // Act & Assert
      await expect(
        groupApiService.searchFamiliesForInvitation(groupId, searchTerm)
      ).rejects.toThrow('Authentication required');

      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/{groupId}/search-families',
        {
          params: { path: { groupId } },
          body: { searchTerm }
        }
      );
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should invite family to group successfully', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';
      const personalMessage = 'Welcome to our group!';

      const mockResponseData = {
        invitationsSent: 2,
        familyName: 'Target Family',
        groupName: 'Test Group'
      };

      mockedApi.POST.mockResolvedValue({
        data: { data: mockResponseData },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.inviteFamilyToGroup(groupId, familyId, 'MEMBER', personalMessage);

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/{groupId}/invite',
        {
          params: { path: { groupId } },
          body: { familyId, role: 'MEMBER', personalMessage }
        }
      );
      expect(result).toEqual(mockResponseData);
    });

    it('should handle family already invited error', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';

      const error = new Error('This family already has a pending invitation to this group');
      mockedApi.POST.mockRejectedValue(error);

      // Act & Assert
      await expect(
        groupApiService.inviteFamilyToGroup(groupId, familyId)
      ).rejects.toThrow('This family already has a pending invitation to this group');

      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/{groupId}/invite',
        {
          params: { path: { groupId } },
          body: { familyId, role: undefined, personalMessage: undefined }
        }
      );
    });
  });

  describe('validateGroupInvitationEligibility', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should validate user eligibility for group invitation using auth validation endpoint', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';

      const mockResponseData = {
        canJoin: true,
        userFamily: {
          id: 'family-123',
          name: 'User Family'
        },
        groupInfo: {
          id: 'group-123',
          name: 'Test Group'
        }
      };

      mockedApi.POST.mockResolvedValue({
        data: { data: mockResponseData },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        'validateGroupInvitationEligibility: Using validation endpoint as no specific eligibility endpoint found'
      );
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/validate-invite-auth',
        { body: { inviteCode } }
      );
      expect(result).toEqual(mockResponseData);
    });

    it('should handle requires family creation', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';

      const mockResponseData = {
        requiresFamilyCreation: true,
        redirectTo: '/onboarding?returnTo=group-invitation&groupId=group-123'
      };

      mockedApi.POST.mockResolvedValue({
        data: { data: mockResponseData },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(result.requiresFamilyCreation).toBe(true);
      expect(result.redirectTo).toContain('onboarding');
    });

    it('should handle non-admin family user rejection', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';

      const mockResponseData = {
        cannotJoin: true,
        reason: 'Seuls les administrateurs de famille peuvent rejoindre des groupes'
      };

      mockedApi.POST.mockResolvedValue({
        data: { data: mockResponseData },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(result.cannotJoin).toBe(true);
      expect(result.reason).toContain('administrateurs de famille');
    });
  });

  describe('joinGroupWithFamily', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should join group with family successfully using general join endpoint', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';

      const mockResponseData = {
        groupMembership: {
          familyId: 'family-123',
          groupId: 'group-123',
          role: 'MEMBER'
        },
        message: 'Family successfully joined the group'
      };

      mockedApi.POST.mockResolvedValue({
        data: { data: mockResponseData },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.joinGroupWithFamily(groupId, inviteCode);

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        'joinGroupWithFamily: Using join group endpoint as no family-specific join endpoint found'
      );
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/join',
        { body: { inviteCode } }
      );
      expect(result).toEqual(mockResponseData);
    });

    it('should handle authentication errors', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';

      const error = new Error('Authentication required');
      mockedApi.POST.mockRejectedValue(error);

      // Act & Assert
      await expect(
        groupApiService.joinGroupWithFamily(groupId, inviteCode)
      ).rejects.toThrow('Authentication required');

      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/groups/join',
        { body: { inviteCode } }
      );
    });
  });
});