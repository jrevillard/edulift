import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import {
  COMMON_TIMEZONES,
  isValidTimezone,
  getBrowserTimezone,
  safeLocalStorageGet,
  safeLocalStorageSet,
  STORAGE_KEYS
} from '../utils/timezoneUtils';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';

interface TimezoneSelectorProps {
  currentTimezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  className?: string;
}

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  currentTimezone,
  onTimezoneChange,
  className = ''
}) => {
  const { updateUser } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone || 'UTC');
  const [isLoading, setIsLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    const saved = safeLocalStorageGet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE);

    if (saved === null) {
      // First time - enable auto-sync by default for better UX
      safeLocalStorageSet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE, 'true');
      // Dispatch event so hook picks up the change
      window.dispatchEvent(new Event('autoSyncChanged'));
      return true;
    }

    return saved === 'true';
  });

  // Update selected timezone when currentTimezone prop changes
  useEffect(() => {
    if (currentTimezone) {
      setSelectedTimezone(currentTimezone);
    }
  }, [currentTimezone]);

  /**
   * Silent auto-sync on component mount if enabled
   * Prevents toast spam on initial page load
   */
  useEffect(() => {
    if (autoSyncEnabled && currentTimezone) {
      const browserTz = getBrowserTimezone();

      // Only sync if timezone differs
      if (browserTz !== currentTimezone && isValidTimezone(browserTz)) {
        // Silent sync - don't show toast on initial load
        handleTimezoneChange(browserTz).catch(error => {
          console.error('[TimezoneSelector] Failed to auto-sync on mount:', error);
          // Don't show error toast on initial load to avoid bad UX
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleTimezoneChange = async (timezone: string) => {
    if (!timezone || timezone === currentTimezone) {
      return;
    }

    // Validate timezone
    if (!isValidTimezone(timezone)) {
      toast.error('Invalid timezone selected', {
        description: 'Please select a valid timezone from the list'
      });
      return;
    }

    setIsLoading(true);
    setSelectedTimezone(timezone);

    try {
      // Call API to update timezone
      await authService.updateTimezone(timezone);

      // Update user state in AuthContext
      updateUser();

      // Notify parent component
      if (onTimezoneChange) {
        onTimezoneChange(timezone);
      }

      toast.success('Timezone updated successfully', {
        description: `All times will now display in ${COMMON_TIMEZONES.find(tz => tz.value === timezone)?.label || timezone}`
      });

    } catch (error) {
      // Revert selection on error
      setSelectedTimezone(currentTimezone || 'UTC');

      const errorMessage = error instanceof Error ? error.message : 'Failed to update timezone';
      toast.error('Failed to update timezone', {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Auto-detect timezone from browser and update if different
   */
  const handleAutoDetect = async () => {
    const browserTz = getBrowserTimezone();
    if (browserTz !== currentTimezone) {
      await handleTimezoneChange(browserTz);
    }
    // No toast if timezone already matches - avoids duplicate toasts
  };

  /**
   * Toggle auto-sync preference and sync immediately if enabled
   */
  const handleAutoSyncToggle = async (enabled: boolean) => {
    // Safely store preference
    const success = safeLocalStorageSet(STORAGE_KEYS.AUTO_SYNC_TIMEZONE, enabled.toString());
    if (!success) {
      toast.error('Failed to save preference', {
        description: 'Your browser may have storage disabled'
      });
      return;
    }

    setAutoSyncEnabled(enabled);

    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('autoSyncChanged'));

    if (enabled) {
      // Immediately sync with browser timezone
      const browserTz = getBrowserTimezone();
      if (browserTz !== currentTimezone) {
        try {
          await handleTimezoneChange(browserTz);

          // Only show success toast AFTER timezone sync completes
          toast.success('Auto-sync enabled', {
            description: `Timezone updated to ${browserTz}`
          });
        } catch {
          toast.error('Auto-sync enabled but timezone update failed', {
            description: 'Will retry automatically'
          });
        }
      } else {
        toast.success('Auto-sync enabled', {
          description: 'Timezone already matches browser'
        });
      }
    } else {
      // Disabled - immediate feedback OK
      toast.success('Auto-sync disabled', {
        description: 'Timezone will remain fixed'
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current timezone display */}
      <div className="flex items-center gap-2 text-sm">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Current: {currentTimezone || 'UTC'}</span>
      </div>

      {/* Timezone dropdown selector */}
      <div>
        <select
          value={selectedTimezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          disabled={isLoading || autoSyncEnabled}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="TimezoneSelector-Select-timezone"
        >
          {COMMON_TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value} data-testid={`timezone-option-${tz.value}`}>
              {tz.label}
            </option>
          ))}
        </select>
        {autoSyncEnabled && (
          <p className="text-sm text-muted-foreground mt-1">
            Manual selection disabled while auto-sync is enabled
          </p>
        )}
      </div>

      {/* Auto-detect button */}
      <button
        onClick={handleAutoDetect}
        disabled={isLoading || autoSyncEnabled}
        className="w-full flex items-center justify-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="TimezoneSelector-Button-autoDetect"
      >
        <Globe className="h-4 w-4" />
        <span>Auto-detect from browser</span>
      </button>

      {/* Auto-sync checkbox */}
      <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <input
          type="checkbox"
          checked={autoSyncEnabled}
          onChange={(e) => handleAutoSyncToggle(e.target.checked)}
          disabled={isLoading}
          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary focus:ring-offset-0 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="TimezoneSelector-Checkbox-autoSync"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Automatically sync timezone
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Keep timezone synchronized with browser
          </div>
        </div>
      </label>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
          <span>Updating timezone...</span>
        </div>
      )}
    </div>
  );
};

export default TimezoneSelector;
