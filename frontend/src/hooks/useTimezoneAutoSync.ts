import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import {
  getBrowserTimezone,
  isValidTimezone,
  safeLocalStorageGet,
  STORAGE_KEYS
} from '../utils/timezoneUtils';
import { toast } from 'sonner';

/**
 * Custom hook to automatically sync user timezone with browser timezone
 *
 * Features:
 * - Auto-syncs on app startup if enabled
 * - Auto-syncs when tab becomes visible (user returns to app)
 * - Periodic checks every 5 minutes when enabled
 * - Only syncs if timezone differs from current user timezone
 * - Respects user's auto-sync preference (stored in localStorage)
 * - Validates timezone before syncing
 * - Provides error feedback to user
 *
 * Usage:
 * ```tsx
 * function App() {
 *   useTimezoneAutoSync();
 *   return <YourApp />;
 * }
 * ```
 */
export function useTimezoneAutoSync(): void {
  const { user } = useAuth();
  const lastSyncedTimezone = useRef<string | null>(null);
  const isSyncing = useRef(false);

  // Track auto-sync state in component state (re-renders when changed)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    const saved = safeLocalStorageGet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE);
    // Default to enabled for new users (better UX)
    return saved === null ? true : saved === 'true';
  });

  // Listen for storage changes (when user toggles in ProfilePage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.AUTO_SYNC_TIMEZONE) {
        setAutoSyncEnabled(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event from same tab
    const handleLocalChange = () => {
      setAutoSyncEnabled(
        safeLocalStorageGet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE) === 'true'
      );
    };

    window.addEventListener('autoSyncChanged', handleLocalChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('autoSyncChanged', handleLocalChange);
    };
  }, []);

  /**
   * Check and sync timezone if conditions are met
   */
  const checkAndSyncTimezone = useCallback(async () => {
    // Prevent concurrent sync attempts
    if (isSyncing.current) {
      return;
    }

    // Check if auto-sync is enabled (default to true for new users)
    const savedPreference = safeLocalStorageGet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE);
    const autoSyncEnabled = savedPreference === null ? true : savedPreference === 'true';

    if (!autoSyncEnabled || !user) {
      return;
    }

    const browserTz = getBrowserTimezone();

    // Validate before syncing
    if (!isValidTimezone(browserTz)) {
      console.warn(`[useTimezoneAutoSync] Invalid browser timezone: ${browserTz}`);
      return;
    }

    // Only sync if browser timezone differs from user's current timezone
    // and we haven't just synced to this timezone
    if (browserTz !== user.timezone && browserTz !== lastSyncedTimezone.current) {
      isSyncing.current = true;

      try {
        console.log(`[useTimezoneAutoSync] Auto-syncing timezone from ${user.timezone} to ${browserTz}`);
        await authService.updateTimezone(browserTz);

        // Update user state - authService.onAuthChanged callback already called by authService
        // No need to call updateUser() explicitly (would be redundant)

        // Only set after successful sync
        lastSyncedTimezone.current = browserTz;

        console.log(`[useTimezoneAutoSync] Successfully synced to ${browserTz}`);
      } catch (error) {
        console.error('[useTimezoneAutoSync] Failed to auto-sync timezone:', error);

        // Always show error toast so user knows there's a problem
        toast.error('Failed to auto-sync timezone', {
          description: 'Please check your connection and try again'
        });

        // Don't set lastSyncedTimezone on error, allowing retry
      } finally {
        isSyncing.current = false;
      }
    }
  }, [user]);

  /**
   * Check timezone on mount (app startup)
   */
  useEffect(() => {
    checkAndSyncTimezone();
  }, [checkAndSyncTimezone]);

  // Store latest callback in ref to prevent event listener churn
  const checkAndSyncRef = useRef(checkAndSyncTimezone);
  useEffect(() => {
    checkAndSyncRef.current = checkAndSyncTimezone;
  }, [checkAndSyncTimezone]);

  /**
   * Check timezone when tab becomes visible (user returns)
   * This is useful when user travels and opens the app
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useTimezoneAutoSync] Tab became visible, checking timezone...');
        checkAndSyncRef.current();  // Call latest via ref
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);  // Empty deps - registers once only

  /**
   * Check timezone periodically (every 5 minutes)
   * This catches timezone changes even if the user doesn't switch tabs
   * Only runs when auto-sync is enabled
   */
  useEffect(() => {
    if (!autoSyncEnabled) {
      return;  // Don't start interval if disabled
    }

    const intervalId = setInterval(() => {
      checkAndSyncTimezone();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(intervalId);
    };
  }, [checkAndSyncTimezone, autoSyncEnabled]);  // Now depends on state!
}
