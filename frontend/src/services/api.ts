/**
 * Pure OpenAPI Client - Direct openapi-fetch with Generated Types
 *
 * This is the purest approach: no manual wrappers, no duplicate type definitions.
 * Just the raw openapi-fetch client with full type safety from generated types.
 *
 * Usage:
 *   import { api } from '@/services/api';
 *   await api.GET('/children', {});  // Full type safety, auto-completion
 */

import createClient from 'openapi-fetch';
import type { paths } from '../generated/api/types';
import { API_BASE_URL } from '../config/runtime';
import { secureStorage } from '../utils/secureStorage';

// Create the typed API client with authentication middleware
const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication middleware
client.use({
  async onRequest({ request }) {
    try {
      const token = await secureStorage.getItem('authToken');
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.warn('Failed to retrieve auth token:', error);
    }
    return request;
  },

  async onResponse({ response }) {
    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.log('🔒 401 Unauthorized detected - clearing auth and redirecting');

      // Clear authentication data
      await secureStorage.removeItem('authToken');
      await secureStorage.removeItem('refreshToken');

      // Skip navigation in test environment to prevent JSDOM errors
      const isTestEnvironment = typeof window !== 'undefined' && (window as any).__TEST_ENVIRONMENT__;

      if (typeof window !== 'undefined' && !isTestEnvironment) {
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('redirectAfterLogin', currentPath);

        // Redirect to login
        window.location.href = '/login';
      }
    }
    return response;
  },
});

// Export the pure client - no wrappers, no aliases, just pure openapi-fetch
export { client as api };

// Export generated types for convenience
export type { paths, components, operations } from '../generated/api/types';