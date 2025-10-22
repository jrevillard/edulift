import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleConfigService, type GroupScheduleConfig, type ScheduleHours } from '../scheduleConfigService';
import { apiService } from '../apiService';

// Mock the apiService
vi.mock('../apiService');

const mockApiService = vi.mocked(apiService);

describe('ScheduleConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGroupScheduleConfig', () => {
    it('should fetch group schedule configuration', async () => {
      const mockConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:00', '07:30'],
          'TUESDAY': ['08:00'],
          'WEDNESDAY': [],
          'THURSDAY': ['15:00'],
          'FRIDAY': ['16:00']
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isDefault: false
      };

      mockApiService.get.mockResolvedValue({ data: mockConfig });

      const result = await scheduleConfigService.getGroupScheduleConfig('group-1');

      expect(mockApiService.get).toHaveBeenCalledWith('/groups/group-1/schedule-config');
      expect(result).toEqual(mockConfig);
    });

    it('should handle API errors when fetching config', async () => {
      const error = new Error('Network error');
      mockApiService.get.mockRejectedValue(error);

      await expect(scheduleConfigService.getGroupScheduleConfig('group-1'))
        .rejects.toThrow('Network error');

      expect(mockApiService.get).toHaveBeenCalledWith('/groups/group-1/schedule-config');
    });
  });

  describe('getGroupTimeSlots', () => {
    it('should fetch time slots for specific weekday', async () => {
      const mockTimeSlots = {
        groupId: 'group-1',
        weekday: 'MONDAY',
        timeSlots: ['07:00', '07:30', '08:00']
      };

      mockApiService.get.mockResolvedValue({ data: mockTimeSlots });

      const result = await scheduleConfigService.getGroupTimeSlots('group-1', 'MONDAY');

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/groups/group-1/schedule-config/time-slots?weekday=MONDAY'
      );
      expect(result).toEqual(mockTimeSlots);
    });

    it('should handle API errors when fetching time slots', async () => {
      const error = new Error('Invalid weekday');
      mockApiService.get.mockRejectedValue(error);

      await expect(scheduleConfigService.getGroupTimeSlots('group-1', 'INVALID_DAY'))
        .rejects.toThrow('Invalid weekday');
    });
  });

  describe('updateGroupScheduleConfig', () => {
    it('should update group schedule configuration', async () => {
      const scheduleHours: ScheduleHours = {
        'MONDAY': ['07:00', '07:30', '08:00'],
        'TUESDAY': ['08:00', '08:30'],
        'WEDNESDAY': [],
        'THURSDAY': ['15:00', '15:30'],
        'FRIDAY': ['16:00', '16:30']
      };

      const mockUpdatedConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        isDefault: false
      };

      mockApiService.put.mockResolvedValue({ data: mockUpdatedConfig });

      const result = await scheduleConfigService.updateGroupScheduleConfig('group-1', scheduleHours);

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/groups/group-1/schedule-config',
        { scheduleHours }
      );
      expect(result).toEqual(mockUpdatedConfig);
    });

    it('should handle validation errors when updating config', async () => {
      const invalidScheduleHours: ScheduleHours = {
        'MONDAY': ['07:00', '07:05'], // Too close together
        'TUESDAY': [],
        'WEDNESDAY': [],
        'THURSDAY': [],
        'FRIDAY': []
      };

      const error = new Error('Time slots must be at least 15 minutes apart');
      mockApiService.put.mockRejectedValue(error);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', invalidScheduleHours))
        .rejects.toThrow('Time slots must be at least 15 minutes apart');

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/groups/group-1/schedule-config',
        { scheduleHours: invalidScheduleHours }
      );
    });

    it('should handle empty schedule hours', async () => {
      const emptyScheduleHours: ScheduleHours = {
        'MONDAY': [],
        'TUESDAY': [],
        'WEDNESDAY': [],
        'THURSDAY': [],
        'FRIDAY': []
      };

      const mockUpdatedConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: emptyScheduleHours,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        isDefault: false
      };

      mockApiService.put.mockResolvedValue({ data: mockUpdatedConfig });

      const result = await scheduleConfigService.updateGroupScheduleConfig('group-1', emptyScheduleHours);

      expect(result.scheduleHours).toEqual(emptyScheduleHours);
    });
  });

  describe('resetGroupScheduleConfig', () => {
    it('should reset group schedule to default configuration', async () => {
      const mockDefaultConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'TUESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'WEDNESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'THURSDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'FRIDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30']
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        isDefault: true
      };

      mockApiService.post.mockResolvedValue({ data: mockDefaultConfig });

      const result = await scheduleConfigService.resetGroupScheduleConfig('group-1');

      expect(mockApiService.post).toHaveBeenCalledWith('/groups/group-1/schedule-config/reset');
      expect(result).toEqual(mockDefaultConfig);
      expect(result.isDefault).toBe(true);
    });

    it('should handle errors when resetting configuration', async () => {
      const error = new Error('Failed to reset configuration');
      mockApiService.post.mockRejectedValue(error);

      await expect(scheduleConfigService.resetGroupScheduleConfig('group-1'))
        .rejects.toThrow('Failed to reset configuration');

      expect(mockApiService.post).toHaveBeenCalledWith('/groups/group-1/schedule-config/reset');
    });
  });

  describe('getDefaultScheduleHours', () => {
    it('should fetch default schedule hours', async () => {
      const mockDefaultHours = {
        scheduleHours: {
          'MONDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'TUESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'WEDNESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'THURSDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
          'FRIDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30']
        },
        isDefault: true
      };

      mockApiService.get.mockResolvedValue({ data: mockDefaultHours });

      const result = await scheduleConfigService.getDefaultScheduleHours();

      expect(mockApiService.get).toHaveBeenCalledWith('/groups/schedule-config/default');
      expect(result).toEqual(mockDefaultHours);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('initializeDefaultConfigs', () => {
    it('should initialize default configurations for all groups', async () => {
      const mockResponse = {
        message: 'Default configurations initialized successfully'
      };

      mockApiService.post.mockResolvedValue({ data: mockResponse });

      const result = await scheduleConfigService.initializeDefaultConfigs();

      expect(mockApiService.post).toHaveBeenCalledWith('/groups/schedule-config/initialize');
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors during initialization', async () => {
      const error = new Error('Failed to initialize configurations');
      mockApiService.post.mockRejectedValue(error);

      await expect(scheduleConfigService.initializeDefaultConfigs())
        .rejects.toThrow('Failed to initialize configurations');
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle invalid group ID', async () => {
      const error = new Error('Group not found');
      mockApiService.get.mockRejectedValue(error);

      await expect(scheduleConfigService.getGroupScheduleConfig('invalid-group-id'))
        .rejects.toThrow('Group not found');
    });

    it('should handle malformed schedule hours', async () => {
      const malformedHours: ScheduleHours = {
        'MONDAY': ['invalid-time', '25:00'], // Invalid time formats
        'TUESDAY': [],
        'WEDNESDAY': [],
        'THURSDAY': [],
        'FRIDAY': []
      };

      const error = new Error('Invalid time format');
      mockApiService.put.mockRejectedValue(error);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', malformedHours))
        .rejects.toThrow('Invalid time format');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockApiService.get.mockRejectedValue(timeoutError);

      await expect(scheduleConfigService.getGroupScheduleConfig('group-1'))
        .rejects.toThrow('Request timeout');
    });

    it('should handle unauthorized access', async () => {
      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).status = 401;
      mockApiService.put.mockRejectedValue(unauthorizedError);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', {}))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle server errors', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      mockApiService.get.mockRejectedValue(serverError);

      await expect(scheduleConfigService.getGroupScheduleConfig('group-1'))
        .rejects.toThrow('Internal Server Error');
    });
  });

  describe('performance and caching considerations', () => {
    it('should handle rapid successive API calls', async () => {
      const mockConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: {
          'MONDAY': ['07:00'],
          'TUESDAY': [],
          'WEDNESDAY': [],
          'THURSDAY': [],
          'FRIDAY': []
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isDefault: false
      };

      mockApiService.get.mockResolvedValue({ data: mockConfig });

      // Make multiple rapid calls
      const promises = Array.from({ length: 5 }, () => 
        scheduleConfigService.getGroupScheduleConfig('group-1')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result).toEqual(mockConfig);
      });

      // API should be called for each request (no built-in caching in service)
      expect(mockApiService.get).toHaveBeenCalledTimes(5);
    });

    it('should handle large schedule configurations', async () => {
      // Create a large schedule with many time slots
      const largeScheduleHours: ScheduleHours = {
        'MONDAY': Array.from({ length: 20 }, (_, i) => 
          `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
        ),
        'TUESDAY': Array.from({ length: 20 }, (_, i) => 
          `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
        ),
        'WEDNESDAY': Array.from({ length: 20 }, (_, i) => 
          `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
        ),
        'THURSDAY': Array.from({ length: 20 }, (_, i) => 
          `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
        ),
        'FRIDAY': Array.from({ length: 20 }, (_, i) => 
          `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
        )
      };

      const mockConfig: GroupScheduleConfig = {
        id: 'config-1',
        groupId: 'group-1',
        scheduleHours: largeScheduleHours,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isDefault: false
      };

      mockApiService.put.mockResolvedValue({ data: mockConfig });

      const result = await scheduleConfigService.updateGroupScheduleConfig('group-1', largeScheduleHours);

      expect(result.scheduleHours).toEqual(largeScheduleHours);
      expect(Object.values(result.scheduleHours).flat()).toHaveLength(100); // 20 slots × 5 days
    });
  });
});