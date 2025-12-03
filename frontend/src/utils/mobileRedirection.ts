import type { MobileDetectionResult } from '../hooks/useMobileDetection';
import { config } from '../config/runtime';

/**
 * Configuration des custom schemes pour EduLift
 */
const CUSTOM_SCHEME = 'edulift';

/**
 * Types de chemins supportés par l'application mobile
 */
type SupportedPath =
  | '/auth/verify'
  | '/families/join'
  | '/groups/join'
  | '/dashboard';

/**
 * Options de redirection mobile perfectionnées
 */
interface MobileRedirectionOptions {
  /** Délai avant le fallback en ms (default: 2000) */
  fallbackDelay?: number;
  /** Force Universal Links/App Links over custom scheme */
  preferUniversalLinks?: boolean;
  /** Logger function for debugging */
  onAttempt?: (url: string, method: 'custom_scheme' | 'universal_link' | 'app_link') => void;
  /** Logger function when fallback occurs */
  onFallback?: (reason: 'timeout' | 'unsupported' | 'error') => void;
}

/**
 * Security validation for URL parameters
 */
const validateParams = (params: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};

  Object.entries(params).forEach(([key, value]) => {
    // Sanitize keys and values
    const sanitizedKey = key.replace(/[<>"'&]/g, '').substring(0, 50);
    const sanitizedValue = value.replace(/[<>"'&]/g, '').substring(0, 1000);

    if (sanitizedKey && sanitizedValue) {
      sanitized[sanitizedKey] = sanitizedValue;
    }
  });

  return sanitized;
};

/**
 * Builds custom scheme URL for the mobile application
 */
const buildCustomSchemeUrl = (
  path: SupportedPath,
  params: Record<string, string> = {}
): string => {
  // Validate parameters
  const sanitizedParams = validateParams(params);

  // Secure URL construction
  const queryString = Object.entries(sanitizedParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${CUSTOM_SCHEME}://${path}${queryString ? '?' + queryString : ''}`;
};

/**
 * Builds Universal Link URL for iOS
 */
const buildUniversalLinkUrl = (
  path: SupportedPath,
  params: Record<string, string> = {}
): string => {
  // Validate parameters
  const sanitizedParams = validateParams(params);
  const baseURL = config.VITE_APP_UNIVERSAL_LINKS_BASE_URL ||
    window.location.origin;

  // Secure URL construction for Universal Links
  const queryString = Object.entries(sanitizedParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${baseURL}${path}${queryString ? '?' + queryString : ''}`;
};

/**
 * Builds App Link URL for Android
 */
const buildAppLinkUrl = (
  path: SupportedPath,
  params: Record<string, string> = {}
): string => {
  // Validate parameters
  const sanitizedParams = validateParams(params);
  const baseURL = config.VITE_MOBILE_APP_LINKS_BASE_URL ||
    window.location.origin;

  // Secure URL construction for App Links
  const queryString = Object.entries(sanitizedParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${baseURL}${path}${queryString ? '?' + queryString : ''}`;
};

/**
 * Determines the best redirection method based on device and OS version
 */
const getOptimalRedirectMethod = (
  deviceType: string,
  deviceInfo: MobileDetectionResult['deviceInfo']
): 'universal_link' | 'app_link' | 'custom_scheme' => {
  const { osVersion } = deviceInfo;

  // iOS Universal Links (iOS 9+)
  if (deviceType === 'ios' && osVersion) {
    const [major] = osVersion.split('.').map(Number);
    if (major >= 9) return 'universal_link';
  }

  // Android App Links (Android 6+)
  if (deviceType === 'android' && osVersion) {
    const [major] = osVersion.split('.').map(Number);
    if (major >= 6) return 'app_link';
  }

  // Fall back to custom scheme
  return 'custom_scheme';
};

/**
 * Builds the optimal URL based on device capabilities and preferences
 */
const buildOptimalUrl = (
  path: SupportedPath,
  params: Record<string, string>,
  mobileDetection: MobileDetectionResult,
  options: MobileRedirectionOptions
): { url: string; method: 'universal_link' | 'app_link' | 'custom_scheme' } => {
  const { deviceType, deviceInfo } = mobileDetection;
  const { preferUniversalLinks = false } = options;

  let method: 'universal_link' | 'app_link' | 'custom_scheme' = 'custom_scheme';

  // Choose method based on device capabilities and preference
  if (preferUniversalLinks && (deviceType === 'ios' || deviceType === 'android')) {
    method = getOptimalRedirectMethod(deviceType, deviceInfo);
  } else {
    method = 'custom_scheme';
  }

  // Build URL based on method
  let url: string;
  switch (method) {
    case 'universal_link':
      url = buildUniversalLinkUrl(path, params);
      break;
    case 'app_link':
      url = buildAppLinkUrl(path, params);
      break;
    default:
      url = buildCustomSchemeUrl(path, params);
      break;
  }

  return { url, method };
};

/**
 * Enhanced mobile app opening with Universal Links and App Links support
 * Perfect implementation for all modern mobile platforms
 */
export const attemptMobileAppOpen = (
  path: SupportedPath,
  params: Record<string, string> = {},
  mobileDetection: MobileDetectionResult,
  options: MobileRedirectionOptions = {}
): boolean => {
  const { isMobile, deviceType } = mobileDetection;
  const { fallbackDelay = 1500, onAttempt, onFallback } = options;

  // Only attempt redirect on mobile devices (including tablets)
  if (!isMobile || deviceType === 'unknown' || deviceType === 'desktop') {
    console.log('🔍 MobileRedirection: Not a mobile device or unknown device type');
    return false;
  }

  // Build optimal URL based on device capabilities
  const { url, method } = buildOptimalUrl(path, params, mobileDetection, options);

  console.log(`🔍 MobileRedirection: Attempting to open ${url} on ${deviceType} using ${method}`);
  onAttempt?.(url, method);

  // Execute redirection with enhanced error handling
  try {
    // For Universal Links and App Links, use regular navigation
    if (method === 'universal_link' || method === 'app_link') {
      window.location.href = url;
    } else {
      // For custom schemes, use immediate redirect
      window.location.href = url;
    }
  } catch (error) {
    console.error('🔍 MobileRedirection: Failed to redirect:', error);
    onFallback?.('error');
    return false;
  }

  // Optimized app detection using requestIdleCallback for better performance
  let fallbackTriggered = false;
  let detectionTimer: number;

  const cleanup = () => {
    if (fallbackTriggered) return;

    fallbackTriggered = true;
    clearTimeout(detectionTimer);

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handlePageHide);
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && !fallbackTriggered) {
      console.log('🔍 MobileRedirection: Page hidden, app likely opened');
      cleanup();
    }
  };

  const handlePageHide = () => {
    if (!fallbackTriggered) {
      console.log('🔍 MobileRedirection: Page hide detected, app likely opened');
      cleanup();
    }
  };

  // Use requestIdleCallback for non-blocking detection setup
  const setupDetection = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    // Fallback with reduced delay for better UX
    detectionTimer = window.setTimeout(() => {
      if (!fallbackTriggered && !document.hidden) {
        console.log(`🔍 MobileRedirection: App not detected after ${fallbackDelay}ms, staying on web`);
        cleanup();
        onFallback?.('timeout');
      }
    }, fallbackDelay);
  };

  // Use requestIdleCallback if available, otherwise fallback to immediate execution
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(setupDetection, { timeout: 100 });
  } else {
    setupDetection();
  }

  return true;
};

/**
 * Converts search parameters to object
 */
export const parseSearchParams = (searchParams: URLSearchParams): Record<string, string> => {
  const params: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
};

/**
 * Route mapping type for web to mobile routes
 */
interface RouteMapping {
  [webRoute: string]: SupportedPath;
}

/**
 * Mapping of web routes to supported mobile routes
 */
const ROUTE_MAPPING: RouteMapping = {
  '/auth/verify': '/auth/verify',
  '/families/join': '/families/join',
  '/groups/join': '/groups/join',
  '/dashboard': '/dashboard'
};

/**
 * Checks if a web route is supported for mobile redirection
 */
export const isMobileSupportedRoute = (webPath: string): boolean => {
  return webPath in ROUTE_MAPPING;
};

/**
 * Gets the corresponding mobile path for a web route
 */
export const getMobilePath = (webPath: string): SupportedPath | null => {
  return ROUTE_MAPPING[webPath] || null;
};