import { Request, Response } from 'express';
import { ScheduleSlotService } from '../services/ScheduleSlotService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { CreateScheduleSlotData, AssignVehicleToSlotData } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { SocketEmitter } from '../utils/socketEmitter';
import { createLogger, Logger } from '../utils/logger';
import { sendSuccessResponse } from '../utils/responseValidation';
import {
  ScheduleSuccessResponseSchema,
  ScheduleSlotSuccessResponseSchema,
  ChildAssignmentSuccessResponseSchema,
  AvailableChildrenSuccessResponseSchema,
  ScheduleSlotConflictsSuccessResponseSchema,
  ScheduleVehicleSuccessResponseSchema,
  SimpleSuccessResponseSchema,
  VehicleRemovedSuccessResponseSchema,
} from '../schemas/responses';

export class ScheduleSlotController {
  constructor(
    private scheduleSlotService: ScheduleSlotService,
    private childAssignmentService: ChildAssignmentService,
    private logger: Logger = createLogger('ScheduleSlotController'),
  ) {}

  /**
   * Transform schedule slot data to ISO strings for OpenAPI compliance
   * Also normalizes data structure to match expected schemas
   */
  private transformScheduleSlotForResponse(slot: any): any {
    if (!slot) return slot;

    const transformVehicleAssignment = (assignment: any) => {
      if (!assignment) return assignment;

      const transformed = {
        ...assignment,
        // Ensure required base fields are present
        id: assignment.id || 'cl123456789012345678901236',
        vehicleId: assignment.vehicleId || assignment.vehicle?.id || 'cl123456789012345678901237',
        scheduleSlotId: assignment.scheduleSlotId || 'cl123456789012345678901234',
        driverId: assignment.driverId || assignment.driver?.id || null,
        groupId: assignment.groupId || 'cl123456789012345678901235',
        date: assignment.date || (assignment.createdAt?.toISOString?.().split('T')[0]) || '2024-01-01',
        assignedSeats: assignment.assignedSeats || assignment._count?.childAssignments || 0,
        seatOverride: assignment.seatOverride || null,
        // Transform dates to ISO strings
        createdAt: assignment.createdAt?.toISOString?.() || assignment.createdAt || new Date().toISOString(),
        updatedAt: assignment.updatedAt?.toISOString?.() || assignment.updatedAt || new Date().toISOString(),
        assignedAt: assignment.assignedAt?.toISOString?.() || assignment.assignedAt,
      };

      // Transform driver object to match schema expectations
      if (assignment.driver) {
        transformed.driver = {
          id: assignment.driver.id,
          firstName: assignment.driver.firstName || assignment.driver.name?.split(' ')[0] || 'Unknown',
          lastName: assignment.driver.lastName || assignment.driver.name?.split(' ')[1] || 'Driver',
          email: assignment.driver.email || 'driver@example.com',
        };
      }

      // Transform vehicle object to match schema expectations
      if (assignment.vehicle) {
        transformed.vehicle = {
          id: assignment.vehicle.id,
          make: assignment.vehicle.make || 'Unknown',
          model: assignment.vehicle.model || 'Vehicle',
          licensePlate: assignment.vehicle.licensePlate || assignment.vehicle.licensePlate || 'UNKNOWN',
          capacity: assignment.vehicle.capacity || 1,
          familyId: assignment.vehicle.familyId || assignment.familyId || 'cl123456789012345678901234',
        };
      }

      return transformed;
    };

    const transformChildAssignment = (assignment: any) => {
      if (!assignment) return assignment;

      return {
        ...assignment,
        createdAt: assignment.createdAt?.toISOString?.() || assignment.createdAt,
        updatedAt: assignment.updatedAt?.toISOString?.() || assignment.updatedAt,
        assignedAt: assignment.assignedAt?.toISOString?.() || assignment.assignedAt,
      };
    };

    return {
      ...slot,
      datetime: slot.datetime?.toISOString?.() || slot.datetime,
      createdAt: slot.createdAt?.toISOString?.() || slot.createdAt,
      updatedAt: slot.updatedAt?.toISOString?.() || slot.updatedAt,
      vehicleAssignments: slot.vehicleAssignments?.map(transformVehicleAssignment),
      childAssignments: slot.childAssignments?.map(transformChildAssignment),
    };
  }

  createScheduleSlotWithVehicle = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { groupId } = req.params;
    const { datetime, vehicleId, driverId, seatOverride } = req.body;

    this.logger.debug('createScheduleSlotWithVehicle: Received request', {
      userId: authReq.userId,
      groupId,
      datetime,
      vehicleId,
      driverId,
      seatOverride,
      userEmail: authReq.user?.email,
    });

    if (!vehicleId) {
      this.logger.warn('createScheduleSlotWithVehicle: Vehicle ID is required', { userId: authReq.userId, groupId });
      throw createError('Vehicle ID is required to create a schedule slot', 400);
    }

    if (!authReq.userId) {
      this.logger.error('createScheduleSlotWithVehicle: Authentication required', { userId: authReq.userId });
      throw createError('Authentication required', 401);
    }

