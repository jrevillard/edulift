/**
 * E2E Test Constants
 *
 * Centralized constants for E2E testing infrastructure.
 * These constants MUST be used consistently across:
 * - Frontend code (pkceUtils.ts, secureStorage.ts)
 * - E2E test helpers (universal-auth-helper.ts)
 *
 * SECURITY WARNING: These constants allow bypassing AES-GCM encryption
 * in test environments. They are ONLY safe when:
 * 1. VITE_E2E_TEST='true' (build-time check)
 * 2. __E2E_TEST_MODE__ flags are set (runtime check)
 * 3. Code verifies both conditions before honoring bypass
 *
 * Never modify these constants without security review!
 */

/**
 * Special IV flag that signals data is E2E test data (not encrypted)
 *
 * This IV is used in localStorage to mark data that should bypass
 * AES-GCM decryption. When secureStorage sees this IV, it decodes
 * the base64 data directly instead of attempting decryption.
 *
 * Value: 'E2E_TEST_OVERRIDE' (plaintext, not a real IV)
 * Purpose: Marks test data that can be decoded without encryption key
 * Security: Safe because bypass requires 3 independent checks
 */
export const E2E_TEST_OVERRIDE_IV = 'E2E_TEST_OVERRIDE';

/**
 * Base64-encoded version of E2E_TEST_OVERRIDE_IV
 *
 * Computed as: btoa('E2E_TEST_OVERRIDE') = 'RTJFX1RFU1RfT1ZFUlJJREU='
 *
 * Used in: secureStorage.ts decryptData() function
 * Purpose: Pattern matching to detect E2E test data
 * Security: Safe because this exact string is required for bypass
 *
 * IMPORTANT: If E2E_TEST_OVERRIDE_IV changes, this MUST be updated
 * to match btoa(E2E_TEST_OVERRIDE_IV) or E2E tests will fail.
 */
export const E2E_TEST_OVERRIDE_IV_BASE64 = 'RTJFX1RFU1RfT1ZFUlJJREU=';

/**
 * Runtime verification (development/test builds only)
 *
 * This verifies that E2E_TEST_OVERRIDE_IV_BASE64 is correctly computed.
 * In production builds, this verification is skipped for performance.
 *
 * @throws Error if base64 encoding doesn't match expected value
 */
export function verifyE2EConstants(): void {
  // Skip verification in production for performance
  if (import.meta.env.MODE === 'production') {
    return;
  }

  const computedBase64 = btoa(E2E_TEST_OVERRIDE_IV);
  if (computedBase64 !== E2E_TEST_OVERRIDE_IV_BASE64) {
    throw new Error(
      'E2E_TEST_OVERRIDE_IV_BASE64 mismatch!\n' +
      `E2E_TEST_OVERRIDE_IV = '${E2E_TEST_OVERRIDE_IV}'\n` +
      `btoa(E2E_TEST_OVERRIDE_IV) = '${computedBase64}'\n` +
      `E2E_TEST_OVERRIDE_IV_BASE64 = '${E2E_TEST_OVERRIDE_IV_BASE64}'\n\n` +
      'FIX: Update E2E_TEST_OVERRIDE_IV_BASE64 to match btoa(E2E_TEST_OVERRIDE_IV)',
    );
  }

  console.log('✅ E2E constants verified successfully');
}
