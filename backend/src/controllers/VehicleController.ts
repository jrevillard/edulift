import { Request, Response } from 'express';
import { VehicleService } from '../services/VehicleService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import { createLogger, Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

export class VehicleController {
  constructor(
    private vehicleService: VehicleService,
    private logger: Logger = createLogger('VehicleController'),
  ) {}

  createVehicle = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { name, capacity } = req.body; // Validated by middleware

    this.logger.debug('createVehicle: Received request', {
      userId: authReq.userId,
      name,
      capacity,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('createVehicle: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('createVehicle: Authentication validated', { userId: authReq.userId });

    // Get user's family - vehicles must belong to a family
    this.logger.debug('createVehicle: Getting user family', { userId: authReq.userId });
    const userFamily = await this.vehicleService.getUserFamily(authReq.userId);

    if (!userFamily) {
      this.logger.warn('createVehicle: User not part of any family', { userId: authReq.userId });
      throw createError('User must belong to a family to add vehicles', 403);
    }

    this.logger.debug('createVehicle: Family found', {
      userId: authReq.userId,
      familyId: userFamily.id,
      familyName: userFamily.name,
    });

    // Verify user has permission to add vehicles to the family
    this.logger.debug('createVehicle: Checking vehicle modification permissions', {
      userId: authReq.userId,
      familyId: userFamily.id,
    });
    const canModifyVehicles = await this.vehicleService.canUserModifyFamilyVehicles(authReq.userId, userFamily.id);

    if (!canModifyVehicles) {
      this.logger.warn('createVehicle: Insufficient permissions to modify vehicles', {
        userId: authReq.userId,
        familyId: userFamily.id,
      });
      throw createError('Insufficient permissions to add vehicles to family', 403);
    }

    this.logger.debug('createVehicle: Permissions validated, creating vehicle', {
      userId: authReq.userId,
      familyId: userFamily.id,
      vehicleName: name,
      capacity,
    });

    const vehicle = await this.vehicleService.createVehicle({
      name,
      capacity,
      familyId: userFamily.id,
    }, authReq.userId);

    this.logger.debug('createVehicle: Vehicle created successfully', {
      userId: authReq.userId,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      familyId: vehicle.familyId,
    });

    const response: ApiResponse = {
      success: true,
      data: vehicle,
    };

    this.logger.debug('createVehicle: Sending response', {
      userId: authReq.userId,
      vehicleId: vehicle.id,
      success: true,
    });

    res.status(201).json(response);
  };

  getVehicles = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    this.logger.debug('getVehicles: Received request', {
      userId: authReq.userId,
    });

    if (!authReq.userId) {
      this.logger.error('getVehicles: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getVehicles: Calling service', { userId: authReq.userId });
    const vehicles = await this.vehicleService.getVehiclesByUser(authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: vehicles,
    };

    this.logger.debug('getVehicles: Sending response', {
      userId: authReq.userId,
      vehicleCount: vehicles.length,
    });
    res.status(200).json(response);
  };

  getVehicle = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { vehicleId } = req.params; // Validated by middleware

    this.logger.debug('getVehicle: Received request', {
      userId: authReq.userId,
      vehicleId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getVehicle: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getVehicle: Authentication validated', { userId: authReq.userId, vehicleId });

    this.logger.debug('getVehicle: Calling service', { vehicleId, userId: authReq.userId });
    const vehicle = await this.vehicleService.getVehicleById(vehicleId, authReq.userId);

    this.logger.debug('getVehicle: Vehicle found', {
      vehicleId,
      vehicleName: vehicle.name,
      capacity: vehicle.capacity,
      familyId: vehicle.familyId,
    });

    const response: ApiResponse = {
      success: true,
      data: vehicle,
    };

    this.logger.debug('getVehicle: Sending response', {
      vehicleId,
      userId: authReq.userId,
      success: true,
    });

    res.status(200).json(response);
  };

  updateVehicle = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { vehicleId } = req.params; // Validated by middleware
    const rawUpdateData = req.body; // Validated by middleware

    this.logger.debug('updateVehicle: Received request', {
      userId: authReq.userId,
      vehicleId,
      updateData: rawUpdateData,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('updateVehicle: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const updateData: {
      name?: string;
      capacity?: number;
    } = {};
    if (rawUpdateData.name !== undefined) {
      updateData.name = rawUpdateData.name;
    }
    if (rawUpdateData.capacity !== undefined) {
      updateData.capacity = rawUpdateData.capacity;
    }

    if (Object.keys(updateData).length === 0) {
      this.logger.warn('updateVehicle: No update data provided', { userId: authReq.userId, vehicleId });
      throw createError('No update data provided', 400);
    }

    this.logger.debug('updateVehicle: Calling service', { vehicleId, userId: authReq.userId, updateData });
    const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, authReq.userId, updateData);

    this.logger.debug('updateVehicle: Vehicle updated successfully', {
      vehicleId,
      updatedName: updatedVehicle.name,
      updatedCapacity: updatedVehicle.capacity,
    });

    const response: ApiResponse = {
      success: true,
      data: updatedVehicle,
    };

    this.logger.debug('updateVehicle: Sending response', {
      vehicleId,
      success: true,
    });
    res.status(200).json(response);
  };

  deleteVehicle = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { vehicleId } = req.params; // Validated by middleware

    this.logger.debug('deleteVehicle: Received request', {
      userId: authReq.userId,
      vehicleId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('deleteVehicle: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('deleteVehicle: Calling service', { vehicleId, userId: authReq.userId });
    const result = await this.vehicleService.deleteVehicle(vehicleId, authReq.userId);

    this.logger.debug('deleteVehicle: Vehicle deleted successfully', {
      vehicleId,
      deleted: result.success,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    this.logger.debug('deleteVehicle: Sending response', {
      vehicleId,
      success: true,
    });
    res.status(200).json(response);
  };

  getVehicleSchedule = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { vehicleId } = req.params; // Validated by middleware
    const { week } = req.query as { week?: string }; // Validated by middleware

    this.logger.debug('getVehicleSchedule: Received request', {
      userId: authReq.userId,
      vehicleId,
      week,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getVehicleSchedule: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getVehicleSchedule: Calling service', { vehicleId, userId: authReq.userId, week });
    const schedule = await this.vehicleService.getVehicleSchedule(vehicleId, authReq.userId, week);

    this.logger.debug('getVehicleSchedule: Schedule retrieved', {
      vehicleId,
      week,
      scheduleItems: Array.isArray(schedule) ? schedule.length : Object.keys(schedule).length,
    });

    const response: ApiResponse = {
      success: true,
      data: schedule,
    };

    this.logger.debug('getVehicleSchedule: Sending response', {
      vehicleId,
      success: true,
    });
    res.status(200).json(response);
  };

  getAvailableVehicles = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId, timeSlotId } = req.params; // Validated by middleware

    this.logger.debug('getAvailableVehicles: Received request', {
      userId: authReq.userId,
      groupId,
      timeSlotId,
      userEmail: authReq.user?.email,
    });

    if (!authReq.userId) {
      this.logger.error('getAvailableVehicles: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    this.logger.debug('getAvailableVehicles: Calling service', { groupId, timeSlotId, userId: authReq.userId });
    const availableVehicles = await this.vehicleService.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

    this.logger.debug('getAvailableVehicles: Available vehicles retrieved', {
      groupId,
      timeSlotId,
      vehicleCount: availableVehicles.length,
    });

    const response: ApiResponse = {
      success: true,
      data: availableVehicles,
    };

    this.logger.debug('getAvailableVehicles: Sending response', {
      groupId,
      timeSlotId,
      success: true,
      vehicleCount: availableVehicles.length,
    });
    res.status(200).json(response);
  };
}

// Factory function to create controller with dependencies
export const createVehicleController = (): VehicleController => {
  // PrismaClient importé en haut du fichier
  
  const prisma = new PrismaClient();
  const vehicleService = new VehicleService(prisma);

  return new VehicleController(vehicleService);
};