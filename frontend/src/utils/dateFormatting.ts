/**
 * Date formatting utilities with locale support
 */

export type DateContext = 'ERROR' | 'SCHEDULE' | 'FORM' | 'RELATIVE' | 'FULL';

/**
 * Format a date string according to context and locale
 */
export function formatDate(
  isoDateTime: string,
  locale: string = 'en-US',
  context: DateContext = 'FULL'
): string {
  try {
    const date = new Date(isoDateTime);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const userLocale = locale || getUserLocale();

    switch (context) {
      case 'ERROR':
        return new Intl.DateTimeFormat(userLocale, {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date);

      case 'SCHEDULE':
        return new Intl.DateTimeFormat(userLocale, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }).format(date);

      case 'FORM':
        return new Intl.DateTimeFormat(userLocale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);

      case 'RELATIVE':
        return formatRelativeTime(isoDateTime, locale);

      case 'FULL':
      default:
        return new Intl.DateTimeFormat(userLocale, {
          dateStyle: 'full',
          timeStyle: 'medium'
        }).format(date);
    }
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  isoDateTime: string,
  locale: string = 'en-US'
): string {
  try {
    const date = new Date(isoDateTime);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    // Calculate appropriate unit
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    } else if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(diffMinutes, 'minute');
    } else {
      return rtf.format(diffSeconds, 'second');
    }
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date specifically for error messages (concise format)
 */
export function formatErrorDate(
  isoDateTime: string,
  locale: string = 'en-US'
): string {
  return formatDate(isoDateTime, locale, 'ERROR');
}

/**
 * Get the user's locale from browser or return fallback
 */
export function getUserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US'; // Fallback
}