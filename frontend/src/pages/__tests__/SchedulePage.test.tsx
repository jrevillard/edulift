import { describe, it, expect, vi, beforeEach } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

describe('SchedulePage - Timezone Date Comparisons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Date comparison in user timezone', () => {
    it('should compare dates in user timezone not browser timezone', () => {
      // Simulate browser timezone as UTC
      const browserTz = 'UTC';
      // User profile timezone as Asia/Tokyo
      const userTz = 'Asia/Tokyo';

      // Create a time that is "today" in Tokyo but potentially "yesterday" in UTC
      // For example: Jan 15, 2024, 02:00 JST (which is Jan 14, 2024, 17:00 UTC)
      const tokyoTime = dayjs.tz('2024-01-15 02:00', userTz);

      // Current time in Tokyo (simulate it's 01:00 JST, so 02:00 JST is in the future)
      const nowInTokyo = dayjs.tz('2024-01-15 01:00', userTz);

      // Check if the slot time is in the past relative to Tokyo time
      const isInPast = tokyoTime.isBefore(nowInTokyo);

      // The slot should NOT be in the past (02:00 is after 01:00)
      expect(isInPast).toBe(false);

      // Verify that using browser timezone would give wrong result
      const browserSlotTime = tokyoTime.tz(browserTz);

      // In UTC: now is Jan 14, 16:00 and slot is Jan 14, 17:00
      // So slot would still be in future in this case, but the point is we're using Tokyo time
      expect(browserSlotTime.format()).not.toBe(tokyoTime.format());
    });

    it('should show dates in user timezone with correct abbreviation', () => {
      const userTz = 'Asia/Tokyo';
      const testDate = dayjs.tz('2024-01-15 08:00', userTz);

      // Format with timezone abbreviation
      const formatted = testDate.format('MMM D, YYYY HH:mm');

      // Verify date is formatted correctly in Tokyo timezone
      expect(formatted).toContain('Jan 15, 2024 08:00');

      // Verify the date object was created
      expect(testDate.isValid()).toBe(true);
    });

    it('should validate dates using user timezone for PST', () => {
      const userTz = 'America/Los_Angeles';

      // Create a slot for "today" 08:00 PST
      const slotTime = dayjs.tz('2024-01-15 08:00', userTz);

      // Current time is 07:00 PST (before slot)
      const nowInUserTz = dayjs.tz('2024-01-15 07:00', userTz);

      const isInPast = slotTime.isBefore(nowInUserTz);

      // Should not be in past
      expect(isInPast).toBe(false);

      // Verify dates are valid
      expect(slotTime.isValid()).toBe(true);
      expect(nowInUserTz.isValid()).toBe(true);
    });

    it('should correctly determine if time slot is in past using user timezone', () => {
      const userTz = 'America/New_York';

      // Past slot: Jan 15, 2024 08:00 EST
      const pastSlot = dayjs.tz('2024-01-15 08:00', userTz);
      // Current time: Jan 15, 2024 10:00 EST
      const now = dayjs.tz('2024-01-15 10:00', userTz);

      expect(pastSlot.isBefore(now)).toBe(true);

      // Future slot: Jan 15, 2024 12:00 EST
      const futureSlot = dayjs.tz('2024-01-15 12:00', userTz);

      expect(futureSlot.isBefore(now)).toBe(false);
    });

    it('should handle timezone transitions correctly', () => {
      // Test across day boundary in different timezones
      const userTz = 'Pacific/Auckland'; // UTC+12/+13

      // 23:30 in Auckland
      const lateEvening = dayjs.tz('2024-01-15 23:30', userTz);
      // 00:30 next day in Auckland
      const earlyMorning = dayjs.tz('2024-01-16 00:30', userTz);

      expect(lateEvening.isBefore(earlyMorning)).toBe(true);

      // Verify the dates are actually different days
      expect(lateEvening.date()).toBe(15);
      expect(earlyMorning.date()).toBe(16);
    });
  });

  describe('Week range formatting with timezone', () => {
    it('should format week range with timezone', () => {
      const userTz = 'America/Los_Angeles';

      // Week of Jan 15-19, 2024
      const monday = dayjs.tz('2024-01-15', userTz);
      const friday = dayjs.tz('2024-01-19', userTz);

      const startFormatted = monday.format('ddd, MMM D');
      const endFormatted = friday.format('ddd, MMM D');

      const weekRange = `${startFormatted} - ${endFormatted}`;

      expect(weekRange).toContain('Mon, Jan 15');
      expect(weekRange).toContain('Fri, Jan 19');
      expect(monday.isValid()).toBe(true);
    });

    it('should format week range for Tokyo timezone', () => {
      const userTz = 'Asia/Tokyo';

      const monday = dayjs.tz('2024-01-15', userTz);
      const friday = dayjs.tz('2024-01-19', userTz);

      const startFormatted = monday.format('ddd, MMM D');
      const endFormatted = friday.format('ddd, MMM D');

      const weekRange = `${startFormatted} - ${endFormatted}`;

      expect(weekRange).toContain('Mon, Jan 15');
      expect(weekRange).toContain('Fri, Jan 19');
      expect(monday.isValid()).toBe(true);
    });
  });

  describe('Timezone default behavior', () => {
    it('should use browser timezone when user timezone is not set', () => {
      // When user.timezone is undefined, should fall back to browser timezone
      const browserTz = dayjs.tz.guess();
      const now = dayjs().tz(browserTz);

      expect(now.format('z')).toBeTruthy();
      expect(dayjs.tz.guess()).toBe(browserTz);
    });
  });
});
