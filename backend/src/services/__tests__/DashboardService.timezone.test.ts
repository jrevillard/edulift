/// <reference types="jest" />
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { DashboardService } from '../DashboardService';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

// Mock PrismaClient - minimal mock for timezone tests
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    scheduleSlot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    familyMember: {
      findFirst: jest.fn(),
    },
    groupFamilyMember: {
      findMany: jest.fn(),
    },
    scheduleSlotVehicle: {
      findMany: jest.fn(),
    },
    scheduleSlotChild: {
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Mock dependencies
jest.mock('../GroupService');
jest.mock('../ChildService');
jest.mock('../VehicleService');
jest.mock('../../repositories/ActivityLogRepository');

describe('DashboardService Timezone Tests', () => {
  let service: DashboardService;

  beforeEach(() => {
    // Create fresh service instance
    service = new DashboardService(undefined as unknown as PrismaClient);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDayBoundariesInTimezone', () => {
    describe('UTC timezone (default)', () => {
      it('should return correct UTC boundaries for a given date', () => {
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'UTC');

        expect(result.start).toEqual(new Date('2025-01-15T00:00:00.000Z'));
        expect(result.end).toEqual(new Date('2025-01-15T23:59:59.999Z'));
      });
    });

    describe('Europe/Paris (UTC+1 in winter, UTC+2 in summer)', () => {
      it('should return correct boundaries during standard time (UTC+1)', () => {
        // January 15, 2025 - winter time (UTC+1)
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Europe/Paris');

        // In Paris, 2025-01-15 00:00 = 2025-01-14 23:00 UTC
        expect(result.start).toEqual(new Date('2025-01-14T23:00:00.000Z'));
        // In Paris, 2025-01-15 23:59:59.999 = 2025-01-15T22:59:59.999Z
        expect(result.end.toISOString()).toMatch(/2025-01-15T22:59:59/);
      });

      it('should handle DST transition correctly', () => {
        // March 30, 2025 - DST starts in Paris (clocks move forward 1 hour at 2:00 AM)
        // Before DST: UTC+1, After DST: UTC+2
        const date = new Date('2025-03-30T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Europe/Paris');

        // During DST transition, Luxon handles this correctly
        expect(result.start).toBeDefined();
        expect(result.end).toBeDefined();
        expect(result.end.getTime()).toBeGreaterThan(result.start.getTime());
      });
    });

    describe('America/New_York (UTC-5 in winter, UTC-4 in summer)', () => {
      it('should return correct boundaries during standard time (UTC-5)', () => {
        // January 15, 2025 - winter time (UTC-5)
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'America/New_York');

        // In New York, 2025-01-15 00:00 = 2025-01-15 05:00 UTC
        expect(result.start).toEqual(new Date('2025-01-15T05:00:00.000Z'));
        expect(result.end.toISOString()).toMatch(/2025-01-16T04:59:59/);
      });

      it('should return correct boundaries during daylight time (UTC-4)', () => {
        // July 15, 2025 - summer time (UTC-4)
        const date = new Date('2025-07-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'America/New_York');

        // In New York (summer), 2025-07-15 00:00 = 2025-07-15 04:00 UTC
        expect(result.start).toEqual(new Date('2025-07-15T04:00:00.000Z'));
        expect(result.end.toISOString()).toMatch(/2025-07-16T03:59:59/);
      });
    });

    describe('Asia/Tokyo (UTC+9, no DST)', () => {
      it('should return correct boundaries for UTC+9', () => {
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Asia/Tokyo');

        // In Tokyo, 2025-01-15 00:00 = 2025-01-14 15:00 UTC
        expect(result.start).toEqual(new Date('2025-01-14T15:00:00.000Z'));
        expect(result.end.toISOString()).toMatch(/2025-01-15T14:59:59/);
      });
    });

    describe('Australia/Sydney (UTC+11 in summer, UTC+10 in winter)', () => {
      it('should handle southern hemisphere DST correctly', () => {
        // January 2025 - summer in Sydney (UTC+11)
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Australia/Sydney');

        // In Sydney (summer), 2025-01-15 00:00 = 2025-01-14 13:00 UTC
        expect(result.start).toEqual(new Date('2025-01-14T13:00:00.000Z'));
      });
    });

    describe('Pacific/Auckland (UTC+13 in summer, UTC+12 in winter)', () => {
      it('should handle far eastern timezone correctly', () => {
        // January 2025 - summer in Auckland (UTC+13)
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Pacific/Auckland');

        // When it's 2025-01-15 12:00 UTC, in Auckland (UTC+13) it's 2025-01-16 01:00
        // So we're getting the day boundaries for 2025-01-16 in Auckland time
        // 2025-01-16 00:00 Auckland time = 2025-01-15 11:00 UTC
        expect(result.start).toEqual(new Date('2025-01-15T11:00:00.000Z'));
      });
    });

    describe('Asia/Kolkata (UTC+5:30, no DST)', () => {
      it('should handle half-hour offset timezone correctly', () => {
        const date = new Date('2025-01-15T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'Asia/Kolkata');

        // In Kolkata, 2025-01-15 00:00 = 2025-01-14 18:30 UTC
        expect(result.start).toEqual(new Date('2025-01-14T18:30:00.000Z'));
        expect(result.end.toISOString()).toMatch(/2025-01-15T18:29:59/);
      });
    });

    describe('Year boundaries', () => {
      it('should handle year transition correctly', () => {
        // December 31, 2024
        const date = new Date('2024-12-31T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'UTC');

        expect(result.start).toEqual(new Date('2024-12-31T00:00:00.000Z'));
        expect(result.end).toEqual(new Date('2024-12-31T23:59:59.999Z'));
      });

      it('should handle January 1 correctly', () => {
        const date = new Date('2025-01-01T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'UTC');

        expect(result.start).toEqual(new Date('2025-01-01T00:00:00.000Z'));
        expect(result.end).toEqual(new Date('2025-01-01T23:59:59.999Z'));
      });
    });

    describe('Leap year', () => {
      it('should handle February 29 in leap year', () => {
        const date = new Date('2024-02-29T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'UTC');

        expect(result.start).toEqual(new Date('2024-02-29T00:00:00.000Z'));
        expect(result.end).toEqual(new Date('2024-02-29T23:59:59.999Z'));
      });

      it('should handle March 1 in leap year', () => {
        const date = new Date('2024-03-01T12:00:00.000Z');
        const result = (service as any).getDayBoundariesInTimezone(date, 'UTC');

        expect(result.start).toEqual(new Date('2024-03-01T00:00:00.000Z'));
        expect(result.end).toEqual(new Date('2024-03-01T23:59:59.999Z'));
      });
    });
  });

  describe('getUTCDayBoundaries', () => {
    it('should return correct UTC boundaries', () => {
      const date = new Date('2025-06-15T15:30:45.123Z');
      const result = (service as any).getUTCDayBoundaries(date);

      expect(result.start).toEqual(new Date('2025-06-15T00:00:00.000Z'));
      expect(result.end).toEqual(new Date('2025-06-15T23:59:59.999Z'));
    });

    it('should handle midnight boundary correctly', () => {
      const date = new Date('2025-06-15T00:00:00.000Z');
      const result = (service as any).getUTCDayBoundaries(date);

      expect(result.start).toEqual(new Date('2025-06-15T00:00:00.000Z'));
      expect(result.end).toEqual(new Date('2025-06-15T23:59:59.999Z'));
    });

    it('should handle end of day boundary correctly', () => {
      const date = new Date('2025-06-15T23:59:59.999Z');
      const result = (service as any).getUTCDayBoundaries(date);

      expect(result.start).toEqual(new Date('2025-06-15T00:00:00.000Z'));
      expect(result.end).toEqual(new Date('2025-06-15T23:59:59.999Z'));
    });
  });

  describe('Timezone consistency across methods', () => {
    it('should produce consistent results for same timezone across different dates', () => {
      const timezone = 'America/New_York';
      const dates = [
        new Date('2025-01-15T00:00:00.000Z'),
        new Date('2025-06-15T00:00:00.000Z'),
        new Date('2025-12-15T00:00:00.000Z'),
      ];

      dates.forEach(date => {
        const result = (service as any).getDayBoundariesInTimezone(date, timezone);
        expect(result.start).toBeDefined();
        expect(result.end).toBeDefined();
        expect(result.end.getTime()).toBeGreaterThan(result.start.getTime());

        // Verify the day spans exactly 24 hours
        const dayDuration = result.end.getTime() - result.start.getTime();
        expect(dayDuration).toBe(24 * 60 * 60 * 1000 - 1); // 23:59:59.999
      });
    });
  });

  describe('Integration with Luxon', () => {
    it('should align with Luxon DateTime calculations', () => {
      const date = new Date('2025-01-15T12:00:00.000Z');
      const timezone = 'Europe/Paris';

      // Get our method's result
      const ourResult = (service as any).getDayBoundariesInTimezone(date, timezone);

      // Compare with Luxon direct calculation
      const dtInTimezone = DateTime.fromJSDate(date, { zone: timezone });
      const luxonStart = dtInTimezone.startOf('day').toUTC().toJSDate();
      const luxonEnd = dtInTimezone.endOf('day').toUTC().toJSDate();

      expect(ourResult.start).toEqual(luxonStart);
      expect(ourResult.end).toEqual(luxonEnd);
    });
  });
});
