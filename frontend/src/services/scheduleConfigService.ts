import { api } from './api';

// Types based on OpenAPI schema responses
export interface ScheduleHours {
  [key: string]: string[]; // { 'MONDAY': ['07:00', '07:30'], 'TUESDAY': ['08:00'] }
}

export interface GroupScheduleConfig {
  id: string;
  groupId: string;
  scheduleHours: ScheduleHours;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

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
    const { data } = await api.GET('/groups/{groupId}/schedule-config', {
      params: { path: { groupId } }
    });

    if (data?.data) {
      return data.data;
    }
    throw new Error('Failed to get group schedule config');
  }

  /**
   * Get time slots for a specific group and weekday
   */
  async getGroupTimeSlots(groupId: string, weekday: GroupTimeSlots['weekday']): Promise<GroupTimeSlots> {
    const { data } = await api.GET('/groups/{groupId}/schedule-config/time-slots', {
      params: {
        path: { groupId },
        query: { weekday }
      }
    });

    if (data?.data) {
      return {
        groupId: data.data.groupId,
        weekday: data.data.weekday,
        timeSlots: data.data.timeSlots
      };
    }
    throw new Error('Failed to get group time slots');
  }

  /**
   * Update schedule configuration for a group
   */
  async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours): Promise<GroupScheduleConfig> {
    const { data } = await api.PUT('/groups/{groupId}/schedule-config', {
      params: { path: { groupId } },
      body: { scheduleHours }
    });

    if (data?.data) {
      return data.data;
    }
    throw new Error('Failed to update group schedule config');
  }

  /**
   * Reset schedule configuration to default
   */
  async resetGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const { data } = await api.POST('/groups/{groupId}/schedule-config/reset', {
      params: { path: { groupId } }
    });

    if (data?.data) {
      return data.data;
    }
    throw new Error('Failed to reset group schedule config');
  }

  /**
   * Get default schedule hours
   */
  async getDefaultScheduleHours(): Promise<DefaultScheduleHours> {
    const { data } = await api.GET('/groups/schedule-config/default');

    if (data?.data) {
      return data.data;
    }
    throw new Error('Failed to get default schedule hours');
  }
}

export const scheduleConfigService = new ScheduleConfigService();