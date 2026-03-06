import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groupApiService } from '../groupApiService';
import { api } from '../api';

// Mock the OpenAPI client
vi.mock('../api');
const mockedApi = vi.mocked(api);

describe('GroupApiService - Restored Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchFamiliesForInvitation', () => {
    it('should search families successfully', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';

      const mockFamilies = [
        {
          id: 'family-1',
          name: 'Famille Martin',
          adminContacts: [{ name: 'Pierre Martin', email: 'pierre@martin.com' }],
          memberCount: 4,
          canInvite: true,
        },
        {
          id: 'family-2',
          name: 'Famille Martin-Dupont',
          adminContacts: [{ name: 'Sophie Martin', email: 'sophie@martin.fr' }],
          memberCount: 3,
          canInvite: true,
        }
      ];

      mockedApi.POST.mockResolvedValue({
        data: { success: true, data: mockFamilies },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.searchFamiliesForInvitation(groupId, searchTerm);

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/api/v1/groups/{groupId}/search-families',
        {
          params: { path: { groupId } },
          body: { searchTerm }
        }
      );
      expect(result).toEqual(mockFamilies);
    });

    it('should throw error when API call fails', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';

      const error = new Error('API Error');
      mockedApi.POST.mockRejectedValue(error);

      // Act & Assert
      await expect(
        groupApiService.searchFamiliesForInvitation(groupId, searchTerm)
      ).rejects.toThrow('API Error');
    });

    it('should throw error when API returns error', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';

      mockedApi.POST.mockResolvedValue({
        data: { success: false, error: 'Search failed' },
        error: undefined,
        response: new Response()
      });

      // Act & Assert
      await expect(
        groupApiService.searchFamiliesForInvitation(groupId, searchTerm)
      ).rejects.toThrow('Failed to search families');
    });

    it('should return empty array when no families found', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'NonExistent';

      mockedApi.POST.mockResolvedValue({
        data: { success: true, data: [] },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.searchFamiliesForInvitation(groupId, searchTerm);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should invite family successfully', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';
      const role = 'MEMBER';
      const personalMessage = 'Welcome to our group!';

      const mockResponse = {
        invitation: {
          id: 'inv-789',
          groupId: 'group-123',
          familyId: 'family-456',
          role: 'MEMBER',
          personalMessage: 'Welcome to our group!',
          status: 'PENDING',
          createdAt: '2024-01-01T00:00:00Z'
        },
        message: 'Family invitation sent successfully'
      };

      mockedApi.POST.mockResolvedValue({
        data: { success: true, data: mockResponse },
        error: undefined,
        response: new Response()
      });

      // Act
      const result = await groupApiService.inviteFamilyToGroup(groupId, familyId, role, personalMessage);

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/api/v1/groups/{groupId}/invite',
        {
          params: { path: { groupId } },
          body: { familyId, role, personalMessage }
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should invite family with default role when role is not specified', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';

      mockedApi.POST.mockResolvedValue({
        data: { success: true, data: { message: 'Invitation sent' } },
        error: undefined,
        response: new Response()
      });

      // Act
      await groupApiService.inviteFamilyToGroup(groupId, familyId, 'MEMBER');

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/api/v1/groups/{groupId}/invite',
        {
          params: { path: { groupId } },
          body: { familyId, role: 'MEMBER', personalMessage: undefined }
        }
      );
    });

    it('should invite family as ADMIN when specified', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';

      mockedApi.POST.mockResolvedValue({
        data: { success: true, data: { message: 'Invitation sent' } },
        error: undefined,
        response: new Response()
      });

      // Act
      await groupApiService.inviteFamilyToGroup(groupId, familyId, 'ADMIN');

      // Assert
      expect(mockedApi.POST).toHaveBeenCalledWith(
        '/api/v1/groups/{groupId}/invite',
        {
          params: { path: { groupId } },
          body: { familyId, role: 'ADMIN', personalMessage: undefined }
        }
      );
    });

    it('should throw error when API call fails', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';

      const error = new Error('Network Error');
      mockedApi.POST.mockRejectedValue(error);

      // Act & Assert
      await expect(
        groupApiService.inviteFamilyToGroup(groupId, familyId, 'MEMBER')
      ).rejects.toThrow('Network Error');
    });

    it('should throw error when API returns error', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';

      mockedApi.POST.mockResolvedValue({
        data: { success: false, error: 'Invitation failed' },
        error: undefined,
        response: new Response()
      });

      // Act & Assert
      await expect(
        groupApiService.inviteFamilyToGroup(groupId, familyId, 'MEMBER')
      ).rejects.toThrow('Failed to invite family to group');
    });
  });
});