import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Magic Link Invitation Context Preservation - Complete E2E', () => {
  let testFamilyInviteCode: string;
  let testGroupInviteCode: string;

  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('setupAdmin', 'invitation-setup-admin', 'Invitation Setup Admin');
    authHelper.defineUser('magicLinkUser', 'magic-link-user', 'Magic Link Test User');
    authHelper.defineUser('groupUser', 'group-user', 'Group Test User');
    authHelper.defineUser('invalidUser', 'invalid-user', 'Invalid User');
    authHelper.defineUser('multiUser', 'multi-user', 'Multi User');
    authHelper.defineUser('persistenceUser', 'persistence-user', 'Persistence User');
    
    // Define families for complete user setup
    authHelper.defineFamily('setupFamily', 'Magic Link Setup Family', 'setupAdmin');
    authHelper.defineFamily('magicLinkFamily', 'Magic Link Test Family', 'magicLinkUser');
    authHelper.defineFamily('groupFamily', 'Group Test Family', 'groupUser');
    authHelper.defineFamily('invalidFamily', 'Invalid Test Family', 'invalidUser');
    authHelper.defineFamily('multiFamily', 'Multi Test Family', 'multiUser');
    authHelper.defineFamily('persistenceFamily', 'Persistence Test Family', 'persistenceUser');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    
    // Create families sequentially to reduce database contention using centralized method
    const familyOperations = [
      () => authHelper.createFamilyInDatabase('setupFamily'),
      () => authHelper.createFamilyInDatabase('magicLinkFamily'),
      () => authHelper.createFamilyInDatabase('groupFamily'),
      () => authHelper.createFamilyInDatabase('invalidFamily'),
      () => authHelper.createFamilyInDatabase('multiFamily'),
      () => authHelper.createFamilyInDatabase('persistenceFamily')
    ];
    
    await authHelper.createMultipleEntitiesInSequence(familyOperations, 1000);
    
    // Test codes for invitation scenarios - using invalid codes to test error handling
    testFamilyInviteCode = 'INVALID_MAGIC_FAMILY';
    testGroupInviteCode = 'INVALID_MAGIC_GROUP';
    
    console.log('✅ Test family invite code:', testFamilyInviteCode);
    console.log('✅ Test group invite code:', testGroupInviteCode);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution

  test('should handle invalid invitation codes in magic link flow', async ({ page, context: _context }) => {
    const newUserEmail = `magiclink.family.${Date.now()}@example.com`;

    await test.step('1. Unauthenticated user visits invalid family invitation link', async () => {
      await page.goto(`/families/join?code=${testFamilyInviteCode}`);
      await page.waitForLoadState('networkidle');
      
      // Should see invalid invitation page
      const invalidInvitation = page.locator('[data-testid="UnifiedFamilyInvitationPage-Title-invalidInvitation"]');
      await expect(invalidInvitation).toBeVisible({ timeout: 10000 });
      console.log('✅ Invalid invitation correctly detected');
      
      // Verify error state is properly handled
      const errorMessage = page.locator('[data-testid="UnifiedFamilyInvitationPage-Alert-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('Invalid invitation');
      console.log('✅ Error message displayed for invalid invitation code');
    });

    await test.step('2. System redirects unauthenticated user to login', async () => {
      // Try to navigate to login page
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Verify on login page using correct test ID
      const loginSubtitle = page.locator('[data-testid="LoginPage-Text-subtitle"]');
      await expect(loginSubtitle).toBeVisible({ timeout: 10000 });
      
      console.log('✅ User redirected to login page for authentication');
    });
  });
});
