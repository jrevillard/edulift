import { PrismaClient } from '@prisma/client';
import { VehicleService } from '../VehicleService';
import { AppError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../repositories/ActivityLogRepository');

// Mock PrismaClient
const mockPrisma = {
  vehicle: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  familyMember: {
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

describe('VehicleService', () => {
  let vehicleService: VehicleService;

  beforeEach(() => {
    vehicleService = new VehicleService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('createVehicle', () => {
    it('should create a vehicle successfully', async () => {
      const vehicleData = {
        name: 'Honda Civic',
        capacity: 5,
        familyId: 'family123',
      };

      const expectedVehicle = {
        id: 'vehicle123',
        ...vehicleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock user's family membership as ADMIN
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId: 'user123',
        familyId: 'family123',
        role: 'ADMIN',
        family: { id: 'family123', name: 'Test Family' },
      });
      
      (mockPrisma.vehicle.create as jest.Mock).mockResolvedValue(expectedVehicle);

      const result = await vehicleService.createVehicle(vehicleData, 'user123');

      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: {
          name: 'Honda Civic',
          capacity: 5,
          familyId: 'family123',
        },
      });
      expect(result).toEqual(expectedVehicle);
    });

    it('should throw error for capacity less than 1', async () => {
      const vehicleData = {
        name: 'Invalid Vehicle',
        capacity: 0,
        familyId: 'family123',
      };

      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow(AppError);
      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow('Vehicle capacity must be between 1 and 10');
      expect(mockPrisma.vehicle.create).not.toHaveBeenCalled();
    });

    it('should throw error for capacity greater than 50', async () => {
      const vehicleData = {
        name: 'Big Bus',
        capacity: 11,
        familyId: 'family123',
      };

      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow(AppError);
      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow('Vehicle capacity must be between 1 and 10');
      expect(mockPrisma.vehicle.create).not.toHaveBeenCalled();
    });

    it('should throw error when creation fails', async () => {
      const vehicleData = {
        name: 'Honda Civic',
        capacity: 5,
        familyId: 'family123',
      };

      (mockPrisma.vehicle.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow(AppError);
      await expect(vehicleService.createVehicle(vehicleData, 'user123')).rejects.toThrow('Failed to create vehicle');
    });
  });

  describe('getVehiclesByUser', () => {
    it('should return user vehicles', async () => {
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      const expectedVehicles = [
        {
          id: 'vehicle1',
          name: 'Honda Civic',
          capacity: 5,
          familyId,
        },
        {
          id: 'vehicle2',
          name: 'Toyota Camry',
          capacity: 4,
          familyId,
        },
      ];

      (mockPrisma.vehicle.findMany as jest.Mock).mockResolvedValue(expectedVehicles);

      const result = await vehicleService.getVehiclesByUser(userId);

      expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith({
        where: { familyId },
        orderBy: [{ name: 'asc' }],
      });
      expect(result).toEqual(expectedVehicles);
    });

    it('should return empty array when user has no family', async () => {
      const userId = 'user123';
      
      // Mock no family found
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await vehicleService.getVehiclesByUser(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getVehicleById', () => {
    it('should return vehicle by id for user', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      const expectedVehicle = {
        id: vehicleId,
        name: 'Honda Civic',
        capacity: 5,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(expectedVehicle);

      const result = await vehicleService.getVehicleById(vehicleId, userId);

      expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, familyId },
      });
      expect(result).toEqual(expectedVehicle);
    });

    it('should throw error when vehicle not found', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(vehicleService.getVehicleById(vehicleId, userId)).rejects.toThrow('Vehicle not found or access denied');
    });

    it('should throw error when user has no family', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';

      // Mock no family found
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(vehicleService.getVehicleById(vehicleId, userId)).rejects.toThrow('User must belong to a family to access vehicles');
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle successfully', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { name: 'Updated Name', capacity: 6 };
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyVehicles
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getVehicleById -> getUserFamily
          userId,
          familyId,
          family: mockFamily,
        });

      const existingVehicle = {
        id: vehicleId,
        name: 'Old Name',
        capacity: 5,
        familyId,
      };

      const expectedVehicle = {
        id: vehicleId,
        name: 'Updated Name',
        capacity: 6,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(existingVehicle);
      (mockPrisma.vehicle.update as jest.Mock).mockResolvedValue(expectedVehicle);

      const result = await vehicleService.updateVehicle(vehicleId, userId, updateData);

      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: vehicleId },
        data: {
          name: 'Updated Name',
          capacity: 6,
        },
      });
      expect(result).toEqual(expectedVehicle);
    });

    it('should throw error for invalid capacity in update', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { capacity: 0 };
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyVehicles call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getVehicleById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingVehicle = {
        id: vehicleId,
        name: 'Old Name',
        capacity: 5,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(existingVehicle);

      // Call once and expect it to throw the capacity validation error
      await expect(vehicleService.updateVehicle(vehicleId, userId, updateData)).rejects.toThrow('Vehicle capacity must be between 1 and 10');
      expect(mockPrisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('should throw error when update fails', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { name: 'Updated Name' };
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyVehicles call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getVehicleById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingVehicle = {
        id: vehicleId,
        name: 'Old Name',
        capacity: 5,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(existingVehicle);
      (mockPrisma.vehicle.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call once and expect it to throw the update failure error
      await expect(vehicleService.updateVehicle(vehicleId, userId, updateData)).rejects.toThrow('Failed to update vehicle');
    });
  });

  describe('deleteVehicle', () => {
    it('should delete vehicle successfully', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyVehicles call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getVehicleById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingVehicle = {
        id: vehicleId,
        name: 'Honda Civic',
        capacity: 5,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(existingVehicle);
      (mockPrisma.vehicle.delete as jest.Mock).mockResolvedValue(existingVehicle);

      const result = await vehicleService.deleteVehicle(vehicleId, userId);

      expect(mockPrisma.vehicle.delete).toHaveBeenCalledWith({
        where: { id: vehicleId },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error when deletion fails', async () => {
      const vehicleId = 'vehicle123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyVehicles call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getVehicleById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingVehicle = {
        id: vehicleId,
        name: 'Honda Civic',
        capacity: 5,
        familyId,
      };

      (mockPrisma.vehicle.findFirst as jest.Mock).mockResolvedValue(existingVehicle);
      (mockPrisma.vehicle.delete as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call once and expect it to throw the deletion failure error
      await expect(vehicleService.deleteVehicle(vehicleId, userId)).rejects.toThrow('Failed to delete vehicle');
    });
  });
});