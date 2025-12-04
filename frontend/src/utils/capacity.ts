import type { ScheduleSlotVehicle } from '../types/api';

/**
 * Calculate the effective capacity for a vehicle assignment
 * Takes into account seat override if present, otherwise uses vehicle capacity
 */
export function getEffectiveCapacity(vehicleAssignment: ScheduleSlotVehicle): number {
  if (!vehicleAssignment.vehicle) return 0;
  return vehicleAssignment.seatOverride ?? vehicleAssignment.vehicle.capacity;
}

/**
 * Check if a vehicle assignment has a seat override applied
 */
export function hasSeatOverride(vehicleAssignment: ScheduleSlotVehicle): boolean {
  return vehicleAssignment.seatOverride !== undefined && vehicleAssignment.seatOverride !== null;
}

/**
 * Calculate the total effective capacity for a schedule slot
 */
export function calculateTotalCapacity(vehicleAssignments: ScheduleSlotVehicle[]): number {
  return vehicleAssignments.reduce((total, assignment) => total + getEffectiveCapacity(assignment), 0);
}