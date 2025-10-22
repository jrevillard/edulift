/**
 * Vehicle-related constants for the EduLift application
 */

export const VEHICLE_CONSTRAINTS = {
  /**
   * Maximum number of seats allowed for any vehicle or seat override
   * This limit applies to both vehicle capacity and seat overrides
   */
  MAX_CAPACITY: 10,
  
  /**
   * Minimum number of seats required for any vehicle
   */
  MIN_CAPACITY: 1
} as const;