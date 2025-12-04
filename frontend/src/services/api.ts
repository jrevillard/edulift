/**
 * OpenAPI-based API Client
 *
 * Replaces the 990-line apiService.ts with ~20 lines using openapi-fetch
 * and generated types for maximum type safety and performance.
 */

import createClient from 'openapi-fetch';
import type { paths } from '../generated/api/types';
import { API_BASE_URL } from '../config/runtime';
import { secureStorage } from '../utils/secureStorage';

// Create the typed API client
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
      // Check for global test flag that should be set in test setup
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

// Export the configured API client
export const api = client;

// Export types for convenience
export type ApiPaths = paths;
export type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: { status: number; message: string } };