import { Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor(prisma?: PrismaClient) {
    this.dashboardService = new DashboardService(prisma);
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      const stats = await this.dashboardService.calculateUserStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error getting dashboard stats:', error);
      }
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getTodaySchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      const upcomingTrips = await this.dashboardService.getTodayTripsForUser(userId);

      res.status(200).json({
        success: true,
        data: { upcomingTrips },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error getting today schedule:', error);
      }
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getWeeklySchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      const upcomingTrips = await this.dashboardService.getWeeklyTripsForUser(userId);

      res.status(200).json({
        success: true,
        data: { upcomingTrips },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error getting weekly schedule:', error);
      }
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  async getRecentActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const userId = req.user.id;
      
      // Get user's family to show family-wide activity
      const userWithFamily = await this.dashboardService.getUserWithFamily(userId);
      
      let activities;
      if (userWithFamily?.familyMemberships?.[0]?.familyId) {
        // Use family-based activity if user belongs to a family
        const familyId = userWithFamily.familyMemberships[0].familyId;
        activities = await this.dashboardService.getRecentActivityForFamily(familyId);
      } else {
        // Fallback to user-based activity if no family
        activities = await this.dashboardService.getRecentActivityForUser(userId);
      }

      res.status(200).json({
        success: true,
        data: { activities },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error getting recent activity:', error);
      }
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}