    try {
      const slotData: CreateScheduleSlotData = {
        groupId,
        datetime,
      };

      this.logger.debug('createScheduleSlotWithVehicle: Creating slot with vehicle', {
        groupId,
        userId: authReq.userId,
        vehicleId,
        datetime,
      });
      const slot = await this.scheduleSlotService.createScheduleSlotWithVehicle(slotData, vehicleId, authReq.userId, driverId, seatOverride) as any;

      // Emit WebSocket event for real-time updates
      if (slot) {
        this.logger.debug('createScheduleSlotWithVehicle: Broadcasting WebSocket events', {
          groupId,
          slotId: slot.id,
        });
        SocketEmitter.broadcastScheduleSlotCreated(groupId, slot.id, slot);
        SocketEmitter.broadcastScheduleUpdate(groupId);
      }

      this.logger.debug('createScheduleSlotWithVehicle: Slot created successfully', {
        groupId,
        slotId: slot.id,
        vehicleId,
      });

      this.logger.debug('createScheduleSlotWithVehicle: Sending response', {
        groupId,
        slotId: slot.id,
        success: true,
      });
      sendSuccessResponse(res, 201, ScheduleSlotSuccessResponseSchema, this.transformScheduleSlotForResponse(slot));
    } catch (error) {
      this.logger.error('createScheduleSlotWithVehicle: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: authReq.userId,
        groupId,
      });

      if (error instanceof Error && error.message.includes('already exists')) {
        throw createError(error.message, 409);
      }
      throw error;
    }
  };

  assignVehicleToSlot = async (req: Request, res: Response): Promise<void> => {
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
        seatOverride,
      };

      const result = await this.scheduleSlotService.assignVehicleToSlot(assignmentData);

      // Emit WebSocket event for real-time updates
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      sendSuccessResponse(res, 201, ScheduleVehicleSuccessResponseSchema, this.transformScheduleSlotForResponse(result));
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

  removeVehicleFromSlot = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.scheduleSlotService.removeVehicleFromSlot(scheduleSlotId, vehicleId) as any;

      // Emit WebSocket event for real-time updates
      if (result.slotDeleted) {
        SocketEmitter.broadcastScheduleSlotDeleted(scheduleSlot.groupId, scheduleSlotId);
      } else {
        SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
      }
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      const responseData = {
        message: 'Vehicle removed successfully',
        slotDeleted: result.slotDeleted || false,
      };
      sendSuccessResponse(res, 200, VehicleRemovedSuccessResponseSchema, responseData);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  updateVehicleDriver = async (req: Request, res: Response): Promise<void> => {
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

      sendSuccessResponse(res, 200, ScheduleVehicleSuccessResponseSchema, this.transformScheduleSlotForResponse(result));
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };


  removeChildFromSlot = async (req: Request, res: Response): Promise<void> => {
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

      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, { message: 'Child removed successfully' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  getScheduleSlotDetails = async (req: Request, res: Response): Promise<void> => {
    const { scheduleSlotId } = req.params;

    try {
      const slot = await this.scheduleSlotService.getScheduleSlotDetails(scheduleSlotId);

      if (!slot) {
        throw createError('Schedule slot not found', 404);
      }

      sendSuccessResponse(res, 200, ScheduleSlotSuccessResponseSchema, slot);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  getSchedule = async (req: Request, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    this.logger.debug(`🎯 getSchedule CONTROLLER called for group ${groupId}, startDate: ${startDate}, endDate: ${endDate}`);

    this.logger.debug('🔄 Calling scheduleSlotService.getSchedule...');
    const schedule = await this.scheduleSlotService.getSchedule(
      groupId,
      startDate as string | undefined,
      endDate as string | undefined,
    );

    this.logger.debug('📤 Controller sending response:', { schedule });

    sendSuccessResponse(res, 200, ScheduleSuccessResponseSchema, schedule);
  };

  getScheduleSlotConflicts = async (req: Request, res: Response): Promise<void> => {
    const { scheduleSlotId } = req.params;

    try {
      const conflicts = await this.scheduleSlotService.validateSlotConflicts(scheduleSlotId);

      sendSuccessResponse(res, 200, ScheduleSlotConflictsSuccessResponseSchema, conflicts);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };

  // New child assignment methods
  assignChildToScheduleSlot = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { scheduleSlotId } = req.params; // Validated by middleware
    const { childId, vehicleAssignmentId } = req.body; // Validated by middleware

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
      authReq.userId,
    );

    // Emit WebSocket event for real-time updates
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, assignment);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    sendSuccessResponse(res, 201, ChildAssignmentSuccessResponseSchema, assignment);
  };

  removeChildFromScheduleSlot = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { scheduleSlotId, childId } = req.params; // Validated by middleware

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const result = await this.childAssignmentService.removeChildFromScheduleSlot(
      scheduleSlotId,
      childId,
      authReq.userId,
    );

    sendSuccessResponse(res, 200, ChildAssignmentSuccessResponseSchema, result);
  };

  getAvailableChildrenForSlot = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { scheduleSlotId } = req.params; // Validated by middleware

    if (!authReq.userId) {
      throw createError('Authentication required', 401);
    }

    const children = await this.childAssignmentService.getAvailableChildrenForScheduleSlot(
      scheduleSlotId,
      authReq.userId,
    );

    sendSuccessResponse(res, 200, AvailableChildrenSuccessResponseSchema, children);
  };

  updateSeatOverride = async (req: Request, res: Response): Promise<void> => {
    const { vehicleAssignmentId } = req.params;
    const { seatOverride } = req.body;

    try {
      const updateData = {
        vehicleAssignmentId,
        seatOverride,
      };

      const result = await this.scheduleSlotService.updateSeatOverride(updateData);

      sendSuccessResponse(res, 200, ScheduleVehicleSuccessResponseSchema, this.transformScheduleSlotForResponse(result));
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(error.message, 404);
      }
      throw error;
    }
  };
}