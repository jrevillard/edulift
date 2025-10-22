import { useCallback, useMemo } from 'react';
import { formatDate, formatRelativeTime, formatErrorDate, getUserLocale, type DateContext } from '../utils/dateFormatting';

/**
 * Custom hook for consistent date formatting throughout the application
 */
export function useDateFormatting() {
  const userLocale = useMemo(() => getUserLocale(), []);

  const format = useCallback((
    isoDateTime: string,
    context: DateContext = 'FULL'
  ): string => {
    return formatDate(isoDateTime, userLocale, context);
  }, [userLocale]);

  const formatRelative = useCallback((isoDateTime: string): string => {
    return formatRelativeTime(isoDateTime, userLocale);
  }, [userLocale]);

  const formatError = useCallback((isoDateTime: string): string => {
    return formatErrorDate(isoDateTime, userLocale);
  }, [userLocale]);

  return {
    format,
    formatRelative,
    formatError,
    locale: userLocale
  };
}

/**
 * Hook specifically for relative time that updates periodically
 */
export function useRelativeTime(isoDateTime: string, _updateInterval: number = 60000) {
  const { formatRelative } = useDateFormatting();
  
  // For now, just return the formatted time
  // In the future, this could include automatic updates with updateInterval
  return formatRelative(isoDateTime);
}