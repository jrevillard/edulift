/**
 * Integration tests for AuthService PKCE functionality
 * Tests the complete PKCE flow from magic link request to verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { authService } from '../authService';
import * as pkceUtils from '../../utils/pkceUtils';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock axios.isAxiosError to properly identify axios errors
const isAxiosErrorSpy = vi.spyOn(axios, 'isAxiosError');

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

    // Mock successful PKCE support by default
    mockedPkceUtils.isPKCESupported.mockReturnValue(true);
    mockedPkceUtils.generateAndStorePKCEPair.mockResolvedValue(mockPkcePair);
    mockedPkceUtils.hasPKCEData.mockReturnValue(true);
    mockedPkceUtils.getPKCEVerifier.mockReturnValue(mockPkcePair.code_verifier);
    mockedPkceUtils.clearPKCEData.mockImplementation(() => {});
    
    // Reset axios.isAxiosError to return true for axios errors by default
    isAxiosErrorSpy.mockImplementation((payload) => {
      return payload && typeof payload === 'object' && payload.isAxiosError === true;
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('requestMagicLink with PKCE', () => {
    it('should generate PKCE pair and include challenge in request', async () => {
      // Mock successful API response
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { userExists: true } }
      });

      await authService.requestMagicLink(testEmail);

      // Verify PKCE support was checked
      expect(mockedPkceUtils.isPKCESupported).toHaveBeenCalled();

      // Verify PKCE pair was generated and stored
      expect(mockedPkceUtils.generateAndStorePKCEPair).toHaveBeenCalledWith(testEmail);

      // Verify API was called with PKCE challenge
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/magic-link'),
        expect.objectContaining({
          email: testEmail,
          code_challenge: mockPkcePair.code_challenge
        })
      );
    });

    it('should include context data along with PKCE challenge', async () => {
      const context = {
        name: 'John Doe',
        inviteCode: 'invite-123',
        customField: 'custom-value'
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { userExists: false } }
      });

      await authService.requestMagicLink(testEmail, context);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/magic-link'),
        expect.objectContaining({
          email: testEmail,
          name: context.name,
          inviteCode: context.inviteCode,
          customField: context.customField,
          code_challenge: mockPkcePair.code_challenge
        })
      );
    });

    it('should throw error when PKCE is not supported', async () => {
      mockedPkceUtils.isPKCESupported.mockReturnValue(false);

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow(
        'Your browser does not support the required security features for authentication'
      );

      // Verify no API call was made
      expect(mockedAxios.post).not.toHaveBeenCalled();
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

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should handle generic PKCE generation error', async () => {
      mockedPkceUtils.generateAndStorePKCEPair.mockRejectedValue(
        new Error('Random generation failed')
      );

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow(
        'Failed to initialize secure authentication. Please try again.'
      );

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should clear PKCE data on API error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow();

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should clear PKCE data on validation error', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 422, data: { error: 'Invalid email' } },
        isAxiosError: true,
        message: 'Request failed with status code 422',
        code: 'ERR_BAD_REQUEST'
      });

      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow('Invalid email');

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should not log sensitive PKCE data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { userExists: true } }
      });

      await authService.requestMagicLink(testEmail);

      // Check that code_challenge is redacted in logs
      const logCalls = consoleSpy.mock.calls;
      const debugLogCall = logCalls.find(call => 
        call.some(arg => typeof arg === 'string' && arg.includes('DEBUG: Frontend authService'))
      );

      if (debugLogCall) {
        const logMessage = debugLogCall.join(' ');
        expect(logMessage).toContain('[REDACTED]');
        expect(logMessage).not.toContain(mockPkcePair.code_challenge);
      }

      consoleSpy.mockRestore();
    });
  });

  describe('verifyMagicLink with PKCE', () => {
    const mockAuthResponse = {
      token: 'jwt-token-123',
      user: { id: '1', email: testEmail, name: 'Test User', timezone: 'UTC' }
    };

    it('should include PKCE verifier in verification request', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockAuthResponse }
      });

      await authService.verifyMagicLink(testToken);

      // Verify PKCE data was checked
      expect(mockedPkceUtils.hasPKCEData).toHaveBeenCalled();
      expect(mockedPkceUtils.getPKCEVerifier).toHaveBeenCalled();

      // Verify API was called with PKCE verifier
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verify'),
        expect.objectContaining({
          token: testToken,
          code_verifier: mockPkcePair.code_verifier
        })
      );

      // Verify PKCE data was cleared after success
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should include invite code in URL when provided', async () => {
      const inviteCode = 'invite-123';
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockAuthResponse }
      });

      await authService.verifyMagicLink(testToken, inviteCode);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/auth/verify?inviteCode=${encodeURIComponent(inviteCode)}`),
        expect.objectContaining({
          token: testToken,
          code_verifier: mockPkcePair.code_verifier
        })
      );
    });

    it('should throw error when no PKCE data exists', async () => {
      mockedPkceUtils.hasPKCEData.mockReturnValue(false);

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow(
        'This magic link must be opened in the same browser/app where it was requested'
      );

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw error when PKCE verifier is not found', async () => {
      mockedPkceUtils.hasPKCEData.mockReturnValue(true);
      mockedPkceUtils.getPKCEVerifier.mockReturnValue(null);

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow(
        'Authentication security data not found. Please open this link in the same browser/app where you requested it'
      );

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should clear PKCE data on verification error', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 400, data: { error: 'Invalid token' } },
        isAxiosError: true,
        message: 'Request failed with status code 400',
        code: 'ERR_BAD_REQUEST'
      });

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow('Invalid token');

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should clear PKCE data on network error', async () => {
      mockedAxios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Network Error',
        isAxiosError: true
      });

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow(
        'Unable to connect to the server. Please check your connection and try again.'
      );

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should return auth response with invitation result', async () => {
      const mockResponseWithInvitation = {
        ...mockAuthResponse,
        invitationResult: {
          processed: true,
          redirectUrl: '/dashboard'
        }
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockResponseWithInvitation }
      });

      const result = await authService.verifyMagicLink(testToken);

      expect(result).toEqual(mockResponseWithInvitation);
      expect(result.invitationResult).toBeDefined();
    });
  });

  describe('PKCE data cleanup on auth events', () => {
    it('should clear PKCE data on logout', async () => {
      // Mock logout endpoint
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await authService.logout();

      // Give time for the async PKCE cleanup
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });

    it('should clear PKCE data when auth is cleared', async () => {
      // Simulate auth clear by calling clearAuth through logout
      mockedAxios.post.mockResolvedValue({ data: { success: true } });
      
      await authService.logout();
      
      // Wait for async PKCE cleanup in clearAuth
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('Error handling and security', () => {
    it('should handle PKCE utils import failure gracefully', async () => {
      // Mock dynamic import failure
      const originalImport = global.__vitePreload;
      global.__vitePreload = vi.fn().mockRejectedValue(new Error('Import failed'));

      try {
        await authService.requestMagicLink(testEmail);
      } catch (error) {
        expect(error).toBeDefined();
      }

      global.__vitePreload = originalImport;
    });

    it('should not expose PKCE verifier in error messages', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Verification failed'));

      await expect(authService.verifyMagicLink(testToken)).rejects.toThrow(
        'Verification failed'
      );

      // Ensure no PKCE data is exposed in the error
      try {
        await authService.verifyMagicLink(testToken);
      } catch (error) {
        expect(error.message).not.toContain(mockPkcePair.code_verifier);
        expect(error.message).not.toContain(mockPkcePair.code_challenge);
      }
    });

    it('should handle localStorage unavailability during PKCE cleanup', async () => {
      // Mock PKCE utils clearPKCEData to throw
      mockedPkceUtils.clearPKCEData.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      mockedAxios.post.mockRejectedValue(new Error('API error'));

      // Should not throw additional error due to cleanup failure
      await expect(authService.requestMagicLink(testEmail)).rejects.toThrow('API error');

      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalled();
    });
  });

  describe('Backend compatibility', () => {
    it('should send PKCE challenge in expected format', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { userExists: true } }
      });

      await authService.requestMagicLink(testEmail, { name: 'Test User' });

      // Verify the request body format matches backend expectations
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/magic-link'),
        expect.objectContaining({
          email: testEmail,
          name: 'Test User',
          code_challenge: mockPkcePair.code_challenge
        })
      );
    });

    it('should send PKCE verifier in expected format', async () => {
      const mockAuthResponse = {
        token: 'jwt-token-123',
        user: { id: '1', email: testEmail, name: 'Test User', timezone: 'UTC' }
      };
      
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockAuthResponse }
      });

      await authService.verifyMagicLink(testToken);

      // Verify the request body format matches backend expectations
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verify'),
        expect.objectContaining({
          token: testToken,
          code_verifier: mockPkcePair.code_verifier
        })
      );
    });
  });

  describe('Concurrent request handling', () => {
    it('should handle multiple simultaneous magic link requests', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { userExists: true } }
      });

      // Simulate multiple concurrent requests
      const requests = [
        authService.requestMagicLink('user1@example.com'),
        authService.requestMagicLink('user2@example.com'),
        authService.requestMagicLink('user3@example.com')
      ];

      await Promise.all(requests);

      // Each request should generate its own PKCE pair
      expect(mockedPkceUtils.generateAndStorePKCEPair).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid request-verify cycles', async () => {
      // Mock request
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: { userExists: true } }
      });

      // Mock verify
      const mockAuthResponse = {
        token: 'jwt-token-123',
        user: { id: '1', email: testEmail, name: 'Test User', timezone: 'UTC' }
      };
      
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: mockAuthResponse }
      });

      // Request magic link
      await authService.requestMagicLink(testEmail);

      // Verify magic link immediately
      await authService.verifyMagicLink(testToken);

      expect(mockedPkceUtils.generateAndStorePKCEPair).toHaveBeenCalledWith(testEmail);
      expect(mockedPkceUtils.getPKCEVerifier).toHaveBeenCalled();
      expect(mockedPkceUtils.clearPKCEData).toHaveBeenCalledTimes(1);
    });
  });
});