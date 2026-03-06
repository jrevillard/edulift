/**
 * PKCE (Proof Key for Code Exchange) utility functions using pkce-challenge library
 * Provides secure PKCE pair generation and storage management for OAuth2 magic link authentication
 */

import pkceChallenge from 'pkce-challenge';
import { secureStorage } from './secureStorage';
import { E2E_TEST_OVERRIDE_IV, E2E_TEST_OVERRIDE_IV_BASE64, verifyE2EConstants } from '../constants/e2e';

/**
 * PKCE key pair structure
 */
export interface PKCEPair {
  code_verifier: string;
  code_challenge: string;
}

/**
 * E2E Test PKCE data structure for testing magic link flow
 */
export interface E2EPKCEData {
  code_verifier: string;
  code_challenge: string;
  email: string;
  timestamp: number;
}

/**
 * Storage keys for PKCE data in secure storage
 */
const STORAGE_KEYS = {
  CODE_VERIFIER: 'pkce_code_verifier',
  CODE_CHALLENGE: 'pkce_code_challenge',
  EMAIL: 'pkce_email', // Store email to validate against
} as const;

/**
 * Global interface for E2E test data storage
 */
declare global {
  interface Window {
    __E2E_PKCE_DATA__?: E2EPKCEData;
  }
}

// Re-export E2E constants for backwards compatibility
export { E2E_TEST_OVERRIDE_IV, E2E_TEST_OVERRIDE_IV_BASE64 };

// Verify E2E constants are correct (development/test only)
// This ensures E2E_TEST_OVERRIDE_IV_BASE64 matches btoa(E2E_TEST_OVERRIDE_IV)
// NOTE: This verification only runs in dev/test when `btoa()` is available
// In unit tests, `btoa` might not be defined, so we wrap it in try/catch
if (import.meta.env.MODE !== 'production') {
  try {
    if (typeof btoa === 'function') {
      verifyE2EConstants();
    } else {
      console.warn('⚠️ btoa() not available - skipping E2E constants verification (likely unit tests)');
    }
  } catch (error) {
    console.error('Fatal: E2E constants verification failed:', error);
    throw error;
  }
}

/**
 * Generate a new PKCE challenge/verifier pair
 * Uses RFC 7636 compliant generation with Web Crypto API
 * 
 * @param length - Length of the code verifier (43-128 characters, default 43)
 * @returns Promise<PKCEPair> - The generated PKCE pair
 * @throws Error if generation fails or length is invalid
 */
