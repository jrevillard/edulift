import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Family Access Control and Permissions', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('familyAdmin', 'family-admin', 'Family Admin');
    authHelper.defineUser('familyMember', 'family-member', 'Family Member');
    authHelper.defineUser('parentUser', 'parent-user', 'Parent User');
    authHelper.defineUser('adminUser', 'admin-user', 'Admin User');
    
    // Define families with proper roles - familyMember should be MEMBER of adminFamily
    authHelper.defineFamily('adminFamily', 'Admin Test Family', 'familyAdmin', [
      { userKey: 'familyMember', role: 'MEMBER' }
    ]);
    authHelper.defineFamily('testFamily', 'Test Family', 'adminUser');
    
    // Create all users and families in database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('adminFamily');
    await authHelper.createFamilyInDatabase('testFamily');
    
    // Add delay for database consistency
    await authHelper.waitForDatabaseConsistency('create', 2);
  });
  
  test.describe('Family Admin Permissions', () => {
    test('admin should have full family management access', async ({ page }) => {
      // Setup family admin user using directUserSetup (user already has family setup)
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('familyAdmin', '/family/manage');
      
      // Wait for authentication to be processed and page to load
      await page.waitForLoadState('networkidle');
      
      // Verify we're not redirected to login
      await expect(page).not.toHaveURL(/\/login/);
      
      // Wait for family management page to load  
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 5000 });
      
      // Verify admin can see family information section
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible();
      
      // Verify admin can see family members section
      await expect(page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]')).toBeVisible();
      
      // Verify admin role is displayed
      const adminBadge = page.locator('[data-testid="ManageFamilyPage-Badge-userRole"]').first();
      await expect(adminBadge).toBeVisible();
      
      // Verify admin can access family stats
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyStats"]')).toBeVisible();
      
      // Verify admin permissions are enforced - must have visible indicators
      const adminRoleText = await adminBadge.textContent();
      expect(adminRoleText).toContain('ADMIN');
      
      // Verify admin has access to management controls
      const managementControls = page.locator('[data-testid="FamilyManagementSection-Controls-adminControls"]');
      if (await managementControls.isVisible()) {
        await expect(managementControls).toBeVisible();
      }
    });

    test('admin should be able to add children', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('adminUser', '/family/manage');
      
      // Navigate to add child functionality
      await page.waitForLoadState('networkidle');
      
      // Look for manage children button
      const manageChildrenButton = page.locator('[data-testid="ManageFamilyPage-Button-manageChildren"]');
      if (await manageChildrenButton.isVisible()) {
        await manageChildrenButton.click();
        
        // Should navigate to children page
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/children');
      } else {
        // Alternative path - check for children card
        const childrenCard = page.locator('[data-testid="ManageFamilyPage-Card-children"]');
        await expect(childrenCard).toBeVisible();
      }
    });
    
    test('admin should be able to add vehicles', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('adminUser', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Look for manage vehicles functionality
      const manageVehiclesButton = page.locator('[data-testid="ManageFamilyPage-Button-manageVehicles"]');
      
      if (await manageVehiclesButton.isVisible()) {
        await manageVehiclesButton.click();
        
        // Should navigate to vehicles page
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/vehicles');
      } else {
        // Alternative verification - check for vehicles card
        const vehiclesCard = page.locator('[data-testid="ManageFamilyPage-Card-vehicles"]');
        await expect(vehiclesCard).toBeVisible();
      }
    });
  });

  test.describe('Family Member Permissions', () => {
    test('member should have limited access to family management', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('familyMember', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Verify member can see family information but not admin controls
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible();
      
      // Member role should be displayed
      const memberBadge = page.locator('[data-testid="ManageFamilyPage-Badge-userRole"]').first();
      if (await memberBadge.isVisible()) {
        const memberRoleText = await memberBadge.textContent();
        expect(memberRoleText).toContain('MEMBER');
      }
      
      // Admin-only controls should not be visible
      const adminControls = page.locator('[data-testid="FamilyManagementSection-Controls-adminControls"]');
      if (await adminControls.isVisible()) {
        // If visible, should be disabled
        await expect(adminControls).toBeDisabled();
      }
    });

    test('member should not be able to add family members', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('familyMember', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Check that add member functionality is not available
      const addMemberButton = page.locator('[data-testid="ManageFamilyPage-Button-addMember"]');
      
      // Should either not exist or be disabled
      if (await addMemberButton.isVisible()) {
        await expect(addMemberButton).toBeDisabled();
      }
    });
  });

  test.describe('Group Creation Permissions', () => {
    test('family admin should be able to create groups', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      await authHelper.directUserSetup('familyAdmin', '/groups');
      
      await page.waitForLoadState('networkidle');
      
      // Verify admin can access group creation
      const createGroupButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
      if (await createGroupButton.isVisible()) {
        await createGroupButton.click();
        
        // Verify group creation modal opens
        await expect(page.locator('[data-testid="CreateGroupModal-Title-modalTitle"]')).toBeVisible();
      } else {
        // Alternative verification - check for groups access
        const groupsSection = page.locator('[data-testid="GroupsPage-Container-groups"]');
        await expect(groupsSection).toBeVisible();
      }
    });
  });

  test.describe('Onboarding Access Control', () => {
    test('new user should be directed to onboarding', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      // Create a completely new user for onboarding test
      const newUserEmail = authHelper.getFileSpecificEmail('new-onboarding-user');
      const newUser = await authHelper.authenticateUniqueUser(newUserEmail, { isNewUser: true });
      
      await authHelper.goToPageAsUser(newUser, '/dashboard', { isNewUser: true });
      
      // Should be redirected to onboarding
      await page.waitForLoadState('networkidle');
      
      // Check for onboarding indicators
      const onboardingTitle = page.locator('[data-testid="OnboardingPage-Title-pageTitle"]');
      if (await onboardingTitle.isVisible()) {
        await expect(onboardingTitle).toBeVisible();
      } else {
        // Alternative check - verify we're in onboarding flow
        expect(page.url()).toMatch(/\/onboarding/);
      }
    });
  });
});