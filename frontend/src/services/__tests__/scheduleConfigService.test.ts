import './setup'; // Import the API mock setup
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleConfigService, type GroupScheduleConfig, type ScheduleHours } from '../scheduleConfigService';
import { api } from '../api';

// Mock the API client
vi.mock('../api');

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

      vi.mocked(api.GET).mockResolvedValue({
        data: { data: mockConfig },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.getGroupScheduleConfig('group-1');

      expect(api.GET).toHaveBeenCalledWith('/groups/{groupId}/schedule-config', {
        params: { path: { groupId: 'group-1' } }
      });
      expect(result).toEqual(mockConfig);
    });

    it('should handle API errors when fetching config', async () => {
      const error = new Error('Network error');
      vi.mocked(api.GET).mockRejectedValue(error);

      await expect(scheduleConfigService.getGroupScheduleConfig('group-1'))
        .rejects.toThrow('Network error');

      expect(api.GET).toHaveBeenCalledWith('/groups/{groupId}/schedule-config', {
        params: { path: { groupId: 'group-1' } }
      });
    });
  });

  describe('getGroupTimeSlots', () => {
    it('should fetch time slots for specific weekday', async () => {
      const mockTimeSlots = {
        groupId: 'group-1',
        weekday: 'MONDAY',
        timeSlots: ['07:00', '07:30', '08:00']
      };

      vi.mocked(api.GET).mockResolvedValue({
        data: { data: mockTimeSlots },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.getGroupTimeSlots('group-1', 'MONDAY');

      expect(api.GET).toHaveBeenCalledWith(
        '/groups/{groupId}/schedule-config/time-slots',
        {
          params: {
            path: { groupId: 'group-1' },
            query: { weekday: 'MONDAY' }
          }
        }
      );
      expect(result).toEqual({
        groupId: mockTimeSlots.groupId,
        weekday: mockTimeSlots.weekday,
        timeSlots: mockTimeSlots.timeSlots
      });
    });

    it('should handle API errors when fetching time slots', async () => {
      const error = new Error('Invalid weekday');
      vi.mocked(api.GET).mockRejectedValue(error);

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

      vi.mocked(api.PUT).mockResolvedValue({
        data: { data: mockUpdatedConfig },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.updateGroupScheduleConfig('group-1', scheduleHours);

      expect(api.PUT).toHaveBeenCalledWith(
        '/groups/{groupId}/schedule-config',
        {
          params: { path: { groupId: 'group-1' } },
          body: { scheduleHours }
        }
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
      vi.mocked(api.PUT).mockRejectedValue(error);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', invalidScheduleHours))
        .rejects.toThrow('Time slots must be at least 15 minutes apart');

      expect(api.PUT).toHaveBeenCalledWith(
        '/groups/{groupId}/schedule-config',
        {
          params: { path: { groupId: 'group-1' } },
          body: { scheduleHours: invalidScheduleHours }
        }
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

      vi.mocked(api.PUT).mockResolvedValue({
        data: { data: mockUpdatedConfig },
        error: undefined,
        response: new Response()
      });

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

      vi.mocked(api.POST).mockResolvedValue({
        data: { data: mockDefaultConfig },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.resetGroupScheduleConfig('group-1');

      expect(api.POST).toHaveBeenCalledWith('/groups/{groupId}/schedule-config/reset', {
        params: { path: { groupId: 'group-1' } }
      });
      expect(result).toEqual(mockDefaultConfig);
      expect(result.isDefault).toBe(true);
    });

    it('should handle errors when resetting configuration', async () => {
      const error = new Error('Failed to reset configuration');
      vi.mocked(api.POST).mockRejectedValue(error);

      await expect(scheduleConfigService.resetGroupScheduleConfig('group-1'))
        .rejects.toThrow('Failed to reset configuration');

      expect(api.POST).toHaveBeenCalledWith('/groups/{groupId}/schedule-config/reset', {
        params: { path: { groupId: 'group-1' } }
      });
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

      vi.mocked(api.GET).mockResolvedValue({
        data: { data: mockDefaultHours },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.getDefaultScheduleHours();

      expect(api.GET).toHaveBeenCalledWith('/groups/schedule-config/default');
      expect(result).toEqual(mockDefaultHours);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle invalid group ID', async () => {
      const error = new Error('Group not found');
      vi.mocked(api.GET).mockRejectedValue(error);

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
      vi.mocked(api.PUT).mockRejectedValue(error);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', malformedHours))
        .rejects.toThrow('Invalid time format');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(api.GET).mockRejectedValue(timeoutError);

      await expect(scheduleConfigService.getGroupScheduleConfig('group-1'))
        .rejects.toThrow('Request timeout');
    });

    it('should handle unauthorized access', async () => {
      const unauthorizedError = Object.assign(new Error('Unauthorized'), { status: 401 });
      vi.mocked(api.PUT).mockRejectedValue(unauthorizedError);

      await expect(scheduleConfigService.updateGroupScheduleConfig('group-1', {}))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle server errors', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), { status: 500 });
      vi.mocked(api.GET).mockRejectedValue(serverError);

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

      vi.mocked(api.GET).mockResolvedValue({
        data: { data: mockConfig },
        error: undefined,
        response: new Response()
      });

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
      expect(api.GET).toHaveBeenCalledTimes(5);
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

      vi.mocked(api.PUT).mockResolvedValue({
        data: { data: mockConfig },
        error: undefined,
        response: new Response()
      });

      const result = await scheduleConfigService.updateGroupScheduleConfig('group-1', largeScheduleHours);

      expect(result.scheduleHours).toEqual(largeScheduleHours);
      expect(Object.values(result.scheduleHours).flat()).toHaveLength(100); // 20 slots × 5 days
    });
  });
});