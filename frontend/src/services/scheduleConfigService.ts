import { api } from './api';
import type { GroupScheduleConfig } from '@/types/api';

// Types based on OpenAPI schema responses
export interface ScheduleHours {
  [key: string]: string[]; // { 'MONDAY': ['07:00', '07:30'], 'TUESDAY': ['08:00'] }
}

// Re-export GroupScheduleConfig from generated types for convenience
export type { GroupScheduleConfig };

export interface GroupTimeSlots {
  groupId: string;
  weekday: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  timeSlots: string[];
}

export interface DefaultScheduleHours {
  scheduleHours: ScheduleHours;
  isDefault: true;
}

class ScheduleConfigService {
  /**
   * Get schedule configuration for a group
   */
  async getGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const { data, error } = await api.GET('/groups/{groupId}/schedule-config', {
      params: { path: { groupId } }
    });

    if (error || !data?.success || !data?.data) {
      throw new Error(error || 'Failed to get group schedule config');
    }
    return data.data;
  }

  /**
   * Get time slots for a specific group and weekday
   */
  async getGroupTimeSlots(groupId: string, weekday: GroupTimeSlots['weekday']): Promise<GroupTimeSlots> {
    const { data, error } = await api.GET('/groups/{groupId}/schedule-config/time-slots', {
      params: {
        path: { groupId },
        query: { weekday }
      }
    });

    if (error || !data?.success || !data?.data) {
      throw new Error(error || 'Failed to get group time slots');
    }
    return data.data;
  }

  /**
   * Update schedule configuration for a group
   */
  async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours): Promise<GroupScheduleConfig> {
    const { data, error } = await api.PUT('/groups/{groupId}/schedule-config', {
      params: { path: { groupId } },
      body: { scheduleHours }
    });

    if (error || !data?.success || !data?.data) {
      throw new Error(error || 'Failed to update group schedule config');
    }
    return data.data;
  }

  /**
   * Reset schedule configuration to default
   */
  async resetGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const { data, error } = await api.POST('/groups/{groupId}/schedule-config/reset', {
      params: { path: { groupId } }
    });

    if (error || !data?.success || !data?.data) {
      throw new Error(error || 'Failed to reset group schedule config');
    }
    return data.data;
  }

  /**
   * Get default schedule hours
   */
  async getDefaultScheduleHours(): Promise<DefaultScheduleHours> {
    const { data, error } = await api.GET('/groups/schedule-config/default');

    if (error || !data?.success || !data?.data) {
      throw new Error(error || 'Failed to get default schedule hours');
    }
    return data.data;
  }
}

export const scheduleConfigService = new ScheduleConfigService();
