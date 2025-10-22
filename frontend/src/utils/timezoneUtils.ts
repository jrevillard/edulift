/**
 * Timezone utilities for schedule management
 * Handles conversion between UTC and local timezones for schedule slots
 */

import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, toDate } from 'date-fns-tz';

/**
 * Storage keys used across the application
 */
export const STORAGE_KEYS = {
  AUTO_SYNC_TIMEZONE: 'autoSyncTimezone'
} as const;

/**
 * Safely get item from localStorage
 * Handles cases where localStorage is unavailable (private browsing, disabled, quota exceeded)
 * @param key - Storage key to retrieve
 * @returns Value or null if unavailable
 */
export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[localStorage] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Safely set item in localStorage
 * Handles cases where localStorage is unavailable (private browsing, disabled, quota exceeded)
 * @param key - Storage key to set
 * @param value - Value to store
 * @returns true if successful, false otherwise
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[localStorage] Failed to set ${key}:`, error);
    return false;
  }
}

/**
 * Get the user's current IANA timezone (same as getBrowserTimezone)
 * @returns IANA timezone string (e.g., "Europe/Paris", "America/New_York")
 */
export function getUserTimezone(): string {
  return getBrowserTimezone();
}

/**
 * Get the browser's current IANA timezone
 * @returns IANA timezone string (e.g., "Europe/Paris", "America/New_York")
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Failed to detect browser timezone:', error);
    return 'UTC';
  }
}

/**
 * Convert UTC datetime to user's local timezone for display
 * @param utcDatetime - UTC datetime string or Date object
 * @param timezone - Optional IANA timezone (defaults to user's timezone)
 * @returns Date object in local timezone
 */
export function convertUtcToLocal(
  utcDatetime: string | Date,
  timezone?: string
): Date {
  const tz = timezone || getUserTimezone();
  const date = typeof utcDatetime === 'string' ? parseISO(utcDatetime) : utcDatetime;

  // Use formatInTimeZone and parse back to get proper Date in timezone
  const localDateStr = formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
  return new Date(localDateStr);
}

/**
 * Get weekday name in user's timezone
 * @param utcDatetime - UTC datetime
 * @param timezone - Optional IANA timezone
 * @returns Weekday name (e.g., "Monday", "Tuesday")
 */
export function getWeekdayInTimezone(
  utcDatetime: string | Date,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const date = typeof utcDatetime === 'string' ? parseISO(utcDatetime) : utcDatetime;
  // Return capitalized weekday (e.g., "Monday" not "MONDAY")
  return formatInTimeZone(date, tz, 'EEEE');
}

/**
 * Get time in HH:mm format in user's timezone
 * @param utcDatetime - UTC datetime
 * @param timezone - Optional IANA timezone
 * @returns Time string (e.g., "07:30", "14:15")
 */
export function getTimeInTimezone(
  utcDatetime: string | Date,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const date = typeof utcDatetime === 'string' ? parseISO(utcDatetime) : utcDatetime;
  return formatInTimeZone(date, tz, 'HH:mm');
}

/**
 * Format datetime in user's timezone
 * @param utcDatetime - UTC datetime
 * @param formatStr - Format string (e.g., 'yyyy-MM-dd HH:mm')
 * @param timezone - Optional IANA timezone
 * @returns Formatted datetime string
 */
export function formatDatetimeInTimezone(
  utcDatetime: string | Date,
  formatStr: string,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const date = typeof utcDatetime === 'string' ? parseISO(utcDatetime) : utcDatetime;
  return formatInTimeZone(date, tz, formatStr);
}

/**
 * Validate if a timezone string is valid IANA timezone
 * @param timezone - IANA timezone string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset display (e.g., "+2" for UTC+2, "-5" for UTC-5)
 * @param timezone - IANA timezone string (e.g., "Europe/Paris")
 * @returns Offset string (e.g., "+2", "-5")
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    // Create a date in UTC
    const now = new Date();

    // Format the date in the target timezone
    const tzString = now.toLocaleString('en-US', { timeZone: timezone });
    const tzDate = new Date(tzString);

    // Calculate offset in hours
    const offsetMs = tzDate.getTime() - now.getTime();
    const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));

    const sign = offsetHours >= 0 ? '+' : '';
    return `${sign}${offsetHours}`;
  } catch {
    return '+0';
  }
}

/**
 * Format time with timezone offset indicator (e.g., "14:30 (UTC+2)")
 * @param utcDatetime - UTC datetime
 * @param timezone - Optional IANA timezone
 * @returns Formatted time with offset
 */
export function formatTimeWithOffset(
  utcDatetime: string | Date,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const time = getTimeInTimezone(utcDatetime, tz);
  const offset = getTimezoneOffset(tz);
  return `${time} (UTC${offset})`;
}

/**
 * Common timezones list for timezone selector
 */
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST/CDT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
  { value: 'Africa/Cairo', label: 'Cairo (EET)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
] as const;

/**
 * Create a UTC datetime from local date, time, and timezone
 * Used when creating schedule slots from user input
 *
 * @param localDate - Date object or ISO date string (YYYY-MM-DD)
 * @param localTime - Time string (HH:mm)
 * @param timezone - Optional IANA timezone (defaults to user's timezone)
 * @returns UTC datetime as ISO string
 */
export function createUtcDatetime(
  localDate: Date | string,
  localTime: string,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();

  // Parse the date
  let dateStr: string;
  if (typeof localDate === 'string') {
    dateStr = localDate;
  } else {
    dateStr = format(localDate, 'yyyy-MM-dd');
  }

  // Combine date and time
  const [hours, minutes] = localTime.split(':').map(Number);
  const localDatetimeStr = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Parse in the specified timezone and convert to UTC
  // This correctly handles DST transitions
  const utcDate = new Date(localDatetimeStr + ' GMT' + formatInTimeZone(new Date(), tz, 'xxx'));

  return utcDate.toISOString();
}

/**
 * Convert local time string to UTC time string
 * IMPORTANT: Used for scheduleHours conversion - backend expects UTC times in HH:MM format
 *
 * @param localTime - Time in HH:MM format in user's local timezone (e.g., "07:30")
 * @param userTimezone - User's IANA timezone (e.g., "Europe/Paris")
 * @returns UTC time in HH:MM format (e.g., "05:30")
 *
 * @example
 * // Paris timezone (UTC+2 in summer)
 * convertLocalToUtcTimeString("07:30", "Europe/Paris") // Returns "05:30"
 *
 * // Handles day boundary crossing - returns time only, day handled separately
 * convertLocalToUtcTimeString("00:30", "Europe/Paris") // Returns "22:30" (previous day in UTC)
 */
export function convertLocalToUtcTimeString(localTime: string, userTimezone: string): string {
  // Use a reference date (Monday in a typical week) to handle timezone conversions
  // Create an ISO datetime string with the local time
  const dateTimeStr = `2025-01-06T${localTime}:00`;

  // Parse this string AS IF it's in the user's timezone (environment-independent!)
  // toDate with timeZone option interprets the string in the specified timezone
  const utcDate = toDate(dateTimeStr, { timeZone: userTimezone });

  // Extract and return the time in UTC
  return formatInTimeZone(utcDate, 'UTC', 'HH:mm');
}

/**
 * Convert UTC time string to local time string
 * IMPORTANT: Used for scheduleHours display - backend sends UTC times in HH:MM format
 *
 * @param utcTime - Time in HH:MM format in UTC (e.g., "05:30")
 * @param userTimezone - User's IANA timezone (e.g., "Europe/Paris")
 * @returns Local time in HH:MM format (e.g., "07:30")
 *
 * @example
 * // Paris timezone (UTC+2 in summer)
 * convertUtcToLocalTimeString("05:30", "Europe/Paris") // Returns "07:30"
 *
 * // Handles day boundary crossing - returns time only, day handled separately
 * convertUtcToLocalTimeString("22:30", "Europe/Paris") // Returns "00:30" (next day in Paris)
 */
export function convertUtcToLocalTimeString(utcTime: string, userTimezone: string): string {
  // Use a reference date (Monday in a typical week)
  const referenceDate = new Date('2025-01-06T00:00:00Z'); // A Monday in UTC
  const [hours, minutes] = utcTime.split(':').map(Number);

  // Create a UTC date with the specified time
  const utcDate = new Date(referenceDate);
  utcDate.setUTCHours(hours, minutes, 0, 0);

  // Convert to user's timezone
  // toZonedTime converts a UTC date to the equivalent in the target timezone
  const localDate = toZonedTime(utcDate, userTimezone);

  // Return the time in the local timezone
  return format(localDate, 'HH:mm');
}

/**
 * Convert entire scheduleHours object from local to UTC
 * IMPORTANT: Handles day boundary crossing! A time slot can move to a different weekday.
 *
 * @param localScheduleHours - scheduleHours with local times
 * @param userTimezone - User's IANA timezone
 * @returns scheduleHours with UTC times (may have different weekdays due to boundary crossing!)
 *
 * @example
 * // Paris timezone (UTC+2 in summer)
 * // Monday 00:30 in Paris → Sunday 22:30 in UTC (crosses day boundary!)
 * convertScheduleHoursToUtc(
 *   { MONDAY: ["00:30", "07:00"] },
 *   "Europe/Paris"
 * )
 * // Returns: { SUNDAY: ["22:30"], MONDAY: ["05:00"] }
 */
export function convertScheduleHoursToUtc(
  localScheduleHours: Record<string, string[]>,
  userTimezone: string
): Record<string, string[]> {
  const utcScheduleHours: Record<string, string[]> = {};

  const weekdayMap: Record<string, number> = {
    'MONDAY': 0,
    'TUESDAY': 1,
    'WEDNESDAY': 2,
    'THURSDAY': 3,
    'FRIDAY': 4,
    'SATURDAY': 5,
    'SUNDAY': 6
  };

  const weekdayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  // Process each weekday and its time slots
  Object.entries(localScheduleHours).forEach(([weekday, timeSlots]) => {
    const dayOffset = weekdayMap[weekday.toUpperCase()];

    timeSlots.forEach(timeSlot => {
      // Create an ISO datetime string for this specific day and time
      const dayDate = new Date('2025-01-06'); // Monday
      dayDate.setDate(dayDate.getDate() + dayOffset);
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dateTimeStr = `${dateStr}T${timeSlot}:00`;

      // Parse this string AS IF it's in the user's timezone (environment-independent!)
      const utcDate = toDate(dateTimeStr, { timeZone: userTimezone });

      // Get the weekday in UTC (might be different due to timezone shift!)
      const utcDayOfWeek = utcDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const utcWeekdayIndex = utcDayOfWeek === 0 ? 6 : utcDayOfWeek - 1; // Convert to 0 = Monday
      const utcWeekday = weekdayNames[utcWeekdayIndex];

      // Get the time in UTC
      const utcTime = formatInTimeZone(utcDate, 'UTC', 'HH:mm');

      // Add to the appropriate weekday bucket in UTC
      if (!utcScheduleHours[utcWeekday]) {
        utcScheduleHours[utcWeekday] = [];
      }
      utcScheduleHours[utcWeekday].push(utcTime);
    });
  });

  // Sort time slots for each weekday
  Object.keys(utcScheduleHours).forEach(weekday => {
    utcScheduleHours[weekday].sort();
  });

  return utcScheduleHours;
}

/**
 * Convert entire scheduleHours object from UTC to local
 * IMPORTANT: Handles day boundary crossing! A time slot can move to a different weekday.
 *
 * @param utcScheduleHours - scheduleHours with UTC times
 * @param userTimezone - User's IANA timezone
 * @returns scheduleHours with local times (may have different weekdays!)
 *
 * @example
 * // Paris timezone (UTC+2 in summer)
 * // Sunday 22:30 UTC → Monday 00:30 in Paris (crosses day boundary!)
 * convertScheduleHoursToLocal(
 *   { SUNDAY: ["22:30"], MONDAY: ["05:00"] },
 *   "Europe/Paris"
 * )
 * // Returns: { MONDAY: ["00:30", "07:00"] }
 */
export function convertScheduleHoursToLocal(
  utcScheduleHours: Record<string, string[]>,
  userTimezone: string
): Record<string, string[]> {
  const localScheduleHours: Record<string, string[]> = {};

  // Use a reference week to properly calculate day boundaries
  // Start with a Monday (2025-01-06 is a Monday)
  const referenceMonday = new Date('2025-01-06T00:00:00Z');

  const weekdayMap: Record<string, number> = {
    'MONDAY': 0,
    'TUESDAY': 1,
    'WEDNESDAY': 2,
    'THURSDAY': 3,
    'FRIDAY': 4,
    'SATURDAY': 5,
    'SUNDAY': 6
  };

  const weekdayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  // Process each weekday and its time slots
  Object.entries(utcScheduleHours).forEach(([weekday, timeSlots]) => {
    const dayOffset = weekdayMap[weekday.toUpperCase()];

    timeSlots.forEach(timeSlot => {
      const [hours, minutes] = timeSlot.split(':').map(Number);

      // Create UTC date for this specific day and time
      const utcDate = new Date(referenceMonday);
      utcDate.setUTCDate(referenceMonday.getUTCDate() + dayOffset);
      utcDate.setUTCHours(hours, minutes, 0, 0);

      // Convert to user's timezone using toZonedTime
      const localDate = toZonedTime(utcDate, userTimezone);

      // Get the weekday in user's timezone (might be different!)
      const localDayOfWeek = localDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const localWeekdayIndex = localDayOfWeek === 0 ? 6 : localDayOfWeek - 1; // Convert to 0 = Monday
      const localWeekday = weekdayNames[localWeekdayIndex];

      // Get the time in user's timezone
      const localTime = format(localDate, 'HH:mm');

      // Add to the appropriate weekday bucket in local timezone
      if (!localScheduleHours[localWeekday]) {
        localScheduleHours[localWeekday] = [];
      }
      localScheduleHours[localWeekday].push(localTime);
    });
  });

  // Sort time slots for each weekday
  Object.keys(localScheduleHours).forEach(weekday => {
    localScheduleHours[weekday].sort();
  });

  return localScheduleHours;
}

/**
 * Get UTC weekday from local datetime
 *
 * @param localDate - Date in user's timezone
 * @param userTimezone - User's IANA timezone
 * @returns UTC weekday (MONDAY, TUESDAY, etc.)
 */
export function getUtcWeekday(localDate: Date, userTimezone: string): string {
  const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  // Format the date in the user's timezone to get ISO string
  const localDateStr = formatInTimeZone(localDate, userTimezone, "yyyy-MM-dd'T'HH:mm:ss");

  // Parse as UTC to get the UTC representation
  const utcDate = parseISO(localDateStr + 'Z');

  // Get UTC weekday
  const utcDayOfWeek = utcDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

  return weekdayNames[utcDayOfWeek];
}

/**
 * Get local weekday from UTC datetime
 *
 * @param utcDate - Date in UTC
 * @param userTimezone - User's IANA timezone
 * @returns Local weekday (MONDAY, TUESDAY, etc.)
 */
export function getLocalWeekday(utcDate: Date, userTimezone: string): string {
  const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  // Convert UTC date to user's timezone
  const localDatetimeStr = formatInTimeZone(utcDate, userTimezone, "yyyy-MM-dd'T'HH:mm:ss");
  const localDate = parseISO(localDatetimeStr);

  // Get local weekday
  const localDayOfWeek = localDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  return weekdayNames[localDayOfWeek];
}
