import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Dashboard Quick Actions E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  test.describe('Dashboard Family Overview', () => {
    test('[P1] dashboard displays family overview after login', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Dashboard Overview ${timestamp}`;
      const familyName = `Overview Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'dashboard.overview',
          userName,
          familyName,
        );
      });

      await test.step('Verify dashboard loaded with family overview', async () => {
        // Verify main dashboard container is visible
        const dashboardContainer = page.locator('[data-testid="DashboardPage-Container-main"]');
        await expect(dashboardContainer).toBeVisible({ timeout: 10000 });

        // Verify welcome section
        const welcomeContainer = page.locator('[data-testid="DashboardPage-Container-welcome"]');
        await expect(welcomeContainer).toBeVisible({ timeout: 10000 });

        // Verify welcome message contains user's first name
        const welcomeMessage = page.locator('[data-testid="DashboardPage-Heading-welcomeMessage"]');
        await expect(welcomeMessage).toBeVisible({ timeout: 5000 });
        const welcomeText = await welcomeMessage.textContent();
        expect(welcomeText).toContain('Welcome back');

        // Verify user profile avatar is visible
        const userProfile = page.locator('[data-testid="DashboardPage-Container-userProfile"]');
        await expect(userProfile).toBeVisible({ timeout: 5000 });

        // Verify family name is displayed
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });
        const displayedFamilyName = await familyNameDisplay.textContent();
        expect(displayedFamilyName).toContain(familyName.substring(0, 20));

        // Verify manage family button is visible
        const manageFamilyButton = page.locator('[data-testid="DashboardPage-Button-manageFamily"]');
        await expect(manageFamilyButton).toBeVisible({ timeout: 5000 });

        console.log('✅ Dashboard family overview displayed correctly');
      });
    });
  });

  test.describe('Quick Action - Add Child', () => {
    test('[P1] dashboard quick action navigate to add child', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Quick Child ${timestamp}`;
      const familyName = `Child Action Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'dashboard.child.action',
          userName,
          familyName,
        );
      });

      await test.step('Verify quick action button is visible', async () => {
        const addChildButton = page.locator('[data-testid="DashboardPage-Button-quickAction-add-child"]');
        await expect(addChildButton).toBeVisible({ timeout: 10000 });

        const actionLabel = page.locator('[data-testid="DashboardPage-Text-actionLabel-add-child"]');
        await expect(actionLabel).toBeVisible({ timeout: 5000 });
        await expect(actionLabel).toHaveText('Add Child');

        const actionDescription = page.locator('[data-testid="DashboardPage-Text-actionDescription-add-child"]');
        await expect(actionDescription).toBeVisible({ timeout: 5000 });
      });

      await test.step('Click add child quick action and verify navigation', async () => {
        const addChildButton = page.locator('[data-testid="DashboardPage-Button-quickAction-add-child"]');
        await addChildButton.click();

        // Verify navigation to children page
        await page.waitForURL('/children', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/children/, { timeout: 10000 });

        console.log('✅ Add child quick action navigated to children page');
      });
    });
  });

  test.describe('Quick Action - Add Vehicle', () => {
    test('[P1] dashboard quick action navigate to add vehicle', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Quick Vehicle ${timestamp}`;
      const familyName = `Vehicle Action Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'dashboard.vehicle.action',
          userName,
          familyName,
        );
      });

      await test.step('Verify quick action button is visible', async () => {
        const addVehicleButton = page.locator('[data-testid="DashboardPage-Button-quickAction-add-vehicle"]');
        await expect(addVehicleButton).toBeVisible({ timeout: 10000 });

        const actionLabel = page.locator('[data-testid="DashboardPage-Text-actionLabel-add-vehicle"]');
        await expect(actionLabel).toBeVisible({ timeout: 5000 });
        await expect(actionLabel).toHaveText('Add Vehicle');

        const actionDescription = page.locator('[data-testid="DashboardPage-Text-actionDescription-add-vehicle"]');
        await expect(actionDescription).toBeVisible({ timeout: 5000 });
      });

      await test.step('Click add vehicle quick action and verify navigation', async () => {
        const addVehicleButton = page.locator('[data-testid="DashboardPage-Button-quickAction-add-vehicle"]');
        await addVehicleButton.click();

        // Verify navigation to vehicles page
        await page.waitForURL('/vehicles', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/vehicles/, { timeout: 10000 });

        console.log('✅ Add vehicle quick action navigated to vehicles page');
      });
    });
  });

  test.describe('Quick Action - Join a Group', () => {
    test('[P1] dashboard quick action navigate to join a group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Quick Group ${timestamp}`;
      const familyName = `Group Action Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'dashboard.group.action',
          userName,
          familyName,
        );
      });

      await test.step('Verify quick action button is visible', async () => {
        const joinGroupButton = page.locator('[data-testid="DashboardPage-Button-quickAction-join-a-group"]');
        await expect(joinGroupButton).toBeVisible({ timeout: 10000 });

        const actionLabel = page.locator('[data-testid="DashboardPage-Text-actionLabel-join-a-group"]');
        await expect(actionLabel).toBeVisible({ timeout: 5000 });
        await expect(actionLabel).toHaveText('Join a Group');

        const actionDescription = page.locator('[data-testid="DashboardPage-Text-actionDescription-join-a-group"]');
        await expect(actionDescription).toBeVisible({ timeout: 5000 });
      });

      await test.step('Click join group quick action and verify navigation', async () => {
        const joinGroupButton = page.locator('[data-testid="DashboardPage-Button-quickAction-join-a-group"]');
        await joinGroupButton.click();

        // Verify navigation to groups page
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/groups/, { timeout: 10000 });

        console.log('✅ Join group quick action navigated to groups page');
      });
    });
  });

  test.describe('Empty State for New Family', () => {
    test('[P1] dashboard displays empty state for new family with no children/vehicles', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Empty State ${timestamp}`;
      const familyName = `Empty Family ${timestamp}`;

      await test.step('Authenticate and create family (no children/vehicles)', async () => {
        await authHelper.setupAdminUser(
          'dashboard.empty',
          userName,
          familyName,
        );
      });

      await test.step('Verify dashboard shows empty state for new family', async () => {
        // Verify main dashboard container
        const dashboardContainer = page.locator('[data-testid="DashboardPage-Container-main"]');
        await expect(dashboardContainer).toBeVisible({ timeout: 10000 });

        // Verify family name is displayed
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });

        // Verify empty state is shown (family exists but has no children or vehicles)
        const emptyState = page.locator('[data-testid="DashboardPage-Container-emptyState"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });

        console.log('✅ Empty state displayed for new family with no children/vehicles');
      });
    });
  });
});
