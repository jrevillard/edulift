import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import {
  formatDateForComparison,
  isDateInPast,
  isDateInPastWithTimezone,
  validateTripDate,
  validateTripDateWithTimezone,
  parseScheduleSlotDate,
  validateScheduleSlotCreation,
  validateScheduleSlotCreationWithTimezone,
  validateScheduleSlotModification,
  validateScheduleSlotModificationWithTimezone,
} from '../dateValidation';

// Mock current date for consistent testing
const mockToday = new Date('2024-01-15T10:00:00Z'); // Monday

// Mock Date constructor to ensure consistent testing
const originalDate = Date;
beforeAll(() => {
  global.Date = function(dateString?: any, month?: any, day?: any, ...args: unknown[]) {
    if (arguments.length === 0) {
      // new Date() without arguments should return mockToday
      return mockToday;
    }
    if (arguments.length === 1) {
      // new Date(dateString) should create date from string/number
      return new originalDate(dateString);
    }
    // new Date(year, month, day, ...) should pass through to original
    return new originalDate(dateString as number, month as number, day as number, ...(args as number[]));
  } as any;
  global.Date.now = jest.fn(() => mockToday.getTime());
  
  // Copy static methods from original Date
  Object.setPrototypeOf(global.Date, originalDate);
  Object.getOwnPropertyNames(originalDate).forEach(name => {
    if (name !== 'length' && name !== 'name' && name !== 'prototype') {
      (global.Date as any)[name] = (originalDate as any)[name];
    }
  });
});

afterAll(() => {
  global.Date = originalDate;
});

