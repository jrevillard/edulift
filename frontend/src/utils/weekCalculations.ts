/**
 * Week calculation utilities for schedule management
 * Timezone-aware ISO week calculations
 *
 * ISO 8601 week date system:
 * - Week 1 is the first week with a Thursday
 * - Weeks start on Monday
 * - Week boundaries are at Monday 00:00 in the user's timezone
 *
 * All functions use the user's timezone for calculations to ensure
 * that week numbers and boundaries are consistent with the user's
 * local calendar, not UTC.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';

// Extend dayjs with required plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

/**
 * Get ISO week number for a datetime in the user's timezone
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string (e.g., "Europe/Paris", "America/Los_Angeles")
 * @returns ISO week number (1-53)
 *
 * @example
 * // For Asia/Tokyo (UTC+9):
 * // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST
 * getISOWeekNumber(new Date('2024-12-31T20:00:00Z'), 'Asia/Tokyo')
 * // Returns: 1 (because it's Monday in Tokyo, which is Week 1 of 2025)
 *
 * @example
 * // For America/Los_Angeles (UTC-8):
 * // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
 * getISOWeekNumber(new Date('2024-01-01T07:00:00Z'), 'America/Los_Angeles')
 * // Returns: 52 (because it's still Sunday in LA, which is Week 52 of 2023)
 */
export const getISOWeekNumber = (datetime: Date | string, timezone: string): number => {
  let dt: dayjs.Dayjs;

  if (typeof datetime === 'string') {
    // Parse ISO string as UTC
    dt = dayjs.utc(datetime);
  } else {
    // Convert Date object to dayjs UTC
    dt = dayjs.utc(datetime);
  }

  // Convert to user's timezone
  const localDt = dt.tz(timezone);

  // Get ISO week number in user's timezone
  return localDt.isoWeek();
};

/**
 * Get ISO week year for a datetime in the user's timezone
 *
 * Note: The ISO week year may differ from the calendar year
 * at the beginning and end of the year.
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string
 * @returns ISO week year
 *
 * @example
 * // For Asia/Tokyo (UTC+9):
 * // Sunday 2024-12-31 20:00 UTC = Monday 2025-01-01 05:00 JST
 * getISOWeekYear(new Date('2024-12-31T20:00:00Z'), 'Asia/Tokyo')
 * // Returns: 2025 (because it's Week 1 of 2025 in Tokyo)
 *
 * @example
 * // For America/Los_Angeles (UTC-8):
 * // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
 * getISOWeekYear(new Date('2024-01-01T07:00:00Z'), 'America/Los_Angeles')
 * // Returns: 2023 (because it's still Week 52 of 2023 in LA)
 */
export const getISOWeekYear = (datetime: Date | string, timezone: string): number => {
  let dt: dayjs.Dayjs;

  if (typeof datetime === 'string') {
    dt = dayjs.utc(datetime);
  } else {
    dt = dayjs.utc(datetime);
  }

  // Convert to user's timezone
  const localDt = dt.tz(timezone);

  // Get ISO week year in user's timezone
  return localDt.isoWeekYear();
};

/**
 * Get the date from ISO week and year in the user's timezone
 *
 * Returns the start of the week (Monday 00:00) in the user's timezone,
 * then converts to UTC.
 *
 * @param year - ISO week year
 * @param week - ISO week number (1-53)
 * @param timezone - IANA timezone string
 * @returns Date object representing Monday 00:00 in user's timezone (as UTC)
 *
 * @example
 * // Get Week 1 of 2025 in Asia/Tokyo
 * getDateFromISOWeek(2025, 1, 'Asia/Tokyo')
 * // Returns: Monday 2024-12-30 00:00 JST = Sunday 2024-12-29 15:00 UTC
 *
 * @example
 * // Get Week 52 of 2023 in America/Los_Angeles
 * getDateFromISOWeek(2023, 52, 'America/Los_Angeles')
 * // Returns: Monday 2023-12-25 00:00 PST = Monday 2023-12-25 08:00 UTC
 */
export const getDateFromISOWeek = (
  year: number,
  week: number,
  timezone: string
): Date => {
  // Create a date in the target year, in the user's timezone
  // We start with January 4th which is always in week 1
  let localDt = dayjs.tz(`${year}-01-04`, timezone);

  // Get the Monday of week 1
  const week1Monday = localDt.startOf('isoWeek');

  // Add the required number of weeks to get to the target week
  // Week 1 is when offset = 0, so we need (week - 1) weeks
  const targetMonday = week1Monday.add(week - 1, 'week');

  // Ensure we're at the start of the day (00:00)
  const startOfDay = targetMonday.startOf('day');

  // Convert to UTC and return as JS Date
  return startOfDay.utc().toDate();
};

/**
 * Get week boundaries (Monday 00:00 to Sunday 23:59:59.999) in user's timezone
 * Returns UTC dates representing the boundaries
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string
 * @returns Object with weekStart and weekEnd in UTC
 *
 * @example
 * // For a datetime in Week 1 of 2025 in Asia/Tokyo
 * getWeekBoundaries(new Date('2025-01-01T05:00:00Z'), 'Asia/Tokyo')
 * // Returns:
 * // {
 * //   weekStart: Monday 2024-12-30 00:00 JST = Sunday 2024-12-29 15:00 UTC
 * //   weekEnd:   Sunday 2025-01-05 23:59:59.999 JST = Sunday 2025-01-05 14:59:59.999 UTC
 * // }
 */
