import { Page, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../tests/fixtures/universal-auth-helper';

export interface CreateUserOptions {
  email: string;
  name: string;
  createFamily?: string;
  skipFamilyCreation?: boolean;
}

export interface TestUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
  family?: {
    id: string;
    name: string;
  };
  inviteCode?: string;
}

/**
 * Clear the test database by calling the backend cleanup endpoint
 */
export async function clearDatabase(): Promise<void> {
  const baseURL = process.env.E2E_BACKEND_URL || 'http://localhost:8002';
  
  try {
    // Call a test-only endpoint to clear database
    const response = await fetch(`${baseURL}/api/test/clear-database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn('Database clear failed, continuing with test...');
    }
  } catch (error) {
    console.warn('Database clear error:', error);
  }
}

/**
 * Create a user with magic link authentication and optionally create a family
 */
export async function createMagicLinkUser(
  page: Page, 
  options: CreateUserOptions
): Promise<TestUser> {
  const { email, name, createFamily, skipFamilyCreation } = options;

  const authHelper = new UniversalAuthHelper(page);
  
  // Extract base name from email for unique user generation
  const baseName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  
  let user;
  let familyInfo = undefined;
  let inviteCode = undefined;

  if (createFamily && !skipFamilyCreation) {
    // Create user with family through onboarding
    user = await authHelper.authenticateUniqueUser(baseName, { isNewUser: true });
    await authHelper.goToPageAsUser(user, '/onboarding', { isNewUser: true });
    
    // Complete onboarding to create family
    await authHelper.completeOnboarding(createFamily);
    
    // Note: Invite code should be obtained from real backend API
    // For now, tests will need to handle real invite code generation
    familyInfo = {
      id: `family-${user.id}`,
      name: createFamily
    };
  } else if (skipFamilyCreation) {
    // Create user without family (for joining families)
    user = await authHelper.authenticateUniqueUser(baseName, { isNewUser: true });
    await authHelper.goToPageAsUser(user, '/dashboard', { isNewUser: true });
  } else {
    // Create existing user with family
    user = await authHelper.quickExistingUserSetup(baseName, '/dashboard');
    familyInfo = {
      id: `family-${user.id}`,
      name: 'Default Family'
    };
  }

  const result: TestUser = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };

  if (familyInfo) {
    result.family = familyInfo;
  }
  
  if (inviteCode) {
    result.inviteCode = inviteCode;
  }

  return result;
}


/**
 * Wait for page to be ready and handle loading states
 */
export async function waitForPageReady(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(1000); // Additional buffer for React hydration
}

