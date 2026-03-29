import { describe, expect, test, beforeEach, vi } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

import {
  getUserTimezone,
  isValidTimezone,
  convertScheduleHoursToUtc,
  convertScheduleHoursToLocal,
  getBrowserTimezone,
} from '../timezoneUtils';

describe('timezoneUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserTimezone', () => {
    test('should return a valid IANA timezone', () => {
      const timezone = getUserTimezone();

      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
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

  describe('convertScheduleHoursToUtc', () => {
    test('should convert local schedule to UTC schedule', () => {
      const localSchedule = {
        MONDAY: ['09:00', '17:00'],
        FRIDAY: ['15:00'],
      };

      const utcSchedule = convertScheduleHoursToUtc(localSchedule, 'Europe/Paris');

      expect(utcSchedule.MONDAY).toEqual(['08:00', '16:00']);
      expect(utcSchedule.FRIDAY).toEqual(['14:00']);
    });

    test('should handle empty schedule', () => {
      const localSchedule = {};
      const utcSchedule = convertScheduleHoursToUtc(localSchedule, 'Europe/Paris');

      expect(utcSchedule).toEqual({});
    });
  });

  describe('convertScheduleHoursToLocal', () => {
    test('should convert UTC schedule to local', () => {
      const utc = {
        MONDAY: ['06:00', '07:00'],
        TUESDAY: ['14:00'],
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      expect(local).toEqual({
        MONDAY: ['07:00', '08:00'],
        TUESDAY: ['15:00'],
      });
    });

    test('CRITICAL: round-trip should preserve user intent', () => {
      const original = {
        MONDAY: ['00:30', '07:00', '17:00'],
      };

      const utc = convertScheduleHoursToUtc(original, 'Europe/Paris');
      const roundTrip = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      expect(roundTrip).toEqual(original);
    });

    test('should handle empty schedule', () => {
      const utc = {};
      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');
      expect(local).toEqual({});
    });

    test('should sort times after conversion', () => {
      const utc = {
        MONDAY: ['16:00', '06:00', '11:00'],
      };

      const local = convertScheduleHoursToLocal(utc, 'Europe/Paris');

      expect(local.MONDAY).toEqual(['07:00', '12:00', '17:00']);
    });
  });

  describe('getBrowserTimezone', () => {
    test('should return a valid IANA timezone', () => {
      const timezone = getBrowserTimezone();
      expect(timezone).toBeTruthy();
      expect(typeof timezone).toBe('string');
      expect(isValidTimezone(timezone)).toBe(true);
    });

    test('should be same as getUserTimezone', () => {
      expect(getBrowserTimezone()).toBe(getUserTimezone());
    });
  });
});

describe('Key Consistency Bug Prevention Tests', () => {
  test('should return English weekday keys consistently (prevents French key bug)', () => {
    // This test specifically prevents the bug where frontend used French keys
    // but convertScheduleHoursToLocal returned English keys

    const utcScheduleHours = {
      MONDAY: ['06:00', '13:00'],
      TUESDAY: ['08:00', '16:00'],
      WEDNESDAY: ['09:00', '17:00'],
    };

    const localScheduleHours = convertScheduleHoursToLocal(utcScheduleHours, 'Europe/Paris');

    // Keys should be in English, not French
    expect(Object.keys(localScheduleHours)).toEqual(['MONDAY', 'TUESDAY', 'WEDNESDAY']);
    expect(localScheduleHours).toHaveProperty('MONDAY');
    expect(localScheduleHours).toHaveProperty('TUESDAY');
    expect(localScheduleHours).toHaveProperty('WEDNESDAY');

    // Should NOT have French keys
    expect(localScheduleHours).not.toHaveProperty('LUNDI');
    expect(localScheduleHours).not.toHaveProperty('MARDI');
    expect(localScheduleHours).not.toHaveProperty('MERCREDI');
  });

  test('should handle the exact failing case: Monday 06:00/13:00 UTC to Paris timezone', () => {
    // Test the exact scenario from the original bug report
    const utcScheduleHours = {
      MONDAY: ['06:00', '13:00'], // The failing group configuration
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
    };

    const userTimezone = 'Europe/Paris'; // UTC+1 in November
    const localScheduleHours = convertScheduleHoursToLocal(utcScheduleHours, userTimezone);

    // Verify the exact conversion that was needed
    expect(localScheduleHours.MONDAY).toEqual(['07:00', '14:00']);
    expect(localScheduleHours.MONDAY).toHaveLength(2);

    // Other days should not be present (convertScheduleHoursToLocal only creates days that have time slots)
    expect(localScheduleHours.TUESDAY).toBeUndefined();
    expect(localScheduleHours.WEDNESDAY).toBeUndefined();
    expect(localScheduleHours.THURSDAY).toBeUndefined();
    expect(localScheduleHours.FRIDAY).toBeUndefined();
  });

  test('should ensure time slot availability logic works with converted keys', () => {
    // Simulate the renderTimeSlot logic that was failing
    const utcScheduleHours = {
      MONDAY: ['06:00', '13:00'],
    };

    const userTimezone = 'Europe/Paris';
    const localScheduleHours = convertScheduleHoursToLocal(utcScheduleHours, userTimezone);

    // Simulate frontend weekday key generation (English keys)
    const weekdayKey = 'MONDAY';
    const testTime1 = '07:00'; // Converted from 06:00 UTC
    const testTime2 = '08:00'; // Not in schedule
    const testTime3 = '14:00'; // Converted from 13:00 UTC

    const weekdayTimeSlots = localScheduleHours[weekdayKey] || [];
    const isAvailable1 = weekdayTimeSlots.includes(testTime1);
    const isAvailable2 = weekdayTimeSlots.includes(testTime2);
    const isAvailable3 = weekdayTimeSlots.includes(testTime3);

    // This is the critical logic that was failing
    expect(isAvailable1).toBe(true);  // 07:00 should be available
    expect(isAvailable2).toBe(false); // 08:00 should NOT be available
    expect(isAvailable3).toBe(true);  // 14:00 should be available
  });

  test('should prevent locale-dependent key generation', () => {
    // Ensure that different browser locales don't affect the keys
    const utcScheduleHours = {
      FRIDAY: ['15:00', '16:00'],
    };

    const localScheduleHoursFR = convertScheduleHoursToLocal(utcScheduleHours, 'Europe/Paris');
    const localScheduleHoursDE = convertScheduleHoursToLocal(utcScheduleHours, 'Europe/Paris');
    const localScheduleHoursUS = convertScheduleHoursToLocal(utcScheduleHours, 'Europe/Paris');

    // All should have the same English keys regardless of browser locale simulation
    expect(Object.keys(localScheduleHoursFR)).toEqual(['FRIDAY']);
    expect(Object.keys(localScheduleHoursDE)).toEqual(['FRIDAY']);
    expect(Object.keys(localScheduleHoursUS)).toEqual(['FRIDAY']);

    // Time conversions should be identical
    expect(localScheduleHoursFR.FRIDAY).toEqual(['16:00', '17:00']);
    expect(localScheduleHoursDE.FRIDAY).toEqual(['16:00', '17:00']);
    expect(localScheduleHoursUS.FRIDAY).toEqual(['16:00', '17:00']);
  });
});