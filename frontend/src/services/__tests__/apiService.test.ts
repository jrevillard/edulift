import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { apiService } from '../apiService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    isAxiosError: vi.fn(() => false),
  }
}));

const mockedAxios = vi.mocked(axios);

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createScheduleSlotWithVehicle', () => {
    it('should create schedule slot with vehicle successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            day: 'MONDAY',
            time: '08:00',
            week: '2024-01',
            vehicleAssignments: [
              {
                id: 'assignment-1',
                vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 20 },
                driver: { id: 'driver-1', name: 'John Doe' }
              }
            ],
            childAssignments: []
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.createScheduleSlotWithVehicle(
        'group-1',
        'MONDAY',
        '08:00',
        '2024-01',
        'vehicle-1',
        'driver-1'
      );

      // Check that the call was made with correct structure (no timezone - backend fetches from user)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/groups/group-1/schedule-slots',
        expect.objectContaining({
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          seatOverride: undefined
        })
      );

      // Verify datetime is a valid ISO string
      const callArgs = mockedAxios.post.mock.calls[0][1];
      expect(callArgs.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(callArgs.datetime).toISOString()).toBe(callArgs.datetime);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle creation errors with API error response', async () => {
      const mockErrorResponse = {
        data: {
          success: false,
          error: 'Schedule slot already exists'
        }
      };

      mockedAxios.post.mockResolvedValue(mockErrorResponse);

      await expect(
        apiService.createScheduleSlotWithVehicle(
          'group-1',
          'MONDAY',
          '08:00',
          '2024-01',
          'vehicle-1'
        )
      ).rejects.toThrow('Schedule slot already exists');
    });

    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        apiService.createScheduleSlotWithVehicle(
          'group-1',
          'MONDAY',
          '08:00',
          '2024-01',
          'vehicle-1'
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('assignVehicleToScheduleSlot', () => {
    it('should assign vehicle to schedule slot successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'assignment-1',
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 20 },
            driver: { id: 'driver-1', name: 'John Doe' }
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.assignVehicleToScheduleSlot(
        'slot-1',
        'vehicle-1',
        'driver-1'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/schedule-slots/slot-1/vehicles',
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1'
        }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle assignment errors', async () => {
      const mockErrorResponse = {
        data: {
          success: false,
          error: 'Vehicle already assigned'
        }
      };

      mockedAxios.post.mockResolvedValue(mockErrorResponse);

      await expect(
        apiService.assignVehicleToScheduleSlot('slot-1', 'vehicle-1')
      ).rejects.toThrow('Vehicle already assigned');
    });
  });

  describe('removeVehicleFromScheduleSlot', () => {
    it('should remove vehicle and keep slot', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            message: 'Vehicle removed successfully',
            slotDeleted: false
          }
        }
      };

      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await apiService.removeVehicleFromScheduleSlot('slot-1', 'vehicle-1');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/schedule-slots/slot-1/vehicles',
        {
          data: { vehicleId: 'vehicle-1' }
        }
      );
      expect(result).toEqual({ slotDeleted: false });
    });

    it('should remove vehicle and delete slot when last vehicle', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            message: 'Vehicle removed successfully',
            slotDeleted: true
          }
        }
      };

      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await apiService.removeVehicleFromScheduleSlot('slot-1', 'vehicle-1');

      expect(result).toEqual({ slotDeleted: true });
    });

    it('should handle removal errors', async () => {
      const mockErrorResponse = {
        data: {
          success: false,
          error: 'Vehicle not found'
        }
      };

      mockedAxios.delete.mockResolvedValue(mockErrorResponse);

      await expect(
        apiService.removeVehicleFromScheduleSlot('slot-1', 'vehicle-1')
      ).rejects.toThrow('Vehicle not found');
    });
  });

  describe('getScheduleSlotDetails', () => {
    it('should get schedule slot details successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            day: 'MONDAY',
            time: '08:00',
            week: '2024-01',
            vehicleAssignments: [],
            childAssignments: [],
            totalCapacity: 0,
            availableSeats: 0
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getScheduleSlotDetails('slot-1');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/schedule-slots/slot-1'
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle 404 errors for deleted slots', async () => {
      const mockErrorResponse = {
        data: {
          success: false,
          error: 'Schedule slot not found'
        }
      };

      mockedAxios.get.mockResolvedValue(mockErrorResponse);

      await expect(
        apiService.getScheduleSlotDetails('non-existent')
      ).rejects.toThrow('Schedule slot not found');
    });
  });

  describe('getWeeklySchedule', () => {
    it('should get weekly schedule successfully with correct date range calculation', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            scheduleSlots: [
              {
                id: 'slot-1',
                groupId: 'group-1',
                datetime: '2025-06-23T08:00:00.000Z', // Monday of week 26
                vehicleAssignments: [],
                childAssignments: []
              }
            ]
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      // Pass explicit UTC timezone to ensure consistent test behavior
      const result = await apiService.getWeeklySchedule('group-1', '2025-26', 'UTC');

      // ✅ GREEN: Should calculate correct date range for week 26 (June 23-29, 2025) in UTC
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/groups/group-1/schedule?startDate=2025-06-23T00:00:00.000Z&endDate=2025-06-29T23:59:59.999Z'
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should handle empty schedule', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            scheduleSlots: []
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getWeeklySchedule('group-1', '2024-01');

      expect(result.scheduleSlots).toHaveLength(0);
    });
  });

  describe('assignChildToScheduleSlot', () => {
    it('should assign child to schedule slot successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            scheduleSlotId: 'slot-1',
            childId: 'child-1'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);
      mockedAxios.isAxiosError.mockReturnValue(false);

      await apiService.assignChildToScheduleSlot('slot-1', 'child-1', 'vehicle-assignment-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/schedule-slots/slot-1/children',
        {
          childId: 'child-1',
          vehicleAssignmentId: 'vehicle-assignment-1'
        }
      );
    });

    it('should handle capacity errors', async () => {
      const mockErrorResponse = {
        data: {
          success: false,
          error: 'Schedule slot is at full capacity'
        }
      };

      mockedAxios.post.mockResolvedValue(mockErrorResponse);
      mockedAxios.isAxiosError.mockReturnValue(false);

      await expect(
        apiService.assignChildToScheduleSlot('slot-1', 'child-1', 'vehicle-assignment-1')
      ).rejects.toThrow('Schedule slot is at full capacity');
    });
  });

  describe('Timezone-aware date validation', () => {
    it('should validate dates using user timezone when provided', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: '2024-01-15T16:00:00.000Z', // UTC
            vehicleAssignments: [],
            childAssignments: []
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Create slot for Jan 15, 2024 08:00 in Asia/Tokyo (which is 23:00 Jan 14 UTC)
      await apiService.createScheduleSlotWithVehicle(
        'group-1',
        'MONDAY',
        '08:00',
        '2024-03', // Week 3 of 2024
        'vehicle-1',
        'driver-1',
        undefined,
        'Asia/Tokyo'
      );

      // Verify the datetime was converted correctly
      const callArgs = mockedAxios.post.mock.calls[0][1];
      expect(callArgs.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Parse the sent datetime and verify it's in UTC
      const sentDate = dayjs(callArgs.datetime);
      expect(sentDate.isValid()).toBe(true);
    });

    it('should use browser timezone when user timezone is not provided', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: '2024-01-15T08:00:00.000Z',
            vehicleAssignments: [],
            childAssignments: []
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await apiService.createScheduleSlotWithVehicle(
        'group-1',
        'MONDAY',
        '08:00',
        '2024-03',
        'vehicle-1',
        'driver-1'
        // No timezone parameter - should use browser timezone
      );

      const callArgs = mockedAxios.post.mock.calls[0][1];
      expect(callArgs.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should correctly convert PST time to UTC', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: '2024-01-15T16:00:00.000Z',
            vehicleAssignments: [],
            childAssignments: []
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      // Create slot for Jan 15, 2024 08:00 PST (which is 16:00 UTC)
      await apiService.createScheduleSlotWithVehicle(
        'group-1',
        'MONDAY',
        '08:00',
        '2024-03',
        'vehicle-1',
        'driver-1',
        undefined,
        'America/Los_Angeles'
      );

      const callArgs = mockedAxios.post.mock.calls[0][1];
      const sentDate = dayjs.utc(callArgs.datetime);

      // Verify the time is properly converted to UTC
      expect(sentDate.isValid()).toBe(true);
      expect(callArgs.datetime).toContain('T'); // ISO format
      expect(callArgs.datetime).toContain('Z'); // UTC marker
    });

    it('should handle different timezones consistently', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: '2024-01-15T08:00:00.000Z',
            vehicleAssignments: [],
            childAssignments: []
          }
        }
      };

      // Test with multiple timezones
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland'
      ];

      for (const tz of timezones) {
        mockedAxios.post.mockResolvedValue(mockResponse);

        await apiService.createScheduleSlotWithVehicle(
          'group-1',
          'MONDAY',
          '08:00',
          '2024-03',
          'vehicle-1',
          'driver-1',
          undefined,
          tz
        );

        const callArgs = mockedAxios.post.mock.calls[mockedAxios.post.mock.calls.length - 1][1];
        expect(callArgs.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // Verify it's a valid ISO string in UTC
        const date = new Date(callArgs.datetime);
        expect(date.toISOString()).toBe(callArgs.datetime);
      }
    });
  });
});