export async function generatePKCEPair(length: number = 43): Promise<PKCEPair> {
  try {
    // Validate length according to RFC 7636
    if (length < 43 || length > 128) {
      throw new Error('PKCE code verifier length must be between 43 and 128 characters');
    }

    const pair = await pkceChallenge(length);
    
    if (!pair.code_verifier || !pair.code_challenge) {
      throw new Error('Failed to generate PKCE pair - missing verifier or challenge');
    }

    return pair;
  } catch (error) {
    console.error('PKCE generation failed:', error);
    throw new Error(`Failed to generate PKCE pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Store PKCE pair and associated email in secure storage
 * This ensures the verifier can be retrieved for token exchange
 *
 * @param pair - The PKCE pair to store
 * @param email - Associated email address for validation
 * @throws Error if storage fails
 */
export async function storePKCEPair(pair: PKCEPair, email: string): Promise<void> {
  try {
    if (!pair.code_verifier || !pair.code_challenge) {
      throw new Error('Invalid PKCE pair - missing verifier or challenge');
    }

    if (!email || email.trim().length === 0) {
      throw new Error('Email is required for PKCE storage');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Store in secure storage with encryption
    await secureStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, pair.code_verifier);
    await secureStorage.setItem(STORAGE_KEYS.CODE_CHALLENGE, pair.code_challenge);
    await secureStorage.setItem(STORAGE_KEYS.EMAIL, normalizedEmail);

    // E2E TEST SUPPORT: Store plaintext values for E2E testing
    // CRITICAL: ONLY expose in test environment, NEVER in production
    if (import.meta.env.VITE_E2E_TEST === 'true' && typeof window !== 'undefined') {
      window.__E2E_PKCE_DATA__ = {
        code_verifier: pair.code_verifier,
        code_challenge: pair.code_challenge,
        email: normalizedEmail,
        timestamp: Date.now()
      };
    }

    console.log('🔐 PKCE pair stored successfully in secure storage');
  } catch (error) {
    console.error('PKCE storage failed:', error);
    throw new Error(`Failed to store PKCE pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve stored PKCE verifier for token exchange
 *
 * @param email - Email to validate against stored email
 * @returns Promise<string | null> - The code verifier or null if not found/invalid
 */
export async function getPKCEVerifier(email?: string): Promise<string | null> {
  try {
    const storedVerifier = await secureStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);

    if (!storedVerifier) {
      console.warn('No PKCE verifier found in secure storage');
      return null;
    }

    // If email provided, validate it matches stored email
    if (email) {
      const storedEmail = await secureStorage.getItem(STORAGE_KEYS.EMAIL);
      if (storedEmail && email.trim().toLowerCase() !== storedEmail) {
        console.warn('PKCE verifier email mismatch - security risk detected');
        await clearPKCEData(); // Clear potentially compromised data
        return null;
      }
    }

    return storedVerifier;
  } catch (error) {
    console.error('Failed to retrieve PKCE verifier:', error);
    return null;
  }
}

/**
 * Get stored PKCE challenge for magic link request
 *
 * @returns Promise<string | null> - The code challenge or null if not found
 */
export async function getPKCEChallenge(): Promise<string | null> {
  try {
    return await secureStorage.getItem(STORAGE_KEYS.CODE_CHALLENGE);
  } catch (error) {
    console.error('Failed to retrieve PKCE challenge:', error);
    return null;
  }
}

/**
 * Get the email associated with the current PKCE pair
 *
 * @returns Promise<string | null> - The stored email or null if not found
 */
export async function getPKCEEmail(): Promise<string | null> {
  try {
    return await secureStorage.getItem(STORAGE_KEYS.EMAIL);
  } catch (error) {
    console.error('Failed to retrieve PKCE email:', error);
    return null;
  }
}

/**
 * Clear all PKCE data from secure storage
 * Should be called after successful authentication or on error
 */
export async function clearPKCEData(): Promise<void> {
  // SECURITY: Validate build environment BEFORE honoring test mode
  // This prevents accidental E2E test mode activation in production builds
  if (import.meta.env.VITE_E2E_TEST === 'true' && import.meta.env.MODE === 'production') {
    console.error('🚨 SECURITY ALERT: VITE_E2E_TEST is set in production build!');
    console.error('Build environment:', import.meta.env.MODE);
    console.error('VITE_E2E_TEST:', import.meta.env.VITE_E2E_TEST);
    throw new Error('E2E test mode is not allowed in production builds');
  }

  // Only honor test mode in non-production builds
  const isE2ETestBuild = import.meta.env.VITE_E2E_TEST === 'true' &&
                        import.meta.env.MODE !== 'production';

  const isE2ETestMode = isE2ETestBuild &&
                       typeof window !== 'undefined' &&
                       ((window as any).__E2E_TEST_MODE__ === true ||
                        localStorage.getItem('__E2E_TEST_MODE__') === 'true');

  if (isE2ETestMode) {
    console.log('🧪 [E2E TEST] clearPKCEData() called - SKIPPING to preserve PKCE data');
    return;
  }

  try {
    secureStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
    secureStorage.removeItem(STORAGE_KEYS.CODE_CHALLENGE);
    secureStorage.removeItem(STORAGE_KEYS.EMAIL);
    console.log('🧹 PKCE data cleared from secure storage');
  } catch (error) {
    console.error('Failed to clear PKCE data:', error);
  }
}

/**
 * Check if PKCE data exists and is complete in secure storage
 *
 * @returns Promise<boolean> - True if complete PKCE data exists
 */
export async function hasPKCEData(): Promise<boolean> {
  try {
    const verifier = await secureStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
    const challenge = await secureStorage.getItem(STORAGE_KEYS.CODE_CHALLENGE);
    const email = await secureStorage.getItem(STORAGE_KEYS.EMAIL);

    // Debug logging for E2E tests
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [hasPKCEData] Checking PKCE data:', {
        hasVerifier: !!verifier,
        hasChallenge: !!challenge,
        hasEmail: !!email,
        e2eTestMode: typeof window !== 'undefined' &&
                     ((window as any).__E2E_TEST_MODE__ === true ||
                      localStorage.getItem('__E2E_TEST_MODE__') === 'true')
      });
    }

    return !!(verifier && challenge && email);
  } catch (error) {
    console.error('Failed to check PKCE data:', error);
    return false;
  }
}

