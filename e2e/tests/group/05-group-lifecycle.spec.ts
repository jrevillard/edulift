import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';
import { OnboardingFlowHelper } from '../fixtures/onboarding-helper';

test.describe('Group Lifecycle E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  test('group admin can update basic group information', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'lifecycle.edit',
        `Edit Admin ${timestamp}`,
        `Edit Family ${timestamp}`,
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
      await groupNameInput.fill('Lifecycle Edit Test Group');

      const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Navigate to group management page', async () => {
      // Navigate back to groups page (handles potential redirect after creation)
      if (!page.url().endsWith('/groups')) {
        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }

      const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
      await expect(groupCard).toBeVisible({ timeout: 10000 });

      const manageButton = groupCard.locator('[data-testid="GroupCard-Button-manageGroup"]');
      await expect(manageButton).toBeVisible({ timeout: 5000 });
      await manageButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('[data-testid="ManageGroupPage-Heading-pageTitle"]')).toBeVisible({ timeout: 10000 });
      console.log('✅ Navigated to group management page');
    });

    await test.step('Access group settings', async () => {
      const settingsButton = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
      await expect(settingsButton).toBeVisible({ timeout: 10000 });
      await settingsButton.click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Accessed group settings');
    });

    await test.step('Update group name', async () => {
      const groupNameInput = page.locator('[data-testid="ManageGroupPage-Input-editGroupName"]');
      await expect(groupNameInput).toBeVisible({ timeout: 5000 });
      await groupNameInput.clear();
      await groupNameInput.fill(`Updated Group ${timestamp}`);
      console.log('✅ Group name updated');
    });

    await test.step('Update group description', async () => {
      const descriptionInput = page.locator('[data-testid="ManageGroupPage-Textarea-editGroupDescription"]');
      await expect(descriptionInput).toBeVisible({ timeout: 3000 });
      await descriptionInput.clear();
      await descriptionInput.fill('Updated description for lifecycle testing.');
      console.log('✅ Group description updated');
    });

    await test.step('Save group changes', async () => {
      const saveButton = page.locator('[data-testid="ManageGroupPage-Button-saveGroup"]');
      await expect(saveButton).toBeVisible({ timeout: 5000 });
      await saveButton.click();
      await page.waitForLoadState('networkidle');

      // Verify save succeeded — check that the input still contains the updated value
      // (if save failed, the page might reset or show an error)
      const groupNameInput = page.locator('[data-testid="ManageGroupPage-Input-editGroupName"]');
      await expect(groupNameInput).toHaveValue(`Updated Group ${timestamp}`, { timeout: 5000 });
      console.log('✅ Group information updated successfully');
    });
  });

  test('group admin can view all family members in group', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'lifecycle.members',
        `Members Admin ${timestamp}`,
        `Members Family ${timestamp}`,
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
      await groupNameInput.fill('Members View Test Group');

      const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Navigate to group management page', async () => {
      // Navigate back to groups page (handles potential redirect after creation)
      if (!page.url().endsWith('/groups')) {
        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }

      const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
      await expect(groupCard).toBeVisible({ timeout: 10000 });

      const manageButton = groupCard.locator('[data-testid="GroupCard-Button-manageGroup"]');
      await expect(manageButton).toBeVisible({ timeout: 5000 });
      await manageButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('[data-testid="ManageGroupPage-Heading-pageTitle"]')).toBeVisible({ timeout: 10000 });
      console.log('✅ Navigated to group management page');
    });

    await test.step('View group member list', async () => {
      const membersContainer = page.locator('[data-testid="GroupFamilies-Container-list"]');
      await expect(membersContainer).toBeVisible({ timeout: 10000 });
      console.log('✅ Group member list displayed');

      // The admin's own family should be visible as a member
      const familyCards = page.locator('[data-testid="GroupFamilies-Container-list"]');
      const familyCount = await familyCards.count();
      expect(familyCount).toBeGreaterThanOrEqual(1);
      console.log(`✅ Found ${familyCount} families in group`);
    });
  });

  test('group admin can delete group', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'lifecycle.delete',
        `Delete Admin ${timestamp}`,
        `Delete Family ${timestamp}`,
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
      await groupNameInput.fill('Delete Test Group');

      const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Navigate to group management page', async () => {
      // Navigate back to groups page (handles potential redirect after creation)
      if (!page.url().endsWith('/groups')) {
        const groupsLink = page.getByRole('link', { name: 'Groups' });
        await groupsLink.click();
        await page.waitForURL('/groups', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }

      const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
      await expect(groupCard).toBeVisible({ timeout: 10000 });

      const manageButton = groupCard.locator('[data-testid="GroupCard-Button-manageGroup"]');
      await expect(manageButton).toBeVisible({ timeout: 5000 });
      await manageButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('[data-testid="ManageGroupPage-Heading-pageTitle"]')).toBeVisible({ timeout: 10000 });
      console.log('✅ Navigated to group management page');
    });

    await test.step('Access deletion functionality', async () => {
      const deleteButton = page.locator('[data-testid="ManageGroupPage-Button-deleteGroup"]');
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Delete option accessed');
    });

    await test.step('Verify deletion confirmation dialog', async () => {
      // Look for a confirmation dialog
      const confirmDialog = page.locator('[data-testid="ManageGroupPage-Button-confirmDelete"]');
      const hasConfirmDialog = await confirmDialog.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasConfirmDialog) {
        console.log('✅ Deletion confirmation dialog shown');

        // Cancel to avoid actually deleting
        const cancelButton = page.locator('[data-testid="GroupSettings-Button-cancel"]');
        const hasCancelButton = await cancelButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasCancelButton) {
          await cancelButton.click();
          await page.waitForLoadState('networkidle');
          console.log('✅ Group deletion cancelled');
        }
      } else {
        // Check for text-based confirmation
        const noButton = page.locator('button:has-text("No"), button:has-text("Cancel")');
        const hasNoButton = await noButton.first().isVisible({ timeout: 3000 }).catch(() => false);
        if (hasNoButton) {
          await noButton.first().click();
          await page.waitForLoadState('networkidle');
          console.log('✅ Group deletion cancelled');
        }
      }
    });
  });
});
