import { Request, Response } from 'express';
import { DashboardController } from '../DashboardController';
import { DashboardService } from '../../services/DashboardService';
import { CapacityStatus } from '../../types/DashboardTypes';

// Mock the DashboardService
jest.mock('../../services/DashboardService');
const mockDashboardService = DashboardService as jest.MockedClass<typeof DashboardService>;

describe('DashboardController', () => {
  let dashboardController: DashboardController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockDashboardServiceInstance: jest.Mocked<DashboardService>;

  beforeEach(() => {
    // Create mock service instance
    mockDashboardServiceInstance = {
      calculateUserStats: jest.fn(),
      getTodayTripsForUser: jest.fn(),
      getRecentActivityForUser: jest.fn(),
      getRecentActivityForFamily: jest.fn(),
      getUserWithFamily: jest.fn(),
      getWeeklyDashboard: jest.fn(),
      getUserFamilyId: jest.fn(),
    } as any;

    // Mock the constructor to return our mock instance
    mockDashboardService.mockImplementation(() => mockDashboardServiceInstance);

    dashboardController = new DashboardController();

    // Mock Express request/response
    mockRequest = {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
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

      mockDashboardServiceInstance.calculateUserStats.mockResolvedValue(mockStats);

      // Act
      await dashboardController.getStats(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.calculateUserStats).toHaveBeenCalledWith('user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should handle errors when calculating stats fails', async () => {
      // Arrange
      const errorMessage = 'Database connection failed';
      mockDashboardServiceInstance.calculateUserStats.mockRejectedValue(new Error(errorMessage));

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
          id: 'trip-1',
          time: '08:00',
          datetime: '2024-01-15T08:00:00.000Z',
          date: 'Today',
          children: [{ id: 'child-1', name: 'Emma' }],
          vehicle: { id: 'vehicle-1', name: 'Honda Civic', capacity: 4 },
          driver: { id: 'user-123', name: 'John Doe' },
          group: { id: 'group-1', name: 'Maple Street Families' },
        },
        {
          id: 'trip-2',
          time: '15:30',
          datetime: '2024-01-15T15:30:00.000Z',
          date: 'Today',
          children: [{ id: 'child-1', name: 'Emma' }],
          vehicle: { id: 'vehicle-1', name: 'Honda Civic', capacity: 4 },
          driver: { id: 'user-456', name: 'Jane Smith' },
          group: { id: 'group-1', name: 'Maple Street Families' },
        },
      ];

      mockDashboardServiceInstance.getTodayTripsForUser.mockResolvedValue(mockTodayTrips);

      // Act
      await dashboardController.getTodaySchedule(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.getTodayTripsForUser).toHaveBeenCalledWith('user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { upcomingTrips: mockTodayTrips },
      });
    });

    it('should return empty array when no trips for today', async () => {
      // Arrange
      mockDashboardServiceInstance.getTodayTripsForUser.mockResolvedValue([]);

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
      mockDashboardServiceInstance.getTodayTripsForUser.mockRejectedValue(new Error(errorMessage));

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
          id: 'activity-1',
          action: 'Joined group "Maple Street Families"',
          time: '2 hours ago',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          type: 'group' as const,
          entityId: 'group-1',
          entityName: 'Maple Street Families',
        },
        {
          id: 'activity-2',
          action: 'Added vehicle Honda Civic',
          time: '1 day ago',
          timestamp: new Date('2024-01-14T09:00:00Z'),
          type: 'vehicle' as const,
          entityId: 'vehicle-1',
          entityName: 'Honda Civic',
        },
      ];

      // Mock getUserWithFamily to return user with family
      mockDashboardServiceInstance.getUserWithFamily.mockResolvedValue({
        id: 'user-123',
        familyMemberships: [{ familyId: 'family-123' }],
      } as any);
      
      mockDashboardServiceInstance.getRecentActivityForFamily.mockResolvedValue(mockActivities);

      // Act
      await dashboardController.getRecentActivity(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.getUserWithFamily).toHaveBeenCalledWith('user-123');
      expect(mockDashboardServiceInstance.getRecentActivityForFamily).toHaveBeenCalledWith('family-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { activities: mockActivities },
      });
    });

    it('should return empty array when no recent activity', async () => {
      // Arrange
      // Mock getUserWithFamily to return user without family
      mockDashboardServiceInstance.getUserWithFamily.mockResolvedValue({
        id: 'user-123',
        familyMemberships: [],
      } as any);
      
      mockDashboardServiceInstance.getRecentActivityForUser.mockResolvedValue([]);

      // Act
      await dashboardController.getRecentActivity(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.getUserWithFamily).toHaveBeenCalledWith('user-123');
      expect(mockDashboardServiceInstance.getRecentActivityForUser).toHaveBeenCalledWith('user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { activities: [] },
      });
    });

    it('should handle errors when fetching recent activity fails', async () => {
      // Arrange
      const errorMessage = 'Activity fetch failed';
      mockDashboardServiceInstance.getUserWithFamily.mockRejectedValue(new Error(errorMessage));

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
                  groupId: 'group-1',
                  groupName: 'Maple Street Families',
                  scheduleSlotId: 'slot-1',
                  totalChildrenAssigned: 3,
                  totalCapacity: 8,
                  overallCapacityStatus: 'available' as CapacityStatus,
                  vehicleAssignmentSummaries: [
                    {
                      vehicleId: 'vehicle-1',
                      vehicleName: 'Honda Civic',
                      vehicleCapacity: 4,
                      assignedChildrenCount: 2,
                      availableSeats: 2,
                      capacityStatus: 'available' as CapacityStatus,
                      vehicleFamilyId: 'family-1',
                      isFamilyVehicle: true,
                      driver: {
                        id: 'user-123',
                        name: 'John Doe',
                      },
                      children: [
                        {
                          childId: 'child-1',
                          childName: 'Emma',
                          childFamilyId: 'family-1',
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
            familyId: 'family-1',
            familyName: 'Doe Family',
            totalGroups: 2,
            totalChildren: 3,
          },
        },
      };

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardServiceInstance.getUserFamilyId.mockResolvedValue('family-1');
      mockDashboardServiceInstance.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.getUserFamilyId).toHaveBeenCalledWith('user-123');
      expect(mockDashboardServiceInstance.getWeeklyDashboard).toHaveBeenCalledWith('user-123', undefined);
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
            familyId: 'family-1',
            familyName: 'Doe Family',
            totalGroups: 1,
            totalChildren: 0,
          },
        },
      };

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardServiceInstance.getUserFamilyId.mockResolvedValue('family-1');
      mockDashboardServiceInstance.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequestWithDate as any, mockResponse as any);

      // Assert
      expect(mockDashboardServiceInstance.getUserFamilyId).toHaveBeenCalledWith('user-123');
      expect(mockDashboardServiceInstance.getWeeklyDashboard).toHaveBeenCalledWith('user-123', startDate);
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
                  groupId: '',
                  groupName: 'Unknown Group',
                  scheduleSlotId: 'slot-1',
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
            familyId: 'family-1',
            familyName: 'Doe Family',
            totalGroups: 0,
            totalChildren: 0,
          },
        },
      };

      // Mock getUserFamilyId to return a valid family ID
      mockDashboardServiceInstance.getUserFamilyId.mockResolvedValue('family-1');
      mockDashboardServiceInstance.getWeeklyDashboard.mockResolvedValue(mockWeeklyDashboard);

      // Act
      await dashboardController.getWeeklyDashboard(mockRequest as any, mockResponse as any);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0].data;
      expect(responseData.days[0].transports[0].groupId).toBe('');
      expect(responseData.days[0].transports[0].groupName).toBe('Unknown Group');
    });

    it('should return error when weekly dashboard fails', async () => {
      // Arrange
      // Mock getUserFamilyId to return null (no family)
      mockDashboardServiceInstance.getUserFamilyId.mockResolvedValue(null);

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
      mockDashboardServiceInstance.getUserFamilyId.mockResolvedValue('family-1');
      mockDashboardServiceInstance.getWeeklyDashboard.mockRejectedValue(new Error(errorMessage));

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