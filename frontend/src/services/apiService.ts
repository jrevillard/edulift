import axios from 'axios';
import type { ApiResponse } from '@/types';
import type { WeeklyDashboardResponse } from '@/types/dashboard';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import { API_BASE_URL } from '@/config/runtime';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// Custom error class for 409 Conflict responses
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserGroup {
  // Group information
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  familyId: string;
  createdAt: string;
  updatedAt: string;
  
  // Membership information
  userRole: 'ADMIN' | 'MEMBER';
  joinedAt?: string;
  
  // Owner family information
  ownerFamily: {
    id: string;
    name: string;
  };
  
  // Counts
  familyCount: number;
  scheduleCount: number;
}

export interface GroupMember {
  userId: string;
  userName: string;
  userEmail: string;
  familyId: string;
  familyName: string;
  familyRole: 'ADMIN' | 'MEMBER';
  groupRole: 'ADMIN' | 'MEMBER' | 'OWNER';
}

export interface GroupFamily {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'PENDING';
  isMyFamily: boolean;
  canManage: boolean;
  // Support for multiple admins
  admins: Array<{
    name: string;
    email: string;
  }>;
  // Fields for pending invitations (present when status is PENDING)
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  invitationId?: string;
  inviteCode?: string;
  invitedAt?: string;
  expiresAt?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  personalMessage?: string;
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  inviteCode: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Child {
  id: string;
  name: string;
  age?: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
  groupMemberships?: GroupChildMembership[];
}

export interface GroupChildMembership {
  childId: string;
  groupId: string;
  addedBy: string;
  addedAt: string;
  group: {
    id: string;
    name: string;
  };
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSlot {
  id: string;
  groupId: string;
  datetime: string; // ISO 8601 UTC datetime string
  vehicleAssignments: ScheduleSlotVehicle[];
  childAssignments: {
    vehicleAssignmentId: string;
    child: {
      id: string;
      name: string;
    };
  }[];
  totalCapacity: number;
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSlotVehicle {
  id: string;
  scheduleSlotId: string;
  vehicleId: string;
  driverId?: string;
  seatOverride?: number;
  vehicle: {
    id: string;
    name: string;
    capacity: number;
  };
  driver?: {
    id: string;
    name: string;
  };
}

// Dashboard Types
export interface TrendData {
  value: string;
  direction: 'up' | 'down' | 'neutral';
  period: string;
}

export interface DashboardStats {
  groups: number;
  children: number;
  vehicles: number;
  thisWeekTrips: number;
  trends: {
    groups: TrendData;
    children: TrendData;
    vehicles: TrendData;
    trips: TrendData;
  };
}

export interface TodayTrip {
  id: string;
  time: string; // UTC time in HH:MM format for backward compatibility
  datetime: string; // ISO 8601 datetime string for timezone conversion
  destination: string;
  type: 'pickup' | 'dropoff';
  date: string;
  children: {
    id: string;
    name: string;
  }[];
  vehicle?: {
    id: string;
    name: string;
    capacity: number;
  };
  driver?: {
    id: string;
    name: string;
  };
  group: {
    id: string;
    name: string;
  };
}

export interface TodaySchedule {
  upcomingTrips: TodayTrip[];
}

export interface ActivityItem {
  id: string;
  action: string;
  time: string;
  timestamp: Date;
  type: 'group' | 'vehicle' | 'child' | 'schedule';
  entityId?: string;
  entityName?: string;
}

export interface RecentActivity {
  activities: ActivityItem[];
}

// Weekly Dashboard Types (backend correspondence)
export type CapacityStatus = 'available' | 'limited' | 'full' | 'overcapacity';

export interface DayTransportSummary {
  date: string; // ISO date (YYYY-MM-DD)
  transports: TransportSlotSummary[];
  totalChildrenInVehicles: number;
  totalVehiclesWithAssignments: number;
  hasScheduledTransports: boolean;
}

export interface TransportSlotSummary {
  time: string; // Format HH:mm
  destination: string;
  vehicleAssignmentSummaries: VehicleAssignmentSummary[];
  totalChildrenAssigned: number;
  totalCapacity: number;
  overallCapacityStatus: CapacityStatus;
}

export interface VehicleAssignmentSummary {
  vehicleId: string;
  vehicleName: string;
  vehicleCapacity: number;
  assignedChildrenCount: number;
  availableSeats: number;
  capacityStatus: CapacityStatus;
  vehicleFamilyId: string;
  isFamilyVehicle: boolean;
  driver?: {
    id: string;
    name: string;
  } | undefined;
  // Optional children details for API responses
  children?: {
    childId: string;
    childName: string;
    childFamilyId: string;
    isFamilyChild: boolean;
  }[];
}


export interface FamilySearchResult {
  id: string;
  name: string;
  adminContacts: Array<{
    name: string;
    email: string;
  }>;
  memberCount: number;
  canInvite: boolean;
}

export interface GroupInvitationEligibility {
  canJoin?: boolean;
  requiresAccountCreation?: boolean;
  requiresFamilyCreation?: boolean;
  cannotJoin?: boolean;
  reason?: string;
  redirectTo?: string;
  userFamily?: {
    id: string;
    name: string;
  };
  groupInfo?: {
    id: string;
    name: string;
  };
}

export interface PendingGroupInvitation {
  id: string;
  email: string;
  groupId: string;
  groupName: string;
  inviteCode: string;
  inviterName?: string;
  expiresAt: string;
  createdAt: string;
  group: {
    id: string;
    name: string;
    inviteCode: string;
  };
}

export interface FamilyInvitationResult {
  id: string;
  email: string;
  familyId: string;
  groupId: string;
  role: 'MEMBER' | 'ADMIN';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  personalMessage?: string;
  invitedBy: string;
  inviteCode: string;
  createdAt: string;
  expiresAt: string;
}

export interface GroupJoinResult {
  userGroup: UserGroup;
  familyRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedFamilies?: Array<{
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  }>;
}

class ApiService {
  // Group Management
  async createGroup(name: string): Promise<UserGroup> {
    const response = await axios.post<ApiResponse<UserGroup>>(`${API_BASE_URL}/groups`, {
      name
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create group');
    }

    return response.data.data;
  }

  async joinGroup(inviteCode: string): Promise<UserGroup> {
    try {
      const response = await axios.post<ApiResponse<UserGroup>>(`${API_BASE_URL}/groups/join`, {
        inviteCode
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to join group');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;
        
        // Extract error message from API response
        const apiErrorMessage = data?.error || data?.message;
        
        switch (status) {
          case 400:
            if (apiErrorMessage?.includes('invite') || apiErrorMessage?.includes('code')) {
              throw new Error('Invalid group invite code. Please check the code and try again.');
            }
            throw new Error(apiErrorMessage || 'Invalid invite code. Please check and try again.');
          case 404:
            throw new Error('Group invitation not found or has expired.');
          case 403:
            throw new Error('You do not have permission to join this group.');
          case 409:
            throw new Error('Your family is already a member of this group.');
          default:
            throw new Error(apiErrorMessage || 'Unable to join group. Please try again later.');
        }
      }
      
      // Network or other errors
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  async getUserGroups(): Promise<UserGroup[]> {
    const response = await axios.get<ApiResponse<UserGroup[]>>(`${API_BASE_URL}/groups/my-groups`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch groups');
    }

    return response.data.data;
  }

  async getGroupFamilies(groupId: string): Promise<GroupFamily[]> {
    const response = await axios.get<ApiResponse<GroupFamily[]>>(`${API_BASE_URL}/groups/${groupId}/families`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch group families');
    }

    return response.data.data;
  }

  async updateFamilyRole(groupId: string, familyId: string, role: 'ADMIN' | 'MEMBER'): Promise<void> {
    const response = await axios.patch<ApiResponse<void>>(
      `${API_BASE_URL}/groups/${groupId}/families/${familyId}/role`,
      { role }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update family role');
    }
  }

  async removeFamilyFromGroup(groupId: string, familyId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/groups/${groupId}/families/${familyId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove family from group');
    }
  }

  async regenerateInviteCode(groupId: string): Promise<Group> {
    const response = await axios.post<ApiResponse<Group>>(`${API_BASE_URL}/groups/${groupId}/invite-code/regenerate`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to regenerate invite code');
    }

    return response.data.data;
  }

  async updateGroup(groupId: string, updateData: { name?: string; description?: string }): Promise<Group> {
    const response = await axios.patch<ApiResponse<Group>>(`${API_BASE_URL}/groups/${groupId}`, updateData);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update group');
    }

    return response.data.data;
  }

  async deleteGroup(groupId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/groups/${groupId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete group');
    }
  }

  async leaveGroup(groupId: string): Promise<void> {
    const response = await axios.post<ApiResponse<void>>(`${API_BASE_URL}/groups/${groupId}/leave`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to leave group');
    }
  }

  // Group Invitation Management
  async inviteGroupMember(groupId: string, data: {
    email: string;
    role: 'ADMIN' | 'MEMBER';
    personalMessage?: string;
  }): Promise<GroupInvitation> {
    const response = await axios.post<ApiResponse<GroupInvitation>>(
      `${API_BASE_URL}/groups/${groupId}/invite`,
      data
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to send group invitation');
    }

    return response.data.data;
  }

  async getGroupInvitations(groupId: string): Promise<GroupInvitation[]> {
    const response = await axios.get<ApiResponse<GroupInvitation[]>>(
      `${API_BASE_URL}/groups/${groupId}/invitations`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch group invitations');
    }

    return response.data.data;
  }

  async cancelGroupInvitation(groupId: string, invitationId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(
      `${API_BASE_URL}/groups/${groupId}/invitations/${invitationId}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel group invitation');
    }
  }

  // Child Management
  async createChild(name: string, age?: number): Promise<Child> {
    const response = await axios.post<ApiResponse<Child>>(`${API_BASE_URL}/children`, {
      name,
      age
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create child');
    }

    return response.data.data;
  }

  async getChildren(): Promise<Child[]> {
    const response = await axios.get<ApiResponse<Child[]>>(`${API_BASE_URL}/children`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch children');
    }

    return response.data.data;
  }

  async updateChild(childId: string, data: { name?: string; age?: number }): Promise<Child> {
    const response = await axios.patch<ApiResponse<Child>>(`${API_BASE_URL}/children/${childId}`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update child');
    }

    return response.data.data;
  }

  async deleteChild(childId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/children/${childId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete child');
    }
  }

  // Vehicle Management
  async createVehicle(name: string, capacity: number): Promise<Vehicle> {
    const response = await axios.post<ApiResponse<Vehicle>>(`${API_BASE_URL}/vehicles`, {
      name,
      capacity
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create vehicle');
    }

    return response.data.data;
  }

  async getVehicles(): Promise<Vehicle[]> {
    const response = await axios.get<ApiResponse<Vehicle[]>>(`${API_BASE_URL}/vehicles`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch vehicles');
    }

    return response.data.data;
  }

  async updateVehicle(vehicleId: string, data: { name?: string; capacity?: number }): Promise<Vehicle> {
    const response = await axios.patch<ApiResponse<Vehicle>>(`${API_BASE_URL}/vehicles/${vehicleId}`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update vehicle');
    }

    return response.data.data;
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/vehicles/${vehicleId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete vehicle');
    }
  }

  // Scheduling
  async getWeeklySchedule(groupId: string, week?: string, userTimezone?: string): Promise<{ scheduleSlots: ScheduleSlot[] }> {
    // Calculate date range from week if provided, otherwise use current week
    let queryParams = '';

    if (week) {
      // Use timezone-aware week calculation from weekCalculations utility
      const { getWeekBoundaries } = await import('../utils/weekCalculations');
      const tz = userTimezone || dayjs.tz.guess();
      const [year, weekNum] = week.split('-').map(Number);
      const dateInWeek = dayjs().year(year).isoWeek(weekNum).toDate();
      const { weekStart, weekEnd } = getWeekBoundaries(dateInWeek, tz);

      queryParams = `?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`;
    }
    
    const response = await axios.get<ApiResponse<{ scheduleSlots: ScheduleSlot[] }>>(
      `${API_BASE_URL}/groups/${groupId}/schedule${queryParams}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch schedule');
    }

    return response.data.data;
  }

  async createScheduleSlotWithVehicle(
    groupId: string,
    day: string,
    time: string,
    week: string,
    vehicleId: string,
    driverId?: string,
    seatOverride?: number,
    userTimezone?: string
  ): Promise<ScheduleSlot> {
    // Use user timezone if provided, otherwise use browser timezone
    const tz = userTimezone || dayjs.tz.guess();

    // Convert day/week/time to UTC datetime string using proper ISO week calculation
    const [year, weekNum] = week.split('-').map(Number);

    // Calculate the Monday of the specified ISO week (proper ISO calculation)
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Convert to Monday=0, Tuesday=1, etc.
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - jan4DayOfWeek + (weekNum - 1) * 7);

    // Map day names to offsets
    const dayOffsets: Record<string, number> = {
      'MONDAY': 0, 'TUESDAY': 1, 'WEDNESDAY': 2, 'THURSDAY': 3,
      'FRIDAY': 4, 'SATURDAY': 5, 'SUNDAY': 6
    };

    const dayOffset = dayOffsets[day.toUpperCase()];
    if (dayOffset === undefined) {
      throw new Error(`Invalid day name: ${day}`);
    }

    // Calculate target date
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);

    // Parse time - this is in the user's timezone
    const [hours, minutes] = time.split(':').map(Number);

    // Create datetime in user timezone, then convert to UTC
    const localDateTime = dayjs(targetDate)
      .tz(tz)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0);

    const utcDateTime = localDateTime.utc().toISOString();

    const response = await axios.post<ApiResponse<ScheduleSlot>>(`${API_BASE_URL}/groups/${groupId}/schedule-slots`, {
      datetime: utcDateTime,
      vehicleId,
      driverId,
      seatOverride
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create schedule slot with vehicle');
    }

    return response.data.data;
  }

  async assignVehicleToScheduleSlot(scheduleSlotId: string, vehicleId: string, driverId?: string, seatOverride?: number): Promise<ScheduleSlotVehicle> {
    const response = await axios.post<ApiResponse<ScheduleSlotVehicle>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/vehicles`, {
      vehicleId,
      driverId,
      seatOverride
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to assign vehicle to schedule slot');
    }

    return response.data.data;
  }

  async removeVehicleFromScheduleSlot(scheduleSlotId: string, vehicleId: string): Promise<{ slotDeleted: boolean }> {
    const response = await axios.delete<ApiResponse<{ message: string; slotDeleted: boolean }>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/vehicles`, {
      data: { vehicleId }
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove vehicle from schedule slot');
    }

    return { slotDeleted: response.data.data?.slotDeleted || false };
  }

  async updateScheduleSlotVehicleDriver(scheduleSlotId: string, vehicleId: string, driverId: string | null): Promise<ScheduleSlotVehicle> {
    const response = await axios.patch<ApiResponse<ScheduleSlotVehicle>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/vehicles/${vehicleId}/driver`, {
      driverId
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update vehicle driver');
    }

    return response.data.data;
  }

  async updateVehicleAssignmentSeatOverride(vehicleAssignmentId: string, seatOverride?: number): Promise<ScheduleSlotVehicle> {
    const response = await axios.patch<ApiResponse<ScheduleSlotVehicle>>(`${API_BASE_URL}/vehicle-assignments/${vehicleAssignmentId}/seat-override`, {
      seatOverride
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update seat override');
    }

    return response.data.data;
  }

  async assignChildToScheduleSlot(scheduleSlotId: string, childId: string, vehicleAssignmentId: string): Promise<void> {
    try {
      const response = await axios.post<ApiResponse<void>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/children`, {
        childId,
        vehicleAssignmentId
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to assign child to schedule slot');
      }
    } catch (error) {
      // Handle 409 Conflict specifically (race condition / capacity changed)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const conflictMessage = error.response.data?.error || error.response.data?.message ||
          'Vehicle capacity changed while editing. Another parent just assigned a child. Please refresh and try again.';
        throw new ConflictError(conflictMessage);
      }
      throw error;
    }
  }

  async removeChildFromScheduleSlot(scheduleSlotId: string, childId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/children/${childId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove child from schedule slot');
    }
  }

  async getScheduleSlotDetails(scheduleSlotId: string): Promise<ScheduleSlot> {
    const response = await axios.get<ApiResponse<ScheduleSlot>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get schedule slot details');
    }

    return response.data.data;
  }

