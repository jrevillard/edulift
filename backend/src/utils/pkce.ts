/**
 * PKCE (Proof Key for Code Exchange) test utilities
 * Provides consistent PKCE challenge/verifier pairs for testing
 * Following IETF RFC 7636 specification
 */

import crypto from 'crypto';

/**
 * Generates a PKCE code_verifier (43-128 characters, base64url encoded)
 */
export const generateCodeVerifier = (): string => {
  // Generate 32 random bytes (256 bits) for strong entropy
  const buffer = crypto.randomBytes(32);
  // Base64url encode (URL-safe base64 without padding)
  return buffer.toString('base64url');
};

/**
 * Generates a PKCE code_challenge from a code_verifier
 * Uses SHA256 hash and base64url encoding per RFC 7636
 */
export const generateCodeChallenge = (codeVerifier: string): string => {
  // SHA256 hash of the code_verifier
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  // Base64url encode the hash (URL-safe base64 without padding)
  return hash.toString('base64url');
};

/**
 * Generates a complete PKCE challenge/verifier pair for testing
 */
export const generatePKCEPair = (): { codeVerifier: string; codeChallenge: string } => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
};

/**
 * Test-specific PKCE utilities
 */
export const TEST_PKCE = {
  // Valid PKCE pair for consistent testing
  VALID: {
    verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  },
  
  // Invalid challenge for negative testing  
  INVALID_CHALLENGE: 'invalid-challenge-too-short',
  
  // Invalid verifier for negative testing
  INVALID_VERIFIER: 'invalid-verifier',
};

/**
 * Creates a mock PKCE pair for testing purposes
 * Returns deterministic values for consistent test results
 */
export const createTestPKCE = (): { codeVerifier: string; codeChallenge: string } => {
  return {
    codeVerifier: TEST_PKCE.VALID.verifier,
    codeChallenge: TEST_PKCE.VALID.challenge,
  };
};