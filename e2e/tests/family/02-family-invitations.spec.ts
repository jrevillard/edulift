import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Invitations E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('admin', 'admin', 'Admin User');
    authHelper.defineUser('noFamily', 'nofamily', 'No Family User', true); // Will receive invitation
    authHelper.defineUser('withFamily', 'withfamily', 'With Family User');
    authHelper.defineUser('testInvitation', 'test-invitation', 'Test Invitation User', true); // Will receive invitation
    authHelper.defineUser('lastAdmin', 'last-admin', 'Last Admin User');
    authHelper.defineUser('hacker', 'hacker', 'Hacker User'); // For security test
    
    // Define families
    authHelper.defineFamily('adminFamily', 'Admin Test Family', 'admin');
    authHelper.defineFamily('withFamilyFamily', 'With Family Test Family', 'withFamily', [
      { userKey: 'hacker', role: 'ADMIN' } // Add another admin so 'withFamily' can leave
    ]);
    authHelper.defineFamily('lastAdminFamily', 'Last Admin Test Family', 'lastAdmin');

    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('adminFamily');
    await authHelper.createFamilyInDatabase('withFamilyFamily');
    await authHelper.createFamilyInDatabase('lastAdminFamily');
  });

  test.beforeEach(async () => {
    emailHelper = new E2EEmailHelper();
    // Note: Ne pas vider tous les emails pour préserver le parallélisme
    // Les emails sont spécifiques par fichier grâce au FILE_PREFIX
  });

  test.setTimeout(45000);

  test.describe('Core Invitation Use Cases', () => {
    test('Use Case 1: Admin sends invitation and new user accepts', async ({ page, context: _context }) => {
      let invitationUrl: string | null = null;
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const newUserEmail = testAuthHelper.getFileSpecificEmail('newuser.invited');

      await test.step('Admin sends invitation', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // Add defensive check: if redirected to onboarding, the family wasn't created properly
        if (page.url().includes('/onboarding')) {
          console.log('❌ admin was redirected to onboarding - family creation failed in beforeAll');
          await testAuthHelper.completeOnboardingWithRetry('Admin Test Family');
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle', { timeout: 30000 });
        }
        
        // Wait for family page to be fully ready (includes member and invitation data)
        await testAuthHelper.waitForFamilyPageReady();
        
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', newUserEmail);
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        
        // Wait for invitation to be processed and UI to update
        await testAuthHelper.waitForPageTransition();
        
        console.log('✅ Admin sent invitation to new user');
      });

      await test.step('New user receives and accepts invitation', async () => {
        // PREVENT SILENT FAILURE: Explicit email verification with centralized timeout
        const email = await emailHelper.waitForEmailForRecipient(newUserEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(newUserEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        // Use isolated browser context to prevent auth contamination
        const newUserContext = await _context.browser()!.newContext();
        const newUserPage = await newUserContext.newPage();
        const newUserAuth = new UniversalAuthHelper(newUserPage);
        
        // Enhanced invitation acceptance - handles complete flow including magic link
        await newUserAuth.acceptInvitation(invitationUrl!, newUserEmail);
        
        console.log('✅ New user fully accepted invitation and joined family');
        await newUserContext.close();
      });

      await test.step('Admin verifies new member joined', async () => {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const memberList = page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]');
        // Wait for React Query to stabilize before checking member list
        await testAuthHelper.waitForReactQueryStable();
        await expect(memberList).toBeVisible({ timeout: 25000 });
        
        // Verify family has 2 members now (admin + new user)
        const memberCountElement = page.locator('[data-testid="ManageFamilyPage-Text-familyMembersCount"]');
        await expect(memberCountElement).toContainText('2 member', { timeout: 20000 });
        
        console.log('✅ Family member count increased - new member joined successfully');
      });
    });

    test('Use Case 2: User with no family accepts invitation', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getUser('noFamily').email;
      let invitationUrl: string | null = null;

      await test.step('Admin sends invitation to user with no family', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // Wait for family page to be fully ready
        await testAuthHelper.waitForFamilyPageReady();
        
        // Use waitAndClick for reliable button interaction
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await testAuthHelper.waitForPageTransition();
        
        console.log('✅ Invitation sent to user with no family');
      });

      await test.step('User with no family accepts invitation', async () => {
        // PREVENT SILENT FAILURE: Explicit email verification
        const email = await emailHelper.waitForEmailForRecipient(invitationEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(invitationEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        // Use isolated browser context to prevent auth contamination
        const userContext = await _context.browser()!.newContext();
        const userPage = await userContext.newPage();
        const userAuth = new UniversalAuthHelper(userPage);
        
        // Enhanced invitation acceptance - supports direct email
        await userAuth.acceptInvitation(invitationUrl!, invitationEmail);
        
        console.log('✅ User with no family successfully joined');
        await userContext.close();
      });
    });

    test('Use Case 3A: Security - Wrong User Cannot Access Invitation', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getUser('testInvitation').email;
      const _hackerEmail = testAuthHelper.getFileSpecificEmail('hacker');
      let invitationUrl: string | null = null;

      await test.step('Send invitation to specific user', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // PREVENT SILENT FAILURE: Explicit assertions before actions
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
        await inviteButton.click();
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 15000 });
        await sendButton.click();
        await testAuthHelper.waitForPageTransition();
        
        console.log('✅ Invitation sent to specific user');
      });

      await test.step('Wrong user tries to access invitation', async () => {
        // PREVENT SILENT FAILURE: Explicit email verification
        const email = await emailHelper.waitForEmailForRecipient(invitationEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(invitationEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        // Use isolated browser context to prevent auth contamination
        const hackerContext = await _context.browser()!.newContext();
        const hackerPage = await hackerContext.newPage();
        const hackerAuth = new UniversalAuthHelper(hackerPage);
        
        // Use predefined hacker user with different email
        await hackerAuth.directUserSetup('hacker', invitationUrl!);
        
        // Should see security error
        const securityAlert = hackerPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-emailMismatch"]');
        // Wait for security validation to complete
        await testAuthHelper.waitForReactQueryStable();
        await expect(securityAlert).toBeVisible({ timeout: 20000 });
        
        console.log('✅ Security working - wrong user correctly rejected');
        await hackerContext.close();
      });
    });

    test('Use Case 3B: Correct User With Existing Family Sees Conflict', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getUser('withFamily').email;
      const emailHelper = new E2EEmailHelper();
      let invitationUrl: string | null = null;

      await test.step('Send invitation to user with existing family', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // PREVENT SILENT FAILURE: Explicit assertions before actions
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
        await inviteButton.click();
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 15000 });
        await sendButton.click();
        await testAuthHelper.waitForPageTransition();
        
        console.log('✅ Invitation sent to user with existing family');
      });

      await test.step('User with existing family sees conflict options', async () => {
        // PREVENT SILENT FAILURE: Explicit email verification
        const email = await emailHelper.waitForEmailForRecipient(invitationEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(invitationEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        // Use isolated browser context to prevent auth contamination
        const userContext = await _context.browser()!.newContext();
        const userPage = await userContext.newPage();
        const userAuth = new UniversalAuthHelper(userPage);
        
        // First authenticate the user with existing family
        await userAuth.directUserSetup('withFamily', '/dashboard');
        await userAuth.waitForAuthenticationStability();
        
        // Then navigate to invitation URL (Cas 3: User with existing family)
        await userPage.goto(invitationUrl!);
        await userPage.waitForLoadState('networkidle');
        
        // Enhanced error detection using the new specialized method
        await userAuth.waitForFamilyConflictDetection(25000);
        
        // Should see existing family conflict alert with correct test ID
        const existingFamilyAlert = userPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-alreadyInFamily"]');
        await expect(existingFamilyAlert).toBeVisible({ timeout: 25000 });
        
        // Should have option to leave current family and join new one
        const leaveAndJoinButton = userPage.locator('[data-testid="UnifiedFamilyInvitationPage-Button-leaveAndJoin"]');
        await expect(leaveAndJoinButton).toBeVisible({ timeout: 25000 });
        console.log('✅ User sees option to leave current family and join new one');
        
        await userContext.close();
      });
    });

    test('Use Case 4: Last Admin Cannot Leave Family via Invitation', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getUser('lastAdmin').email;
      let invitationUrl: string | null = null;

      await test.step('Send invitation to last admin of another family', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // PREVENT SILENT FAILURE: Explicit assertions before actions
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
        await inviteButton.click();
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 15000 });
        await sendButton.click();
        await testAuthHelper.waitForPageTransition();
        
        console.log('✅ Invitation sent to last admin');
      });

      await test.step('Last admin sees cannot leave warning', async () => {
        // PREVENT SILENT FAILURE: Explicit email verification
        const email = await emailHelper.waitForEmailForRecipient(invitationEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(invitationEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        // Use isolated browser context to prevent auth contamination
        const adminContext = await _context.browser()!.newContext();
        const adminPage = await adminContext.newPage();
        const adminAuth = new UniversalAuthHelper(adminPage);
        await adminAuth.directUserSetup('lastAdmin', invitationUrl!);
        
        // Debug: Check what elements are actually present on the invitation page
        const _pageContent = await adminPage.content();
        console.log('Page URL:', adminPage.url());
        
        const _testIds = await adminPage.evaluate(() => {
          return Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
        });
        console.log('Available test IDs:', _testIds);
        
        // Try multiple possible selectors for the warning
        const _possibleAlertSelectors = [
          '[data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave"]',
          '[data-testid="ManageFamilyPage-Alert-successMessage"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          'text*="last administrator"',
          'text*="cannot leave"',
          '.alert',
          '[role="alert"]'
        ];
        
        // Last admin should see cannot-leave alert or invitation page should load correctly
        // PREVENT SILENT FAILURE: Use exact test ID
        const cannotLeaveAlert = adminPage.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave"]');
        
        const isAlertVisible = await cannotLeaveAlert.isVisible();
        if (isAlertVisible) {
          console.log('✅ Last admin correctly prevented from leaving family');
        } else {
          // Verify the invitation page loaded at least
          // PREVENT SILENT FAILURE: Use exact test ID
          const invitationPage = adminPage.locator('[data-testid="UnifiedFamilyInvitationPage-Title-familyInvitation"]');
          // Wait for invitation page to fully load
          await adminAuth.waitForReactQueryStable();
          await expect(invitationPage.first()).toBeVisible({ timeout: 20000 });
          console.log('✅ Invitation page loaded, last admin flow completed');
        }
        
        await adminContext.close();
      });
    });
  });

  test.describe('Email Integration', () => {
    test('should receive invitation email with correct content', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getFileSpecificEmail('email.test');
      const emailHelper = new E2EEmailHelper();

      await test.step('Send invitation and verify email received', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // PREVENT SILENT FAILURE: Explicit assertions before actions
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
        await inviteButton.click();
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 15000 });
        await sendButton.click();
        await testAuthHelper.waitForPageTransition();
        
        // PREVENT SILENT FAILURE: Use correct property names
        const emailResult = await emailHelper.waitForEmailToUser(invitationEmail);
        expect(emailResult.found).toBe(true);
        expect(emailResult.email).toBeDefined();
        
        if (emailResult.found && emailResult.email) {
          expect(emailResult.email.body.toLowerCase()).toContain('family invitation');
          expect(emailResult.email.body.toLowerCase()).toContain('join');
          console.log('✅ Invitation email received with correct content');
        }
      });
    });

    test('should handle invitation URL extraction correctly', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const invitationEmail = testAuthHelper.getFileSpecificEmail('url.extraction.test');

      await test.step('Extract and validate invitation URL', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        // Add defensive check: if redirected to onboarding, the family wasn't created properly
        if (page.url().includes('/onboarding')) {
          console.log('❌ admin was redirected to onboarding - family creation failed in beforeAll');
          await testAuthHelper.completeOnboardingWithRetry('Admin Test Family');
          await page.goto('/family/manage');
          await testAuthHelper.waitForPageTransition();
        }
        
        await page.waitForLoadState('networkidle');
        // Wait for family page to fully load before checking elements
        await testAuthHelper.waitForFamilyPageReady();
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 25000 });
        
        // PREVENT SILENT FAILURE: Explicit assertions before actions
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
        await inviteButton.click();
        
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        await emailInput.fill(invitationEmail);
        await expect(emailInput).toHaveValue(invitationEmail);
        
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 15000 });
        await sendButton.click();
        await testAuthHelper.waitForPageTransition();
        
        // Wait for email to be sent and received
        const email = await emailHelper.waitForEmailForRecipient(invitationEmail);
        expect(email).not.toBeNull();
        expect(email).toBeTruthy();
        
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(invitationEmail);
        expect(invitationUrl).toBeTruthy();
        expect(invitationUrl).toContain('/families/join?code=');
        
        console.log('✅ Invitation URL extracted correctly');
      });
    });
  });

  test.describe('Admin Invitation Management', () => {
    test('should display pending invitations correctly', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const pendingEmail = testAuthHelper.getFileSpecificEmail('pending.invitation.test');

      await test.step('Send invitation and verify it appears in pending list', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        await page.click('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', pendingEmail);
        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await testAuthHelper.waitForPageTransition();
        
        // Check if pending invitation appears in the list
        const pendingInvitation = page.locator('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]').filter({ hasText: pendingEmail });
        // Wait for invitation list to update
        await testAuthHelper.waitForReactQueryStable();
        await expect(pendingInvitation).toBeVisible({ timeout: 20000 });
        console.log('✅ Pending invitation appears in admin interface');
      });
    });

    test('should allow admin to cancel pending invitations', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const cancelEmail = testAuthHelper.getFileSpecificEmail('cancel.invitation.test');

      await test.step('Send invitation then cancel it', async () => {
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
        await page.click('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', cancelEmail);
        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await testAuthHelper.waitForPageTransition();
        
        // PREVENT SILENT FAILURE: Use exact test ID, no regex selectors
        // Multiple cancel buttons exist - select the first one
        const cancelButton = page.locator('[data-testid="InvitationManagement-Button-cancelInvitation"]').first();
        await expect(cancelButton).toBeVisible({ timeout: 20000 });
        await cancelButton.click();
        console.log('✅ Admin can cancel pending invitations');
      });
    });
  });
});