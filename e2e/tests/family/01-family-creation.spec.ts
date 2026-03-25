import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Creation E2E', () => {
  let authHelper: UniversalAuthHelper;
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = UniversalAuthHelper.forCurrentFile(page);
    await emailHelper.deleteAllEmails();
  });

  test.describe('New Family Creation', () => {
    test('should create new family for first-time user', async ({ page }) => {
      const timestamp = Date.now();
      const familyName = `TestFamily_${timestamp}`;

      await test.step('Create user and family', async () => {
        const { email: testEmail } = await authHelper.setupAdminUser(
          'family.creation',
          `Family Creation User ${timestamp}`,
          familyName
        );
        console.log(`✅ User created and family created: ${testEmail}`);
      });

      await test.step('Verify family was created', async () => {
        // Verify dashboard shows family name
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });

        // Verify family name is displayed
        const displayedName = await familyNameDisplay.textContent();
        expect(displayedName).toContain(familyName.substring(0, 20));

        console.log('✅ Family verified successfully');
      });
    });

    test('should reuse existing family when reconnecting', async ({ page }) => {
      const timestamp = Date.now();
      const familyName = `ReuseFamily_${timestamp}`;
      let testEmail: string;

      await test.step('Create family in first session', async () => {
        const result = await authHelper.setupAdminUser(
          'family.reuse',
          `Reuse User ${timestamp}`,
          familyName
        );
        testEmail = result.email;

        // Wait for dashboard to fully load (family name display indicates ready)
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });

        console.log('✅ Family created in first session');
      });

      await test.step('Reconnect with same credentials', async () => {
        // Logout by navigating to logout page
        await page.goto('/auth/logout');

        // Wait for logout to complete and redirect to login page
        await page.waitForURL(/\/login/, { timeout: 10000 });

        // Delete old emails so we can detect the new magic link
        await emailHelper.deleteAllEmails();

        // Login again with SAME email
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');
        await emailInput.fill(testEmail);

        const submitButton = page.locator('[data-testid="LoginPage-Button-sendMagicLink"]');
        await submitButton.click();

        // Wait for NEW magic link email to arrive
        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(testEmail, { timeoutMs: 30000 });
        expect(magicLinkUrl).toBeTruthy();
        expect(magicLinkUrl).toContain('/auth/verify');

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        // Wait for dashboard to load after reconnection
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

        console.log('✅ Reconnected successfully');
      });

      await test.step('Verify existing family is accessible', async () => {
        // Verify family is still there
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });

        const displayedName = await familyNameDisplay.textContent();
        expect(displayedName).toContain(familyName.substring(0, 20));

        console.log('✅ Existing family accessible after reconnect');
      });
    });
  });

  test.describe('Family Information Display', () => {
    test('should display family information correctly', async ({ page }) => {
      const timestamp = Date.now();
      const familyName = `InfoTestFamily_${timestamp}`;

      await test.step('Setup: authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'family.info',
          `Family Info User ${timestamp}`,
          familyName
        );
      });

      await test.step('Navigate to family management page and verify information', async () => {
        // Click Manage Family button using role and explicit name
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify we're on family management page
        await expect(page).toHaveURL('/family/manage', { timeout: 10000 });

        // Verify family information container
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        // Verify family name is displayed
        const familyNameInput = page.locator('[data-testid="ManageFamilyPage-Input-familyNameDisplay"]');
        await expect(familyNameInput).toBeVisible({ timeout: 5000 });

        const actualValue = await familyNameInput.inputValue();
        expect(actualValue).toBe(familyName);

        console.log('✅ Family information displayed correctly');
      });
    });
  });

  test.describe('Family Settings and Configuration', () => {
    test('should edit family name', async ({ page }) => {
      const timestamp = Date.now();
      const familyName = `SettingsTestFamily_${timestamp}`;

      await test.step('Setup: authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'family.settings',
          `Family Settings User ${timestamp}`,
          familyName
        );
      });

      await test.step('Navigate to family management and edit family name', async () => {
        // Click Manage Family button using role and explicit name
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Click edit button to open dialog
        const editButton = page.locator('[data-testid="ManageFamilyPage-Button-editFamily"]');
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();

        // Wait for edit dialog to open
        const dialogInput = page.locator('[data-testid="ManageFamilyPage-Input-familyName"]');
        await expect(dialogInput).toBeVisible({ timeout: 5000 });

        // Clear and enter new family name
        await dialogInput.clear();
        await dialogInput.fill(`${familyName}_Updated`);

        // Save changes
        const saveButton = page.locator('[data-testid="ManageFamilyPage-Button-saveFamilyName"]');
        await saveButton.click();

        // Wait for dialog to close (save button should no longer be visible)
        await expect(saveButton).not.toBeVisible({ timeout: 5000 });

        // Verify the update was successful by checking the display value
        const familyNameDisplay = page.locator('[data-testid="ManageFamilyPage-Input-familyNameDisplay"]');
        await expect(familyNameDisplay).toHaveValue(`${familyName}_Updated`);

        console.log('✅ Family name updated successfully');
      });
    });

    test('should access family management features', async ({ page }) => {
      const timestamp = Date.now();
      const familyName = `FeaturesTestFamily_${timestamp}`;

      await test.step('Setup: authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'family.features',
          `Family Features User ${timestamp}`,
          familyName
        );
      });

      await test.step('Navigate to family management and verify features', async () => {
        // Click Manage Family button using role and explicit name
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify we're on family management page
        await expect(page).toHaveURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        // Verify available action buttons
        const editButton = page.locator('[data-testid="ManageFamilyPage-Button-editFamily"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });

        const manageChildrenButton = page.locator('[data-testid="ManageFamilyPage-Button-manageChildren"]');
        await expect(manageChildrenButton).toBeVisible({ timeout: 5000 });

        const manageVehiclesButton = page.locator('[data-testid="ManageFamilyPage-Button-manageVehicles"]');
        await expect(manageVehiclesButton).toBeVisible({ timeout: 5000 });

        console.log('✅ Family management features accessible');
      });
    });
  });
});
