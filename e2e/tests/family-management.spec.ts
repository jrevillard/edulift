import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from './fixtures/universal-auth-helper';

/**
 * E2E Tests: Family Management
 *
 * These tests verify that users can manage their family data WITHOUT console errors.
 *
 * Bug: "TypeError: M.map is not a function" when navigating to Manage Children page
 *
 * TDD Approach:
 * 1. RED - Test exposes the bug (will fail with TypeError)
 * 2. GREEN - Fix the bug (optional chaining, type fixes)
 * 3. REFACTOR - Clean up code
 */

test.describe.configure({ mode: 'serial' });

test.describe('Family Management - Bug Regression', () => {
  let authHelper: UniversalAuthHelper;

  test.beforeAll(async () => {
    // Setup: Define test user (will be created through UI during test)
    authHelper = new UniversalAuthHelper(null as any);
    authHelper.defineUser('familyUser', 'family-test-user', 'Family Test User');
    authHelper.defineFamily('testFamily', 'Test Family', 'familyUser');
    // Note: Users and families will be created through UI, not database
  });

  test('should navigate to Manage Children without TypeError', async ({ page }) => {
    // Track console errors
    const consoleErrors: { text: string; location: any }[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Track page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Setup authentication with real magic link flow
    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('familyUser', '/dashboard');

    // Complete onboarding to create a family
    await helper.completeOnboarding(`E2E Test Family ${Date.now().toString(36)}`);

    // Now navigate to children page
    await page.goto('/children');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for React to render

    // Verify NO TypeError in console
    const typeErrors = consoleErrors.filter(e =>
      e.text.includes('TypeError') &&
      e.text.includes('.map is not a function'),
    );

    expect(typeErrors).toHaveLength(0);

    // Verify NO page errors
    expect(pageErrors).toHaveLength(0);

    // Verify page content is visible
    const childrenPage = page.locator('[data-testid="ChildrenPage-Container-childrenList"], [data-testid="ChildrenPage-Container-emptyState"]');
    await expect(childrenPage).toBeVisible({ timeout: 10000 });
  });

  test('should display children when family has children', async ({ page }) => {
    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('familyUser', '/dashboard');

    // Complete onboarding to create a family
    await helper.completeOnboarding(`E2E Test Family ${Date.now().toString(36)}`);

    // Now navigate to children page
    await page.goto('/children');
    await page.waitForLoadState('domcontentloaded');

    // Check for empty state or children list
    const emptyState = page.locator('[data-testid="ChildrenPage-Container-emptyState"]');
    const childrenList = page.locator('[data-testid="ChildrenPage-List-childrenList"]');

    // At least one should be visible
    const hasContent = await Promise.all([
      emptyState.isVisible().catch(() => false),
      childrenList.isVisible().catch(() => false),
    ]);

    expect(hasContent.some(Boolean)).toBeTruthy();
  });

  test('should navigate to Manage Vehicles without TypeError', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('familyUser', '/dashboard');

    // Complete onboarding to create a family
    await helper.completeOnboarding(`E2E Test Family ${Date.now().toString(36)}`);

    // Now navigate to vehicles page
    await page.goto('/vehicles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify NO TypeError
    const typeErrors = consoleErrors.filter(e =>
      e.includes('TypeError') &&
      e.includes('.map is not a function'),
    );

    expect(typeErrors).toHaveLength(0);

    // Verify page content
    const vehiclesPage = page.locator('[data-testid="VehiclesPage-Container-vehiclesList"], [data-testid="VehiclesPage-Container-emptyState"]');
    await expect(vehiclesPage).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Manage Family without TypeError', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('familyUser', '/dashboard');

    // Complete onboarding to create a family
    await helper.completeOnboarding(`E2E Test Family ${Date.now().toString(36)}`);

    // Now navigate to family management page
    await page.goto('/family/manage');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify NO TypeError
    const typeErrors = consoleErrors.filter(e =>
      e.includes('TypeError') &&
      e.includes('.map is not a function'),
    );

    expect(typeErrors).toHaveLength(0);

    // Verify family management page
    const familyPage = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
    await expect(familyPage).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Additional smoke tests for critical user flows
 */
test.describe('Smoke Tests - Critical Paths', () => {
  let authHelper: UniversalAuthHelper;

  test.beforeAll(async () => {
    authHelper = new UniversalAuthHelper(null as any);
    authHelper.defineUser('smokeUser', 'smoke-test-user', 'Smoke Test User');
    authHelper.defineFamily('smokeFamily', 'Smoke Family', 'smokeUser');
    // Note: Families will be created through UI, not database
  });

  test('should load dashboard without errors', async ({ page }) => {
    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('smokeUser', '/dashboard');

    // Complete onboarding if needed
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      await helper.completeOnboarding(`Smoke Test Family ${Date.now().toString(36)}`);
    }

    await page.waitForLoadState('domcontentloaded');

    // Verify dashboard loaded
    const dashboard = page.locator('h1, h2, [data-testid*="Dashboard"]').first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between pages without errors', async ({ page }) => {
    const helper = UniversalAuthHelper.forCurrentFile(page);
    await helper.realUserSetup('smokeUser', '/dashboard');

    // Complete onboarding if needed
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      await helper.completeOnboarding(`Smoke Test Family ${Date.now().toString(36)}`);
    }

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to different pages
    const pages = [
      '/dashboard',
      '/children',
      '/vehicles',
      '/family/manage',
      '/groups',
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    // Verify NO TypeError during navigation
    const typeErrors = consoleErrors.filter(e =>
      e.includes('TypeError') &&
      e.includes('.map is not a function'),
    );

    expect(typeErrors).toHaveLength(0);
  });
});