  async getScheduleSlotConflicts(scheduleSlotId: string): Promise<string[]> {
    const response = await axios.get<ApiResponse<{ conflicts: string[] }>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/conflicts`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get schedule slot conflicts');
    }

    return response.data.data.conflicts;
  }

  // New child assignment methods
  async getAvailableChildrenForScheduleSlot(scheduleSlotId: string): Promise<Child[]> {
    const response = await axios.get<ApiResponse<Child[]>>(`${API_BASE_URL}/schedule-slots/${scheduleSlotId}/available-children`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get available children');
    }

    return response.data.data;
  }

  async addChildToGroup(childId: string, groupId: string): Promise<GroupChildMembership> {
    const response = await axios.post<ApiResponse<GroupChildMembership>>(`${API_BASE_URL}/children/${childId}/groups/${groupId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to add child to group');
    }

    return response.data.data;
  }

  async removeChildFromGroup(childId: string, groupId: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${API_BASE_URL}/children/${childId}/groups/${groupId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove child from group');
    }
  }

  async getChildGroupMemberships(childId: string): Promise<GroupChildMembership[]> {
    const response = await axios.get<ApiResponse<GroupChildMembership[]>>(`${API_BASE_URL}/children/${childId}/groups`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get child group memberships');
    }

    return response.data.data;
  }

