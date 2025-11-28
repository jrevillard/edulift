import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GroupScheduleConfigService } from '../services/GroupScheduleConfigService';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('GroupScheduleConfigController');

export class GroupScheduleConfigController {
  private service: GroupScheduleConfigService;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.service = new GroupScheduleConfigService(this.prisma);
  }

  /**
   * Get group schedule configuration
   * GET /api/groups/:groupId/schedule-config
   */
  getGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    logger.debug('getGroupScheduleConfig: Received request', { groupId, userId: req.user?.id });

    if (!req.user) {
      logger.error('getGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    logger.debug('getGroupScheduleConfig: Calling service', { groupId, userId });
    const config = await this.service.getGroupScheduleConfig(groupId, userId);

    if (!config) {
      logger.warn('getGroupScheduleConfig: No config found for group', { groupId, userId });
      throw new AppError('Group schedule configuration not found. Please contact an administrator to configure schedule slots.', 404);
    }

    logger.debug('getGroupScheduleConfig: Config found', {
      groupId,
      configId: config.id,
      hasScheduleHours: !!config.scheduleHours,
      scheduleHoursCount: Object.keys(config.scheduleHours || {}).length,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...config,
        isDefault: false,
      },
    };

    logger.debug('getGroupScheduleConfig: Sending response', { groupId, success: true });
    res.json(response);
  };

  /**
   * Get time slots for a specific weekday
   * GET /api/groups/:groupId/schedule-config/time-slots?weekday=MONDAY
   */
  getGroupTimeSlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { weekday } = req.query;

    logger.debug('getGroupTimeSlots: Received request', {
      groupId,
      weekday,
      userId: req.user?.id,
    });

    if (!req.user) {
      logger.error('getGroupTimeSlots: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!weekday || typeof weekday !== 'string') {
      logger.warn('getGroupTimeSlots: Weekday parameter is required', { groupId, userId, weekday });
      throw new AppError('Weekday parameter is required', 400);
    }

    logger.debug('getGroupTimeSlots: Calling service', { groupId, weekday, userId });
    const timeSlots = await this.service.getGroupTimeSlots(groupId, weekday, userId);

    logger.debug('getGroupTimeSlots: Time slots retrieved', {
      groupId,
      weekday,
      userId,
      timeSlotCount: timeSlots.length,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        groupId,
        weekday: weekday.toUpperCase(),
        timeSlots,
      },
    };

    logger.debug('getGroupTimeSlots: Sending response', {
      groupId,
      weekday,
      success: true,
      timeSlotCount: timeSlots.length,
    });
    res.json(response);
  };

  /**
   * Update group schedule configuration
   * PUT /api/groups/:groupId/schedule-config
   */
  updateGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { scheduleHours } = req.body;

    logger.debug('updateGroupScheduleConfig: Received request', {
      groupId,
      scheduleHoursKeys: scheduleHours ? Object.keys(scheduleHours) : [],
      userId: req.user?.id,
    });

    if (!req.user) {
      logger.error('updateGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!scheduleHours || typeof scheduleHours !== 'object') {
      logger.warn('updateGroupScheduleConfig: Schedule hours are required', { groupId, userId });
      throw new AppError('Schedule hours are required', 400);
    }

    logger.debug('updateGroupScheduleConfig: Getting user timezone', { userId });
    // Fetch timezone from authenticated user's database record (single source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (!user) {
      logger.error('updateGroupScheduleConfig: User not found', { userId });
      throw new AppError('User not found', 404);
    }

    const userTimezone = user.timezone || 'UTC';

    logger.debug('updateGroupScheduleConfig: Updating config', {
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

    logger.debug('updateGroupScheduleConfig: Config updated successfully', {
      groupId,
      userId,
      configId: config.id,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...config,
        isDefault: false,
      },
    };

    logger.debug('updateGroupScheduleConfig: Sending response', {
      groupId,
      success: true,
    });
    res.json(response);
  };

  /**
   * Reset group schedule configuration to default
   * POST /api/groups/:groupId/schedule-config/reset
   */
  resetGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;

    logger.debug('resetGroupScheduleConfig: Received request', {
      groupId,
      userId: req.user?.id,
    });

    if (!req.user) {
      logger.error('resetGroupScheduleConfig: User not authenticated', { groupId });
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    logger.debug('resetGroupScheduleConfig: Resetting config to default', { groupId, userId });
    const config = await this.service.resetGroupScheduleConfig(groupId, userId);

    logger.debug('resetGroupScheduleConfig: Config reset successfully', {
      groupId,
      userId,
      configId: config.id,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...config,
        isDefault: true,
      },
    };

    logger.debug('resetGroupScheduleConfig: Sending response', {
      groupId,
      success: true,
    });
    res.json(response);
  };

  /**
   * Get default schedule hours
   * GET /api/groups/schedule-config/default
   */
  getDefaultScheduleHours = async (_req: Request, res: Response): Promise<void> => {
    logger.debug('getDefaultScheduleHours: Received request');

    const defaultHours = GroupScheduleConfigService.getDefaultScheduleHours();

    logger.debug('getDefaultScheduleHours: Default hours retrieved', {
      hourKeys: Object.keys(defaultHours),
    });

    const response: ApiResponse = {
      success: true,
      data: {
        scheduleHours: defaultHours,
        isDefault: true,
      },
    };

    logger.debug('getDefaultScheduleHours: Sending response', { success: true });
    res.json(response);
  };
}

export const createGroupScheduleConfigController = (): GroupScheduleConfigController => {
  return new GroupScheduleConfigController();
};