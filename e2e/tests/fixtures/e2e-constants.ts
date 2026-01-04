/**
 * E2E Test Constants for Helper Functions
 *
 * These constants MUST match the values in frontend/src/constants/e2e.ts
 * to ensure E2E tests work correctly with the secure storage mechanism.
 *
 * SOURCE OF TRUTH: frontend/src/constants/e2e.ts
 *
 * If you update these constants, you MUST also update:
 * - frontend/src/constants/e2e.ts
 * - frontend/src/utils/secureStorage.ts (indirectly via e2e.ts)
 */

/**
 * Special IV flag that signals data is E2E test data (not encrypted)
 *
 * This MUST match: frontend/src/constants/e2e.ts → E2E_TEST_OVERRIDE_IV
 */
export const E2E_TEST_OVERRIDE_IV = 'E2E_TEST_OVERRIDE';

/**
 * Base64-encoded version of E2E_TEST_OVERRIDE_IV
 *
 * Computed as: btoa('E2E_TEST_OVERRIDE') = 'RTJFX1RFU1RfT1ZFUlJJREU='
 *
 * This MUST match: frontend/src/constants/e2e.ts → E2E_TEST_OVERRIDE_IV_BASE64
 */
export const E2E_TEST_OVERRIDE_IV_BASE64 = 'RTJFX1RFU1RfT1ZFUlJJREU=';
