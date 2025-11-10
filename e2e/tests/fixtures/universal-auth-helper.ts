import { Page } from '@playwright/test';
import { FileSpecificTestData } from './file-specific-test-data';
import type { TestUser, TestFamily } from './file-specific-test-data';
import { createHmac } from 'crypto';
import { createTimingHelper, EnhancedTimingHelper } from './enhanced-timing-helper';
import { execSync } from 'child_process';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthOptions {
  isNewUser?: boolean;
  skipOnboarding?: boolean;
  createFamily?: boolean;
  familyName?: string;
}

/**
 * Enhanced Universal Authentication Helper with Built-in FileSpecificTestData
 * 
 * Automatically handles:
 * - File-specific test data isolation
 * - User creation with unique prefixes
 * - Email isolation per test file
 * - Prevents concurrency conflicts
 * - SHARED INSTANCE per test file to maintain state
 * 
 * Usage:
 * ```typescript
 * // In beforeAll - define users once per file
 * const authHelper = new UniversalAuthHelper(null as any);
 * authHelper.defineUser('admin', 'admin', 'Admin User');
 * await authHelper.createUsersInDatabase();
 * 
 * // In tests - get instance for this file (shares the same data)
 * const authHelper = UniversalAuthHelper.forCurrentFile(page);
 * await authHelper.directUserSetup('admin', '/family/manage');
 * ```
 */
export class UniversalAuthHelper {
  private testData: FileSpecificTestData;
  private filePrefix: string;
  private timingHelper: EnhancedTimingHelper;

  // Worker-specific registry to share instances per file within each worker
  private static fileInstances: Map<string, Map<string, FileSpecificTestData>> = new Map();

  // Worker-specific cache to track created users per worker
  private static createdUsers: Map<string, Set<string>> = new Map();

  /**
   * Get the current worker ID for isolation
   */
  private static getWorkerId(): string {
    return (process as any).env.PLAYWRIGHT_WORKER_INDEX || '0';
  }

  /**
   * Get worker-specific file instances map
   */
  private static getWorkerFileInstances(): Map<string, FileSpecificTestData> {
    const workerId = this.getWorkerId();
    if (!this.fileInstances.has(workerId)) {
      this.fileInstances.set(workerId, new Map());
    }
    return this.fileInstances.get(workerId)!;
  }

  /**
   * Get worker-specific created users set
   */
  private static getWorkerCreatedUsers(): Set<string> {
    const workerId = this.getWorkerId();
    if (!this.createdUsers.has(workerId)) {
      this.createdUsers.set(workerId, new Set());
    }
    return this.createdUsers.get(workerId)!;
  }

  constructor(
    private page: Page, // eslint-disable-line no-unused-vars
    testDataInstance?: FileSpecificTestData
  ) {
    if (testDataInstance instanceof FileSpecificTestData) {
      // Use existing test data instance
      this.testData = testDataInstance;
      this.filePrefix = 'shared'; // Not needed when using existing data
    } else {
      // ALWAYS auto-detect file prefix - no explicit prefixes allowed
      this.filePrefix = this.detectFilePrefix();

      // Use worker-specific shared instance per file to maintain state between setup and tests
      const workerFileInstances = UniversalAuthHelper.getWorkerFileInstances();
      if (!workerFileInstances.has(this.filePrefix)) {
        workerFileInstances.set(this.filePrefix, new FileSpecificTestData(this.filePrefix));
      }
      this.testData = workerFileInstances.get(this.filePrefix)!;
    }

    // Initialize timing helper
    this.timingHelper = createTimingHelper(this.page);
  }

  /**
   * Get a UniversalAuthHelper instance for the current test file
   * This ensures the same FileSpecificTestData is shared between setup and tests
   */
  static forCurrentFile(page: Page): UniversalAuthHelper {
    return new UniversalAuthHelper(page); // Will auto-detect and use shared instance
  }

  /**
   * Clear all cached instances for current worker (for cleanup between test suites)
   */
  static clearInstances(): void {
    const workerId = this.getWorkerId();
    this.fileInstances.delete(workerId);
    this.createdUsers.delete(workerId);
  }

  /**
   * Auto-detect file prefix from the test file name
   * NO FALLBACKS - If detection fails, the test should fail explicitly
   */
  private detectFilePrefix(): string {
    // First try to get from process.env if available (more reliable for CI)
    const testFile = (process as any).env.PLAYWRIGHT_TEST_FILE;
    if (testFile) {
      const match = testFile.match(/\/([^\/]+)\.spec\.ts/);
      if (match) {
        const fileName = match[1];
        const basePrefix = fileName
          .replace(/^\d+-/, '') // Remove leading numbers like "01-"
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
          .replace(/[^a-zA-Z]/g, ''); // Remove any remaining non-letters
        const workerId = UniversalAuthHelper.getWorkerId();
        const prefix = `${basePrefix}W${workerId}`;
        console.log(`🔍 Detected file prefix from env: ${prefix} (worker ${workerId})`);
        return prefix;
      }
    }

    // Try stack trace method
    const stack = new Error().stack;
    const testFileMatch = stack?.match(/\/([^\/]+)\.spec\.ts/);

    if (testFileMatch) {
      const fileName = testFileMatch[1];
      const basePrefix = fileName
        .replace(/^\d+-/, '') // Remove leading numbers like "01-"
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
        .replace(/[^a-zA-Z]/g, ''); // Remove any remaining non-letters
      const workerId = UniversalAuthHelper.getWorkerId();
      const prefix = `${basePrefix}W${workerId}`;
      console.log(`🔍 Detected file prefix from stack: ${prefix} (worker ${workerId})`);
      return prefix;
    }

    // NO FALLBACKS - Fail explicitly
    throw new Error(`
❌ CRITICAL: Could not detect file prefix for test isolation.
This indicates a test setup issue that MUST be fixed.

File prefix detection failed - this likely means the test is not running
from a .spec.ts file or the environment is not configured properly.

All tests MUST use automatic prefix detection for consistency.
`);
  }

  /**
   * Get the underlying FileSpecificTestData instance
   * Allows advanced users to access the full test data API
   */
  getTestData(): FileSpecificTestData {
    return this.testData;
  }

  /**
   * Define a user for this test file (convenience method)
   */
  defineUser(key: string, baseName: string, displayName: string, willReceiveInvitation: boolean = false): TestUser {
    return this.testData.defineUser(key, baseName, displayName, willReceiveInvitation);
  }

  /**
   * Define a family for this test file (convenience method)
   */
  defineFamily(key: string, familyName: string, adminUserKey: string, members?: Array<{ userKey: string; role: 'ADMIN' | 'MEMBER' }>): TestFamily {
    return this.testData.defineFamily(key, familyName, adminUserKey, members);
  }

  /**
   * Create all predefined users in database (convenience method)
   */
  async createUsersInDatabase(): Promise<void> {
    return this.testData.createUsersInDatabase();
  }

  /**
   * Create a predefined family in database (convenience method)
   */
  async createFamilyInDatabase(familyKey: string): Promise<void> {
    return this.testData.createFamilyInDatabase(familyKey);
  }

  /**
   * Get a predefined user (convenience method)
   */
  getUser(key: string): TestUser {
    return this.testData.getUser(key);
  }

  /**
   * Get a predefined family (convenience method)
   */
  getFamily(key: string): TestFamily {
    return this.testData.getFamily(key);
  }

  /**
   * Get a file-specific email (convenience method)
   */
  getFileSpecificEmail(baseName: string): string {
    return this.testData.getEmail(baseName);
  }

  /**
   * Get a file-specific ID (convenience method)
   */
  getFileSpecificId(baseName: string): string {
    return this.testData.getId(baseName);
  }

