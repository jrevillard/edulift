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
 * Check if a date is in the past (before current time)
 */
export function isDateInPast(date: DateInput): boolean {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return checkDate.getTime() < now.getTime();
}

/**
 * Get validation message for a date, or null if valid
 */
export function getDateValidationMessage(date: DateInput): string | null {
  if (isDateInPast(date)) {
    return 'Cannot schedule trips in the past';
  }
  return null;
}

/**
 * Validate that a date is not in the past
 */
export function validateDateNotInPast(date: DateInput): void {
  const message = getDateValidationMessage(date);
  if (message) {
    throw new Error(message);
  }
}