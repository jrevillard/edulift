import { Request, Response } from 'express';
import { ScheduleSlotService } from '../services/ScheduleSlotService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { CreateScheduleSlotData, AssignVehicleToSlotData, ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';
import { SocketEmitter } from '../utils/socketEmitter';

const AssignChildSchema = z.object({
  childId: z.string().cuid('Invalid child ID format'),
  vehicleAssignmentId: z.string().cuid('Invalid vehicle assignment ID format')
});

const ScheduleSlotParamsSchema = z.object({
  scheduleSlotId: z.string().cuid('Invalid schedule slot ID format')
});

const ChildParamsSchema = z.object({
  childId: z.string().cuid('Invalid child ID format')
});

export class ScheduleSlotController {
  constructor(
    private scheduleSlotService: ScheduleSlotService,
    private childAssignmentService: ChildAssignmentService
  ) {}

  createScheduleSlotWithVehicle = async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;
    const { datetime, vehicleId, driverId, seatOverride } = req.body;

    if (!vehicleId) {
      throw createError('Vehicle ID is required to create a schedule slot', 400);
    }

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    try {
      const slotData: CreateScheduleSlotData = {
        groupId,
        datetime
      };

      const slot = await this.scheduleSlotService.createScheduleSlotWithVehicle(slotData, vehicleId, authReq.userId, driverId, seatOverride);

      // Emit WebSocket event for real-time updates
      if (slot) {
        SocketEmitter.broadcastScheduleSlotCreated(groupId, slot.id, slot);
        SocketEmitter.broadcastScheduleUpdate(groupId);
      }

      const response: ApiResponse = {
        success: true,
        data: slot
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw createError(error.message, 409);
      }
      throw error;
    }
  };

  assignVehicleToSlot = async (req: Request, res: Response) => {
    const { scheduleSlotId } = req.params;
    const { vehicleId, driverId, seatOverride } = req.body;

    if (!vehicleId) {
      throw createError('Vehicle ID is required', 400);
    }

    try {
      // Get the schedule slot first to obtain groupId for WebSocket emissions
      const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      if (!scheduleSlot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId,
        vehicleId,
        driverId,
        seatOverride
      };
      
      const result = await this.scheduleSlotService.assignVehicleToSlot(assignmentData);
      
      // Emit WebSocket event for real-time updates
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);
      
      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      if (error instanceof Error && error.message.includes('already assigned')) {
        throw createError(error.message, 409);
      }
      throw error;
    }
  };

  removeVehicleFromSlot = async (req: Request, res: Response) => {
    const { scheduleSlotId } = req.params;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      throw createError('Vehicle ID is required', 400);
    }

    try {
      // Get the schedule slot first to obtain groupId for WebSocket emissions
      const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      if (!scheduleSlot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const result = await this.scheduleSlotService.removeVehicleFromSlot(scheduleSlotId, vehicleId);
      
      // Emit WebSocket event for real-time updates
      if (result.slotDeleted) {
        SocketEmitter.broadcastScheduleSlotDeleted(scheduleSlot.groupId, scheduleSlotId);
      } else {
        SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      }
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);
      
      const response: ApiResponse = {
        success: true,
        data: { 
          message: 'Vehicle removed successfully',
          slotDeleted: result.slotDeleted || false
        }
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  updateVehicleDriver = async (req: Request, res: Response) => {
    const { scheduleSlotId, vehicleId } = req.params;
    const { driverId } = req.body;

    try {
      // Get the schedule slot first to obtain groupId for WebSocket emissions
      const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      if (!scheduleSlot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const result = await this.scheduleSlotService.updateVehicleDriver(scheduleSlotId, vehicleId, driverId);
      
      // Emit WebSocket event for real-time updates
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);
      
      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };


  removeChildFromSlot = async (req: Request, res: Response) => {
    const { scheduleSlotId, childId } = req.params;

    try {
      // Get the schedule slot first to obtain groupId for WebSocket emissions
      const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      if (!scheduleSlot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const result = await this.scheduleSlotService.removeChildFromSlot(scheduleSlotId, childId);
      
      // Emit WebSocket event for real-time updates
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);
      
      const response: ApiResponse = {
        success: true,
        data: { message: 'Child removed successfully' }
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  getScheduleSlotDetails = async (req: Request, res: Response) => {
    const { scheduleSlotId } = req.params;

    try {
      const slot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      
      if (!slot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const response: ApiResponse = {
        success: true,
        data: slot
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  getSchedule = async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`🎯 getSchedule CONTROLLER called for group ${groupId}, startDate: ${startDate}, endDate: ${endDate}`);

    try {
      console.log(`🔄 Calling scheduleSlotService.getSchedule...`);
      const schedule = await this.scheduleSlotService.getSchedule(
        groupId, 
        startDate as string | undefined, 
        endDate as string | undefined
      );
      
      console.log(`📤 Controller sending response:`, JSON.stringify(schedule, null, 2));
      
      const response: ApiResponse = {
        success: true,
        data: schedule
      };

      res.status(200).json(response);
    } catch (error) {
      throw error;
    }
  };

  getScheduleSlotConflicts = async (req: Request, res: Response) => {
    const { scheduleSlotId } = req.params;

    try {
      const conflicts = await this.scheduleSlotService.validateSlotConflicts(scheduleSlotId);
      
      const response: ApiResponse = {
        success: true,
        data: { conflicts }
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  // New child assignment methods
  assignChildToScheduleSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { scheduleSlotId } = ScheduleSlotParamsSchema.parse(req.params);
      const { childId, vehicleAssignmentId } = AssignChildSchema.parse(req.body);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      // Get the schedule slot first to obtain groupId for WebSocket emissions
      const scheduleSlot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);
      if (!scheduleSlot) {
        throw createError('Schedule slot not found', 404);
      }
      
      const assignment = await this.childAssignmentService.assignChildToScheduleSlot(
        scheduleSlotId, 
        childId, 
        vehicleAssignmentId,
        authReq.userId
      );

      // Emit WebSocket event for real-time updates
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, assignment);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      const response: ApiResponse = {
        success: true,
        data: assignment
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

  removeChildFromScheduleSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { scheduleSlotId } = ScheduleSlotParamsSchema.parse(req.params);
      const { childId } = ChildParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const result = await this.childAssignmentService.removeChildFromScheduleSlot(
        scheduleSlotId, 
        childId, 
        authReq.userId
      );

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

  getAvailableChildrenForSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { scheduleSlotId } = ScheduleSlotParamsSchema.parse(req.params);
      
      if (!authReq.userId) {
        throw createError('Authentication required', 401);
      }

      const children = await this.childAssignmentService.getAvailableChildrenForScheduleSlot(
        scheduleSlotId, 
        authReq.userId
      );

      const response: ApiResponse = {
        success: true,
        data: children
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

  updateSeatOverride = async (req: Request, res: Response) => {
    const { vehicleAssignmentId } = req.params;
    const { seatOverride } = req.body;

    try {
      const updateData = {
        vehicleAssignmentId,
        seatOverride
      };
      
      const result = await this.scheduleSlotService.updateSeatOverride(updateData);
      
      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };
}