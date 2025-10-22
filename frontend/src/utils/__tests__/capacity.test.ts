import { getEffectiveCapacity, hasSeatOverride, calculateTotalCapacity } from '../capacity';
import type { ScheduleSlotVehicle } from '../../services/apiService';

// Helper function to create mock vehicle assignments
const createMockVehicleAssignment = (overrides: Partial<ScheduleSlotVehicle> = {}): ScheduleSlotVehicle => ({
  id: 'assignment-1',
  scheduleSlotId: 'slot-1',
  vehicleId: 'vehicle-1',
  driverId: undefined,
  seatOverride: undefined,
  vehicle: {
    id: 'vehicle-1',
    name: 'Test Vehicle',
    capacity: 20
  },
  driver: undefined,
  ...overrides
});

describe('capacity utils', () => {
  describe('getEffectiveCapacity', () => {
    it('should return seat override when present', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: 15,
        vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 20 }
      });

      expect(getEffectiveCapacity(assignment)).toBe(15);
    });

    it('should return vehicle capacity when no seat override', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: undefined,
        vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 20 }
      });

      expect(getEffectiveCapacity(assignment)).toBe(20);
    });

    it('should return vehicle capacity when seat override is null', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: null as any,
        vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 20 }
      });

      expect(getEffectiveCapacity(assignment)).toBe(20);
    });

    it('should handle zero seat override', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: 0,
        vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 20 }
      });

      expect(getEffectiveCapacity(assignment)).toBe(0);
    });

    it('should handle seat override larger than vehicle capacity', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: 30,
        vehicle: { id: 'vehicle-1', name: 'Test Vehicle', capacity: 20 }
      });

      expect(getEffectiveCapacity(assignment)).toBe(30);
    });
  });

  describe('hasSeatOverride', () => {
    it('should return true when seat override is present', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: 15
      });

      expect(hasSeatOverride(assignment)).toBe(true);
    });

    it('should return true when seat override is zero', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: 0
      });

      expect(hasSeatOverride(assignment)).toBe(true);
    });

    it('should return false when seat override is undefined', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: undefined
      });

      expect(hasSeatOverride(assignment)).toBe(false);
    });

    it('should return false when seat override is null', () => {
      const assignment = createMockVehicleAssignment({
        seatOverride: null as any
      });

      expect(hasSeatOverride(assignment)).toBe(false);
    });
  });

  describe('calculateTotalCapacity', () => {
    it('should calculate total capacity for single vehicle without override', () => {
      const assignments = [
        createMockVehicleAssignment({
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(20);
    });

    it('should calculate total capacity for single vehicle with override', () => {
      const assignments = [
        createMockVehicleAssignment({
          seatOverride: 15,
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(15);
    });

    it('should calculate total capacity for multiple vehicles without overrides', () => {
      const assignments = [
        createMockVehicleAssignment({
          id: 'assignment-1',
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        }),
        createMockVehicleAssignment({
          id: 'assignment-2',
          vehicle: { id: 'vehicle-2', name: 'Vehicle 2', capacity: 15 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(35);
    });

    it('should calculate total capacity for multiple vehicles with mixed overrides', () => {
      const assignments = [
        createMockVehicleAssignment({
          id: 'assignment-1',
          seatOverride: 10,
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        }),
        createMockVehicleAssignment({
          id: 'assignment-2',
          seatOverride: undefined,
          vehicle: { id: 'vehicle-2', name: 'Vehicle 2', capacity: 15 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(25); // 10 (override) + 15 (default)
    });

    it('should handle empty array', () => {
      expect(calculateTotalCapacity([])).toBe(0);
    });

    it('should handle vehicles with zero capacity', () => {
      const assignments = [
        createMockVehicleAssignment({
          seatOverride: 0,
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        }),
        createMockVehicleAssignment({
          vehicle: { id: 'vehicle-2', name: 'Vehicle 2', capacity: 0 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(0);
    });

    it('should calculate correctly with all vehicles having overrides', () => {
      const assignments = [
        createMockVehicleAssignment({
          id: 'assignment-1',
          seatOverride: 5,
          vehicle: { id: 'vehicle-1', name: 'Vehicle 1', capacity: 20 }
        }),
        createMockVehicleAssignment({
          id: 'assignment-2',
          seatOverride: 8,
          vehicle: { id: 'vehicle-2', name: 'Vehicle 2', capacity: 15 }
        }),
        createMockVehicleAssignment({
          id: 'assignment-3',
          seatOverride: 12,
          vehicle: { id: 'vehicle-3', name: 'Vehicle 3', capacity: 10 }
        })
      ];

      expect(calculateTotalCapacity(assignments)).toBe(25); // 5 + 8 + 12
    });
  });
});