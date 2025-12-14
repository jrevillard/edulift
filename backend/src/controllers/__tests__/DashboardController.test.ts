import { Request, Response } from 'express';
import { DashboardController } from '../DashboardController';
import { CapacityStatus } from '../../types/DashboardTypes';
import { TEST_IDS } from '../../utils/testHelpers';

// Mock the DashboardService module
jest.mock('../../services/DashboardService', () => ({
  DashboardService: jest.fn().mockImplementation(() => ({
    calculateUserStats: jest.fn(),
    getTodayTripsForUser: jest.fn(),
    getRecentActivityForUser: jest.fn(),
    getRecentActivityForFamily: jest.fn(),
    getUserWithFamily: jest.fn(),
    getWeeklyDashboard: jest.fn(),
    getUserFamilyId: jest.fn(),
  })),
}));

describe('DashboardController', () => {
  let dashboardController: DashboardController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockDashboardService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    dashboardController = new DashboardController();
    mockDashboardService = dashboardController['dashboardService'] as any;

    // Mock Express request/response
    mockRequest = {
      user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User' },
      params: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return user dashboard statistics successfully', async () => {
      // Arrange
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

      // Act
      await dashboardController.getStats(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardService.calculateUserStats).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should handle errors when calculating stats fails', async () => {
      // Arrange
      const errorMessage = 'Database connection failed';
      mockDashboardService.calculateUserStats.mockRejectedValue(new Error(errorMessage));

      // Act
      await dashboardController.getStats(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: errorMessage,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await dashboardController.getStats(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });
  });

  describe('getTodaySchedule', () => {
    it('should return today\'s schedule for the user', async () => {
      // Arrange
      const mockTodayTrips = [
        {
          id: TEST_IDS.TRIP,
          time: '08:00',
          datetime: '2024-01-15T08:00:00.000Z',
          date: 'Today',
          children: [{ id: TEST_IDS.CHILD, name: 'Emma' }],
          vehicle: { id: TEST_IDS.VEHICLE, name: 'Honda Civic', capacity: 4 },
          driver: { id: TEST_IDS.USER_2, name: 'John Doe' },
          group: { id: TEST_IDS.GROUP, name: 'Maple Street Families' },
        },
        {
          id: TEST_IDS.TRIP_2,
          time: '15:30',
          datetime: '2024-01-15T15:30:00.000Z',
          date: 'Today',
          children: [{ id: TEST_IDS.CHILD, name: 'Emma' }],
          vehicle: { id: TEST_IDS.VEHICLE, name: 'Honda Civic', capacity: 4 },
          driver: { id: TEST_IDS.USER_3, name: 'Jane Smith' },
          group: { id: TEST_IDS.GROUP, name: 'Maple Street Families' },
        },
      ];

      mockDashboardService.getTodayTripsForUser.mockResolvedValue(mockTodayTrips);

      // Act
      await dashboardController.getTodaySchedule(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardService.getTodayTripsForUser).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { upcomingTrips: mockTodayTrips },
      });
    });

    it('should return empty array when no trips for today', async () => {
      // Arrange
      mockDashboardService.getTodayTripsForUser.mockResolvedValue([]);

      // Act
      await dashboardController.getTodaySchedule(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { upcomingTrips: [] },
      });
    });

    it('should handle errors when fetching today\'s schedule fails', async () => {
      // Arrange
      const errorMessage = 'Schedule fetch failed';
      mockDashboardService.getTodayTripsForUser.mockRejectedValue(new Error(errorMessage));

      // Act
      await dashboardController.getTodaySchedule(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: errorMessage,
      });
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity for the user', async () => {
      // Arrange
      const mockActivities = [
        {
          id: TEST_IDS.SLOT, // Using a valid CUID from TEST_IDS
          action: 'Joined group "Maple Street Families"',
          time: '2 hours ago',
          timestamp: '2024-01-15T10:00:00.000Z', // ISO string for schema validation
          type: 'group' as const,
          entityId: TEST_IDS.GROUP,
          entityName: 'Maple Street Families',
        },
        {
          id: TEST_IDS.SLOT_2, // Using a valid CUID from TEST_IDS
          action: 'Added vehicle Honda Civic',
          time: '1 day ago',
          timestamp: '2024-01-14T09:00:00.000Z', // ISO string for schema validation
          type: 'vehicle' as const,
          entityId: TEST_IDS.VEHICLE,
          entityName: 'Honda Civic',
        },
      ];

      // Mock getUserWithFamily to return user with family
      mockDashboardService.getUserWithFamily.mockResolvedValue({
        id: TEST_IDS.USER,
        familyMemberships: [{ familyId: TEST_IDS.FAMILY }],
      } as any);

      mockDashboardService.getRecentActivityForFamily.mockResolvedValue(mockActivities);

      // Act
      try {
        await dashboardController.getRecentActivity(mockRequest as any, mockResponse as any);
      } catch (error) {
        console.log('ERROR in getRecentActivity:', (error as Error).message);
        throw error;
      }

      // Assert
      expect(mockDashboardService.getUserWithFamily).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockDashboardService.getRecentActivityForFamily).toHaveBeenCalledWith(TEST_IDS.FAMILY);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { activities: mockActivities },
      });
    });

    it('should return empty array when no recent activity', async () => {
      // Arrange
      // Mock getUserWithFamily to return user without family
      mockDashboardService.getUserWithFamily.mockResolvedValue({
        id: TEST_IDS.USER,
        familyMemberships: [],
      } as any);
      
      mockDashboardService.getRecentActivityForUser.mockResolvedValue([]);

      // Act
      await dashboardController.getRecentActivity(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardService.getUserWithFamily).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockDashboardService.getRecentActivityForUser).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { activities: [] },
      });
    });

    it('should handle errors when fetching recent activity fails', async () => {
      // Arrange
      const errorMessage = 'Activity fetch failed';
      mockDashboardService.getUserWithFamily.mockRejectedValue(new Error(errorMessage));

      // Act
      await dashboardController.getRecentActivity(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: errorMessage,
      });
    });
  });

  describe('getWeeklyDashboard', () => {
    it('should return weekly dashboard with new group identification fields', async () => {
      // Arrange
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
                  overallCapacityStatus: 'available' as CapacityStatus,
                  vehicleAssignmentSummaries: [
                    {
                      vehicleId: TEST_IDS.VEHICLE,
                      vehicleName: 'Honda Civic',
                      vehicleCapacity: 4,
                      assignedChildrenCount: 2,
                      availableSeats: 2,
                      capacityStatus: 'available' as CapacityStatus,
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

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardService.getUserFamilyId.mockResolvedValue(TEST_IDS.FAMILY);
      mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardService.getUserFamilyId).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockDashboardService.getWeeklyDashboard).toHaveBeenCalledWith(TEST_IDS.USER, undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockWeeklyDashboard.data,
      });
    });

    it('should handle weekly dashboard with start date parameter', async () => {
      // Arrange
      const startDate = new Date('2024-01-15T00:00:00Z');
      const mockRequestWithDate = {
        ...mockRequest,
        query: { startDate: '2024-01-15' },
      };

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

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardService.getUserFamilyId.mockResolvedValue(TEST_IDS.FAMILY);
      mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequestWithDate as any, mockResponse as any);

      // Assert
      expect(mockDashboardService.getUserFamilyId).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockDashboardService.getWeeklyDashboard).toHaveBeenCalledWith(TEST_IDS.USER, startDate);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle null group in weekly dashboard', async () => {
      // Arrange
      const mockWeeklyDashboard = {
        success: true,
        data: {
          days: [
            {
              date: '2024-01-15',
              transports: [
                {
                  time: '08:00',
                  groupId: TEST_IDS.GROUP_2, // Valid CUID instead of empty string
                  groupName: 'Unknown Group',
                  scheduleSlotId: TEST_IDS.SLOT,
                  totalChildrenAssigned: 0,
                  totalCapacity: 4,
                  overallCapacityStatus: 'available' as CapacityStatus,
                  vehicleAssignmentSummaries: [],
                },
              ],
              totalChildrenInVehicles: 0,
              totalVehiclesWithAssignments: 0,
              hasScheduledTransports: true,
            },
          ],
          startDate: '2024-01-15',
          endDate: '2024-01-21',
          generatedAt: '2024-01-15T12:00:00.000Z',
          metadata: {
            familyId: TEST_IDS.FAMILY,
            familyName: 'Doe Family',
            totalGroups: 0,
            totalChildren: 0,
          },
        },
      };

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardService.getUserFamilyId.mockResolvedValue(TEST_IDS.FAMILY);
      mockDashboardService.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0].data;
      expect(responseData.days[0].transports[0].groupId).toBe(TEST_IDS.GROUP_2);
      expect(responseData.days[0].transports[0].groupName).toBe('Unknown Group');
    });

    it('should return error when weekly dashboard fails', async () => {
      // Arrange
      // Mock getUserFamilyId to return null (no family)
      mockDashboardService.getUserFamilyId.mockResolvedValue(null);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No family associated with user',
      });
    });

    it('should handle service errors when fetching weekly dashboard', async () => {
      // Arrange
      const errorMessage = 'Database connection failed';
      // Mock getUserFamilyId to return a valid family ID
      mockDashboardService.getUserFamilyId.mockResolvedValue(TEST_IDS.FAMILY);
      mockDashboardService.getWeeklyDashboard.mockRejectedValue(new Error(errorMessage));

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should return 401 if user is not authenticated for weekly dashboard', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });
  });
});