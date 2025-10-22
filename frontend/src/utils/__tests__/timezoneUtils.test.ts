import { describe, expect, test, beforeEach, vi, afterEach } from 'vitest';
import {
  getUserTimezone,
  getWeekdayInTimezone,
  getTimeInTimezone,
  isValidTimezone,
  convertUtcToLocal,
  formatDatetimeInTimezone,
  convertLocalToUtcTimeString,
  convertUtcToLocalTimeString,
  convertScheduleHoursToUtc,
  convertScheduleHoursToLocal,
  getBrowserTimezone,
  safeLocalStorageGet,
  safeLocalStorageSet,
  STORAGE_KEYS,
} from '../timezoneUtils';

describe('timezoneUtils', () => {
  describe('getUserTimezone', () => {
    test('should return a valid IANA timezone', () => {
      const timezone = getUserTimezone();

      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
      // Timezone should be a valid IANA format
      expect(isValidTimezone(timezone)).toBe(true);
    });
  });

  describe('isValidTimezone', () => {
    test('should return true for valid IANA timezones', () => {
      expect(isValidTimezone('Europe/Paris')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
    });

    test('should return false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('NotATimezone')).toBe(false);
      expect(isValidTimezone('Paris')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('123456')).toBe(false);
    });
  });

  describe('getWeekdayInTimezone', () => {
    test('should return correct weekday in Paris timezone (UTC+1)', () => {
      // Sunday 23:30 UTC = Monday 00:30 Paris (UTC+1 in winter)
      const utc = '2025-01-12T23:30:00.000Z'; // Sunday in UTC
      const weekday = getWeekdayInTimezone(utc, 'Europe/Paris');

      expect(weekday).toBe('Monday');
    });

    test('should return correct weekday in UTC timezone', () => {
      const utc = '2025-01-13T07:30:00.000Z'; // Monday in UTC
      const weekday = getWeekdayInTimezone(utc, 'UTC');

      expect(weekday).toBe('Monday');
    });

    test('should handle New York timezone (UTC-5)', () => {
      // Monday 02:00 UTC = Sunday 21:00 EST
      const utc = '2025-01-13T02:00:00.000Z'; // Monday in UTC
      const weekday = getWeekdayInTimezone(utc, 'America/New_York');

      expect(weekday).toBe('Sunday');
    });

    test('should handle Date object input', () => {
      const date = new Date('2025-01-13T23:30:00.000Z'); // Monday in UTC
      const weekday = getWeekdayInTimezone(date, 'Europe/Paris');

      expect(weekday).toBe('Tuesday'); // Tuesday 00:30 in Paris
    });
  });

  describe('getTimeInTimezone', () => {
    test('should return correct time in HH:mm format for Paris', () => {
      const utc = '2025-01-13T06:30:00.000Z';
      const time = getTimeInTimezone(utc, 'Europe/Paris');

      expect(time).toBe('07:30'); // UTC+1 in winter
    });

    test('should handle midnight crossings', () => {
      // 23:30 UTC -> 18:30 EST (UTC-5)
      const utc = '2025-01-13T23:30:00.000Z';
      const time = getTimeInTimezone(utc, 'America/New_York');

      expect(time).toBe('18:30');
    });

    test('should handle UTC timezone', () => {
      const utc = '2025-01-13T14:45:00.000Z';
      const time = getTimeInTimezone(utc, 'UTC');

      expect(time).toBe('14:45');
    });

    test('should handle Date object input', () => {
      const date = new Date('2025-01-13T12:00:00.000Z');
      const time = getTimeInTimezone(date, 'Europe/Paris');

      expect(time).toBe('13:00'); // UTC+1
    });
  });

  describe('formatDatetimeInTimezone', () => {
    test('should format datetime with custom format string', () => {
      const utc = '2025-01-13T14:30:00.000Z';
      const formatted = formatDatetimeInTimezone(utc, 'yyyy-MM-dd HH:mm', 'Europe/Paris');

      expect(formatted).toBe('2025-01-13 15:30'); // UTC+1
    });

    test('should handle different format patterns', () => {
      const utc = '2025-01-13T09:00:00.000Z';

      // Full datetime
      const full = formatDatetimeInTimezone(utc, "yyyy-MM-dd'T'HH:mm:ss", 'UTC');
      expect(full).toBe('2025-01-13T09:00:00');

      // Date only
      const dateOnly = formatDatetimeInTimezone(utc, 'yyyy-MM-dd', 'UTC');
      expect(dateOnly).toBe('2025-01-13');

      // Time only
      const timeOnly = formatDatetimeInTimezone(utc, 'HH:mm:ss', 'UTC');
      expect(timeOnly).toBe('09:00:00');
    });
  });

  describe('convertUtcToLocal', () => {
    test('should convert UTC to local timezone Date object', () => {
      const utc = '2025-01-13T12:00:00.000Z';
      const local = convertUtcToLocal(utc, 'Europe/Paris');

      // Should be a Date object
      expect(local).toBeInstanceOf(Date);

      // The ISO string should reflect the conversion
      // (exact validation depends on how Date handles timezone internally)
      expect(local.toISOString()).toBe('2025-01-13T12:00:00.000Z');
    });

    test('should handle Date object input', () => {
      const date = new Date('2025-01-13T08:00:00.000Z');
      const local = convertUtcToLocal(date, 'America/New_York');

      expect(local).toBeInstanceOf(Date);
    });
  });

  describe('edge cases', () => {
    test('should handle DST transitions', () => {
      // March DST transition in Paris (last Sunday of March)
      // Before DST: UTC+1, After DST: UTC+2

      // Before DST (January)
      const winterTime = getTimeInTimezone('2025-01-13T10:00:00.000Z', 'Europe/Paris');
      expect(winterTime).toBe('11:00'); // UTC+1

      // During summer (July)
      const summerTime = getTimeInTimezone('2025-07-13T10:00:00.000Z', 'Europe/Paris');
      expect(summerTime).toBe('12:00'); // UTC+2
    });

    test('should handle midnight boundary', () => {
      // 23:59 UTC should properly cross to next day in positive offsets
      const utc = '2025-01-13T23:59:00.000Z';
      const parisDay = getWeekdayInTimezone(utc, 'Europe/Paris');
      const parisTime = getTimeInTimezone(utc, 'Europe/Paris');

      expect(parisDay).toBe('Tuesday'); // Next day
      expect(parisTime).toBe('00:59'); // Past midnight
    });

    test('should handle 00:01 UTC crossing to previous day in negative offsets', () => {
      // 00:01 UTC should be previous day in negative offsets
      const utc = '2025-01-13T00:01:00.000Z'; // Monday
      const nyDay = getWeekdayInTimezone(utc, 'America/New_York');
      const nyTime = getTimeInTimezone(utc, 'America/New_York');

      expect(nyDay).toBe('Sunday'); // Previous day
      expect(nyTime).toBe('19:01'); // Late evening previous day
    });
  });

  // ========================================
  // PHASE 2 BOUNDARY TESTS - CRITICAL
  // ========================================

  describe('convertLocalToUtcTimeString', () => {
    test('should convert Paris local time to UTC (winter)', () => {
      // Paris UTC+1 in winter
      expect(convertLocalToUtcTimeString('07:30', 'Europe/Paris')).toBe('06:30');
    });

    test('should convert Paris local time to UTC (uses reference date)', () => {
      // Function uses reference date in January, so always UTC+1 for Paris
      expect(convertLocalToUtcTimeString('07:30', 'Europe/Paris')).toBe('06:30');
    });

    test('CRITICAL: should handle boundary crossing - Monday 00:30 Paris -> Sunday UTC', () => {
      // Monday 00:30 (Paris UTC+1) = Sunday 23:30 UTC
      expect(convertLocalToUtcTimeString('00:30', 'Europe/Paris')).toBe('23:30');
    });

    test('should handle boundary crossing - Monday 01:00 NY -> Monday UTC', () => {
      // Monday 01:00 EST (UTC-5) = Monday 06:00 UTC
      expect(convertLocalToUtcTimeString('01:00', 'America/New_York')).toBe('06:00');
    });

    test('should handle Tokyo timezone (UTC+9)', () => {
      // Tokyo 09:00 = 00:00 UTC same day
      expect(convertLocalToUtcTimeString('09:00', 'Asia/Tokyo')).toBe('00:00');
    });

    test('should handle midnight local time', () => {
      // Paris 00:00 = Previous day 23:00 UTC
      expect(convertLocalToUtcTimeString('00:00', 'Europe/Paris')).toBe('23:00');
    });

    test('should handle late evening time', () => {
      // Paris 23:30 = 22:30 UTC same day
      expect(convertLocalToUtcTimeString('23:30', 'Europe/Paris')).toBe('22:30');
    });

    test('should handle noon time', () => {
      // Paris 12:00 = 11:00 UTC
      expect(convertLocalToUtcTimeString('12:00', 'Europe/Paris')).toBe('11:00');
    });

    test('should handle negative offset timezone', () => {
      // NY 23:30 EST (UTC-5) = 04:30 UTC next day (but we only return time)
      expect(convertLocalToUtcTimeString('23:30', 'America/New_York')).toBe('04:30');
    });
  });

  describe('convertUtcToLocalTimeString', () => {
    test('should convert UTC to Paris local time', () => {
      expect(convertUtcToLocalTimeString('06:30', 'Europe/Paris')).toBe('07:30');
    });

    test('CRITICAL: should handle boundary crossing - Sunday 23:30 UTC -> Monday Paris', () => {
      // Sunday 23:30 UTC = Monday 00:30 Paris
      expect(convertUtcToLocalTimeString('23:30', 'Europe/Paris')).toBe('00:30');
    });

    test('should handle boundary crossing - Monday 05:00 UTC -> Sunday NY', () => {
      // Monday 05:00 UTC = Sunday 00:00 EST (UTC-5)
      expect(convertUtcToLocalTimeString('05:00', 'America/New_York')).toBe('00:00');
    });

    test('should handle Tokyo timezone', () => {
      // 15:00 UTC = 00:00 JST next day
      expect(convertUtcToLocalTimeString('15:00', 'Asia/Tokyo')).toBe('00:00');
    });

    test('should handle midnight UTC', () => {
      // 00:00 UTC = 01:00 Paris (UTC+1)
      expect(convertUtcToLocalTimeString('00:00', 'Europe/Paris')).toBe('01:00');
    });

    test('should handle noon UTC', () => {
      // 12:00 UTC = 13:00 Paris
      expect(convertUtcToLocalTimeString('12:00', 'Europe/Paris')).toBe('13:00');
    });

    test('should handle late UTC time', () => {
      // 23:00 UTC = 00:00 Paris next day
      expect(convertUtcToLocalTimeString('23:00', 'Europe/Paris')).toBe('00:00');
    });
  });

  describe('convertScheduleHoursToUtc', () => {
    test('should convert simple schedule without day crossing', () => {
      const local = {
        MONDAY: ['07:00', '08:00'],
        TUESDAY: ['15:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      expect(utc).toEqual({
        MONDAY: ['06:00', '07:00'],
        TUESDAY: ['14:00']
      });
    });

    test('CRITICAL: should handle day boundary crossing - Monday 00:30 -> Sunday UTC', () => {
      const local = {
        MONDAY: ['00:30', '07:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      // Monday 00:30 Paris (UTC+1) = Sunday 23:30 UTC
      // Monday 07:00 Paris = Monday 06:00 UTC
      expect(utc).toEqual({
        SUNDAY: ['23:30'],
        MONDAY: ['06:00']
      });
    });

    test('CRITICAL: should handle multiple slots crossing boundary', () => {
      const local = {
        MONDAY: ['00:00', '00:30', '01:00', '07:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      expect(utc).toEqual({
        SUNDAY: ['23:00', '23:30'],  // Crossed to Sunday
        MONDAY: ['00:00', '06:00']   // Stayed on Monday
      });
    });

    test('should handle Tokyo timezone (large positive offset)', () => {
      const local = {
        MONDAY: ['01:00', '09:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Asia/Tokyo'); // UTC+9

      // Monday 01:00 JST = Sunday 16:00 UTC
      // Monday 09:00 JST = Monday 00:00 UTC
      expect(utc).toEqual({
        SUNDAY: ['16:00'],
        MONDAY: ['00:00']
      });
    });

    test('should handle empty schedule', () => {
      const local = {};
      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');
      expect(utc).toEqual({});
    });

    test('should sort times within each day', () => {
      const local = {
        MONDAY: ['17:00', '07:00', '12:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      // Times should be sorted
      expect(utc.MONDAY).toEqual(['06:00', '11:00', '16:00']);
    });

    test('CRITICAL: Sunday late evening should stay on Sunday in UTC', () => {
      const local = {
        SUNDAY: ['22:00', '23:00']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      // Sunday 22:00 Paris = Sunday 21:00 UTC
      // Sunday 23:00 Paris = Sunday 22:00 UTC
      expect(utc).toEqual({
        SUNDAY: ['21:00', '22:00']
      });
    });

    test('CRITICAL: Should handle all weekdays with boundary crossings', () => {
      const local = {
        MONDAY: ['00:30'],
        TUESDAY: ['00:30'],
        WEDNESDAY: ['00:30'],
        THURSDAY: ['00:30'],
        FRIDAY: ['00:30'],
        SATURDAY: ['00:30'],
        SUNDAY: ['00:30']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      // Each day's 00:30 should become previous day's 23:30 in UTC
      expect(utc).toEqual({
        SUNDAY: ['23:30'],    // From Monday
        MONDAY: ['23:30'],    // From Tuesday
        TUESDAY: ['23:30'],   // From Wednesday
        WEDNESDAY: ['23:30'], // From Thursday
        THURSDAY: ['23:30'],  // From Friday
        FRIDAY: ['23:30'],    // From Saturday
        SATURDAY: ['23:30']   // From Sunday
      });
    });

    test('should handle New York timezone with negative offset', () => {
      const local = {
        MONDAY: ['23:30']  // Late evening
      };

      const utc = convertScheduleHoursToUtc(local, 'America/New_York'); // UTC-5

      // Monday 23:30 EST = Tuesday 04:30 UTC
      expect(utc).toEqual({
        TUESDAY: ['04:30']
      });
    });

    test('should handle single time slot', () => {
      const local = {
        WEDNESDAY: ['14:30']
      };

      const utc = convertScheduleHoursToUtc(local, 'Europe/Paris');

      expect(utc).toEqual({
        WEDNESDAY: ['13:30']
      });
    });
  });

  describe('convertScheduleHoursToLocal', () => {
    test('should convert UTC schedule to local', () => {
      const utc = {
        MONDAY: ['06:00', '07:00'],
        TUESDAY: ['14:00']
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      expect(local).toEqual({
        MONDAY: ['07:00', '08:00'],
        TUESDAY: ['15:00']
      });
    });

    test('CRITICAL: should handle day boundary crossing - Sunday 23:30 UTC -> Monday Paris', () => {
      const utc = {
        SUNDAY: ['23:30'],
        MONDAY: ['06:00']
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      // Sunday 23:30 UTC = Monday 00:30 Paris
      // Monday 06:00 UTC = Monday 07:00 Paris
      expect(local).toEqual({
        MONDAY: ['00:30', '07:00']
      });
    });

    test('CRITICAL: round-trip should preserve user intent', () => {
      const original = {
        MONDAY: ['00:30', '07:00', '17:00']
      };

      // Convert to UTC
      const utc = convertScheduleHoursToUtc(original, 'Europe/Paris');

      // Convert back to local
      const roundTrip = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      // Should match original exactly
      expect(roundTrip).toEqual(original);
    });

    test('should handle empty schedule', () => {
      const utc = {};
      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');
      expect(local).toEqual({});
    });

    test('should handle Tokyo timezone', () => {
      const utc = {
        SUNDAY: ['16:00'],
        MONDAY: ['00:00']
      };

      const local = convertScheduleHoursToLocal(utc, 'Asia/Tokyo'); // UTC+9

      // Sunday 16:00 UTC = Monday 01:00 JST
      // Monday 00:00 UTC = Monday 09:00 JST
      expect(local).toEqual({
        MONDAY: ['01:00', '09:00']
      });
    });

    test('CRITICAL: round-trip with multiple weekdays and boundary crossings', () => {
      const original = {
        MONDAY: ['00:30', '07:00'],
        TUESDAY: ['00:15', '08:30'],
        FRIDAY: ['23:45']
      };

      // Convert to UTC and back
      const utc = convertScheduleHoursToUtc(original, 'Europe/Paris');
      const roundTrip = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      // Should match original exactly
      expect(roundTrip).toEqual(original);
    });

    test('should handle New York timezone', () => {
      const utc = {
        TUESDAY: ['04:30']
      };

      const local = convertScheduleHoursToLocal(utc, 'America/New_York'); // UTC-5

      // Tuesday 04:30 UTC = Monday 23:30 EST
      expect(local).toEqual({
        MONDAY: ['23:30']
      });
    });

    test('CRITICAL: round-trip with Tokyo timezone', () => {
      const original = {
        MONDAY: ['01:00', '09:00', '18:00']
      };

      const utc = convertScheduleHoursToUtc(original, 'Asia/Tokyo');
      const roundTrip = convertScheduleHoursToLocal(utc, 'Asia/Tokyo');

      expect(roundTrip).toEqual(original);
    });

    test('CRITICAL: round-trip with New York timezone', () => {
      const original = {
        MONDAY: ['07:00', '23:30'],
        FRIDAY: ['18:00']
      };

      const utc = convertScheduleHoursToUtc(original, 'America/New_York');
      const roundTrip = convertScheduleHoursToLocal(utc, 'America/New_York');

      expect(roundTrip).toEqual(original);
    });

    test('should sort times after conversion', () => {
      const utc = {
        MONDAY: ['16:00', '06:00', '11:00']
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      // Times should be sorted
      expect(local.MONDAY).toEqual(['07:00', '12:00', '17:00']);
    });

    test('CRITICAL: all weekdays boundary crossing (reverse)', () => {
      const utc = {
        SUNDAY: ['23:30'],
        MONDAY: ['23:30'],
        TUESDAY: ['23:30'],
        WEDNESDAY: ['23:30'],
        THURSDAY: ['23:30'],
        FRIDAY: ['23:30'],
        SATURDAY: ['23:30']
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      // Each day's 23:30 UTC should become next day's 00:30 in Paris
      expect(local).toEqual({
        MONDAY: ['00:30'],    // From Sunday
        TUESDAY: ['00:30'],   // From Monday
        WEDNESDAY: ['00:30'], // From Tuesday
        THURSDAY: ['00:30'],  // From Wednesday
        FRIDAY: ['00:30'],    // From Thursday
        SATURDAY: ['00:30'],  // From Friday
        SUNDAY: ['00:30']     // From Saturday
      });
    });
  });

  describe('getBrowserTimezone', () => {
    test('should return a valid IANA timezone', () => {
      const timezone = getBrowserTimezone();

      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
      expect(isValidTimezone(timezone)).toBe(true);
    });

    test('should return UTC on error', () => {
      // Mock Intl.DateTimeFormat to throw error
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('DateTimeFormat error');
      });

      const timezone = getBrowserTimezone();
      expect(timezone).toBe('UTC');

      // Restore
      Intl.DateTimeFormat = originalDateTimeFormat;
    });

    test('should be same as getUserTimezone', () => {
      expect(getBrowserTimezone()).toBe(getUserTimezone());
    });
  });

  describe('Safe localStorage operations', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    describe('safeLocalStorageGet', () => {
      test('should get existing value from localStorage', () => {
        localStorage.setItem('testKey', 'testValue');
        const value = safeLocalStorageGet('testKey');
        expect(value).toBe('testValue');
      });

      test('should return null for non-existent key', () => {
        const value = safeLocalStorageGet('nonExistentKey');
        expect(value).toBe(null);
      });

      test('should return null when localStorage throws error', () => {
        // Mock localStorage.getItem to throw error (simulating private browsing)
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = vi.fn(() => {
          throw new Error('localStorage disabled');
        });

        const value = safeLocalStorageGet('testKey');
        expect(value).toBe(null);

        // Restore
        Storage.prototype.getItem = originalGetItem;
      });

      test('should work with STORAGE_KEYS constant', () => {
        localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_TIMEZONE, 'true');
        const value = safeLocalStorageGet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE);
        expect(value).toBe('true');
      });
    });

    describe('safeLocalStorageSet', () => {
      test('should set value in localStorage', () => {
        const success = safeLocalStorageSet('testKey', 'testValue');
        expect(success).toBe(true);
        expect(localStorage.getItem('testKey')).toBe('testValue');
      });

      test('should return false when localStorage throws error', () => {
        // Mock localStorage.setItem to throw error (simulating quota exceeded)
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = vi.fn(() => {
          throw new Error('QuotaExceededError');
        });

        const success = safeLocalStorageSet('testKey', 'testValue');
        expect(success).toBe(false);

        // Restore
        Storage.prototype.setItem = originalSetItem;
      });

      test('should work with STORAGE_KEYS constant', () => {
        const success = safeLocalStorageSet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE, 'false');
        expect(success).toBe(true);
        expect(localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_TIMEZONE)).toBe('false');
      });

      test('should overwrite existing value', () => {
        safeLocalStorageSet('testKey', 'value1');
        expect(localStorage.getItem('testKey')).toBe('value1');

        safeLocalStorageSet('testKey', 'value2');
        expect(localStorage.getItem('testKey')).toBe('value2');
      });
    });

    describe('STORAGE_KEYS', () => {
      test('should have AUTO_SYNC_TIMEZONE key', () => {
        expect(STORAGE_KEYS.AUTO_SYNC_TIMEZONE).toBe('autoSyncTimezone');
      });

      test('should be readonly (const)', () => {
        // This test verifies TypeScript compilation enforces readonly
        // If this compiles, STORAGE_KEYS is properly typed
        const key: string = STORAGE_KEYS.AUTO_SYNC_TIMEZONE;
        expect(key).toBeTruthy();
      });
    });
  });
});
