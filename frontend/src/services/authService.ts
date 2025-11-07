import axios from 'axios';
import { useConnectionStore } from '@/stores/connectionStore';
import type { ApiResponse } from '@/types';
import { secureStorage } from '@/utils/secureStorage';

import { API_BASE_URL } from '@/config/runtime';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone?: string; // User's preferred timezone (e.g., "America/New_York", "Asia/Tokyo")
}

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
  private interceptorsSetup = false;
  private onAuthChanged?: () => void;

  constructor() {
    // Initialize from secure storage (async operation)
    this.initializeFromSecureStorage();

    // Set up axios interceptors
    this.setupAxiosInterceptors();
  }

  private async initializeFromSecureStorage(): Promise<void> {
    try {
      // Load from secure storage
      this.token = await secureStorage.getItem('authToken');
      this.storedRefreshToken = await secureStorage.getItem('refreshToken');
      const userData = await secureStorage.getItem('userData');

      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (error) {
          console.error('Failed to parse user data:', error);
          await this.clearAuth();
        }
      }
    } catch (error) {
      console.error('Failed to initialize from secure storage:', error);
      // Fallback to localStorage for migration
      this.token = localStorage.getItem('authToken');
      this.storedRefreshToken = localStorage.getItem('refreshToken');
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
          // Migrate to secure storage
          if (this.token && this.user) {
            await this.setAuth(this.token, this.user, this.storedRefreshToken || undefined);
          }
        } catch (parseError) {
          console.error('Failed to parse user data:', parseError);
          await this.clearAuth();
        }
      }
    }
  }

  private setupAxiosInterceptors() {
    // Prevent setting up interceptors multiple times
    if (this.interceptorsSetup) return;
    this.interceptorsSetup = true;

    // Request interceptor to add auth header
    axios.interceptors.request.use(
      (config) => {
        // Use token from memory (synchronously) - secureStorage is async so we rely on the cached token
        const currentToken = this.token;
        if (currentToken && config.url?.startsWith(API_BASE_URL)) {
          config.headers.Authorization = `Bearer ${currentToken}`;
        }
        
        // Mark API as connecting when making a request
        if (config.url?.startsWith(API_BASE_URL)) {
          useConnectionStore.getState().setApiStatus('connecting');
        }
        
        return config;
      },
      (error) => {
        // Request setup error (very rare)
        useConnectionStore.getState().setApiStatus('error', 'Failed to send request');
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => {
        // Mark API as connected on successful response
        if (response.config.url?.startsWith(API_BASE_URL)) {
          useConnectionStore.getState().setApiStatus('connected');
        }
        return response;
      },
      async (error) => {
        // Handle different types of errors
        if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
          // Backend is not running or network is down
          useConnectionStore.getState().setApiStatus('error', 'Cannot connect to server. Please ensure the backend is running.');
          return Promise.reject(error);
        }
        
        if (error.code === 'ETIMEDOUT') {
          // Request timeout
          useConnectionStore.getState().setApiStatus('error', 'Request timed out. Please check your connection.');
          return Promise.reject(error);
        }
        
        // For successful connection but error response, mark as connected
        if (error.response && error.config?.url?.startsWith(API_BASE_URL)) {
          useConnectionStore.getState().setApiStatus('connected');
        }
        
        if (error.response?.status === 401) {
          console.log('🔒 401 Unauthorized detected - redirecting to login');
          
          // Check if this is a refresh token request that failed
          if (error.config?.url?.includes('/auth/refresh')) {
            console.log('🚫 Refresh token request failed with 401 - logging out');
            this.clearAuth(); // Fire and forget - async but we don't await in interceptor
            this.redirectToLogin();
            return Promise.resolve();
          }
          
          if (this.token && !this.isRefreshInProgress) {
            // User has a token but got 401 - try to refresh
            try {
              await this.refreshToken();
              // Retry the original request
              return axios.request(error.config);
            } catch {
              // Refresh failed, logout user and redirect
              console.log('🔄 Token refresh failed - logging out');
              this.clearAuth(); // Fire and forget - async but we don't await in interceptor
              this.redirectToLogin();
              // Return a resolved promise to prevent further error handling
              return Promise.resolve();
            }
          } else {
            // User has no token or refresh is already in progress - redirect to login
            console.log('🚫 No token found or refresh in progress - redirecting to login');
            this.redirectToLogin();
            // Return a resolved promise to prevent further error handling
            return Promise.resolve();
          }
        }
        
        return Promise.reject(error);
      }
    );
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

      const requestBody = {
        email,
        name: context?.name,
        inviteCode: context?.inviteCode,
        code_challenge: codeChallenge, // Add PKCE challenge
        ...context
      };
      console.log('🔍 DEBUG: Frontend authService sending request body:', JSON.stringify({ ...requestBody, code_challenge: '[REDACTED]' }, null, 2));
      
      const response = await axios.post<ApiResponse<{ userExists?: boolean; message?: string }>>(`${API_BASE_URL}/auth/magic-link`, requestBody);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send magic link');
      }

      const data = response.data.data as { userExists?: boolean; message?: string } | undefined;
      return { 
        success: true,
        userExists: data?.userExists,
        message: data?.message
      };
    } catch (error) {
      // Clear PKCE data on error to prevent security issues
      try {
        const { clearPKCEData } = await import('../utils/pkceUtils');
        clearPKCEData();
      } catch (clearError) {
        console.error('Failed to clear PKCE data after error:', clearError);
      }

      // Handle specific network and API errors with user-friendly messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        }
        if (error.response?.status === 404) {
          throw new Error('Service temporarily unavailable. Please try again in a few moments.');
        }
        if (error.response?.status === 422) {
          // Validation error - pass through the server message for name field display
          throw new Error(error.response.data.error || 'Validation failed');
        }
        if (error.response?.status === 500) {
          throw new Error('Server error occurred. Please try again later.');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
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
      if (!hasPKCEData()) {
        throw new Error('This magic link must be opened in the same browser/app where it was requested. Please return to your original browser/app and click the link again, or request a new magic link.');
      }

      // Retrieve the code verifier for this authentication attempt
      const codeVerifier = getPKCEVerifier();
      if (!codeVerifier) {
        throw new Error('Authentication security data not found. Please open this link in the same browser/app where you requested it, or request a new magic link.');
      }

      const url = `${API_BASE_URL}/auth/verify${inviteCode ? `?inviteCode=${encodeURIComponent(inviteCode)}` : ''}`;
      const response = await axios.post<ApiResponse<AuthResponse>>(url, {
        token,
        code_verifier: codeVerifier // Add PKCE verifier
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to verify magic link');
      }

      const authData = response.data.data;
      await this.setAuth(authData.token, authData.user, authData.refreshToken);

      // Clear PKCE data after successful authentication
      clearPKCEData();
      console.log('✅ Magic link verified successfully with PKCE');
      
      // Include invitation result in the response
      return {
        ...authData,
        invitationResult: authData.invitationResult
      };
    } catch (error) {
      // Clear PKCE data on error to prevent reuse
      try {
        const { clearPKCEData } = await import('../utils/pkceUtils');
        clearPKCEData();
      } catch (clearError) {
        console.error('Failed to clear PKCE data after verification error:', clearError);
      }

      // Handle specific network and API errors with user-friendly messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }
        
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
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
      throw new Error('No refresh token available');
    }

    // Prevent concurrent refresh attempts
    if (this.isRefreshInProgress) {
      throw new Error('Refresh already in progress');
    }

    this.isRefreshInProgress = true;

    try {
      const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string; expiresIn: number; tokenType: string }>>(
        `${API_BASE_URL}/auth/refresh`,
        {
          refreshToken: this.storedRefreshToken
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to refresh token');
      }

      // Update both access token and refresh token (token rotation)
      this.token = response.data.data.accessToken;
      this.storedRefreshToken = response.data.data.refreshToken;

      // Store securely
      try {
        await secureStorage.setItem('authToken', this.token);
        await secureStorage.setItem('refreshToken', this.storedRefreshToken);
        // Also clear from localStorage for migration
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
      } catch (error) {
        console.error('Failed to store refreshed tokens securely, falling back to localStorage:', error);
        // Fallback to localStorage
        localStorage.setItem('authToken', this.token);
        localStorage.setItem('refreshToken', this.storedRefreshToken);
      }

      console.log('✅ Token refreshed successfully');
    } finally {
      this.isRefreshInProgress = false;
    }
  }

  async logout(): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`);
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

    try {
      // Store in secure storage
      await secureStorage.setItem('authToken', token);
      await secureStorage.setItem('userData', JSON.stringify(user));

      // Store refresh token if provided
      if (refreshToken) {
        this.storedRefreshToken = refreshToken;
        await secureStorage.setItem('refreshToken', refreshToken);
      }

      // Also clear from localStorage for migration
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('refreshToken');
    } catch (error) {
      console.error('Failed to store auth data securely, falling back to localStorage:', error);
      // Fallback to localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(user));

      if (refreshToken) {
        this.storedRefreshToken = refreshToken;
        localStorage.setItem('refreshToken', refreshToken);
      }
    }
  }

  getRedirectAfterLogin(): string | null {
    return localStorage.getItem('redirectAfterLogin');
  }

  clearRedirectAfterLogin(): void {
    localStorage.removeItem('redirectAfterLogin');
  }

  private async clearAuth(): Promise<void> {
    this.token = null;
    this.storedRefreshToken = null;
    this.user = null;

    try {
      // Clear from secure storage
      secureStorage.removeItem('authToken');
      secureStorage.removeItem('refreshToken');
      secureStorage.removeItem('userData');

      // Also clear from localStorage for migration
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userData');
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
      // Still clear from localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userData');
    }

    // Clear PKCE data on auth clear to prevent security issues
    try {
      import('../utils/pkceUtils').then(({ clearPKCEData }) => {
        clearPKCEData();
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

  private redirectToLogin(): void {
    console.log('🚀 redirectToLogin() called');
    console.log('Current pathname:', window.location.pathname);
    
    // Store the current path to redirect back after login (if not already on login)
    if (window.location.pathname !== '/login') {
      const currentPath = window.location.pathname + window.location.search;
      console.log('Current path to store:', currentPath);
      
      if (currentPath !== '/' && currentPath !== '/login') {
        localStorage.setItem('redirectAfterLogin', currentPath);
        console.log(`📍 Storing redirect path: ${currentPath}`);
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
      // Fallback to localStorage
      this.token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (parseError) {
          console.error('Failed to parse user data:', parseError);
        }
      }
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
      const response = await axios.put<ApiResponse<User>>(
        `${API_BASE_URL}/auth/profile`,
        userData,
        {
          headers: { Authorization: `Bearer ${this.token}` }
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update profile');
      }

      const updatedUser = response.data.data;
      await this.setAuth(this.token, updatedUser);

      return updatedUser;
    } catch (error) {
      // Handle specific network and API errors with user-friendly messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }

        if (error.response?.status === 401) {
          throw new Error('You are not authorized to update this profile. Please log in again.');
        }

        // Pass through the error response for better error handling in components
        if (error.response?.status === 400 || error.response?.data) {
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
      const response = await axios.patch<ApiResponse<User>>(
        `${API_BASE_URL}/auth/timezone`,
        { timezone },
        {
          headers: { Authorization: `Bearer ${this.token}` }
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update timezone');
      }

      const updatedUser = response.data.data;
      await this.setAuth(this.token, updatedUser);

      // Notify auth context of change
      if (this.onAuthChanged) {
        this.onAuthChanged();
      }

      return updatedUser;
    } catch (error) {
      // Handle specific network and API errors with user-friendly messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }

        if (error.response?.status === 401) {
          throw new Error('You are not authorized to update timezone. Please log in again.');
        }

        if (error.response?.status === 400 && error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }

        // Pass through validation errors
        if (error.response?.data?.validationErrors) {
          const validationError = error.response.data.validationErrors
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