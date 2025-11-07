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
  };
}

export interface WeeklyDashboardResponse {
  success: boolean;
  data: {
    days: DayTransportSummary[];
  };
}
