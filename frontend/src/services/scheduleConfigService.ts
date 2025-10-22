import { apiService } from './apiService';
import type { ApiResponse } from '@/types';

export interface ScheduleHours {
  [key: string]: string[]; // { 'MONDAY': ['07:00', '07:30'], 'TUESDAY': ['08:00'] }
}

export interface GroupScheduleConfig {
  id: string | null;
  groupId: string;
  scheduleHours: ScheduleHours;
  createdAt: string | null;
  updatedAt: string | null;
  isDefault: boolean;
}

export interface GroupTimeSlots {
  groupId: string;
  weekday: string;
  timeSlots: string[];
}

class ScheduleConfigService {
  /**
   * Get schedule configuration for a group
   */
  async getGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const response = await apiService.get(`/groups/${groupId}/schedule-config`);
    const apiResponse = response.data as ApiResponse<GroupScheduleConfig>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to get group schedule config');
  }

  /**
   * Get time slots for a specific group and weekday
   */
  async getGroupTimeSlots(groupId: string, weekday: string): Promise<GroupTimeSlots> {
    const response = await apiService.get(`/groups/${groupId}/schedule-config/time-slots?weekday=${weekday}`);
    const apiResponse = response.data as ApiResponse<GroupTimeSlots>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to get group time slots');
  }

  /**
   * Update schedule configuration for a group
   */
  async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours): Promise<GroupScheduleConfig> {
    const response = await apiService.put(`/groups/${groupId}/schedule-config`, {
      scheduleHours
    });
    const apiResponse = response.data as ApiResponse<GroupScheduleConfig>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to update group schedule config');
  }

  /**
   * Reset schedule configuration to default
   */
  async resetGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const response = await apiService.post(`/groups/${groupId}/schedule-config/reset`);
    const apiResponse = response.data as ApiResponse<GroupScheduleConfig>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to reset group schedule config');
  }

  /**
   * Get default schedule hours
   */
  async getDefaultScheduleHours(): Promise<{ scheduleHours: ScheduleHours; isDefault: boolean }> {
    const response = await apiService.get('/groups/schedule-config/default');
    const apiResponse = response.data as ApiResponse<{ scheduleHours: ScheduleHours; isDefault: boolean }>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to get default schedule hours');
  }

  /**
   * Initialize default configurations for all groups
   */
  async initializeDefaultConfigs(): Promise<{ message: string }> {
    const response = await apiService.post('/groups/schedule-config/initialize');
    const apiResponse = response.data as ApiResponse<{ message: string }>;
    if (apiResponse.success && apiResponse.data) {
      return apiResponse.data;
    }
    throw new Error(apiResponse.error || 'Failed to initialize default configurations');
  }
}

export const scheduleConfigService = new ScheduleConfigService();