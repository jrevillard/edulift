/**
 * Test Utilities
 *
 * Utility functions for generating valid test data that respects schema validation
 * Centralizes all test CUIDs and test data generation
 */

// No need for dynamic generation for tests - we use fixed IDs

/**
 * Generate a valid CUID for testing
 */
export const createTestCuid = (): string => TEST_IDS.USER; // Returns a valid fixed CUID

/**
 * Generate multiple valid CUIDs for testing
 */
export const createTestIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `cltest${i.toString().padStart(23, '0')}1234567890123456`);

/**
 * Deterministic test IDs for consistent testing
 * These IDs are valid CUIDs format that pass schema validation
 */
export const TEST_IDS = {
  // User IDs
  USER: 'cltestuser1234567890123456',
  USER_2: 'cltestuser2123456789012345',
  USER_3: 'cltestuser3123456789012345',

  // Family IDs
  FAMILY: 'cltestfamily1234567890123',
  FAMILY_2: 'cltestfamily2123456789012',

  // Child IDs
  CHILD: 'cltestchild1123456789012345',
  CHILD_2: 'cltestchild2123456789012345',
  CHILD_3: 'cltestchild3123456789012345',

  // Vehicle IDs
  VEHICLE: 'cltestvh11234567890123456',
  VEHICLE_2: 'cltestvh21234567890123456',
  VEHICLE_3: 'cltestvh31234567890123456',

  // Group IDs
  GROUP: 'cltestgroup123456789012345',
  GROUP_2: 'cltestgroup212345678901234',

  // Schedule/Slot IDs
  SLOT: 'cltestslot11234567890123456',
  SLOT_2: 'cltestslot21234567890123456',

  // Trip IDs
  TRIP: 'cltesttrip11234567890123456',
  TRIP_2: 'cltesttrip21234567890123456',

  // Vehicle Assignment IDs
  VEHICLE_ASSIGNMENT: 'cltestvlassignment1234567890',

  // Invitation IDs
  INVITATION: 'cltestinvit123456789012345',

  // Driver IDs
  DRIVER: 'cltestdriver12345678901234',
} as const;

/**
 * Create a test user object with valid CUID
 */
export const createTestUser = (overrides = {}) => ({
  id: TEST_IDS.USER,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  ...overrides,
});

/**
 * Create a test child object with valid CUID
 */
export const createTestChild = (overrides = {}) => ({
  id: TEST_IDS.CHILD,
  firstName: 'Test',
  lastName: 'Child',
  familyId: TEST_IDS.FAMILY,
  joinedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a test vehicle object with valid CUID
 */
export const createTestVehicle = (overrides = {}) => ({
  id: TEST_IDS.VEHICLE,
  name: 'Test Vehicle',
  capacity: 4,
  familyId: TEST_IDS.FAMILY,
  ...overrides,
});

/**
 * Create a test group object with valid CUID
 */
export const createTestGroup = (overrides = {}) => ({
  id: TEST_IDS.GROUP,
  name: 'Test Group',
  ...overrides,
});

/**
 * Create a test schedule slot object with valid CUIDs
 */
export const createTestScheduleSlot = (overrides = {}) => ({
  id: TEST_IDS.SLOT,
  groupId: TEST_IDS.GROUP,
  datetime: new Date().toISOString(),
  ...overrides,
});

/**
 * Common test dates
 */
export const TEST_DATES = {
  TODAY: new Date().toISOString(),
  TOMORROW: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  YESTERDAY: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  NEXT_WEEK: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
} as const;

/**
 * Helper to replace invalid IDs in existing test data
 */
export const replaceInvalidIds = (data: any, replacements: Record<string, string>) => {
  const dataStr = JSON.stringify(data);
  let result = dataStr;

  Object.entries(replacements).forEach(([invalidId, validId]) => {
    result = result.replace(new RegExp(invalidId, 'g'), validId);
  });

  return JSON.parse(result);
};

/**
 * Common invalid ID patterns found in tests
 */
export const INVALID_ID_PATTERNS = {
  'user-123': TEST_IDS.USER,
  'user-1': TEST_IDS.USER,
  'child-1': TEST_IDS.CHILD,
  'child-2': TEST_IDS.CHILD_2,
  'family-1': TEST_IDS.FAMILY,
  'family-123': TEST_IDS.FAMILY,
  'vehicle-1': TEST_IDS.VEHICLE,
  'trip-1': TEST_IDS.TRIP,
  'trip-2': TEST_IDS.TRIP_2,
  'group-1': TEST_IDS.GROUP,
  'group-123': TEST_IDS.GROUP,
  'slot-1': TEST_IDS.SLOT,
  'schedule-1': TEST_IDS.SLOT,
} as const;

// Legacy exports for backward compatibility
export interface TestEnvironmentConfig {
  DEEP_LINK_BASE_URL?: string;
  FRONTEND_URL?: string;
}

const DEFAULT_TEST_ENV: TestEnvironmentConfig = {
  DEEP_LINK_BASE_URL: 'https://app.edulift.com',
  FRONTEND_URL: 'https://app.edulift.com',
};

export const setupTestEnvironment = function setupTestEnvironment(config: TestEnvironmentConfig = {}): () => void {
  const originalValues: Record<string, string | undefined> = {};

  Object.entries({ ...DEFAULT_TEST_ENV, ...config }).forEach(([key, value]) => {
    originalValues[key] = process.env[key];
    if (value !== undefined) {
      process.env[key] = value;
    }
  });

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

export const TEST_ENVIRONMENTS = {
  WEB: {
    DEEP_LINK_BASE_URL: 'https://app.edulift.com',
    FRONTEND_URL: 'https://app.edulift.com',
  },
  DEEP_LINK: {
    DEEP_LINK_BASE_URL: 'edulift://',
    FRONTEND_URL: 'https://app.edulift.com',
  },
  CUSTOM_DOMAIN: {
    DEEP_LINK_BASE_URL: 'https://custom.example.com',
    FRONTEND_URL: 'https://custom.example.com',
  },
  LOCALHOST: {
    DEEP_LINK_BASE_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
  },
} as const;

/**
 * Malicious URLs for security testing
 */
export const MALICIOUS_URLS = [
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
 */
export const setupMaliciousUrlTest = function setupMaliciousUrlTest(maliciousUrl: string): () => void {
  return setupTestEnvironment({
    DEEP_LINK_BASE_URL: maliciousUrl,
  });
};