/**
 * Generate a new PKCE pair and store it with the associated email
 * This is a convenience function that combines generation and storage
 *
 * @param email - Email address to associate with the PKCE pair
 * @param length - Length of the code verifier (43-128 characters, default 43)
 * @returns Promise<PKCEPair> - The generated and stored PKCE pair
 * @throws Error if generation or storage fails
 */
export async function generateAndStorePKCEPair(email: string, length: number = 43): Promise<PKCEPair> {
  const pair = await generatePKCEPair(length);
  await storePKCEPair(pair, email);
  return pair;
}

/**
 * Restore PKCE data from a plain object (for E2E testing)
 * This bypasses encryption and directly restores the data to secure storage
 * WARNING: This method should ONLY be used in E2E tests, never in production code
 *
 * @param pkceData - Object containing code_verifier, code_challenge, and email
 * @throws Error if restoration fails
 */
export async function restorePKCEData(pkceData: Record<string, string>): Promise<void> {
  // SECURITY: This function should ONLY be used in E2E tests
  // CRITICAL: Multiple layers of protection to prevent production usage

  // Layer 1: Build-time check - block production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('restorePKCEData is forbidden in production - this is E2E test only');
  }

  // Layer 2: Must be in test environment (not just "not production")
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('restorePKCEData is only allowed in test environment');
  }

  // Layer 3: Verify E2E test mode flags are present
  const isE2EMode = typeof window !== 'undefined' &&
                    ((window as any).__E2E_TEST_MODE__ === true ||
                     localStorage.getItem('__E2E_TEST_MODE__') === 'true');

  if (!isE2EMode) {
    throw new Error('restorePKCEData requires E2E test mode - flags not found');
  }

  try {
    if (!pkceData.code_verifier || !pkceData.code_challenge || !pkceData.email) {
      throw new Error('Invalid PKCE data - missing verifier, challenge, or email');
    }

    // Directly store in localStorage with the secure_ prefix to match secureStorage format
    // We store as PLAINTEXT (not encrypted) for E2E testing only
    const storageData = {
      encrypted: btoa(pkceData.code_verifier), // Simple base64 encoding (not encryption)
      iv: btoa(E2E_TEST_OVERRIDE_IV), // Special IV to indicate this is test data
      timestamp: Date.now()
    };

    localStorage.setItem(`secure_${STORAGE_KEYS.CODE_VERIFIER}`, JSON.stringify(storageData));

    // Store challenge (same approach)
    const challengeData = {
      encrypted: btoa(pkceData.code_challenge),
      iv: btoa(E2E_TEST_OVERRIDE_IV),
      timestamp: Date.now()
    };

    localStorage.setItem(`secure_${STORAGE_KEYS.CODE_CHALLENGE}`, JSON.stringify(challengeData));

    // Store email
    const emailData = {
      encrypted: btoa(pkceData.email),
      iv: btoa(E2E_TEST_OVERRIDE_IV),
      timestamp: Date.now()
    };

    localStorage.setItem(`secure_${STORAGE_KEYS.EMAIL}`, JSON.stringify(emailData));

    console.log('🔐 PKCE data restored for E2E testing (plaintext with test IV)');
  } catch (error) {
    console.error('Failed to restore PKCE data:', error);
    throw new Error(`Failed to restore PKCE data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that browser supports required Web Crypto API features for PKCE
 *
 * @returns boolean - True if browser supports PKCE requirements
 */
export function isPKCESupported(): boolean {
  try {
    // Check for Web Crypto API support
    if (!window.crypto || !window.crypto.subtle) {
      return false;
    }

    // Check for required crypto operations
    if (typeof window.crypto.getRandomValues !== 'function') {
      return false;
    }

    // Check for localStorage support
    if (!window.localStorage) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Error class for PKCE-related errors
 */
export class PKCEError extends Error {
  public code?: string;
  
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PKCEError';
    this.code = code;
  }
}