  // Dashboard API methods
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await axios.get<ApiResponse<DashboardStats>>(`${API_BASE_URL}/dashboard/stats`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch dashboard stats');
    }

    return response.data.data;
  }

  async getTodaySchedule(): Promise<TodaySchedule> {
    const response = await axios.get<ApiResponse<TodaySchedule>>(`${API_BASE_URL}/dashboard/today-schedule`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch today schedule');
    }

    return response.data.data;
  }

  async getDashboardWeeklySchedule(): Promise<WeeklyDashboardResponse> {
    const response = await axios.get<WeeklyDashboardResponse>(`${API_BASE_URL}/dashboard/weekly`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch weekly dashboard');
    }

    return response.data;
  }

  async getRecentActivity(): Promise<RecentActivity> {
    const response = await axios.get<ApiResponse<RecentActivity>>(`${API_BASE_URL}/dashboard/recent-activity`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch recent activity');
    }

    return response.data.data;
  }

  async getWeeklyDashboard(startDate?: string): Promise<WeeklyDashboardResponse> {
    const queryParams = startDate ? `?startDate=${startDate}` : '';
    const response = await axios.get<WeeklyDashboardResponse>(`${API_BASE_URL}/dashboard/weekly${queryParams}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch weekly dashboard');
    }

    return response.data;
  }

  // Pending Group Invitation Management
  async storePendingGroupInvitation(email: string, groupId: string, inviteCode: string): Promise<void> {
    const response = await axios.post<ApiResponse<null>>(`${API_BASE_URL}/groups/pending-invitation`, {
      email,
      groupId,
      inviteCode
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to store pending group invitation');
    }
  }

  async getPendingGroupInvitationByEmail(email: string): Promise<PendingGroupInvitation | null> {
    try {
      const response = await axios.get<ApiResponse<PendingGroupInvitation>>(
        `${API_BASE_URL}/groups/pending-invitation/${encodeURIComponent(email)}`
      );

      if (response.data.success && response.status === 200 && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async searchFamiliesForInvitation(groupId: string, searchTerm: string): Promise<FamilySearchResult[]> {
    const response = await axios.post<ApiResponse<FamilySearchResult[]>>(
      `${API_BASE_URL}/groups/${groupId}/search-families`,
      { searchTerm }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to search families');
    }

    return response.data.data;
  }

  async inviteFamilyToGroup(groupId: string, familyId: string, role: 'MEMBER' | 'ADMIN', personalMessage?: string): Promise<FamilyInvitationResult> {
    const response = await axios.post<ApiResponse<FamilyInvitationResult>>(
      `${API_BASE_URL}/groups/${groupId}/invite`,
      { familyId, role, personalMessage }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to invite family to group');
    }

    return response.data.data;
  }

  async validateGroupInvitationEligibility(groupId: string, inviteCode: string): Promise<GroupInvitationEligibility> {
    const response = await axios.post<ApiResponse<GroupInvitationEligibility>>(
      `${API_BASE_URL}/groups/${groupId}/validate-invitation`,
      { inviteCode }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to validate invitation eligibility');
    }

    return response.data.data;
  }

  async joinGroupWithFamily(groupId: string, inviteCode: string): Promise<GroupJoinResult> {
    const response = await axios.post<ApiResponse<GroupJoinResult>>(
      `${API_BASE_URL}/groups/${groupId}/join-with-family`,
      { inviteCode }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to join group with family');
    }

    return response.data.data;
  }

  // Generic HTTP methods for other services
  async post<T = unknown>(endpoint: string, data?: unknown): Promise<{ data: T }> {
    const response = await axios.post<T>(`${API_BASE_URL}${endpoint}`, data);
    return { data: response.data };
  }

  async get<T = unknown>(endpoint: string): Promise<{ data: T }> {
    const response = await axios.get<T>(`${API_BASE_URL}${endpoint}`);
    return { data: response.data };
  }

  async put<T = unknown>(endpoint: string, data?: unknown): Promise<{ data: T }> {
    const response = await axios.put<T>(`${API_BASE_URL}${endpoint}`, data);
    return { data: response.data };
  }

  async delete<T = unknown>(endpoint: string): Promise<{ data: T }> {
    const response = await axios.delete<T>(`${API_BASE_URL}${endpoint}`);
    return { data: response.data };
  }
}

export const apiService = new ApiService();