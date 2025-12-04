import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('GroupApiService - Pending Invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storePendingGroupInvitation', () => {
    it('should store pending group invitation successfully', async () => {
      // Arrange
      const email = 'test@example.com';
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'pending-123',
            email,
            groupId,
            groupName: 'Test Group',
            inviteCode,
            expiresAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          },
          message: 'Pending group invitation stored successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      await apiService.storePendingGroupInvitation(email, groupId, inviteCode);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/groups/pending-invitation',
        { email, groupId, inviteCode }
      );
    });

    it('should throw error when API returns error', async () => {
      // Arrange
      const email = 'test@example.com';
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid invite code'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(
        apiService.storePendingGroupInvitation(email, groupId, inviteCode)
      ).rejects.toThrow('Invalid invite code');
    });
  });

  describe('getPendingGroupInvitationByEmail', () => {
    it('should return pending invitation when found', async () => {
      // Arrange
      const email = 'test@example.com';
      
      const mockInvitation = {
        id: 'pending-123',
        email,
        groupId: 'group-123',
        groupName: 'Test Group',
        inviteCode: 'INVITE123',
        inviterName: 'John Doe',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        group: {
          id: 'group-123',
          name: 'Test Group',
          inviteCode: 'INVITE123'
        }
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockInvitation
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.getPendingGroupInvitationByEmail(email);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/groups/pending-invitation/${encodeURIComponent(email)}`
      );
      expect(result).toEqual(mockInvitation);
    });

    it('should return null when invitation not found (404)', async () => {
      // Arrange
      const email = 'test@example.com';
      
      const mockResponse = {
        data: {
          success: false,
          data: null,
          message: 'No pending group invitation found for this email'
        },
        status: 404
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.getPendingGroupInvitationByEmail(email);

      // Assert
      expect(result).toBeNull();
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

      const mockResponse = {
        data: {
          success: true,
          data: mockFamilies
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.searchFamiliesForInvitation(groupId, searchTerm);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/groups/${groupId}/search-families`,
        { searchTerm }
      );
      expect(result).toEqual(mockFamilies);
    });

    it('should require authentication', async () => {
      // Arrange
      const groupId = 'group-123';
      const searchTerm = 'Martin';
      
      const mockResponse = {
        data: {
          success: false,
          error: 'Authentication required'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(
        apiService.searchFamiliesForInvitation(groupId, searchTerm)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should invite family to group successfully', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';
      const personalMessage = 'Welcome to our group!';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            invitationsSent: 2,
            familyName: 'Target Family',
            groupName: 'Test Group'
          },
          message: 'Family invitation sent successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.inviteFamilyToGroup(groupId, familyId, 'MEMBER', personalMessage);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/groups/${groupId}/invite`,
        { familyId, role: 'MEMBER', personalMessage }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle family already invited error', async () => {
      // Arrange
      const groupId = 'group-123';
      const familyId = 'family-456';
      
      const mockResponse = {
        data: {
          success: false,
          error: 'This family already has a pending invitation to this group'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(
        apiService.inviteFamilyToGroup(groupId, familyId)
      ).rejects.toThrow('This family already has a pending invitation to this group');
    });
  });

  describe('validateGroupInvitationEligibility', () => {
    it('should validate user eligibility for group invitation', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            canJoin: true,
            userFamily: {
              id: 'family-123',
              name: 'User Family'
            },
            groupInfo: {
              id: 'group-123',
              name: 'Test Group'
            }
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/groups/${groupId}/validate-invitation`,
        { inviteCode }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle requires family creation', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            requiresFamilyCreation: true,
            redirectTo: '/onboarding?returnTo=group-invitation&groupId=group-123'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(result.requiresFamilyCreation).toBe(true);
      expect(result.redirectTo).toContain('onboarding');
    });

    it('should handle non-admin family user rejection', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            cannotJoin: true,
            reason: 'Seuls les administrateurs de famille peuvent rejoindre des groupes'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.validateGroupInvitationEligibility(groupId, inviteCode);

      // Assert
      expect(result.cannotJoin).toBe(true);
      expect(result.reason).toContain('administrateurs de famille');
    });
  });

  describe('joinGroupWithFamily', () => {
    it('should join group with family successfully', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            groupMembership: {
              familyId: 'family-123',
              groupId: 'group-123',
              role: 'MEMBER'
            },
            message: 'Family successfully joined the group'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await apiService.joinGroupWithFamily(groupId, inviteCode);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/groups/${groupId}/join-with-family`,
        { inviteCode }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should require authentication', async () => {
      // Arrange
      const groupId = 'group-123';
      const inviteCode = 'INVITE123';
      
      const mockResponse = {
        data: {
          success: false,
          error: 'Authentication required'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(
        apiService.joinGroupWithFamily(groupId, inviteCode)
      ).rejects.toThrow('Authentication required');
    });
  });
});