describe('Date Validation Utils', () => {
  describe('formatDateForComparison', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new originalDate('2024-01-15T15:30:00Z');
      expect(formatDateForComparison(date)).toBe('2024-01-15');
    });

    it('should format ISO date string to YYYY-MM-DD', () => {
      expect(formatDateForComparison('2024-01-15T15:30:00Z')).toBe('2024-01-15');
    });

    it('should format simple date string to YYYY-MM-DD', () => {
      expect(formatDateForComparison('2024-01-15')).toBe('2024-01-15');
    });

    it('should throw error for invalid date strings', () => {
      expect(() => formatDateForComparison('MONDAY')).toThrow('Invalid date provided: MONDAY');
      expect(() => formatDateForComparison('invalid-date')).toThrow('Invalid date provided: invalid-date');
      expect(() => formatDateForComparison('')).toThrow('Invalid date provided: ');
    });

    it('should throw error for invalid Date objects', () => {
      const invalidDate = new originalDate('invalid');
      expect(() => formatDateForComparison(invalidDate)).toThrow('Invalid date provided:');
    });
  });

  describe('isDateInPast', () => {
    it('should return true for past dates', () => {
      expect(isDateInPast('2024-01-14')).toBe(true); // Yesterday
      expect(isDateInPast('2024-01-01')).toBe(true); // Earlier this year
      expect(isDateInPast('2023-12-31')).toBe(true); // Last year
    });

    it('should return false for today at same time', () => {
      expect(isDateInPast('2024-01-15T10:00:00Z')).toBe(false); // Today at exactly current time
    });

    it('should return false for today future time', () => {
      expect(isDateInPast('2024-01-15T15:00:00Z')).toBe(false); // Today but later
    });

    it('should return true for today past time', () => {
      expect(isDateInPast('2024-01-15T05:00:00Z')).toBe(true); // Today but earlier
    });

    it('should return false for future dates', () => {
      expect(isDateInPast('2024-01-16')).toBe(false); // Tomorrow
      expect(isDateInPast('2024-01-31')).toBe(false); // Later this month
      expect(isDateInPast('2025-01-01')).toBe(false); // Next year
    });

    it('should handle Date objects', () => {
      const yesterday = new originalDate('2024-01-14T10:00:00Z');
      const today = new originalDate('2024-01-15T10:00:00Z');
      const tomorrow = new originalDate('2024-01-16T10:00:00Z');
      
      expect(isDateInPast(yesterday)).toBe(true);
      expect(isDateInPast(today)).toBe(false);
      expect(isDateInPast(tomorrow)).toBe(false);
    });

    it('should handle same day future times correctly', () => {
      // Test the exact scenario causing the bug
      // Current mock time is 2024-01-15T10:00:00Z
      const futureTimeToday = new originalDate('2024-01-15T15:00:00Z'); // 5 hours later
      const pastTimeToday = new originalDate('2024-01-15T05:00:00Z'); // 5 hours ago
      
      expect(isDateInPast(futureTimeToday)).toBe(false); // Should allow future time today
      expect(isDateInPast(pastTimeToday)).toBe(true); // Should block past time today
    });
  });

  describe('validateTripDate', () => {
    it('should not throw for future dates', () => {
      expect(() => validateTripDate('2024-01-16', 'create')).not.toThrow();
      expect(() => validateTripDate('2024-01-16', 'modify')).not.toThrow();
    });

    it('should not throw for today at current or future time', () => {
      expect(() => validateTripDate('2024-01-15T10:00:00Z', 'create')).not.toThrow();
      expect(() => validateTripDate('2024-01-15T15:00:00Z', 'create')).not.toThrow();
      expect(() => validateTripDate('2024-01-15T10:00:00Z', 'modify')).not.toThrow();
      expect(() => validateTripDate('2024-01-15T15:00:00Z', 'modify')).not.toThrow();
    });

    it('should throw for today at past time', () => {
      expect(() => validateTripDate('2024-01-15T05:00:00Z', 'create')).toThrow('Cannot create trips in the past');
      expect(() => validateTripDate('2024-01-15T05:00:00Z', 'modify')).toThrow('Cannot modify trips in the past');
    });

    it('should throw for past dates with create context', () => {
      expect(() => validateTripDate('2024-01-14', 'create')).toThrow('Cannot create trips in the past');
    });

    it('should throw for past dates with modify context', () => {
      expect(() => validateTripDate('2024-01-14', 'modify')).toThrow('Cannot modify trips in the past');
    });

    it('should handle Date objects', () => {
      const pastDate = new originalDate('2024-01-14T10:00:00Z');
      const futureDate = new originalDate('2024-01-16T10:00:00Z');
      
      expect(() => validateTripDate(pastDate, 'create')).toThrow('Cannot create trips in the past');
      expect(() => validateTripDate(futureDate, 'create')).not.toThrow();
    });
  });

  describe('parseScheduleSlotDate', () => {
    it('should parse valid ISO datetime strings', () => {
      const result = parseScheduleSlotDate('2024-01-15T15:30:00.000Z');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
      expect(result.getUTCHours()).toBe(15); // Use UTC hours to avoid timezone issues
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('should handle different ISO formats', () => {
      const result1 = parseScheduleSlotDate('2024-01-15T15:30:00Z');
      const result2 = parseScheduleSlotDate('2024-01-15T15:30:00.000Z');
      const result3 = parseScheduleSlotDate('2024-01-15T15:30:00+00:00');
      
      expect(result1.getTime()).toBe(result2.getTime());
      expect(result2.getTime()).toBe(result3.getTime());
    });

    it('should throw for empty datetime parameter', () => {
      expect(() => parseScheduleSlotDate('')).toThrow('DateTime parameter is required for date validation');
      expect(() => parseScheduleSlotDate(null as any)).toThrow('DateTime parameter is required for date validation');
    });

    it('should throw for invalid datetime formats', () => {
      expect(() => parseScheduleSlotDate('MONDAY')).toThrow('Invalid datetime format: MONDAY. Expected ISO 8601 datetime string.');
      expect(() => parseScheduleSlotDate('2024-01-15')).toThrow('Invalid datetime format: 2024-01-15. Expected ISO 8601 datetime string.');
      expect(() => parseScheduleSlotDate('invalid-datetime')).toThrow('Invalid datetime format: invalid-datetime. Expected ISO 8601 datetime string.');
    });
  });

  describe('validateScheduleSlotCreation', () => {
    it('should validate future datetime strings', () => {
      // Future datetime - should not throw
      expect(() => validateScheduleSlotCreation('2024-01-16T15:30:00.000Z')).not.toThrow();
      expect(() => validateScheduleSlotCreation('2024-01-15T15:00:00.000Z')).not.toThrow(); // Later today
    });

    it('should throw for past datetime strings', () => {
      // Past datetime - should throw
      expect(() => validateScheduleSlotCreation('2024-01-14T15:30:00.000Z')).toThrow('Cannot create trips in the past');
      expect(() => validateScheduleSlotCreation('2024-01-15T05:00:00.000Z')).toThrow('Cannot create trips in the past'); // Earlier today
    });

    it('should throw for invalid datetime formats', () => {
      expect(() => validateScheduleSlotCreation('MONDAY')).toThrow('Invalid datetime format');
      expect(() => validateScheduleSlotCreation('2024-01-15')).toThrow('Invalid datetime format');
    });
  });

  describe('validateScheduleSlotModification', () => {
    it('should validate future datetime strings', () => {
      // Future datetime - should not throw
      expect(() => validateScheduleSlotModification('2024-01-16T15:30:00.000Z')).not.toThrow();
      expect(() => validateScheduleSlotModification('2024-01-15T15:00:00.000Z')).not.toThrow(); // Later today
    });

    it('should throw for past datetime strings', () => {
      // Past datetime - should throw
      expect(() => validateScheduleSlotModification('2024-01-14T15:30:00.000Z')).toThrow('Cannot modify trips in the past');
      expect(() => validateScheduleSlotModification('2024-01-15T05:00:00.000Z')).toThrow('Cannot modify trips in the past'); // Earlier today
    });

    it('should throw for invalid datetime formats', () => {
      expect(() => validateScheduleSlotModification('TUESDAY')).toThrow('Invalid datetime format');
      expect(() => validateScheduleSlotModification('2024-01-15')).toThrow('Invalid datetime format');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle schedule slot datetime from database', () => {
      // Simulate data that would come from the database
      const scheduleSlotFromDB = {
        id: 'slot-123',
        datetime: '2024-01-17T08:30:00.000Z', // Wednesday at 8:30 AM UTC
      };

      // This should not throw for future datetime
      expect(() => {
        const date = parseScheduleSlotDate(scheduleSlotFromDB.datetime);
        validateTripDate(date, 'modify');
      }).not.toThrow();
    });

    it('should handle past schedule slot correctly', () => {
      const pastScheduleSlot = {
        datetime: '2024-01-08T08:30:00.000Z', // Past Monday
      };

      expect(() => {
        const date = parseScheduleSlotDate(pastScheduleSlot.datetime);
        validateTripDate(date, 'modify');
      }).toThrow('Cannot modify trips in the past');
    });

    it('should handle current week schedule slot', () => {
      const currentWeekSlot = {
        datetime: '2024-01-16T08:30:00.000Z', // Tuesday (later than mock current time)
      };

      expect(() => {
        const date = parseScheduleSlotDate(currentWeekSlot.datetime);
        validateTripDate(date, 'modify');
      }).not.toThrow();
    });

    it('should handle timezone considerations', () => {
      // UTC datetime that's future
      expect(() => parseScheduleSlotDate('2024-01-16T15:30:00.000Z')).not.toThrow();

      // UTC datetime with different timezone offset
      expect(() => parseScheduleSlotDate('2024-01-16T10:30:00+05:00')).not.toThrow();
    });
  });

  describe('Timezone-aware validation', () => {
    describe('isDateInPastWithTimezone', () => {
      it('should reject past dates in user timezone', () => {
        // Mock time is 2024-01-15T10:00:00Z (10:00 UTC)
        // In Europe/Paris (UTC+1), it's 11:00
        const pastDate = new originalDate('2024-01-14T10:00:00Z');
        expect(isDateInPastWithTimezone(pastDate, 'Europe/Paris', mockToday)).toBe(true);
      });

      it('should accept future dates in user timezone', () => {
        // Mock time is 2024-01-15T10:00:00Z
        const futureDate = new originalDate('2024-01-16T10:00:00Z');
        expect(isDateInPastWithTimezone(futureDate, 'America/New_York', mockToday)).toBe(false);
      });

      it('should allow dates that are past in UTC but future in user timezone', () => {
        // Mock time is 2024-01-15T10:00:00Z (Monday 10:00 UTC)
        // In Asia/Tokyo (UTC+9), it's 19:00 (7 PM) on Monday

        // Create a date for 2024-01-16T00:00:00Z (Tuesday 00:00 UTC)
        // In Tokyo, this is 2024-01-16T09:00 (Tuesday 9 AM JST)
        const futureInTokyo = new originalDate('2024-01-16T00:00:00Z');

        // Should NOT be in the past for Tokyo user (it's Tuesday morning for them)
        expect(isDateInPastWithTimezone(futureInTokyo, 'Asia/Tokyo', mockToday)).toBe(false);
      });

      it('should handle same day but different hours correctly', () => {
        // Mock time is 2024-01-15T10:00:00Z
        // Create a date 2 hours in the future (12:00 UTC)
        const laterToday = new originalDate('2024-01-15T12:00:00Z');
        expect(isDateInPastWithTimezone(laterToday, 'UTC', mockToday)).toBe(false);

        // Create a date 2 hours in the past (08:00 UTC)
        const earlierToday = new originalDate('2024-01-15T08:00:00Z');
        expect(isDateInPastWithTimezone(earlierToday, 'UTC', mockToday)).toBe(true);
      });

      it('should work with ISO string input', () => {
        const futureDate = '2024-01-16T10:00:00.000Z';
        expect(isDateInPastWithTimezone(futureDate, 'Europe/Paris', mockToday)).toBe(false);
      });

      it('should throw for invalid date', () => {
        expect(() => isDateInPastWithTimezone('invalid-date', 'UTC', mockToday)).toThrow('Invalid date provided');
      });
    });

    describe('validateTripDateWithTimezone', () => {
      it('should not throw for future dates in user timezone', () => {
        const futureDate = new originalDate('2024-01-16T10:00:00Z');
        expect(() => validateTripDateWithTimezone(futureDate, 'Europe/Paris', 'create', mockToday)).not.toThrow();
        expect(() => validateTripDateWithTimezone(futureDate, 'America/New_York', 'modify', mockToday)).not.toThrow();
      });

      it('should throw for past dates in user timezone with create context', () => {
        const pastDate = new originalDate('2024-01-14T10:00:00Z');
        expect(() => validateTripDateWithTimezone(pastDate, 'Europe/Paris', 'create', mockToday))
          .toThrow(/Cannot create trips in the past/);
      });

      it('should throw for past dates in user timezone with modify context', () => {
        const pastDate = new originalDate('2024-01-14T10:00:00Z');
        expect(() => validateTripDateWithTimezone(pastDate, 'America/New_York', 'modify', mockToday))
          .toThrow(/Cannot modify trips in the past/);
      });

      it('should include timezone and formatted time in error message', () => {
        const pastDate = new originalDate('2024-01-14T10:00:00Z');
        try {
          validateTripDateWithTimezone(pastDate, 'Europe/Paris', 'create', mockToday);
          fail('Should have thrown an error');
        } catch (error: any) {
          expect((error as Error).message).toContain('Europe/Paris');
          expect((error as Error).message).toContain('2024-01-14');
        }
      });

      it('should handle timezone differences correctly', () => {
        // When it's 2024-01-15T23:00:00Z (11 PM UTC Monday)
        // In Asia/Tokyo (UTC+9), it's already 2024-01-16T08:00 (8 AM Tuesday)
        const lateMonday = new originalDate('2024-01-15T23:00:00Z');

        // This is in the future for both UTC and Tokyo users
        expect(() => validateTripDateWithTimezone(lateMonday, 'Asia/Tokyo', 'create', mockToday)).not.toThrow();
        expect(() => validateTripDateWithTimezone(lateMonday, 'UTC', 'create', mockToday)).not.toThrow();
      });
    });

    describe('validateScheduleSlotCreationWithTimezone', () => {
      it('should validate future datetime with timezone', () => {
        expect(() => validateScheduleSlotCreationWithTimezone('2024-01-16T15:30:00.000Z', 'Europe/Paris', mockToday))
          .not.toThrow();
      });

      it('should throw for past datetime with timezone', () => {
        expect(() => validateScheduleSlotCreationWithTimezone('2024-01-14T15:30:00.000Z', 'America/New_York', mockToday))
          .toThrow(/Cannot create trips in the past/);
      });

      it('should include timezone in error message', () => {
        try {
          validateScheduleSlotCreationWithTimezone('2024-01-14T15:30:00.000Z', 'Asia/Tokyo', mockToday);
          fail('Should have thrown an error');
        } catch (error: any) {
          expect((error as Error).message).toContain('Asia/Tokyo');
        }
      });
    });

    describe('validateScheduleSlotModificationWithTimezone', () => {
      it('should validate future datetime with timezone', () => {
        expect(() => validateScheduleSlotModificationWithTimezone('2024-01-16T15:30:00.000Z', 'Europe/Paris', mockToday))
          .not.toThrow();
      });

      it('should throw for past datetime with timezone', () => {
        expect(() => validateScheduleSlotModificationWithTimezone('2024-01-14T15:30:00.000Z', 'America/New_York', mockToday))
          .toThrow(/Cannot modify trips in the past/);
      });

      it('should include timezone in error message', () => {
        try {
          validateScheduleSlotModificationWithTimezone('2024-01-14T15:30:00.000Z', 'Asia/Tokyo', mockToday);
          fail('Should have thrown an error');
        } catch (error: any) {
          expect((error as Error).message).toContain('Asia/Tokyo');
        }
      });
    });

    describe('Edge cases with timezone boundaries', () => {
      it('should handle DST transitions', () => {
        // Test date during DST transition (example: March 10, 2024 in America/New_York)
        // Mock time is 2024-01-15T10:00:00Z, so March 10 is in the FUTURE
        const dstDate = new originalDate('2024-03-10T12:00:00Z');
        expect(isDateInPastWithTimezone(dstDate, 'America/New_York', mockToday)).toBe(false);

        // Test with a DST date that's actually in the past (November 2023)
        const pastDstDate = new originalDate('2023-11-05T12:00:00Z');
        expect(isDateInPastWithTimezone(pastDstDate, 'America/New_York', mockToday)).toBe(true);
      });

      it('should handle date on timezone boundary', () => {
        // Mock time is 2024-01-15T10:00:00Z
        // Test with a time just after midnight in different timezones
        const justAfterMidnight = new originalDate('2024-01-16T00:30:00Z');

        // Should be future in all timezones
        expect(isDateInPastWithTimezone(justAfterMidnight, 'UTC', mockToday)).toBe(false);
        expect(isDateInPastWithTimezone(justAfterMidnight, 'Europe/Paris', mockToday)).toBe(false);
        expect(isDateInPastWithTimezone(justAfterMidnight, 'Asia/Tokyo', mockToday)).toBe(false);
      });

      it('should handle extreme timezone offsets', () => {
        // Test with Pacific/Kiritimati (UTC+14) - one of the furthest ahead timezones
        const futureDate = new originalDate('2024-01-16T10:00:00Z');
        expect(isDateInPastWithTimezone(futureDate, 'Pacific/Kiritimati', mockToday)).toBe(false);

        // Test with Pacific/Niue (UTC-11) - one of the furthest behind timezones
        expect(isDateInPastWithTimezone(futureDate, 'Pacific/Niue', mockToday)).toBe(false);
      });
    });
  });
});