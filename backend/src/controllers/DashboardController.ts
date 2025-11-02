import { Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('DashboardController');

export class DashboardController {
  private dashboardService: DashboardService;

  constructor(prisma?: PrismaClient) {
    this.dashboardService = new DashboardService(prisma);
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.debug('getStats: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        logger.error('getStats: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      logger.debug('getStats: Calling service', { userId });
      const stats = await this.dashboardService.calculateUserStats(userId);

      logger.debug('getStats: Stats calculated successfully', {
        userId,
        hasStats: !!stats,
        statsKeys: stats ? Object.keys(stats) : [],
      });

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('getStats: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getTodaySchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.debug('getTodaySchedule: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        logger.error('getTodaySchedule: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      logger.debug('getTodaySchedule: Calling service', { userId });
      const upcomingTrips = await this.dashboardService.getTodayTripsForUser(userId);

      logger.debug('getTodaySchedule: Today schedule retrieved', {
        userId,
        tripCount: upcomingTrips.length,
      });

      res.status(200).json({
        success: true,
        data: { upcomingTrips },
      });
    } catch (error) {
      logger.error('getTodaySchedule: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getWeeklySchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.debug('getWeeklySchedule: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        logger.error('getWeeklySchedule: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      logger.debug('getWeeklySchedule: Calling service', { userId });
      const upcomingTrips = await this.dashboardService.getWeeklyTripsForUser(userId);

      logger.debug('getWeeklySchedule: Weekly schedule retrieved', {
        userId,
        tripCount: upcomingTrips.length,
      });

      res.status(200).json({
        success: true,
        data: { upcomingTrips },
      });
    } catch (error) {
      logger.error('getWeeklySchedule: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getRecentActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.debug('getRecentActivity: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        logger.error('getRecentActivity: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;

      logger.debug('getRecentActivity: Getting user family', { userId });
      // Get user's family to show family-wide activity
      const userWithFamily = await this.dashboardService.getUserWithFamily(userId);

      let activities;
      let activitySource;
      if (userWithFamily?.familyMemberships?.[0]?.familyId) {
        // Use family-based activity if user belongs to a family
        const familyId = userWithFamily.familyMemberships[0].familyId;
        logger.debug('getRecentActivity: Getting family activity', { userId, familyId });
        activities = await this.dashboardService.getRecentActivityForFamily(familyId);
        activitySource = 'family';
      } else {
        // Fallback to user-based activity if no family
        logger.debug('getRecentActivity: Getting user activity (no family)', { userId });
        activities = await this.dashboardService.getRecentActivityForUser(userId);
        activitySource = 'user';
      }

      logger.debug('getRecentActivity: Activity retrieved', {
        userId,
        activitySource,
        activityCount: activities.length,
      });

      res.status(200).json({
        success: true,
        data: { activities },
      });
    } catch (error) {
      logger.error('getRecentActivity: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}