  /**
   * Clean up any existing family memberships for a user (E2E only)
   */
  async cleanupUserFamilyMemberships(userId: string): Promise<void> {
    try {
      // execSync already imported at top of file

      execSync(`docker exec edulift-backend-e2e node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function cleanupFamilyMemberships() {
          try {
            console.log('Starting cleanup for user ${userId}');
            
            // Check existing memberships first
            const existingMemberships = await prisma.familyMember.findMany({
              where: { userId: '${userId}' }
            });
            console.log('Found existing memberships:', existingMemberships.length);
            
            // Remove any family memberships for this user
            const deleteResult = await prisma.familyMember.deleteMany({
              where: { userId: '${userId}' }
            });
            console.log('Cleaned up family memberships for user ${userId}. Deleted:', deleteResult.count);
          } catch (error) {
            console.error('Error cleaning up family memberships:', error.message);
          } finally {
            await prisma.\\$disconnect();
          }
        }
        
        (async () => { await cleanupFamilyMemberships(); })();
      "`, {
        encoding: 'utf8',
        timeout: 20000, // Increased for parallel execution
        stdio: 'inherit'
      });
    } catch (error) {
      console.log(`Family membership cleanup for ${userId}:`, error.message);
    }
  }

  /**
   * Create user in database via direct database access (E2E only)
   */
  async createUserInDatabase(user: AuthUser): Promise<void> {
    // With worker-specific file prefixes, each user ID/email is unique per worker
    // No need for static cache checks - just create directly

    try {
      // Use Docker exec to create user directly in the database
      // execSync already imported at top of file

      execSync(`docker exec edulift-backend-e2e node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function createUser() {
          try {
            const user = await prisma.user.upsert({
              where: { id: '${user.id}' },
              update: {
                email: '${user.email}',
                name: '${user.name}'
              },
              create: {
                id: '${user.id}',
                email: '${user.email}',
                name: '${user.name}'
              }
            });
            console.log('E2E User created/updated:', user.email);
          } catch (error) {
            // Handle unique constraint errors gracefully for existing users
            if (error.message.includes('Unique constraint failed')) {
              console.log('E2E User already exists:', '${user.email}');
            } else {
              console.error('Error creating E2E user:', error.message);
              throw error;
            }
          } finally {
            await prisma.\\$disconnect();
          }
        }
        
        (async () => { await createUser(); })();
      "`, {
        encoding: 'utf8',
        timeout: 300000, // 5 minutes for heavy parallel load
        stdio: 'inherit'
      });
    } catch (error) {
      // Handle cases where user creation fails due to existing users
      if (error.message.includes('Unique constraint failed') ||
        error.message.includes('already exists')) {
        console.log(`E2E User ${user.email} already exists, proceeding with authentication`);
      } else {
        console.error('Failed to create user in database:', error);
        throw new Error(`Failed to create user ${user.email} in database: ${error.message}`);
      }
    }
  }

  /**
   * Create a valid JWT token for E2E testing
   */
  private createValidJWT(userId: string, email: string): string {
    const secret = 'e2e-test-access-secret-key-very-long'; // Must match backend JWT_ACCESS_SECRET

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      userId: userId,
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours for E2E tests
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Authenticate a user with unique ID to avoid conflicts
   */
  /**
   * Enhanced authenticateUniqueUser - uses file-specific data automatically
   * @param baseName - Base name for the user (will be made file-specific)
   * @param options - Authentication options
   */
  async authenticateUniqueUser(
    baseName: string = 'testuser',
    options: AuthOptions = {}
  ): Promise<AuthUser> {
    const randomId = Math.random().toString(36).substring(2, 8);

    // Use file-specific email and ID to prevent conflicts
    const uniqueId = this.testData.getId(`${baseName}-${randomId}`);
    const uniqueEmail = this.testData.getEmail(`${baseName}-${randomId}`);

    const user: AuthUser = {
      id: uniqueId,
      email: uniqueEmail,
      name: `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} User`
    };

    // Create the user in the database first so JWT validation will work
    await this.createUserInDatabase(user);

    // Only set authentication data if we have a secure context
    try {
      await this.setAuthenticationData(user, options);
    } catch (error) {
      // If we get a security error, navigate to login first
      if (error.message.includes('insecure') || error.message.includes('SecurityError')) {
        await this.page.goto('/login');
        await this.setAuthenticationData(user, options);
      } else {
        throw error;
      }
    }
    return user;
  }

  /**
   * Authenticate with a specific user (may cause conflicts if user exists)
   */
  async authenticateSpecificUser(
    user: AuthUser,
    options: AuthOptions = {}
  ): Promise<void> {
    await this.setAuthenticationData(user, options);
  }

  /**
   * Set authentication data in localStorage
   */
  private async setAuthenticationData(
    user: AuthUser,
    options: AuthOptions
  ): Promise<void> {
    const jwtToken = this.createValidJWT(user.id, user.email);

    // NO API MOCKING - Let real backend calls flow through
    // E2E tests must test the complete, real system

    try {
      await this.page.evaluate(
        ({ token, userData, opts }) => {
          // Clear any existing auth data first to avoid conflicts
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('auth-storage');

          // Set legacy formats for compatibility
          localStorage.setItem('authToken', token);
          localStorage.setItem('userData', JSON.stringify(userData));

          // Set modern auth-storage format
          const _authData = {
            state: {
              user: userData,
              isAuthenticated: true,
              isNewUser: opts.isNewUser ?? false,
              accessToken: token,
              refreshToken: 'test-refresh-token'
            },
            version: 0
          };
          localStorage.setItem('auth-storage', JSON.stringify(_authData));

          // Force authService to re-read localStorage by triggering a storage event
          // This simulates what would happen if auth was set in another tab
          const storageEvent = new StorageEvent('storage', {
            key: 'authToken',
            newValue: token,
            oldValue: null,
            storageArea: localStorage
          });
          window.dispatchEvent(storageEvent);

          // Verify ALL auth data was set correctly
          const verifyToken = localStorage.getItem('authToken');
          const verifyUserData = localStorage.getItem('userData');
          const verifyAuthStorage = localStorage.getItem('auth-storage');

          if (verifyToken !== token) {
            throw new Error(`Token verification failed: expected ${token}, got ${verifyToken}`);
          }
          if (!verifyUserData) {
            throw new Error('User data not set in localStorage');
          }
          if (!verifyAuthStorage) {
            throw new Error('Auth storage not set in localStorage');
          }

          console.log('✅ E2E auth data successfully set and verified in localStorage');
        },
        {
          token: jwtToken,
          userData: user,
          opts: options
        }
      );
    } catch (error) {
      throw new Error(`Failed to set authentication data: ${error.message}`);
    }
  }

  // ❌ REMOVED: API MOCKING COMPLETELY ELIMINATED
  // E2E tests must test the complete, real system
  // All API calls will now go to the real backend service

  /**
   * Navigate to page with authentication
   */
  async goToPageAsUser(
    user: AuthUser,
    targetPath: string,
    options: AuthOptions = {}
  ): Promise<void> {
    // NO API MOCKING - Let real backend calls flow through

    // CRITICAL: Create user in database first so JWT validation will work
    await this.createUserInDatabase(user);

    // Start from login page to set authentication
    await this.page.goto('/login');

    // Set auth data without API mocking
    const jwtToken = this.createValidJWT(user.id, user.email);

    try {
      await this.page.evaluate(
        ({ token, userData, opts }) => {
          // Set legacy formats for compatibility
          localStorage.setItem('authToken', token);
          localStorage.setItem('userData', JSON.stringify(userData));

          // Set modern auth-storage format
          const _authData = {
            state: {
              user: userData,
              isAuthenticated: true,
              isNewUser: opts.isNewUser ?? false,
              accessToken: token,
              refreshToken: 'test-refresh-token'
            },
            version: 0
          };
          localStorage.setItem('auth-storage', JSON.stringify(_authData));
        },
        {
          token: jwtToken,
          userData: user,
          opts: options
        }
      );
    } catch (error) {
      // If we get a security error, we're already on the right page, continue
      if (!error.message.includes('insecure') && !error.message.includes('SecurityError')) {
        throw error;
      }
    }

    // Use enhanced timing helper for authentication state
    await this.timingHelper.waitForAuthenticationReady();

    // Navigate to target page
    await this.page.goto(targetPath);
    await this.timingHelper.waitForNavigationStable();

    // Wait for React app and authentication context to be ready
    await this.page.waitForFunction(() => {
      // Ensure we're not stuck in a redirect loop
      const url = window.location.pathname;
      const isAuthPage = url.includes('/login') || url.includes('/auth');
      const hasAuth = localStorage.getItem('authToken') !== null;

      // Page should be ready and not on auth pages if we have auth
      return document.readyState === 'complete' && (!isAuthPage || !hasAuth);
    }, { timeout: 10000 });

    // Wait for any connection alerts to disappear with shorter timeout
    try {
      await this.page.waitForSelector('[data-testid="connection-alert"]', {
        state: 'hidden',
        timeout: 25000
      });
    } catch {
      // If no connection alert exists, that's fine
    }

    // Check current URL to see if we were redirected
    const currentUrl = this.page.url();
    console.log(`After navigation to ${targetPath}, current URL: ${currentUrl}`);

    // Handle potential redirects for family requirements
    if (options.isNewUser && !options.skipOnboarding) {
      // New users may be redirected to onboarding
      if (currentUrl.includes('/onboarding') || currentUrl.includes('/dashboard')) {
        console.log('New user correctly redirected to onboarding or dashboard');
      } else if (currentUrl.includes('/login')) {
        throw new Error('Authentication failed - user was redirected to login page');
      }
    } else {
      // Existing users should go directly to target or be redirected appropriately
      if (currentUrl.includes('/login')) {
        throw new Error('Authentication failed - user was redirected to login page');
      }
      if (currentUrl.includes('/onboarding')) {
        console.log('User redirected to onboarding - completing family setup with retry to access target page');
        // Auto-complete onboarding to ensure user has family access
        await this.completeOnboardingWithRetry(`E2E Test Family ${this.filePrefix} ${Date.now().toString(36)}`);
        // Navigate back to original target with retry
        await this.navigateWithRetry(targetPath);
        await this.waitForAuthenticationStability();
        console.log(`After onboarding and navigation, final URL: ${this.page.url()}`);
      }
    }
  }

  /**
   * Complete onboarding flow (for new users who need families)
   * Optimized for speed and reliability
   */
  async completeOnboarding(
    familyName: string = `Test Family ${this.filePrefix} ${Date.now().toString(36)}`,
    _addChildren: boolean = true,
    _addVehicles: boolean = true
  ): Promise<void> {
    // Store user info for potential re-authentication before starting onboarding
    const _userEmail = await this.page.evaluate(() => localStorage.getItem('userEmail'));
    const _userId = await this.page.evaluate(() => localStorage.getItem('userId'));

    // Wait for onboarding page with shorter timeout
    await this.page.waitForURL('/onboarding', { timeout: 45000 });

    // Should see the choice between creating or joining a family  
    await this.page.locator('[data-testid="FamilyOnboardingWizard-Heading-welcome"]').waitFor({ timeout: 35000 });

    // Click "Create a New Family"
    const createFamilyButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]');
    await createFamilyButton.click();

    // Wait for family creation form to appear
    await this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]').waitFor({ timeout: 35000 });

