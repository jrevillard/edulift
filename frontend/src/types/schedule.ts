/**
 * DEPRECATED: Legacy schedule types
 * 
 * Modern schedule types are now defined in apiService.ts:
 * - ScheduleSlot
 * - ScheduleSlotVehicle
 * - Child assignments via vehicleAssignmentId
 * 
 * This file is kept for backward compatibility only.
 * Use the apiService.ts types for all new development.
 */

export interface Assignment {
  id: string;
  name: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  vehicle?: {
    name: string;
    capacity: number;
  };
  driver?: {
    name: string;
  };
  assignments: Assignment[];
}

export interface ScheduleData {
  [key: string]: TimeSlot[]; // Key is day of week (e.g., 'Mon')
}
