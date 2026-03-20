/**
 * GroupController Hono Tests - Group Schedule Config Endpoints
 *
 * Tests for the GroupScheduleConfig endpoints using the real GroupController
 * with mocked services.
 */

/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { TEST_IDS } from '../../utils/testHelpers';
import { createGroupControllerRoutes, type GroupVariables } from '../v1/GroupController';

// Mock all dependencies BEFORE importing GroupController
jest.mock('../../services/GroupService');
jest.mock('../../services/GroupScheduleConfigService');
jest.mock('../../services/EmailServiceFactory');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { GroupService } from '../../services/GroupService';
import { GroupScheduleConfigService } from '../../services/GroupScheduleConfigService';

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}): Response | Promise<Response> => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: 'Bearer valid-token',
    },
  });
};

describe('GroupController - Group Schedule Config Endpoints', () => {
  let app: Hono<{ Variables: GroupVariables }>;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockScheduleConfigService: jest.Mocked<GroupScheduleConfigService>;
  const mockUserId = TEST_IDS.USER;
  const mockGroupId = TEST_IDS.GROUP;

  // Mock authentication middleware
  const mockAuthMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Access token required' }, 401);
    }

    c.set('userId', mockUserId);
    c.set('user', {
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'UTC',
    });
    await next();
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize app
    app = new Hono<{ Variables: GroupVariables }>();

    // Mock group service methods
    mockGroupService = {
      getGroupById: jest.fn(),
      getUserGroups: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      updateMemberRole: jest.fn(),
      leaveGroup: jest.fn(),
      searchFamilies: jest.fn(),
      inviteFamilyById: jest.fn(),
    } as any;

    // Mock schedule config service methods
    mockScheduleConfigService = {
      getGroupScheduleConfig: jest.fn(),
      updateGroupScheduleConfig: jest.fn(),
      resetGroupScheduleConfig: jest.fn(),
    } as any;

    // Apply mock authentication middleware to all routes
    app.use('/*', mockAuthMiddleware);

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      groupService: mockGroupService,
      scheduleConfigService: mockScheduleConfigService,
    };

    const controllerRoutes = createGroupControllerRoutes(deps);

    // Mount controller routes to the app
    app.route('/', controllerRoutes);
  });

  describe('GET /:groupId/schedule-config', () => {
    it('should return schedule config successfully', async () => {
      const mockConfig = {
        id: 'config_123',
        groupId: mockGroupId,
        scheduleHours: {
          MONDAY: ['08:00', '16:00'],
          TUESDAY: ['08:30', '15:30'],
        },
        group: { id: mockGroupId, name: 'Test Group' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockScheduleConfigService.getGroupScheduleConfig.mockResolvedValue(mockConfig as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config`);

      expect(response.status).toBe(200);
      const data = await responseJson(response);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('config_123');
      expect(data.data.scheduleHours.MONDAY).toEqual(['08:00', '16:00']);
      expect(mockScheduleConfigService.getGroupScheduleConfig).toHaveBeenCalledWith(mockGroupId, mockUserId);
    });

    it('should return empty default config when not found', async () => {
      const mockEmptyConfig = {
        id: null,
        groupId: mockGroupId,
        scheduleHours: {
          MONDAY: [],
          TUESDAY: [],
          WEDNESDAY: [],
          THURSDAY: [],
          FRIDAY: [],
        },
        group: { id: mockGroupId, name: 'Test Group' },
        createdAt: null,
        updatedAt: null,
      };

      mockScheduleConfigService.getGroupScheduleConfig.mockResolvedValue(mockEmptyConfig as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config`);

      expect(response.status).toBe(200);
      const data = await responseJson(response);

      expect(data.success).toBe(true);
      expect(data.data.id).toBeNull();
      expect(data.data.scheduleHours.MONDAY).toEqual([]);
    });

    it('should return 401 if user is not authenticated', async () => {
      const response = await app.request(`/${mockGroupId}/schedule-config`);
      const data = await responseJson(response);

      expect(response.status).toBe(401);
      expect(data).toEqual({ success: false, error: 'Access token required' });
    });
  });

  describe('PUT /:groupId/schedule-config', () => {
    const validUpdateData = {
      scheduleHours: {
        MONDAY: ['08:00', '16:00'],
        TUESDAY: ['08:30', '15:30'],
        WEDNESDAY: [],
        THURSDAY: [],
        FRIDAY: [],
      },
    };

    it('should update schedule config successfully', async () => {
      const mockUpdatedConfig = {
        id: 'config_123',
        groupId: mockGroupId,
        scheduleHours: {
          MONDAY: ['08:00', '16:00'],
          TUESDAY: ['08:30', '15:30'],
          WEDNESDAY: [],
          THURSDAY: [],
          FRIDAY: [],
        },
        group: { id: mockGroupId, name: 'Test Group' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockScheduleConfigService.updateGroupScheduleConfig.mockResolvedValue(mockUpdatedConfig as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);

      expect(data.success).toBe(true);
      expect(data.data.scheduleHours).toEqual(validUpdateData.scheduleHours);
      expect(mockScheduleConfigService.updateGroupScheduleConfig).toHaveBeenCalledWith(
        mockGroupId,
        validUpdateData.scheduleHours,
        mockUserId,
        'UTC',
      );
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        scheduleHours: {
          MONDAY: ['25:00'], // Invalid time format
        },
      };

      mockScheduleConfigService.updateGroupScheduleConfig.mockRejectedValue(
        new Error('Invalid time format'),
      );

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      // Service errors return 500 (internal error) or 400 (validation error from service)
      expect([400, 500]).toContain(response.status);
      const data = await responseJson(response);

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /:groupId/schedule-config/reset', () => {
    it('should reset schedule config to default successfully', async () => {
      const mockDefaultConfig = {
        id: 'config_123',
        groupId: mockGroupId,
        scheduleHours: {
          MONDAY: ['08:00', '09:00', '16:00', '17:00'],
          FRIDAY: ['08:00', '09:00', '16:00', '17:00'],
        },
        group: { id: mockGroupId, name: 'Test Group' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockScheduleConfigService.resetGroupScheduleConfig.mockResolvedValue(mockDefaultConfig as any);

      const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config/reset`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);

      expect(data.success).toBe(true);
      expect(data.data.scheduleHours).toBeDefined();
      expect(mockScheduleConfigService.resetGroupScheduleConfig).toHaveBeenCalledWith(mockGroupId, mockUserId);
    });

    it('should return 401 if user is not authenticated', async () => {
      const response = await app.request(`/${mockGroupId}/schedule-config/reset`, {
        method: 'POST',
      });
      const data = await responseJson(response);

      expect(response.status).toBe(401);
      expect(data).toEqual({ success: false, error: 'Access token required' });
    });
  });

  // =========================================================================
  // Array Response Validation Tests
  // Ensuring arrays are returned as [] instead of null/undefined
  // =========================================================================

  describe('Array Response Validation', () => {
    describe('GET /:groupId/schedule-config', () => {
      it('should return empty arrays for scheduleHours when no time slots configured', async () => {
        // Mock returning schedule with empty hours
        mockScheduleConfigService.getGroupScheduleConfig.mockResolvedValue({
          id: 'config_123',
          groupId: mockGroupId,
          scheduleHours: {}, // Empty object - no hours configured
          group: { id: mockGroupId, name: 'Test Group' },
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        const response = await makeAuthenticatedRequest(app, `/${mockGroupId}/schedule-config`);

        expect(response.status).toBe(200);
        const data = await responseJson(response);

        expect(data.success).toBe(true);

        // All weekday arrays should be empty arrays, not null/undefined
        expect(data.data.scheduleHours.MONDAY).toBeDefined();
        expect(data.data.scheduleHours.MONDAY).toEqual([]);
        expect(Array.isArray(data.data.scheduleHours.MONDAY)).toBe(true);

        expect(data.data.scheduleHours.TUESDAY).toBeDefined();
        expect(Array.isArray(data.data.scheduleHours.TUESDAY)).toBe(true);

        expect(data.data.scheduleHours.WEDNESDAY).toBeDefined();
        expect(Array.isArray(data.data.scheduleHours.WEDNESDAY)).toBe(true);

        expect(data.data.scheduleHours.THURSDAY).toBeDefined();
        expect(Array.isArray(data.data.scheduleHours.THURSDAY)).toBe(true);

        expect(data.data.scheduleHours.FRIDAY).toBeDefined();
        expect(Array.isArray(data.data.scheduleHours.FRIDAY)).toBe(true);
      });
    });
  });
});