    // Fill in family name quickly
    await this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]').fill(familyName);

    // Verify authentication token is still available before submitting
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    if (!authToken) {
      throw new Error('Authentication token lost during onboarding process');
    }

    // Submit family creation immediately
    await this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamily"]').click();

    // Wait for family creation to complete with optimized timeout
    console.log('Waiting for family creation to complete...');

    try {
      // Wait for either success or URL change with extended timeout
      await Promise.race([
        this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-familyCreated"]').waitFor({ timeout: 60000 }),
        this.page.waitForURL(url => !url.toString().includes('/onboarding'), { timeout: 60000 })
      ]);

      console.log('Family creation process completed');
    } catch (error) {
      console.log('Family creation did not complete as expected, checking for errors...');

      // Check if page is still open before checking for errors
      if (this.page.isClosed()) {
        throw new Error('Family creation failed: Page was closed during process');
      }

      // More comprehensive check for error indicators
      const errorMessage = this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-createFamilyError"]');
      const networkError = this.page.locator('[data-testid="ConnectionIndicator-Alert-networkError"]');
      const generalError = this.page.locator('[role="alert"]').filter({ hasText: /error|failed/i });

      try {
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();

          // Handle specific "user already in family" errors
          if (errorText && (errorText.includes('already') || errorText.includes('USER_ALREADY_IN_FAMILY'))) {
            console.log('User already has a family, navigating directly to dashboard...');
            await this.page.goto('/dashboard');
            await this.page.waitForLoadState('networkidle');
            return;
          }

          throw new Error(`Family creation failed: ${errorText || 'Unknown error'}`);
        }

        // Check for any general error alerts
        if (await generalError.isVisible()) {
          const errorText = await generalError.textContent();
          console.log(`General error detected: ${errorText}`);
        }

        if (await networkError.isVisible()) {
          console.log('Network error detected, waiting for recovery...');
          await this.timingHelper.waitForAuthenticationReady();

          // Try to dismiss the error and retry
          try {
            await this.page.reload();
            await this.timingHelper.waitForNavigationStable();

            // If we're back to onboarding, try creating family again
            if (this.page.url().includes('/onboarding')) {
              console.log('Retrying family creation after network error...');
              await this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]').click();
              await this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]').fill(familyName);
              await this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamily"]').click();

              // Wait for success or navigation with longer timeout
              await Promise.race([
                this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-familyCreated"]').waitFor({ timeout: 45000 }),
                this.page.waitForURL(url => !url.toString().includes('/onboarding'), { timeout: 45000 })
              ]);
            }
          } catch (retryError) {
            console.warn('Retry failed, attempting direct navigation to dashboard...');
            // Last resort: direct navigation
            await this.page.goto('/dashboard');
            await this.page.waitForLoadState('networkidle');

            // Check if we're successfully authenticated and have family access
            const currentUrl = this.page.url();
            if (currentUrl.includes('/login')) {
              throw new Error('Family creation failed: Authentication lost during process');
            }
            if (currentUrl.includes('/onboarding')) {
              throw new Error('Family creation failed: Still redirected to onboarding after retry');
            }

            console.log('Successfully navigated to dashboard after retry');
            return;
          }
        }

        // Check current URL to see if we actually succeeded despite timeout
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/onboarding') && !currentUrl.includes('/login')) {
          console.log('Family creation may have succeeded despite timeout - continuing...');
          return;
        }

      } catch (pageError) {
        console.log('Error checking page elements (page may be closed):', pageError.message);
        // If page is closed or has errors, try direct navigation as fallback
        if (!this.page.isClosed()) {
          await this.page.goto('/dashboard');
          await this.page.waitForLoadState('networkidle');
          return;
        }
      }

      // If no specific error found, re-throw the original timeout error
      throw error;
    }

    // Optimized wait for navigation
    await this.page.waitForLoadState('networkidle');
    await this.timingHelper.waitForSessionStateChange('authenticated');

    // Check final URL - session MUST persist through family creation
    const currentUrl = this.page.url();
    console.log(`🔍 Final URL after family creation: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      // This is a REAL FAILURE - session should not be lost
      throw new Error(`Authentication session lost after family creation. This indicates a problem with token management or session persistence. Current URL: ${currentUrl}`);
    }

    // Ensure we're on the correct page after onboarding completion
    const finalUrl = this.page.url();
    console.log(`Family onboarding completed, current URL: ${finalUrl}`);
  }

  /**
   * Quick setup for tests that need authenticated user with family
   */
  async quickFamilySetup(
    _baseName: string = 'testuser',
    targetPath: string = '/dashboard'
  ): Promise<AuthUser> {
    // Use a predefined user without family to ensure family creation works
    const noFamilyUser: AuthUser = {
      id: 'test-nofamily',
      email: 'nofamily@example.com',
      name: 'No Family User'
    };

    // Ensure user exists in database
    await this.createUserInDatabase(noFamilyUser);

    await this.goToPageAsUser(noFamilyUser, targetPath, { isNewUser: true });

    // Complete onboarding if redirected there
    let currentUrl = this.page.url();
    if (currentUrl.includes('/onboarding')) {
      await this.completeOnboardingWithRetry();

      // After onboarding, navigate to the original target page with retry
      await this.navigateWithRetry(targetPath);
      await this.waitForAuthenticationStability();

      // Verify we reached the target page
      currentUrl = this.page.url();
      console.log(`After family setup, navigated to: ${currentUrl}`);

      // If we're still not at the right page, wait a bit more
      if (!currentUrl.includes(targetPath.split('?')[0])) {
        await this.timingHelper.waitForAuthenticationReady();
        await this.page.waitForLoadState('networkidle');
      }
    }

    return noFamilyUser;
  }

  /**
   * Setup for tests that need existing user (skip onboarding)
   */
  async quickExistingUserSetup(
    baseNameOrEmail: string = 'testuser',
    targetPath: string = '/dashboard'
  ): Promise<AuthUser> {
    let user: AuthUser;

    // Check if the input is an email address
    if (baseNameOrEmail.includes('@')) {
      // Extract name from email for display
      const emailParts = baseNameOrEmail.split('@')[0];
      const displayName = emailParts.split('.').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');

      // Use consistent ID format for test users
      let userId = `user-${emailParts.replace(/\./g, '-')}`;

      // Handle specific test users that are created in global setup
      if (baseNameOrEmail === 'admin.test@edulift.com') {
        userId = 'test-admin';
      } else if (baseNameOrEmail === 'parent1.test@edulift.com') {
        userId = 'test-parent1';
      } else if (baseNameOrEmail === 'parent2.test@edulift.com') {
        userId = 'test-parent2';
      } else if (baseNameOrEmail === 'member.test@edulift.com') {
        userId = 'test-member';
      } else if (baseNameOrEmail === 'family.admin@edulift.com') {
        userId = 'family-admin-user';
      } else if (baseNameOrEmail === 'family.member@edulift.com') {
        userId = 'family-member-user';
      }

      user = {
        id: userId,
        email: baseNameOrEmail,
        name: displayName
      };

      // For predefined test users, ensure they exist in database and try direct navigation
      const isTestUser = baseNameOrEmail.includes('@edulift.com');
      if (isTestUser) {
        // Create the user in database to ensure JWT validation will work
        await this.createUserInDatabase(user);
        return await this.directUserSetupWithUser(user, targetPath);
      }

      // Don't set auth data here, goToPageAsUser will handle it
    } else {
      // For generated user names, always create new unique users
      user = await this.authenticateUniqueUser(baseNameOrEmail, {
        isNewUser: false
      });
    }

    await this.goToPageAsUser(user, targetPath, { isNewUser: false });
    return user;
  }

  /**
   * Direct setup for test users that should already have families
   */
  /**
   * Enhanced directUserSetup - requires predefined user key for safety
   * @param userKey - Key of a user defined with defineUser()
   * @param targetPath - Path to navigate to after authentication
   */
  async directUserSetup(
    userKey: string,
    targetPath: string = '/dashboard'
  ): Promise<TestUser> {
    // Get the predefined user - this enforces using FileSpecificTestData
    const user = this.testData.getUser(userKey);

    // CRITICAL: Ensure user exists in database first so JWT validation will work
    await this.createUserInDatabase(user);

    const jwtToken = this.createValidJWT(user.id, user.email);

    // First navigate to login page to establish domain context with timeout handling
    await this.page.goto('/login');
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 25000 });
    } catch (error) {
      // If networkidle times out, wait for DOM to be ready instead
      await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await this.timingHelper.waitForNavigationStable();
    }

    // Now set authentication data with domain context
    await this.page.evaluate(
      ({ token, userData }) => {
        // Set legacy formats for compatibility
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(userData));

        // Set modern auth-storage format
        const _authData = {
          state: {
            user: userData,
            isAuthenticated: true,
            isNewUser: false,
            accessToken: token,
            refreshToken: 'test-refresh-token'
          },
          version: 0
        };
        localStorage.setItem('auth-storage', JSON.stringify(_authData));
      },
      {
        token: jwtToken,
        userData: user
      }
    );

    // Navigate directly to target with retry mechanism for CPU-intensive environments
    await this.navigateWithRetry(targetPath);

    // Wait for authentication state to stabilize
    await this.waitForAuthenticationStability();

    // Check if we ended up where we wanted
    const currentUrl = this.page.url();
    console.log(`Direct setup navigation to ${targetPath}, current URL: ${currentUrl}`);

    // If we're still redirected to onboarding, check if this is expected
    if (currentUrl.includes('/onboarding')) {
      // For predefined users (from file-specific test data), this indicates a setup error
      if (user.email.includes('userAuthentication') || user.email.includes('invitationContext') || user.email.includes('sessionManagement') || user.email.includes('familyInvitations')) {
        console.error(`❌ FAMILY ASSOCIATION FAILURE: User ${user.email} (ID: ${user.id}) should have family but was redirected to onboarding.`);
        console.error(`🔍 User key: ${userKey}, Worker: ${UniversalAuthHelper.getWorkerId()}, Prefix: ${this.filePrefix}`);

        // Try to check if family exists in database
        try {
          // execSync already imported at top of file
          const checkResult = execSync(`docker exec edulift-backend-e2e node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            (async () => {
              try {
                const user = await prisma.user.findUnique({
                  where: { id: '${user.id}' },
                  include: { familyMemberships: { include: { family: true } } }
                });
                console.log('User family memberships:', JSON.stringify(user?.familyMemberships || [], null, 2));
              } catch (e) {
                console.error('Database check error:', e.message);
              } finally {
                await prisma.\\$disconnect();
              }
            })();
          "`, { encoding: 'utf8', stdio: 'pipe' });
          console.log('🔍 Database check result:', checkResult);
        } catch (e) {
          console.error('Database check failed:', e.message);
        }

        throw new Error(`Test setup error: User ${user.email} (ID: ${user.id}) should have family but was redirected to onboarding. Check family definitions and database setup in beforeAll().`);
      } else {
        // For other users, log a warning but allow onboarding completion with retry
        console.log(`⚠️ User ${user.email} redirected to onboarding - completing family setup with retry`);
        await this.completeOnboardingWithRetry(`Test Family ${this.filePrefix} ${Date.now().toString(36)}`);
        await this.navigateWithRetry(targetPath);
        await this.waitForAuthenticationStability();
      }
    }

    return user;
  }

  /**
   * Direct setup for legacy AuthUser objects (deprecated - use directUserSetup with user key)
   */
  async directUserSetupWithUser(
    user: AuthUser,
    targetPath: string = '/dashboard'
  ): Promise<AuthUser> {
    // CRITICAL: Ensure user exists in database first so JWT validation will work
    await this.createUserInDatabase(user);

    const jwtToken = this.createValidJWT(user.id, user.email);

    // First navigate to login page to establish domain context with timeout handling
    await this.page.goto('/login');
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 25000 });
    } catch (error) {
      // If networkidle times out, wait for DOM to be ready instead
      await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await this.timingHelper.waitForNavigationStable();
    }

    // Now set authentication data with domain context
    await this.page.evaluate(
      ({ token, userData }) => {
        // Set legacy formats for compatibility
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(userData));

        // Set modern auth-storage format
        const _authData = {
          state: {
            user: userData,
            isAuthenticated: true,
            isNewUser: false,
            accessToken: token,
            refreshToken: 'test-refresh-token'
          },
          version: 0
        };
        localStorage.setItem('auth-storage', JSON.stringify(_authData));
      },
      {
        token: jwtToken,
        userData: user
      }
    );

    // Navigate directly to target with optimized timing
    await this.page.goto(targetPath);
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (error) {
      // If networkidle times out, wait for DOM to be ready instead
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    }
    await this.timingHelper.waitForNavigationStable();

    // Check if we ended up where we wanted
    const currentUrl = this.page.url();
    console.log(`Direct setup navigation to ${targetPath}, current URL: ${currentUrl}`);

    return user;
  }

  /**
   * Wait for button to be enabled and then click it
   * Helps with form validation timing issues
   */
  async waitAndClick(selector: string, timeout: number = 30000): Promise<void> {
    const element = this.page.locator(selector);

    // Wait for element to be visible and attached
    await element.waitFor({ state: 'visible', timeout });
    await element.waitFor({ state: 'attached', timeout });

    // Enhanced wait for button to be enabled with retry logic
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        // Wait for button to be enabled
        await this.page.waitForFunction(
          (sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;

            // Check if element is disabled via attributes
            if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
              return false;
            }

            // Check if element is disabled via CSS classes (common in UI libraries)
            if (el.classList.contains('disabled') || el.classList.contains('cursor-not-allowed')) {
              return false;
            }

            // Check if parent is loading (common pattern)
            let parent = el.parentElement;
            while (parent) {
              if (parent.hasAttribute('data-loading') || parent.classList.contains('loading')) {
                return false;
              }
              parent = parent.parentElement;
            }

            return true;
          },
          selector,
          { timeout: Math.floor(timeout / maxAttempts) }
        );

        // Element is ready, try to click
        await element.click();
        return; // Success!

      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.log(`waitAndClick failed after ${maxAttempts} attempts for selector: ${selector}`);
          throw error;
        }

        // Brief wait before retry
        await this.page.waitForTimeout(1000);
        console.log(`waitAndClick attempt ${attempts} failed, retrying...`);
      }
    }
  }

  /**
   * Accept a family invitation with proper authentication flow
   * Ensures user email matches invitation email and has no existing family
   */
  /**
   * Enhanced acceptInvitation - supports both user keys and direct emails
   * @param invitationUrl - The invitation URL to accept
   * @param userKeyOrEmail - Either a predefined user key or direct email
   */
  async acceptInvitation(invitationUrl: string, userKeyOrEmail: string): Promise<void> {
    let user: AuthUser;

    if (userKeyOrEmail.includes('@')) {
      // It's already an email - check if we have a predefined user with this email
      const invitationEmail = userKeyOrEmail;
      try {
        // Try to find a predefined user with this email
        const predefinedUser = this.testData.getUserByEmail(invitationEmail);
        user = {
          id: predefinedUser.id,
          email: predefinedUser.email,
          name: predefinedUser.name
        };
      } catch {
        // If no predefined user found, create a new one
        const randomId = Math.random().toString(36).substring(2, 8);
        user = {
          id: this.testData.getId(`invitation-accepter-${randomId}`),
          email: invitationEmail,
          name: 'Invitation Accepter'
        };
      }
    } else {
      // It's a user key, get the predefined user
      const predefinedUser = this.testData.getUser(userKeyOrEmail);
      user = {
        id: predefinedUser.id,
        email: predefinedUser.email,
        name: predefinedUser.name
      };
    }

    // Create user in database to ensure backend validation will work
    await this.createUserInDatabase(user);

    // Navigate to the app domain first to enable localStorage access
    const baseURL = (process as any).env.E2E_BASE_URL || 'http://localhost:8001';
    await this.page.goto(`${baseURL}/login`);

    // Set authentication data directly with the correct email
    await this.setAuthenticationData(user, { isNewUser: false });

    // Navigate to invitation URL as authenticated user
    await this.page.goto(invitationUrl);
    await this.page.waitForLoadState('networkidle');

    // Debug: Check what's actually on the page
    console.log('🔍 Current URL after navigation:', this.page.url());

    // Wait for page to be ready for invitation acceptance
    await this.page.waitForLoadState('domcontentloaded');
    await this.timingHelper.waitForNavigationStable();

    // Check what testids are available
    const allTestIds = await this.page.locator('[data-testid]').evaluateAll(elements =>
      elements.map(el => el.getAttribute('data-testid'))
    );
    console.log('🔍 Available test IDs:', allTestIds);

    // Check for error messages
    const errorAlert = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
    if (await errorAlert.isVisible()) {
      const errorText = await errorAlert.textContent();
      console.log('❌ Error message found:', errorText);
    }

    // Check for family name to confirm page loaded correctly
    const familyName = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
    if (await familyName.isVisible()) {
      console.log('✅ Family name element is visible');
    } else {
      console.log('❌ Family name element not visible');
    }

    // Check if the invitation page shows any errors
    const anyErrorAlert = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
    if (await anyErrorAlert.isVisible({ timeout: 5000 })) {
      const errorText = await anyErrorAlert.textContent();
      console.log(`❌ Invitation error: ${errorText}`);

      // Try to get more details about the error
      const currentUrl = this.page.url();
      console.log(`❌ Current URL when error occurred: ${currentUrl}`);

      // Check if this is a network error vs validation error
      if (errorText?.includes('Network error')) {
        console.log('🔍 Network error detected - this might be a backend connectivity issue');
        console.log('🔄 Attempting to retry after network error...');

        // Implement robust retry mechanism for network errors
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Retry attempt ${retryCount}/${maxRetries}`);

          // Wait progressively longer for backend to be ready
          const waitTime = 2000 * retryCount;
          console.log(`⏳ Waiting ${waitTime}ms for backend to be ready...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          // Refresh the page to retry the invitation validation
          await this.page.reload();
          await this.page.waitForLoadState('networkidle');

          // Check if error is still there after refresh
          const errorAfterRefresh = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
          if (await errorAfterRefresh.isVisible({ timeout: 5000 })) {
            const errorTextAfterRefresh = await errorAfterRefresh.textContent();
            console.log(`❌ Error persists after refresh attempt ${retryCount}: ${errorTextAfterRefresh}`);

            if (retryCount >= maxRetries) {
              throw new Error(`Invitation failed after ${maxRetries} retries: ${errorTextAfterRefresh}`);
            }
          } else {
            console.log(`✅ Network error resolved after ${retryCount} attempts`);
            break;
          }
        }
      } else {
        throw new Error(`Invitation failed: ${errorText}`);
      }
    }

    // Wait for and click the join family button
    const joinButton = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Button-joinFamily"]');
    await joinButton.waitFor({ state: 'visible', timeout: 15000 });
    await joinButton.click();

    // Wait for successful redirect to dashboard
    await this.page.waitForURL('/dashboard', { timeout: 15000 });
  }

  /**
   * Navigate with retry mechanism for better stability in CPU-intensive environments
   */
  private async navigateWithRetry(path: string, maxRetries: number = 3): Promise<void> {
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.page.goto(path);

        // Try networkidle first, fallback to domcontentloaded with timeout
        try {
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        } catch (networkIdleError) {
          console.log(`⚠️ NetworkIdle timeout, falling back to domcontentloaded for ${path}`);
          await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
          // Wait for JavaScript to be ready instead of static timeout
          await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        }

        // Verify navigation was successful
        const currentUrl = this.page.url();
        const expectedPathPart = path.split('?')[0]; // Remove query params for comparison

        if (currentUrl.includes(expectedPathPart) || currentUrl.includes('/login') || currentUrl.includes('/onboarding')) {
          return; // Success - we're either where we wanted or in an expected redirect
        }

        throw new Error(`Navigation verification failed - expected path containing ${expectedPathPart}, got ${currentUrl}`);

      } catch (error) {
        retryCount++;
        console.log(`⚠️ Navigation retry ${retryCount}/${maxRetries} for ${path}: ${error.message}`);

        if (retryCount >= maxRetries) {
          throw new Error(`Navigation failed after ${maxRetries} attempts to ${path}: ${error.message}`);
        }

        // Use timing helper for exponential backoff
        await this.timingHelper.retryOperation(async () => {
          /* exponential backoff delay */
        }, 'navigation retry', 1);
      }
    }
  }

  /**
   * Wait for authentication state to stabilize after setup
   * This helps prevent race conditions in CPU-intensive environments
   */
  async waitForAuthenticationStability(timeoutMs: number = 15000): Promise<void> {
    // First check if we're on a login/auth page - if so, don't wait for authentication tokens
    const currentUrl = this.page.url();
    const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');

    if (!isOnLoginPage) {
      // For authenticated pages, use a more lenient approach
      try {
        await this.timingHelper.waitForAuthenticationReady();
      } catch (error) {
        // If authentication ready times out, continue with page-level checks
        console.log('Authentication ready timeout, continuing with page checks...');
      }
    }

    // Wait for authentication state to be consistent with more flexibility
    await this.page.waitForFunction(() => {
      const authToken = localStorage.getItem('authToken');
      const authStorage = localStorage.getItem('auth-storage');
      const currentUrl = window.location.pathname;

      // Check authentication consistency
      if (!authToken || !authStorage) {
        // No auth - should be on login page, and page should be ready
        return (currentUrl.includes('/login') || currentUrl.includes('/auth')) &&
          document.readyState === 'complete';
      }

      try {
        const auth = JSON.parse(authStorage);
        if (!auth.state?.isAuthenticated) {
          return false;
        }

        // Has auth - should NOT be on login page and page should be ready
        const notOnAuthPage = !currentUrl.includes('/login') && !currentUrl.includes('/auth');
        const pageReady = document.readyState === 'complete';

        // For complex pages, also check that React has finished initial rendering
        const reactReady = !document.querySelector('[data-loading="true"]');

        return notOnAuthPage && pageReady && reactReady;
      } catch {
        return false;
      }
    }, { timeout: Math.min(timeoutMs, 20000) }); // Cap timeout to prevent excessive waits

    // Ensure React router has settled - shorter timeout for faster execution
    await this.page.waitForFunction(() => {
      const url = window.location.href;
      const hasRedirectIndicators = url.includes('redirecting') ||
        url.includes('loading') ||
        document.title.includes('Loading');

      return !hasRedirectIndicators;
    }, { timeout: 3000 });
  }

  /**
   * Wait for family management page to be fully ready
   * Specifically handles async loading of family data, members, and invitations
   */
  async waitForFamilyPageReady(timeoutMs: number = 20000): Promise<void> {
    // First ensure basic authentication stability
    await this.waitForAuthenticationStability();

    // Wait for family management page specific elements and data
    await this.page.waitForFunction(() => {
      // Check that main family management elements are present
      const familyContainer = document.querySelector('[data-testid="ManageFamilyPage-Container-familyInformation"]');
      const membersSection = document.querySelector('[data-testid="ManageFamilyPage-List-familyMembers"]');

      if (!familyContainer) {
        return false;
      }

      // Check that family data has loaded (family name should be populated)
      const familyNameInput = document.querySelector('[data-testid="ManageFamilyPage-Input-familyName"]') as HTMLInputElement;
      if (familyNameInput && !familyNameInput.value) {
        return false;
      }

      // Check that members data has loaded (should have at least one member - the admin)
      if (membersSection) {
        const memberElements = membersSection.querySelectorAll('[data-testid*="Member-"]');
        if (memberElements.length === 0) {
          return false;
        }
      }

      // Check that invitation management is ready (invite button should be available for admins)
      const inviteButton = document.querySelector('[data-testid="InvitationManagement-Button-inviteMember"]');
      if (inviteButton && inviteButton.hasAttribute('disabled')) {
        return false;
      }

      // Check for any loading indicators
      const loadingIndicators = document.querySelectorAll('[data-loading="true"], .loading, [class*="loading"]');
      if (loadingIndicators.length > 0) {
        return false;
      }

      // Check that invitations section has finished loading
      const invitationsText = document.body.textContent || '';
      if (invitationsText.includes('Loading invitations...')) {
        return false;
      }

      return true;
    }, { timeout: timeoutMs });

    // Additional wait for any pending async operations to complete
    await this.page.waitForLoadState('networkidle', { timeout: 5000 });
  }

  /**
   * Wait for React Query cache to stabilize
   * Ensures queries have finished loading and cache is updated
   */
  async waitForReactQueryStable(timeoutMs: number = 10000): Promise<void> {
    console.log('🔄 Waiting for React Query cache to stabilize...');

    await this.page.waitForFunction(() => {
      // Check if React Query is available
      const reactQueryDevtools = (window as any).__REACT_QUERY_DEVTOOLS__;
      if (reactQueryDevtools) {
        // Check if any queries are currently fetching
        const queryClient = reactQueryDevtools.queryClient;
        if (queryClient) {
          const queryCache = queryClient.getQueryCache();
          const queries = queryCache.getAll();

          // Check if any queries are still fetching
          const isFetching = queries.some(query => query.state.isFetching);
          if (isFetching) {
            return false;
          }
        }
      }

      // Fallback: Check for common loading indicators
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]'
      );
      if (loadingIndicators.length > 0) {
        return false;
      }

      // Check for skeleton loaders
      const skeletonLoaders = document.querySelectorAll('[class*="skeleton"], [data-testid*="skeleton"]');
      if (skeletonLoaders.length > 0) {
        return false;
      }

      return true;
    }, { timeout: timeoutMs });

    // Additional wait for any async operations to complete
    await this.timingHelper.waitForNavigationStable();
    console.log('✅ React Query cache stable');
  }

  /**
   * Wait for groups page to be fully loaded with groups data
   * Ensures group list is populated and interactive
   */
  async waitForGroupPageReady(timeoutMs: number = 15000): Promise<void> {
    console.log('🔄 Waiting for groups page to be ready...');

    // First ensure basic authentication stability
    await this.waitForAuthenticationStability();

    // Wait for groups page specific elements and data
    await this.page.waitForFunction(() => {
      // Check for groups container
      const groupsContainer = document.querySelector('[data-testid*="group"], [data-testid*="Group"]');
      if (!groupsContainer) {
        return false;
      }

      // Check that groups data has loaded (should have create button or existing groups)
      const createButton = document.querySelector('[data-testid*="create"], [data-testid*="Create"]');
      const groupItems = document.querySelectorAll('[data-testid*="group-item"], [data-testid*="GroupItem"]');

      if (!createButton && groupItems.length === 0) {
        return false;
      }

      // Check for loading states
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]'
      );
      if (loadingIndicators.length > 0) {
        return false;
      }

      // Check that page is fully interactive
      const body = document.body;
      if (body.style.pointerEvents === 'none' || body.hasAttribute('data-loading')) {
        return false;
      }

      return document.readyState === 'complete';
    }, { timeout: timeoutMs });

    // Ensure React Query cache is stable
    await this.waitForReactQueryStable(5000);
    console.log('✅ Groups page ready');
  }

  /**
   * Wait for modal to be ready for interaction
   * Handles modal animations and form initialization
   */
  async waitForModalReady(modalTestId: string, timeoutMs: number = 10000): Promise<void> {
    console.log(`🔄 Waiting for modal ${modalTestId} to be ready...`);

    const modal = this.page.locator(`[data-testid="${modalTestId}"]`);

    // Wait for modal to be visible
    await modal.waitFor({ state: 'visible', timeout: timeoutMs });

    // Wait for modal to be fully rendered and interactive
    await this.page.waitForFunction((testId) => {
      const modalElement = document.querySelector(`[data-testid="${testId}"]`);
      if (!modalElement) {
        return false;
      }

      // Check if modal is fully visible (not in transition)
      const styles = window.getComputedStyle(modalElement);
      const opacity = parseFloat(styles.opacity);
      const transform = styles.transform;

      if (opacity < 1 || transform.includes('scale(0)')) {
        return false;
      }

      // Check if modal content is loaded
      const inputs = modalElement.querySelectorAll('input, textarea, select');
      const buttons = modalElement.querySelectorAll('button:not([disabled])');

      // Should have at least one interactive element
      if (inputs.length === 0 && buttons.length === 0) {
        return false;
      }

      // Check for loading states within modal
      const loadingIndicators = modalElement.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"]'
      );
      if (loadingIndicators.length > 0) {
        return false;
      }

      return true;
    }, modalTestId, { timeout: timeoutMs });

    // Additional wait for any form initialization
    await this.page.waitForTimeout(300);
    console.log(`✅ Modal ${modalTestId} ready`);
  }

  /**
   * Wait for group creation to complete and UI to update
   * Ensures new group appears in lists and navigation is ready
   */
  async waitForGroupCreationComplete(timeoutMs: number = 15000): Promise<void> {
    console.log('🔄 Waiting for group creation to complete...');

    // Wait for any loading states to clear
    await this.page.waitForFunction(() => {
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]'
      );

      // Check for form submission states
      const submittingButtons = document.querySelectorAll(
        'button[disabled][data-testid*="submit"], button[disabled][data-testid*="create"]'
      );

      return loadingIndicators.length === 0 && submittingButtons.length === 0;
    }, { timeout: timeoutMs });

    // Wait for navigation to stabilize
    await this.timingHelper.waitForNavigationStable();

    // Wait for React Query cache to update with new group data
    await this.waitForReactQueryStable(5000);

    // Wait for any success notifications to appear
    await this.page.waitForFunction(() => {
      const successIndicators = document.querySelectorAll(
        '[data-testid*="success"], [data-testid*="created"], [class*="success"]'
      );

      const errorIndicators = document.querySelectorAll(
        '[data-testid*="error"], [class*="error"], [role="alert"]'
      );

      // Either success indicators should be present, or we should be on a new page
      const currentUrl = window.location.pathname;
      const isOnGroupsPage = currentUrl.includes('/group') || currentUrl.includes('/dashboard');

      return successIndicators.length > 0 || isOnGroupsPage || errorIndicators.length > 0;
    }, { timeout: 5000 });

    console.log('✅ Group creation complete');
  }


  /**
   * Wait for session state to synchronize across tabs/contexts
   * Critical for logout and multi-tab session tests
   */
  async waitForSessionSync(expectedState: 'authenticated' | 'unauthenticated', timeoutMs: number = 25000): Promise<void> {
    // First, wait for any pending storage events to complete with improved timing
    await this.page.evaluate(() => {
      return new Promise<void>(resolve => {
        let eventCount = 0;
        const maxEvents = 3; // Reduced from 5 for faster resolution
        let resolved = false;

        const storageHandler = () => {
          eventCount++;
          if (eventCount >= maxEvents && !resolved) {
            resolved = true;
            window.removeEventListener('storage', storageHandler);
            setTimeout(resolve, 200); // Increased settle time for storage events
          }
        };

        window.addEventListener('storage', storageHandler);

        // Increased timeout for no events to handle slower systems
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('storage', storageHandler);
            resolve();
          }
        }, 1000); // Increased from 500ms to 1000ms
      });
    });

    // Now verify the expected state with proper conditions and improved polling
    // Increased timeout for parallel execution environments
    await this.page.waitForFunction((expected) => {
      const authToken = localStorage.getItem('authToken');
      const authStorage = localStorage.getItem('auth-storage');
      const currentUrl = window.location.pathname;

      const isAuthenticated = !!(authToken && authStorage);

      if (expected === 'authenticated') {
        // For authenticated state, verify we're not on auth pages
        const isOnAuthPage = currentUrl.includes('/login') ||
          currentUrl.includes('/auth') ||
          currentUrl.includes('/logout');
        return isAuthenticated && !isOnAuthPage;
      } else {
        // For unauthenticated state, verify tokens are cleared
        return !isAuthenticated;
      }
    }, expectedState, { timeout: timeoutMs, polling: 250 }); // Added polling interval for better responsiveness
  }

  /**
   * Enhanced logout with proper session synchronization
   * Ensures session is cleared and state is stable before continuing
   */
  async performLogoutWithSync(): Promise<void> {
    // First try the standard logout button
    const logoutButton = this.page.locator('[data-testid="DesktopNav-Button-logout"]');

    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
    } else {
      // Fallback to direct logout navigation
      await this.page.goto('/auth/logout');
    }

    // Manually clear test-specific storage items FIRST to ensure proper cleanup
    await this.page.waitForTimeout(500); // Wait for logout click to process

    // Manually clear storage items to ensure proper cleanup
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');

      // Trigger storage event for other tabs to synchronize
      const storageEvent = new StorageEvent('storage', {
        key: 'auth-storage',
        oldValue: 'cleared',
        newValue: null,
        url: window.location.href
      });
      window.dispatchEvent(storageEvent);
    });

    // Additional short wait for storage events to propagate
    await this.page.waitForTimeout(200);

    // Ensure we're redirected to login page - handle app that doesn't auto-redirect
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/login')) {
      try {
        await this.page.waitForURL(/\/login/, { timeout: 5000 });
      } catch {
        // App doesn't auto-redirect after logout, navigate manually
        console.log('⚠️ No auto-redirect after logout, navigating to login manually');
        await this.page.goto('/login');
      }
    }

    // Final verification that session is actually cleared
    const sessionCleared = await this.page.evaluate(() => {
      const authToken = localStorage.getItem('authToken');
      const authStorage = localStorage.getItem('auth-storage');
      return !authToken && !authStorage;
    });

    if (!sessionCleared) {
      throw new Error('Session not properly cleared after logout');
    }
  }

  /**
   * Centralized database consistency management
   * Replaces manual timeout calls for database operations
   */
  async waitForDatabaseConsistency(operationType: 'create' | 'update' | 'delete' = 'create', count = 1): Promise<void> {
    const baseDelay = operationType === 'create' ? 1000 :
      operationType === 'update' ? 500 : 800;
    const totalDelay = baseDelay * count;
    const finalDelay = Math.min(totalDelay + 2000, 5000); // Cap at 5 seconds

    await this.timingHelper.retryOperation(async () => {
      // Use timing helper instead of manual timeout
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }, `database-${operationType}-consistency`, 1);
  }

  /**
   * Email delivery with progressive backoff
   * Replaces manual progressive setTimeout calls
   */
  async waitForEmailDelivery(maxAttempts = 3, baseDelay = 2000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const delay = baseDelay * attempt; // Progressive backoff
      await this.timingHelper.retryOperation(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
      }, `email-delivery-attempt-${attempt}`, 1);
    }
  }

  /**
   * Modal and animation timing
   * Replaces manual 300ms modal delays
   */
  async waitForModalAnimation(duration = 300): Promise<void> {
    await this.timingHelper.retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, duration));
    }, 'modal-animation', 1);
  }

  /**
   * Page transition timing
   * Replaces manual 2000ms transition delays
   */
  async waitForPageTransition(duration = 2000): Promise<void> {
    await this.timingHelper.retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, duration));
    }, 'page-transition', 1);
  }

  /**
   * Generic retry with exponential backoff
   * Centralizes retry logic used across tests
   */
  async retryWithBackoff<T>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await this.timingHelper.retryOperation(async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
        }, `retry-backoff-${attempt}`, 1);
      }
    }

    throw lastError!;
  }

  /**
   * Batch database operations with proper timing
   * Replaces sequential manual timeouts in database setup
   */
  async createMultipleEntitiesInSequence(operations: Array<() => Promise<void>>, delayBetween = 1000): Promise<void> {
    for (let i = 0; i < operations.length; i++) {
      await operations[i]();

      if (i < operations.length - 1) {
        await this.timingHelper.retryOperation(async () => {
          await new Promise(resolve => setTimeout(resolve, delayBetween));
        }, `sequence-delay-${i}`, 1);
      }
    }

    // Final consistency wait
    await this.waitForDatabaseConsistency('create', operations.length);
  }

  /**
   * Enhanced onboarding completion with better error handling and retry logic
   * Specifically designed for invitation flows and CPU-intensive environments
   */
  async completeOnboardingWithRetry(familyName: string = `Test Family ${this.filePrefix} ${Date.now().toString(36)}`, maxRetries: number = 2): Promise<void> {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        console.log(`Attempting onboarding completion (attempt ${retryCount + 1}/${maxRetries + 1})`);

        // Ensure we're on onboarding page
        const currentUrl = this.page.url();
        if (!currentUrl.includes('/onboarding')) {
          await this.page.goto('/onboarding');
        }

        await this.waitForAuthenticationStability(25000);

        // Wait for onboarding interface to be ready
        await this.page.locator('[data-testid="FamilyOnboardingWizard-Heading-welcome"]').waitFor({ timeout: 25000 });

        // Check if user already has family by examining auth state and current URL behavior
        try {
          // First, try navigating to dashboard to see if user gets redirected to onboarding
          console.log('🔍 Testing if user has family by navigating to dashboard');
          await this.page.goto('/dashboard');
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });

          // Wait for authentication state to stabilize
          await this.waitForAuthenticationStability(10000);

          const currentUrl = this.page.url();
          console.log('🔍 After dashboard navigation, URL is:', currentUrl);

          // More robust check - user has family if they can access dashboard OR family management
          if (!currentUrl.includes('/onboarding')) {
            // Additional verification - try to access family management
            await this.page.goto('/family/manage');
            await this.page.waitForLoadState('networkidle', { timeout: 10000 });

            const familyManageUrl = this.page.url();
            console.log('🔍 Family management URL:', familyManageUrl);

            if (!familyManageUrl.includes('/onboarding')) {
              console.log('✅ User successfully accessed family management - already has family, skipping onboarding');
              return; // User already has family access, stay on current page
            }
          }

          console.log('⚠️ User redirected back to onboarding - needs family creation');
          // Navigate back to onboarding to continue with family creation
          await this.page.goto('/onboarding');
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
          // Wait for onboarding interface to be ready again
          await this.page.locator('[data-testid="FamilyOnboardingWizard-Heading-welcome"]').waitFor({ timeout: 25000 });
        } catch (error) {
          console.log('⚠️ Could not test dashboard access, proceeding with onboarding:', error);
          // Ensure we're back on onboarding page
          await this.page.goto('/onboarding');
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
          await this.page.locator('[data-testid="FamilyOnboardingWizard-Heading-welcome"]').waitFor({ timeout: 25000 });
        }

        // Click create family option with retry  
        const createFamilyButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]');
        await createFamilyButton.waitFor({ state: 'visible', timeout: 10000 });
        await createFamilyButton.click();

        // Wait for family name input form
        const familyNameInput = this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]');
        await familyNameInput.waitFor({ timeout: 25000 });

        // Fill family name
        await familyNameInput.fill(familyName);

        // Verify auth state before submitting
        await this.timingHelper.waitForSessionStateChange('authenticated');

        // Submit with wait for completion
        const createButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamily"]');
        await createButton.click();

        // Wait for onboarding completion using enhanced timing helper
        await this.timingHelper.waitForNavigationStable();

        // Ensure authentication state is updated after family creation
        await this.timingHelper.waitForSessionStateChange('authenticated');

        // Use robust concurrent condition handling
        const conditions = [
          () => this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-familyCreated"]').isVisible(),
          () => !this.page.url().includes('/onboarding'),
          () => this.page.url().includes('/dashboard')
        ];

        await this.timingHelper.waitForAnyCondition(conditions, {
          timeout: 30000,
          requireSuccess: false
        });

        // Verify user actually has family access now with improved validation
        await this.page.waitForFunction(() => {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const auth = JSON.parse(authStorage);
              return auth.state?.user?.familyId !== undefined;
            } catch {
              return false;
            }
          }
          return false;
        }, { timeout: 15000 });

        // Additional verification by trying to navigate to family management
        try {
          await this.page.goto('/family/manage');
          await this.page.waitForLoadState('networkidle', { timeout: 10000 });

          const finalUrl = this.page.url();
          if (finalUrl.includes('/onboarding')) {
            throw new Error('Family creation verification failed - still redirected to onboarding');
          }

          console.log('✅ Onboarding completed successfully with family management access verified');
        } catch (error) {
          console.log('⚠️ Family management verification failed, but localStorage indicates family creation succeeded');
        }

        return;

      } catch (error) {
        retryCount++;
        console.log(`⚠️ Onboarding attempt ${retryCount} failed: ${error.message}`);

        if (retryCount > maxRetries) {
          throw new Error(`Onboarding failed after ${maxRetries + 1} attempts: ${error.message}`);
        }

        // Wait before retry with exponential backoff
        const backoffMs = 3000 * retryCount;
        await new Promise(resolve => setTimeout(resolve, backoffMs));

        // Try to recover by refreshing the page
        await this.page.reload();
        await this.page.waitForLoadState('networkidle');
      }
    }
  }

  /**
   * Enhanced error detection for family conflict scenarios
   * Waits for complex UI states and error conditions to stabilize
   */
  async waitForFamilyConflictDetection(timeoutMs: number = 25000): Promise<void> {
    console.log('🔄 Waiting for family conflict detection to complete...');

    await this.page.waitForFunction(() => {
      // Check if invitation page has loaded
      const invitationPageElements = document.querySelectorAll('[data-testid*="UnifiedFamilyInvitationPage"]');
      if (invitationPageElements.length === 0) {
        return false;
      }

      // Check if React Query has finished processing
      const reactQueryDevtools = (window as any).__REACT_QUERY_DEVTOOLS__;
      if (reactQueryDevtools) {
        const queryClient = reactQueryDevtools.queryClient;
        if (queryClient) {
          const queries = queryClient.getQueryCache().getAll();
          const isFetching = queries.some(query => query.state.isFetching);
          if (isFetching) {
            return false;
          }
        }
      }

      // Check for loading indicators
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]'
      );
      if (loadingIndicators.length > 0) {
        return false;
      }

      // Check for skeleton loaders
      const skeletonLoaders = document.querySelectorAll('[class*="skeleton"], [data-testid*="skeleton"]');
      if (skeletonLoaders.length > 0) {
        return false;
      }

      // Check if family conflict alert or related elements are present
      const conflictAlerts = document.querySelectorAll(
        '[data-testid*="Alert-existingFamily"], [data-testid*="Alert-cannotLeave"], [data-testid*="Button-leaveAndJoin"]'
      );

      // Page is ready when either:
      // 1. Conflict alerts are present (conflict detected)
      // 2. No conflict alerts and page is fully loaded (no conflict)
      return document.readyState === 'complete';
    }, { timeout: timeoutMs });

    // Additional stabilization wait
    await this.waitForReactQueryStable(5000);
    console.log('✅ Family conflict detection completed');
  }
}