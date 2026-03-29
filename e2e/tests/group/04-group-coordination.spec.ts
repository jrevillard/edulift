import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';
import { OnboardingFlowHelper } from '../fixtures/onboarding-helper';
import { SharedTestPatterns } from '../fixtures/shared-test-patterns';

test.describe('Group Coordination E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  test('group admin can manage group and view families', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'coordination.manage',
        `Coord Admin ${timestamp}`,
        `Coord Family ${timestamp}`,
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
      await groupNameInput.fill('Coordination Test Group');

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

    await test.step('View group families list', async () => {
      const familiesContainer = page.locator('[data-testid="GroupFamilies-Container-list"]');
      await expect(familiesContainer).toBeVisible({ timeout: 10000 });
      console.log('✅ Group families list visible');
    });

    await test.step('Verify admin capabilities on management page', async () => {
      const inviteFamilyButton = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
      await expect(inviteFamilyButton).toBeVisible({ timeout: 10000 });

      const configureScheduleButton = page.locator('[data-testid="ManageGroupPage-Button-configureSchedule"]');
      await expect(configureScheduleButton).toBeVisible({ timeout: 10000 });

      console.log('✅ Admin capabilities verified');
    });
  });

  test('group admin can invite families via search', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'coordination.invite',
        `Invite Coord Admin ${timestamp}`,
        `Invite Coord Family ${timestamp}`,
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
      await groupNameInput.fill('Invite Coord Test Group');

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

    await test.step('Open family search invitation dialog', async () => {
      const inviteFamilyButton = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
      await expect(inviteFamilyButton).toBeVisible({ timeout: 10000 });
      await inviteFamilyButton.click();

      const dialogTitle = page.locator('[data-testid="FamilySearchInvitation-Title-inviteFamilyModalTitle"]');
      await expect(dialogTitle).toBeVisible({ timeout: 10000 });
      console.log('✅ Family search invitation dialog opened');
    });

    await test.step('Perform family search', async () => {
      const searchInput = page.locator('[data-testid="FamilySearchInvitation-Input-familySearch"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill('Coord');

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

  test('group admin can configure schedule for coordination', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup admin user and create a test group', async () => {
      await authHelper.setupAdminUser(
        'coordination.schedule',
        `Schedule Coord Admin ${timestamp}`,
        `Schedule Coord Family ${timestamp}`,
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
      await groupNameInput.fill('Schedule Coord Test Group');

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

    await test.step('Open schedule configuration modal', async () => {
      const configureScheduleButton = page.locator('[data-testid="ManageGroupPage-Button-configureSchedule"]');
      await expect(configureScheduleButton).toBeVisible({ timeout: 10000 });
      await configureScheduleButton.click();

      const modal = page.locator('[data-testid="GroupScheduleConfigModal-Content-dialog"]');
      await expect(modal).toBeVisible({ timeout: 10000 });

      const modalTitle = page.locator('[data-testid="GroupScheduleConfigModal-Title-scheduleConfig"]');
      await expect(modalTitle).toBeVisible({ timeout: 5000 });
      console.log('✅ Schedule configuration modal opened');
    });

    await test.step('Configure time slots for multiple weekdays', async () => {
      // Add to Monday
      const mondayTab = page.locator('[data-testid="GroupScheduleConfigModal-Tab-monday"]');
      await mondayTab.click();
      await page.waitForLoadState('networkidle');

      const timeSelector = page.locator('[data-testid="GroupScheduleConfigModal-Select-newTimeSlot"]');
      await expect(timeSelector).toBeVisible({ timeout: 5000 });
      await timeSelector.selectOption('08:00');

      const addButton = page.locator('[data-testid="GroupScheduleConfigModal-Button-addTimeSlot"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();
      await page.waitForLoadState('networkidle');

      const mondayBadge = page.locator('[data-testid="GroupScheduleConfigModal-Badge-mondaySlotCount"]');
      await expect(mondayBadge).toContainText('1', { timeout: 5000 });

      // Add to Wednesday
      const wednesdayTab = page.locator('[data-testid="GroupScheduleConfigModal-Tab-wednesday"]');
      await wednesdayTab.click();
      await page.waitForLoadState('networkidle');

      await timeSelector.selectOption('15:30');
      await addButton.click();
      await page.waitForLoadState('networkidle');

      const wednesdayBadge = page.locator('[data-testid="GroupScheduleConfigModal-Badge-wednesdaySlotCount"]');
      await expect(wednesdayBadge).toContainText('1', { timeout: 5000 });

      console.log('✅ Time slots configured for multiple weekdays');
    });

    await test.step('Save schedule configuration', async () => {
      const saveButton = page.locator('[data-testid="GroupScheduleConfigModal-Button-saveConfiguration"]');
      await expect(saveButton).not.toBeDisabled({ timeout: 5000 });
      await saveButton.click();

      const modal = page.locator('[data-testid="GroupScheduleConfigModal-Content-dialog"]');
      await expect(modal).not.toBeVisible({ timeout: 10000 });
      await page.waitForLoadState('networkidle');

      console.log('✅ Schedule configuration saved');
    });
  });
});
