export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  timezone?: string; // IANA timezone
}

// Extend Express Request interface to include authenticated user
declare module 'express' {
  interface User {
    id: string;
    email: string;
    name: string;
    timezone?: string;
  }
}

export interface CreateUserData {
  email: string;
  name: string;
  timezone?: string; // Optional on creation, defaults to UTC
}

export interface UpdateProfileData {
  name?: string | undefined;
  email?: string | undefined;
  timezone?: string | undefined; // Allow users to update their timezone
}

export interface CreateGroupData {
  name: string;
  familyId: string;  // Groups are created by families
  createdBy: string; // User who created it (must be family ADMIN)
}

export interface CreateChildData {
  name: string;
  age?: number;
  familyId: string;
}

export interface CreateVehicleData {
  name: string;
  capacity: number;
  familyId: string;
}

export interface CreateScheduleSlotData {
  groupId: string;
  datetime: string; // UTC ISO datetime string (e.g., "2024-06-24T15:00:00.000Z")
  // timezone is no longer needed - fetched from authenticated user's DB record
}

export interface AssignVehicleToSlotData {
  scheduleSlotId: string;
  vehicleId: string;
  driverId?: string;
  seatOverride?: number;
}

export interface AssignChildToSlotData {
  scheduleSlotId: string;
  childId: string;
  vehicleAssignmentId: string;
}

export interface UpdateSeatOverrideData {
  vehicleAssignmentId: string;
  seatOverride?: number;
}

export interface WeeklySchedule {
  week: string;
  groupId: string;
  scheduleSlots: ScheduleSlotWithDetails[];
}

export interface ScheduleSlotWithDetails {
  id: string;
  groupId: string;
  datetime: Date;
  vehicleAssignments: Array<{
    id: string;
    vehicleId: string;
    scheduleSlotId: string;
    driverId: string | null;
    seatOverride: number | null;
    createdAt: string;
    vehicle: {
      id: string;
      name: string;
      capacity: number;
      familyId: string;
      createdAt: string;
      updatedAt: string;
    };
    driver?: {
      id: string;
      name: string;
      email: string;
    } | null;
    childAssignments?: Array<{
      id: string;
      childId: string;
      vehicleAssignmentId: string;
      child?: {
        id: string;
        name: string;
        age: number | null;
        familyId: string;
        createdAt: string;
        updatedAt: string;
      };
    }>;
  }>;
  childAssignments: Array<{
    id: string;
    scheduleSlotId: string;
    childId: string;
    vehicleAssignmentId: string;
    assignedAt: string;
    child?: {
      id: string;
      name: string;
      age: number | null;
      familyId: string;
      createdAt: string;
      updatedAt: string;
    };
    vehicleAssignment?: {
      id: string;
      vehicleId: string;
      scheduleSlotId: string;
      driverId: string | null;
      seatOverride: number | null;
      createdAt: string;
      vehicle: {
        id: string;
        name: string;
        capacity: number;
        familyId: string;
        createdAt: string;
        updatedAt: string;
      };
      driver?: {
        id: string;
        name: string;
        email: string;
      } | null;
    };
  }>;
  totalCapacity: number;
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocketEvents {
  'scheduleSlot:updated': (data: ScheduleSlotWithDetails) => void;
  'schedule:locked': (data: { week: string; groupId: string }) => void;
  'user:joined': (data: { userId: string; groupId: string }) => void;
  'conflict:detected': (data: { scheduleSlotId: string; message: string }) => void;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  expected?: any;
  received?: any;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  validationErrors?: ValidationError[];
}