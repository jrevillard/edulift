import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';
import { OnboardingFlowHelper } from '../fixtures/onboarding-helper';

test.describe('Group Creation E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(90000);

  test.describe('First Time Group Creation', () => {
    test('family admin creates their first group successfully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create user and family, then navigate to groups', async () => {
        await authHelper.setupAdminUser(
          'group.creation',
          `Group Creator ${timestamp}`,
          `Creator Family ${timestamp}`,
        );

        // Complete onboarding if needed (setupAdminUser should handle this)
        const onboardingHelper = new OnboardingFlowHelper(page);
        await onboardingHelper.completeOnboardingIfNeeded();

        // Navigate to groups page via UI
        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Should see groups page
        await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible({ timeout: 15000 });
        console.log('✅ Successfully navigated to groups page');
      });

      await test.step('Start group creation process', async () => {
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();

        // Should open create group modal
        await expect(
          page.locator('[data-testid="CreateGroupModal-Input-groupName"]'),
        ).toBeVisible({ timeout: 10000 });
        console.log('✅ Group creation form opened');
      });

      await test.step('Fill group details and create', async () => {
        const groupName = 'Test Transportation Group';

        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 5000 });
        await groupNameInput.fill(groupName);

        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();

        // Wait for group creation to complete
        // Either redirect to manage page or stay on groups page with success
        await page.waitForLoadState('networkidle');
        console.log('✅ Group creation form submitted');
      });

      await test.step('Verify group creation success', async () => {
        // Navigate to groups page (handles potential redirect after creation)
        if (!page.url().endsWith('/groups')) {
          const groupsLink = page.getByRole('link', { name: 'Groups' });
          await groupsLink.click();
          await page.waitForURL('/groups', { timeout: 10000 });
          await page.waitForLoadState('networkidle');
        }

        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]');
        await expect(groupCard.first()).toBeVisible({ timeout: 10000 });
        console.log('✅ New group appears in groups list');
      });
    });

    test('validates group creation form properly', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Navigate to group creation', async () => {
        await authHelper.setupAdminUser(
          'group.validation',
          `Validation User ${timestamp}`,
          `Validation Family ${timestamp}`,
        );
        const onboardingHelper = new OnboardingFlowHelper(page);
        await onboardingHelper.completeOnboardingIfNeeded();

        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible();
      });

      await test.step('Test empty form validation', async () => {
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');

        // Form validation must prevent empty submission - either disabled button OR validation error
        const isDisabled = await submitButton.isDisabled();
        if (!isDisabled) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');

          const validationError = page.locator('[data-testid="CreateGroupModal-Alert-error"]');
          await expect(validationError).toBeVisible({ timeout: 3000 });
        }
        console.log('✅ Form validation prevents empty submission');
      });

      await test.step('Test invalid group name formats', async () => {
        const invalidNames = ['', '   '];

        for (const invalidName of invalidNames) {
          await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible({ timeout: 2000 });

          const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
          await groupNameInput.clear();
          await groupNameInput.fill(invalidName);

          const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
          const isDisabled = await submitButton.isDisabled();
          if (!isDisabled) {
            await submitButton.click();
            await page.waitForLoadState('networkidle');
            // Modal must still be open for invalid input
            await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible({ timeout: 2000 });
          }
          console.log(`✅ Invalid name "${invalidName}" prevented submission`);
        }
      });

      await test.step('Close modal and verify cancellation', async () => {
        const cancelButton = page.locator('[data-testid="CreateGroupModal-Button-cancel"]');
        await expect(cancelButton).toBeVisible({ timeout: 5000 });
        await cancelButton.click();
        await page.waitForLoadState('networkidle');

        // Modal must be closed after cancel action
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).not.toBeVisible({ timeout: 3000 });
        console.log('✅ Modal closes properly on cancel');
      });
    });
  });

  test.describe('Multiple Group Creation', () => {
    test('family admin can create multiple groups', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create first group', async () => {
        await authHelper.setupAdminUser(
          'multi.group',
          `Multi Group Admin ${timestamp}`,
          `Multi Group Family ${timestamp}`,
        );
        const onboardingHelper = new OnboardingFlowHelper(page);
        await onboardingHelper.completeOnboardingIfNeeded();

        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();

        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 10000 });
        await groupNameInput.fill('Morning Carpool Group');

        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();

        // Wait for modal to close after successful creation
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).not.toBeVisible({ timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Navigate back to groups page (handles potential redirect after creation)
        if (!page.url().endsWith('/groups')) {
          const groupsLink = page.getByRole('link', { name: 'Groups' });
          await groupsLink.click();
          await page.waitForURL('/groups', { timeout: 10000 });
          await page.waitForLoadState('networkidle');
        }

        // Verify first group appears
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]');
        await expect(groupCard.first()).toBeVisible({ timeout: 10000 });

        console.log('✅ First group created');
      });

      await test.step('Create second group', async () => {
        // Navigate back to groups list if not already there
        if (!page.url().endsWith('/groups')) {
          const groupsLink = page.getByRole('link', { name: 'Groups' });
          await groupsLink.click();
          await page.waitForURL('/groups', { timeout: 10000 });
          await page.waitForLoadState('networkidle');
        }

        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();

        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 10000 });
        await groupNameInput.fill('Evening Activities Group');

        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();

        // Wait for modal to close after successful creation
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).not.toBeVisible({ timeout: 10000 });
        await page.waitForLoadState('networkidle');

        console.log('✅ Second group created');
      });

      await test.step('Verify multiple groups are listed', async () => {
        // Navigate to groups list if not already there
        if (!page.url().endsWith('/groups')) {
          const groupsLink = page.getByRole('link', { name: 'Groups' });
          await groupsLink.click();
          await page.waitForURL('/groups', { timeout: 10000 });
          await page.waitForLoadState('networkidle');
        }

        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should see both groups
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll('[data-testid="GroupCard-Card-groupCard"]');
          return elements.length >= 2;
        }, { timeout: 15000 });

        const groupCards = page.locator('[data-testid="GroupCard-Card-groupCard"]');
        const groupCount = await groupCards.count();
        expect(groupCount).toBeGreaterThanOrEqual(2);
        console.log(`✅ Multiple groups visible: ${groupCount} groups found`);

        const morningGroup = page.locator(':text("Morning Carpool Group")');
        const eveningGroup = page.locator(':text("Evening Activities Group")');
        await expect(morningGroup).toBeVisible({ timeout: 10000 });
        await expect(eveningGroup).toBeVisible({ timeout: 10000 });
        console.log('✅ Both groups found by name');
      });
    });
  });
});
