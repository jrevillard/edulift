import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Profile Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  test.describe('View Profile', () => {
    test('[P1] user can view their profile information', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Profile Viewer ${timestamp}`;
      const familyName = `Viewer Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'profile.view',
          userName,
          familyName,
        );
      });

      await test.step('Navigate to profile page via user menu', async () => {
        // Open user menu dropdown
        const userMenuTrigger = page.locator('[data-testid="DesktopNav-Container-userMenuTrigger"]');
        await expect(userMenuTrigger).toBeVisible({ timeout: 10000 });
        await userMenuTrigger.click();

        // Click Profile link in dropdown
        const profileLink = page.getByRole('menuitem', { name: 'Profile' });
        await expect(profileLink).toBeVisible({ timeout: 5000 });
        await profileLink.click();

        // Wait for profile page to load
        await page.waitForURL('/profile', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      });

      await test.step('Verify profile information is displayed', async () => {
        // Verify page title
        const heading = page.locator('[data-testid="ProfilePage-Heading-title"]');
        await expect(heading).toBeVisible({ timeout: 10000 });
        await expect(heading).toHaveText('Profile Settings');

        // Verify name is displayed in read-only mode
        const nameText = page.locator('[data-testid="ProfilePage-Text-name"]');
        await expect(nameText).toBeVisible({ timeout: 5000 });
        const displayedName = await nameText.textContent();
        expect(displayedName).toContain(userName);

        // Verify email is displayed in read-only mode
        const emailText = page.locator('[data-testid="ProfilePage-Text-email"]');
        await expect(emailText).toBeVisible({ timeout: 5000 });

        // Verify user ID is displayed
        const userIdText = page.locator('[data-testid="ProfilePage-Text-userId"]');
        await expect(userIdText).toBeVisible({ timeout: 5000 });
        const userId = await userIdText.textContent();
        expect(userId).toBeTruthy();
        expect(userId!.length).toBeGreaterThan(0);

        // Verify edit button is visible (not in editing mode)
        const editButton = page.locator('[data-testid="ProfilePage-Button-edit"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });

        // Verify input fields are NOT visible in view mode
        const nameInput = page.locator('[data-testid="ProfilePage-Input-name"]');
        await expect(nameInput).not.toBeVisible();

        console.log('✅ Profile information displayed correctly');
      });
    });
  });

  test.describe('Edit Profile Name', () => {
    test('[P1] user can edit their profile name', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const originalName = `Name Editor ${timestamp}`;
      const familyName = `Editor Family ${timestamp}`;
      const updatedName = `Updated ${originalName}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'profile.edit',
          originalName,
          familyName,
        );
      });

      await test.step('Navigate to profile page', async () => {
        const userMenuTrigger = page.locator('[data-testid="DesktopNav-Container-userMenuTrigger"]');
        await expect(userMenuTrigger).toBeVisible({ timeout: 10000 });
        await userMenuTrigger.click();

        const profileLink = page.getByRole('menuitem', { name: 'Profile' });
        await expect(profileLink).toBeVisible({ timeout: 5000 });
        await profileLink.click();

        await page.waitForURL('/profile', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      });

      await test.step('Click edit button to enter editing mode', async () => {
        const editButton = page.locator('[data-testid="ProfilePage-Button-edit"]');
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();

        // Verify editing mode is active - name input should appear
        const nameInput = page.locator('[data-testid="ProfilePage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        // Verify save and cancel buttons are visible
        const saveButton = page.locator('[data-testid="ProfilePage-Button-save"]');
        await expect(saveButton).toBeVisible({ timeout: 5000 });

        const cancelButton = page.locator('[data-testid="ProfilePage-Button-cancel"]');
        await expect(cancelButton).toBeVisible({ timeout: 5000 });

        // Verify edit button is no longer visible
        await expect(editButton).not.toBeVisible();

        console.log('✅ Entered editing mode');
      });

      await test.step('Change name and save', async () => {
        const nameInput = page.locator('[data-testid="ProfilePage-Input-name"]');
        await nameInput.clear();
        await nameInput.fill(updatedName);

        // Verify the input has the new value
        await expect(nameInput).toHaveValue(updatedName);

        const saveButton = page.locator('[data-testid="ProfilePage-Button-save"]');
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      });

      await test.step('Verify profile was updated successfully', async () => {
        // Verify success message
        const successAlert = page.locator('[data-testid="ProfilePage-Alert-success"]');
        await expect(successAlert).toBeVisible({ timeout: 10000 });
        await expect(successAlert).toContainText('Profile updated successfully');

        // Verify we are back in view mode - name should be displayed as text
        const nameText = page.locator('[data-testid="ProfilePage-Text-name"]');
        await expect(nameText).toBeVisible({ timeout: 5000 });
        const displayedName = await nameText.textContent();
        expect(displayedName).toContain(updatedName);

        // Verify edit button is visible again
        const editButton = page.locator('[data-testid="ProfilePage-Button-edit"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });

        // Verify input field is no longer visible
        const nameInput = page.locator('[data-testid="ProfilePage-Input-name"]');
        await expect(nameInput).not.toBeVisible();

        console.log('✅ Profile name updated and verified');
      });
    });
  });

  test.describe('Cancel Profile Editing', () => {
    test('[P1] user can cancel profile editing', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const originalName = `Cancel Tester ${timestamp}`;
      const familyName = `Cancel Family ${timestamp}`;
      const changedName = `Changed ${originalName}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'profile.cancel',
          originalName,
          familyName,
        );
      });

      await test.step('Navigate to profile page', async () => {
        const userMenuTrigger = page.locator('[data-testid="DesktopNav-Container-userMenuTrigger"]');
        await expect(userMenuTrigger).toBeVisible({ timeout: 10000 });
        await userMenuTrigger.click();

        const profileLink = page.getByRole('menuitem', { name: 'Profile' });
        await expect(profileLink).toBeVisible({ timeout: 5000 });
        await profileLink.click();

        await page.waitForURL('/profile', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      });

      await test.step('Verify original name is displayed', async () => {
        const nameText = page.locator('[data-testid="ProfilePage-Text-name"]');
        await expect(nameText).toBeVisible({ timeout: 5000 });
        const displayedName = await nameText.textContent();
        expect(displayedName).toContain(originalName);
      });

      await test.step('Enter editing mode and change name', async () => {
        const editButton = page.locator('[data-testid="ProfilePage-Button-edit"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        const nameInput = page.locator('[data-testid="ProfilePage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await nameInput.clear();
        await nameInput.fill(changedName);

        // Verify the input shows the changed value
        await expect(nameInput).toHaveValue(changedName);
      });

      await test.step('Cancel editing', async () => {
        const cancelButton = page.locator('[data-testid="ProfilePage-Button-cancel"]');
        await expect(cancelButton).toBeVisible({ timeout: 5000 });
        await cancelButton.click();
        await page.waitForLoadState('networkidle');
      });

      await test.step('Verify original name is preserved after cancel', async () => {
        // Verify we are back in view mode
        const nameText = page.locator('[data-testid="ProfilePage-Text-name"]');
        await expect(nameText).toBeVisible({ timeout: 5000 });
        const displayedName = await nameText.textContent();
        expect(displayedName).toContain(originalName);

        // Verify the changed name is NOT displayed
        expect(displayedName).not.toContain(changedName);

        // Verify edit button is visible again
        const editButton = page.locator('[data-testid="ProfilePage-Button-edit"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });

        // Verify no error alert is shown
        const errorAlert = page.locator('[data-testid="ProfilePage-Alert-error"]');
        await expect(errorAlert).not.toBeVisible();

        // Verify no success alert is shown
        const successAlert = page.locator('[data-testid="ProfilePage-Alert-success"]');
        await expect(successAlert).not.toBeVisible();

        console.log('✅ Profile editing cancelled, original name preserved');
      });
    });
  });

  test.describe('Navigate Back to Dashboard', () => {
    test('[P1] user can navigate back to dashboard from profile', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const userName = `Dashboard Nav ${timestamp}`;
      const familyName = `Nav Family ${timestamp}`;

      await test.step('Authenticate and create family', async () => {
        await authHelper.setupAdminUser(
          'profile.navback',
          userName,
          familyName,
        );
      });

      await test.step('Navigate to profile page', async () => {
        const userMenuTrigger = page.locator('[data-testid="DesktopNav-Container-userMenuTrigger"]');
        await expect(userMenuTrigger).toBeVisible({ timeout: 10000 });
        await userMenuTrigger.click();

        const profileLink = page.getByRole('menuitem', { name: 'Profile' });
        await expect(profileLink).toBeVisible({ timeout: 5000 });
        await profileLink.click();

        await page.waitForURL('/profile', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Verify we are on the profile page
        const heading = page.locator('[data-testid="ProfilePage-Heading-title"]');
        await expect(heading).toBeVisible({ timeout: 10000 });
      });

      await test.step('Click back to dashboard button', async () => {
        const backButton = page.locator('[data-testid="ProfilePage-Button-backToDashboard"]');
        await expect(backButton).toBeVisible({ timeout: 5000 });
        await backButton.click();
      });

      await test.step('Verify dashboard loads successfully', async () => {
        await page.waitForURL('/dashboard', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Verify we are on the dashboard page
        const dashboardContainer = page.locator('[data-testid="DashboardPage-Container-main"]');
        await expect(dashboardContainer).toBeVisible({ timeout: 10000 });

        // Verify welcome message is displayed
        const welcomeMessage = page.locator('[data-testid="DashboardPage-Heading-welcomeMessage"]');
        await expect(welcomeMessage).toBeVisible({ timeout: 5000 });
        const welcomeText = await welcomeMessage.textContent();
        expect(welcomeText).toContain('Welcome back');

        // Verify family name is displayed on dashboard
        const familyNameDisplay = page.locator('[data-testid="DashboardPage-Text-familyName"]');
        await expect(familyNameDisplay).toBeVisible({ timeout: 10000 });

        console.log('✅ Navigated back to dashboard successfully');
      });
    });
  });
});
