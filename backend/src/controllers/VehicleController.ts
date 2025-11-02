import { Request, Response } from 'express';
import { VehicleService } from '../services/VehicleService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const vehicleLogger = createLogger('VehicleController');

const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Name too long'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50'),
});

const UpdateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Name too long').optional(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50').optional(),
});

const VehicleParamsSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format'),
});

const WeekQuerySchema = z.object({
  week: z.string().optional(),
});

const AvailableVehiclesParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
  timeSlotId: z.string().cuid('Invalid time slot ID format'),
});

export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  createVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, capacity } = CreateVehicleSchema.parse(req.body);

      vehicleLogger.debug('createVehicle: Received request', {
        userId: authReq.userId,
        name,
        capacity,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('createVehicle: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      vehicleLogger.debug('createVehicle: Authentication validated', { userId: authReq.userId });

      // Get user's family - vehicles must belong to a family
      vehicleLogger.debug('createVehicle: Getting user family', { userId: authReq.userId });
      const userFamily = await this.vehicleService.getUserFamily(authReq.userId);
      
      if (!userFamily) {
        vehicleLogger.warn('createVehicle: User not part of any family', { userId: authReq.userId });
        throw createError('User must belong to a family to add vehicles', 403);
      }

      vehicleLogger.debug('createVehicle: Family found', {
        userId: authReq.userId,
        familyId: userFamily.id,
        familyName: userFamily.name,
      });

      // Verify user has permission to add vehicles to the family
      vehicleLogger.debug('createVehicle: Checking vehicle modification permissions', {
        userId: authReq.userId,
        familyId: userFamily.id,
      });
      const canModifyVehicles = await this.vehicleService.canUserModifyFamilyVehicles(authReq.userId, userFamily.id);

      if (!canModifyVehicles) {
        vehicleLogger.warn('createVehicle: Insufficient permissions to modify vehicles', {
          userId: authReq.userId,
          familyId: userFamily.id,
        });
        throw createError('Insufficient permissions to add vehicles to family', 403);
      }

      vehicleLogger.debug('createVehicle: Permissions validated, creating vehicle', {
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

      vehicleLogger.debug('createVehicle: Vehicle created successfully', {
        userId: authReq.userId,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        familyId: vehicle.familyId,
      });

      const response: ApiResponse = {
        success: true,
        data: vehicle,
      };

      vehicleLogger.debug('createVehicle: Sending response', {
        userId: authReq.userId,
        vehicleId: vehicle.id,
        success: true,
      });

      res.status(201).json(response);
    } catch (error) {
      vehicleLogger.error('createVehicle: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        vehicleName: req.body?.name,
        capacity: req.body?.capacity,
      });

      if (error instanceof z.ZodError) {
        vehicleLogger.warn('createVehicle: Validation error', {
          validationErrors: error.errors,
          userId: (req as AuthenticatedRequest).userId,
        });
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getVehicles = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    vehicleLogger.debug('getVehicles: Received request', {
      userId: authReq.userId,
    });

    if (!authReq.userId) {
      vehicleLogger.error('getVehicles: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    vehicleLogger.debug('getVehicles: Calling service', { userId: authReq.userId });
    const vehicles = await this.vehicleService.getVehiclesByUser(authReq.userId);

    const response: ApiResponse = {
      success: true,
      data: vehicles,
    };

    vehicleLogger.debug('getVehicles: Sending response', {
      userId: authReq.userId,
      vehicleCount: vehicles.length,
    });
    res.status(200).json(response);
  };

  getVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { vehicleId } = VehicleParamsSchema.parse(req.params);

      vehicleLogger.debug('getVehicle: Received request', {
        userId: authReq.userId,
        vehicleId,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('getVehicle: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      vehicleLogger.debug('getVehicle: Authentication validated', { userId: authReq.userId, vehicleId });

      vehicleLogger.debug('getVehicle: Calling service', { vehicleId, userId: authReq.userId });
      const vehicle = await this.vehicleService.getVehicleById(vehicleId, authReq.userId);

      vehicleLogger.debug('getVehicle: Vehicle found', {
        vehicleId,
        vehicleName: vehicle.name,
        capacity: vehicle.capacity,
        familyId: vehicle.familyId,
      });

      const response: ApiResponse = {
        success: true,
        data: vehicle,
      };

      vehicleLogger.debug('getVehicle: Sending response', {
        vehicleId,
        userId: authReq.userId,
        success: true,
      });

      res.status(200).json(response);
    } catch (error) {
      vehicleLogger.error('getVehicle: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        vehicleId: req.params?.vehicleId,
      });

      if (error instanceof z.ZodError) {
        vehicleLogger.warn('getVehicle: Validation error', {
          validationErrors: error.errors,
          userId: (req as AuthenticatedRequest).userId,
        });
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  updateVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { vehicleId } = VehicleParamsSchema.parse(req.params);
      const rawUpdateData = UpdateVehicleSchema.parse(req.body);

      vehicleLogger.debug('updateVehicle: Received request', {
        userId: authReq.userId,
        vehicleId,
        updateData: rawUpdateData,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('updateVehicle: Authentication required', { userId: authReq.userId });
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
        vehicleLogger.warn('updateVehicle: No update data provided', { userId: authReq.userId, vehicleId });
        throw createError('No update data provided', 400);
      }

      vehicleLogger.debug('updateVehicle: Calling service', { vehicleId, userId: authReq.userId, updateData });
      const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, authReq.userId, updateData);

      vehicleLogger.debug('updateVehicle: Vehicle updated successfully', {
        vehicleId,
        updatedName: updatedVehicle.name,
        updatedCapacity: updatedVehicle.capacity,
      });

      const response: ApiResponse = {
        success: true,
        data: updatedVehicle,
      };

      vehicleLogger.debug('updateVehicle: Sending response', {
        vehicleId,
        success: true,
      });
      res.status(200).json(response);
    } catch (error) {
      vehicleLogger.error('updateVehicle: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        vehicleId: req.params.vehicleId,
      });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  deleteVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { vehicleId } = VehicleParamsSchema.parse(req.params);

      vehicleLogger.debug('deleteVehicle: Received request', {
        userId: authReq.userId,
        vehicleId,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('deleteVehicle: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      vehicleLogger.debug('deleteVehicle: Calling service', { vehicleId, userId: authReq.userId });
      const result = await this.vehicleService.deleteVehicle(vehicleId, authReq.userId);

      vehicleLogger.debug('deleteVehicle: Vehicle deleted successfully', {
        vehicleId,
        deleted: result.success,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      vehicleLogger.debug('deleteVehicle: Sending response', {
        vehicleId,
        success: true,
      });
      res.status(200).json(response);
    } catch (error) {
      vehicleLogger.error('deleteVehicle: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        vehicleId: req.params.vehicleId,
      });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getVehicleSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { vehicleId } = VehicleParamsSchema.parse(req.params);
      const { week } = WeekQuerySchema.parse(req.query);

      vehicleLogger.debug('getVehicleSchedule: Received request', {
        userId: authReq.userId,
        vehicleId,
        week,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('getVehicleSchedule: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      vehicleLogger.debug('getVehicleSchedule: Calling service', { vehicleId, userId: authReq.userId, week });
      const schedule = await this.vehicleService.getVehicleSchedule(vehicleId, authReq.userId, week);

      vehicleLogger.debug('getVehicleSchedule: Schedule retrieved', {
        vehicleId,
        week,
        scheduleItems: Array.isArray(schedule) ? schedule.length : Object.keys(schedule).length,
      });

      const response: ApiResponse = {
        success: true,
        data: schedule,
      };

      vehicleLogger.debug('getVehicleSchedule: Sending response', {
        vehicleId,
        success: true,
      });
      res.status(200).json(response);
    } catch (error) {
      vehicleLogger.error('getVehicleSchedule: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        vehicleId: req.params.vehicleId,
      });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getAvailableVehicles = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { groupId, timeSlotId } = AvailableVehiclesParamsSchema.parse(req.params);

      vehicleLogger.debug('getAvailableVehicles: Received request', {
        userId: authReq.userId,
        groupId,
        timeSlotId,
        userEmail: authReq.user?.email,
      });

      if (!authReq.userId) {
        vehicleLogger.error('getAvailableVehicles: Authentication required', { userId: authReq.userId });
        throw createError('Authentication required', 401);
      }

      vehicleLogger.debug('getAvailableVehicles: Calling service', { groupId, timeSlotId, userId: authReq.userId });
      const availableVehicles = await this.vehicleService.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

      vehicleLogger.debug('getAvailableVehicles: Available vehicles retrieved', {
        groupId,
        timeSlotId,
        vehicleCount: availableVehicles.length,
      });

      const response: ApiResponse = {
        success: true,
        data: availableVehicles,
      };

      vehicleLogger.debug('getAvailableVehicles: Sending response', {
        groupId,
        timeSlotId,
        success: true,
        vehicleCount: availableVehicles.length,
      });
      res.status(200).json(response);
    } catch (error) {
      vehicleLogger.error('getAvailableVehicles: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        groupId: req.params.groupId,
        timeSlotId: req.params.timeSlotId,
      });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };
}

// Factory function to create controller with dependencies
export const createVehicleController = (): VehicleController => {
  // PrismaClient importé en haut du fichier
  
  const prisma = new PrismaClient();
  const vehicleService = new VehicleService(prisma);

  return new VehicleController(vehicleService);
};