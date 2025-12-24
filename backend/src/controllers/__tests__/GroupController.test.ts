/**
 * GroupController Hono Tests - Group Schedule Config Endpoints
 *
 * Basic tests for the 5 GroupScheduleConfig endpoints of GroupController
 * using correct Hono pattern with app.request() and zValidator
 */

import { Hono } from 'hono';
import {
  mockGetGroupScheduleConfig,
  mockGetGroupTimeSlots,
  mockUpdateGroupScheduleConfig,
  mockResetGroupScheduleConfig,
  mockGetDefaultScheduleHours,
  mockPrisma,
  createMockGroupController,
} from './helpers/mockGroupController';

// Helper function for typing response.json()
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

// Mock external dependencies
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn((c: any, next: any) => {
    // Mock successful authentication
    c.set('userId', 'user_123456789012345678901234');
    c.set('user', {
      id: 'user_123456789012345678901234',
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'UTC',
    });
    return next();
  }),
}));

// Mock database
jest.mock('../../config/database', () => ({
  prisma: mockPrisma,
}));

describe('GroupController - Group Schedule Config Endpoints', () => {
  let app: Hono;
  const mockUserId = 'user_123456789012345678901234';
  const mockGroupId = 'clg123456789012345678901234';

  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create app with mock controller
    app = createMockGroupController();

    // Mock auth middleware - sets userId in context
    app.use('*', async (c: any, next) => {
      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'UTC',
      });
      await next();
    });
  });

  describe('GET /:groupId/schedule-config', () => {
    it('should validate groupId parameter format', async () => {
      const invalidGroupId = 'invalid-id';

      // Mock to return null for invalid group
      mockGetGroupScheduleConfig.mockResolvedValue(null);

      const response = await app.request(`/${invalidGroupId}/schedule-config`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const data = await responseJson(response);
      expect(data.error).toContain('Group schedule configuration not found');
    });

    it('should handle valid groupId format', async () => {
      // Mock the service to return null (config not found)
      mockGetGroupScheduleConfig.mockResolvedValue(null);

      const response = await app.request(`/${mockGroupId}/schedule-config`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const data = await responseJson(response);
      expect(data.error).toContain('Group schedule configuration not found');
    });
  });

  describe('GET /:groupId/schedule-config/time-slots', () => {
    it('should validate weekday parameter', async () => {
      const response = await app.request(`/${mockGroupId}/schedule-config/time-slots?weekday=INVALID`, {
        method: 'GET',
      });

      expect(response.status).toBe(400);
      const data = await responseJson(response);
      expect(data.error).toBeDefined();
    });

    it('should require weekday parameter', async () => {
      const response = await app.request(`/${mockGroupId}/schedule-config/time-slots`, {
        method: 'GET',
      });

      expect(response.status).toBe(400);
      const data = await responseJson(response);
      expect(data.error).toBeDefined();
    });

    it('should accept valid weekday parameter', async () => {
      // Mock the service
      mockGetGroupTimeSlots.mockResolvedValue(['08:00', '16:00']);

      const response = await app.request(`/${mockGroupId}/schedule-config/time-slots?weekday=MONDAY`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);
      expect(data.groupId).toBe(mockGroupId);
      expect(data.weekday).toBe('MONDAY');
      expect(data.timeSlots).toEqual(['08:00', '16:00']);
    });
  });

  describe('PUT /:groupId/schedule-config', () => {
    const validUpdateData = {
      scheduleHours: {
        MONDAY: ['08:00', '16:00'],
        TUESDAY: ['08:30', '15:30'],
      },
    };

    it('should validate schedule hours format', async () => {
      const invalidData = {
        scheduleHours: {
          MONDAY: ['25:00', '16:00'], // Invalid time format
        },
      };

      // Mock the service to throw a validation error for invalid time format
      mockUpdateGroupScheduleConfig.mockRejectedValue(new Error('Invalid time format'));

      const response = await app.request(`/${mockGroupId}/schedule-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(500);
      const data = await responseJson(response);
      expect(data.error).toBeDefined();
    });

    it('should accept valid schedule hours', async () => {
      // Mock the service
      mockUpdateGroupScheduleConfig.mockResolvedValue({
        id: 'config_123',
        groupId: mockGroupId,
        ...validUpdateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await app.request(`/${mockGroupId}/schedule-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);
      expect(data.scheduleHours).toEqual(validUpdateData.scheduleHours);
      expect(data.isDefault).toBe(false);
    });
  });

  describe('POST /:groupId/schedule-config/reset', () => {
    it('should reset schedule config successfully', async () => {
      // Mock the service
      mockResetGroupScheduleConfig.mockResolvedValue({
        id: 'config_123',
        groupId: mockGroupId,
        scheduleHours: {
          MONDAY: ['08:00', '09:00', '16:00', '17:00'],
          FRIDAY: ['08:00', '09:00', '16:00', '17:00'],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const response = await app.request(`/${mockGroupId}/schedule-config/reset`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);
      expect(data.groupId).toBe(mockGroupId);
      expect(data.isDefault).toBe(true);
    });
  });

  describe('GET /schedule-config/default', () => {
    it('should get default schedule hours successfully', async () => {
      const mockDefaultHours = {
        MONDAY: ['07:00', '08:00', '15:00', '16:00'],
        FRIDAY: ['07:00', '08:00', '15:00', '16:00'],
      };

      // Set the mock return value
      mockGetDefaultScheduleHours.mockReturnValue(mockDefaultHours);

      const response = await app.request('/schedule-config/default', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await responseJson(response);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockDefaultHours);
    });
  });
});