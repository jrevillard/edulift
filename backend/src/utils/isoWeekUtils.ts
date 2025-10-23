import { DateTime } from 'luxon';

/**
 * ISO Week Utilities - Timezone-Aware
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

/**
 * Get ISO week number for a datetime in the user's timezone
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string (e.g., "Europe/Paris", "America/Los_Angeles")
 * @returns ISO week number (1-53)
 *
 * @example
 * // For Asia/Tokyo (UTC+9):
 * // Sunday 2024-12-31 20:00 UTC = Monday 2024-01-01 05:00 JST
 * getISOWeekNumber(new Date('2024-12-31T20:00:00Z'), 'Asia/Tokyo')
 * // Returns: 1 (because it's Monday in Tokyo, which is Week 1 of 2024)
 *
 * @example
 * // For America/Los_Angeles (UTC-8):
 * // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
 * getISOWeekNumber(new Date('2024-01-01T07:00:00Z'), 'America/Los_Angeles')
 * // Returns: 52 (because it's still Sunday in LA, which is Week 52 of 2023)
 */
export const getISOWeekNumber = (
  datetime: Date | string,
  timezone: string,
): number => {
  const dt = typeof datetime === 'string'
    ? DateTime.fromISO(datetime, { zone: 'utc' })
    : DateTime.fromJSDate(datetime, { zone: 'utc' });

  // Convert to user's timezone
  const localDt = dt.setZone(timezone);

  // Get ISO week number in user's timezone
  return localDt.weekNumber;
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
 * // Sunday 2024-12-31 20:00 UTC = Monday 2024-01-01 05:00 JST
 * getISOWeekYear(new Date('2024-12-31T20:00:00Z'), 'Asia/Tokyo')
 * // Returns: 2024 (because it's Week 1 of 2024 in Tokyo)
 *
 * @example
 * // For America/Los_Angeles (UTC-8):
 * // Monday 2024-01-01 07:00 UTC = Sunday 2023-12-31 23:00 PST
 * getISOWeekYear(new Date('2024-01-01T07:00:00Z'), 'America/Los_Angeles')
 * // Returns: 2023 (because it's still Week 52 of 2023 in LA)
 */
export const getISOWeekYear = (
  datetime: Date | string,
  timezone: string,
): number => {
  const dt = typeof datetime === 'string'
    ? DateTime.fromISO(datetime, { zone: 'utc' })
    : DateTime.fromJSDate(datetime, { zone: 'utc' });

  // Convert to user's timezone
  const localDt = dt.setZone(timezone);

  // Get ISO week year in user's timezone
  return localDt.weekYear;
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
 * // Get Week 1 of 2024 in Asia/Tokyo
 * getDateFromISOWeek(2024, 1, 'Asia/Tokyo')
 * // Returns: Monday 2024-01-01 00:00 JST = Sunday 2023-12-31 15:00 UTC
 *
 * @example
 * // Get Week 52 of 2023 in America/Los_Angeles
 * getDateFromISOWeek(2023, 52, 'America/Los_Angeles')
 * // Returns: Monday 2023-12-25 00:00 PST = Monday 2023-12-25 08:00 UTC
 */
export const getDateFromISOWeek = (
  year: number,
  week: number,
  timezone: string,
): Date => {
  // Create DateTime for the given ISO week in the user's timezone
  const localDt = DateTime.fromObject(
    { weekYear: year, weekNumber: week, weekday: 1 }, // Monday = 1
    { zone: timezone },
  ).startOf('day'); // Start of day (00:00) in user's timezone

  // Convert to UTC and return as JS Date
  return localDt.toUTC().toJSDate();
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
 * // For a datetime in Week 1 of 2024 in Asia/Tokyo
 * getWeekBoundaries(new Date('2024-01-01T05:00:00Z'), 'Asia/Tokyo')
 * // Returns:
 * // {
 * //   weekStart: Monday 2024-01-01 00:00 JST = Sunday 2023-12-31 15:00 UTC
 * //   weekEnd:   Sunday 2024-01-07 23:59:59.999 JST = Sunday 2024-01-07 14:59:59.999 UTC
 * // }
 */
export const getWeekBoundaries = (
  datetime: Date | string,
  timezone: string,
): { weekStart: Date; weekEnd: Date } => {
  const dt = typeof datetime === 'string'
    ? DateTime.fromISO(datetime, { zone: 'utc' })
    : DateTime.fromJSDate(datetime, { zone: 'utc' });

  // Convert to user's timezone
  const localDt = dt.setZone(timezone);

  // Get start of week (Monday 00:00) in user's timezone
  const weekStart = localDt.startOf('week'); // Luxon weeks start on Monday

  // Get end of week (Sunday 23:59:59.999) in user's timezone
  const weekEnd = weekStart.plus({ days: 6 }).endOf('day');

  return {
    weekStart: weekStart.toUTC().toJSDate(),
    weekEnd: weekEnd.toUTC().toJSDate(),
  };
};

/**
 * Format ISO week for display
 *
 * @param datetime - Date object or ISO string (assumed to be in UTC)
 * @param timezone - IANA timezone string
 * @returns Formatted string "Week W, YYYY" (e.g., "Week 1, 2024")
 */
export const formatISOWeek = (
  datetime: Date | string,
  timezone: string,
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
  timezone: string,
): boolean => {
  const week1 = getISOWeekNumber(datetime1, timezone);
  const year1 = getISOWeekYear(datetime1, timezone);
  const week2 = getISOWeekNumber(datetime2, timezone);
  const year2 = getISOWeekYear(datetime2, timezone);

  return week1 === week2 && year1 === year2;
};
