/**
 * Tests for PKCE utility functions
 * Covers RFC 7636 compliance, security, storage, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generatePKCEPair,
  storePKCEPair,
  getPKCEVerifier,
  getPKCEChallenge,
  getPKCEEmail,
  clearPKCEData,
  hasPKCEData,
  generateAndStorePKCEPair,
  isPKCESupported,
  PKCEError,
  PKCEPair
} from '../pkceUtils';

// Mock pkce-challenge library
vi.mock('pkce-challenge', () => ({
  default: vi.fn()
}));

describe('PKCE Utils', () => {
  const mockPkcePair: PKCEPair = {
    code_verifier: 'test-verifier-12345678901234567890123456789012',
    code_challenge: 'test-challenge-hash'
  };

  const testEmail = 'test@example.com';

  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful PKCE generation by default
    const mockPkceChallenge = await import('pkce-challenge');
    vi.mocked(mockPkceChallenge.default).mockResolvedValue(mockPkcePair);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('generatePKCEPair', () => {
    it('should generate a valid PKCE pair with default length', async () => {
      const result = await generatePKCEPair();

      expect(result).toEqual(mockPkcePair);
      expect(result.code_verifier).toBeDefined();
      expect(result.code_challenge).toBeDefined();
    });

    it('should generate a PKCE pair with custom length', async () => {
      await generatePKCEPair(128);

      const mockPkceChallenge = await import('pkce-challenge');
      expect(mockPkceChallenge.default).toHaveBeenCalledWith(128);
    });

    it('should throw error for invalid length (too short)', async () => {
      await expect(generatePKCEPair(42)).rejects.toThrow(
        'PKCE code verifier length must be between 43 and 128 characters'
      );
    });

    it('should throw error for invalid length (too long)', async () => {
      await expect(generatePKCEPair(129)).rejects.toThrow(
        'PKCE code verifier length must be between 43 and 128 characters'
      );
    });

    it('should handle library generation failure', async () => {
      const mockPkceChallenge = await import('pkce-challenge');
      vi.mocked(mockPkceChallenge.default).mockRejectedValue(new Error('Crypto API failed'));

      await expect(generatePKCEPair()).rejects.toThrow('Failed to generate PKCE pair: Crypto API failed');
    });

    it('should handle incomplete PKCE pair from library', async () => {
      const mockPkceChallenge = await import('pkce-challenge');
      vi.mocked(mockPkceChallenge.default).mockResolvedValue({
        code_verifier: '',
        code_challenge: 'test-challenge'
      });

      await expect(generatePKCEPair()).rejects.toThrow(
        'Failed to generate PKCE pair - missing verifier or challenge'
      );
    });
  });

  describe('storePKCEPair', () => {
    it('should store PKCE pair and email in localStorage', () => {
      storePKCEPair(mockPkcePair, testEmail);

      expect(localStorage.getItem('pkce_code_verifier')).toBe(mockPkcePair.code_verifier);
      expect(localStorage.getItem('pkce_code_challenge')).toBe(mockPkcePair.code_challenge);
      expect(localStorage.getItem('pkce_email')).toBe(testEmail.toLowerCase());
    });

    it('should normalize email to lowercase', () => {
      const upperCaseEmail = 'TEST@EXAMPLE.COM';
      storePKCEPair(mockPkcePair, upperCaseEmail);

      expect(localStorage.getItem('pkce_email')).toBe('test@example.com');
    });

    it('should trim email whitespace', () => {
      const emailWithSpaces = '  test@example.com  ';
      storePKCEPair(mockPkcePair, emailWithSpaces);

      expect(localStorage.getItem('pkce_email')).toBe('test@example.com');
    });

    it('should throw error for invalid PKCE pair (missing verifier)', () => {
      const invalidPair = { code_verifier: '', code_challenge: 'test-challenge' };
      
      expect(() => storePKCEPair(invalidPair, testEmail)).toThrow(
        'Failed to store PKCE pair: Invalid PKCE pair - missing verifier or challenge'
      );
    });

    it('should throw error for invalid PKCE pair (missing challenge)', () => {
      const invalidPair = { code_verifier: 'test-verifier', code_challenge: '' };
      
      expect(() => storePKCEPair(invalidPair, testEmail)).toThrow(
        'Failed to store PKCE pair: Invalid PKCE pair - missing verifier or challenge'
      );
    });

    it('should throw error for empty email', () => {
      expect(() => storePKCEPair(mockPkcePair, '')).toThrow(
        'Failed to store PKCE pair: Email is required for PKCE storage'
      );
    });

    it('should throw error for whitespace-only email', () => {
      expect(() => storePKCEPair(mockPkcePair, '   ')).toThrow(
        'Failed to store PKCE pair: Email is required for PKCE storage'
      );
    });
  });

  describe('getPKCEVerifier', () => {
    it('should retrieve stored verifier', () => {
      storePKCEPair(mockPkcePair, testEmail);

      const verifier = getPKCEVerifier();
      expect(verifier).toBe(mockPkcePair.code_verifier);
    });

    it('should validate email if provided', () => {
      storePKCEPair(mockPkcePair, testEmail);

      const verifier = getPKCEVerifier(testEmail);
      expect(verifier).toBe(mockPkcePair.code_verifier);
    });

    it('should return null for email mismatch and clear data', () => {
      storePKCEPair(mockPkcePair, testEmail);

      const verifier = getPKCEVerifier('different@example.com');
      expect(verifier).toBeNull();
      
      // Should have cleared the data for security
      expect(localStorage.getItem('pkce_code_verifier')).toBeNull();
      expect(localStorage.getItem('pkce_code_challenge')).toBeNull();
      expect(localStorage.getItem('pkce_email')).toBeNull();
    });

    it('should return null when no verifier is stored', () => {
      const verifier = getPKCEVerifier();
      expect(verifier).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const verifier = getPKCEVerifier();
      expect(verifier).toBeNull();

      // Restore original localStorage
      localStorage.getItem = originalGetItem;
    });
  });

  describe('getPKCEChallenge', () => {
    it('should retrieve stored challenge', () => {
      storePKCEPair(mockPkcePair, testEmail);

      const challenge = getPKCEChallenge();
      expect(challenge).toBe(mockPkcePair.code_challenge);
    });

    it('should return null when no challenge is stored', () => {
      const challenge = getPKCEChallenge();
      expect(challenge).toBeNull();
    });
  });

  describe('getPKCEEmail', () => {
    it('should retrieve stored email', () => {
      storePKCEPair(mockPkcePair, testEmail);

      const email = getPKCEEmail();
      expect(email).toBe(testEmail.toLowerCase());
    });

    it('should return null when no email is stored', () => {
      const email = getPKCEEmail();
      expect(email).toBeNull();
    });
  });

  describe('clearPKCEData', () => {
    it('should clear all PKCE data from localStorage', () => {
      storePKCEPair(mockPkcePair, testEmail);
      
      // Verify data is stored
      expect(localStorage.getItem('pkce_code_verifier')).toBeTruthy();
      expect(localStorage.getItem('pkce_code_challenge')).toBeTruthy();
      expect(localStorage.getItem('pkce_email')).toBeTruthy();

      clearPKCEData();

      // Verify all data is cleared
      expect(localStorage.getItem('pkce_code_verifier')).toBeNull();
      expect(localStorage.getItem('pkce_code_challenge')).toBeNull();
      expect(localStorage.getItem('pkce_email')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => clearPKCEData()).not.toThrow();

      // Restore original localStorage
      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('hasPKCEData', () => {
    it('should return true when all PKCE data exists', () => {
      storePKCEPair(mockPkcePair, testEmail);

      expect(hasPKCEData()).toBe(true);
    });

    it('should return false when verifier is missing', () => {
      localStorage.setItem('pkce_code_challenge', mockPkcePair.code_challenge);
      localStorage.setItem('pkce_email', testEmail);

      expect(hasPKCEData()).toBe(false);
    });

    it('should return false when challenge is missing', () => {
      localStorage.setItem('pkce_code_verifier', mockPkcePair.code_verifier);
      localStorage.setItem('pkce_email', testEmail);

      expect(hasPKCEData()).toBe(false);
    });

    it('should return false when email is missing', () => {
      localStorage.setItem('pkce_code_verifier', mockPkcePair.code_verifier);
      localStorage.setItem('pkce_code_challenge', mockPkcePair.code_challenge);

      expect(hasPKCEData()).toBe(false);
    });

    it('should return false when no data exists', () => {
      expect(hasPKCEData()).toBe(false);
    });
  });

  describe('generateAndStorePKCEPair', () => {
    it('should generate and store PKCE pair', async () => {
      const result = await generateAndStorePKCEPair(testEmail);

      expect(result).toEqual(mockPkcePair);
      expect(localStorage.getItem('pkce_code_verifier')).toBe(mockPkcePair.code_verifier);
      expect(localStorage.getItem('pkce_code_challenge')).toBe(mockPkcePair.code_challenge);
      expect(localStorage.getItem('pkce_email')).toBe(testEmail.toLowerCase());
    });

    it('should generate with custom length and store', async () => {
      await generateAndStorePKCEPair(testEmail, 64);

      const mockPkceChallenge = await import('pkce-challenge');
      expect(mockPkceChallenge.default).toHaveBeenCalledWith(64);
    });

    it('should handle generation failure', async () => {
      const mockPkceChallenge = await import('pkce-challenge');
      vi.mocked(mockPkceChallenge.default).mockRejectedValue(new Error('Generation failed'));

      await expect(generateAndStorePKCEPair(testEmail)).rejects.toThrow('Failed to generate PKCE pair');
    });
  });

  describe('isPKCESupported', () => {
    it('should return true when all required APIs are available', () => {
      // Mock the required APIs
      Object.defineProperty(window, 'crypto', {
        value: {
          subtle: {},
          getRandomValues: vi.fn()
        },
        writable: true
      });

      Object.defineProperty(window, 'localStorage', {
        value: localStorage,
        writable: true
      });

      expect(isPKCESupported()).toBe(true);
    });

    it('should return false when crypto is missing', () => {
      const originalCrypto = window.crypto;
      // @ts-expect-error - intentionally setting to undefined for testing
      delete window.crypto;

      expect(isPKCESupported()).toBe(false);

      // Restore
      window.crypto = originalCrypto;
    });

    it('should return false when crypto.subtle is missing', () => {
      Object.defineProperty(window, 'crypto', {
        value: {
          getRandomValues: vi.fn()
        },
        writable: true
      });

      expect(isPKCESupported()).toBe(false);
    });

    it('should return false when getRandomValues is missing', () => {
      Object.defineProperty(window, 'crypto', {
        value: {
          subtle: {}
        },
        writable: true
      });

      expect(isPKCESupported()).toBe(false);
    });

    it('should return false when localStorage is missing', () => {
      Object.defineProperty(window, 'crypto', {
        value: {
          subtle: {},
          getRandomValues: vi.fn()
        },
        writable: true
      });

      const originalLocalStorage = window.localStorage;
      // @ts-expect-error - intentionally setting to undefined for testing
      delete window.localStorage;

      expect(isPKCESupported()).toBe(false);

      // Restore
      window.localStorage = originalLocalStorage;
    });

    it('should return false when an exception is thrown', () => {
      // Mock crypto to throw an error when accessed
      Object.defineProperty(window, 'crypto', {
        get() {
          throw new Error('Crypto not available');
        }
      });

      expect(isPKCESupported()).toBe(false);
    });
  });

  describe('PKCEError', () => {
    it('should create error with message', () => {
      const error = new PKCEError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PKCEError');
      expect(error.code).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new PKCEError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PKCEError');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should be instance of Error', () => {
      const error = new PKCEError('Test error');
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof PKCEError).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should not log sensitive PKCE data in console', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      storePKCEPair(mockPkcePair, testEmail);
      
      // Check that sensitive data is not logged
      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain(mockPkcePair.code_verifier);
        expect(logMessage).not.toContain(mockPkcePair.code_challenge);
      });

      consoleSpy.mockRestore();
    });

    it('should clear data when email validation fails', () => {
      storePKCEPair(mockPkcePair, testEmail);
      
      // Verify data is stored
      expect(hasPKCEData()).toBe(true);

      // Try to get verifier with wrong email - should clear data
      getPKCEVerifier('wrong@example.com');

      // Verify data was cleared for security
      expect(hasPKCEData()).toBe(false);
    });
  });

  describe('RFC 7636 compliance', () => {
    it('should enforce minimum verifier length', async () => {
      await expect(generatePKCEPair(42)).rejects.toThrow();
    });

    it('should enforce maximum verifier length', async () => {
      await expect(generatePKCEPair(129)).rejects.toThrow();
    });

    it('should accept valid verifier lengths', async () => {
      // Test boundary values
      await expect(generatePKCEPair(43)).resolves.toBeDefined();
      await expect(generatePKCEPair(128)).resolves.toBeDefined();
      
      // Test common values
      await expect(generatePKCEPair(64)).resolves.toBeDefined();
    });
  });
});