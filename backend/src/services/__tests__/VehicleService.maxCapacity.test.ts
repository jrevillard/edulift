import { VehicleService } from '../VehicleService';
import { PrismaClient } from '@prisma/client';
import { VEHICLE_CONSTRAINTS } from '../../constants/vehicle';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    vehicle: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    familyMember: {
      findFirst: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('VehicleService - Max Capacity Tests', () => {
  let vehicleService: VehicleService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    vehicleService = new VehicleService(mockPrisma);
  });

  describe('Create Vehicle with New Max Capacity', () => {
    it('should allow creating vehicle with exactly 10 seats', async () => {
      const vehicleData = {
        name: 'Small Bus',
        capacity: 10,
        familyId: 'family-1'
      };
      const userId = 'user-1';

      const mockCreatedVehicle = { 
        ...vehicleData, 
        id: 'vehicle-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrisma.vehicle.create.mockResolvedValue(mockCreatedVehicle);
      mockPrisma.activityLog.create.mockResolvedValue({});

      const result = await vehicleService.createVehicle(vehicleData, userId);

      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: vehicleData
      });
      expect(result).toEqual(mockCreatedVehicle);
    });

    it('should reject creating vehicle with 11 seats', async () => {
      const vehicleData = {
        name: 'Too Big Bus',
        capacity: 11,
        familyId: 'family-1'
      };
      const userId = 'user-1';

      await expect(vehicleService.createVehicle(vehicleData, userId)).rejects.toThrow(
        `Vehicle capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`
      );
      expect(mockPrisma.vehicle.create).not.toHaveBeenCalled();
    });

    it('should reject creating vehicle with 50 seats (old limit)', async () => {
      const vehicleData = {
        name: 'Old Big Bus',
        capacity: 50,
        familyId: 'family-1'
      };
      const userId = 'user-1';

      await expect(vehicleService.createVehicle(vehicleData, userId)).rejects.toThrow(
        `Vehicle capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`
      );
      expect(mockPrisma.vehicle.create).not.toHaveBeenCalled();
    });
  });

  describe('Update Vehicle with New Max Capacity', () => {
    beforeEach(() => {
      // Mock getUserFamily to return a family
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId: 'user-1',
        familyId: 'family-1',
        role: 'ADMIN',
        family: { id: 'family-1', name: 'Test Family' }
      });
    });

    it('should allow updating vehicle to exactly 10 seats', async () => {
      const vehicleId = 'vehicle-1';
      const userId = 'user-1';
      const updateData = { capacity: 10 };
      const existingVehicle = { 
        id: vehicleId, 
        name: 'Bus', 
        capacity: 8,
        familyId: 'family-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockUpdatedVehicle = { 
        ...existingVehicle,
        ...updateData
      };

      mockPrisma.vehicle.findFirst.mockResolvedValue(existingVehicle);
      mockPrisma.vehicle.update.mockResolvedValue(mockUpdatedVehicle);
      mockPrisma.activityLog.create.mockResolvedValue({});

      const result = await vehicleService.updateVehicle(vehicleId, userId, updateData);

      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: vehicleId },
        data: updateData
      });
      expect(result).toEqual(mockUpdatedVehicle);
    });

    it('should reject updating vehicle to 11 seats', async () => {
      const vehicleId = 'vehicle-1';
      const userId = 'user-1';
      const updateData = { capacity: 11 };
      const existingVehicle = { 
        id: vehicleId, 
        name: 'Bus', 
        capacity: 8,
        familyId: 'family-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.vehicle.findFirst.mockResolvedValue(existingVehicle);

      await expect(vehicleService.updateVehicle(vehicleId, userId, updateData)).rejects.toThrow(
        `Vehicle capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`
      );
      expect(mockPrisma.vehicle.update).not.toHaveBeenCalled();
    });
  });
});