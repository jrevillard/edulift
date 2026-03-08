/**
 * Integration tests for AuthService PKCE functionality
 * Tests the complete PKCE flow from magic link request to verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authService } from '../authService';
import * as pkceUtils from '../../utils/pkceUtils';
import { mockClient } from './setup';

// Mock PKCE utilities
vi.mock('../../utils/pkceUtils');
const mockedPkceUtils = vi.mocked(pkceUtils);

describe('AuthService PKCE Integration', () => {
  const testEmail = 'test@example.com';
  const testToken = 'magic-link-token-123';
  const mockPkcePair = {
    code_verifier: 'test-verifier-123456789012345678901234567890',
    code_challenge: 'test-challenge-hash-xyz'
  };

  beforeEach(() => {
    // Clear localStorage and reset mocks
    localStorage.clear();
    vi.clearAllMocks();

    // Reset mockClient before each test
    mockClient.POST.mockReset();
    mockClient.GET.mockReset();

    // Mock successful PKCE support by default
    mockedPkceUtils.isPKCESupported.mockReturnValue(true);
    mockedPkceUtils.generateAndStorePKCEPair.mockResolvedValue(mockPkcePair);
    mockedPkceUtils.hasPKCEData.mockReturnValue(true);
    mockedPkceUtils.getPKCEVerifier.mockReturnValue(mockPkcePair.code_verifier);
    mockedPkceUtils.clearPKCEData.mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('requestMagicLink with PKCE', () => {
    it('should generate PKCE pair and include challenge in request', async () => {
      // Mock successful API response
      mockClient.POST.mockResolvedValue({
        data: { success: true, data: { userExists: true } },
        error: null
      });

      await authService.requestMagicLink(testEmail);

      // Verify PKCE support was checked
      expect(mockedPkceUtils.isPKCESupported).toHaveBeenCalled();

      // Verify PKCE pair was generated and stored
      expect(mockedPkceUtils.generateAndStorePKCEPair).toHaveBeenCalledWith(testEmail);

      // Verify API was called with PKCE challenge
      expect(mockClient.POST).toHaveBeenCalledWith(
        '/api/v1/auth/magic-link',
        expect.objectContaining({
          body: expect.objectContaining({
            email: testEmail,
            code_challenge: mockPkcePair.code_challenge
          })
        })
      );
    });

    it('should include context data along with PKCE challenge', async () => {
      const context = {
        name: 'John Doe',
        inviteCode: 'invite-123',
        customField: 'custom-value'
      };

      mockClient.POST.mockResolvedValue({
        data: { success: true, data: { userExists: false } },
        error: null
      });

      await authService.requestMagicLink(testEmail, context);

      expect(mockClient.POST).toHaveBeenCalledWith(
        '/api/v1/auth/magic-link',
        expect.objectContaining({
          body: expect.objectContaining({
            email: testEmail,
            name: context.name,
            inviteCode: context.inviteCode,
            code_challenge: mockPkcePair.code_challenge
          })
        })
      );
    });

    it('should throw error when PKCE is not supported', async () => {
      mockedPkceUtils.isPKCESupported.mockReturnValue(false);

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow(
        'Your browser does not support the required security features for authentication'
      );

      // Verify no API call was made
      expect(mockClient.POST).not.toHaveBeenCalled();
    });

    it('should handle PKCE generation failure', async () => {
      // Create a proper PKCEError mock that will pass instanceof check
      const pkceError = {
        name: 'PKCEError',
        message: 'Crypto API failed',
        code: 'CRYPTO_ERROR'
      };
      Object.setPrototypeOf(pkceError, pkceUtils.PKCEError.prototype);
      mockedPkceUtils.generateAndStorePKCEPair.mockRejectedValue(pkceError);

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow(
        'Security setup failed: Crypto API failed'
      );

      // Verify PKCE data was cleared
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('verifyMagicLink with PKCE', () => {
    const mockAuthResponse = {
      user: {
        id: 'user-123',
        email: testEmail,
        name: 'Test User',
        timezone: 'UTC',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    beforeEach(() => {
      // Setup secureStorage mock for verifyMagicLink
      const secureStorage = require('@/utils/secureStorage').secureStorage;
      secureStorage.setItem.mockResolvedValue(undefined);
      secureStorage.getItem.mockResolvedValue(null);
    });

    it('should verify magic link with PKCE verifier', async () => {
      mockClient.POST.mockResolvedValue({
        data: { success: true, data: mockAuthResponse },
        error: null
      });

      const result = await authService.verifyMagicLink(testToken);

      // Verify PKCE data was checked
      expect(mockedPkceUtils.hasPKCEData).toHaveBeenCalled();
      expect(mockedPkceUtils.getPKCEVerifier).toHaveBeenCalled();

      // Verify API was called with token and verifier
      expect(mockClient.POST).toHaveBeenCalledWith(
        '/api/v1/auth/verify',
        expect.objectContaining({
          body: expect.objectContaining({
            token: testToken,
            code_verifier: mockPkcePair.code_verifier
          })
        })
      );

      // Verify PKCE data was cleared after successful verification
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();

      // Verify auth data was set
      expect(result.user).toEqual(mockAuthResponse.user);
    });

    it('should throw error when PKCE data is missing', async () => {
      mockedPkceUtils.hasPKCEData.mockReturnValue(false);

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow(
        'This magic link must be opened in the same browser/app where it was requested'
      );

      // Verify no API call was made
      expect(mockClient.POST).not.toHaveBeenCalled();
    });

    it('should clear PKCE data on verification error', async () => {
      mockClient.POST.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow();

      // Verify PKCE data was cleared even on error
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('PKCE data cleanup on auth events', () => {
    it('should clear PKCE data on logout', async () => {
      // Mock logout endpoint
      mockClient.POST.mockResolvedValue({
        data: { success: true },
        error: null
      });

      await authService.logout();

      // Give time for the async PKCE cleanup
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should clear PKCE data when auth is cleared', async () => {
      // Simulate auth clear by calling clearAuth through logout
      mockClient.POST.mockResolvedValue({
        data: { success: true },
        error: null
      });

      await authService.logout();

      // Wait for async PKCE cleanup in clearAuth
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('Error handling with PKCE', () => {
    it('should clear PKCE data on network error', async () => {
      mockClient.POST.mockResolvedValue({
        data: null,
        error: { code: 'ECONNREFUSED' }
      });

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow();

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should handle validation errors from backend', async () => {
      mockClient.POST.mockResolvedValue({
        data: null,
        error: {
          response: {
            status: 422,
            data: { error: 'Invalid email format' }
          }
        }
      });

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow('Validation failed');

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockClient.POST.mockResolvedValue({
        data: null,
        error: { message: 'API error' }
      });

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow();

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('Backend compatibility', () => {
    it('should send PKCE challenge in expected format', async () => {
      mockClient.POST.mockResolvedValue({
        data: { success: true, data: { userExists: true } },
        error: null
      });

      await authService.requestMagicLink(testEmail, { name: 'Test User' });

      // Verify the request body format matches backend expectations
      expect(mockClient.POST).toHaveBeenCalledWith(
        '/api/v1/auth/magic-link',
        expect.objectContaining({
          body: expect.objectContaining({
            email: testEmail,
            name: 'Test User',
            code_challenge: mockPkcePair.code_challenge
          })
        })
      );
    });

    it('should send verifier in expected format', async () => {
      const secureStorage = require('@/utils/secureStorage').secureStorage;
      secureStorage.setItem.mockResolvedValue(undefined);
      secureStorage.getItem.mockResolvedValue(null);

      mockClient.POST.mockResolvedValue({
        data: { success: true, data: mockAuthResponse },
        error: null
      });

      await authService.verifyMagicLink(testToken);

      expect(mockClient.POST).toHaveBeenCalledWith(
        '/api/v1/auth/verify',
        expect.objectContaining({
          body: expect.objectContaining({
            token: testToken,
            code_verifier: mockPkcePair.code_verifier
          })
        })
      );
    });
  });

  describe('Concurrent request handling', () => {
    it('should handle multiple simultaneous magic link requests', async () => {
      mockClient.POST.mockResolvedValue({
        data: { success: true, data: { userExists: true } },
        error: null
      });

      // Simulate multiple concurrent requests
      const requests = [
        authService.requestMagicLink('user1@example.com'),
        authService.requestMagicLink('user2@example.com'),
        authService.requestMagicLink('user3@example.com')
      ];

      await expect(Promise.all(requests)).resolves.toBeDefined();

      // Verify all requests were handled
      expect(mockClient.POST).toHaveBeenCalledTimes(3);
    });
  });
});
