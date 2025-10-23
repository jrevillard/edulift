import { DateTime } from 'luxon';
import {
  getISOWeekNumber,
  getISOWeekYear,
  getDateFromISOWeek,
  getWeekBoundaries,
  formatISOWeek,
  isSameISOWeek,
} from '../isoWeekUtils';

describe('ISO Week Utilities - Timezone Aware', () => {
  describe('getISOWeekNumber', () => {
    it('should calculate ISO week in user timezone', () => {
      // Week 1 of 2024 in Europe/Paris (UTC+1)
      // Monday 2024-01-01 00:00 CET = Sunday 2023-12-31 23:00 UTC
      const utcDate = new Date('2023-12-31T23:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Europe/Paris');
      expect(week).toBe(1); // It's Monday in Paris, so Week 1
    });

    it('should handle timezone where week boundary differs from UTC - Asia/Tokyo', () => {
      // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST
      // In Tokyo, this is Monday of Week 1, 2025
      const utcDate = new Date('2024-12-31T20:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Asia/Tokyo');
      expect(week).toBe(1);
    });

    it('should handle timezone where week boundary differs from UTC - America/Los_Angeles', () => {
      // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
      // In LA, this is still Sunday of Week 52, 2023
      const utcDate = new Date('2024-01-01T07:00:00Z');
      const week = getISOWeekNumber(utcDate, 'America/Los_Angeles');
      expect(week).toBe(52);
    });

    it('should handle mid-week dates correctly', () => {
      // Wednesday 2024-01-03 12:00 UTC in Europe/Paris
      const utcDate = new Date('2024-01-03T12:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Europe/Paris');
      expect(week).toBe(1); // Week 1 of 2024
    });

    it('should handle ISO string input', () => {
      const isoString = '2024-01-01T07:00:00Z';
      const week = getISOWeekNumber(isoString, 'America/Los_Angeles');
      expect(week).toBe(52);
    });

    it('should handle DST transition within a week', () => {
      // US DST starts on March 10, 2024 at 02:00 -> 03:00
      // Week containing DST transition
      const beforeDST = new Date('2024-03-08T12:00:00Z'); // Friday before DST
      const afterDST = new Date('2024-03-11T12:00:00Z'); // Monday after DST

      const weekBefore = getISOWeekNumber(beforeDST, 'America/New_York');
      const weekAfter = getISOWeekNumber(afterDST, 'America/New_York');

      // Both should be in different weeks
      expect(weekBefore).toBe(10);
      expect(weekAfter).toBe(11);
    });

    it('should handle year-end edge case', () => {
      // Thursday 2024-12-26 12:00 UTC in Europe/Paris
      // This is Week 52 of 2024
      const utcDate = new Date('2024-12-26T12:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Europe/Paris');
      expect(week).toBe(52);
    });

    it('should handle year-start edge case', () => {
      // Sunday 2023-01-01 is in ISO Week 52 of 2022
      const utcDate = new Date('2023-01-01T12:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Europe/Paris');
      expect(week).toBe(52); // Week 52 of 2022
    });
  });

  describe('getISOWeekYear', () => {
    it('should return correct year for dates in first ISO week', () => {
      // Monday 2024-01-01 00:00 CET = Sunday 2023-12-31 23:00 UTC
      const utcDate = new Date('2023-12-31T23:00:00Z');
      const year = getISOWeekYear(utcDate, 'Europe/Paris');
      expect(year).toBe(2024); // Week 1 of 2024
    });

    it('should return correct year for Asia/Tokyo edge case', () => {
      // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST
      const utcDate = new Date('2024-12-31T20:00:00Z');
      const year = getISOWeekYear(utcDate, 'Asia/Tokyo');
      expect(year).toBe(2025); // Week 1 of 2025
    });

    it('should return correct year for America/Los_Angeles edge case', () => {
      // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
      const utcDate = new Date('2024-01-01T07:00:00Z');
      const year = getISOWeekYear(utcDate, 'America/Los_Angeles');
      expect(year).toBe(2023); // Week 52 of 2023
    });

    it('should handle year-end dates that belong to next year', () => {
      // Friday 2023-12-29 is in Week 52 of 2023
      const utcDate = new Date('2023-12-29T12:00:00Z');
      const year = getISOWeekYear(utcDate, 'Europe/Paris');
      expect(year).toBe(2023);
    });

    it('should handle year-start dates that belong to previous year', () => {
      // Sunday 2023-01-01 is in ISO Week 52 of 2022
      const utcDate = new Date('2023-01-01T12:00:00Z');
      const year = getISOWeekYear(utcDate, 'Europe/Paris');
      expect(year).toBe(2022);
    });
  });

  describe('getDateFromISOWeek', () => {
    it('should get correct date from ISO week in user timezone', () => {
      // Week 1 of 2024 in Europe/Paris
      // Should return Monday 2024-01-01 00:00 CET = Sunday 2023-12-31 23:00 UTC
      const date = getDateFromISOWeek(2024, 1, 'Europe/Paris');

      const expected = DateTime.fromObject(
        { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
        { zone: 'Europe/Paris' },
      ).toUTC().toJSDate();

      expect(date.toISOString()).toBe(expected.toISOString());
    });

    it('should get correct date from ISO week in Asia/Tokyo', () => {
      // Week 1 of 2024 in Asia/Tokyo
      // Should return Monday 2024-01-01 00:00 JST = Sunday 2023-12-31 15:00 UTC
      const date = getDateFromISOWeek(2024, 1, 'Asia/Tokyo');

      const expected = DateTime.fromObject(
        { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
        { zone: 'Asia/Tokyo' },
      ).toUTC().toJSDate();

      expect(date.toISOString()).toBe(expected.toISOString());
    });

    it('should get correct date from ISO week in America/Los_Angeles', () => {
      // Week 52 of 2023 in America/Los_Angeles
      // Should return Monday 2023-12-25 00:00 PST = Monday 2023-12-25 08:00 UTC
      const date = getDateFromISOWeek(2023, 52, 'America/Los_Angeles');

      const expected = DateTime.fromObject(
        { year: 2023, month: 12, day: 25, hour: 0, minute: 0 },
        { zone: 'America/Los_Angeles' },
      ).toUTC().toJSDate();

      expect(date.toISOString()).toBe(expected.toISOString());
    });

    it('should handle week during DST transition', () => {
      // Week 11 of 2024 in America/New_York (contains DST start on March 10)
      const date = getDateFromISOWeek(2024, 11, 'America/New_York');

      // Week 11 starts on Monday 2024-03-11
      const expected = DateTime.fromObject(
        { year: 2024, month: 3, day: 11, hour: 0, minute: 0 },
        { zone: 'America/New_York' },
      ).toUTC().toJSDate();

      expect(date.toISOString()).toBe(expected.toISOString());
    });

    it('should round-trip with getISOWeekNumber and getISOWeekYear', () => {
      const timezone = 'Europe/Paris';
      const year = 2024;
      const week = 15;

      // Get date from week
      const date = getDateFromISOWeek(year, week, timezone);

      // Convert back to week and year
      const resultWeek = getISOWeekNumber(date, timezone);
      const resultYear = getISOWeekYear(date, timezone);

      expect(resultWeek).toBe(week);
      expect(resultYear).toBe(year);
    });
  });

  describe('getWeekBoundaries', () => {
    it('should return correct week boundaries in user timezone', () => {
      // Wednesday 2024-01-03 12:00 UTC in Europe/Paris
      const utcDate = new Date('2024-01-03T12:00:00Z');
      const boundaries = getWeekBoundaries(utcDate, 'Europe/Paris');

      // Week should start on Monday 2024-01-01 00:00 CET
      const expectedStart = DateTime.fromObject(
        { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
        { zone: 'Europe/Paris' },
      ).toUTC().toJSDate();

      // Week should end on Sunday 2024-01-07 23:59:59.999 CET
      const expectedEnd = DateTime.fromObject(
        { year: 2024, month: 1, day: 7, hour: 23, minute: 59, second: 59, millisecond: 999 },
        { zone: 'Europe/Paris' },
      ).toUTC().toJSDate();

      expect(boundaries.weekStart.toISOString()).toBe(expectedStart.toISOString());
      expect(boundaries.weekEnd.toISOString()).toBe(expectedEnd.toISOString());
    });

    it('should handle week boundaries in Asia/Tokyo', () => {
      // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST
      const utcDate = new Date('2024-12-31T20:00:00Z');
      const boundaries = getWeekBoundaries(utcDate, 'Asia/Tokyo');

      // Week should start on Monday 2024-12-30 00:00 JST
      const expectedStart = DateTime.fromObject(
        { year: 2024, month: 12, day: 30, hour: 0, minute: 0 },
        { zone: 'Asia/Tokyo' },
      ).toUTC().toJSDate();

      // Week should end on Sunday 2025-01-05 23:59:59.999 JST
      const expectedEnd = DateTime.fromObject(
        { year: 2025, month: 1, day: 5, hour: 23, minute: 59, second: 59, millisecond: 999 },
        { zone: 'Asia/Tokyo' },
      ).toUTC().toJSDate();

      expect(boundaries.weekStart.toISOString()).toBe(expectedStart.toISOString());
      expect(boundaries.weekEnd.toISOString()).toBe(expectedEnd.toISOString());
    });

    it('should handle week boundaries in America/Los_Angeles', () => {
      // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
      const utcDate = new Date('2024-01-01T07:00:00Z');
      const boundaries = getWeekBoundaries(utcDate, 'America/Los_Angeles');

      // Week should start on Monday 2023-12-25 00:00 PST (Week 52)
      const expectedStart = DateTime.fromObject(
        { year: 2023, month: 12, day: 25, hour: 0, minute: 0 },
        { zone: 'America/Los_Angeles' },
      ).toUTC().toJSDate();

      // Week should end on Sunday 2023-12-31 23:59:59.999 PST
      const expectedEnd = DateTime.fromObject(
        { year: 2023, month: 12, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999 },
        { zone: 'America/Los_Angeles' },
      ).toUTC().toJSDate();

      expect(boundaries.weekStart.toISOString()).toBe(expectedStart.toISOString());
      expect(boundaries.weekEnd.toISOString()).toBe(expectedEnd.toISOString());
    });
  });

  describe('formatISOWeek', () => {
    it('should format ISO week correctly', () => {
      const utcDate = new Date('2024-01-03T12:00:00Z');
      const formatted = formatISOWeek(utcDate, 'Europe/Paris');
      expect(formatted).toBe('Week 1, 2024');
    });

    it('should format ISO week for year-end edge case', () => {
      // Sunday 2023-01-01 is in Week 52 of 2022
      const utcDate = new Date('2023-01-01T12:00:00Z');
      const formatted = formatISOWeek(utcDate, 'Europe/Paris');
      expect(formatted).toBe('Week 52, 2022');
    });

    it('should format ISO week for timezone edge case', () => {
      // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
      const utcDate = new Date('2024-01-01T07:00:00Z');
      const formatted = formatISOWeek(utcDate, 'America/Los_Angeles');
      expect(formatted).toBe('Week 52, 2023');
    });
  });

  describe('isSameISOWeek', () => {
    it('should return true for dates in same ISO week', () => {
      const monday = new Date('2024-01-01T12:00:00Z');
      const friday = new Date('2024-01-05T12:00:00Z');
      const result = isSameISOWeek(monday, friday, 'Europe/Paris');
      expect(result).toBe(true);
    });

    it('should return false for dates in different ISO weeks', () => {
      const sunday = new Date('2023-12-31T12:00:00Z'); // Week 52 of 2023
      const monday = new Date('2024-01-01T12:00:00Z'); // Week 1 of 2024
      const result = isSameISOWeek(sunday, monday, 'Europe/Paris');
      expect(result).toBe(false);
    });

    it('should handle timezone differences', () => {
      // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST (Week 1)
      // Monday 2024-01-01 12:00 UTC = Monday 2024-01-01 21:00 JST (Week 1)
      const date1 = new Date('2024-12-31T20:00:00Z');
      const date2 = new Date('2025-01-01T12:00:00Z');
      const result = isSameISOWeek(date1, date2, 'Asia/Tokyo');
      expect(result).toBe(true); // Both are in Week 1 of 2025 in Tokyo
    });

    it('should return false for dates in different years', () => {
      const date1 = new Date('2023-12-28T12:00:00Z'); // Week 52 of 2023
      const date2 = new Date('2024-01-04T12:00:00Z'); // Week 1 of 2024
      const result = isSameISOWeek(date1, date2, 'Europe/Paris');
      expect(result).toBe(false);
    });

    it('should handle ISO string input', () => {
      const isoString1 = '2024-01-01T12:00:00Z';
      const isoString2 = '2024-01-05T12:00:00Z';
      const result = isSameISOWeek(isoString1, isoString2, 'Europe/Paris');
      expect(result).toBe(true);
    });
  });

  describe('Verification Criteria', () => {
    it('should verify Asia/Tokyo criteria: Sunday 2024-12-31 20:00 UTC → Week 1, 2024', () => {
      const utcDate = new Date('2024-12-31T20:00:00Z');
      const week = getISOWeekNumber(utcDate, 'Asia/Tokyo');
      const year = getISOWeekYear(utcDate, 'Asia/Tokyo');

      // In Tokyo, this is Monday 2025-01-01 05:00 JST → Week 1, 2025
      expect(week).toBe(1);
      expect(year).toBe(2025);
    });

    it('should verify America/Los_Angeles criteria: Monday 2024-01-01 07:00 UTC → Week 52, 2023', () => {
      const utcDate = new Date('2024-01-01T07:00:00Z');
      const week = getISOWeekNumber(utcDate, 'America/Los_Angeles');
      const year = getISOWeekYear(utcDate, 'America/Los_Angeles');

      // In LA, this is Sunday 2023-12-31 23:00 PST → Week 52, 2023
      expect(week).toBe(52);
      expect(year).toBe(2023);
    });

    it('should verify week boundaries are Monday 00:00 in user timezone', () => {
      const utcDate = new Date('2024-01-03T12:00:00Z');
      const boundaries = getWeekBoundaries(utcDate, 'Europe/Paris');

      // Convert back to Europe/Paris to check
      const startInParis = DateTime.fromJSDate(boundaries.weekStart, { zone: 'utc' })
        .setZone('Europe/Paris');

      expect(startInParis.weekday).toBe(1); // Monday
      expect(startInParis.hour).toBe(0);
      expect(startInParis.minute).toBe(0);
      expect(startInParis.second).toBe(0);
      expect(startInParis.millisecond).toBe(0);
    });
  });
});
