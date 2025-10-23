export interface ScheduleSlotNotificationData {
  scheduleSlotId: string;
  datetime: string; // UTC ISO datetime string - client handles timezone conversion
  vehicles?: Array<{
    name: string;
    capacity: number;
    driverName?: string;
  }>;
  totalCapacity?: number;
  assignedChildren: string[];
  groupName: string;
  changeType: 'SLOT_CREATED' | 'DRIVER_ASSIGNED' | 'VEHICLE_ASSIGNED' | 'VEHICLE_REMOVED' | 'CHILD_ADDED' | 'CHILD_REMOVED' | 'SLOT_CANCELLED' | 'SEAT_OVERRIDE_UPDATED';
}

export interface DailyReminderSlot {
  datetime?: string;
  day?: string;
  time?: string;
  driverName?: string;
  vehicleName?: string;
  children?: string[];
  role?: string;
}

export interface GroupInvitationData {
  to: string;
  groupName: string;
  inviteCode: string;
  role: string;
  personalMessage?: string;
  platform?: 'web' | 'native';
}

export interface FamilyInvitationData {
  inviterName: string;
  familyName: string;
  inviteCode: string;
  personalMessage?: string;
  role: string;
  platform?: 'web' | 'native';
}

export interface EmailServiceInterface {
  sendMagicLink(email: string, token: string, inviteCode?: string, magicLinkUrl?: string): Promise<void>;
  sendScheduleNotification(email: string, groupName: string, weekInfo: string, platform?: 'web' | 'native'): Promise<void>;
  sendGroupInvitation(data: GroupInvitationData): Promise<void>;
  sendFamilyInvitation(email: string, invitationData: FamilyInvitationData): Promise<void>;
  sendScheduleSlotNotification(email: string, data: ScheduleSlotNotificationData, platform?: 'web' | 'native'): Promise<void>;
  sendDailyReminder(email: string, groupName: string, tomorrowTrips: DailyReminderSlot[], platform?: 'web' | 'native'): Promise<void>;
  sendWeeklySchedule(email: string, groupName: string, weekInfo: string, scheduleData: any, platform?: 'web' | 'native'): Promise<void>;
  verifyConnection(): Promise<boolean>;
}