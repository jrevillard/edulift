import { DashboardService } from '../DashboardService';
import { GroupService } from '../GroupService';
import { ChildService } from '../ChildService';
import { VehicleService } from '../VehicleService';
import { ScheduleSlotService } from '../ScheduleSlotService';
import { ActivityLogRepository } from '../../repositories/ActivityLogRepository';

// Mock all dependencies
jest.mock('../GroupService');
jest.mock('../ChildService');
jest.mock('../VehicleService');
jest.mock('../ScheduleSlotService');
jest.mock('../../repositories/ActivityLogRepository');

const mockGroupService = GroupService as jest.MockedClass<typeof GroupService>;
const mockChildService = ChildService as jest.MockedClass<typeof ChildService>;
const mockVehicleService = VehicleService as jest.MockedClass<typeof VehicleService>;
const mockScheduleSlotService = ScheduleSlotService as jest.MockedClass<typeof ScheduleSlotService>;
const mockActivityLogRepository = ActivityLogRepository as jest.MockedClass<typeof ActivityLogRepository>;

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let mockGroupServiceInstance: jest.Mocked<GroupService>;
  let mockChildServiceInstance: jest.Mocked<ChildService>;
  let mockVehicleServiceInstance: jest.Mocked<VehicleService>;
  let mockScheduleSlotServiceInstance: jest.Mocked<ScheduleSlotService>;
  let mockActivityLogRepositoryInstance: jest.Mocked<ActivityLogRepository>;

  beforeEach(() => {
    // Create mock instances
    mockGroupServiceInstance = {
      getUserGroups: jest.fn(),
    } as any;

    mockChildServiceInstance = {
      getChildrenByUser: jest.fn(),
    } as any;

    mockVehicleServiceInstance = {
      getVehiclesByUser: jest.fn(),
    } as any;

    mockScheduleSlotServiceInstance = {
      getTodayScheduleSlotsForUser: jest.fn(),
      getThisWeekTripsCountForUser: jest.fn(),
    } as any;

    mockActivityLogRepositoryInstance = {
      getRecentActivityForUser: jest.fn(),
    } as any;

    // Mock constructors
    mockGroupService.mockImplementation(() => mockGroupServiceInstance);
    mockChildService.mockImplementation(() => mockChildServiceInstance);
    mockVehicleService.mockImplementation(() => mockVehicleServiceInstance);
    mockScheduleSlotService.mockImplementation(() => mockScheduleSlotServiceInstance);
    mockActivityLogRepository.mockImplementation(() => mockActivityLogRepositoryInstance);

    dashboardService = new DashboardService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateUserStats', () => {
    it('should calculate dashboard statistics correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const mockGroups = [
        { id: 'group-1', name: 'Group 1' },
        { id: 'group-2', name: 'Group 2' },
      ];
      const mockChildren = [
        { id: 'child-1', name: 'Emma', userId },
        { id: 'child-2', name: 'Lucas', userId },
        { id: 'child-3', name: 'Sophia', userId },
      ];
      const mockVehicles = [
        { id: 'vehicle-1', name: 'Honda Civic', userId },
      ];

      mockGroupServiceInstance.getUserGroups.mockResolvedValue(mockGroups as any);
      mockChildServiceInstance.getChildrenByUser.mockResolvedValue(mockChildren as any);
      mockVehicleServiceInstance.getVehiclesByUser.mockResolvedValue(mockVehicles as any);
      jest.spyOn(dashboardService as any, 'getThisWeekTripsCountForUser').mockResolvedValue(8);

      // Act
      const result = await dashboardService.calculateUserStats(userId);

      // Assert
      expect(result).toEqual({
        groups: 2,
        children: 3,
        vehicles: 1,
        thisWeekTrips: 8,
        trends: {
          groups: { value: 'Active', direction: 'neutral', period: 'current' },
          children: { value: 'Active', direction: 'neutral', period: 'current' },
          vehicles: { value: 'Active', direction: 'neutral', period: 'current' },
          trips: { value: 'Active', direction: 'neutral', period: 'this week' },
        },
      });

      expect(mockGroupServiceInstance.getUserGroups).toHaveBeenCalledWith(userId);
      expect(mockChildServiceInstance.getChildrenByUser).toHaveBeenCalledWith(userId);
      expect(mockVehicleServiceInstance.getVehiclesByUser).toHaveBeenCalledWith(userId);
    });

    it('should handle empty data gracefully', async () => {
      // Arrange
      const userId = 'user-123';

      mockGroupServiceInstance.getUserGroups.mockResolvedValue([]);
      mockChildServiceInstance.getChildrenByUser.mockResolvedValue([]);
      mockVehicleServiceInstance.getVehiclesByUser.mockResolvedValue([]);
      jest.spyOn(dashboardService as any, 'getThisWeekTripsCountForUser').mockResolvedValue(0);

      // Act
      const result = await dashboardService.calculateUserStats(userId);

      // Assert
      expect(result).toEqual({
        groups: 0,
        children: 0,
        vehicles: 0,
        thisWeekTrips: 0,
        trends: {
          groups: { value: 'Active', direction: 'neutral', period: 'current' },
          children: { value: 'Active', direction: 'neutral', period: 'current' },
          vehicles: { value: 'Active', direction: 'neutral', period: 'current' },
          trips: { value: 'Active', direction: 'neutral', period: 'this week' },
        },
      });
    });

    it('should throw error when service calls fail', async () => {
      // Arrange
      const userId = 'user-123';
      const errorMessage = 'Database error';

      mockGroupServiceInstance.getUserGroups.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(dashboardService.calculateUserStats(userId)).rejects.toThrow(errorMessage);
    });
  });

  describe('getTodayTripsForUser', () => {
    it('should transform schedule slots to today trips format', async () => {
      // Arrange
      const userId = 'user-123';
      const testDatetime = new Date('2024-01-15T08:00:00Z');
      const mockScheduleSlots = [
        {
          id: 'slot-1',
          groupId: 'group-1',
          day: 'MONDAY',
          time: '08:00',
          datetime: testDatetime,
          week: '2024-03',
          vehicleAssignments: [
            {
              id: 'assignment-1',
              vehicle: { id: 'vehicle-1', name: 'Honda Civic', capacity: 4 },
              driver: { id: 'user-123', name: 'John Doe' },
            },
          ],
          childAssignments: [
            {
              vehicleAssignmentId: 'assignment-1',
              child: { id: 'child-1', name: 'Emma' },
            },
          ],
          group: { id: 'group-1', name: 'Maple Street Families' },
        },
      ];

      jest.spyOn(dashboardService as any, 'getTodayScheduleSlotsForUser').mockResolvedValue(mockScheduleSlots as any);

      // Act
      const result = await dashboardService.getTodayTripsForUser(userId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'slot-1',
        time: '08:00',
        datetime: testDatetime.toISOString(),
        destination: 'Maple Street Families', // Morning trip goes to school
        type: 'pickup',
        date: 'Today',
        children: [{ id: 'child-1', name: 'Emma' }],
        vehicle: { id: 'vehicle-1', name: 'Honda Civic', capacity: 4 },
        driver: { id: 'user-123', name: 'John Doe' },
        group: { id: 'group-1', name: 'Maple Street Families' },
      });
    });

    it('should handle afternoon trips correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const mockScheduleSlots = [
        {
          id: 'slot-2',
          time: '15:30',
          vehicleAssignments: [
            {
              vehicle: { id: 'vehicle-1', name: 'Honda Civic', capacity: 4 },
              driver: { id: 'user-456', name: 'Jane Smith' },
            },
          ],
          childAssignments: [],
          group: { id: 'group-1', name: 'Maple Street Families' },
        },
      ];

      jest.spyOn(dashboardService as any, 'getTodayScheduleSlotsForUser').mockResolvedValue(mockScheduleSlots as any);

      // Act
      const result = await dashboardService.getTodayTripsForUser(userId);

      // Assert
      expect(result[0].destination).toBe('Home'); // Afternoon trip goes home
      expect(result[0].type).toBe('dropoff');
    });

    it('should return empty array when no today trips', async () => {
      // Arrange
      const userId = 'user-123';

      jest.spyOn(dashboardService as any, 'getTodayScheduleSlotsForUser').mockResolvedValue([]);

      // Act
      const result = await dashboardService.getTodayTripsForUser(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getRecentActivityForUser', () => {
    it('should return formatted recent activity', async () => {
      // Arrange
      const userId = 'user-123';
      const mockActivities = [
        {
          id: 'activity-1',
          actionDescription: 'Joined group "Maple Street Families"',
          entityType: 'group',
          entityId: 'group-1',
          entityName: 'Maple Street Families',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'activity-2',
          actionDescription: 'Added vehicle Honda Civic',
          entityType: 'vehicle',
          entityId: 'vehicle-1',
          entityName: 'Honda Civic',
          createdAt: new Date('2024-01-14T09:00:00Z'),
        },
      ];

      mockActivityLogRepositoryInstance.getRecentActivityForUser.mockResolvedValue(mockActivities as any);

      // Mock Date.now() for consistent time calculations
      const mockNow = new Date('2024-01-15T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      // Act
      const result = await dashboardService.getRecentActivityForUser(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'activity-1',
        action: 'Joined group "Maple Street Families"',
        time: '2 hours ago',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        type: 'group',
        entityId: 'group-1',
        entityName: 'Maple Street Families',
      });

      expect(mockActivityLogRepositoryInstance.getRecentActivityForUser).toHaveBeenCalledWith(userId, 10);
    });

    it('should return empty array when no recent activity', async () => {
      // Arrange
      const userId = 'user-123';

      mockActivityLogRepositoryInstance.getRecentActivityForUser.mockResolvedValue([]);

      // Act
      const result = await dashboardService.getRecentActivityForUser(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('UTC time formatting', () => {
    it('should format datetime as UTC time without timezone conversion', () => {
      // Test with a UTC datetime that would be different in other timezones
      // 06:30 UTC = 08:30 Paris (CET+2) = 01:30 EST (UTC-5)
      const utcDatetime = new Date('2025-01-06T06:30:00Z');

      // Access private method via any cast for testing
      const formatTimeFromDatetime = (dashboardService as any).formatTimeFromDatetime.bind(dashboardService);
      const result = formatTimeFromDatetime(utcDatetime);

      // Should return UTC time, not local time
      expect(result).toBe('06:30');
    });

    it('should format datetime as UTC day of week without timezone conversion', () => {
      // Test with a UTC datetime on Monday (2025-01-06)
      const utcDatetime = new Date('2025-01-06T06:30:00Z');

      // Access private method via any cast for testing
      const formatDateFromDatetime = (dashboardService as any).formatDateFromDatetime.bind(dashboardService);
      const result = formatDateFromDatetime(utcDatetime);

      // Should return UTC day of week
      expect(result).toBe('Monday');
    });

    it('should handle midnight UTC times correctly', () => {
      // Test edge case at midnight UTC
      const utcDatetime = new Date('2025-01-06T00:00:00Z');

      const formatTimeFromDatetime = (dashboardService as any).formatTimeFromDatetime.bind(dashboardService);
      const result = formatTimeFromDatetime(utcDatetime);

      expect(result).toBe('00:00');
    });

    it('should handle end of day UTC times correctly', () => {
      // Test edge case near end of day
      const utcDatetime = new Date('2025-01-06T23:59:00Z');

      const formatTimeFromDatetime = (dashboardService as any).formatTimeFromDatetime.bind(dashboardService);
      const result = formatTimeFromDatetime(utcDatetime);

      expect(result).toBe('23:59');
    });
  });
});