/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { TEST_IDS } from '../../utils/testHelpers';
import { createDashboardControllerRoutes, type DashboardVariables } from '../v1/DashboardController';

// Mock all dependencies BEFORE importing DashboardController
jest.mock('../../services/DashboardService');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { DashboardService } from '../../services/DashboardService';

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

describe('DashboardController Test Suite', () => {
  let app: Hono<{ Variables: DashboardVariables }>;
  let mockDashboardService: jest.Mocked<DashboardService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

  // Mock authentication middleware
  const mockAuthMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Access token required' }, 401);
    }

    c.set('userId', mockUserId);
    c.set('user', {
      id: mockUserId,
      email: mockUserEmail,
      name: 'Test User',
      timezone: 'UTC',
    });
    await next();
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize app
    app = new Hono<{ Variables: DashboardVariables }>();

    // Mock dashboard service methods
    mockDashboardService = {
      calculateUserStats: jest.fn(),
      getTodayTripsForUser: jest.fn(),
      getRecentActivityForUser: jest.fn(),
      getRecentActivityForFamily: jest.fn(),
      getUserWithFamily: jest.fn(),
      getWeeklyDashboard: jest.fn(),
      getUserFamilyId: jest.fn(),
    } as any;

    // Apply mock authentication middleware to all routes
    app.use('/*', mockAuthMiddleware);

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      dashboardService: mockDashboardService,
    };

    const controllerRoutes = createDashboardControllerRoutes(deps);

    // Mount controller routes to the app
    app.route('/', controllerRoutes);
  });

  describe('GET /dashboard/stats', () => {
    it('should return user dashboard statistics successfully', async () => {
      const mockStats = {
        groups: 2,
        children: 3,
        vehicles: 1,
        thisWeekTrips: 8,
        trends: {
          groups: { value: '+12%', direction: 'up' as const, period: 'vs last week' },
          children: { value: 'New', direction: 'up' as const, period: 'this week' },
          vehicles: { value: '+1', direction: 'up' as const, period: 'this month' },
          trips: { value: '+25%', direction: 'up' as const, period: 'vs last week' },
        },
      };

      mockDashboardService.calculateUserStats.mockResolvedValue(mockStats);

      const response = await makeAuthenticatedRequest(app, '/stats');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: mockStats,
      });
      expect(mockDashboardService.calculateUserStats).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle errors when calculating stats fails', async () => {
      mockDashboardService.calculateUserStats.mockRejectedValue(new Error('Database connection failed'));

      const response = await makeAuthenticatedRequest(app, '/stats');
      const data = await responseJson(response);

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve dashboard statistics',
        code: 'STATS_RETRIEVAL_FAILED',
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      const response = await app.request('/stats');
      const data = await responseJson(response);

      expect(response.status).toBe(401);
      expect(data).toEqual({ success: false, error: 'Access token required' });
    });
  });

  describe('GET /today-schedule', () => {
    it('should return today schedule for the user', async () => {
      const mockTodayTrips = [
        {
          id: TEST_IDS.TRIP,
          time: '08:00',
          datetime: '2024-01-15T08:00:00.000Z',
          date: 'Today',
          children: [{ id: TEST_IDS.CHILD, name: 'Emma' }],
          vehicle: { id: TEST_IDS.VEHICLE, name: 'Honda Civic', capacity: 4, familyId: TEST_IDS.FAMILY },
          driver: { id: TEST_IDS.USER_2, name: 'John Doe' },
          group: { id: TEST_IDS.GROUP, name: 'Maple Street Families' },
        },
        {
          id: TEST_IDS.TRIP_2,
          time: '15:30',
          datetime: '2024-01-15T15:30:00.000Z',
          date: 'Today',
          children: [{ id: TEST_IDS.CHILD, name: 'Emma' }],
          vehicle: { id: TEST_IDS.VEHICLE, name: 'Honda Civic', capacity: 4, familyId: TEST_IDS.FAMILY },
          driver: { id: TEST_IDS.USER_3, name: 'Jane Smith' },
          group: { id: TEST_IDS.GROUP, name: 'Maple Street Families' },
        },
      ];

      mockDashboardService.getTodayTripsForUser.mockResolvedValue(mockTodayTrips);

      const response = await makeAuthenticatedRequest(app, '/today-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: { upcomingTrips: mockTodayTrips },
      });
      expect(mockDashboardService.getTodayTripsForUser).toHaveBeenCalledWith(mockUserId, 'UTC');
    });

    it('should return empty array when no trips for today', async () => {
      mockDashboardService.getTodayTripsForUser.mockResolvedValue([]);

      const response = await makeAuthenticatedRequest(app, '/today-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: { upcomingTrips: [] },
      });
    });

    it('should handle errors when fetching today schedule fails', async () => {
      mockDashboardService.getTodayTripsForUser.mockRejectedValue(new Error('Schedule fetch failed'));

      const response = await makeAuthenticatedRequest(app, '/today-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve today\'s schedule',
        code: 'SCHEDULE_RETRIEVAL_FAILED',
      });
    });
  });

  describe('GET /recent-activity', () => {
    it('should return recent activity for the user with family', async () => {
      const mockActivities = [
        {
          id: TEST_IDS.SLOT,
          action: 'Joined group "Maple Street Families"',
          time: '2 hours ago',
          timestamp: new Date('2024-01-15T10:00:00.000Z'),
          type: 'group' as const,
          entityId: TEST_IDS.GROUP,
          entityName: 'Maple Street Families',
        },
        {
          id: TEST_IDS.SLOT_2,
          action: 'Added vehicle Honda Civic',
          time: '1 day ago',
          timestamp: new Date('2024-01-14T09:00:00.000Z'),
          type: 'vehicle' as const,
          entityId: TEST_IDS.VEHICLE,
          entityName: 'Honda Civic',
        },
      ];

      mockDashboardService.getUserWithFamily.mockResolvedValue({
        id: TEST_IDS.USER,
        familyMemberships: [{ familyId: TEST_IDS.FAMILY }],
      } as any);

      mockDashboardService.getRecentActivityForFamily.mockResolvedValue(mockActivities);

      const response = await makeAuthenticatedRequest(app, '/recent-activity');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toBeDefined();
      expect(mockDashboardService.getUserWithFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockDashboardService.getRecentActivityForFamily).toHaveBeenCalledWith(TEST_IDS.FAMILY);
    });

    it('should return recent activity for user without family', async () => {
      const mockActivities = [
        {
          id: TEST_IDS.SLOT,
          action: 'Created account',
          time: '1 hour ago',
          timestamp: new Date('2024-01-15T11:00:00.000Z'),
          type: 'group' as const,
          entityId: TEST_IDS.USER,
          entityName: 'Test User',
        },
      ];

      mockDashboardService.getUserWithFamily.mockResolvedValue({
        id: TEST_IDS.USER,
        familyMemberships: [],
      } as any);

      mockDashboardService.getRecentActivityForUser.mockResolvedValue(mockActivities);

      const response = await makeAuthenticatedRequest(app, '/recent-activity');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toBeDefined();
      expect(mockDashboardService.getUserWithFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockDashboardService.getRecentActivityForUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle errors when fetching recent activity fails', async () => {
      mockDashboardService.getUserWithFamily.mockRejectedValue(new Error('Activity fetch failed'));

      const response = await makeAuthenticatedRequest(app, '/recent-activity');
      const data = await responseJson(response);

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve recent activity',
        code: 'ACTIVITY_RETRIEVAL_FAILED',
      });
    });
  });

  describe('GET /7day-schedule', () => {
    it('should return weekly dashboard successfully', async () => {
      const mockWeeklyDashboard = {
        success: true,
        data: {
          days: [
            {
              date: '2024-01-15',
              transports: [
                {
                  time: '08:00',
                  groupId: TEST_IDS.GROUP,
                  groupName: 'Maple Street Families',
                  scheduleSlotId: TEST_IDS.SLOT,
                  totalChildrenAssigned: 3,
                  totalCapacity: 8,
                  overallCapacityStatus: 'available' as const,
                  vehicleAssignmentSummaries: [
                    {
                      vehicleId: TEST_IDS.VEHICLE,
                      vehicleName: 'Honda Civic',
                      vehicleCapacity: 4,
                      assignedChildrenCount: 2,
                      availableSeats: 2,
                      capacityStatus: 'available' as const,
                      vehicleFamilyId: TEST_IDS.FAMILY,
                      isFamilyVehicle: true,
                      driver: {
                        id: TEST_IDS.USER,
                        name: 'John Doe',
                      },
                      children: [
                        {
                          childId: TEST_IDS.CHILD,
                          childName: 'Emma',
                          childFamilyId: TEST_IDS.FAMILY,
                          isFamilyChild: true,
                        },
                      ],
                    },
                  ],
                },
              ],
              totalChildrenInVehicles: 3,
              totalVehiclesWithAssignments: 1,
              hasScheduledTransports: true,
            },
          ],
          startDate: '2024-01-15',
          endDate: '2024-01-21',
          generatedAt: '2024-01-15T12:00:00.000Z',
          metadata: {
            familyId: TEST_IDS.FAMILY,
            familyName: 'Doe Family',
            totalGroups: 2,
            totalChildren: 3,
          },
        },
      };

      mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      const response = await makeAuthenticatedRequest(app, '/7day-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(mockDashboardService.getWeeklyDashboard).toHaveBeenCalledWith(mockUserId, undefined, 'UTC');
    });

    it('should handle weekly dashboard with start date parameter', async () => {
      const startDate = '2024-01-15T00:00:00.000Z';
      const mockWeeklyDashboard = {
        success: true,
        data: {
          days: [],
          startDate: '2024-01-15',
          endDate: '2024-01-21',
          generatedAt: '2024-01-15T12:00:00.000Z',
          metadata: {
            familyId: TEST_IDS.FAMILY,
            familyName: 'Doe Family',
            totalGroups: 1,
            totalChildren: 0,
          },
        },
      };

      mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      const response = await makeAuthenticatedRequest(app, `/7day-schedule?startDate=${startDate}`);
      const data = await responseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDashboardService.getWeeklyDashboard).toHaveBeenCalledWith(mockUserId, new Date(startDate), 'UTC');
    });

    it('should return error when user has no family', async () => {
      const errorResponse = {
        success: false,
        error: 'User has no family',
        statusCode: 401,
      };

      mockDashboardService.getWeeklyDashboard.mockResolvedValue(errorResponse);

      const response = await makeAuthenticatedRequest(app, '/7day-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(401);
      expect(data).toEqual({
        success: false,
        error: 'User has no family',
        code: 'WEEKLY_DASHBOARD_FAILED',
      });
    });

    it('should handle service errors when fetching weekly dashboard', async () => {
      mockDashboardService.getWeeklyDashboard.mockRejectedValue(new Error('Database connection failed'));

      const response = await makeAuthenticatedRequest(app, '/7day-schedule');
      const data = await responseJson(response);

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve weekly dashboard',
        code: 'WEEKLY_DASHBOARD_FAILED',
      });
    });
  });

  // =========================================================================
  // Array Response Validation Tests
  // Ensuring arrays are returned as [] instead of null/undefined
  // =========================================================================

  describe('Array Response Validation', () => {
    describe('GET /7day-schedule', () => {
      it('should return empty arrays for user with no schedule data', async () => {
        const mockEmptyWeeklyData = {
          success: true,
          data: {
            startDate: '2025-01-06',
            endDate: '2025-01-12',
            days: [], // Empty array
            metadata: {
              totalGroups: 0,
              totalChildren: 0,
            },
          },
        };

        mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockEmptyWeeklyData as any);

        const response = await makeAuthenticatedRequest(app, '/7day-schedule?startDate=2025-01-06T00:00:00.000Z');

        expect(response.status).toBe(200);
        const data = await responseJson(response);

        expect(data.success).toBe(true);
        expect(data.data.dailySchedules).toBeDefined();
        expect(data.data.dailySchedules).toEqual([]);
        expect(Array.isArray(data.data.dailySchedules)).toBe(true);
        expect(data.data.dailySchedules).not.toBeNull();
        expect(data.data.dailySchedules).not.toBeUndefined();
      });
    });

    describe('GET /today-schedule', () => {
      it('should return empty arrays for user with no trips', async () => {
        // Mock returning empty array for today's trips
        mockDashboardService.getTodayTripsForUser.mockResolvedValue([]);

        const response = await makeAuthenticatedRequest(app, '/today-schedule');

        expect(response.status).toBe(200);
        const data = await responseJson(response);

        expect(data.success).toBe(true);
        expect(data.data.upcomingTrips).toBeDefined();
        expect(data.data.upcomingTrips).toEqual([]);
        expect(Array.isArray(data.data.upcomingTrips)).toBe(true);
        expect(data.data.upcomingTrips).not.toBeNull();
        expect(data.data.upcomingTrips).not.toBeUndefined();
      });
    });

    describe('GET /recent-activity', () => {
      it('should return empty arrays for user with no activity', async () => {
        // Mock returning empty array for activity
        mockDashboardService.getRecentActivityForUser.mockResolvedValue([]);

        const response = await makeAuthenticatedRequest(app, '/recent-activity');

        expect(response.status).toBe(200);
        const data = await responseJson(response);

        expect(data.success).toBe(true);
        expect(data.data.activities).toBeDefined();
        expect(data.data.activities).toEqual([]);
        expect(Array.isArray(data.data.activities)).toBe(true);
        expect(data.data.activities).not.toBeNull();
        expect(data.data.activities).not.toBeUndefined();
      });
    });
  });
});
