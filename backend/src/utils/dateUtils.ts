/**
 * Date formatting utilities for consistent UTC handling
 * These were extracted from DashboardService since they're only used by tests
 */

export function formatTimeFromDatetime(datetime: Date): string {
  // Return UTC time as HH:MM format without timezone conversion
  // Backend should send UTC times and let frontend handle display timezone
  const hours = datetime.getUTCHours().toString().padStart(2, '0');
  const minutes = datetime.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateFromDatetime(datetime: Date): string {
  // Return UTC-based day of week
  // Backend should send UTC times and let frontend handle display timezone
  const dayOfWeek = datetime.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}