export const getWeekBoundaries = (
  datetime: Date | string,
  timezone: string
): { weekStart: Date; weekEnd: Date } => {
  let dt: dayjs.Dayjs;

  if (typeof datetime === 'string') {
    dt = dayjs.utc(datetime);
  } else {
    dt = dayjs.utc(datetime);
  }

  // Convert to user's timezone
  const localDt = dt.tz(timezone);

  // Get start of week (Monday 00:00) in user's timezone
  const weekStart = localDt.startOf('isoWeek');

  // Get end of week (Sunday 23:59:59.999) in user's timezone
  const weekEnd = weekStart.add(6, 'day').endOf('day');

  return {
    weekStart: weekStart.utc().toDate(),
    weekEnd: weekEnd.utc().toDate()
  };
};

/**
 * Format ISO week for display
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string
 * @returns Formatted string "Week W, YYYY" (e.g., "Week 1, 2025")
 */
export const formatISOWeek = (
  datetime: Date | string,
  timezone: string
): string => {
  const week = getISOWeekNumber(datetime, timezone);
  const year = getISOWeekYear(datetime, timezone);
  return `Week ${week}, ${year}`;
};

/**
 * Check if two datetimes are in the same ISO week in the user's timezone
 *
 * @param datetime1 - First datetime
 * @param datetime2 - Second datetime
 * @param timezone - IANA timezone string
 * @returns true if both datetimes are in the same ISO week
 */
export const isSameISOWeek = (
  datetime1: Date | string,
  datetime2: Date | string,
  timezone: string
): boolean => {
  const week1 = getISOWeekNumber(datetime1, timezone);
  const year1 = getISOWeekYear(datetime1, timezone);
  const week2 = getISOWeekNumber(datetime2, timezone);
  const year2 = getISOWeekYear(datetime2, timezone);

  return week1 === week2 && year1 === year2;
};

// ============================================================================
// LEGACY FUNCTIONS (deprecated - use timezone-aware functions above)
// ============================================================================

/**
 * @deprecated Use getISOWeekNumber(date, timezone) instead
 * Get ISO week number for a given date (uses local timezone)
 * Monday is considered the first day of the week
 */
export const getISOWeekNumberLegacy = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  target.setDate(target.getDate() - dayNr + 3); // Set to Thursday of the week
  const jan4 = new Date(target.getFullYear(), 0, 4);
  const dayDiff = (target.getTime() - jan4.getTime()) / 86400000;
  return 1 + Math.ceil(dayDiff / 7);
};

/**
 * @deprecated Use getDateFromISOWeek(year, week, timezone) instead
 * Get the Monday (start date) of a given ISO week
 * Format: YYYY-WW (e.g., "2025-26")
 */
export const getWeekStartDate = (weekString: string): Date => {
  const [year, week] = weekString.split('-').map(Number);

  // ISO 8601: Week 1 is the first week that has at least 4 days in the new year
  // This means Week 1 contains January 4th
  const jan4 = new Date(year, 0, 4); // January 4th
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

  // Find the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4DayOfWeek);

  // Calculate the Monday of the target week
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

  return targetMonday;
};

/**
 * @deprecated Use formatISOWeek with timezone instead
 * Format week range for display (Monday - Friday)
 */
export const formatWeekRange = (weekString: string): string => {
  const startDate = getWeekStartDate(weekString);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 4); // Friday

  const formatOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  };

  const startFormatted = startDate.toLocaleDateString(undefined, formatOptions);
  const endFormatted = endDate.toLocaleDateString(undefined, formatOptions);

  return `${startFormatted} - ${endFormatted}`;
};

/**
 * @deprecated Use getISOWeekNumber with timezone instead
 * Get current week string in ISO format
 */
export const getCurrentWeek = (currentDate: Date = new Date()): string => {
  const year = currentDate.getFullYear();
  const week = getISOWeekNumberLegacy(currentDate);
  return `${year}-${week.toString().padStart(2, '0')}`;
};

/**
 * @deprecated Will be updated to use timezone-aware calculations
 * Generate weekday information from current week dates
 */
export const generateWeekdays = (weekString: string) => {
  const weekStart = getWeekStartDate(weekString);
  const weekdays = [];

  for (let i = 0; i < 5; i++) { // Monday to Friday
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);

    // Use browser locale instead of hardcoded 'en-US'
    const locale = navigator.language || 'fr-FR';
    weekdays.push({
      key: date.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase(),
      label: date.toLocaleDateString(locale, { weekday: 'long' }),
      shortLabel: date.toLocaleDateString(locale, { weekday: 'short' }),
      date: date,
      dayOfMonth: date.getDate(),
      month: date.getMonth(),
      dateString: date.toISOString().split('T')[0] // YYYY-MM-DD
    });
  }

  return weekdays;
};

/**
 * @deprecated Will be updated to use timezone-aware calculations
 * Navigate to next/previous week
 */
export const navigateWeek = (currentWeek: string, direction: 'next' | 'prev'): string => {
  const currentWeekDate = getWeekStartDate(currentWeek);
  const offset = direction === 'next' ? 7 : -7;

  const newDate = new Date(currentWeekDate);
  newDate.setDate(currentWeekDate.getDate() + offset);

  return getCurrentWeek(newDate);
};
