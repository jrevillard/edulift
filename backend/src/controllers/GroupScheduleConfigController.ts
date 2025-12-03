import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GroupScheduleConfigService } from '../services/GroupScheduleConfigService';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { createLogger, Logger } from '../utils/logger';
import { sendSuccessResponse } from '../utils/responseValidation';
import {
  SimpleSuccessResponseSchema,
  GroupScheduleConfigSuccessResponseSchema,
} from '../schemas/responses';

export class GroupScheduleConfigController {
  private service: GroupScheduleConfigService;
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(logger: Logger = createLogger('GroupScheduleConfigController')) {
    this.prisma = new PrismaClient();
    this.service = new GroupScheduleConfigService(this.prisma);
    this.logger = logger;
  }

  /**
   * Get group schedule configuration
   * GET /api/groups/:groupId/schedule-config
   */
  getGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    this.logger.debug('getGroupScheduleConfig: Received request', { groupId, userId: req.user?.id });

    if (!req.user) {
      this.logger.error('getGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    this.logger.debug('getGroupScheduleConfig: Calling service', { groupId, userId });
    const config = await this.service.getGroupScheduleConfig(groupId, userId);

    if (!config) {
      this.logger.warn('getGroupScheduleConfig: No config found for group', { groupId, userId });
      throw new AppError('Group schedule configuration not found. Please contact an administrator to configure schedule slots.', 404);
    }

    this.logger.debug('getGroupScheduleConfig: Config found', {
      groupId,
      configId: config.id,
      hasScheduleHours: !!config.scheduleHours,
      scheduleHoursCount: Object.keys(config.scheduleHours || {}).length,
    });

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: {
        ...config,
        isDefault: false,
      },
    });

    this.logger.debug('getGroupScheduleConfig: Sending response', { groupId, success: true });
  };

  /**
   * Get time slots for a specific weekday
   * GET /api/groups/:groupId/schedule-config/time-slots?weekday=MONDAY
   */
  getGroupTimeSlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { weekday } = req.query;

    this.logger.debug('getGroupTimeSlots: Received request', {
      groupId,
      weekday,
      userId: req.user?.id,
    });

    if (!req.user) {
      this.logger.error('getGroupTimeSlots: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!weekday || typeof weekday !== 'string') {
      this.logger.warn('getGroupTimeSlots: Weekday parameter is required', { groupId, userId, weekday });
      throw new AppError('Weekday parameter is required', 400);
    }

    this.logger.debug('getGroupTimeSlots: Calling service', { groupId, weekday, userId });
    const timeSlots = await this.service.getGroupTimeSlots(groupId, weekday, userId);

    this.logger.debug('getGroupTimeSlots: Time slots retrieved', {
      groupId,
      weekday,
      userId,
      timeSlotCount: timeSlots.length,
    });

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: {
        groupId,
        weekday: weekday.toUpperCase(),
        timeSlots,
      },
    });

    this.logger.debug('getGroupTimeSlots: Sending response', {
      groupId,
      weekday,
      success: true,
      timeSlotCount: timeSlots.length,
    });
  };

  /**
   * Update group schedule configuration
   * PUT /api/groups/:groupId/schedule-config
   */
  updateGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { scheduleHours } = req.body;

    this.logger.debug('updateGroupScheduleConfig: Received request', {
      groupId,
      scheduleHoursKeys: scheduleHours ? Object.keys(scheduleHours) : [],
      userId: req.user?.id,
    });

    if (!req.user) {
      this.logger.error('updateGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!scheduleHours || typeof scheduleHours !== 'object') {
      this.logger.warn('updateGroupScheduleConfig: Schedule hours are required', { groupId, userId });
      throw new AppError('Schedule hours are required', 400);
    }

    this.logger.debug('updateGroupScheduleConfig: Getting user timezone', { userId });
    // Fetch timezone from authenticated user's database record (single source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (!user) {
      this.logger.error('updateGroupScheduleConfig: User not found', { userId });
      throw new AppError('User not found', 404);
    }

    const userTimezone = user.timezone || 'UTC';

    this.logger.debug('updateGroupScheduleConfig: Updating config', {
      groupId,
      userId,
      userTimezone,
      scheduleHoursCount: Object.keys(scheduleHours).length,
    });
    const config = await this.service.updateGroupScheduleConfig(
      groupId,
      scheduleHours,
      userId,
      userTimezone,
    );

    this.logger.debug('updateGroupScheduleConfig: Config updated successfully', {
      groupId,
      userId,
      configId: config.id,
    });

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, GroupScheduleConfigSuccessResponseSchema, {
      ...config,
      isDefault: false,
    });

    this.logger.debug('updateGroupScheduleConfig: Sending response', {
      groupId,
      success: true,
    });
  };

  /**
   * Reset group schedule configuration to default
   * POST /api/groups/:groupId/schedule-config/reset
   */
  resetGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;

    this.logger.debug('resetGroupScheduleConfig: Received request', {
      groupId,
      userId: req.user?.id,
    });

    if (!req.user) {
      this.logger.error('resetGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    this.logger.debug('resetGroupScheduleConfig: Resetting config to default', { groupId, userId });
    const config = await this.service.resetGroupScheduleConfig(groupId, userId);

    this.logger.debug('resetGroupScheduleConfig: Config reset successfully', {
      groupId,
      userId,
      configId: config.id,
    });

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: {
        ...config,
        isDefault: true,
      },
    });

    this.logger.debug('resetGroupScheduleConfig: Sending response', {
      groupId,
      success: true,
    });
  };

  /**
   * Get default schedule hours
   * GET /api/groups/schedule-config/default
   */
  getDefaultScheduleHours = async (_req: Request, res: Response): Promise<void> => {
    this.logger.debug('getDefaultScheduleHours: Received request');

    const defaultHours = GroupScheduleConfigService.getDefaultScheduleHours();

    this.logger.debug('getDefaultScheduleHours: Default hours retrieved', {
      hourKeys: Object.keys(defaultHours),
    });

    // Send validated response ensuring OpenAPI compliance
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      success: true,
      data: {
        scheduleHours: defaultHours,
        isDefault: true,
      },
    });

    this.logger.debug('getDefaultScheduleHours: Sending response', { success: true });
  };
}

export const createGroupScheduleConfigController = (): GroupScheduleConfigController => {
  return new GroupScheduleConfigController();
};