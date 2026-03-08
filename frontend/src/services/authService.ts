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

class AuthService {
  private token: string | null = null;
  private storedRefreshToken: string | null = null;
  private user: User | null = null;
  private onAuthChanged?: () => void;

  constructor() {
    // Initialize from secure storage (async operation)
    this.initializeFromSecureStorage();
  }

  private async initializeFromSecureStorage(): Promise<void> {
    try {
      // Load from secure storage only
      this.token = await secureStorage.getItem('authToken');
      this.storedRefreshToken = await secureStorage.getItem('refreshToken');
      const userData = await secureStorage.getItem('userData');

      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          console.error('Failed to parse user data:', error);
          await this.clearAuth();
          return;
        }
      }

      // Notify auth context that tokens are loaded
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }
    } catch (error) {
      console.error('Failed to initialize from secure storage:', error);
      // No fallback - secure storage is required for security
      this.token = null;
      this.storedRefreshToken = null;
      this.user = null;

      // Still notify to update loading state
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }
    }
  }

  async requestMagicLink(email: string, context?: { name?: string; inviteCode?: string; [key: string]: unknown }): Promise<{ success: boolean; userExists?: boolean; message?: string }> {
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
        ...context
      };
      console.log('🔍 DEBUG: Frontend authService sending request body:', JSON.stringify({ ...requestBody, code_challenge: '[REDACTED]' }, null, 2));

      const { data, error } = await api.POST('/api/v1/auth/magic-link', {
        body: requestBody,
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error('Failed to send magic link');
      }

      return {
        success: true,
        userExists: data.data?.userExists,
        message: data.data?.message
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
        ...(inviteCode && { inviteCode }) // Add inviteCode to body only if provided
      };

      const { data, error } = await api.POST('/api/v1/auth/verify', {
        body: requestBody,
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        throw new Error('Failed to verify magic link');
      }

      const authData = data.data;
      await this.setAuth(authData.accessToken, authData.user, authData.refreshToken);

      // Clear PKCE data after successful authentication
      await clearPKCEData();
      console.log('✅ Magic link verified successfully with PKCE');

      // Include invitation result in the response (convert null to undefined)
      return {
        ...authData,
        invitationResult: authData.invitationResult ?? undefined
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
    if (!this.storedRefreshToken) {
      console.warn('🔄 Refresh token not in memory, checking secure storage...');
      // Try to fetch from secure storage as fallback
      try {
        this.storedRefreshToken = await secureStorage.getItem('refreshToken');
        if (!this.storedRefreshToken) {
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
      if (this.storedRefreshToken) {
        console.log('🔄 Refreshing token...');
      } else {
        console.warn('🔄 No refresh token available');
      }

      // Mark API as connecting
      useConnectionStore.getState().setApiStatus('connecting');

      const { data, error } = await api.POST('/api/v1/auth/refresh', {
        body: {
          refreshToken: this.storedRefreshToken as string
        },
      });

      // Mark API as connected
      useConnectionStore.getState().setApiStatus('connected');

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        throw new Error('Failed to refresh token');
      }

      // Update both access token and refresh token (token rotation)
      this.token = data.data.accessToken;
      this.storedRefreshToken = data.data.refreshToken;

      // Store securely only
      try {
        await secureStorage.setItem('authToken', this.token as string);
        await secureStorage.setItem('refreshToken', this.storedRefreshToken as string);
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
      this.storedRefreshToken = refreshToken;
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
        console.log('✅ DEBUG: Stored refresh token in memory and secure storage');
      }
    } catch (error) {
      console.error('Failed to store auth data securely:', error);
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
    this.token = null;
    this.storedRefreshToken = null;
    this.user = null;

    try {
      // Clear from secure storage only
      secureStorage.removeItem('authToken');
      secureStorage.removeItem('refreshToken');
      secureStorage.removeItem('userData');
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
      // Continue even if secure storage fails
    }

    // Clear PKCE data on auth clear to prevent security issues
    try {
      import('../utils/pkceUtils').then(async ({ clearPKCEData }) => {
        await clearPKCEData();
      }).catch(error => {
        console.error('Failed to clear PKCE data during auth clear:', error);
      });
    } catch (error) {
      console.error('Failed to import PKCE utilities during auth clear:', error);
    }

    // Notify auth context of change
    if (this.onAuthChanged) {
      this.onAuthChanged();
    }
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

  // Method to refresh token from secure storage (useful for E2E tests)
  async refreshTokenFromStorage(): Promise<void> {
    try {
      this.token = await secureStorage.getItem('authToken');
      const userData = await secureStorage.getItem('userData');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }
    } catch (error) {
      console.error('Failed to refresh token from secure storage:', error);
      // No fallback - secure storage is required
      this.token = null;
      this.user = null;
    }
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
        timezone: userData.timezone ?? undefined
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
        throw new Error('Failed to update profile');
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
        throw new Error('Failed to update timezone');
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
