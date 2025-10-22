import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';

export interface CreateVehicleData {
  name: string;
  capacity: number;
  familyId: string;
}

export interface UpdateVehicleData {
  name?: string;
  capacity?: number;
}

export class VehicleService {
  private activityLogRepo: ActivityLogRepository;

  constructor(private prisma: PrismaClient) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
  }

  async getUserFamily(userId: string) {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: {
          family: true
        }
      });
      
      return familyMember?.family || null;
    } catch (error) {
      console.error('Get user family error:', error);
      throw new AppError('Failed to get user family', 500);
    }
  }

  async canUserModifyFamilyVehicles(userId: string, familyId: string): Promise<boolean> {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { 
          userId,
          familyId
        }
      });

      // Only Admins can modify vehicles
      return familyMember?.role === 'ADMIN';
    } catch (error) {
      console.error('Check user permissions error:', error);
      return false;
    }
  }

  async createVehicle(data: CreateVehicleData, userId: string) {
    try {
      // Validate capacity using shared constraints
      if (data.capacity < VEHICLE_CONSTRAINTS.MIN_CAPACITY || data.capacity > VEHICLE_CONSTRAINTS.MAX_CAPACITY) {
        throw new AppError(`Vehicle capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`, 400);
      }

      const vehicle = await this.prisma.vehicle.create({
        data: {
          name: data.name,
          capacity: data.capacity,
          familyId: data.familyId
        }
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId: userId,
        actionType: 'VEHICLE_ADD',
        actionDescription: `Added vehicle "${data.name}"`,
        entityType: 'vehicle',
        entityId: vehicle.id,
        entityName: data.name,
        metadata: { capacity: data.capacity },
      });

      return vehicle;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Create vehicle error:', error);
      throw new AppError('Failed to create vehicle', 500);
    }
  }

  async getVehiclesByUser(userId: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        return []; // User has no family, so no vehicles
      }

      const vehicles = await this.prisma.vehicle.findMany({
        where: { familyId: userFamily.id },
        orderBy: [
          { name: 'asc' }
        ]
      });

      return vehicles;
    } catch (error) {
      console.error('Get vehicles error:', error);
      throw new AppError('Failed to fetch vehicles', 500);
    }
  }

  async getVehicleById(vehicleId: string, userId: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to access vehicles', 403);
      }

      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          familyId: userFamily.id // Ensure vehicle belongs to user's family
        }
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found or access denied', 404);
      }

      return vehicle;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get vehicle error:', error);
      throw new AppError('Failed to fetch vehicle', 500);
    }
  }

  async updateVehicle(vehicleId: string, userId: string, data: UpdateVehicleData) {
    try {
      // Get user's family and verify permissions
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to modify vehicles', 403);
      }

      // Verify user has permission to modify vehicles in the family
      const canModifyVehicles = await this.canUserModifyFamilyVehicles(userId, userFamily.id);
      if (!canModifyVehicles) {
        throw new AppError('Insufficient permissions to modify vehicles in family', 403);
      }

      // Verify vehicle exists and belongs to user's family
      const existingVehicle = await this.getVehicleById(vehicleId, userId);
      
      if (!existingVehicle) {
        throw new AppError('Vehicle not found or access denied', 404);
      }

      // Validate capacity if provided using shared constraints
      if (data.capacity !== undefined && (data.capacity < VEHICLE_CONSTRAINTS.MIN_CAPACITY || data.capacity > VEHICLE_CONSTRAINTS.MAX_CAPACITY)) {
        throw new AppError(`Vehicle capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`, 400);
      }

      // If reducing capacity, check if it conflicts with existing trip assignments
      if (data.capacity !== undefined && data.capacity < existingVehicle.capacity) {
        const tripsWithTooManyAssignments = await this.checkCapacityConflicts(vehicleId, data.capacity);
        
        if (tripsWithTooManyAssignments.length > 0) {
          throw new AppError(
            `Cannot reduce capacity: ${tripsWithTooManyAssignments.length} trip(s) exceed new capacity. Please reassign children first.`,
            400
          );
        }
      }

      const updatedVehicle = await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.capacity !== undefined && { capacity: data.capacity })
        }
      });

      return updatedVehicle;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Update vehicle error:', error);
      throw new AppError('Failed to update vehicle', 500);
    }
  }

  async deleteVehicle(vehicleId: string, userId: string) {
    try {
      // Get user's family and verify permissions
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to delete vehicles', 403);
      }

      // Verify user has permission to modify vehicles in the family
      const canModifyVehicles = await this.canUserModifyFamilyVehicles(userId, userFamily.id);
      if (!canModifyVehicles) {
        throw new AppError('Insufficient permissions to delete vehicles in family', 403);
      }

      // Verify vehicle exists and belongs to user's family
      const existingVehicle = await this.getVehicleById(vehicleId, userId);
      
      if (!existingVehicle) {
        throw new AppError('Vehicle not found or access denied', 404);
      }

      // TODO: Add schedule slot assignment check when relationships are finalized
      // For now, allow deletion without checking assignments

      await this.prisma.vehicle.delete({
        where: { id: vehicleId }
      });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Delete vehicle error:', error);
      throw new AppError('Failed to delete vehicle', 500);
    }
  }

  // TODO: Implement when ScheduleSlotVehicle relationships are finalized
  async getVehicleSchedule(vehicleId: string, userId: string, _week?: string) {
    try {
      // Get user's family first
      const userFamily = await this.getUserFamily(userId);
      if (!userFamily) {
        throw new AppError('User must belong to a family to access vehicle schedules', 403);
      }

      // Verify vehicle exists and belongs to user's family
      const vehicle = await this.getVehicleById(vehicleId, userId);
      
      if (!vehicle) {
        throw new AppError('Vehicle not found or access denied', 404);
      }

      // Temporarily return empty array until proper relationships are established
      return [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get vehicle schedule error:', error);
      throw new AppError('Failed to fetch vehicle schedule', 500);
    }
  }

  // TODO: Implement when ScheduleSlotVehicle relationships are finalized
  async getAvailableVehiclesForScheduleSlot(groupId: string, _scheduleSlotId: string) {
    try {
      // Get all families that have access to the group
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          ownerFamily: true,
          familyMembers: {
            include: {
              family: true
            }
          }
        }
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Collect all family IDs that have access to the group
      const familyIds = [group.familyId]; // Owner family
      group.familyMembers.forEach((fm: any) => {
        familyIds.push(fm.familyId);
      });

      // Find vehicles owned by families of group members
      const availableVehicles = await this.prisma.vehicle.findMany({
        where: {
          familyId: { in: familyIds }
        },
        include: {
          family: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { capacity: 'desc' },
          { name: 'asc' }
        ]
      });

      return availableVehicles;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Get available vehicles error:', error);
      throw new AppError('Failed to fetch available vehicles', 500);
    }
  }

  // TODO: Implement capacity conflict checking when relationships are finalized
  private async checkCapacityConflicts(_vehicleId: string, _newCapacity: number) {
    // Temporarily return empty array until proper relationships are established
    return [];
  }
}