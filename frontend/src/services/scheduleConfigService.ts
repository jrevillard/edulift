import { apiService } from './apiService';

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
    return response.data;
  }

  /**
   * Get time slots for a specific group and weekday
   */
  async getGroupTimeSlots(groupId: string, weekday: string): Promise<GroupTimeSlots> {
    const response = await apiService.get(`/groups/${groupId}/schedule-config/time-slots?weekday=${weekday}`);
    return response.data;
  }

  /**
   * Update schedule configuration for a group
   */
  async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours): Promise<GroupScheduleConfig> {
    const response = await apiService.put(`/groups/${groupId}/schedule-config`, {
      scheduleHours
    });
    return response.data;
  }

  /**
   * Reset schedule configuration to default
   */
  async resetGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const response = await apiService.post(`/groups/${groupId}/schedule-config/reset`);
    return response.data;
  }

  /**
   * Get default schedule hours
   */
  async getDefaultScheduleHours(): Promise<{ scheduleHours: ScheduleHours; isDefault: boolean }> {
    const response = await apiService.get('/groups/schedule-config/default');
    return response.data;
  }

  /**
   * Initialize default configurations for all groups
   */
  async initializeDefaultConfigs(): Promise<{ message: string }> {
    const response = await apiService.post('/groups/schedule-config/initialize');
    return response.data;
  }
}

export const scheduleConfigService = new ScheduleConfigService();