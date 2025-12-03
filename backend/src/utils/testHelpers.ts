/**
 * Test Helpers
 *
 * Centralized helper functions for tests to eliminate duplication
 */

/**
 * Interface for environment variable configuration
 */
export interface TestEnvironmentConfig {
  DEEP_LINK_BASE_URL?: string;
  FRONTEND_URL?: string;
}

/**
 * Default test environment configuration
 */
const DEFAULT_TEST_ENV: TestEnvironmentConfig = {
  DEEP_LINK_BASE_URL: 'https://app.edulift.com',
  FRONTEND_URL: 'https://app.edulift.com',
};

/**
 * Set up test environment variables with proper cleanup
 * @param config Environment variables to set for the test
 * @returns Cleanup function to restore original values
 */
export const setupTestEnvironment = function setupTestEnvironment(config: TestEnvironmentConfig = {}): () => void {
  // Store original values for cleanup
  const originalValues: Record<string, string | undefined> = {};

  // Set each configured environment variable
  Object.entries({ ...DEFAULT_TEST_ENV, ...config }).forEach(([key, value]) => {
    originalValues[key] = process.env[key];
    if (value !== undefined) {
      process.env[key] = value;
    }
  });

  // Return cleanup function
  return function () {
    Object.entries(originalValues).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  };
};

/**
 * Common environment configurations for different test scenarios
 */
export const TEST_ENVIRONMENTS = {
  /** Standard web environment */
  WEB: {
    DEEP_LINK_BASE_URL: 'https://app.edulift.com',
    FRONTEND_URL: 'https://app.edulift.com',
  },

  /** Deep link environment */
  DEEP_LINK: {
    DEEP_LINK_BASE_URL: 'edulift://',
    FRONTEND_URL: 'https://app.edulift.com',
  },

  /** Custom domain for testing */
  CUSTOM_DOMAIN: {
    DEEP_LINK_BASE_URL: 'https://custom.example.com',
    FRONTEND_URL: 'https://custom.example.com',
  },

  /** Local development */
  LOCALHOST: {
    DEEP_LINK_BASE_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
  },
} as const;

/**
 * Malicious URLs for security testing
 */
export const MALICIOUS_URLS = [
  // eslint-disable-next-line no-script-url
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox("test")',
  'file:///etc/passwd',
  'ftp://malicious.com/files',
  'ht tp://invalid-url',
  '',
  '   \t\n   ',
  'https://<script>alert(1)</script>.com',
] as const;

/**
 * Helper to set up malicious URL environment for security tests
 * @param maliciousUrl The malicious URL to test
 * @returns Cleanup function
 */
export const setupMaliciousUrlTest = function setupMaliciousUrlTest(maliciousUrl: string): () => void {
  return setupTestEnvironment({
    DEEP_LINK_BASE_URL: maliciousUrl,
  });
};