import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';
import { OnboardingFlowHelper } from '../fixtures/onboarding-helper';
import { SharedTestPatterns } from '../fixtures/shared-test-patterns';

test.describe('Group Invitations E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  test('group admin creates group and accesses invitation system', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'invite.setup',
        `Invite Admin ${timestamp}`,
        `Invite Family ${timestamp}`,
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
      await groupNameInput.fill('Invitation Test Group');

      const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      console.log('✅ Test group created');
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

    await test.step('Verify invitation system is accessible', async () => {
      const inviteFamilyButton = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
      await expect(inviteFamilyButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Group invitation system is available');
    });

    await test.step('Open family search invitation dialog', async () => {
      const inviteFamilyButton = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
      await inviteFamilyButton.click();

      const dialogTitle = page.locator('[data-testid="FamilySearchInvitation-Title-inviteFamilyModalTitle"]');
      await expect(dialogTitle).toBeVisible({ timeout: 10000 });
      console.log('✅ Family search invitation dialog opened');
    });

    await test.step('Search for families and verify search interface', async () => {
      const searchInput = page.locator('[data-testid="FamilySearchInvitation-Input-familySearch"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill('Test');

      const searchButton = page.locator('[data-testid="FamilySearchInvitation-Button-searchFamilies"]');
      await expect(searchButton).toBeVisible({ timeout: 5000 });
      await searchButton.click();
      await page.waitForLoadState('networkidle');

      console.log('✅ Family search completed');
    });

    await test.step('Close invitation dialog', async () => {
      await SharedTestPatterns.closeFamilySearchInvitationDialog(page);
    });
  });

  test('group admin can manage group via management interface', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'invite.manage',
        `Manage Admin ${timestamp}`,
        `Manage Family ${timestamp}`,
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
      await groupNameInput.fill('Manage Interface Test Group');

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
    });

    await test.step('Verify group management interface elements', async () => {
      const groupManagementContainer = page.locator('[data-testid="ManageGroupPage-Container-main"]');
      await expect(groupManagementContainer).toBeVisible({ timeout: 10000 });

      const groupFamiliesContainer = page.locator('[data-testid="GroupFamilies-Container-list"]');
      await expect(groupFamiliesContainer).toBeVisible({ timeout: 10000 });

      console.log('✅ Group management interface verified');
    });

    await test.step('Verify admin has invite capability', async () => {
      const inviteFamilyButton = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
      await expect(inviteFamilyButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Group admin invite capability verified');
    });
  });

  test('group member can navigate to group management', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'invite.member',
        `Member Admin ${timestamp}`,
        `Member Family ${timestamp}`,
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
      await groupNameInput.fill('Member Navigation Test Group');

      const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Navigate to groups page and verify group cards', async () => {
      const groupsLink = page.getByRole('link', { name: 'Groups' });
      await groupsLink.click();
      await page.waitForURL('/groups', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
      await expect(groupCard).toBeVisible({ timeout: 10000 });
      console.log('✅ Group cards visible on groups page');
    });

    await test.step('Navigate to group management via manage button', async () => {
      const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
      await expect(groupCard).toBeVisible({ timeout: 5000 });

      const manageButton = groupCard.locator('[data-testid="GroupCard-Button-manageGroup"]');
      await expect(manageButton).toBeVisible({ timeout: 5000 });
      await manageButton.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/groups/');
      console.log('✅ Navigated to group management page');
    });
  });
});
