import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityLogRepository } from '../repositories/ActivityLogRepository';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';
import { createLogger } from '../utils/logger';
import { SocketEmitter } from '../utils/socketEmitter';

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
  private logger = createLogger('vehicle');

  // Same include pattern as FamilyService for consistency
  private static readonly FAMILY_INCLUDE = {
    members: {
      include: { user: true },
    },
    children: true,
    vehicles: true,
  };

  constructor(private prisma: PrismaClient) {
    this.activityLogRepo = new ActivityLogRepository(prisma);
  }

  async getUserFamily(userId: string) {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { userId },
        include: {
          family: true,
        },
      });
      
      return familyMember?.family || null;
    } catch (error) {
      this.logger.error('Get user family error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to get user family', 500);
    }
  }

  async canUserModifyFamilyVehicles(userId: string, familyId: string): Promise<boolean> {
    try {
      const familyMember = await this.prisma.familyMember.findFirst({
        where: { 
          userId,
          familyId,
        },
      });

      // Only Admins can modify vehicles
      return familyMember?.role === 'ADMIN';
    } catch (error) {
      this.logger.error('Check user permissions error:', { error: error instanceof Error ? error.message : String(error) });
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
          familyId: data.familyId,
        },
      });

      // Emit WebSocket event for vehicle creation
      SocketEmitter.broadcastVehicleUpdate(userId, data.familyId, 'added', {
        vehicleId: vehicle.id,
        familyId: data.familyId,
        newVehicle: vehicle,
      });

      // Log the activity
      await this.activityLogRepo.createActivity({
        userId,
        actionType: 'VEHICLE_ADD',
        actionDescription: `Added vehicle "${data.name}"`,
        entityType: 'vehicle',
        entityId: vehicle.id,
        entityName: data.name,
        metadata: { capacity: data.capacity },
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: data.familyId },
        include: VehicleService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Family not found after vehicle creation', 500);
      }

      return updatedFamily;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Create vehicle error:', { error: error instanceof Error ? error.message : String(error) });
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
          { name: 'asc' },
        ],
      });

      return vehicles;
    } catch (error) {
      this.logger.error('Get vehicles error:', { error: error instanceof Error ? error.message : String(error) });
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
          familyId: userFamily.id, // Ensure vehicle belongs to user's family
        },
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found or access denied', 404);
      }

      return vehicle;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get vehicle error:', { error: error instanceof Error ? error.message : String(error) });
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
            400,
          );
        }
      }

      const updatedVehicle = await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.capacity !== undefined && { capacity: data.capacity }),
        },
      });

      // Emit WebSocket event for vehicle update
      SocketEmitter.broadcastVehicleUpdate(userId, userFamily.id, 'updated', {
        vehicleId,
        familyId: userFamily.id,
        previousVehicle: existingVehicle,
        updatedVehicle,
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: userFamily.id },
        include: VehicleService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Family not found after vehicle update', 500);
      }

      return updatedFamily;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Update vehicle error:', { error: error instanceof Error ? error.message : String(error) });
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

      // Check if vehicle has any scheduled assignments that would prevent deletion
      // This is a basic implementation - full logic would check for active assignments
      const hasAssignments = false; // TODO: Check actual assignments when relationships are finalized

      if (hasAssignments) {
        throw new AppError('Cannot delete vehicle with active assignments', 409);
      }

      await this.prisma.vehicle.delete({
        where: { id: vehicleId },
      });

      // Emit WebSocket event for vehicle deletion
      SocketEmitter.broadcastVehicleUpdate(userId, userFamily.id, 'deleted', {
        vehicleId,
        familyId: userFamily.id,
        deletedVehicle: existingVehicle,
      });

      // Fetch and return complete updated Family
      const updatedFamily = await this.prisma.family.findUnique({
        where: { id: userFamily.id },
        include: VehicleService.FAMILY_INCLUDE,
      });

      if (!updatedFamily) {
        throw new AppError('Family not found after vehicle deletion', 500);
      }

      return updatedFamily;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Delete vehicle error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to delete vehicle', 500);
    }
  }

  async getVehicleSchedule(vehicleId: string, userId: string, week?: string) {
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

      // For now, return empty schedule - full implementation would:
      // 1. Parse week parameter to determine date range
      // 2. Query schedule assignments for the vehicle
      // 3. Return structured schedule data matching VehicleScheduleSchema
      this.logger.debug('getVehicleSchedule called', { vehicleId, userId, week });

      const schedule = {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        schedule: [], // TODO: Implement actual schedule fetching when relationships are finalized
      };

      return schedule;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get vehicle schedule error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to fetch vehicle schedule', 500);
    }
  }

  async getAvailableVehiclesForScheduleSlot(groupId: string, timeSlotId: string) {
    try {
      // Get all families that have access to the group
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: {
          ownerFamily: true,
          familyMembers: {
            include: {
              family: true,
            },
          },
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Verify the time slot exists
      const timeSlot = await this.prisma.scheduleSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!timeSlot) {
        throw new AppError('Time slot not found', 404);
      }

      // Collect all family IDs that have access to the group
      const familyIds = [group.familyId]; // Owner family
      group.familyMembers.forEach((fm: { familyId: string }) => {
        familyIds.push(fm.familyId);
      });

      // Find vehicles owned by families of group members
      const vehicles = await this.prisma.vehicle.findMany({
        where: {
          familyId: { in: familyIds },
        },
        include: {
          family: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { capacity: 'desc' },
          { name: 'asc' },
        ],
      });

      // Transform to match AvailableVehicleSchema format
      const availableVehicles = vehicles.map(vehicle => {
        // Calculate current assignments for this time slot
        // Note: This is a placeholder implementation - actual assignment logic
        // would depend on the specific business rules and database relationships
        const currentAssignments = 0; // TODO: Calculate based on actual assignments
        const availableSeats = Math.max(0, vehicle.capacity - currentAssignments);

        return {
          id: vehicle.id,
          name: vehicle.name,
          capacity: vehicle.capacity,
          currentAssignments,
          availableSeats,
          driverName: null, // TODO: Get actual driver information
        };
      });

      return availableVehicles;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Get available vehicles error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to fetch available vehicles', 500);
    }
  }

  private async checkCapacityConflicts(vehicleId: string, newCapacity: number) {
    try {
      // Check if reducing capacity would conflict with existing assignments
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          family: true,
        },
      });

      if (!vehicle) {
        throw new AppError('Vehicle not found', 404);
      }

      // For now, we'll implement a basic check
      // In a full implementation, this would check existing assignments
      // and prevent capacity reduction if it would cause conflicts
      const conflicts: any[] = [];

      if (newCapacity < vehicle.capacity) {
        // Log potential capacity reduction conflicts
        this.logger.warn('Vehicle capacity reduction detected', {
          vehicleId,
          oldCapacity: vehicle.capacity,
          newCapacity,
        });
      }

      return conflicts;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error('Check capacity conflicts error:', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to check capacity conflicts', 500);
    }
  }
}