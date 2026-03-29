import { useConnectionStore } from '@/stores/connectionStore';
import type { User } from '@/types/api';
import { secureStorage } from '../utils/secureStorage';
import { api } from './api';

// Re-export User type for convenience
export type { User };

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
  invitationResult?: {
    processed: boolean;
    invitationType?: 'FAMILY' | 'GROUP';
    familyId?: string;
    redirectUrl?: string;
    requiresFamilyOnboarding?: boolean;
    reason?: string;
  };
}

/**
 * AuthService - Authentication Service
 *
 * SINGLE SOURCE OF TRUTH for authentication state.
 *
 * Architecture:
 * - authService.token: Authoritative source (in-memory)
 * - secureStorage: Persistence layer only (for page reloads)
 *
 * All token reads MUST go through authService.getToken()
 * API middleware uses authService, not secureStorage directly
 *
 * Initialization:
 * - Constructor starts async initialization from secureStorage
 * - Use ensureInitialized() before any operation that requires the token
 * - setAuth() marks initialization as complete (handles manual login)
 */
class AuthService {
  // SINGLE SOURCE OF TRUTH for authentication state
  private token: string | null = null;
  private _refreshToken: string | null = null;  // Prefix to avoid conflict with refreshToken() method
  private user: User | null = null;
  private onAuthChanged?: () => void;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize from secure storage and track the promise
    this.initializationPromise = this.initializeFromSecureStorage();
  }

  /**
   * Ensure authentication is initialized before proceeding.
   * Components should call this before making authenticated API calls.
   *
   * This method waits for the async initialization from secureStorage to complete.
   * Once initialization is done, subsequent calls return immediately.
   *
   * @param timeoutMs - Maximum time to wait for initialization (default: 5000ms)
   */
  async ensureInitialized(timeoutMs: number = 5000): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    if (this.initializationPromise) {
      // Add timeout protection to prevent indefinite waiting
      await Promise.race([
        this.initializationPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth initialization timeout')), timeoutMs),
        ),
      ]);
    }
    // Note: isInitialized is set by initializeFromSecureStorage() or setAuth()
    // We don't set it here to avoid marking as initialized before the actual init completes
  }

  /**
   * Check if authentication has been initialized.
   * Useful for synchronous checks (e.g., rendering conditions).
   */
  ready(): boolean {
    return this.isInitialized;
  }

  private async initializeFromSecureStorage(): Promise<void> {
    try {
      // Load from secure storage only
      this.token = await secureStorage.getItem('authToken');
      this._refreshToken = await secureStorage.getItem('refreshToken');
      const userData = await secureStorage.getItem('userData');

      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          console.error('Failed to parse user data:', error);
          await this.clearAuth();
          this.isInitialized = true;
          return;
        }
      }

      // Mark initialization as complete
      this.isInitialized = true;

      // Notify auth context that tokens are loaded
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }
    } catch (error) {
      console.error('Failed to initialize from secure storage:', error);
      // No fallback - secure storage is required for security
      this.token = null;
      this._refreshToken = null;
      this.user = null;

      // Mark initialization as complete (even if failed)
      this.isInitialized = true;

      // Still notify to update loading state
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }
    }
  }

  async requestMagicLink(email: string, context?: { name?: string; inviteCode?: string;[key: string]: unknown }): Promise<{ success: boolean; userExists?: boolean; message?: string }> {
    try {
      // Import PKCE utilities
      const { generateAndStorePKCEPair, isPKCESupported, PKCEError } = await import('../utils/pkceUtils');

      // Check browser PKCE support
      if (!isPKCESupported()) {
        throw new Error('Your browser does not support the required security features for authentication. Please use a modern browser.');
      }

      // Generate and store PKCE pair for this authentication attempt
      let codeChallenge: string;
      try {
        const pkcePair = await generateAndStorePKCEPair(email);
        codeChallenge = pkcePair.code_challenge;
        console.log('🔐 Generated PKCE challenge for magic link request');
      } catch (error) {
        if (error instanceof PKCEError) {
          throw new Error(`Security setup failed: ${error.message}`);
        }
        throw new Error('Failed to initialize secure authentication. Please try again.');
      }

      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      const requestBody = {
        email,
        name: context?.name,
        inviteCode: context?.inviteCode,
        code_challenge: codeChallenge, // Add PKCE challenge
        ...context,
      };

      // Make the API call using OpenAPI client
      const { data, error } = await api.POST('/api/v1/auth/magic-link', {
        body: requestBody,
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      // Handle error responses from openapi-fetch
      if (error) {
        // Handle different error structures:
        // 1. Direct error: { success: false, error: "message", code: "VALIDATION_ERROR" }
        // 2. Nested response error: { response: { status: 422, data: { error: "message" } } }
        let errorMessage = 'Failed to send magic link. Please try again.';

        const errorData = error as { success?: boolean; error?: string; code?: string; response?: { data?: { error?: string } } };

        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.response?.data?.error) {
          errorMessage = errorData.response.data.error;
        }

        throw new Error(errorMessage);
      }

      // Handle backend returning success: false
      if (!data?.success) {
        const responseData = data as { success: boolean; data?: { message: string; userExists: boolean }; error?: string } | undefined;
        throw new Error(responseData?.error || 'Failed to send magic link');
      }

      return {
        success: true,
        userExists: data.data?.userExists,
        message: data.data?.message,
      };
    } catch (error) {
      // Mark API as connected (we got a response)
      useConnectionStore.getState().setApiStatus('connected');

      // Clear PKCE data on error to prevent security issues
      try {
        const { clearPKCEData } = await import('../utils/pkceUtils');
        await clearPKCEData();
      } catch (clearError) {
        console.error('Failed to clear PKCE data after error:', clearError);
      }

      // Handle API errors
      if (error && typeof error === 'object') {
        const err = error as { code?: string; message?: string; response?: { data?: { error?: string }; status?: number } };

        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        if (err.response?.status === 404) {
          throw new Error('Service temporarily unavailable. Please try again in a few moments.');
        }
        if (err.response?.status === 422) {
          throw new Error(err.response.data?.error || 'Validation failed');
        }
        if (err.response?.status === 500) {
          throw new Error('Server error occurred. Please try again later.');
        }
        if (err.response?.data?.error) {
          throw new Error(err.response.data.error);
        }
      }

      // Re-throw the original error if it's already a custom error
      if (error instanceof Error) {
        throw error;
      }

      // Fallback error message
      throw new Error('Failed to send magic link. Please try again.');
    }
  }

  async verifyMagicLink(token: string, inviteCode?: string): Promise<AuthResponse> {
    try {
      // Import PKCE utilities
      const { getPKCEVerifier, clearPKCEData, hasPKCEData } = await import('../utils/pkceUtils');

      // Check if we have PKCE data
      if (!(await hasPKCEData())) {
        throw new Error('This magic link must be opened in the same browser/app where it was requested. Please return to your original browser/app and click the link again, or request a new magic link.');
      }

      // Retrieve the code verifier for this authentication attempt
      const codeVerifier = await getPKCEVerifier();
      if (!codeVerifier) {
        throw new Error('Authentication security data not found. Please open this link in the same browser/app where you requested it, or request a new magic link.');
      }

      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      // Send everything in the body (clean REST design)
      const requestBody = {
        token,
        code_verifier: codeVerifier, // Add PKCE verifier
        ...(inviteCode && { inviteCode }), // Add inviteCode to body only if provided
      };

      // Use OpenAPI client for verification
      const { data, error } = await api.POST('/api/v1/auth/verify', {
        body: requestBody,
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        // Handle different error structures (same as magic-link endpoint)
        let errorMessage = 'Failed to verify magic link. Please try again.';

        const errorData = error as { success?: boolean; error?: string; code?: string; response?: { data?: { error?: string } } };

        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.response?.data?.error) {
          errorMessage = errorData.response.data.error;
        }

        throw new Error(errorMessage);
      }

      if (!data?.success || !data?.data) {
        const responseData = data as { success: boolean; data?: unknown; error?: string } | undefined;
        throw new Error(responseData?.error || 'Failed to verify magic link');
      }

      const authData = data.data;
      await this.setAuth(authData.accessToken, authData.user, authData.refreshToken);

      // Clear PKCE data after successful authentication
      await clearPKCEData();

      // Include invitation result in the response (convert null to undefined)
      return {
        user: authData.user,
        token: authData.accessToken,
        refreshToken: authData.refreshToken,
        expiresAt: authData.expiresAt || new Date(Date.now() + authData.expiresIn * 1000).toISOString(),
        invitationResult: authData.invitationResult ?? undefined,
      };
    } catch (error) {
      // Mark API as connected (we got a response)
      useConnectionStore.getState().setApiStatus('connected');

      // Clear PKCE data on error to prevent reuse
      try {
        const { clearPKCEData } = await import('../utils/pkceUtils');
        await clearPKCEData();
      } catch (clearError) {
        console.error('Failed to clear PKCE data after verification error:', clearError);
      }

      // Handle API errors
      if (error && typeof error === 'object') {
        const err = error as { code?: string; message?: string; response?: { data?: { error?: string } } };

        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }
        if (err.response?.data?.error) {
          throw new Error(err.response.data.error);
        }
      }

      // Re-throw the original error if it's already a custom error
      if (error instanceof Error) {
        throw error;
      }

      // Fallback error message
      throw new Error('Failed to verify magic link. Please try again.');
    }
  }

  private isRefreshInProgress = false;

  async refreshToken(): Promise<void> {
    if (!this._refreshToken) {
      console.warn('🔄 Refresh token not in memory, checking secure storage...');
      // Try to fetch from secure storage as fallback
      try {
        this._refreshToken = await secureStorage.getItem('refreshToken');
        if (!this._refreshToken) {
          throw new Error('No refresh token available');
        }
      } catch (error) {
        console.error('Failed to fetch refresh token from storage:', error);
        throw new Error('No refresh token available');
      }
    }

    // Prevent concurrent refresh attempts
    if (this.isRefreshInProgress) {
      throw new Error('Refresh already in progress');
    }

    this.isRefreshInProgress = true;

    try {
      // Send refresh token to backend
      if (this._refreshToken) {
        console.log('🔄 Refreshing token...');
      } else {
        console.warn('🔄 No refresh token available');
      }

      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      const { data, error } = await api.POST('/api/v1/auth/refresh', {
        body: {
          refreshToken: this._refreshToken as string,
        },
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        // Type assertion to access optional error property from backend
        const responseData = data as { success: boolean; data?: unknown; error?: string } | undefined;
        throw new Error(responseData?.error || 'Failed to refresh token');
      }

      // Update both access token and refresh token (token rotation)
      this.token = data.data.accessToken;
      this._refreshToken = data.data.refreshToken;

      // Store securely only
      try {
        await secureStorage.setItem('authToken', this.token as string);
        await secureStorage.setItem('refreshToken', this._refreshToken as string);
      } catch (error) {
        console.error('Failed to store refreshed tokens securely:', error);
        throw new Error('Secure storage required for authentication');
      }

      console.log('✅ Token refreshed successfully');
    } finally {
      this.isRefreshInProgress = false;
    }
  }

  async logout(): Promise<void> {
    try {
      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      const { error } = await api.POST('/api/v1/auth/logout');

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        console.error('Logout request failed:', error);
      }
    } catch (error) {
      // Continue with logout even if server request fails
      console.error('Logout request failed:', error);
    } finally {
      await this.clearAuth();
    }
  }

  private async setAuth(token: string, user: User, refreshToken?: string): Promise<void> {
    this.token = token;
    this.user = user;

    // Store refresh token in memory if provided
    if (refreshToken) {
      this._refreshToken = refreshToken;
    }

    // Authentication successful
    console.log('✅ Authentication successful');

    try {
      // Store in secure storage only
      await secureStorage.setItem('authToken', token);
      await secureStorage.setItem('userData', JSON.stringify(user));

      // Store refresh token if provided
      if (refreshToken) {
        await secureStorage.setItem('refreshToken', refreshToken);
      }

      // Mark initialization as complete since token is now in secureStorage
      // This prevents race conditions where initialization tries to overwrite
      this.isInitialized = true;

      // Notify listeners (AuthContext) that auth state has changed
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }
    } catch (error) {
      console.error('Failed to store auth data securely:', error);
      // Rollback memory state on storage failure
      this.token = null;
      this.user = null;
      this._refreshToken = null;
      throw new Error('Secure storage required for authentication');
    }
  }

  getRedirectAfterLogin(): string | null {
    try {
      return sessionStorage.getItem('redirectAfterLogin');
    } catch (error) {
      console.error('Failed to get redirect URL:', error);
      return null;
    }
  }

  clearRedirectAfterLogin(): void {
    try {
      sessionStorage.removeItem('redirectAfterLogin');
    } catch (error) {
      console.error('Failed to clear redirect URL:', error);
    }
  }

  private async clearAuth(): Promise<void> {
    // First, clear all in-memory state immediately
    // This ensures that even if storage operations fail, we're logged out
    this.user = null;
    this.token = null;
    this._refreshToken = null;

    // Notify auth context IMMEDIATELY after clearing in-memory state
    // This is critical to prevent race conditions where the UI still thinks user is logged in
    if (this.onAuthChanged) {
      this.onAuthChanged();
    }

    // Then clear persistent storage (fire and forget - don't await)
    // These operations can happen in the background
    try {
      secureStorage.removeItem('authToken');
      secureStorage.removeItem('refreshToken');
      secureStorage.removeItem('userData');
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }

    // Clear PKCE data asynchronously (don't block on this)
    try {
      import('../utils/pkceUtils').then(async ({ clearPKCEData }) => {
        await clearPKCEData();
      }).catch(error => {
        console.error('Failed to clear PKCE data during auth clear:', error);
      });
    } catch (error) {
      console.error('Failed to import PKCE utilities during auth clear:', error);
    }
  }

  /**
   * Synchronously clear authentication state (in-memory only).
   * Use this when you need to immediately update UI state before async operations.
   * Storage clearing happens asynchronously in the background.
   */
  clearAuthState(): void {
    // Clear in-memory state IMMEDIATELY
    this.user = null;
    this.token = null;
    this._refreshToken = null;

    // Notify auth context IMMEDIATELY
    if (this.onAuthChanged) {
      this.onAuthChanged();
    }

    // Clear storage in background (fire and forget)
    this.clearAuth().catch(error => {
      console.error('Background storage clear failed:', error);
    });
  }

  setAuthChangeCallback(callback: () => void): void {
    this.onAuthChanged = callback;
  }

  redirectToLogin(): void {
    console.log('🚀 redirectToLogin() called');
    console.log('Current pathname:', window.location.pathname);

    // Store the current path to redirect back after login (if not already on login)
    if (window.location.pathname !== '/login') {
      const currentPath = window.location.pathname + window.location.search;
      console.log('Current path to store:', currentPath);

      if (currentPath !== '/' && currentPath !== '/login') {
        try {
          sessionStorage.setItem('redirectAfterLogin', currentPath);
          console.log(`📍 Storing redirect path: ${currentPath}`);
        } catch (error) {
          console.error('Failed to store redirect path:', error);
        }
      }
    }

    // Clear auth data - this will trigger the AuthContext callback
    // which will update React state and cause ProtectedRoute to redirect
    console.log('🔀 Clearing auth - React Router will handle redirect');
    this.clearAuth(); // Fire and forget - async but we don't await in redirect method
  }

  isAuthenticated(): boolean {
    return !!(this.token && this.user);
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  // Check if token is expired (basic check - in production, decode JWT)
  isTokenExpired(): boolean {
    if (!this.token) return true;

    try {
      // Simple check - in production, properly decode and check JWT expiration
      const tokenData = JSON.parse(atob(this.token.split('.')[1]));
      const now = Date.now() / 1000;
      return tokenData.exp < now;
    } catch {
      return true;
    }
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    if (!this.token) {
      throw new Error('No authentication token found');
    }

    try {
      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      // Convert null values to undefined for API request
      const sanitizedData = {
        ...userData,
        timezone: userData.timezone ?? undefined,
      };

      const { data, error } = await api.PUT('/api/v1/auth/profile', {
        body: sanitizedData,
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        // Type assertion to access optional error property from backend
        const responseData = data as { success: boolean; data?: unknown; error?: string } | undefined;
        throw new Error(responseData?.error || 'Failed to update profile');
      }

      const updatedUser = data.data;
      await this.setAuth(this.token, updatedUser);

      return updatedUser;
    } catch (error) {
      // Mark API as connected (we got a response)
      useConnectionStore.getState().setApiStatus('connected');

      // Handle API errors
      if (error && typeof error === 'object') {
        const err = error as { code?: string; message?: string; response?: { data?: { error?: string }; status?: number } };

        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }
        if (err.response?.status === 401) {
          throw new Error('You are not authorized to update this profile. Please log in again.');
        }
        if (err.response?.status === 400 || err.response?.data) {
          throw error;
        }
      }

      // Re-throw the original error if it's already a custom error
      if (error instanceof Error) {
        throw error;
      }

      // Fallback error message
      throw new Error('Failed to update profile. Please try again.');
    }
  }

  async updateTimezone(timezone: string): Promise<User> {
    if (!this.token) {
      throw new Error('No authentication token found');
    }

    try {
      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      const { data, error } = await api.PATCH('/api/v1/auth/profile/timezone', {
        body: { timezone },
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        // Type assertion to access optional error property from backend
        const responseData = data as { success: boolean; data?: unknown; error?: string } | undefined;
        throw new Error(responseData?.error || 'Failed to update timezone');
      }

      const updatedUser = data.data;
      await this.setAuth(this.token, updatedUser);

      // Notify auth context of change
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }

      return updatedUser;
    } catch (error) {
      // Mark API as connected (we got a response)
      useConnectionStore.getState().setApiStatus('connected');

      // Handle API errors
      if (error && typeof error === 'object') {
        const err = error as { code?: string; message?: string; response?: { data?: { error?: string; validationErrors?: Array<{ message: string }> }; status?: number } };

        if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }
        if (err.response?.status === 401) {
          throw new Error('You are not authorized to update timezone. Please log in again.');
        }
        if (err.response?.status === 400 && err.response?.data?.error) {
          throw new Error(err.response.data.error);
        }
        if (err.response?.data?.validationErrors) {
          const validationError = err.response.data.validationErrors
            .map((ve: { message: string }) => ve.message)
            .join(', ');
          throw new Error(validationError);
        }
      }

      // Re-throw the original error if it's already a custom error
      if (error instanceof Error) {
        throw error;
      }

      // Fallback error message
      throw new Error('Failed to update timezone. Please try again.');
    }
  }
}

export const authService = new AuthService();
