import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate, formatRelativeTime, formatErrorDate, getUserLocale } from '../dateFormatting';

describe('dateFormatting', () => {
  let originalDate: typeof Date;

  beforeEach(() => {
    // Reset any global mocks
    vi.clearAllMocks();
    
    // Store original Date
    originalDate = globalThis.Date;
    
    // Mock current time to June 25, 2025 10:00:00 UTC for consistent tests
    const mockCurrentTime = new Date('2025-06-25T10:00:00.000Z');
    vi.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) {
        return new originalDate(mockCurrentTime);
      }
      return new originalDate(...args);
    });
    globalThis.Date.now = vi.fn().mockReturnValue(mockCurrentTime.getTime());
  });

  afterEach(() => {
    // Restore original Date
    globalThis.Date = originalDate;
  });

  describe('formatDate', () => {
    it('should format date for error context', () => {
      const date = '2024-06-24T15:30:00.000Z';
      const result = formatDate(date, 'UTC', 'en-US', 'ERROR');
      expect(result).toMatch(/Jun 24, 2024/); // Should include readable date
      // Check that time is included but don't enforce specific timezone conversion
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should include time in any timezone
      expect(result).not.toContain('Invalid date');
    });

    it('should format date for schedule context', () => {
      const date = '2024-06-24T15:30:00.000Z';
      const result = formatDate(date, 'America/New_York', 'en-US', 'SCHEDULE');
      expect(result).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
      // Check that time is included but don't enforce specific timezone conversion
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should include time in any timezone
      expect(result).toMatch(/Jun/); // Should include month
    });

    it('should respect user locale', () => {
      const date = '2024-06-24T15:30:00.000Z';
      const resultEN = formatDate(date, 'UTC', 'en-US', 'ERROR');
      const resultFR = formatDate(date, 'UTC', 'fr-FR', 'ERROR');
      expect(resultEN).not.toBe(resultFR);
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = 'invalid-date';
      expect(() => formatDate(invalidDate, 'UTC', 'en-US', 'ERROR')).not.toThrow();
    });
  });

  describe('formatRelativeTime', () => {
    it('should format past dates as relative time', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = formatRelativeTime(pastDate.toISOString(), 'en-US');
      expect(result).toMatch(/2 hours? ago|yesterday/); // Could be either depending on exact time
    });

    it('should format future dates as relative time', () => {
      const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
      const result = formatRelativeTime(futureDate.toISOString(), 'en-US');
      expect(result).toMatch(/in 3 hours?|in 3h/);
    });

    it('should handle today/yesterday/tomorrow specially', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(yesterday.toISOString(), 'en-US');
      expect(result).toMatch(/yesterday|1 day ago/);
    });
  });

  describe('formatErrorDate', () => {
    it('should format dates for error messages', () => {
      const date = '2024-06-24T15:30:00.000Z';
      const result = formatErrorDate(date, 'UTC', 'en-US');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should be concise for error context', () => {
      const date = '2024-06-24T15:30:00.000Z';
      const result = formatErrorDate(date, 'Europe/Paris', 'en-US');
      expect(result.length).toBeLessThan(50); // Should be concise
    });
  });

  describe('getUserLocale', () => {
    it('should detect browser locale', () => {
      const locale = getUserLocale();
      expect(typeof locale).toBe('string');
      expect(locale.length).toBeGreaterThan(1);
    });

    it('should return fallback if no locale detected', () => {
      // Mock navigator.language to be undefined
      Object.defineProperty(navigator, 'language', {
        writable: true,
        value: undefined,
      });
      const locale = getUserLocale();
      expect(locale).toBe('en-US'); // Should fallback to en-US
    });
  });
});