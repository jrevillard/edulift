import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { isDateInPast, validateScheduleSlotCreation, validateScheduleSlotModification } from '../dateValidation';

describe('Date Validation - Past Date TDD Tests', () => {
  let originalDate: DateConstructor;

  beforeEach(() => {
    // Mock current date to June 24, 2025 (as mentioned by user)
    originalDate = global.Date;
    const mockCurrentDate = new Date('2025-06-24T10:00:00.000Z'); // June 24, 2025 10:00 AM UTC
    
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockCurrentDate);
        } else {
          super(...(args as [string | number | Date]));
        }
      }
      
      static now() {
        return mockCurrentDate.getTime();
      }
    } as any;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('TDD: Past Date Validation Issue', () => {
    it('❌ RED: should correctly identify that June 23, 2025 05:00 UTC is in the past when current date is June 24, 2025', () => {
      // This is the exact datetime from user's error log
      const pastDatetime = '2025-06-23T05:00:00.000Z';
      
      // ❌ RED: This should return true (is in the past)
      const result = isDateInPast(pastDatetime);
      expect(result).toBe(true);
    });

    it('❌ RED: should throw error when trying to create schedule slot for past date', () => {
      // This is the exact datetime that caused the 500 error
      const pastDatetime = '2025-06-23T05:00:00.000Z'; // June 23, 2025 (yesterday)
      
      // ❌ RED: Should throw "Cannot create trips in the past" error
      expect(() => {
        validateScheduleSlotCreation(pastDatetime);
      }).toThrow('Cannot create trips in the past');
    });

    it('❌ RED: should throw error when trying to modify schedule slot for past date', () => {
      // This is what happens when user tries to assign vehicle to past slot
      const pastDatetime = '2025-06-23T05:00:00.000Z';
      
      // ❌ RED: Should throw "Cannot modify trips in the past" error (matches user's error)
      expect(() => {
        validateScheduleSlotModification(pastDatetime);
      }).toThrow('Cannot modify trips in the past');
    });

    it('✅ GREEN: should allow creating schedule slots for future dates', () => {
      // Future date should be allowed
      const futureDatetime = '2025-06-25T08:00:00.000Z'; // June 25, 2025 (tomorrow)
      
      // ✅ GREEN: Should not throw any error
      expect(() => {
        validateScheduleSlotCreation(futureDatetime);
      }).not.toThrow();
    });

    it('✅ GREEN: should allow creating schedule slots for current day but future time', () => {
      // Same day but future time should be allowed  
      const currentDayFutureTime = '2025-06-24T15:00:00.000Z'; // June 24, 2025 15:00 (5 hours from now)
      
      // ✅ GREEN: Should not throw any error
      expect(() => {
        validateScheduleSlotCreation(currentDayFutureTime);
      }).not.toThrow();
    });

    it('❌ RED: should identify the root cause - frontend generates past datetimes', () => {
      // This test demonstrates the likely frontend issue
      // If user is viewing "current week" but week calculation is off by one,
      // it might generate past dates
      
      // const currentWeek = '2025-26'; // Week 26 of 2025 - commented out to fix unused variable
      const mondayDatetime = '2025-06-23T05:00:00.000Z'; // This is what was generated
      
      // ❌ RED: This demonstrates the problem - the generated date is in the past
      expect(isDateInPast(mondayDatetime)).toBe(true);
      
      // ✅ GREEN: The correct Monday for week 26 should be June 30, 2025
      const correctMondayDatetime = '2025-06-30T05:00:00.000Z'; // June 30, 2025
      expect(isDateInPast(correctMondayDatetime)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle timezone differences correctly', () => {
      // The user's datetime has no timezone suffix, but represents UTC
      const utcDatetime = '2025-06-23T05:00:00.000Z';
      const noZuluDatetime = '2025-06-23T05:00:00.000'; // Missing Z
      
      expect(isDateInPast(utcDatetime)).toBe(true);
      // This might be parsed differently depending on system timezone
      expect(() => isDateInPast(noZuluDatetime)).not.toThrow();
    });

    it('should handle time precision correctly', () => {
      // Very close to current time
      const justPast = '2025-06-24T09:59:59.999Z'; // 1ms before current time
      const justFuture = '2025-06-24T10:00:00.001Z'; // 1ms after current time
      
      expect(isDateInPast(justPast)).toBe(true);
      expect(isDateInPast(justFuture)).toBe(false);
    });
  });
});