import { DateTime } from 'luxon';

/**
 * Convert UTC datetime to user's local timezone
 * @param utcDatetime - Date object or ISO string in UTC
 * @param timezone - IANA timezone string (e.g., "Europe/Paris")
 * @returns DateTime in user's local timezone
 */
export const convertUtcToTimezone = (
  utcDatetime: Date | string,
  timezone: string,
): DateTime => {
  const dt = typeof utcDatetime === 'string'
    ? DateTime.fromISO(utcDatetime, { zone: 'utc' })
    : DateTime.fromJSDate(utcDatetime, { zone: 'utc' });

  return dt.setZone(timezone);
};

/**
 * Extract weekday from UTC datetime in user's timezone
 * @param utcDatetime - UTC datetime
 * @param timezone - User's IANA timezone
 * @returns Weekday name in uppercase (e.g., "MONDAY")
 */
export const getWeekdayInTimezone = (
  utcDatetime: Date | string,
  timezone: string,
): string => {
  const localDt = convertUtcToTimezone(utcDatetime, timezone);
  return localDt.toFormat('EEEE').toUpperCase(); // "MONDAY", "TUESDAY", etc.
};

/**
 * Extract time (HH:mm) from UTC datetime in user's timezone
 * @param utcDatetime - UTC datetime
 * @param timezone - User's IANA timezone
 * @returns Time string in HH:mm format (e.g., "07:30")
 */
export const getTimeInTimezone = (
  utcDatetime: Date | string,
  timezone: string,
): string => {
  const localDt = convertUtcToTimezone(utcDatetime, timezone);
  return localDt.toFormat('HH:mm'); // "07:30", "15:00", etc.
};

/**
 * Validate if a timezone string is valid IANA timezone
 * @param timezone - IANA timezone string (e.g., "Europe/Paris", not "CET")
 * @returns true if valid IANA timezone, false otherwise
 */
export const isValidTimezone = (timezone: string): boolean => {
  if (!timezone || timezone.trim() === '') {
    return false;
  }

  try {
    const dt = DateTime.local().setZone(timezone);
    // Invalid timezones return null for zoneName
    // We also enforce IANA format (Region/City) except for UTC
    if (!dt.zoneName) {
      return false;
    }

    // Accept UTC or IANA format (contains "/")
    return timezone === 'UTC' || timezone.includes('/');
  } catch {
    return false;
  }
};

/**
 * List of common timezones for validation/autocomplete
 * Organized by region for easy reference
 */
export const COMMON_TIMEZONES = [
  'UTC',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Prague',
  'Europe/Warsaw',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  // Asia
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Jakarta',
  // Australia & Pacific
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  // Africa
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
] as const;

/**
 * Get timezone from common list or validate custom timezone
 * @param timezone - Timezone string to validate
 * @returns Validated timezone or 'UTC' if invalid
 */
export const getValidatedTimezone = (timezone: string | undefined | null): string => {
  if (!timezone) {
    return 'UTC';
  }

  // Check if it's a common timezone (fast path)
  if (COMMON_TIMEZONES.includes(timezone as any)) {
    return timezone;
  }

  // Validate with Luxon (slower but comprehensive)
  if (isValidTimezone(timezone)) {
    return timezone;
  }

  // Default to UTC if invalid
  console.warn(`Invalid timezone "${timezone}" provided, defaulting to UTC`);
  return 'UTC';
};

/**
 * Format datetime in user's timezone for error messages
 * @param utcDatetime - UTC datetime
 * @param timezone - User's IANA timezone
 * @returns Formatted string (e.g., "Monday 07:30")
 */
export const formatDateTimeForUser = (
  utcDatetime: Date | string,
  timezone: string,
): string => {
  const localDt = convertUtcToTimezone(utcDatetime, timezone);
  return localDt.toFormat('EEEE HH:mm'); // "Monday 07:30"
};
