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
        data: { success: true, data: mockResponseData },
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