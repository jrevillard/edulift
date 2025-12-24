/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createGroupControllerWithDeps, type GroupVariables } from '../GroupController';
import { GroupService } from '../../services/GroupService';
import { SchedulingService } from '../../services/SchedulingService';
import { TEST_IDS } from '../../utils/testHelpers';

jest.mock('../../services/GroupService');
jest.mock('../../services/SchedulingService');

jest.mock('../../middleware/auth-hono');

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
    },
  });
};

describe('GroupController.updateGroup Test Suite', () => {
  let app: Hono<{ Variables: GroupVariables }>;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockSchedulingService: jest.Mocked<SchedulingService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';
  const mockGroupId = TEST_IDS.GROUP;

  const mockUpdatedGroup = {
    // GroupResponseSchema structure - returned by enrichGroupWithUserContext
    id: 'clgroup12345678901234567890',
    name: 'Updated Group Name',
    description: 'Updated description',
    familyId: TEST_IDS.FAMILY,
    inviteCode: 'ABC123',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    userRole: 'ADMIN', // User's role in the group
    ownerFamily: {
      id: TEST_IDS.FAMILY,
      name: 'Test Family',
    },
    familyCount: 1,
    scheduleCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication middleware to set user context for protected routes
    const { authenticateToken } = require('../../middleware/auth-hono');
    authenticateToken.mockImplementation((c: any, next: any) => {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Access token required' }, 401);
      }

      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
        timezone: 'UTC',
      });
      return next();
    });

    // Mock GroupService
    mockGroupService = {
      validateInvitationCode: jest.fn(),
      validateInvitationCodeWithUser: jest.fn(),
      getUserFamily: jest.fn(),
      createGroup: jest.fn(),
      joinGroupByInviteCode: jest.fn(),
      getUserGroups: jest.fn(),
      getGroupFamilies: jest.fn(),
      updateFamilyRole: jest.fn(),
      removeFamilyFromGroup: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      leaveGroup: jest.fn(),
      searchFamiliesForInvitation: jest.fn(),
      inviteFamilyById: jest.fn(),
      getPendingInvitations: jest.fn(),
      cancelInvitation: jest.fn(),
    } as any;

    // Mock SchedulingService
    mockSchedulingService = {
      getWeeklySchedule: jest.fn(),
    } as any;

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      groupService: mockGroupService,
      schedulingService: mockSchedulingService,
    };

    app = createGroupControllerWithDeps(deps);
  });

  describe('successful updates', () => {
    it('should update group name only', async () => {
      const updateData = { name: 'New Group Name' };
      const updatedGroup = {
        ...mockUpdatedGroup,
        name: 'New Group Name',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { name: 'New Group Name' },
      );
    });

    it('should update group description only', async () => {
      const updateData = { description: 'New description' };
      const updatedGroup = {
        ...mockUpdatedGroup,
        description: 'New description',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { description: 'New description' },
      );
    });

    it('should update both name and description', async () => {
      const updateData = { name: 'New Name', description: 'New description' };
      const updatedGroup = {
        ...mockUpdatedGroup,
        name: 'New Name',
        description: 'New description',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { name: 'New Name', description: 'New description' },
      );
    });

    it('should clear description with empty string', async () => {
      const updateData = { description: '' };
      const updatedGroup = {
        ...mockUpdatedGroup,
        description: '',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { description: '' },
      );
    });

    it('should trim whitespace from inputs', async () => {
      const updateData = { name: '  Trimmed Name  ', description: '  Trimmed description  ' };
      const updatedGroup = {
        ...mockUpdatedGroup,
        name: 'Trimmed Name',
        description: 'Trimmed description',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { name: 'Trimmed Name', description: 'Trimmed description' },
      );
    });
  });

  describe('validation errors', () => {
    it('should return 401 if user is not authenticated', async () => {
      const response = await app.request(`/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toEqual({ error: 'Access token required' });
    });

    it('should return 400 if no update data provided', async () => {
      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
    });

    it('should return 400 if name is empty after trimming', async () => {
      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      expect(result).toEqual({ error: 'No update data provided' });
    });

    it('should return 400 for invalid group ID format', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-group-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });
  });

  describe('service errors', () => {
    it('should handle group not found error', async () => {
      const updateData = { name: 'New Name' };

      const error = new Error('Group not found');
      (error as any).statusCode = 404;
      mockGroupService.updateGroup.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(404);
      const result = await responseJson(response);
      expect(result).toEqual({ error: 'Group not found' });
    });

    it('should handle permission denied error', async () => {
      const updateData = { name: 'New Name' };

      const error = new Error('Only administrators of the owner family can update group settings');
      (error as any).statusCode = 403;
      mockGroupService.updateGroup.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(403);
      const result = await responseJson(response);
      expect(result).toEqual({
        error: 'Only administrators of the owner family can update group settings'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined description correctly', async () => {
      const updateData = { name: 'New Name', description: undefined };
      const updatedGroup = {
        ...mockUpdatedGroup,
        name: 'New Name',
      };

      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      expect(result).toEqual(updatedGroup);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        mockGroupId,
        mockUserId,
        { name: 'New Name' },
      );
    });

    it('should handle null description correctly', async () => {
      const updateData = { name: 'New Name', description: null };

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(500);
      // For malformed JSON, we get a 500 status as it's a server-side parsing error
      // The response might not be parseable as JSON
    });
  });
});