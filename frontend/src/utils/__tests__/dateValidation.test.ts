import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  isDateInPast, 
  getDateValidationMessage,
  formatDateForComparison 
} from '../dateValidation';

// Mock current date for consistent testing
const mockToday = new Date('2024-01-15T10:00:00Z');

describe('Date Validation Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isDateInPast', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date('2024-01-14T10:00:00Z');
      expect(isDateInPast(yesterday)).toBe(true);
    });

    it('should return false for today at same time', () => {
      const today = new Date('2024-01-15T10:00:00Z');
      expect(isDateInPast(today)).toBe(false);
    });

    it('should return false for today at future time', () => {
      const todayFuture = new Date('2024-01-15T15:00:00Z');
      expect(isDateInPast(todayFuture)).toBe(false);
    });

    it('should return true for today at past time', () => {
      const todayPast = new Date('2024-01-15T05:00:00Z');
      expect(isDateInPast(todayPast)).toBe(true);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date('2024-01-16T10:00:00Z');
      expect(isDateInPast(tomorrow)).toBe(false);
    });

    it('should handle date strings using time comparison', () => {
      // At 10:00 AM, earlier times today should be in the past
      expect(isDateInPast('2024-01-14T23:59:59Z')).toBe(true);
      expect(isDateInPast('2024-01-15T09:00:00Z')).toBe(true); // 9 AM is before 10 AM
      expect(isDateInPast('2024-01-15T11:00:00Z')).toBe(false); // 11 AM is after 10 AM
      expect(isDateInPast('2024-01-16T00:00:00Z')).toBe(false);
    });

    it('should handle datetime strings from schedule slots', () => {
      // Current mock time is 2024-01-15T10:00:00Z (Monday)
      
      // Same day, future time - should be allowed
      const futureSlotToday = '2024-01-15T15:00:00Z'; // 3 PM, future time
      expect(isDateInPast(futureSlotToday)).toBe(false);

      // Same day, past time - should be blocked  
      const pastSlotToday = '2024-01-15T08:00:00Z'; // 8 AM, past time
      expect(isDateInPast(pastSlotToday)).toBe(true);

      // Future day - should be allowed
      const futureSlot = '2024-01-16T08:00:00Z'; // Tomorrow
      expect(isDateInPast(futureSlot)).toBe(false);

      // Past day - should be blocked
      const pastSlot = '2024-01-14T15:00:00Z'; // Yesterday
      expect(isDateInPast(pastSlot)).toBe(true);
    });
  });


  describe('getDateValidationMessage', () => {
    it('should return appropriate message for past dates', () => {
      const yesterday = new Date('2024-01-14T10:00:00Z');
      const message = getDateValidationMessage(yesterday);
      
      expect(message).toContain('past');
      expect(message.toLowerCase()).toContain('cannot');
    });

    it('should return null for valid dates', () => {
      const tomorrow = new Date('2024-01-16T10:00:00Z');
      const message = getDateValidationMessage(tomorrow);
      
      expect(message).toBeNull();
    });

    it('should provide consistent message for past dates', () => {
      const yesterday = new Date('2024-01-14T10:00:00Z');
      
      const message = getDateValidationMessage(yesterday);
      
      expect(message).toContain('Cannot schedule trips in the past');
    });
  });

  describe('formatDateForComparison', () => {
    it('should format dates consistently', () => {
      const date1 = new Date('2024-01-15T10:30:00Z');
      const date2 = new Date('2024-01-15T22:45:00Z');
      
      expect(formatDateForComparison(date1)).toBe('2024-01-15');
      expect(formatDateForComparison(date2)).toBe('2024-01-15');
      expect(formatDateForComparison(date1)).toBe(formatDateForComparison(date2));
    });

    it('should handle string inputs', () => {
      expect(formatDateForComparison('2024-01-15')).toBe('2024-01-15');
      expect(formatDateForComparison('2024-01-15T10:30:00Z')).toBe('2024-01-15');
    });

    it('should handle different date formats', () => {
      const isoDate = '2024-01-15T10:30:00Z';
      const shortDate = '2024-01-15';
      const dateObject = new Date('2024-01-15T10:30:00Z');
      
      expect(formatDateForComparison(isoDate)).toBe('2024-01-15');
      expect(formatDateForComparison(shortDate)).toBe('2024-01-15');
      expect(formatDateForComparison(dateObject)).toBe('2024-01-15');
    });
  });
});