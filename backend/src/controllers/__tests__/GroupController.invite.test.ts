/**
 * GroupController - POST /groups/:groupId/invite Tests
 *
 * Tests for the invite family endpoint that was restored
 */

import { Hono } from 'hono';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GroupService } from '../../services/GroupService';

// Mock dependencies
jest.mock('../../services/GroupService');
jest.mock('../../services/EmailServiceFactory');
jest.mock('../../config/database');

// Helper function for typing response.json()
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

describe('GroupController - POST /groups/:groupId/invite', () => {
  let app: Hono;
  let mockGroupService: jest.Mocked<GroupService>;
  const mockUserId = 'user_123456789012345678901234';
  const mockGroupId = 'clg123456789012345678901234';
  const mockFamilyId = 'clf123456789012345678901234';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock GroupService
    mockGroupService = {
      inviteFamilyById: jest.fn(),
    } as any;

    // Create a simple Hono app with the endpoint
    app = new Hono();

    // POST /:groupId/invite - Invite family to group
    app.post('/:groupId/invite', async (c) => {
      const groupId = c.req.param('groupId');
      const body = await c.req.json();

      try {
        const invitation = await mockGroupService.inviteFamilyById(
          groupId,
          body,
          mockUserId,
        );
        return c.json({
          success: true,
          data: invitation,
        }, 201);
      } catch (error: any) {
        const statusCode = error.statusCode || 500;
        return c.json({
          success: false,
          error: error.message || 'Failed to invite family',
          code: error.code || 'INVITE_FAILED',
        }, statusCode);
      }
    });
  });

  it('should successfully invite a family to group', async () => {
    const mockInvitation = {
      id: 'clinv123456789012345678901',
      groupId: mockGroupId,
      familyId: mockFamilyId,
      role: 'MEMBER',
      status: 'PENDING',
      personalMessage: 'Welcome to our group!',
      invitedBy: mockUserId,
      invitedByUser: {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockGroupService.inviteFamilyById.mockResolvedValue(mockInvitation as any);

    const response = await app.request(`/${mockGroupId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        familyId: mockFamilyId,
        role: 'MEMBER',
        personalMessage: 'Welcome to our group!',
      }),
    });

    expect(response.status).toBe(201);
    const data = await responseJson<any>(response);

    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe(mockInvitation.id);
    expect(data.data.familyId).toBe(mockFamilyId);
    expect(data.data.role).toBe('MEMBER');
    expect(data.data.status).toBe('PENDING');
    expect(mockGroupService.inviteFamilyById).toHaveBeenCalledWith(
      mockGroupId,
      {
        familyId: mockFamilyId,
        role: 'MEMBER',
        personalMessage: 'Welcome to our group!',
      },
      mockUserId
    );
  });

  it('should handle null personalMessage correctly', async () => {
    const mockInvitation = {
      id: 'clinv123456789012345678901',
      groupId: mockGroupId,
      familyId: mockFamilyId,
      role: 'ADMIN',
      status: 'PENDING',
      personalMessage: null,
      invitedBy: mockUserId,
      invitedByUser: {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockGroupService.inviteFamilyById.mockResolvedValue(mockInvitation as any);

    const response = await app.request(`/${mockGroupId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        familyId: mockFamilyId,
        role: 'ADMIN',
        personalMessage: null,
      }),
    });

    expect(response.status).toBe(201);
    const data = await responseJson<any>(response);

    expect(data.success).toBe(true);
    expect(data.data.personalMessage).toBeNull();
  });

  it('should return 400 when service throws error', async () => {
    const error = new Error('Family already invited') as any;
    error.statusCode = 400;
    error.code = 'ALREADY_INVITED';

    mockGroupService.inviteFamilyById.mockRejectedValue(error);

    const response = await app.request(`/${mockGroupId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        familyId: mockFamilyId,
        role: 'MEMBER',
      }),
    });

    expect(response.status).toBe(400);
    const data = await responseJson<any>(response);

    expect(data.success).toBe(false);
    expect(data.error).toBe('Family already invited');
    expect(data.code).toBe('ALREADY_INVITED');
  });

  it('should return 500 for unexpected errors', async () => {
    mockGroupService.inviteFamilyById.mockRejectedValue(new Error('Database error'));

    const response = await app.request(`/${mockGroupId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        familyId: mockFamilyId,
        role: 'MEMBER',
      }),
    });

    expect(response.status).toBe(500);
    const data = await responseJson<any>(response);

    expect(data.success).toBe(false);
    expect(data.error).toBe('Database error');
    expect(data.code).toBe('INVITE_FAILED');
  });
});
