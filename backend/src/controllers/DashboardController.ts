import { Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { createLogger, Logger } from '../utils/logger';

export class DashboardController {
  private dashboardService: DashboardService;
  private logger: Logger;

  constructor(prisma?: PrismaClient, logger: Logger = createLogger('DashboardController')) {
    this.dashboardService = new DashboardService(prisma);
    this.logger = logger;
  }

  getStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.debug('getStats: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        this.logger.error('getStats: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      this.logger.debug('getStats: Calling service', { userId });
      const stats = await this.dashboardService.calculateUserStats(userId);

      this.logger.debug('getStats: Stats calculated successfully', {
        userId,
        hasStats: !!stats,
        statsKeys: stats ? Object.keys(stats) : [],
      });

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.logger.error('getStats: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };

  getTodaySchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.debug('getTodaySchedule: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        this.logger.error('getTodaySchedule: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      this.logger.debug('getTodaySchedule: Calling service', { userId });
      const upcomingTrips = await this.dashboardService.getTodayTripsForUser(userId);

      this.logger.debug('getTodaySchedule: Today schedule retrieved', {
        userId,
        tripCount: upcomingTrips.length,
      });

      res.status(200).json({
        success: true,
        data: { upcomingTrips },
      });
    } catch (error) {
      this.logger.error('getTodaySchedule: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };


  getRecentActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.debug('getRecentActivity: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Check authentication
      if (!req.user) {
        this.logger.error('getRecentActivity: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;

      this.logger.debug('getRecentActivity: Getting user family', { userId });
      // Get user's family to show family-wide activity
      const userWithFamily = await this.dashboardService.getUserWithFamily(userId);

      let activities;
      let activitySource;
      if (userWithFamily?.familyMemberships?.[0]?.familyId) {
        // Use family-based activity if user belongs to a family
        const familyId = userWithFamily.familyMemberships[0].familyId;
        this.logger.debug('getRecentActivity: Getting family activity', { userId, familyId });
        activities = await this.dashboardService.getRecentActivityForFamily(familyId);
        activitySource = 'family';
      } else {
        // Fallback to user-based activity if no family
        this.logger.debug('getRecentActivity: Getting user activity (no family)', { userId });
        activities = await this.dashboardService.getRecentActivityForUser(userId);
        activitySource = 'user';
      }

      this.logger.debug('getRecentActivity: Activity retrieved', {
        userId,
        activitySource,
        activityCount: activities.length,
      });

      res.status(200).json({
        success: true,
        data: { activities },
      });
    } catch (error) {
      this.logger.error('getRecentActivity: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };

  getWeeklyDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.debug('getWeeklyDashboard: Received request', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      // Per specification lines 94-101: Extract familyId from authenticated user
      const authenticatedUserId = req.user?.id;

      if (!authenticatedUserId) {
        this.logger.error('getWeeklyDashboard: Authentication required', { userId: req.userId });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Get user's family ID using the service method
      const authenticatedFamilyId = await this.dashboardService.getUserFamilyId(authenticatedUserId);

      if (!authenticatedFamilyId) {
        this.logger.error('getWeeklyDashboard: No family associated with user', { userId: authenticatedUserId });
        res.status(401).json({
          success: false,
          error: 'No family associated with user',
        });
        return;
      }

      // Parse optional startDate parameter per specification lines 116-124
      let startDate: Date | undefined;
      if (req.query.startDate) {
        const parsed = new Date(req.query.startDate as string);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD format.',
          });
          return;
        }
        startDate = parsed;
      }

      this.logger.debug('getWeeklyDashboard: Getting weekly dashboard', {
        userId: authenticatedUserId,
        familyId: authenticatedFamilyId,
        startDate,
      });

      // Use the service method which now returns WeeklyDashboardResponse
      const dashboardResponse = await this.dashboardService.getWeeklyDashboard(authenticatedUserId, startDate);

      this.logger.debug('getWeeklyDashboard: Weekly dashboard retrieved', {
        userId: authenticatedUserId,
        familyId: authenticatedFamilyId,
        startDate,
        success: dashboardResponse.success,
        hasData: !!dashboardResponse.data,
      });

      // Return the response directly from the service
      if (dashboardResponse.success) {
        res.status(200).json(dashboardResponse);
      } else {
        // Handle error responses from service
        const statusCode = dashboardResponse.statusCode || 500;
        res.status(statusCode).json(dashboardResponse);
      }
    } catch (error) {
      this.logger.error('getWeeklyDashboard: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      });
    }
  };
}