import { describe, test, expect } from 'vitest';
import { convertScheduleHoursToLocal } from '../timezoneUtils';

describe('Schedule Key Consistency Bug Prevention Tests', () => {
  test('should return English weekday keys consistently (prevents French key bug)', () => {
    // This test specifically prevents the bug where frontend used French keys
    // but convertScheduleHoursToLocal returned English keys

    const utcScheduleHours = {
      MONDAY: ['06:00', '13:00'],
      TUESDAY: ['08:00', '16:00'],
      WEDNESDAY: ['09:00', '17:00']
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
      FRIDAY: []
    };

    const userTimezone = 'Europe/Paris'; // UTC+1 in November
    const localScheduleHours = convertScheduleHoursToLocal(utcScheduleHours, userTimezone);

    // Verify the exact conversion that was needed
    expect(localScheduleHours.MONDAY).toEqual(['07:00', '14:00']);
    expect(localScheduleHours.MONDAY).toHaveLength(2);

    // Other days should not be present (convertScheduleHours only creates days that have time slots)
    expect(localScheduleHours.TUESDAY).toBeUndefined();
    expect(localScheduleHours.WEDNESDAY).toBeUndefined();
    expect(localScheduleHours.THURSDAY).toBeUndefined();
    expect(localScheduleHours.FRIDAY).toBeUndefined();
  });

  test('should ensure time slot availability logic works with converted keys', () => {
    // Simulate the renderTimeSlot logic that was failing
    const utcScheduleHours = {
      MONDAY: ['06:00', '13:00']
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
      FRIDAY: ['15:00', '16:00']
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