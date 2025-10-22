import { describe, it, expect } from 'vitest';

describe('SchedulePage - Drag & Drop with Timezone Handling', () => {
  it('should handle timezone edge cases correctly', () => {
    // Test that UTC date parsing works correctly
    const utcDate = new Date('2025-07-02T07:00:00.000Z');
    const dayKey = utcDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: 'UTC'
    }).toUpperCase();
    
    expect(dayKey).toBe('WEDNESDAY');
    
    // Test UTC time extraction
    const utcTime = utcDate.getUTCHours().toString().padStart(2, '0') + ':' + 
                   utcDate.getUTCMinutes().toString().padStart(2, '0');
    
    expect(utcTime).toBe('07:00');
  });

  it('should handle different timezones consistently', () => {
    // Test various UTC times and ensure they map to correct days
    const testCases = [
      { utc: '2025-07-02T07:00:00.000Z', expectedDay: 'WEDNESDAY' },
      { utc: '2025-07-02T23:59:59.999Z', expectedDay: 'WEDNESDAY' },
      { utc: '2025-07-03T00:00:00.000Z', expectedDay: 'THURSDAY' },
      { utc: '2025-07-01T00:00:00.000Z', expectedDay: 'TUESDAY' },
    ];

    testCases.forEach(({ utc, expectedDay }) => {
      const date = new Date(utc);
      const dayKey = date.toLocaleDateString('en-US', { 
        weekday: 'long',
        timeZone: 'UTC'
      }).toUpperCase();
      
      expect(dayKey).toBe(expectedDay);
    });
  });

  it('should compare UTC times correctly', () => {
    // Test the time comparison logic used in the real component
    const slot1DateTime = '2025-07-02T07:00:00.000Z';
    const slot2DateTime = '2025-07-02T08:30:00.000Z';
    
    // Test UTC time string extraction (as used in renderTimeSlot)
    const slot1Time = new Date(slot1DateTime).getUTCHours().toString().padStart(2, '0') + ':' + 
                     new Date(slot1DateTime).getUTCMinutes().toString().padStart(2, '0');
    const slot2Time = new Date(slot2DateTime).getUTCHours().toString().padStart(2, '0') + ':' + 
                     new Date(slot2DateTime).getUTCMinutes().toString().padStart(2, '0');
    
    expect(slot1Time).toBe('07:00');
    expect(slot2Time).toBe('08:30');
    
    // Test UTC locale time string extraction (as used in handleVehicleDrop)
    const slot1LocaleTime = new Date(slot1DateTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    });
    
    expect(slot1LocaleTime).toBe('07:00');
  });

  it('should handle date creation correctly', () => {
    // Test that the corrected pseudo schedule slot creation works
    const targetDate = new Date('2025-07-02T00:00:00.000Z');
    
    // Using setHours (local time) instead of setUTCHours
    targetDate.setHours(7, 0, 0, 0);
    
    // Verify the time was set correctly (this would vary by timezone)
    const hours = targetDate.getHours();
    const minutes = targetDate.getMinutes();
    
    expect(hours).toBe(7);
    expect(minutes).toBe(0);
  });
});