/**
 * Standardized user roles used across E2E tests
 * This helps avoid duplication and ensures consistent naming
 */

export const STANDARD_USER_ROLES = {
  // Basic roles
  ADMIN: 'admin',
  MEMBER: 'member',
  COORDINATOR: 'coordinator',
  DRIVER: 'driver',
  
  // Specific functional roles
  GROUP_ADMIN: 'groupAdmin',
  FAMILY_ADMIN: 'familyAdmin',
  SCHEDULE_ADMIN: 'scheduleAdmin',
  
  // Test scenario specific roles
  NEW_USER: 'newUser',
  RETURNING_USER: 'returningUser',
  INVITED_USER: 'invitedUser',
  
  // Security testing roles
  UNAUTHORIZED_USER: 'unauthorizedUser',
  RATE_LIMITED_USER: 'rateLimitedUser',
  
  // Edge case roles
  TIMEZONE_USER: 'timezoneUser',
  NETWORK_TEST_USER: 'networkTestUser',
  LOAD_TEST_USER: 'loadTestUser'
} as const;

export type StandardUserRole = typeof STANDARD_USER_ROLES[keyof typeof STANDARD_USER_ROLES];

/**
 * Common user configurations for different test scenarios
 */
export const USER_CONFIGURATIONS = {
  BASIC_ADMIN: {
    role: STANDARD_USER_ROLES.ADMIN,
    permissions: ['create', 'read', 'update', 'delete'],
    hasFamily: true
  },
  
  BASIC_MEMBER: {
    role: STANDARD_USER_ROLES.MEMBER,
    permissions: ['read'],
    hasFamily: true
  },
  
  GROUP_CREATOR: {
    role: STANDARD_USER_ROLES.GROUP_ADMIN,
    permissions: ['create', 'read', 'update', 'delete', 'invite'],
    hasFamily: true,
    canCreateGroups: true
  },
  
  SCHEDULE_MANAGER: {
    role: STANDARD_USER_ROLES.SCHEDULE_ADMIN,
    permissions: ['create', 'read', 'update', 'delete', 'assign'],
    hasFamily: true,
    canManageSchedules: true
  },
  
  NEW_USER_WITH_INVITATION: {
    role: STANDARD_USER_ROLES.NEW_USER,
    permissions: [],
    hasFamily: false,
    willReceiveInvitation: true,
    shouldNotBePreCreated: true
  }
} as const;

/**
 * Family structure templates for consistent test setup
 */
export const FAMILY_TEMPLATES = {
  SINGLE_ADMIN: {
    adminCount: 1,
    memberCount: 0,
    structure: 'simple'
  },
  
  ADMIN_WITH_MEMBERS: {
    adminCount: 1,
    memberCount: 2,
    structure: 'typical'
  },
  
  MULTI_ADMIN: {
    adminCount: 2,
    memberCount: 1,
    structure: 'shared_admin'
  },
  
  LARGE_FAMILY: {
    adminCount: 1,
    memberCount: 4,
    structure: 'large'
  }
} as const;

/**
 * Group structure templates for test scenarios
 */
export const GROUP_TEMPLATES = {
  SMALL_GROUP: {
    adminFamilyCount: 1,
    memberFamilyCount: 2,
    totalFamilies: 3
  },
  
  MEDIUM_GROUP: {
    adminFamilyCount: 1,
    memberFamilyCount: 4,
    totalFamilies: 5
  },
  
  LARGE_GROUP: {
    adminFamilyCount: 2,
    memberFamilyCount: 6,
    totalFamilies: 8
  },
  
  COORDINATION_GROUP: {
    adminFamilyCount: 1,
    memberFamilyCount: 3,
    totalFamilies: 4,
    hasScheduleCoordination: true,
    hasResourceSharing: true
  }
} as const;

/**
 * Helper function to get standardized user key for file-specific data
 */
export function getStandardUserKey(baseRole: string, variation?: string): string {
  const cleanRole = baseRole.replace(/[^a-zA-Z0-9]/g, '');
  return variation ? `${cleanRole}_${variation}` : cleanRole;
}

/**
 * Helper function to get standardized family key
 */
export function getStandardFamilyKey(userKey: string): string {
  return `${userKey}Family`;
}

/**
 * Helper function to get standardized group key
 */
export function getStandardGroupKey(purpose: string): string {
  return `${purpose}Group`;
}