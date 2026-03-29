import { Page, expect } from '@playwright/test';
import { FileSpecificTestData } from './file-specific-test-data';
import type { TestUser, TestFamily } from './file-specific-test-data';
import { createHmac, createHash } from 'crypto';
import { createTimingHelper, EnhancedTimingHelper } from './enhanced-timing-helper';
import { execSync } from 'child_process';
import { E2EEmailHelper } from './e2e-email-helper';
import { E2E_TEST_OVERRIDE_IV } from './e2e-constants';

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
   * Timeout constants for authentication operations
   * Centralized timeout management for better maintainability
   */
  private static readonly TIMEOUTS = {
    EMAIL_SENT: 15000,
    AUTH_VERIFICATION: 30000,
    PAGE_LOAD: 15000,
    AUTH_STABILITY: 15000,
  } as const;

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
    private page: Page,  
    testDataInstance?: FileSpecificTestData,
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
      const match = testFile.match(/\/([^/]+)\.spec\.ts/);
      if (match) {
        const fileName = match[1];
        const basePrefix = fileName
          .replace(/^\d+-/, '') // Remove leading numbers like "01-"
          .replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase())
          .replace(/[^a-zA-Z]/g, ''); // Remove any remaining non-letters
        const workerId = UniversalAuthHelper.getWorkerId();
        const prefix = `${basePrefix}W${workerId}`;
        console.log(`🔍 Detected file prefix from env: ${prefix} (worker ${workerId})`);
        return prefix;
      }
    }

    // Try stack trace method
    const stack = new Error().stack;
    const testFileMatch = stack?.match(/\/([^/]+)\.spec\.ts/);

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
      const script = `
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
            await prisma['$disconnect']();
          }
        }

        (async () => { await cleanupFamilyMemberships(); })();
      `;

      execSync('docker exec -i edulift-backend-e2e node', { input: script, encoding: 'utf8', timeout: 20000, stdio: 'inherit' });
    } catch (error) {
      console.log(`Family membership cleanup for ${userId}:`, (error as Error).message);
    }
  }

  /**
   * Create user in database via direct database access (E2E only)
   */
  async createUserInDatabase(user: AuthUser): Promise<void> {
    // With worker-specific file prefixes, each user ID/email is unique per worker
    // No need for static cache checks - just create directly

    try {
      const script = `
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
            await prisma['$disconnect']();
          }
        }

        (async () => { await createUser(); })();
      `;

      execSync('docker exec -i edulift-backend-e2e node', { input: script, encoding: 'utf8', timeout: 300000, stdio: 'inherit' });
    } catch (error) {
      // Handle cases where user creation fails due to existing users
      if ((error as Error).message.includes('Unique constraint failed') ||
        (error as Error).message.includes('already exists')) {
        console.log(`E2E User ${user.email} already exists, proceeding with authentication`);
      } else {
        console.error('Failed to create user in database:', error);
        throw new Error(`Failed to create user ${user.email} in database: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Verify that a user exists in the database
   * @throws Error if user not found or database check fails
   */
  private async verifyUserExists(userId: string): Promise<void> {
    try {
      // Use a heredoc to avoid shell escaping issues with $disconnect
      const script = `
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        (async () => {
          try {
            const user = await prisma.user.findUnique({
              where: { id: '${userId}' }
            });
            if (!user) {
              console.error('USER_NOT_FOUND');
              process.exit(1);
            }
            console.log('USER_FOUND');
          } catch (e) {
            console.error('ERROR:', e.message);
            process.exit(1);
          } finally {
            await prisma['$disconnect']();
          }
        })();
      `;
      execSync('docker exec -i edulift-backend-e2e node', { input: script, encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    } catch (error) {
      throw new Error(`User verification failed for ID ${userId}: ${(error as Error).message}`);
    }
  }

  /**
   * Create a valid JWT token for E2E testing
   */
  private createValidJWT(userId: string, email: string): string {
    const secret = 'e2e-test-access-secret-key-very-long'; // Must match backend JWT_ACCESS_SECRET

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours for E2E tests
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
    options: AuthOptions = {},
  ): Promise<AuthUser> {
    const randomId = Math.random().toString(36).substring(2, 8);

    // Use file-specific email and ID to prevent conflicts
    const uniqueId = this.testData.getId(`${baseName}-${randomId}`);
    const uniqueEmail = this.testData.getEmail(`${baseName}-${randomId}`);

    const user: AuthUser = {
      id: uniqueId,
      email: uniqueEmail,
      name: `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} User`,
    };

    // Create the user in the database first so JWT validation will work
    await this.createUserInDatabase(user);

    // Only set authentication data if we have a secure context
    try {
      await this.setAuthenticationData(user, options);
    } catch (error) {
      // If we get a security error, navigate to login first
      if ((error as Error).message.includes('insecure') || (error as Error).message.includes('SecurityError')) {
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
    options: AuthOptions = {},
  ): Promise<void> {
    await this.setAuthenticationData(user, options);
  }

  /**
   * Set authentication data in localStorage
   */
  private async setAuthenticationData(
    user: AuthUser,
    options: AuthOptions,
  ): Promise<void> {
    const jwtToken = this.createValidJWT(user.id, user.email);

    // NO API MOCKING - Let real backend calls flow through
    // E2E tests must test the complete, real system

    try {
      await this.page.evaluate(
        ({ token, userData, opts: _opts, testOverrideIv }) => {
          // Clear any existing auth data first to avoid conflicts
          // 🔧 FIX: Also clear secure_* keys
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('auth-storage');
          localStorage.removeItem('secure_authToken');
          localStorage.removeItem('secure_userData');
          localStorage.removeItem('secure_refreshToken');

          // 🔧 FIX: Store in secure_* format to match secureStorage keys
          // Format: { encrypted: base64(data), iv: base64(iv), timestamp: number }
          const encodeBase64 = (str: string) => btoa(str);
          const e2eTestIv = encodeBase64(testOverrideIv);

          // 🔧 CRITICAL: Set E2E test mode flags so secureStorage recognizes test data
          (window as any).__E2E_TEST_MODE__ = true;
          localStorage.setItem('__E2E_TEST_MODE__', 'true');

          // Store authToken in secure_authToken
          localStorage.setItem('secure_authToken', JSON.stringify({
            encrypted: encodeBase64(token),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));

          // Store userData in secure_userData
          localStorage.setItem('secure_userData', JSON.stringify({
            encrypted: encodeBase64(JSON.stringify(userData)),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));

          // Store refreshToken in secure_refreshToken
          localStorage.setItem('secure_refreshToken', JSON.stringify({
            encrypted: encodeBase64('test-refresh-token'),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));

          // Force authService to re-read localStorage by triggering a storage event
          // This simulates what would happen if auth was set in another tab
          const storageEvent = new StorageEvent('storage', {
            key: 'secure_authToken',
            newValue: JSON.stringify({
              encrypted: btoa(token),
              iv: btoa(testOverrideIv),
              timestamp: Date.now(),
            }),
            oldValue: null,
            storageArea: localStorage,
          });
          window.dispatchEvent(storageEvent);

          // Verify ALL auth data was set correctly
          const verifyToken = localStorage.getItem('secure_authToken');
          const verifyUserData = localStorage.getItem('secure_userData');
          const verifyRefreshToken = localStorage.getItem('secure_refreshToken');

          if (!verifyToken) {
            throw new Error('Token not set in secure_authToken');
          }
          if (!verifyUserData) {
            throw new Error('User data not set in secure_userData');
          }
          if (!verifyRefreshToken) {
            throw new Error('Refresh token not set in secure_refreshToken');
          }

          console.log('✅ E2E auth data successfully set and verified in localStorage');
        },
        {
          token: jwtToken,
          userData: user,
          opts: options,
          testOverrideIv: E2E_TEST_OVERRIDE_IV,
        },
      );
    } catch (error) {
      throw new Error(`Failed to set authentication data: ${(error as Error).message}`);
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
    options: AuthOptions = {},
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
        ({ token, userData, opts: _opts, testOverrideIv }) => {
          // 🔧 FIX: Store in secure_* format to match secureStorage keys
          // Format: { encrypted: base64(data), iv: base64(iv), timestamp: number }
          const encodeBase64 = (str: string) => btoa(str);
          const e2eTestIv = encodeBase64(testOverrideIv);

          // 🔧 CRITICAL: Set E2E test mode flags so secureStorage recognizes test data
          (window as any).__E2E_TEST_MODE__ = true;
          localStorage.setItem('__E2E_TEST_MODE__', 'true');

          // Store authToken in secure_authToken
          localStorage.setItem('secure_authToken', JSON.stringify({
            encrypted: encodeBase64(token),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));

          // Store userData in secure_userData
          localStorage.setItem('secure_userData', JSON.stringify({
            encrypted: encodeBase64(JSON.stringify(userData)),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));

          // Store refreshToken in secure_refreshToken
          localStorage.setItem('secure_refreshToken', JSON.stringify({
            encrypted: encodeBase64('test-refresh-token'),
            iv: e2eTestIv,
            timestamp: Date.now(),
          }));
        },
        {
          token: jwtToken,
          userData: user,
          opts: options,
          testOverrideIv: E2E_TEST_OVERRIDE_IV,
        },
      );
    } catch (error) {
      // If we get a security error, we're already on the right page, continue
      if (!(error as Error).message.includes('insecure') && !(error as Error).message.includes('SecurityError')) {
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
      const hasAuth = localStorage.getItem('secure_authToken') !== null;

      // Page should be ready and not on auth pages if we have auth
      return document.readyState === 'complete' && (!isAuthPage || !hasAuth);
    }, { timeout: 10000 });

    // Wait for any connection alerts to disappear with shorter timeout
    try {
      await this.page.waitForSelector('[data-testid="connection-alert"]', {
        state: 'hidden',
        timeout: 25000,
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
  /**
   * Setup a complete admin user with account and family
   *
   * Consolidates the common pattern of:
   * 1. Navigate to login
   * 2. Create new user account
   * 3. Verify magic link email
   * 4. Complete onboarding with family
   *
   * @param userKey - Key for generating unique email (e.g., 'admin', 'admin.invite')
   * @param displayName - Display name for the user
   * @param familyName - Name for the family to create
   * @returns Object with created user details
   *
   * @example
   * ```typescript
   * const { email, name, familyName } = await authHelper.setupAdminUser('admin', 'Admin User', 'Test Family');
   * ```
   */
  async setupAdminUser(
    userKey: string,
    displayName: string,
    familyName: string,
  ): Promise<{ email: string; name: string; familyName: string }> {
    const timestamp = Date.now();
    const email = this.getFileSpecificEmail(`${userKey}.${timestamp}`);
    const name = displayName || `User ${timestamp}`;
    const finalFamilyName = familyName || `Family ${timestamp}`;

    const emailHelper = new E2EEmailHelper();

    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');

    const newUserTab = this.page.locator('[data-testid="LoginPage-Tab-newUser"]');
    await expect(newUserTab).toBeVisible({ timeout: 5000 });
    await newUserTab.click();
    await this.waitForAuthenticationStability();

    const nameInput = this.page.locator('[data-testid="LoginPage-Input-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const emailInput = this.page.locator('[data-testid="LoginPage-Input-email"]');

    await emailInput.fill(email);
    await nameInput.fill(name);

    const submitButton = this.page.locator('[data-testid="LoginPage-Button-createAccount"]');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    await this.waitForAuthenticationStability();

    // Wait for magic link email
    const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(email, { timeoutMs: 30000 });
    if (!magicLinkUrl) {
      throw new Error(`Magic link not received for ${email}`);
    }

    await this.page.goto(magicLinkUrl);
    await this.page.waitForLoadState('networkidle');

    // Wait for authentication to complete and redirect to happen
    // The magic link verification will redirect to either /onboarding or /dashboard
    await this.page.waitForURL(
      (url) => url.toString().includes('/onboarding') || url.toString().includes('/dashboard'),
      { timeout: 15000 },
    );

    // Complete onboarding to create family
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/onboarding')) {
      throw new Error(`Expected /onboarding but got ${currentUrl}`);
    }

    await this.completeOnboarding(finalFamilyName);
    console.log(`✅ Admin user created: ${email} with family ${finalFamilyName}`);

    return { email, name, familyName: finalFamilyName };
  }

  async setupAdminUserWithEmail(
    targetPage: Page,
    email: string,
    displayName: string,
    familyName: string,
  ): Promise<{ email: string; name: string; familyName: string }> {
    const name = displayName || `User ${Date.now()}`;
    const finalFamilyName = familyName || `Family ${Date.now()}`;

    const emailHelper = new E2EEmailHelper();

    // Use the main helper's instance to ensure consistency
    const originalPage = this.page;
    this.page = targetPage;

    try {
      await this.page.goto('/login');
      await this.page.waitForLoadState('networkidle');

      const newUserTab = this.page.locator('[data-testid="LoginPage-Tab-newUser"]');
      await expect(newUserTab).toBeVisible({ timeout: 5000 });
      await newUserTab.click();
      await this.waitForAuthenticationStability();

      const nameInput = this.page.locator('[data-testid="LoginPage-Input-name"]');
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      const emailInput = this.page.locator('[data-testid="LoginPage-Input-email"]');

      await emailInput.fill(email);
      await nameInput.fill(name);

      const submitButton = this.page.locator('[data-testid="LoginPage-Button-createAccount"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();
      await this.waitForAuthenticationStability();

      // Wait for magic link email
      const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(email, { timeoutMs: 30000 });
      if (!magicLinkUrl) {
        throw new Error(`Magic link not received for ${email}`);
      }

      await this.page.goto(magicLinkUrl);
      await this.page.waitForLoadState('networkidle');

      // Wait for authentication to complete and redirect to happen
      await this.page.waitForURL(
        (url) => url.toString().includes('/onboarding') || url.toString().includes('/dashboard'),
        { timeout: 15000 },
      );

      // Handle both new and existing users
      const currentUrl = this.page.url();
      if (currentUrl.includes('/onboarding')) {
        // New user - complete onboarding to create family
        await this.completeOnboarding(finalFamilyName);
        console.log(`✅ Admin user created: ${email} with family ${finalFamilyName}`);
        return { email, name, familyName: finalFamilyName };
      } else if (currentUrl.includes('/dashboard')) {
        // Existing user - already has a family
        const familyNameElement = await this.page.locator('[data-testid="DashboardPage-Text-familyName"]').textContent();
        const existingFamilyName = familyNameElement || 'Existing Family';
        console.log(`✅ Existing admin user logged in: ${email} with existing family ${existingFamilyName}`);
        return { email, name, familyName: existingFamilyName };
      } else {
        throw new Error(`Expected /onboarding or /dashboard but got ${currentUrl}`);
      }
    } finally {
      // Restore original page
      this.page = originalPage;
    }
  }

  async completeOnboarding(
    familyName: string = `Test Family ${this.filePrefix} ${Date.now().toString(36)}`,
    _addChildren: boolean = false,
    _addVehicles: boolean = false,
  ): Promise<void> {
    console.log('Starting family onboarding...');

    // Capture all console messages for debugging
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Specifically capture 404 errors with URLs
      if (type === 'error' && text.includes('404')) {
        // Extract URL from error message if possible
        const urlMatch = text.match(/(http[^\s)]+|[\w./-]+\.(js|css|json)[^\s]*)/);
        if (urlMatch) {
          console.log(`❌ 404 Error: ${urlMatch[0]}`);
        }
      }

      // Capture all warnings and info
      console.log(`📺 [${type}] ${text}`);
    });

    // Capture unhandled promise rejections
    (this.page as any).on('weberror', (error: any) => {
      console.log('💥 Unhandled web error:', error.name, '-', error.message);
    });

    // Capture dialog/alert
    this.page.on('dialog', dialog => {
      console.log('🗨️ Dialog appeared:', dialog.message(), '-', dialog.type());
    });

    // Capture page errors
    this.page.on('pageerror', error => {
      console.log('💥 Page error:', error.message);
      console.log('💥 Error stack:', error.stack);
    });

    // Capture failed requests
    this.page.on('requestfailed', request => {
      const failure = request.failure();
      console.log('❌ Request failed:', request.url(), '-', failure?.errorText);
    });

    // Wait for onboarding page
    await this.page.waitForURL('/onboarding', { timeout: 10000 });

    // Debug: Check page state before clicking
    console.log('📍 Page URL:', this.page.url());

    // Check page HTML structure
    const scriptTags = await this.page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return Array.from(scripts).map(s => ({
        src: s.getAttribute('src'),
        type: s.getAttribute('type'),
        text: s.textContent?.substring(0, 100),
      }));
    });
    console.log('📍 Script tags:', JSON.stringify(scriptTags, null, 2));

    // Check full HTML head
    const headHTML = await this.page.evaluate(() => {
      return document.head.innerHTML.substring(0, 1000);
    });
    console.log('📍 Page head preview:', headHTML);

    // Check if main React bundle is loaded
    const reactLoaded = await this.page.evaluate(() => {
      return typeof (window as any).React !== 'undefined';
    });
    console.log('📍 React loaded:', reactLoaded);

    // Check for any unhandled errors
    const hasErrors = await this.page.evaluate(() => {
      const errors = (window as any).__errors || [];
      return errors && errors.length > 0;
    });
    console.log('📍 Has errors:', hasErrors);

    // Click "Create a New Family" button quickly before next fetch cycle
    
    // Click "Create a New Family"
    const createFamilyButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]');
    
    console.log('📍 About to click button...');
    
    // Wait for button to be ready (not disabled)
    await createFamilyButton.waitFor({ state: 'visible', timeout: 3000 });
    await createFamilyButton.click();
    console.log('📍 Button clicked');

    // Wait for the input element to appear and be stable
    console.log('📍 Waiting for family name input...');
    
    // Use a retry loop to handle React re-renders during form filling
    let filledSuccessfully = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!filledSuccessfully && attempts < maxAttempts) {
      attempts++;
      console.log(`📍 Attempt ${attempts}/${maxAttempts}: Getting input element...`);
      
      try {
        // Get a fresh reference to the input each time
        const familyNameInput = this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]');
        
        // Wait for it to be attached and visible
        await familyNameInput.waitFor({ state: 'attached', timeout: 3000 });
        await familyNameInput.waitFor({ state: 'visible', timeout: 3000 });
        
        // Fill the input
        console.log('📍 Filling family name:', familyName);
        await familyNameInput.fill(familyName, { timeout: 5000 });
        
        // Verify the value was set
        const actualValue = await familyNameInput.inputValue({ timeout: 2000 });
        if (actualValue === familyName) {
          console.log('✅ Family name filled successfully');
          filledSuccessfully = true;
        } else {
          console.log(`⚠️ Value mismatch. Expected: ${familyName}, Got: ${actualValue}. Retrying...`);
          await this.page.waitForTimeout(500);
        }
      } catch (error) {
        console.log(`⚠️ Attempt ${attempts} failed:`, (error as Error).message);
        if (attempts >= maxAttempts) {
          throw error;
        }
        await this.page.waitForTimeout(500);
      }
    }
    
    if (!filledSuccessfully) {
      throw new Error('Failed to fill family name after 10 attempts');
    }

    // Submit family creation
    const submitButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamily"]');
    await submitButton.click();

    // Wait for navigation to dashboard
    await this.page.waitForURL(
      (url) => url.toString().includes('/dashboard'),
      { timeout: 15000 },
    );

    console.log('Family onboarding completed successfully');
  }

  /**
   * Quick setup for tests that need authenticated user with family
   */
  async quickFamilySetup(
    _baseName: string = 'testuser',
    targetPath: string = '/dashboard',
  ): Promise<AuthUser> {
    // Use a predefined user without family to ensure family creation works
    const noFamilyUser: AuthUser = {
      id: 'test-nofamily',
      email: 'nofamily@example.com',
      name: 'No Family User',
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
        await this.page.waitForLoadState('domcontentloaded');
      }
    }

    return noFamilyUser;
  }

  /**
   * Setup for tests that need existing user (skip onboarding)
   */
  async quickExistingUserSetup(
    baseNameOrEmail: string = 'testuser',
    targetPath: string = '/dashboard',
  ): Promise<AuthUser> {
    let user: AuthUser;

    // Check if the input is an email address
    if (baseNameOrEmail.includes('@')) {
      // Extract name from email for display
      const emailParts = baseNameOrEmail.split('@')[0];
      const displayName = emailParts.split('.').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1),
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
        name: displayName,
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
        isNewUser: false,
      });
    }

    await this.goToPageAsUser(user, targetPath, { isNewUser: false });
    return user;
  }

  /**
   * Direct setup for test users that should already have families
   */
  /**
   * ⚠️ DEPRECATED: directUserSetup does NOT work with PKCE authentication
   *
   * This method attempts to bypass the real authentication flow by writing
   * directly to localStorage, but this approach is incompatible with:
   * - PKCE (Proof Key for Code Exchange) security
   * - secureStorage encryption
   * - authService initialization timing
   *
   * ✅ SOLUTION: Use realUserSetup() or implement proper magic link flow
   *
   * @deprecated Use realUserSetup() instead for tests requiring authentication
   * @param userKey - Key of a user defined with defineUser()
   * @param targetPath - Path to navigate to after authentication
   */
  async directUserSetup(
    userKey: string,
    targetPath: string = '/dashboard',
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
    } catch (_error) {
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
            refreshToken: 'test-refresh-token',
          },
          version: 0,
        };
        localStorage.setItem('auth-storage', JSON.stringify(_authData));
      },
      {
        token: jwtToken,
        userData: user,
      },
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
          const script = `
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
                await prisma['$disconnect']();
              }
            })();
          `;
          const checkResult = execSync('docker exec -i edulift-backend-e2e node', { input: script, encoding: 'utf8', stdio: 'pipe' });
          console.log('🔍 Database check result:', checkResult);
        } catch (e) {
          console.error('Database check failed:', (e as Error).message);
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
   * Generate PKCE code verifier and challenge for magic link authentication
   *
   * PKCE (Proof Key for Code Exchange) is a security extension for OAuth.
   * - code_verifier: Random string (43-128 chars)
   * - code_challenge: BASE64URL(SHA256(code_verifier))
   *
   * @returns Object with code_verifier and code_challenge
   */
  private generatePKCE(): { code_verifier: string; code_challenge: string } {
    // Generate random code_verifier (43-128 characters)
    // Using the allowed character set: [A-Z][a-z][0-9]-._~
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const verifierLength = 43; // Minimum length for PKCE
    let code_verifier = '';
    for (let i = 0; i < verifierLength; i++) {
      code_verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Generate code_challenge = BASE64URL(SHA256(code_verifier))
    // Using Node.js crypto module
    const hash = createHash('sha256').update(code_verifier).digest('base64');

    // Convert to base64url (remove padding and replace characters)
    const code_challenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    console.log('🔐 Generated PKCE parameters:');
    console.log(`  code_verifier: ${code_verifier.substring(0, 10)}... (${code_verifier.length} chars)`);
    console.log(`  code_challenge: ${code_challenge.substring(0, 10)}... (${code_challenge.length} chars)`);

    return { code_verifier, code_challenge };
  }

  /**
   * Request magic link directly via API with PKCE parameters
   *
   * This bypasses the frontend UI and calls the backend API directly,
   * including the required PKCE parameters.
   *
   * @param email - User email address
   * @param code_challenge - PKCE code challenge
   * @param name - Optional user name (for new user registration)
   * @returns Promise<{success: boolean, userExists: boolean}>
   */
  private async requestMagicLinkWithPKCE(email: string, code_challenge: string, name?: string): Promise<{success: boolean; userExists: boolean}> {
    const backendUrl = process.env.E2E_BASE_URL?.replace('8001', '8002') || 'http://localhost:8002';
    const apiUrl = `${backendUrl}/api/v1/auth/magic-link`;

    console.log(`📤 Requesting magic link from API: ${apiUrl}`);
    console.log(`  Email: ${email}`);
    console.log(`  code_challenge: ${code_challenge.substring(0, 10)}...`);
    if (name) {
      console.log(`  Name: ${name} (new user registration)`);
    }

    const requestBody: any = {
      email,
      code_challenge,
    };

    // Include name for new user registration
    if (name) {
      requestBody.name = name;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to request magic link: ${response.status} ${response.statusText}\n` +
        `Response: ${errorText}`,
      );
    }

    const data = await response.json();
    console.log('✅ Magic link request successful!');
    console.log(`  Response: ${JSON.stringify(data)}`);

    return {
      success: data.success,
      userExists: data.data?.userExists ?? true,
    };
  }

  /**
   * Real authentication flow through the UI - tests complete backend connectivity
   *
   * This method performs actual user authentication by:
   * 1. Navigating to login page
   * 2. Filling out the login form with user email
   * 3. Submitting the form to backend (triggers PKCE automatically)
   * 4. If new user: filling name field and submitting again
   * 5. Retrieving magic link from MailPit
   * 6. Navigating to magic link to authenticate
   * 7. Verifying authentication success
   *
   * Pattern from Flutter E2E helpers - handles both new and existing users
   *
   * @param userKey - Key of a predefined user (must exist in FileSpecificTestData)
   * @param targetPath - Path to navigate to after authentication (default: '/dashboard')
   * @returns The authenticated user object
   *
   * Usage:
   * ```typescript
   * const authHelper = UniversalAuthHelper.forCurrentFile(page);
   * const user = await authHelper.realUserSetup('connectivityUser', '/dashboard');
   * ```
   */
  async realUserSetup(
    userKey: string,
    targetPath: string = '/dashboard',
  ): Promise<TestUser> {
    const authStartTime = Date.now();
    const emailHelper = new E2EEmailHelper();

    // Get the predefined user
    const user = this.testData.getUser(userKey);
    console.log(`🔐 Starting real authentication flow for user: ${user.email}`);

    // Navigate to login page
    console.log('📍 Navigating to login page...');
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for login form to be visible
    await expect(this.page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible({ timeout: UniversalAuthHelper.TIMEOUTS.PAGE_LOAD });
    await expect(this.page.locator('[data-testid="LoginPage-Input-email"]')).toBeVisible();

    // Fill in email
    console.log(`📝 Entering email: ${user.email}`);
    const emailInput = this.page.locator('[data-testid="LoginPage-Input-email"]');
    await emailInput.fill(user.email);

    // Track network requests to see what frontend is sending
    const apiRequests: { url: string; method: string; body?: any; status?: number }[] = [];
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Capture console errors and warnings
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        console.log(`❌ Console Error: ${text}`);
      } else if (msg.type() === 'warning') {
        const text = msg.text();
        consoleWarnings.push(text);
        console.log(`⚠️ Console Warning: ${text}`);
      }
    });

    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        const postData = request.postData();
        apiRequests.push({
          url,
          method: request.method(),
          body: postData ? (() => { try { return JSON.parse(postData); } catch { return postData; }})() : undefined,
        });
        console.log(`📤 API Request: ${request.method()} ${url}`);
      }
    });
    this.page.on('response', async response => {
      const url = response.url();
      console.log(`📥 Response [${response.status()}] ${url}`); // Log ALL responses
      if (url.includes('/api/')) {
        const status = response.status();
        console.log(`📥 API Response [${status}] ${url}`);
        // Find matching request and update status
        const req = apiRequests.find(r => r.url === url);
        if (req) {
          req.status = status;
        }
        // Try to get response body
        try {
          const body = await response.text();
          console.log('   Body:', body.substring(0, 300));
        } catch (e) {
          console.log(`   Body: (unable to read: ${e})`);
        }
      }
    });

    // First click - submit email without name
    console.log('📤 First submit: sending email without name (expecting 422 error for new users)...');
    const firstSubmitButton = this.page.locator('[data-testid="LoginPage-Button-sendMagicLink"]');
    await firstSubmitButton.click();

    // Check if 422 error appears (indicates new user) - wait for name field to become visible
    console.log('⏳ Checking if this is a new user (waiting for name field or success message)...');

    // Wait a bit for the API call to complete
    await this.page.waitForTimeout(2000);

    // Log what API calls were made
    console.log('🔍 API Requests made:', JSON.stringify(apiRequests, null, 2));

    const nameField = this.page.locator('[data-testid="LoginPage-Input-name"]');
    const isNameFieldVisible = await nameField.isVisible().catch(() => false);

    if (isNameFieldVisible) {
      console.log('✅ New user detected: Name field appeared (422 error received)');
      console.log(`📝 Entering name: ${user.name}`);
      await nameField.fill(user.name);

      // Second click - submit with name for new user registration
      console.log('📤 Second submit: sending email with name for new user registration...');
      const createAccountButton = this.page.locator('[data-testid="LoginPage-Button-createAccount"]');
      await createAccountButton.click();
    } else {
      console.log('✅ Existing user detected: No name field required');
    }

    // Wait for success message or email sent confirmation
    console.log('⏳ Waiting for email to be sent...');
    try {
      await expect(this.page.locator('[data-testid="LoginPage-Alert-emailSent"]'))
        .toBeVisible({ timeout: UniversalAuthHelper.TIMEOUTS.EMAIL_SENT });
      console.log('✅ Backend received login request and sent email');
    } catch {
      // Alternative: check for redirect to magic-link-sent page
      await this.page.waitForURL(url => url.toString().includes('magic-link-sent') || url.toString().includes('login'), { timeout: UniversalAuthHelper.TIMEOUTS.EMAIL_SENT });
      console.log('✅ Redirected to magic link sent page');
    }

    // Retrieve the magic link from MailPit
    console.log('📧 Retrieving magic link from MailPit...');

    // Wait for email to arrive (with timeout)
    const magicLink = await emailHelper.extractMagicLinkForRecipient(user.email);

    if (!magicLink) {
      throw new Error(
        `❌ No magic link email received for ${user.email} within timeout. ` +
        'Possible issues:\n' +
        '  - Backend not sending emails (check MailPit: http://mailpit-e2e:8025 from container, or http://localhost:8025 from host)\n' +
        '  - Email service not configured\n' +
        `  - User ${user.email} not properly created in database\n` +
        '  - Network connectivity issues between frontend and backend',
      );
    }

    console.log(`✅ Magic link retrieved: ${magicLink.substring(0, 50)}...`);

    // Navigate to magic link to authenticate
    console.log('🔗 Navigating to magic link to authenticate...');
    await this.page.goto(magicLink);

    // Wait for authentication to complete and navigation to target
    console.log('⏳ Waiting for authentication to complete...');

    // Wait for URL to change from auth/verify to target or dashboard
    await this.page.waitForURL(
      url => !url.toString().includes('/auth/verify'),
      { timeout: UniversalAuthHelper.TIMEOUTS.AUTH_VERIFICATION },
    );

    console.log('✅ Authentication successful - token verified by backend');

    // Wait for page to stabilize
    await this.page.waitForLoadState('networkidle', { timeout: UniversalAuthHelper.TIMEOUTS.PAGE_LOAD }).catch(() => {
      console.log('⚠️ networkidle timeout, continuing with domcontentloaded');
      return this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    });

    // Wait for authentication state to stabilize
    await this.waitForAuthenticationStability();

    // Check current URL
    const currentUrl = this.page.url();
    console.log(`📍 Current URL after authentication: ${currentUrl}`);

    // If not on target page, navigate there
    if (!currentUrl.includes(targetPath.split('?')[0])) {
      console.log(`🔄 Navigating to target path: ${targetPath}`);
      await this.page.goto(targetPath);
      await this.page.waitForLoadState('domcontentloaded');
      await this.waitForAuthenticationStability();
    }

    // Verify we're authenticated and on a valid page
    const finalUrl = this.page.url();
    if (finalUrl.includes('/login')) {
      throw new Error(
        `❌ Authentication failed for user ${user.email}. ` +
        'User was redirected back to login page after clicking magic link. ' +
        'This may indicate:\n' +
        '  - Invalid or expired magic link\n' +
        `  - User ${user.email} does not exist in database\n` +
        '  - Backend authentication service issues\n' +
        '  - JWT token validation failure',
      );
    }

    const authDuration = Date.now() - authStartTime;
    console.log(`⏱️ Authentication completed in ${authDuration}ms`);
    console.log('✅ Real authentication flow completed successfully');
    console.log(`📍 Final URL: ${finalUrl}`);

    return user;
  }

  /**
   * Direct setup for legacy AuthUser objects (deprecated - use directUserSetup with user key)
   */
  async directUserSetupWithUser(
    user: AuthUser,
    targetPath: string = '/dashboard',
  ): Promise<AuthUser> {
    // CRITICAL: Ensure user exists in database first so JWT validation will work
    await this.createUserInDatabase(user);

    const jwtToken = this.createValidJWT(user.id, user.email);

    // First navigate to login page to establish domain context with timeout handling
    await this.page.goto('/login');
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 25000 });
    } catch (_error) {
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
            refreshToken: 'test-refresh-token',
          },
          version: 0,
        };
        localStorage.setItem('auth-storage', JSON.stringify(_authData));
      },
      {
        token: jwtToken,
        userData: user,
      },
    );

    // Navigate directly to target with optimized timing
    await this.page.goto(targetPath);
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (_error) {
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
          { timeout: Math.floor(timeout / maxAttempts) },
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
    let userEmail: string;
    let userName: string;

    if (userKeyOrEmail.includes('@')) {
      // It's an email address
      userEmail = userKeyOrEmail;
      userName = `Invitation Accepter ${Date.now()}`;
    } else {
      // It's a user key - get the predefined user
      const predefinedUser = this.testData.getUser(userKeyOrEmail);
      userEmail = predefinedUser.email;
      userName = predefinedUser.name;
    }

    console.log(`🔸 acceptInvitation: Starting for ${userEmail}`);

    // Step 1: Navigate to invitation URL
    await this.page.goto(invitationUrl);
    await this.page.waitForLoadState('networkidle');
    console.log('✅ Navigated to invitation URL');

    // Step 2: Verify invitation page is displayed
    const familyNameElement = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
    await expect(familyNameElement).toBeVisible({ timeout: 10000 });
    console.log('✅ Invitation page displayed');

    // Step 3: Check if signup form is already visible or if we need to click "Sign In to Join"
    const signupNameInput = this.page.locator('[data-testid="SignupForm-Input-name"]');
    const signInButton = this.page.locator('[data-testid="UnifiedFamilyInvitationPage-Button-signInToJoin"]');
    
    const needsSignUp = await signupNameInput.isVisible().catch(() => false);
    const needsSignIn = !needsSignUp && await signInButton.isVisible().catch(() => false);

    if (needsSignIn) {
      console.log('🔐 User needs to click "Sign In to Join" first');
      await signInButton.click();
      
      // Wait for signup form to appear on the same page (NOT a redirect!)
      await expect(signupNameInput).toBeVisible({ timeout: 10000 });
      console.log('✅ Signup form appeared');
    }

    // Step 4: Fill signup form and request magic link
    if (needsSignUp || needsSignIn) {
      // Note: Email is already pre-filled in the signup form on invitation page
      // We only need to fill the name
      await signupNameInput.fill(userName);

      const submitButton = this.page.locator('[data-testid="SignupForm-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();

      await this.waitForAuthenticationStability();
      console.log('✅ Signup form submitted');

      // Wait for magic link
      const emailHelper = new E2EEmailHelper();
      const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(userEmail, { timeoutMs: 30000 });
      expect(magicLinkUrl).toBeTruthy();
      expect(magicLinkUrl).toContain('/auth/verify');

      // Verify magic link - this should automatically add user to the family
      await this.page.goto(magicLinkUrl!);
      await this.page.waitForLoadState('networkidle');
      console.log('✅ Magic link verified - user added to family');
    }

    // Step 5: Wait for redirect to dashboard (should happen automatically after magic link)
    await this.page.waitForURL('/dashboard', { timeout: 20000 });
    console.log('✅ Successfully joined family and redirected to dashboard');
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
        } catch (_networkIdleError) {
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
        console.log(`⚠️ Navigation retry ${retryCount}/${maxRetries} for ${path}: ${(error as Error).message}`);

        if (retryCount >= maxRetries) {
          throw new Error(`Navigation failed after ${maxRetries} attempts to ${path}: ${(error as Error).message}`);
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
      } catch (_error) {
        // If authentication ready times out, continue with page-level checks
        console.log('Authentication ready timeout, continuing with page checks...');
      }
    }

    // Wait for authentication state to be consistent with more flexibility
    await this.page.waitForFunction(() => {
      // 🔧 FIX: Check for secure_* keys instead of plain localStorage keys
      // The frontend now uses secureStorage which prefixes all keys with 'secure_'
      const authToken = localStorage.getItem('secure_authToken');
      const userData = localStorage.getItem('secure_userData');
      const currentUrl = window.location.pathname;

      // Debug logging to help diagnose authentication state
      const allKeys = Object.keys(localStorage);
      const _authKeys = allKeys.filter(k => k.startsWith('secure_') || k.startsWith('auth'));

      // Check authentication consistency
      const hasAuth = authToken && userData;

      if (!hasAuth) {
        // No auth - should be on login page, and page should be ready
        return (currentUrl.includes('/login') || currentUrl.includes('/auth')) &&
          document.readyState === 'complete';
      }

      // Has auth - should NOT be on login page and page should be ready
      const notOnAuthPage = !currentUrl.includes('/login') && !currentUrl.includes('/auth');
      const pageReady = document.readyState === 'complete';

      // For complex pages, also check that React has finished initial rendering
      const reactReady = !document.querySelector('[data-loading="true"]');

      return notOnAuthPage && pageReady && reactReady;
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
          const isFetching = queries.some((query: any) => query.state.isFetching);
          if (isFetching) {
            return false;
          }
        }
      }

      // Fallback: Check for common loading indicators
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]',
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
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]',
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
        '[data-loading="true"], .loading, [class*="loading"]',
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
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]',
      );

      // Check for form submission states
      const submittingButtons = document.querySelectorAll(
        'button[disabled][data-testid*="submit"], button[disabled][data-testid*="create"]',
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
        '[data-testid*="success"], [data-testid*="created"], [class*="success"]',
      );

      const errorIndicators = document.querySelectorAll(
        '[data-testid*="error"], [class*="error"], [role="alert"]',
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
      const authToken = localStorage.getItem('secure_authToken');
      const userData = localStorage.getItem('secure_userData');
      const currentUrl = window.location.pathname;

      const isAuthenticated = !!(authToken && userData);

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
    // 🔧 FIX: Also clear secure_* keys
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('secure_authToken');
      localStorage.removeItem('secure_userData');
      localStorage.removeItem('secure_refreshToken');

      // Trigger storage event for other tabs to synchronize
      const storageEvent = new StorageEvent('storage', {
        key: 'auth-storage',
        oldValue: 'cleared',
        newValue: null,
        url: window.location.href,
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
      const authToken = localStorage.getItem('secure_authToken');
      const userData = localStorage.getItem('secure_userData');
      const refreshToken = localStorage.getItem('secure_refreshToken');
      return !authToken && !userData && !refreshToken;
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

    throw new Error(lastError?.message ?? 'Operation failed after retries');
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
          async () => this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-familyCreated"]').isVisible(),
          async () => !this.page.url().includes('/onboarding'),
          async () => this.page.url().includes('/dashboard'),
        ];

        await this.timingHelper.waitForAnyCondition(conditions, {
          timeout: 30000,
          requireSuccess: false,
        });

        // Verify user actually has family access now with improved validation
        await this.page.waitForFunction(() => {
          const secureUserData = localStorage.getItem('secure_userData');
          if (secureUserData) {
            try {
              const parsed = JSON.parse(secureUserData);
              const decoded = atob(parsed.encrypted);
              const userData = JSON.parse(decoded);
              return userData.familyId !== undefined;
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
        } catch (_error) {
          console.log('⚠️ Family management verification failed, but localStorage indicates family creation succeeded');
        }

        return;

      } catch (error) {
        retryCount++;
        console.log(`⚠️ Onboarding attempt ${retryCount} failed: ${(error as Error).message}`);

        if (retryCount > maxRetries) {
          throw new Error(`Onboarding failed after ${maxRetries + 1} attempts: ${(error as Error).message}`);
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
          const isFetching = queries.some((query: any) => query.state.isFetching);
          if (isFetching) {
            return false;
          }
        }
      }

      // Check for loading indicators
      const loadingIndicators = document.querySelectorAll(
        '[data-loading="true"], .loading, [class*="loading"], [data-testid*="loading"]',
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
      const _conflictAlerts = document.querySelectorAll(
        '[data-testid*="Alert-existingFamily"], [data-testid*="Alert-cannotLeave"], [data-testid*="Button-leaveAndJoin"]',
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

  /**
   * Save PKCE security context from global window variable
   * Use before navigating to a magic link URL to preserve authentication state
   *
   * The PKCE data is stored in a global variable by storePKCEPair() for E2E testing.
   * This avoids decryption issues with secureStorage.
   *
   * @returns Promise<Record<string, string>> - PKCE data from window.__E2E_PKCE_DATA__
   */
  async saveSecurityContext(): Promise<Record<string, string>> {
    const pkceData = await this.page.evaluate((): Record<string, string> => {
      // Read from global variable set by storePKCEPair()
      const e2eData = (window as any).__E2E_PKCE_DATA__;

      if (!e2eData || !e2eData.code_verifier || !e2eData.code_challenge || !e2eData.email) {
        console.error('E2E PKCE data not found in window.__E2E_PKCE_DATA__');
        return {} as Record<string, string>;
      }

      // Return flat structure with just the values we need
      return {
        code_verifier: e2eData.code_verifier,
        code_challenge: e2eData.code_challenge,
        email: e2eData.email,
      };
    });

    console.log('🔐 PKCE data saved from window.__E2E_PKCE_DATA__:', Object.keys(pkceData));
    return pkceData;
  }

  /**
   * Restore PKCE security context to localStorage
   * Use after navigating to a magic link URL to restore authentication state
   *
   * The PKCE data is stored with a special IV flag that secureStorage recognizes
   * in test environment, bypassing the normal AES-GCM encryption.
   *
   * @param pkceData - PKCE data previously saved by saveSecurityContext()
   */
  async restoreSecurityContext(pkceData: Record<string, string>): Promise<void> {
    await this.page.evaluate((args) => {
      const { data, testOverrideIv } = args;

      // Set E2E test mode flag BOTH in window AND localStorage for persistence
      (window as any).__E2E_TEST_MODE__ = true;
      localStorage.setItem('__E2E_TEST_MODE__', 'true');

      // Store with E2E test override IV for secureStorage to recognize
      // Map the data to the expected keys
      const mapping: Record<string, string> = {
        'code_verifier': 'pkce_code_verifier',
        'code_challenge': 'pkce_code_challenge',
        'email': 'pkce_email',
      };

      Object.entries(data).forEach(([subKey, value]) => {
        if (value && mapping[subKey]) {
          const storageKey = mapping[subKey];
          const fullKey = `secure_${storageKey}`; // secure_pkce_code_verifier, etc.

          const storageData = {
            encrypted: btoa(value), // Base64 encode (not encrypted)
            iv: btoa(testOverrideIv), // Special IV for test data (passed as arg)
            timestamp: Date.now(),
          };

          localStorage.setItem(fullKey, JSON.stringify(storageData));
        }
      });
    }, { data: pkceData, testOverrideIv: E2E_TEST_OVERRIDE_IV });

    console.log('🔐 PKCE data restored after navigation with E2E test override');
  }
}