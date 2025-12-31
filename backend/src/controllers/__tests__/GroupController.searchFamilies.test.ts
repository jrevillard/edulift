/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createGroupControllerRoutes, type GroupVariables } from '../GroupController';
import { GroupService } from '../../services/GroupService';
import { SchedulingService } from '../../services/SchedulingService';
import { TEST_IDS } from '../../utils/testHelpers';

jest.mock('../../services/GroupService');
jest.mock('../../services/SchedulingService');
jest.mock('../../middleware/auth-hono');

// Helper function to parse response JSON for testing
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
  });
};

describe('GroupController.searchFamiliesForInvitation Test Suite', () => {
  let app: Hono<{ Variables: GroupVariables }>;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockSchedulingService: jest.Mocked<SchedulingService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';
  const mockGroupId = TEST_IDS.GROUP;

  const mockFamilyResults = [
    {
      id: TEST_IDS.FAMILY,
      name: 'Smith Family',
      adminContacts: [
        { name: 'John Smith', email: 'john.smith@example.com' },
        { name: 'Jane Smith', email: 'jane.smith@example.com' },
      ],
      memberCount: 4,
      canInvite: true,
    },
    {
      id: 'clfamily456789012345678901234',
      name: 'Johnson Family',
      adminContacts: [
        { name: 'Bob Johnson', email: 'bob.johnson@example.com' },
      ],
      memberCount: 3,
      canInvite: false, // Already has pending invitation
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

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

    // Create a wrapper app with auth middleware before the controller routes
    const wrapperApp = new Hono<{ Variables: GroupVariables }>();

    // Add middleware to simulate authenticated requests
    wrapperApp.use('*', async (c, next) => {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({
          success: false,
          error: 'Access token required',
          code: 'UNAUTHORIZED'
        } as const, 401);
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

    // Mount the controller routes
    const controllerApp = createGroupControllerRoutes(deps);
    wrapperApp.route('/', controllerApp);

    app = wrapperApp;
  });

  describe('POST /groups/:groupId/search-families - Success Cases', () => {
    it('should successfully search families for invitation', async () => {
      mockGroupService.searchFamiliesForInvitation.mockResolvedValue(mockFamilyResults);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smith' }),
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; data: any[] }>(response);

      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockFamilyResults);
      expect(mockGroupService.searchFamiliesForInvitation).toHaveBeenCalledWith(
        'Smith',
        mockUserId,
        mockGroupId
      );
    });

    it('should return empty array when no families found', async () => {
      mockGroupService.searchFamiliesForInvitation.mockResolvedValue([]);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'NonExistentFamily' }),
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; data: any[] }>(response);

      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should handle partial search terms correctly', async () => {
      mockGroupService.searchFamiliesForInvitation.mockResolvedValue([mockFamilyResults[0]]);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smi' }),
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; data: any[] }>(response);

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('Smith Family');
    });
  });

  describe('POST /groups/:groupId/search-families - Error Cases', () => {
    it('should return 400 when searchTerm is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);

      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(mockGroupService.searchFamiliesForInvitation).not.toHaveBeenCalled();
    });

    it('should return 400 when searchTerm is empty string', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: '' }),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);

      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 403 when user is not group admin', async () => {
      const error = new Error('User is not a group admin');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN';
      mockGroupService.searchFamiliesForInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smith' }),
        }
      );

      expect(response.status).toBe(403);
      const json = await responseJson<{ success: boolean; error: string; code?: string }>(response);

      expect(json.success).toBe(false);
      expect(json.error).toBe('User is not a group admin');
      expect(json.code).toBe('FORBIDDEN');
    });

    it('should return 404 when group does not exist', async () => {
      const error = new Error('Group not found');
      (error as any).statusCode = 404;
      (error as any).code = 'GROUP_NOT_FOUND';
      mockGroupService.searchFamiliesForInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smith' }),
        }
      );

      expect(response.status).toBe(404);
      const json = await responseJson<{ success: boolean; error: string; code?: string }>(response);

      expect(json.success).toBe(false);
      expect(json.error).toBe('Group not found');
      expect(json.code).toBe('GROUP_NOT_FOUND');
    });

    it('should return 500 on service error', async () => {
      const error = new Error('Database connection failed');
      mockGroupService.searchFamiliesForInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smith' }),
        }
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code?: string }>(response);

      expect(json.success).toBe(false);
      // The controller returns the original error message when statusCode is not set
      expect(json.error).toBe('Database connection failed');
      expect(json.code).toBe('SEARCH_FAILED');
    });
  });

  describe('POST /groups/:groupId/search-families - Response Format', () => {
    it('should return correct response structure with canInvite field', async () => {
      mockGroupService.searchFamiliesForInvitation.mockResolvedValue(mockFamilyResults);

      const response = await makeAuthenticatedRequest(
        app,
        `/${mockGroupId}/search-families`,
        {
          method: 'POST',
          body: JSON.stringify({ searchTerm: 'Smith' }),
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{
        success: boolean;
        data: Array<{
          id: string;
          name: string;
          adminContacts: Array<{ name: string; email: string }>;
          memberCount: number;
          canInvite: boolean;
        }>;
      }>(response);

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);

      // Check first family (canInvite = true)
      expect(json.data[0].id).toBe(TEST_IDS.FAMILY);
      expect(json.data[0].name).toBe('Smith Family');
      expect(json.data[0].adminContacts).toHaveLength(2);
      expect(json.data[0].adminContacts[0].name).toBe('John Smith');
      expect(json.data[0].adminContacts[0].email).toBe('john.smith@example.com');
      expect(json.data[0].memberCount).toBe(4);
      expect(json.data[0].canInvite).toBe(true);

      // Check second family (canInvite = false)
      expect(json.data[1].id).toBe('clfamily456789012345678901234');
      expect(json.data[1].name).toBe('Johnson Family');
      expect(json.data[1].adminContacts).toHaveLength(1);
      expect(json.data[1].memberCount).toBe(3);
      expect(json.data[1].canInvite).toBe(false);
    });
  });
});
