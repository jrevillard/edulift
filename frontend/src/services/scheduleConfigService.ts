import { api } from './api';
import type { GroupScheduleConfig } from '@/types/api';

// Types based on OpenAPI schema responses
export interface ScheduleHours {
  [key: string]: string[]; // { 'MONDAY': ['07:00', '07:30'], 'TUESDAY': ['08:00'] }
}

// Re-export GroupScheduleConfig from generated types for convenience
export type { GroupScheduleConfig };

class ScheduleConfigService {
  /**
   * Get schedule configuration for a group
   */
  async getGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const { data, error } = await api.GET('/api/v1/groups/{groupId}/schedule-config', {
      params: { path: { groupId } }
    });

    if (error) {
      throw new Error(typeof error === 'string' ? error : 'Failed to get group schedule config');
    }

    if (!data) {
      throw new Error('Failed to get group schedule config');
    }

    // Extract the actual data from the response wrapper
    return (data as { data: GroupScheduleConfig }).data;
  }


  /**
   * Update schedule configuration for a group
   */
  async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours): Promise<GroupScheduleConfig> {
    const { data, error } = await api.PUT('/api/v1/groups/{groupId}/schedule-config', {
      params: { path: { groupId } },
      body: { scheduleHours }
    });

    if (error) {
      throw new Error(typeof error === 'string' ? error : 'Failed to update group schedule config');
    }

    if (!data) {
      throw new Error('Failed to update group schedule config');
    }

    // Extract the actual data from the response wrapper
    return (data as { data: GroupScheduleConfig }).data;
  }

  /**
   * Reset schedule configuration to default
   */
  async resetGroupScheduleConfig(groupId: string): Promise<GroupScheduleConfig> {
    const { data, error } = await api.POST('/api/v1/groups/{groupId}/schedule-config/reset', {
      params: { path: { groupId } }
    });

    if (error) {
      throw new Error(typeof error === 'string' ? error : 'Failed to reset group schedule config');
    }

    if (!data) {
      throw new Error('Failed to reset group schedule config');
    }

    // Extract the actual data from the response wrapper
    return (data as { data: GroupScheduleConfig }).data;
  }

}

export const scheduleConfigService = new ScheduleConfigService();
