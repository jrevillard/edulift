/**
 * Date validation utilities for preventing past trip modifications
 */

type DateInput = string | Date;

/**
 * Format a date for consistent comparison (returns YYYY-MM-DD)
 */
export function formatDateForComparison(date: DateInput): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Check if a date is in the past (before current time) - timezone-aware
 */
export function isDateInPast(date: DateInput, userTimezone: string): boolean {
  if (!userTimezone) {
    console.warn('isDateInPast called without timezone - using UTC');
    const checkDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    return checkDate.getTime() < now.getTime();
  }

  // Use timezone-aware comparison
  const nowInUserTz = new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
  const checkDateInUserTz = new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString("en-US", { timeZone: userTimezone }));
  return checkDateInUserTz < nowInUserTz;
}

/**
 * Get validation message for a date, or null if valid - timezone-aware
 */
export function getDateValidationMessage(date: DateInput, userTimezone?: string): string | null {
  if (userTimezone && isDateInPast(date, userTimezone)) {
    return 'Cannot schedule trips in the past';
  }
  return null;
}

/**
 * Validate that a date is not in the past - timezone-aware
 */
export function validateDateNotInPast(date: DateInput, userTimezone?: string): void {
  const message = getDateValidationMessage(date, userTimezone);
  if (message) {
    throw new Error(message);
  }
}