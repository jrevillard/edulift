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
      () => authHelper.createFamilyInDatabase('compatibilityFamily'),
    ], 1000);
    
    // Add a longer wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 5);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution
  test.describe('Unified Validation Endpoint', () => {
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
        page.locator('[data-testid="UnifiedFamilyInvitationPage-Text-notFound"]'),
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
        page.locator('[data-testid="UnifiedGroupInvitationPage-Text-notFound"]'),
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
        '/groups/join?code=TEST-456',
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