import { DashboardService } from '../DashboardService';
import { PrismaClient } from '@prisma/client';

// Mock the other services
jest.mock('../GroupService');
jest.mock('../ChildService');
jest.mock('../VehicleService');

// Mock PrismaClient
const mockPrisma = {
  scheduleSlot: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  family: {
    findUnique: jest.fn(),
  },
  activityLog: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock the other services methods
const mockGroupService = {
  getUserGroups: jest.fn().mockResolvedValue([]),
};
const mockChildService = {
  getChildrenByUser: jest.fn().mockResolvedValue([]),
};
const mockVehicleService = {
  getVehiclesByUser: jest.fn().mockResolvedValue([]),
};

// Mock the required service dependencies
jest.mock('../GroupService', () => ({
  GroupService: jest.fn().mockImplementation(() => mockGroupService),
}));
jest.mock('../ChildService', () => ({
  ChildService: jest.fn().mockImplementation(() => mockChildService),
}));
jest.mock('../VehicleService', () => ({
  VehicleService: jest.fn().mockImplementation(() => mockVehicleService),
}));

describe('DashboardService - This Week Trips TDD Tests', () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService = new DashboardService(mockPrisma);
  });

  describe('TDD: Week Start Calculation Bug', () => {
    it('✅ GREEN: should calculate correct week start for June 25, 2025', () => {
      // Test the current implementation
      const dashboardService = new DashboardService(mockPrisma);
      const today = new Date('2025-06-25T10:00:00.000Z'); // Wednesday
      
      // Access the private method via reflection for testing
      const getWeekStartDate = (dashboardService as any).getWeekStartDate.bind(dashboardService);
      const weekStart = getWeekStartDate(today);
      
      // ✅ GREEN: Current implementation calculates Monday using simple day-of-week logic
      // For Wednesday June 25, 2025, the Monday should be June 23, 2025
      console.log('Week start calculated:', weekStart.toISOString());
      console.log('Expected: Monday of current week');
      
      expect(weekStart.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(weekStart.getUTCFullYear()).toBe(2025);
      expect(weekStart.getUTCDay()).toBe(1); // Monday
      expect(weekStart.getUTCHours()).toBe(0); // Start of day
      expect(weekStart.getUTCMinutes()).toBe(0);
      expect(weekStart.getUTCSeconds()).toBe(0);
    });

    it('should handle week boundaries correctly', () => {
      // Test that week calculation handles edge cases correctly
      const dashboardService = new DashboardService(mockPrisma);
      const getWeekStartDate = (dashboardService as any).getWeekStartDate.bind(dashboardService);
      
      // Test Sunday - should return previous Monday
      const sunday = new Date('2025-06-29T10:00:00.000Z'); // Sunday
      const sundayWeekStart = getWeekStartDate(sunday);
      expect(sundayWeekStart.getUTCDay()).toBe(1); // Monday
      expect(sundayWeekStart.getUTCDate()).toBe(23); // June 23
      
      // Test Monday - should return itself
      const monday = new Date('2025-06-30T10:00:00.000Z'); // Monday
      const mondayWeekStart = getWeekStartDate(monday);
      expect(mondayWeekStart.getUTCDay()).toBe(1); // Monday
      expect(mondayWeekStart.getUTCDate()).toBe(30); // June 30
      
      // Test Saturday - should return current week's Monday
      const saturday = new Date('2025-07-05T10:00:00.000Z'); // Saturday
      const saturdayWeekStart = getWeekStartDate(saturday);
      expect(saturdayWeekStart.getUTCDay()).toBe(1); // Monday
      expect(saturdayWeekStart.getUTCDate()).toBe(30); // June 30
      
      // All dates in the same week should return the same Monday
      expect(sundayWeekStart.getTime()).toBe(getWeekStartDate(new Date('2025-06-23T10:00:00.000Z')).getTime());
      expect(mondayWeekStart.getTime()).toBe(getWeekStartDate(new Date('2025-07-04T10:00:00.000Z')).getTime());
    });

    it('✅ GREEN: should count trips correctly for current week', async () => {
      // Mock the Prisma count to return some trips
      (mockPrisma.scheduleSlot.count as any).mockResolvedValue(5);
      
      const stats = await dashboardService.calculateUserStats('user-1');
      
      // ✅ GREEN: Should have the correct trip count
      expect(stats.thisWeekTrips).toBe(5);
      
      // Verify the date range used in the query
      expect(mockPrisma.scheduleSlot.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          datetime: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      });
      
      // Get the actual query parameters
      const queryCall = (mockPrisma.scheduleSlot.count as any).mock.calls[0][0];
      const startDate = queryCall.where.datetime.gte;
      const endDate = queryCall.where.datetime.lte;
      
      console.log('Query start date:', startDate.toISOString(), 'Day:', startDate.getUTCDay());
      console.log('Query end date:', endDate.toISOString());
      console.log('Current date for context:', new Date().toISOString(), 'Day:', new Date().getDay());
      
      // ✅ GREEN: Verify that the date range is a valid 7-day week
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(6.999, 1); // Should be approximately 7 days
      
      // Start date should be a Monday
      expect(startDate.getUTCDay()).toBe(1); // Monday
      expect(startDate.getUTCHours()).toBe(0); // Start of day
      
      // End date should be end of week
      expect(endDate.getUTCHours()).toBe(23); // End of day
      expect(endDate.getUTCMinutes()).toBe(59); // End of day minutes
      expect(endDate.getUTCSeconds()).toBe(59); // End of day seconds
    });
  });
});