/**
 * Runtime Configuration
 *
 * This module provides access to runtime environment variables injected by nginx.
 * Configuration is injected via /config.js which sets window.__ENV__.
 *
 * This allows the same Docker image to be used across different environments
 * without rebuilding.
 */

interface RuntimeConfig {
  VITE_API_URL: string;
  VITE_SOCKET_URL: string;
  VITE_SOCKET_FORCE_POLLING: string;
  VITE_APP_STORE_URL: string;
  VITE_PLAY_STORE_URL: string;
  VITE_APP_UNIVERSAL_LINKS_BASE_URL?: string;
  VITE_MOBILE_APP_LINKS_BASE_URL?: string;
}

// Extend Window interface to include our runtime config
declare global {
  interface Window {
    __ENV__?: RuntimeConfig;
  }
}

/**
 * Get runtime configuration value with fallbacks:
 * 1. Runtime config from window.__ENV__ (injected by nginx)
 * 2. Build-time environment variable (for local development)
 * 3. Default value
 */
function getRuntimeConfig(): RuntimeConfig {
  // If runtime config is available, use it (production/staging)
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__;
  }

  // Fallback to build-time env vars (local development)
  return {
    VITE_API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
    VITE_SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001',
    VITE_SOCKET_FORCE_POLLING: import.meta.env.VITE_SOCKET_FORCE_POLLING || 'false',
    VITE_APP_STORE_URL: import.meta.env.VITE_APP_STORE_URL || 'https://apps.apple.com/app/edulift',
    VITE_PLAY_STORE_URL: import.meta.env.VITE_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.edulift',
    VITE_APP_UNIVERSAL_LINKS_BASE_URL: import.meta.env.VITE_APP_UNIVERSAL_LINKS_BASE_URL,
    VITE_MOBILE_APP_LINKS_BASE_URL: import.meta.env.VITE_MOBILE_APP_LINKS_BASE_URL,
  };
}

// Export runtime configuration
export const config = getRuntimeConfig();

// Export individual values for convenience
export const API_BASE_URL = config.VITE_API_URL;
export const SOCKET_URL = config.VITE_SOCKET_URL;
export const SOCKET_FORCE_POLLING = config.VITE_SOCKET_FORCE_POLLING === 'true';
export const APP_STORE_URL = config.VITE_APP_STORE_URL;
export const PLAY_STORE_URL = config.VITE_PLAY_STORE_URL;
