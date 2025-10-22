import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Simple Access Control Tests', () => {
  test.beforeAll(async () => {
    // Initialize FileSpecificTestData for consistent email generation
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users that will be created dynamically during tests
    authHelper.defineUser('accessTestUser', 'access-test', 'Access Test User');
    authHelper.defineUser('childrenAccessUser', 'children-access', 'Children Access User');
    authHelper.defineUser('vehiclesAccessUser', 'vehicles-access', 'Vehicles Access User');
    authHelper.defineUser('groupsAccessUser', 'groups-access', 'Groups Access User');
    
    // Define families for complete user setup
    authHelper.defineFamily('accessTestFamily', 'Access Test Family', 'accessTestUser');
    authHelper.defineFamily('childrenAccessFamily', 'Children Access Family', 'childrenAccessUser');
    authHelper.defineFamily('vehiclesAccessFamily', 'Vehicles Access Family', 'vehiclesAccessUser');
    authHelper.defineFamily('groupsAccessFamily', 'Groups Access Family', 'groupsAccessUser');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('accessTestFamily');
    await authHelper.createFamilyInDatabase('childrenAccessFamily');
    await authHelper.createFamilyInDatabase('vehiclesAccessFamily');
    await authHelper.createFamilyInDatabase('groupsAccessFamily');
    
    // Add a wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 4);
  });
  
  test('authenticated user can access family management', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    await authHelper.directUserSetup('accessTestUser', '/family/manage');
    
    // Check if we can access family content (should not redirect to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/auth');
    
    // Verify we can actually see family management content
    await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 5000 });
    
    // Verify user has appropriate access level
    const userRoleBadge = page.locator('[data-testid="ManageFamilyPage-Badge-userRole"]');
    if (await userRoleBadge.isVisible()) {
      await expect(userRoleBadge).toBeVisible();
    }
  });

  test('authenticated user can access children page', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    await authHelper.directUserSetup('childrenAccessUser', '/children');
    
    // Check if we can access children content
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/auth');
    
    // Verify we can actually see children page content
    await expect(page.locator('[data-testid="ChildrenPage-Title-pageTitle"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="ChildrenPage-Description-pageDescription"]')).toBeVisible();
  });

  test('authenticated user can access vehicles page', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    await authHelper.directUserSetup('vehiclesAccessUser', '/vehicles');
    
    // Check if we can access vehicles content
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/auth');
    
    // Verify we can actually see vehicles page content
    await expect(page.locator('[data-testid="VehiclesPage-Title-pageTitle"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="VehiclesPage-Description-pageDescription"]')).toBeVisible();
  });

  test('authenticated user can access groups page', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    await authHelper.directUserSetup('groupsAccessUser', '/groups');
    
    // Check if we can access groups content
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/auth');
    
    // Verify we can actually see groups page content
    await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="GroupsPage-Description-pageDescription"]')).toBeVisible();
  });

  test('unauthenticated user is redirected to login from protected pages', async ({ page }) => {
    // Test accessing protected routes without authentication
    
    // Test family management route
    await page.goto('/family/manage');
    await page.waitForLoadState('networkidle');
    const familyUrl = page.url();
    expect(familyUrl).toContain('/login');
    
    // Verify login page is actually displayed
    await expect(page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible({ timeout: 5000 });
    
    // Test children route
    await page.goto('/children');
    await page.waitForLoadState('networkidle');
    const childrenUrl = page.url();
    expect(childrenUrl).toContain('/login');
    
    // Test vehicles route
    await page.goto('/vehicles');
    await page.waitForLoadState('networkidle');
    const vehiclesUrl = page.url();
    expect(vehiclesUrl).toContain('/login');
    
    // Test groups route
    await page.goto('/groups');
    await page.waitForLoadState('networkidle');
    const groupsUrl = page.url();
    expect(groupsUrl).toContain('/login');
    
    // Verify all routes redirect to the same login page
    await expect(page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible({ timeout: 5000 });
  });
});