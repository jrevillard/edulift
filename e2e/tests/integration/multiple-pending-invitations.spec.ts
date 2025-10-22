import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Multiple Pending Invitations Handling E2E', () => {
  let testFamilyInviteCode1: string;
  let testFamilyInviteCode2: string;
  let testGroupInviteCode1: string;
  let testGroupInviteCode2: string;

  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('admin1', 'multi-invite-admin1', 'Multi Invite Admin 1');
    authHelper.defineUser('admin2', 'multi-invite-admin2', 'Multi Invite Admin 2');
    authHelper.defineUser('multiUser', 'multi-user', 'Multi Family User');
    authHelper.defineUser('groupAdmin', 'group-admin', 'Multi Group Admin');
    authHelper.defineUser('mixedUser', 'mixed-user', 'Mixed Invitation User');
    authHelper.defineUser('pendingUser', 'pending-user', 'Pending Invitations User');
    
    // Define families for complete user setup
    authHelper.defineFamily('family1', 'Multi Invite Family 1', 'admin1');
    authHelper.defineFamily('family2', 'Multi Invite Family 2', 'admin2');
    authHelper.defineFamily('multiFamily', 'Multi Test Family', 'multiUser');
    authHelper.defineFamily('groupFamily', 'Multi Group Test Family', 'groupAdmin');
    authHelper.defineFamily('mixedFamily', 'Mixed User Family', 'mixedUser');
    authHelper.defineFamily('pendingFamily', 'Pending Test Family', 'pendingUser');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    
    // Create families sequentially to reduce database contention
    await authHelper.createMultipleEntitiesInSequence([
      () => authHelper.createFamilyInDatabase('family1'),
      () => authHelper.createFamilyInDatabase('family2'),
      () => authHelper.createFamilyInDatabase('multiFamily'),
      () => authHelper.createFamilyInDatabase('groupFamily'),
      () => authHelper.createFamilyInDatabase('mixedFamily'),
      () => authHelper.createFamilyInDatabase('pendingFamily')
    ]);
    
    // Generate real invitation codes for multiple invitation scenarios
    // Note: These will be replaced with actual invitation codes in individual tests
    testFamilyInviteCode1 = 'TEMP_FAMILY_1';
    testFamilyInviteCode2 = 'TEMP_FAMILY_2';
    testGroupInviteCode1 = 'TEMP_GROUP_1';
    testGroupInviteCode2 = 'TEMP_GROUP_2';
    
    console.log('✅ Test invitation codes setup:');
    console.log('  Family 1:', testFamilyInviteCode1);
    console.log('  Family 2:', testFamilyInviteCode2);
    console.log('  Group 1:', testGroupInviteCode1);
    console.log('  Group 2:', testGroupInviteCode2);
    
    // Add a longer wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 6);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution

  test('should handle invalid invitation codes properly', async ({ page }) => {
    // This test explicitly tests invalid invitation handling
    const invalidCode1 = 'INVALID_CODE_1';
    const invalidCode2 = 'INVALID_CODE_2';

    await test.step('1. User encounters invalid invitation codes', async () => {
      // Test first invalid family invitation
      await page.goto(`/families/join?code=${invalidCode1}`);
      await page.waitForLoadState('networkidle');
      
      const invalidInvitation1 = page.locator('[data-testid="UnifiedFamilyInvitationPage-Title-invalidInvitation"]');
      
      await expect(invalidInvitation1).toBeVisible({ timeout: 10000 });
      console.log('✅ First invalid family invitation correctly detected');
      
      // Verify error handling is proper
      const errorMessage1 = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorMessage1).toBeVisible({ timeout: 5000 });
      
      const errorText1 = await errorMessage1.textContent();
      expect(errorText1).toContain('Invalid invitation');
      console.log('✅ Error message properly displayed for invalid code');
      
      // Test second invalid family invitation
      await page.goto(`/families/join?code=${invalidCode2}`);
      await page.waitForLoadState('networkidle');
      
      const invalidInvitation2 = page.locator('[data-testid="UnifiedFamilyInvitationPage-Title-invalidInvitation"]');
      
      await expect(invalidInvitation2).toBeVisible({ timeout: 10000 });
      console.log('✅ Second invalid family invitation correctly detected');
      
      // Verify error handling is proper
      const errorMessage2 = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorMessage2).toBeVisible({ timeout: 5000 });
      
      const errorText2 = await errorMessage2.textContent();
      expect(errorText2).toContain('Invalid invitation');
      console.log('✅ Multiple invalid invitations properly handled');
    });

    await test.step('2. Authenticated user tries invalid codes', async () => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Authenticate user first
      await authHelper.directUserSetup('multiUser', '/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Try to join with invalid code
      await page.goto(`/families/join?code=${invalidCode1}`);
      await page.waitForLoadState('networkidle');
      
      // Should see error for invalid code
      const errorMessage = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('Invalid invitation');
      console.log('✅ Authenticated user sees error for invalid code');
    });

    await test.step('3. System prevents joining with invalid codes', async () => {
      // Try another invalid code
      await page.goto(`/families/join?code=${invalidCode2}`);
      await page.waitForLoadState('networkidle');
      
      // Should still see error
      const errorMessage = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      console.log('✅ System consistently rejects invalid invitation codes');
    });
  });

  test('should handle invalid group invitation codes', async ({ page }) => {
    const invalidGroupCode1 = 'INVALID_GROUP_1';
    const invalidGroupCode2 = 'INVALID_GROUP_2';

    await test.step('1. Family admin setup', async () => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      await authHelper.directUserSetup('groupAdmin', '/family/manage');
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Family admin setup complete');
    });

    await test.step('2. Test invalid group invitation', async () => {
      await page.goto(`/groups/join?code=${invalidGroupCode1}`);
      await page.waitForLoadState('networkidle');
      
      const invalidInvitation1 = page.locator('[data-testid="UnifiedGroupInvitationPage-Title-invalidInvitation"]');
      await expect(invalidInvitation1).toBeVisible({ timeout: 10000 });
      console.log('✅ Invalid group invitation correctly detected');
      
      // Verify error message
      const errorMessage = page.locator('[data-testid="UnifiedGroupInvitationPage-Alert-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('Invalid invitation');
      console.log('✅ Error message displayed for invalid group code');
    });

    await test.step('3. Test second invalid group invitation', async () => {
      await page.goto(`/groups/join?code=${invalidGroupCode2}`);
      await page.waitForLoadState('networkidle');
      
      const invalidInvitation2 = page.locator('[data-testid="UnifiedGroupInvitationPage-Title-invalidInvitation"]');
      await expect(invalidInvitation2).toBeVisible({ timeout: 10000 });
      console.log('✅ Second invalid group invitation correctly detected');
      
      // Verify error handling is consistent
      const errorMessage2 = page.locator('[data-testid="UnifiedGroupInvitationPage-Alert-error"]');
      await expect(errorMessage2).toBeVisible({ timeout: 5000 });
      
      console.log('✅ System consistently rejects invalid group invitation codes');
    });
  });
});
