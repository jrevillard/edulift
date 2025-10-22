/**
 * Date validation utilities for preventing past trip modifications
 */

import { DateTime } from 'luxon';

export type DateInput = Date | string;

/**
 * Format a date for consistent comparison (returns YYYY-MM-DD)
 * @deprecated This function is not used in production code. Consider using Luxon's formatting instead.
 */
export function formatDateForComparison(date: DateInput): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date provided: ${date}`);
  }

  return dateObj.toISOString().split('T')[0];
}

/**
 * Check if a date is in the past (before current time)
 * DEPRECATED: Use isDateInPastWithTimezone for timezone-aware validation
 * @deprecated Use isDateInPastWithTimezone instead
 */
export function isDateInPast(date: DateInput): boolean {
  const now = new Date();
  const checkDate = typeof date === 'string' ? new Date(date) : date;

  // Check if the date is valid
  if (isNaN(checkDate.getTime())) {
    throw new Error(`Invalid date provided: ${date}`);
  }

  return checkDate.getTime() < now.getTime();
}

/**
 * Check if a date is in the past using user's timezone
 * @param date - The date to check (UTC Date or ISO string)
 * @param timezone - User's IANA timezone (e.g., "Europe/Paris", "America/New_York")
 * @param nowOverride - Optional current time override (for testing)
 * @returns true if the date is in the past in the user's timezone
 */
export function isDateInPastWithTimezone(
  date: DateInput,
  timezone: string,
  nowOverride?: Date
): boolean {
  // Convert input date to UTC DateTime
  const checkDateTime = typeof date === 'string'
    ? DateTime.fromISO(date, { zone: 'utc' })
    : DateTime.fromJSDate(date, { zone: 'utc' });

  // Check if the date is valid
  if (!checkDateTime.isValid) {
    throw new Error(`Invalid date provided: ${date}`);
  }

  // Get current time (use override for testing, or real time in production)
  const now = nowOverride
    ? DateTime.fromJSDate(nowOverride, { zone: 'utc' })
    : DateTime.now();

  // Get current time in user's timezone
  const nowInUserTimezone = now.setZone(timezone);

  // Convert check date to user's timezone
  const checkDateInUserTimezone = checkDateTime.setZone(timezone);

  // Compare timestamps
  return checkDateInUserTimezone.toMillis() < nowInUserTimezone.toMillis();
}

/**
 * Validate if a date is allowed for trip operations
 * Throws an error if the date is in the past
 * DEPRECATED: Use validateTripDateWithTimezone for timezone-aware validation
 * @deprecated Use validateTripDateWithTimezone instead
 */
export function validateTripDate(date: DateInput, context: 'create' | 'modify' = 'create'): void {
  if (isDateInPast(date)) {
    const action = context === 'create' ? 'create' : 'modify';
    throw new Error(`Cannot ${action} trips in the past`);
  }
}

/**
 * Validate if a date is allowed for trip operations (timezone-aware)
 * Throws an error if the date is in the past in the user's timezone
 * @param date - The date to validate
 * @param timezone - User's IANA timezone
 * @param context - Operation context ('create' or 'modify')
 * @param nowOverride - Optional current time override (for testing)
 */
export function validateTripDateWithTimezone(
  date: DateInput,
  timezone: string,
  context: 'create' | 'modify' = 'create',
  nowOverride?: Date
): void {
  if (isDateInPastWithTimezone(date, timezone, nowOverride)) {
    const action = context === 'create' ? 'create' : 'modify';

    // Format the date in user's timezone for error message
    const dateTime = typeof date === 'string'
      ? DateTime.fromISO(date, { zone: 'utc' })
      : DateTime.fromJSDate(date, { zone: 'utc' });
    const userLocalTime = dateTime.setZone(timezone).toFormat('yyyy-MM-dd HH:mm');

    throw new Error(`Cannot ${action} trips in the past (${userLocalTime} in ${timezone})`);
  }
}

/**
 * Parse a datetime string for validation
 */
export function parseScheduleSlotDate(datetime: string): Date {
  if (!datetime) {
    throw new Error('DateTime parameter is required for date validation');
  }

  // Check if the string matches ISO 8601 datetime format
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?([+-]\d{2}:\d{2})?$/;
  if (!isoRegex.test(datetime)) {
    throw new Error(`Invalid datetime format: ${datetime}. Expected ISO 8601 datetime string.`);
  }

  const date = new Date(datetime);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime format: ${datetime}. Expected ISO 8601 datetime string.`);
  }

  return date;
}

/**
 * Validate a schedule slot datetime for creation
 * DEPRECATED: Use validateScheduleSlotCreationWithTimezone instead
 * @deprecated Use validateScheduleSlotCreationWithTimezone instead
 */
export function validateScheduleSlotCreation(datetime: string): void {
  const date = parseScheduleSlotDate(datetime);
  validateTripDate(date, 'create');
}

/**
 * Validate a schedule slot datetime for creation (timezone-aware)
 * @param datetime - The datetime to validate (ISO string)
 * @param timezone - User's IANA timezone
 * @param nowOverride - Optional current time override (for testing)
 */
export function validateScheduleSlotCreationWithTimezone(
  datetime: string,
  timezone: string,
  nowOverride?: Date
): void {
  const date = parseScheduleSlotDate(datetime);
  validateTripDateWithTimezone(date, timezone, 'create', nowOverride);
}

/**
 * Validate a schedule slot datetime for modification
 * DEPRECATED: Use validateScheduleSlotModificationWithTimezone instead
 * @deprecated Use validateScheduleSlotModificationWithTimezone instead
 */
export function validateScheduleSlotModification(datetime: string): void {
  const date = parseScheduleSlotDate(datetime);
  validateTripDate(date, 'modify');
}

/**
 * Validate a schedule slot datetime for modification (timezone-aware)
 * @param datetime - The datetime to validate (ISO string)
 * @param timezone - User's IANA timezone
 * @param nowOverride - Optional current time override (for testing)
 */
export function validateScheduleSlotModificationWithTimezone(
  datetime: string,
  timezone: string,
  nowOverride?: Date
): void {
  const date = parseScheduleSlotDate(datetime);
  validateTripDateWithTimezone(date, timezone, 'modify', nowOverride);
}