import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Invitations E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeEach(async () => {
    emailHelper = new E2EEmailHelper();
    await emailHelper.deleteAllEmails();
  });

  test.describe('Core Invitation Use Cases', () => {
    test('Use Case 1: Admin sends invitation and new user accepts', async ({ page, context: browserContext }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.invite1.${timestamp}`);
      const adminName = `Admin User ${timestamp}`;
      const familyName = `Invite Test Family ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.invite1.${timestamp}`);

      await test.step('Admin creates account and family', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        // Wait for backend to process the request
        await page.waitForTimeout(2000);

        console.log('✅ Magic link requested for admin');
      });

      await test.step('Admin completes onboarding to create family', async () => {
        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();
        expect(magicLinkUrl).toContain('/auth/verify');

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        const currentUrl = page.url();
        expect(currentUrl).toContain('/onboarding');
        console.log('✅ Authenticated and redirected to onboarding');

        await authHelper.completeOnboarding(familyName);
        console.log('✅ Family created and redirected to dashboard');
      });

      await test.step('Admin sends invitation to new user', async () => {
        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        // Send invitation
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation to new user');
      });

      await test.step('New user accepts invitation', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        const recipientContext = await browserContext.browser().newContext();
        const recipientPage = await recipientContext.newPage();
        const recipientAuth = UniversalAuthHelper.forCurrentFile(recipientPage);

        // New user navigates to invitation URL
        await recipientPage.goto(invitationUrl);
        await recipientPage.waitForLoadState('networkidle');

        // Verify invitation page is displayed
        const familyNameElement = recipientPage.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
        await expect(familyNameElement).toBeVisible({ timeout: 10000 });

        console.log('✅ Invitation page displayed with family name');

        // For unauthenticated new users, first click "Sign In to join" button
        const signInButton = recipientPage.locator('[data-testid="UnifiedFamilyInvitationPage-Button-signInToJoin"]');
        await expect(signInButton).toBeVisible({ timeout: 10000 });
        await signInButton.click();

        // Now the signup form should appear
        const nameInput = recipientPage.locator('[data-testid="SignupForm-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 10000 });

        const recipientName = `Recipient User ${timestamp}`;
        await nameInput.fill(recipientName);

        // Submit the signup form to request magic link
        const submitButton = recipientPage.locator('[data-testid="SignupForm-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();

        await recipientAuth.waitForAuthenticationStability();
        await recipientPage.waitForTimeout(2000);

        console.log('✅ New user requested magic link from invitation page');

        // Get magic link from email
        const recipientMagicLink = await emailHelper.extractMagicLinkForRecipient(recipientEmail);
        expect(recipientMagicLink).toBeTruthy();
        expect(recipientMagicLink).toContain('/auth/verify');

        // Verify magic link - this should automatically add user to the family
        await recipientPage.goto(recipientMagicLink);
        await recipientPage.waitForLoadState('networkidle');

        // After accepting invitation, should be redirected to dashboard (already has family now)
        await expect(recipientPage).toHaveURL(/\/dashboard/, { timeout: 20000 });

        console.log('✅ New user accepted invitation and joined family');

        await recipientContext.close();
      });

      await test.step('Admin verifies new member joined', async () => {
        // Reload admin's page to see updated member count
        await page.reload();
        await page.waitForLoadState('networkidle');

        // The dashboard shows "X members" text
        const memberCountText = page.getByText('2 members');
        await expect(memberCountText).toBeVisible({ timeout: 10000 });

        console.log('✅ Family member count is 2 - new member joined successfully');
      });
    });

    test('Use Case 2: User with no family accepts invitation', async ({ page, context: browserContext }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.invite2.${timestamp}`);
      const adminName = `Admin User 2 ${timestamp}`;
      const familyName = `No Family Test ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.invite2.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Invitation sent to user with no family');
      });

      await test.step('User with no family accepts invitation', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        const recipientContext = await browserContext.browser().newContext();
        const recipientPage = await recipientContext.newPage();
        const recipientAuth = UniversalAuthHelper.forCurrentFile(recipientPage);

        // New user navigates to invitation URL
        await recipientPage.goto(invitationUrl);
        await recipientPage.waitForLoadState('networkidle');

        // Verify invitation page is displayed
        const familyNameElement = recipientPage.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
        await expect(familyNameElement).toBeVisible({ timeout: 10000 });

        console.log('✅ Invitation page displayed with family name');

        // For unauthenticated new users, first click "Sign In to join" button
        const signInButton = recipientPage.locator('[data-testid="UnifiedFamilyInvitationPage-Button-signInToJoin"]');
        await expect(signInButton).toBeVisible({ timeout: 10000 });
        await signInButton.click();

        // Now the signup form should appear
        const nameInput = recipientPage.locator('[data-testid="SignupForm-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 10000 });

        const recipientName = `Recipient User 2 ${timestamp}`;
        await nameInput.fill(recipientName);

        // Submit the signup form to request magic link
        const submitButton = recipientPage.locator('[data-testid="SignupForm-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();

        await recipientAuth.waitForAuthenticationStability();
        await recipientPage.waitForTimeout(2000);

        console.log('✅ New user requested magic link from invitation page');

        // Get magic link from email
        const recipientMagicLink = await emailHelper.extractMagicLinkForRecipient(recipientEmail);
        expect(recipientMagicLink).toBeTruthy();
        expect(recipientMagicLink).toContain('/auth/verify');

        // Verify magic link - this should automatically add user to the family
        await recipientPage.goto(recipientMagicLink);
        await recipientPage.waitForLoadState('networkidle');

        // After accepting invitation, should be redirected to dashboard (already has family now)
        await expect(recipientPage).toHaveURL(/\/dashboard/, { timeout: 20000 });

        console.log('✅ User with no family accepted invitation and joined family');

        await recipientContext.close();
      });
    });
  });

  test.describe('Security and Edge Cases', () => {
    test('Use Case 3A: Security - Wrong User Cannot Access Invitation', async ({ page, context: browserContext }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.security.${timestamp}`);
      const adminName = `Admin Security ${timestamp}`;
      const familyName = `Security Test Family ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.security.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation for security test');
      });

      await test.step('Hacker tries to access invitation URL', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        expect(invitationUrl).toBeTruthy();

        // Hacker creates their own account with family
        const hackerContext = await browserContext.browser().newContext();
        const hackerPage = await hackerContext.newPage();
        const hackerAuth = new UniversalAuthHelper(hackerPage);
        const hackerEmail = authHelper.getFileSpecificEmail(`hacker.${timestamp}`);
        const hackerName = `Hacker User ${timestamp}`;
        const hackerFamily = `Hacker Family ${timestamp}`;

        // Hacker creates account via magic link
        await hackerPage.goto('/auth/login');
        await hackerPage.waitForLoadState('networkidle');

        const hackerNewUserTab = hackerPage.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(hackerNewUserTab).toBeVisible({ timeout: 5000 });
        await hackerNewUserTab.click();
        await hackerAuth.waitForAuthenticationStability();

        const hackerNameInput = hackerPage.locator('[data-testid="LoginPage-Input-name"]');
        await expect(hackerNameInput).toBeVisible({ timeout: 5000 });
        const hackerEmailInput = hackerPage.locator('[data-testid="LoginPage-Input-email"]');

        await hackerEmailInput.fill(hackerEmail);
        await hackerNameInput.fill(hackerName);

        const hackerSubmitButton = hackerPage.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(hackerSubmitButton).toBeVisible({ timeout: 5000 });
        await expect(hackerSubmitButton).toBeEnabled({ timeout: 10000 });
        await hackerSubmitButton.click();
        await hackerAuth.waitForAuthenticationStability();

        await hackerPage.waitForTimeout(2000);

        const hackerMagicLink = await emailHelper.extractMagicLinkForRecipient(hackerEmail);
        expect(hackerMagicLink).toBeTruthy();

        await hackerPage.goto(hackerMagicLink);
        await hackerPage.waitForLoadState('networkidle');

        expect(hackerPage.url()).toContain('/onboarding');

        // Hacker completes onboarding
        await hackerAuth.completeOnboarding(hackerFamily);
        await expect(hackerPage.locator('[data-testid="DashboardPage-Text-familyName"]')).toBeVisible();

        // Hacker tries to access invitation URL
        await hackerPage.goto(invitationUrl);

        // Verify security alert appears (email mismatch error)
        const securityAlert = hackerPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-emailMismatch"]');
        await expect(securityAlert).toBeVisible({ timeout: 20000 });

        await hackerContext.close();
        console.log('✅ Security test passed - wrong user cannot access invitation');
      });
    });

    test('Use Case 3B: Correct User With Existing Family Sees Conflict', async ({ page, context: browserContext }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const userAEmail = authHelper.getFileSpecificEmail(`user.conflict.${timestamp}`);
      const userAName = `User A ${timestamp}`;
      const userAFamily = `User A Family ${timestamp}`;
      const adminEmail = authHelper.getFileSpecificEmail(`admin.conflict.${timestamp}`);
      const adminName = `Admin Conflict ${timestamp}`;
      const adminFamily = `Admin Conflict Test ${timestamp}`;

      await test.step('User A creates their own family', async () => {
        const userAContext = await browserContext.browser().newContext();
        const userAPage = await userAContext.newPage();
        const userAAuth = new UniversalAuthHelper(userAPage);

        // User A creates account and family
        await userAPage.goto('/auth/login');
        await userAPage.waitForLoadState('networkidle');

        const userANewUserTab = userAPage.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(userANewUserTab).toBeVisible({ timeout: 5000 });
        await userANewUserTab.click();
        await userAAuth.waitForAuthenticationStability();

        const userANameInput = userAPage.locator('[data-testid="LoginPage-Input-name"]');
        await expect(userANameInput).toBeVisible({ timeout: 5000 });
        const userAEmailInput = userAPage.locator('[data-testid="LoginPage-Input-email"]');

        await userAEmailInput.fill(userAEmail);
        await userANameInput.fill(userAName);

        const userASubmitButton = userAPage.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(userASubmitButton).toBeVisible({ timeout: 5000 });
        await expect(userASubmitButton).toBeEnabled({ timeout: 10000 });
        await userASubmitButton.click();
        await userAAuth.waitForAuthenticationStability();

        await userAPage.waitForTimeout(2000);

        const userAMagicLink = await emailHelper.extractMagicLinkForRecipient(userAEmail);
        expect(userAMagicLink).toBeTruthy();

        await userAPage.goto(userAMagicLink);
        await userAPage.waitForLoadState('networkidle');

        expect(userAPage.url()).toContain('/onboarding');

        await userAAuth.completeOnboarding(userAFamily);
        await expect(userAPage.locator('[data-testid="DashboardPage-Text-familyName"]')).toBeVisible();

        await userAContext.close();
        console.log('✅ User A created their own family');
      });

      await test.step('Admin sends invitation to User A', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const adminNewUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(adminNewUserTab).toBeVisible({ timeout: 5000 });
        await adminNewUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const adminNameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(adminNameInput).toBeVisible({ timeout: 5000 });
        const adminEmailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await adminEmailInput.fill(adminEmail);
        await adminNameInput.fill(adminName);

        const adminSubmitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(adminSubmitButton).toBeVisible({ timeout: 5000 });
        await expect(adminSubmitButton).toBeEnabled({ timeout: 10000 });
        await adminSubmitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const adminMagicLink = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(adminMagicLink).toBeTruthy();

        await page.goto(adminMagicLink);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(adminFamily);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', userAEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation to user with existing family');
      });

      await test.step('User A navigates to invitation and sees conflict options', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(userAEmail);
        expect(invitationUrl).toBeTruthy();

        const userAContext = await browserContext.browser().newContext();
        const userAPage = await userAContext.newPage();
        const userAAuth = new UniversalAuthHelper(userAPage);

        // User A logs in (already has account from step 1)
        await userAPage.goto('/auth/login');
        await userAPage.waitForLoadState('networkidle');

        const existingUserTab = userAPage.locator('[data-testid="LoginPage-Tab-existingUser"]');
        await expect(existingUserTab).toBeVisible({ timeout: 5000 });
        await existingUserTab.click();
        await userAAuth.waitForAuthenticationStability();

        const userAEmailInput = userAPage.locator('[data-testid="LoginPage-Input-email"]');
        await userAEmailInput.fill(userAEmail);

        const userASubmitButton = userAPage.locator('[data-testid="LoginPage-Button-sendMagicLink"]');
        await expect(userASubmitButton).toBeVisible({ timeout: 5000 });
        await userASubmitButton.click();
        await userAAuth.waitForAuthenticationStability();

        await userAPage.waitForTimeout(2000);

        const userAMagicLink = await emailHelper.extractMagicLinkForRecipient(userAEmail);
        expect(userAMagicLink).toBeTruthy();

        await userAPage.goto(userAMagicLink);
        await userAPage.waitForLoadState('networkidle');

        // Should go to dashboard (already has family)
        await expect(userAPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

        // User A navigates to invitation URL while authenticated
        await userAPage.goto(invitationUrl);

        // Verify conflict UI appears
        const existingFamilyAlert = userAPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-alreadyInFamily"]');
        await expect(existingFamilyAlert).toBeVisible({ timeout: 25000 });

        // Since User A is alone in their family (last admin), they should see the "cannot leave" alert
        const cannotLeaveAlert = userAPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave"]');
        await expect(cannotLeaveAlert).toBeVisible({ timeout: 25000 });

        await userAContext.close();
        console.log('✅ Conflict UI displayed correctly for user with existing family');
      });
    });

    test('Use Case 4: Last Admin Cannot Leave Family via Invitation', async ({ page, context: browserContext }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const lastAdminEmail = authHelper.getFileSpecificEmail(`lastadmin.${timestamp}`);
      const lastAdminName = `Last Admin ${timestamp}`;
      const lastAdminFamily = `Last Admin Family ${timestamp}`;
      const adminEmail = authHelper.getFileSpecificEmail(`admin.lastadmin.${timestamp}`);
      const adminName = `Admin Last Admin ${timestamp}`;
      const adminFamily = `Admin Last Admin Test ${timestamp}`;

      await test.step('Last admin creates family alone', async () => {
        const lastAdminContext = await browserContext.browser().newContext();
        const lastAdminPage = await lastAdminContext.newPage();
        const lastAdminAuth = new UniversalAuthHelper(lastAdminPage);

        // Last admin creates account and family
        await lastAdminPage.goto('/auth/login');
        await lastAdminPage.waitForLoadState('networkidle');

        const lastAdminNewUserTab = lastAdminPage.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(lastAdminNewUserTab).toBeVisible({ timeout: 5000 });
        await lastAdminNewUserTab.click();
        await lastAdminAuth.waitForAuthenticationStability();

        const lastAdminNameInput = lastAdminPage.locator('[data-testid="LoginPage-Input-name"]');
        await expect(lastAdminNameInput).toBeVisible({ timeout: 5000 });
        const lastAdminEmailInput = lastAdminPage.locator('[data-testid="LoginPage-Input-email"]');

        await lastAdminEmailInput.fill(lastAdminEmail);
        await lastAdminNameInput.fill(lastAdminName);

        const lastAdminSubmitButton = lastAdminPage.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(lastAdminSubmitButton).toBeVisible({ timeout: 5000 });
        await expect(lastAdminSubmitButton).toBeEnabled({ timeout: 10000 });
        await lastAdminSubmitButton.click();
        await lastAdminAuth.waitForAuthenticationStability();

        await lastAdminPage.waitForTimeout(2000);

        const lastAdminMagicLink = await emailHelper.extractMagicLinkForRecipient(lastAdminEmail);
        expect(lastAdminMagicLink).toBeTruthy();

        await lastAdminPage.goto(lastAdminMagicLink);
        await lastAdminPage.waitForLoadState('networkidle');

        expect(lastAdminPage.url()).toContain('/onboarding');

        await lastAdminAuth.completeOnboarding(lastAdminFamily);
        await expect(lastAdminPage.locator('[data-testid="DashboardPage-Text-familyName"]')).toBeVisible();

        await lastAdminContext.close();
        console.log('✅ Last admin created family (alone, no other members)');
      });

      await test.step('Another admin sends invitation to last admin', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const adminNewUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(adminNewUserTab).toBeVisible({ timeout: 5000 });
        await adminNewUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const adminNameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(adminNameInput).toBeVisible({ timeout: 5000 });
        const adminEmailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await adminEmailInput.fill(adminEmail);
        await adminNameInput.fill(adminName);

        const adminSubmitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(adminSubmitButton).toBeVisible({ timeout: 5000 });
        await expect(adminSubmitButton).toBeEnabled({ timeout: 10000 });
        await adminSubmitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const adminMagicLink = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(adminMagicLink).toBeTruthy();

        await page.goto(adminMagicLink);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(adminFamily);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', lastAdminEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation to last admin of another family');
      });

      await test.step('Last admin tries to accept invitation but cannot leave', async () => {
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(lastAdminEmail);
        expect(invitationUrl).toBeTruthy();

        const lastAdminContext = await browserContext.browser().newContext();
        const lastAdminPage = await lastAdminContext.newPage();
        const lastAdminAuth = new UniversalAuthHelper(lastAdminPage);

        // Last admin logs in
        await lastAdminPage.goto('/auth/login');
        await lastAdminPage.waitForLoadState('networkidle');

        const existingUserTab = lastAdminPage.locator('[data-testid="LoginPage-Tab-existingUser"]');
        await expect(existingUserTab).toBeVisible({ timeout: 5000 });
        await existingUserTab.click();
        await lastAdminAuth.waitForAuthenticationStability();

        const lastAdminEmailInput = lastAdminPage.locator('[data-testid="LoginPage-Input-email"]');
        await lastAdminEmailInput.fill(lastAdminEmail);

        const lastAdminSubmitButton = lastAdminPage.locator('[data-testid="LoginPage-Button-sendMagicLink"]');
        await expect(lastAdminSubmitButton).toBeVisible({ timeout: 5000 });
        await lastAdminSubmitButton.click();
        await lastAdminAuth.waitForAuthenticationStability();

        await lastAdminPage.waitForTimeout(2000);

        const lastAdminMagicLink = await emailHelper.extractMagicLinkForRecipient(lastAdminEmail);
        expect(lastAdminMagicLink).toBeTruthy();

        await lastAdminPage.goto(lastAdminMagicLink);
        await lastAdminPage.waitForLoadState('networkidle');

        await expect(lastAdminPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

        // Last admin navigates to invitation URL
        await lastAdminPage.goto(invitationUrl);

        // Verify last admin protection alert appears
        const lastAdminAlert = lastAdminPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave"]');
        await expect(lastAdminAlert).toBeVisible({ timeout: 25000 });

        await lastAdminContext.close();
        console.log('✅ Last admin protection enforced - cannot leave family');
      });
    });
  });

  test.describe('Admin Invitation Management', () => {
    test('should display pending invitations correctly', async ({ page }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.pending.${timestamp}`);
      const adminName = `Admin Pending ${timestamp}`;
      const familyName = `Pending Test Family ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.pending.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        // Track all API calls
        const apiCalls: { url: string; method: string; status?: number }[] = [];
        page.on('request', request => {
          if (request.url().includes('/api/')) {
            apiCalls.push({ url: request.url(), method: request.method() });
            console.log(`📤 API Request: ${request.method()} ${request.url()}`);
          }
        });

        // Track console logs from frontend
        page.on('console', msg => {
          const text = msg.text();
          // Capture all emoji-prefixed logs for debugging
          if (text.match(/^[🔍✅❌⚠️🔄🚨]/) || text.includes('Redirecting') || text.includes('checking redirect')) {
            console.log(`🖥️  Frontend: ${text}`);
          }
        });

        page.on('response', async response => {
          if (response.url().includes('/api/')) {
            const status = response.status();
            const url = response.url();
            console.log(`📥 API Response [${status}] ${url}`);

            // Log response body for invitations endpoint
            if (url.includes('/invitations')) {
              try {
                const body = await response.json();
                console.log(`📄 Response body:`, JSON.stringify(body, null, 2));
              } catch {
                // Not JSON
              }
            }
          }
        });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');

        // Check URL immediately after clicking send
        console.log(`📍 URL immediately after clicking send: ${page.url()}`);

        // Wait for dialog to close and component to update
        await page.waitForSelector('[data-testid="InvitationManagement-Dialog-inviteDialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {
          // Dialog might have different structure, just wait a bit
          console.log('⚠️ Dialog selector not found, waiting for page transition instead');
        });

        // Check URL after dialog closes
        console.log(`📍 URL after dialog closes: ${page.url()}`);

        await authHelper.waitForPageTransition();

        // Check URL after page transition
        console.log(`📍 URL after page transition: ${page.url()}`);

        console.log(`✅ Admin sent invitation. Total API calls tracked: ${apiCalls.length}`);
      });

      await test.step('Verify pending invitation appears in UI', async () => {
        // Navigate back to family management page (user was redirected to dashboard after sending invitation)
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Wait for React Query to stabilize and component to update
        await authHelper.waitForReactQueryStable();
        await page.waitForTimeout(3000);

        // Log current URL to debug
        console.log('📍 Current URL:', page.url());

        // Check that pending invitation is displayed using the email text
        const pendingInvitationEmail = page.locator('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]', { hasText: recipientEmail });
        await expect(pendingInvitationEmail).toBeVisible({ timeout: 20000 });

        console.log('✅ Pending invitation displayed correctly');
      });
    });

    test('should allow admin to cancel pending invitations', async ({ page }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.cancel.${timestamp}`);
      const adminName = `Admin Cancel ${timestamp}`;
      const familyName = `Cancel Test Family ${timestamp}`;
      const cancelEmail = authHelper.getFileSpecificEmail(`recipient.cancel.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', cancelEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');

        // Wait for dialog to close and component to update
        await page.waitForSelector('[data-testid="InvitationManagement-Dialog-inviteDialog"]', { state: 'hidden', timeout: 10000 }).catch(() => {
          // Dialog might have different structure, just wait a bit
          console.log('⚠️ Dialog selector not found, waiting for page transition instead');
        });
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation to cancel');
      });

      await test.step('Cancel the pending invitation', async () => {
        // Navigate back to family management page (user was redirected to dashboard after sending invitation)
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Wait for React Query to stabilize and component to update
        await authHelper.waitForReactQueryStable();
        await page.waitForTimeout(2000);

        // Find the invitation by email, then click its cancel button
        const invitationEmail = page.locator(`[data-testid="InvitationManagement-Text-pendingInvitationEmail"]`, { hasText: cancelEmail });

        // Navigate to the parent container to find the cancel button
        const invitationRow = invitationEmail.locator('xpath=../../../../..');

        const cancelButton = invitationRow.locator('[data-testid="InvitationManagement-Button-cancelInvitation"]');
        await expect(cancelButton).toBeVisible({ timeout: 10000 });
        await cancelButton.click();
        await authHelper.waitForPageTransition();

        console.log('✅ Admin canceled pending invitation');
      });

      await test.step('Verify invitation removed from UI', async () => {
        // Wait for React Query to stabilize after cancellation
        await authHelper.waitForReactQueryStable();
        await page.waitForTimeout(2000);

        // Verify invitation no longer appears
        const pendingInvitationEmail = page.locator('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]', { hasText: cancelEmail });
        await expect(pendingInvitationEmail).not.toBeVisible({ timeout: 10000 });

        console.log('✅ Invitation successfully removed after cancellation');
      });
    });
  });

  test.describe('Email Integration', () => {
    test('should receive invitation email with correct content', async ({ page }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.emailcontent.${timestamp}`);
      const adminName = `Admin Email Content ${timestamp}`;
      const familyName = `Email Content Test ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.emailcontent.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation for email content verification');
      });

      await test.step('Verify email was received', async () => {
        const email = await emailHelper.waitForEmailForRecipient(recipientEmail);
        expect(email).not.toBeNull();

        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        console.log('✅ Email received with valid invitation URL');
      });
    });

    test('should handle invitation URL extraction correctly', async ({ page }) => {
      const timestamp = Date.now();
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      const adminEmail = authHelper.getFileSpecificEmail(`admin.urlextract.${timestamp}`);
      const adminName = `Admin URL Extract ${timestamp}`;
      const familyName = `URL Extract Test ${timestamp}`;
      const recipientEmail = authHelper.getFileSpecificEmail(`recipient.urlextract.${timestamp}`);

      await test.step('Admin creates family and sends invitation', async () => {
        await page.goto('/auth/login');
        await page.waitForLoadState('networkidle');

        const newUserTab = page.locator('[data-testid="LoginPage-Tab-newUser"]');
        await expect(newUserTab).toBeVisible({ timeout: 5000 });
        await newUserTab.click();
        await authHelper.waitForAuthenticationStability();

        const nameInput = page.locator('[data-testid="LoginPage-Input-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');

        await emailInput.fill(adminEmail);
        await nameInput.fill(adminName);

        const submitButton = page.locator('[data-testid="LoginPage-Button-createAccount"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();

        await page.waitForTimeout(2000);

        const magicLinkUrl = await emailHelper.extractMagicLinkForRecipient(adminEmail);
        expect(magicLinkUrl).toBeTruthy();

        await page.goto(magicLinkUrl);
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/onboarding');
        await authHelper.completeOnboarding(familyName);

        // Navigate to family management page via Manage Family button
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();

        // Wait for navigation to family management page
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Verify family information container is loaded
        const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfo).toBeVisible({ timeout: 10000 });

        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        await authHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await authHelper.waitForPageTransition();

        console.log('✅ Admin sent invitation for URL extraction test');
      });

      await test.step('Extract and validate invitation URL', async () => {
        // Navigate back to family management page (user was redirected to dashboard after sending invitation)
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        await page.waitForURL('/family/manage', { timeout: 10000 });

        await authHelper.waitForFamilyPageReady();
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 25000 });

        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');

        console.log('✅ Invitation URL extracted and validated successfully');
      });
    });
  });
});
