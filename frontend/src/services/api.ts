/**
 * Pure OpenAPI Client - Direct openapi-fetch with Generated Types
 *
 * This is the purest approach: no manual wrappers, no duplicate type definitions.
 * Just the raw openapi-fetch client with full type safety from generated types.
 *
 * Usage:
 *   import { api } from '@/services/api';
 *   await api.GET('/api/v1/children', {});  // Full type safety, auto-completion
 *
 * Token Refresh Flow:
 *   1. API call receives 401 response
 *   2. Proxy wrapper intercepts and attempts token refresh
 *   3. If refresh succeeds, retry original request with new token
 *   4. If refresh fails, clear auth and redirect to login
 */

import createClient from 'openapi-fetch';
import type { paths } from '../generated/api/types';
import { API_BASE_URL } from '../config/runtime';
import { secureStorage } from '../utils/secureStorage';

// Interface for test environment window extension
interface TestWindow extends Window {
  __TEST_ENVIRONMENT__?: boolean;
}

// Storage key constants
const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
} as const;

// Track if a token refresh is in progress to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the authentication token
 *
 * This function handles token refresh when a 401 response is received.
 * It prevents concurrent refresh attempts and properly handles test environments.
 *
 * @returns Promise<boolean> - true if refresh succeeded, false if it failed
 *
 * @example
 * ```ts
 * const success = await attemptTokenRefresh();
 * if (success) {
 *   // Retry request with new token
 * } else {
 *   // Redirect to login
 * }
 * ```
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { authService } = await import('./authService');
      await authService.refreshToken();
      console.log('[AUTH] Token refreshed successfully');
      return true;
    } catch (refreshError) {
      console.error('[AUTH] Token refresh failed:', refreshError);

      // Clear authentication data
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.USER_DATA);

      // Skip navigation in test environment
      const testWindow = window as TestWindow;
      const isTestEnvironment = typeof window !== 'undefined' && testWindow.__TEST_ENVIRONMENT__;

      if (typeof window !== 'undefined' && !isTestEnvironment) {
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        window.location.href = '/login';
      }

      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Create the typed API client with authentication middleware
const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a proxy wrapper that handles 401 responses with token refresh
const apiProxy = new Proxy(client, {
  get(target, prop) {
    // Return the original property if it's not an HTTP method
    if (typeof prop !== 'string' || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(prop.toUpperCase())) {
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    }

    // Return a wrapped function that handles token refresh on 401
    return async (...args: unknown[]) => {
      // Get the original method with proper type from openapi-fetch
      const method = (target as unknown as Record<string | symbol, unknown>)[prop] as (...args: unknown[]) => ReturnType<
        typeof client.GET | typeof client.POST | typeof client.PUT | typeof client.PATCH | typeof client.DELETE
      >;

      // Make the initial request
      let response = await method(...args);

      // If we get a 401, try to refresh the token and retry once
      if (response.error?.status === 401) {
        console.log('[AUTH] 401 Unauthorized - attempting token refresh');

        const refreshSuccess = await attemptTokenRefresh();

        if (refreshSuccess) {
          // Retry the original request with the new token
          console.log('[AUTH] Retrying request with new token');
          response = await method(...args);
        }
      }

      return response;
    };
  },
});

// Authentication middleware
// NOTE: This middleware ONLY injects the auth token. 401 handling is done by the Proxy wrapper above.
// This separation allows the Proxy to retry requests after successful token refresh.
client.use({
  async onRequest({ request }: { request: Request }) {
    try {
      // Get token directly from in-memory authService.
      // AuthContext.ensureInitialized() already ran during app startup,
      // so the token is always available in memory after login.
      // Avoid await ensureInitialized() here — it adds an unnecessary
      // async yield point that can stall requests when concurrent
      // middleware calls race on the microtask queue.
      const { authService } = await import('./authService');
      const token = authService.getToken();

      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.warn('[AUTH] Failed to retrieve auth token:', error);
    }
    return request;
  },

  async onResponse({ response }: { response: Response }) {
    // 401 handling is done by the Proxy wrapper, not here
    // The Proxy can retry requests after successful token refresh
    return response;
  },
});

// Export the proxy wrapper instead of the raw client
// This provides transparent token refresh with retry logic
export { apiProxy as api };

// Export generated types for convenience
export type { paths, components, operations } from '../generated/api/types';
