import { describe, expect, test } from '@jest/globals';
import {
  convertUtcToTimezone,
  getWeekdayInTimezone,
  getTimeInTimezone,
  isValidTimezone,
  formatDateTimeForUser,
  getValidatedTimezone,
  COMMON_TIMEZONES,
} from '../timezoneUtils';

describe('TimezoneUtils', () => {
  describe('convertUtcToTimezone', () => {
    test('should convert UTC to Paris timezone (UTC+1 winter)', () => {
      const utc = '2025-01-13T07:30:00.000Z'; // Monday 07:30 UTC (winter)
      const result = convertUtcToTimezone(utc, 'Europe/Paris');

      expect(result.toFormat('HH:mm')).toBe('08:30'); // UTC+1
      expect(result.toFormat('EEEE')).toBe('Monday');
    });

    test('should convert UTC to Paris timezone (UTC+2 summer)', () => {
      const utc = '2025-07-13T07:30:00.000Z'; // Sunday 07:30 UTC (summer)
      const result = convertUtcToTimezone(utc, 'Europe/Paris');

      expect(result.toFormat('HH:mm')).toBe('09:30'); // UTC+2 (DST)
      expect(result.toFormat('EEEE')).toBe('Sunday');
    });

    test('should convert UTC to New York timezone', () => {
      const utc = '2025-01-13T14:00:00.000Z'; // Monday 14:00 UTC
      const result = convertUtcToTimezone(utc, 'America/New_York');

      expect(result.toFormat('HH:mm')).toBe('09:00'); // UTC-5 (winter)
      expect(result.toFormat('EEEE')).toBe('Monday');
    });

    test('should handle Date objects', () => {
      const utc = new Date('2025-01-13T07:30:00.000Z');
      const result = convertUtcToTimezone(utc, 'Europe/Paris');

      expect(result.toFormat('HH:mm')).toBe('08:30'); // UTC+1
    });
  });

  describe('getWeekdayInTimezone', () => {
    test('should return correct weekday in user timezone', () => {
      // Sunday 23:30 UTC = Monday 01:30 Paris (UTC+2 summer)
      const utc = '2025-07-13T23:30:00.000Z';
      const weekday = getWeekdayInTimezone(utc, 'Europe/Paris');

      expect(weekday).toBe('MONDAY'); // Next day in local time
    });

    test('should handle UTC timezone', () => {
      const utc = '2025-01-13T07:30:00.000Z'; // Monday
      const weekday = getWeekdayInTimezone(utc, 'UTC');

      expect(weekday).toBe('MONDAY');
    });

    test('should handle day boundary crossing (backward)', () => {
      // Monday 02:00 UTC = Sunday 21:00 New York (UTC-5)
      const utc = '2025-01-13T02:00:00.000Z';
      const weekday = getWeekdayInTimezone(utc, 'America/New_York');

      expect(weekday).toBe('SUNDAY');
    });

    test('should handle day boundary crossing (forward)', () => {
      // Sunday 23:00 UTC = Monday 00:00 Paris (UTC+1 winter)
      const utc = '2025-01-12T23:00:00.000Z';
      const weekday = getWeekdayInTimezone(utc, 'Europe/Paris');

      expect(weekday).toBe('MONDAY');
    });
  });

  describe('getTimeInTimezone', () => {
    test('should return correct time in HH:mm format', () => {
      const utc = '2025-01-13T05:30:00.000Z';
      const time = getTimeInTimezone(utc, 'Europe/Paris');

      expect(time).toBe('06:30'); // UTC+1 winter
    });

    test('should handle midnight crossings', () => {
      const utc = '2025-01-13T23:30:00.000Z';
      const time = getTimeInTimezone(utc, 'America/New_York');

      expect(time).toBe('18:30'); // UTC-5 winter
    });

    test('should handle early morning times', () => {
      const utc = '2025-01-13T06:30:00.000Z';
      const time = getTimeInTimezone(utc, 'Europe/Paris');

      expect(time).toBe('07:30'); // UTC+1 winter
    });

    test('should handle afternoon times', () => {
      const utc = '2025-01-13T13:00:00.000Z';
      const time = getTimeInTimezone(utc, 'Europe/Paris');

      expect(time).toBe('14:00'); // UTC+1 winter
    });

    test('should pad single-digit hours', () => {
      const utc = '2025-01-13T01:30:00.000Z';
      const time = getTimeInTimezone(utc, 'UTC');

      expect(time).toBe('01:30'); // Not '1:30'
    });

    test('should pad single-digit minutes', () => {
      const utc = '2025-01-13T07:05:00.000Z';
      const time = getTimeInTimezone(utc, 'UTC');

      expect(time).toBe('07:05'); // Not '07:5'
    });
  });

  describe('isValidTimezone', () => {
    test('should return true for valid IANA timezones', () => {
      expect(isValidTimezone('Europe/Paris')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
      expect(isValidTimezone('Australia/Sydney')).toBe(true);
    });

    test('should return false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('Paris')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('GMT+1')).toBe(false);
      expect(isValidTimezone('CET')).toBe(false);
    });

    test('should return false for whitespace-only strings', () => {
      expect(isValidTimezone('   ')).toBe(false);
      expect(isValidTimezone('\t')).toBe(false);
    });
  });

  describe('getValidatedTimezone', () => {
    test('should return UTC for undefined/null input', () => {
      expect(getValidatedTimezone(undefined)).toBe('UTC');
      expect(getValidatedTimezone(null)).toBe('UTC');
    });

    test('should return valid timezone as-is', () => {
      expect(getValidatedTimezone('Europe/Paris')).toBe('Europe/Paris');
      expect(getValidatedTimezone('America/New_York')).toBe('America/New_York');
      expect(getValidatedTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    });

    test('should return UTC for invalid timezone', () => {
      expect(getValidatedTimezone('Invalid/Timezone')).toBe('UTC');
      expect(getValidatedTimezone('CET')).toBe('UTC');
      expect(getValidatedTimezone('GMT+1')).toBe('UTC');
    });

    test('should recognize all common timezones', () => {
      COMMON_TIMEZONES.forEach(tz => {
        expect(getValidatedTimezone(tz)).toBe(tz);
      });
    });
  });

  describe('COMMON_TIMEZONES', () => {
    test('should include UTC', () => {
      expect(COMMON_TIMEZONES).toContain('UTC');
    });

    test('should include major European timezones', () => {
      expect(COMMON_TIMEZONES).toContain('Europe/Paris');
      expect(COMMON_TIMEZONES).toContain('Europe/London');
      expect(COMMON_TIMEZONES).toContain('Europe/Berlin');
    });

    test('should include major US timezones', () => {
      expect(COMMON_TIMEZONES).toContain('America/New_York');
      expect(COMMON_TIMEZONES).toContain('America/Los_Angeles');
      expect(COMMON_TIMEZONES).toContain('America/Chicago');
    });

    test('should include major Asian timezones', () => {
      expect(COMMON_TIMEZONES).toContain('Asia/Tokyo');
      expect(COMMON_TIMEZONES).toContain('Asia/Shanghai');
      expect(COMMON_TIMEZONES).toContain('Asia/Dubai');
    });

    test('all common timezones should be valid', () => {
      COMMON_TIMEZONES.forEach(tz => {
        expect(isValidTimezone(tz)).toBe(true);
      });
    });
  });

  describe('formatDateTimeForUser', () => {
    test('should format datetime for user display', () => {
      const utc = '2025-01-13T05:30:00.000Z';
      const formatted = formatDateTimeForUser(utc, 'Europe/Paris');

      expect(formatted).toBe('Monday 06:30');
    });

    test('should format with correct weekday and time', () => {
      const utc = '2025-01-14T13:00:00.000Z'; // Tuesday 13:00 UTC
      const formatted = formatDateTimeForUser(utc, 'Europe/Paris');

      expect(formatted).toBe('Tuesday 14:00'); // UTC+1
    });

    test('should handle day crossing in formatting', () => {
      // Sunday 23:30 UTC = Monday 00:30 Paris
      const utc = '2025-01-12T23:30:00.000Z';
      const formatted = formatDateTimeForUser(utc, 'Europe/Paris');

      expect(formatted).toBe('Monday 00:30');
    });

    test('should handle Date objects', () => {
      const utc = new Date('2025-01-13T05:30:00.000Z');
      const formatted = formatDateTimeForUser(utc, 'Europe/Paris');

      expect(formatted).toBe('Monday 06:30');
    });
  });

  describe('Real-world scenario: Paris user creating Monday 07:30 trip', () => {
    test('should correctly validate schedule time for Paris user', () => {
      // User in Paris (UTC+1 in winter) clicks "Monday 07:30 local"
      // Mobile app sends: Monday 06:30 UTC + timezone "Europe/Paris"
      const utcDatetime = '2025-01-13T06:30:00.000Z'; // Monday 06:30 UTC
      const timezone = 'Europe/Paris';

      const weekday = getWeekdayInTimezone(utcDatetime, timezone);
      const time = getTimeInTimezone(utcDatetime, timezone);

      expect(weekday).toBe('MONDAY');
      expect(time).toBe('07:30');
    });

    test('should correctly handle summer DST in Paris', () => {
      // User in Paris (UTC+2 in summer) clicks "Monday 07:30 local"
      // Mobile app sends: Monday 05:30 UTC + timezone "Europe/Paris"
      const utcDatetime = '2025-07-14T05:30:00.000Z'; // Monday 05:30 UTC
      const timezone = 'Europe/Paris';

      const weekday = getWeekdayInTimezone(utcDatetime, timezone);
      const time = getTimeInTimezone(utcDatetime, timezone);

      expect(weekday).toBe('MONDAY');
      expect(time).toBe('07:30');
    });
  });

  describe('Real-world scenario: New York user creating Friday 16:00 trip', () => {
    test('should correctly validate schedule time for New York user', () => {
      // User in New York (UTC-5 in winter) clicks "Friday 16:00 local"
      // Mobile app sends: Friday 21:00 UTC + timezone "America/New_York"
      const utcDatetime = '2025-01-17T21:00:00.000Z'; // Friday 21:00 UTC
      const timezone = 'America/New_York';

      const weekday = getWeekdayInTimezone(utcDatetime, timezone);
      const time = getTimeInTimezone(utcDatetime, timezone);

      expect(weekday).toBe('FRIDAY');
      expect(time).toBe('16:00');
    });
  });

  describe('Edge cases', () => {
    test('should handle midnight (00:00)', () => {
      const utc = '2025-01-13T00:00:00.000Z';
      const time = getTimeInTimezone(utc, 'UTC');

      expect(time).toBe('00:00');
    });

    test('should handle end of day (23:59)', () => {
      const utc = '2025-01-13T23:59:00.000Z';
      const time = getTimeInTimezone(utc, 'UTC');

      expect(time).toBe('23:59');
    });

    test('should handle leap year dates', () => {
      const utc = '2024-02-29T12:00:00.000Z'; // Leap day
      const weekday = getWeekdayInTimezone(utc, 'UTC');

      expect(weekday).toBe('THURSDAY');
    });

    test('should handle year boundary', () => {
      // Dec 31, 2024 23:00 UTC = Jan 1, 2025 00:00 Paris
      const utc = '2024-12-31T23:00:00.000Z';
      const weekday = getWeekdayInTimezone(utc, 'Europe/Paris');
      const time = getTimeInTimezone(utc, 'Europe/Paris');

      expect(weekday).toBe('WEDNESDAY'); // Jan 1, 2025
      expect(time).toBe('00:00');
    });
  });
});
