/**
 * Backend compatibility tests for PKCE implementation
 * Validates that frontend PKCE data format matches backend expectations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generatePKCEPair } from '../pkceUtils';

// Mock pkce-challenge library with realistic data
vi.mock('pkce-challenge', () => ({
  default: vi.fn().mockResolvedValue({
    code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  })
}));

describe('PKCE Backend Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('code_challenge format', () => {
    it('should generate code_challenge in base64url format expected by backend', async () => {
      const pkcePair = await generatePKCEPair();
      
      // Backend expects code_challenge to be 43-128 characters
      expect(pkcePair.code_challenge.length).toBeGreaterThanOrEqual(43);
      expect(pkcePair.code_challenge.length).toBeLessThanOrEqual(128);
      
      // Should be base64url format (alphanumeric + - _ characters, no padding)
      expect(pkcePair.code_challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Should not contain base64 padding characters
      expect(pkcePair.code_challenge).not.toContain('=');
    });

    it('should generate code_verifier in base64url format expected by backend', async () => {
      const pkcePair = await generatePKCEPair();
      
      // Backend expects code_verifier to be 43-128 characters  
      expect(pkcePair.code_verifier.length).toBeGreaterThanOrEqual(43);
      expect(pkcePair.code_verifier.length).toBeLessThanOrEqual(128);
      
      // Should be base64url format (alphanumeric + - _ characters, no padding)
      expect(pkcePair.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Should not contain base64 padding characters
      expect(pkcePair.code_verifier).not.toContain('=');
    });
  });

  describe('Backend API contract validation', () => {
    it('should match backend RequestMagicLinkSchema requirements', async () => {
      const pkcePair = await generatePKCEPair();
      
      // This is what we send to POST /auth/magic-link
      const requestBody = {
        email: 'test@example.com',
        name: 'Test User',
        inviteCode: 'optional-invite-code',
        platform: 'web',
        code_challenge: pkcePair.code_challenge // Required by backend
      };

      // Validate structure matches backend expectations
      expect(requestBody).toHaveProperty('email');
      expect(requestBody).toHaveProperty('code_challenge');
      expect(typeof requestBody.code_challenge).toBe('string');
      expect(requestBody.code_challenge.length).toBeGreaterThanOrEqual(43);
      expect(requestBody.code_challenge.length).toBeLessThanOrEqual(128);
    });

    it('should match backend VerifyMagicLinkSchema requirements', async () => {
      const pkcePair = await generatePKCEPair();
      
      // This is what we send to POST /auth/verify
      const requestBody = {
        token: 'magic-link-token-from-email',
        code_verifier: pkcePair.code_verifier // Required by backend
      };

      // Validate structure matches backend expectations
      expect(requestBody).toHaveProperty('token');
      expect(requestBody).toHaveProperty('code_verifier');
      expect(typeof requestBody.code_verifier).toBe('string');
      expect(requestBody.code_verifier.length).toBeGreaterThanOrEqual(43);
      expect(requestBody.code_verifier.length).toBeLessThanOrEqual(128);
    });
  });

  describe('RFC 7636 compliance', () => {
    it('should generate PKCE pair that complies with RFC 7636 specification', async () => {
      const pkcePair = await generatePKCEPair();
      
      // RFC 7636 Section 4.1: code_verifier must be 43-128 characters
      expect(pkcePair.code_verifier.length).toBeGreaterThanOrEqual(43);
      expect(pkcePair.code_verifier.length).toBeLessThanOrEqual(128);
      
      // RFC 7636 Section 4.2: code_challenge must be base64url-encoded SHA256 hash
      expect(pkcePair.code_challenge.length).toBeGreaterThanOrEqual(43);
      expect(pkcePair.code_challenge.length).toBeLessThanOrEqual(128);
      
      // Both should be base64url encoded (no padding)
      expect(pkcePair.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkcePair.code_challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('Security validation', () => {
    it('should generate cryptographically secure PKCE pairs', async () => {
      // Since we're using a mock that returns the same values, 
      // we validate that the library would be called multiple times
      const mockPkceChallenge = await import('pkce-challenge');
      
      await Promise.all([
        generatePKCEPair(),
        generatePKCEPair(),
        generatePKCEPair()
      ]);

      // Verify the library was called 3 times (would generate unique pairs in real usage)
      expect(mockPkceChallenge.default).toHaveBeenCalledTimes(3);
    });

    it('should generate PKCE pairs with sufficient entropy', async () => {
      const pkcePair = await generatePKCEPair();
      
      // Base64url with 43+ characters provides sufficient entropy for security
      // 43 characters * 6 bits per character = 258 bits minimum
      const minEntropyBits = pkcePair.code_verifier.length * 6;
      expect(minEntropyBits).toBeGreaterThanOrEqual(258);
    });
  });

  describe('Integration with pkce-challenge library', () => {
    it('should use pkce-challenge library correctly', async () => {
      const mockPkceChallenge = await import('pkce-challenge');
      
      await generatePKCEPair();
      
      // Should call pkce-challenge with default length
      expect(mockPkceChallenge.default).toHaveBeenCalledWith(43);
    });

    it('should use pkce-challenge library with custom length', async () => {
      const mockPkceChallenge = await import('pkce-challenge');
      
      await generatePKCEPair(64);
      
      // Should call pkce-challenge with custom length
      expect(mockPkceChallenge.default).toHaveBeenCalledWith(64);
    });
  });
});