import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Lifecycle E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeEach(async () => {
    emailHelper = new E2EEmailHelper();
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(60000);

  test.describe('Family Member Leaving', () => {
    test('should allow regular member to leave family successfully', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const memberEmail = authHelper.getFileSpecificEmail(`member.leave.${timestamp}`);
      let memberContext: import('playwright').BrowserContext;

      await test.step('Admin creates family and invites new member', async () => {
        await authHelper.setupAdminUser(
          'admin.leave',
          `Admin Leave ${timestamp}`,
          `Leave Test Family ${timestamp}`
        );

        await page.waitForURL('/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');

        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(memberEmail);
        await expect(emailInput).toHaveValue(memberEmail);

        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('New member receives invitation and joins family', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();

        await memberPage.goto('/auth/login');
        await memberPage.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await memberPage.reload();
        await memberPage.waitForLoadState('networkidle');

        const memberAuth = new UniversalAuthHelper(memberPage);
        await memberAuth.acceptInvitation(invitationUrl!, memberEmail);

        const finalUrl = memberPage.url();
        expect(finalUrl).toContain('/dashboard');
      });

      await test.step('Member leaves family', async () => {
        const memberPage = memberContext.pages()[0];

        const manageButton = memberPage.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await memberPage.waitForURL('/family/manage', { timeout: 10000 });

        await expect(memberPage.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 15000 });

        const leaveButton = memberPage.locator('[data-testid="ManageFamilyPage-Button-leaveFamily"]');
        await expect(leaveButton).toBeVisible({ timeout: 5000 });
        await leaveButton.click();

        const confirmButton = memberPage.locator('[data-testid="ManageFamilyPage-Button-confirmLeaveFamily"]');
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        await confirmButton.click();

        await memberPage.waitForURL('/dashboard', { timeout: 15000 });

        await memberContext.close();
      });

      await test.step('Verify member no longer in family member list', async () => {
        // Navigate to manage page first
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Full page reload to clear React Query cache (staleTime: 5min prevents refetch on remount)
        await page.reload();
        await page.waitForLoadState('networkidle');

        const memberList = page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]');
        await expect(memberList).toBeVisible({ timeout: 15000 });

        const leftMemberCard = page.locator(`[data-testid="ManageFamilyPage-Card-familyMember-${memberEmail}"]`);
        await expect(leftMemberCard).not.toBeVisible({ timeout: 5000 });
      });
    });

    test('should prevent last admin from leaving family', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup sole admin user with family', async () => {
        await authHelper.setupAdminUser(
          'admin.sole',
          `Sole Admin ${timestamp}`,
          `Sole Admin Family ${timestamp}`
        );

        await page.waitForURL('/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });
      });

      await test.step('Verify last admin cannot leave family', async () => {
        const leaveButton = page.locator('[data-testid="ManageFamilyPage-Button-leaveFamily"]');

        const isLeaveButtonVisible = await leaveButton.isVisible().catch(() => false);

        if (isLeaveButtonVisible) {
          await leaveButton.click();

          const errorMessage = page.locator('[data-testid="ManageFamilyPage-Alert-lastAdminLeaveError"]');
          await expect(errorMessage).toBeVisible({ timeout: 5000 });
        } else {
          await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });

  test.describe('Family Transitions', () => {
    test('should handle member transferring between families', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const memberEmail = authHelper.getFileSpecificEmail(`member.transition.${timestamp}`);
      let memberContext: import('playwright').BrowserContext;

      await test.step('Create first family and invite member', async () => {
        await authHelper.setupAdminUser(
          'admin.transition',
          `Transition Admin ${timestamp}`,
          `First Family ${timestamp}`
        );

        await page.waitForURL('/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 5000 });
        await inviteButton.click();

        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(memberEmail);
        await expect(emailInput).toHaveValue(memberEmail);

        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Member joins first family via invitation', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();

        await memberPage.goto('/auth/login');
        await memberPage.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await memberPage.reload();
        await memberPage.waitForLoadState('networkidle');

        const memberAuth = new UniversalAuthHelper(memberPage);
        await memberAuth.acceptInvitation(invitationUrl!, memberEmail);

        const finalUrl = memberPage.url();
        expect(finalUrl).toContain('/dashboard');
      });

      await test.step('Second family admin invites same member', async () => {
        const secondAdminEmail = authHelper.getFileSpecificEmail(`admin.second.${timestamp}`);

        memberContext = await _context.browser()!.newContext();
        const secondAdminPage = await memberContext.newPage();

        await secondAdminPage.goto('/auth/login');
        await secondAdminPage.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await secondAdminPage.reload();
        await secondAdminPage.waitForLoadState('networkidle');

        const secondAdminAuth = new UniversalAuthHelper(secondAdminPage);
        await secondAdminAuth.setupAdminUserWithEmail(
          secondAdminPage,
          secondAdminEmail,
          `Second Admin ${timestamp}`,
          `Second Family ${timestamp}`
        );

        await secondAdminPage.waitForURL('/dashboard', { timeout: 15000 });
        await secondAdminPage.waitForLoadState('networkidle');

        const manageButton = secondAdminPage.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await secondAdminPage.waitForURL('/family/manage', { timeout: 10000 });

        const inviteButton = secondAdminPage.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 5000 });
        await inviteButton.click();

        const emailInput = secondAdminPage.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(memberEmail);
        await expect(emailInput).toHaveValue(memberEmail);

        const sendButton = secondAdminPage.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();
        await secondAdminAuth.waitForAuthenticationStability();

        await memberContext.close();
      });

      await test.step('Member receives second invitation while in first family', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
      });
    });

    test('should handle multiple admins scenario during transitions', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const secondAdminEmail = authHelper.getFileSpecificEmail(`secondadmin.multi.${timestamp}`);
      let secondAdminContext: import('playwright').BrowserContext;

      await test.step('Create family with one admin', async () => {
        await authHelper.setupAdminUser(
          'admin.multi',
          `Multi Admin ${timestamp}`,
          `Multi Admin Family ${timestamp}`
        );

        await page.waitForURL('/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });
      });

      await test.step('Invite second admin and they join family', async () => {
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');

        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', secondAdminEmail);

        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Admin' }).click();

        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');

        // Wait for invitation email
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(secondAdminEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        // Second admin joins using isolated browser context
        secondAdminContext = await _context.browser()!.newContext();
        const secondAdminPage = await secondAdminContext.newPage();
        const secondAdminAuth = new UniversalAuthHelper(secondAdminPage);

        await secondAdminAuth.acceptInvitation(invitationUrl!, secondAdminEmail);

        await secondAdminContext.close();
      });

      await test.step('Verify family has multiple admins', async () => {
        // Navigate to manage page first
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Full page reload to clear React Query cache (staleTime: 5min prevents refetch on remount)
        await page.reload();
        await page.waitForLoadState('networkidle');

        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        const adminMembers = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' });
        await expect(adminMembers).toHaveCount(2, { timeout: 15000 });
      });
    });
  });

  test.describe('Data Consistency', () => {
    test('should maintain data consistency across page reloads', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create family and navigate to manage page', async () => {
        await authHelper.setupAdminUser(
          'admin.consistency',
          `Consistency Admin ${timestamp}`,
          `Consistency Family ${timestamp}`
        );

        await page.waitForURL('/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await expect(manageButton).toBeVisible({ timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });
      });

      await test.step('Verify family data before reload', async () => {
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });
      });

      await test.step('Reload page and verify data is preserved', async () => {
        await page.reload();
        await page.waitForLoadState('networkidle');

        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        const pageTitle = page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]');
        await expect(pageTitle).toBeVisible({ timeout: 5000 });
      });
    });
  });
});
