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
  groupId: string;
  groupName: string;
  scheduleSlotId: string;
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

// WeeklyDashboardResponse is now imported from api.ts (generated from OpenAPI)
// This old interface was kept for backwards compatibility during migration
// Re-export from api.ts to maintain compatibility
export type { WeeklyDashboardResponse } from './api';