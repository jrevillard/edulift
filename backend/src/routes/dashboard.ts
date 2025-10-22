import { Router, Response } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const dashboardController = new DashboardController(prisma);

// All routes require authentication
router.use(authenticateToken);

// Dashboard statistics
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await dashboardController.getStats(req, res);
}));

// Today's schedule
router.get('/today-schedule', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await dashboardController.getTodaySchedule(req, res);
}));

// Weekly schedule
router.get('/weekly-schedule', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await dashboardController.getWeeklySchedule(req, res);
}));

// Recent activity
router.get('/recent-activity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await dashboardController.getRecentActivity(req, res);
}));

export default router;