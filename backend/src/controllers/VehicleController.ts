import { Request, Response } from 'express';
import { VehicleService } from '../services/VehicleService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Name too long'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50')
});

const UpdateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required').max(100, 'Name too long').optional(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50').optional()
});

const VehicleParamsSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format')
});

const WeekQuerySchema = z.object({
  week: z.string().optional()
});

const AvailableVehiclesParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
  timeSlotId: z.string().cuid('Invalid time slot ID format')
});

export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  createVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, capacity } = CreateVehicleSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Get user's family - vehicles must belong to a family
      const userFamily = await this.vehicleService.getUserFamily(authReq.userId);
      if (!userFamily) {
        throw createError('User must belong to a family to add vehicles', 403);
      }

      // Verify user has permission to add vehicles to the family
      const canModifyVehicles = await this.vehicleService.canUserModifyFamilyVehicles(authReq.userId, userFamily.id);
      if (!canModifyVehicles) {
        throw createError('Insufficient permissions to add vehicles to family', 403);
      }

      const vehicle = await this.vehicleService.createVehicle({
        name,
        capacity,
        familyId: userFamily.id
      }, authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: vehicle
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };

  getVehicles = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const vehicles = await this.vehicleService.getVehiclesByUser(authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: vehicles
      };

      res.status(200).json(response);
    } catch (error) {
      throw error;
    }
  };

  getVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { vehicleId } = VehicleParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const vehicle = await this.vehicleService.getVehicleById(vehicleId, authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: vehicle
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
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
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Filter out undefined values for exactOptionalPropertyTypes compatibility
      const updateData: any = {};
      if (rawUpdateData.name !== undefined) {
        updateData.name = rawUpdateData.name;
      }
      if (rawUpdateData.capacity !== undefined) {
        updateData.capacity = rawUpdateData.capacity;
      }

      if (Object.keys(updateData).length === 0) {
        throw createError('No update data provided', 400);
      }

      const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, authReq.userId, updateData);

      const response: ApiResponse = {
        success: true,
        data: updatedVehicle
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
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
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const result = await this.vehicleService.deleteVehicle(vehicleId, authReq.userId);

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
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
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const schedule = await this.vehicleService.getVehicleSchedule(vehicleId, authReq.userId, week);

      const response: ApiResponse = {
        success: true,
        data: schedule
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
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
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const availableVehicles = await this.vehicleService.getAvailableVehiclesForScheduleSlot(groupId, timeSlotId);

      const response: ApiResponse = {
        success: true,
        data: availableVehicles
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid parameters',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(response);
        return;
      }
      throw error;
    }
  };
}

// Factory function to create controller with dependencies
export const createVehicleController = () => {
  const { PrismaClient } = require('@prisma/client');
  
  const prisma = new PrismaClient();
  const vehicleService = new VehicleService(prisma);

  return new VehicleController(vehicleService);
};