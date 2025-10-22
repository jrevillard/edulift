import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GroupScheduleConfigService } from '../services/GroupScheduleConfigService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
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
  getGroupScheduleConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user!.id;

    const config = await this.service.getGroupScheduleConfig(groupId, userId);

    if (!config) {
      throw new AppError('Group schedule configuration not found. Please contact an administrator to configure schedule slots.', 404);
    }

    return res.json({
      ...config,
      isDefault: false
    });
  });

  /**
   * Get time slots for a specific weekday
   * GET /api/groups/:groupId/schedule-config/time-slots?weekday=MONDAY
   */
  getGroupTimeSlots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { groupId } = req.params;
    const { weekday } = req.query;
    const userId = req.user!.id;

    if (!weekday || typeof weekday !== 'string') {
      throw new AppError('Weekday parameter is required', 400);
    }

    const timeSlots = await this.service.getGroupTimeSlots(groupId, weekday, userId);

    return res.json({
      groupId,
      weekday: weekday.toUpperCase(),
      timeSlots
    });
  });

  /**
   * Update group schedule configuration
   * PUT /api/groups/:groupId/schedule-config
   */
  updateGroupScheduleConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { groupId } = req.params;
    const { scheduleHours } = req.body;
    const userId = req.user!.id;

    if (!scheduleHours || typeof scheduleHours !== 'object') {
      throw new AppError('Schedule hours are required', 400);
    }

    // Fetch timezone from authenticated user's database record (single source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const userTimezone = user.timezone || 'UTC';

    const config = await this.service.updateGroupScheduleConfig(
      groupId,
      scheduleHours,
      userId,
      userTimezone
    );

    return res.json({
      ...config,
      isDefault: false
    });
  });

  /**
   * Reset group schedule configuration to default
   * POST /api/groups/:groupId/schedule-config/reset
   */
  resetGroupScheduleConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user!.id;

    const config = await this.service.resetGroupScheduleConfig(groupId, userId);

    return res.json({
      ...config,
      isDefault: true
    });
  });

  /**
   * Get default schedule hours
   * GET /api/groups/schedule-config/default
   */
  getDefaultScheduleHours = asyncHandler(async (_req: Request, res: Response) => {
    const defaultHours = GroupScheduleConfigService.getDefaultScheduleHours();

    return res.json({
      scheduleHours: defaultHours,
      isDefault: true
    });
  });

  /**
   * Initialize default configurations for all groups (admin endpoint)
   * POST /api/groups/schedule-config/initialize
   */
  initializeDefaultConfigs = asyncHandler(async (_req: Request, res: Response) => {
    // This endpoint could be restricted to super admins or system administrators
    // For now, we'll allow any authenticated user (you may want to add admin middleware)
    
    await this.service.initializeDefaultConfigs();

    return res.json({
      message: 'Default schedule configurations initialized successfully'
    });
  });
}

export const createGroupScheduleConfigController = () => {
  return new GroupScheduleConfigController();
};