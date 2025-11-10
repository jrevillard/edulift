/**
 * PKCE (Proof Key for Code Exchange) utility functions using pkce-challenge library
 * Provides secure PKCE pair generation and storage management for OAuth2 magic link authentication
 */

import pkceChallenge from 'pkce-challenge';
import { secureStorage } from './secureStorage';

/**
 * PKCE key pair structure
 */
export interface PKCEPair {
  code_verifier: string;
  code_challenge: string;
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