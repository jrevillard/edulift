import { PrismaClient } from '@prisma/client';
import { DashboardService } from '../services/DashboardService';

/**
 * Prisma extension to add dashboard service functionality
 * This allows accessing dashboard methods via prisma.dashboardService.*
 */
export const createDashboardExtension = (prisma: PrismaClient) => {
  return prisma.$extends({
    name: 'dashboardService',
    client: {
      dashboardService: {
        /**
         * Get weekly dashboard with optimized DB-level filtering
         */
        getWeeklyDashboard: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getWeeklyDashboard(userId);
        },

        /**
         * Get user statistics
         */
        calculateUserStats: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.calculateUserStats(userId);
        },

        /**
         * Get today's trips for user
         */
        getTodayTripsForUser: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getTodayTripsForUser(userId);
        },

        /**
         * Get weekly trips for user
         */
        getWeeklyTripsForUser: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getWeeklyTripsForUser(userId);
        },

        /**
         * Get recent activity for user
         */
        getRecentActivityForUser: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getRecentActivityForUser(userId);
        },

        /**
         * Get recent activity for family
         */
        getRecentActivityForFamily: (familyId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getRecentActivityForFamily(familyId);
        },

        /**
         * Get user with family information
         */
        getUserWithFamily: (userId: string) => {
          const dashboardService = new DashboardService(prisma);
          return dashboardService.getUserWithFamily(userId);
        },
      },
    },
  });
};

/**
 * Type declaration for the extended Prisma client
 */
declare module '@prisma/client' {
  interface PrismaClient {
    dashboardService: {
      getWeeklyDashboard(userId: string): Promise<import('../types/DashboardTypes').DayTransportSummary[]>;
      calculateUserStats(userId: string): Promise<import('../services/DashboardService').DashboardStats>;
      getTodayTripsForUser(userId: string): Promise<import('../services/DashboardService').TodayTrip[]>;
      getWeeklyTripsForUser(userId: string): Promise<import('../services/DashboardService').TodayTrip[]>;
      getRecentActivityForUser(userId: string): Promise<import('../services/DashboardService').ActivityItem[]>;
      getRecentActivityForFamily(familyId: string): Promise<import('../services/DashboardService').ActivityItem[]>;
      getUserWithFamily(userId: string): Promise<any>;
    };
  }
}