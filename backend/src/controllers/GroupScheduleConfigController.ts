import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GroupScheduleConfigService } from '../services/GroupScheduleConfigService';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

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

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    const config = await this.service.getGroupScheduleConfig(groupId, userId);

    if (!config) {
      throw new AppError('Group schedule configuration not found. Please contact an administrator to configure schedule slots.', 404);
    }

    res.json({
      ...config,
      isDefault: false,
    });
  };

  /**
   * Get time slots for a specific weekday
   * GET /api/groups/:groupId/schedule-config/time-slots?weekday=MONDAY
   */
  getGroupTimeSlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { weekday } = req.query;

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!weekday || typeof weekday !== 'string') {
      throw new AppError('Weekday parameter is required', 400);
    }

    const timeSlots = await this.service.getGroupTimeSlots(groupId, weekday, userId);

    res.json({
      groupId,
      weekday: weekday.toUpperCase(),
      timeSlots,
    });
  };

  /**
   * Update group schedule configuration
   * PUT /api/groups/:groupId/schedule-config
   */
  updateGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;
    const { scheduleHours } = req.body;

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    if (!scheduleHours || typeof scheduleHours !== 'object') {
      throw new AppError('Schedule hours are required', 400);
    }

    // Fetch timezone from authenticated user's database record (single source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const userTimezone = user.timezone || 'UTC';

    const config = await this.service.updateGroupScheduleConfig(
      groupId,
      scheduleHours,
      userId,
      userTimezone,
    );

    res.json({
      ...config,
      isDefault: false,
    });
  };

  /**
   * Reset group schedule configuration to default
   * POST /api/groups/:groupId/schedule-config/reset
   */
  resetGroupScheduleConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { groupId } = req.params;

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    const userId = req.user.id;

    const config = await this.service.resetGroupScheduleConfig(groupId, userId);

    res.json({
      ...config,
      isDefault: true,
    });
  };

  /**
   * Get default schedule hours
   * GET /api/groups/schedule-config/default
   */
  getDefaultScheduleHours = async (_req: Request, res: Response): Promise<void> => {
    const defaultHours = GroupScheduleConfigService.getDefaultScheduleHours();

    res.json({
      scheduleHours: defaultHours,
      isDefault: true,
    });
  };

  /**
   * Initialize default configurations for all groups (admin endpoint)
   * POST /api/groups/schedule-config/initialize
   */
  initializeDefaultConfigs = async (_req: Request, res: Response): Promise<void> => {
    // This endpoint could be restricted to super admins or system administrators
    // For now, we'll allow any authenticated user (you may want to add admin middleware)

    await this.service.initializeDefaultConfigs();

    res.json({
      message: 'Default schedule configurations initialized successfully',
    });
  };
}

export const createGroupScheduleConfigController = (): GroupScheduleConfigController => {
  return new GroupScheduleConfigController();
};