/**
 * Tests for PKCE utility functions
 * Covers RFC 7636 compliance, security, storage, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// Mock secureStorage
vi.mock('../secureStorage', () => ({
  secureStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
  }
}));

describe('PKCE Utils', () => {
  const mockPkcePair: PKCEPair = {
    code_verifier: 'test-verifier-12345678901234567890123456789012',
    code_challenge: 'test-challenge-hash'
  };

  const testEmail = 'test@example.com';

  // Import mock modules
  let mockSecureStorage: { getItem: vi.Mock; setItem: vi.Mock; removeItem: vi.Mock };

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks();

    // Get secureStorage mock
    const secureStorageModule = await import('../secureStorage');
    mockSecureStorage = secureStorageModule.secureStorage;

    // Reset secureStorage mock to return null by default
    mockSecureStorage.getItem.mockResolvedValue(null);
    mockSecureStorage.setItem.mockResolvedValue(undefined);
    mockSecureStorage.removeItem.mockResolvedValue(undefined);

    // Mock successful PKCE generation by default
    const mockPkceChallenge = await import('pkce-challenge');
    vi.mocked(mockPkceChallenge.default).mockResolvedValue(mockPkcePair);
  });

  describe('generatePKCEPair', () => {
    it('should generate a valid PKCE pair with default length', async () => {
      const result = await generatePKCEPair();

      expect(result).toEqual(mockPkcePair);
      expect(result.code_verifier).toBeDefined();
      expect(result.code_challenge).toBeDefined();
    });

    it('should throw error for invalid length', async () => {
      await expect(generatePKCEPair(42)).rejects.toThrow(
        'PKCE code verifier length must be between 43 and 128 characters'
      );
    });
  });

  describe('storePKCEPair', () => {
    it('should store PKCE pair and email in secure storage', async () => {
      await storePKCEPair(mockPkcePair, testEmail);

      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_code_verifier', mockPkcePair.code_verifier);
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_code_challenge', mockPkcePair.code_challenge);
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_email', testEmail.toLowerCase());
    });

    it('should normalize email to lowercase', async () => {
      const upperCaseEmail = 'TEST@EXAMPLE.COM';
      await storePKCEPair(mockPkcePair, upperCaseEmail);

      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_email', 'test@example.com');
    });

    it('should throw error for invalid PKCE pair', async () => {
      const invalidPair = { code_verifier: '', code_challenge: 'test-challenge' };

      await expect(storePKCEPair(invalidPair, testEmail)).rejects.toThrow(
        'Failed to store PKCE pair: Invalid PKCE pair - missing verifier or challenge'
      );
    });

    it('should throw error for empty email', async () => {
      await expect(storePKCEPair(mockPkcePair, '')).rejects.toThrow(
        'Failed to store PKCE pair: Email is required for PKCE storage'
      );
    });
  });

  describe('getPKCEVerifier', () => {
    it('should retrieve stored verifier', async () => {
      mockSecureStorage.getItem
        .mockResolvedValueOnce(mockPkcePair.code_verifier) // for pkce_code_verifier
        .mockResolvedValueOnce('test@example.com'); // for pkce_email

      const verifier = await getPKCEVerifier();
      expect(verifier).toBe(mockPkcePair.code_verifier);
    });

    it('should return null when no verifier is stored', async () => {
      mockSecureStorage.getItem
        .mockResolvedValueOnce(null) // pkce_code_verifier
        .mockResolvedValueOnce(null); // pkce_email

      const verifier = await getPKCEVerifier();
      expect(verifier).toBeNull();
    });

    it('should handle secureStorage errors gracefully', async () => {
      mockSecureStorage.getItem.mockRejectedValue(new Error('Secure storage unavailable'));

      const verifier = await getPKCEVerifier();
      expect(verifier).toBeNull();
    });
  });

  describe('getPKCEChallenge', () => {
    it('should retrieve stored challenge', async () => {
      mockSecureStorage.getItem.mockResolvedValueOnce(mockPkcePair.code_challenge);

      const challenge = await getPKCEChallenge();
      expect(challenge).toBe(mockPkcePair.code_challenge);
    });

    it('should return null when no challenge is stored', async () => {
      mockSecureStorage.getItem.mockResolvedValueOnce(null);

      const challenge = await getPKCEChallenge();
      expect(challenge).toBeNull();
    });
  });

  describe('getPKCEEmail', () => {
    it('should retrieve stored email', async () => {
      mockSecureStorage.getItem.mockResolvedValueOnce(testEmail);

      const email = await getPKCEEmail();
      expect(email).toBe(testEmail);
    });

    it('should return null when no email is stored', async () => {
      mockSecureStorage.getItem.mockResolvedValue(null);

      const email = await getPKCEEmail();
      expect(email).toBeNull();
    });
  });

  describe('clearPKCEData', () => {
    it('should clear all PKCE data from secure storage', async () => {
      await clearPKCEData();

      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_code_verifier');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_code_challenge');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_email');
    });
  });

  describe('hasPKCEData', () => {
    it('should return true when all PKCE data exists', async () => {
      mockSecureStorage.getItem
        .mockResolvedValueOnce(mockPkcePair.code_verifier) // pkce_code_verifier
        .mockResolvedValueOnce(mockPkcePair.code_challenge) // pkce_code_challenge
        .mockResolvedValueOnce(testEmail); // pkce_email

      const result = await hasPKCEData();
      expect(result).toBe(true);
    });

    it('should return false when verifier is missing', async () => {
      mockSecureStorage.getItem
        .mockResolvedValueOnce(null) // pkce_code_verifier missing
        .mockResolvedValueOnce(mockPkcePair.code_challenge) // pkce_code_challenge
        .mockResolvedValueOnce(testEmail); // pkce_email

      const result = await hasPKCEData();
      expect(result).toBe(false);
    });

    it('should return false when no data exists', async () => {
      mockSecureStorage.getItem.mockResolvedValue(null);

      const result = await hasPKCEData();
      expect(result).toBe(false);
    });
  });

  describe('generateAndStorePKCEPair', () => {
    it('should generate and store PKCE pair', async () => {
      const result = await generateAndStorePKCEPair(testEmail);

      expect(result).toEqual(mockPkcePair);
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_code_verifier', mockPkcePair.code_verifier);
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_code_challenge', mockPkcePair.code_challenge);
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('pkce_email', testEmail.toLowerCase());
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
    it('should clear data when email validation fails', async () => {
      // Mock secureStorage to return stored values with different email
      mockSecureStorage.getItem
        .mockResolvedValueOnce(mockPkcePair.code_verifier) // for pkce_code_verifier
        .mockResolvedValueOnce('stored@example.com'); // different email

      const verifier = await getPKCEVerifier('different@example.com');
      expect(verifier).toBeNull();

      // Should have cleared the data for security
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_code_verifier');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_code_challenge');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('pkce_email');
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