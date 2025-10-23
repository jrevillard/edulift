import { ScheduleSlotValidationService } from '../ScheduleSlotValidationService';
import { PrismaClient } from '@prisma/client';
import { VEHICLE_CONSTRAINTS } from '../../constants/vehicle';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    scheduleSlot: {
      findUnique: jest.fn(),
    },
    scheduleSlotVehicle: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('ScheduleSlotValidationService - Max Capacity Tests', () => {
  let validationService: ScheduleSlotValidationService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    validationService = new ScheduleSlotValidationService(mockPrisma);
  });

  describe('Seat Override Validation with New Max Capacity', () => {
    it('should allow seat override of exactly 10', async () => {
      await expect(validationService.validateSeatOverride(10)).resolves.not.toThrow();
    });

    it('should reject seat override of 11', async () => {
      await expect(validationService.validateSeatOverride(11)).rejects.toThrow(
        `Seat override cannot exceed ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats (application limit)`,
      );
    });

    it('should reject seat override of 50 (old limit)', async () => {
      await expect(validationService.validateSeatOverride(50)).rejects.toThrow(
        `Seat override cannot exceed ${VEHICLE_CONSTRAINTS.MAX_CAPACITY} seats (application limit)`,
      );
    });

    it('should reject negative seat override', async () => {
      await expect(validationService.validateSeatOverride(-1)).rejects.toThrow(
        'Seat override cannot be negative',
      );
    });
  });
});