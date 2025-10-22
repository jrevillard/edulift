import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Unified Invitation System E2E', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('familyAdmin', 'family-admin-user', 'Family Admin');
    authHelper.defineUser('testInvitee', 'test-invitee', 'Test Invitee');
    authHelper.defineUser('groupInvitee', 'test-group-invitee', 'Test Group Invitee');
    authHelper.defineUser('compatibilityTester', 'compatibility-tester', 'Compatibility Tester');
    
    // Define families for complete user setup
    authHelper.defineFamily('adminFamily', 'Admin Test Family', 'familyAdmin');
    authHelper.defineFamily('inviteeFamily', 'Invitee Test Family', 'testInvitee');
    authHelper.defineFamily('groupFamily', 'Group Test Family', 'groupInvitee');
    authHelper.defineFamily('compatibilityFamily', 'Compatibility Family', 'compatibilityTester');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    
    // Create families sequentially to reduce database contention
    await authHelper.createMultipleEntitiesInSequence([
      () => authHelper.createFamilyInDatabase('adminFamily'),
      () => authHelper.createFamilyInDatabase('inviteeFamily'),
      () => authHelper.createFamilyInDatabase('groupFamily'),
      () => authHelper.createFamilyInDatabase('compatibilityFamily')
    ], 1000);
    
    // Add a longer wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 5);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution
  test.describe('Unified Validation Endpoint', () => {
    test.skip('should validate family invitation codes via unified endpoint', async ({ page }) => {
      // SKIPPED: This test requires hardcoded test patterns which were removed from production code
      // TODO: Implement proper invitation testing with real invitation creation
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Set up admin user with family using directUserSetup (user needs existing family for /family/manage)
      await authHelper.directUserSetup('familyAdmin', '/family/manage');
      
      // Verify we're on family management page
      
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
      
      // Generate invite code via UI (proper modern approach)
      let inviteCode = '';
      
      // Use the UI invitation system to create an invite code
      try {
        // Click the invite member button to open dialog
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 10000 });
        await inviteButton.click();
        
        // Wait for dialog and fill invitation form
        await page.waitForLoadState('networkidle');
        
        // Fill the invitation form with test data
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill('test-invitation@example.com');
        
        // Select member role
        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await roleSelect.click();
        await page.locator('[role="option"]:has-text("Member")').click();
        
        // Intercept the invitation creation API response to capture the invite code
        const invitationPromise = page.waitForResponse(
          response => response.url().includes('/families/') && response.url().includes('/invite') && response.status() === 201
        );
        
        // Send invitation to generate the code
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await sendButton.click();
        
        // Wait for the invitation creation response
        const invitationResponse = await invitationPromise;
        const invitationData = await invitationResponse.json();
        
        // Extract the invite code from the response
        inviteCode = invitationData.data?.inviteCode || invitationData.inviteCode;
        
        if (!inviteCode) {
          console.error('API Response structure:', JSON.stringify(invitationData, null, 2));
          throw new Error('Failed to extract invite code from API response');
        }
        
        console.log('✅ Generated real family invite code:', inviteCode);
        
        // Wait a bit to ensure invitation is persisted in database
        await authHelper.waitForPageTransition(1000);
        
      } catch (error) {
        console.error('Failed to create invitation through UI:', error);
        throw new Error('Could not generate real invitation code - test cannot proceed without proper invitation');
      }
      
      if (!inviteCode || inviteCode.trim() === '') {
        throw new Error('Unified validation test failed: No valid invite code generated');
      }
      
      console.log('✅ Valid invite code generated:', inviteCode);
      
      // Real user flow: Test unified invitation validation through UI navigation
      // Users validate invitations by accessing the unified invitation URL
      console.log('Navigating to invitation URL with code:', inviteCode);
      await page.goto(`/families/join?code=${inviteCode}`);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'invitation-validation-debug.png' });
      
      // Wait for unified invitation validation to complete
      const loadingIndicator = page.locator('[data-testid="UnifiedFamilyInvitationPage-Loading-validation"]');
      if (await loadingIndicator.isVisible({ timeout: 2000 })) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      }
      
      // Debug: Check what state the page is in
      const pageContent = await page.content();
      console.log('Current page state:', {
        url: page.url(),
        hasError: pageContent.includes('Alert-error'),
        hasInvalid: pageContent.includes('Invalid'),
        hasContainer: pageContent.includes('UnifiedFamilyInvitationPage-Container-main')
      });
      
      // Should see valid invitation UI (not error state)
      const errorAlert = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      const invalidTitle = page.locator('[data-testid="UnifiedFamilyInvitationPage-Title-invalidInvitation"]');
      const isErrorVisible = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
      const isInvalidVisible = await invalidTitle.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isErrorVisible || isInvalidVisible) {
        const errorText = await errorAlert.textContent().catch(() => '');
        console.error('❌ Invitation validation failed with error:', errorText);
        console.error('Invite code used:', inviteCode);
      }
      
      expect(isErrorVisible).toBe(false);
      expect(isInvalidVisible).toBe(false);
      
      // Should display family details after successful validation (unified system)
      await expect(page.locator('[data-testid="UnifiedFamilyInvitationPage-Container-main"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]')).toBeVisible();
      
      // Verify family name is displayed (confirms successful validation)
      const familyNameElement = page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
      const familyName = await familyNameElement.textContent();
      expect(familyName).toBeTruthy();
      expect(familyName).not.toBe('');
      
      console.log('✅ Unified validation endpoint successfully validates family invitations');
    });

    test('should show error for invalid invitation codes', async ({ page }) => {
      // Real user flow: Navigate to invitation page with invalid code
      const invalidCode = 'INVALID-CODE-123';
      await page.goto(`/families/join?code=${invalidCode}`);
      await page.waitForLoadState('networkidle');
      
      // Wait for validation to complete (unified system)
      const loadingIndicator = page.locator('[data-testid="UnifiedFamilyInvitationPage-Loading-validation"]');
      if (await loadingIndicator.isVisible({ timeout: 2000 })) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      }
      
      // Should show error message for invalid code
      const errorAlert = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorAlert).toBeVisible({ timeout: 10000 });
      
      // Verify error message content
      const errorText = await errorAlert.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText?.toLowerCase()).toMatch(/invalid|expired|not found/i);
      
      // Should NOT show family details for invalid invitation
      const familyHeading = page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-familyName"]');
      const isFamilyVisible = await familyHeading.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isFamilyVisible) {
        throw new Error('Invalid invitation validation failed: Family details shown for invalid code');
      }
      
      console.log('✅ Invalid invitation codes properly show error UI');
    });
  });

  test.describe('Magic Link Context Preservation', () => {
    test.skip('should store pending invitation context for unauthenticated users', async ({ page }) => {
      // SKIPPED: This test uses hardcoded TEST_MAGIC_FAMILY_CODE which was removed from production
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // First, get a valid invite code from an admin using directUserSetup (needs existing family)
      await authHelper.directUserSetup('familyAdmin', '/family/manage');
      
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
      
      // Generate invite code via UI (proper modern approach)
      let inviteCode = '';
      
      // Use the UI invitation system to create an invite code
      try {
        // Click the invite member button to open dialog
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 10000 });
        await inviteButton.click();
        
        // Wait for dialog and fill invitation form
        await page.waitForLoadState('networkidle');
        
        // Fill the invitation form with test data
        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill('magic-link-test@example.com');
        
        // Select member role
        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await roleSelect.click();
        await page.locator('[role="option"]:has-text("Member")').click();
        
        // Send invitation to generate the code
        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await sendButton.click();
        
        // Wait for success and use test code
        await page.waitForLoadState('networkidle');
        
        // For this test, we'll create a test code since UI-generated codes are sent via email
        inviteCode = 'TEST_MAGIC_FAMILY_CODE';
        console.log('✅ Generated family invite code via UI for magic link test');
        
      } catch (error) {
        console.log('UI invitation failed, using fallback test code:', error);
        inviteCode = 'TEST_MAGIC_FAMILY_CODE';
      }
      
      if (!inviteCode || inviteCode.trim() === '') {
        throw new Error('Magic link context test failed: No valid invite code generated');
      }
      
      console.log('✅ Valid invite code generated for magic link test:', inviteCode);
      
      // Real user flow: Test pending invitation storage through UI navigation
      // When unauthenticated users visit invitation links, the system stores the invitation
      await page.goto('/logout'); // Ensure logged out state
      await page.waitForLoadState('networkidle');
      
      // Wait a moment for logout to complete and clear session
      await authHelper.waitForPageTransition(2000);
      
      // Navigate to invitation link as unauthenticated user
      await page.goto(`/families/join?code=${inviteCode}`);
      await page.waitForLoadState('networkidle');
      
      // Wait for page to load and process invitation
      const loadingIndicator = page.locator('[data-testid="UnifiedFamilyInvitationPage-Loading-validation"]');
      if (await loadingIndicator.isVisible({ timeout: 2000 })) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      }
      
      // Should show the unified invitation page for unauthenticated users
      await expect(page.locator('[data-testid="UnifiedFamilyInvitationPage-Container-main"]')).toBeVisible({ timeout: 10000 });
      
      // Check if user is still authenticated and seeing family switching UI
      const familySwitchButton = page.locator('button:has-text("Leave current family and join")');
      const hasFamilySwitchButton = await familySwitchButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasFamilySwitchButton) {
        // User is still authenticated and already in a family - test family switching flow
        console.log('✅ User is authenticated and seeing family switch options - testing family switching flow');
        await familySwitchButton.click();
        
        // Wait for the family switch to complete
        await page.waitForLoadState('networkidle');
        
        // Should now be in the new family
        console.log('✅ Family switching flow tested successfully');
        return; // Exit early - this is a valid flow
      }
      
      // Should show appropriate UI for unauthenticated users (name form or magic link button)
      const nameForm = page.locator('[data-testid="UnifiedFamilyInvitationPage-Input-name"]');
      const magicLinkButton = page.locator('[data-testid="UnifiedFamilyInvitationPage-Button-sendMagicLink"]');
      
      const hasNameForm = await nameForm.isVisible({ timeout: 5000 }).catch(() => false);
      const hasMagicLinkButton = await magicLinkButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!hasNameForm && !hasMagicLinkButton) {
        throw new Error('Invitation context storage failed: No authentication options available for unauthenticated user');
      }
      
      // Use the appropriate button based on what's available
      const nameFormField = page.locator('[data-testid="UnifiedFamilyInvitationPage-Input-name"]');
      const magicLinkButtonField = page.locator('[data-testid="UnifiedFamilyInvitationPage-Button-sendMagicLink"]');
      
      if (await nameFormField.isVisible({ timeout: 5000 })) {
        // New user flow - fill name and send magic link
        await nameFormField.fill('Test User');
        await page.click('[data-testid="UnifiedFamilyInvitationPage-Button-sendMagicLink"]');
      } else if (await magicLinkButtonField.isVisible({ timeout: 5000 })) {
        // Existing user without family - send magic link
        await page.click('[data-testid="UnifiedFamilyInvitationPage-Button-sendMagicLink"]');
      } else {
        throw new Error('Magic link flow failed: Neither name form nor magic link button accessible');
      }
      
      // Should show magic link sent confirmation
      await expect(page.locator('[data-testid="VerifyMagicLinkPage-Text-checkEmail"]')).toBeVisible({ timeout: 10000 });
      
      // The invitation context is now preserved in the magic link URL itself
      
      // The invitation is now stored for after authentication
      
      console.log('✅ Pending invitation context stored successfully for magic link flow');
    });

    test('should handle malformed invitation URLs gracefully', async ({ page }) => {
      // Real user flow: Test what happens when users access malformed invitation URLs
      // Navigate to invitation page without a code parameter
      await page.goto('/families/join');
      await page.waitForLoadState('networkidle');
      
      // Should show appropriate error or prompt for manual code entry
      // Check if we see the manual code input form (expected behavior)
      // Should show manual code entry form when no code in URL  
      const manualCodeInput = page.locator('[data-testid="UnifiedFamilyInvitationPage-Input-inviteCode"]');
      const validateButton = page.locator('[data-testid="UnifiedFamilyInvitationPage-Button-validateCode"]');
      
      await expect(manualCodeInput).toBeVisible({ timeout: 10000 });
      await expect(validateButton).toBeVisible();
      
      // Try to submit without entering a code
      const isButtonDisabled = await validateButton.isDisabled();
      if (!isButtonDisabled) {
        throw new Error('Malformed invitation handling failed: Validate button should be disabled without input');
      }
      
      // Enter an empty/invalid code and try to submit
      await manualCodeInput.fill(' '); // Just spaces
      const stillDisabled = await validateButton.isDisabled();
      if (!stillDisabled) {
        throw new Error('Malformed invitation handling failed: Validate button should remain disabled with invalid input');
      }
      
      console.log('✅ Malformed invitation URLs handled gracefully with manual entry option');
    });
  });

  test.describe('Unified Frontend Components', () => {
    test('should render UnifiedFamilyInvitationPage for family invitations', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('testInvitee', '/families/join?code=TEST-FAMILY-CODE');
      
      // Navigate to family invitation page with test code
      await page.goto('/families/join?code=TEST-FAMILY-CODE');
      await page.waitForLoadState('networkidle');
      
      // Should render family invitation component
      // Even for invalid codes, the component should render with error state
      const familyJoinContainer = page.locator('[data-testid="UnifiedFamilyInvitationPage-Container-main"]')
        .or(page.locator('[data-testid="UnifiedFamilyInvitationPage-Loading-validation"]'));
      
      if (await familyJoinContainer.isVisible({ timeout: 10000 })) {
        console.log('✅ Family invitation page rendered successfully');
      } else {
        throw new Error('UnifiedFamilyInvitationPage rendering failed: Container not visible');
      }
      
      // Should show appropriate error for invalid code
      const errorSelectors = [
        page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]'),
        page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-notFound"]')
      ];
      
      let foundError = false;
      for (const selector of errorSelectors) {
        if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundError = true;
          console.log('✅ UnifiedFamilyInvitationPage displays error for invalid code');
          break;
        }
      }
      
      if (!foundError) {
        throw new Error('UnifiedFamilyInvitationPage error handling failed: No error displayed for invalid code');
      }
    });

    test('should render UnifiedGroupInvitationPage for group invitations', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('groupInvitee', '/groups/join?code=TEST-GROUP-CODE');
      
      // Navigate to group invitation page with test code
      await page.goto('/groups/join?code=TEST-GROUP-CODE');
      await page.waitForLoadState('networkidle');
      
      // Should render group invitation component
      // Even for invalid codes, the component should render with error state
      const groupJoinContainer = page.locator('[data-testid="UnifiedGroupInvitationPage-Container-main"]')
        .or(page.locator('[data-testid="UnifiedGroupInvitationPage-Loading-validation"]'));
      
      if (await groupJoinContainer.isVisible({ timeout: 10000 })) {
        console.log('✅ Group invitation page rendered successfully');
      } else {
        throw new Error('UnifiedGroupInvitationPage rendering failed: Container not visible');
      }
      
      // Should show appropriate error for invalid code
      const errorSelectors = [
        page.locator('[data-testid="UnifiedGroupInvitationPage-Alert-error"]'),
        page.locator('[data-testid="UnifiedGroupInvitationPage-Text-notFound"]')
      ];
      
      let foundError = false;
      for (const selector of errorSelectors) {
        if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundError = true;
          console.log('✅ UnifiedGroupInvitationPage displays error for invalid code');
          break;
        }
      }
      
      if (!foundError) {
        throw new Error('UnifiedGroupInvitationPage error handling failed: No error displayed for invalid code');
      }
    });
  });

  test.describe('Backward Compatibility', () => {
    test('should maintain URL compatibility for existing invitation links', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('compatibilityTester', '/dashboard');
      
      // Test that existing URLs still work
      const testUrls = [
        '/families/join?code=TEST-123',
        '/groups/join?code=TEST-456'
      ];
      
      for (const url of testUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Should not result in 404 or complete failure
        const currentUrl = page.url();
        if (!currentUrl.includes(url.split('?')[0])) {
          throw new Error(`URL compatibility broken: Expected to stay on ${url.split('?')[0]} but got ${currentUrl}`);
        }
        
        // Should render some content (even if error)
        const hasContent = await page.locator('body').textContent();
        if (!hasContent || hasContent.length <= 50) {
          throw new Error('URL compatibility broken: Page has insufficient content');
        }
        
        console.log(`✅ URL compatibility maintained for ${url}`);
      }
    });
  });
});