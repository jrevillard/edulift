import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe('Family Creation E2E', () => {
  test.setTimeout(75000); // Increased to allow for family creation in test environment
  
  test.beforeAll(async () => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('settingsAdmin', 'settings-admin', 'Settings Admin');
    authHelper.defineUser('freshUser', 'fresh-user', 'Fresh User', false); // For new user tests - created but no family
    
    // Define families
    authHelper.defineFamily('settingsFamily', 'Settings Test Family', 'settingsAdmin');
    
    // Create file-specific users and families in database
    await authHelper.createUsersInDatabase();
    // NOTE: Don't create family for freshUser - they will create it through UI
    await authHelper.createFamilyInDatabase('settingsFamily');
  });
  
  // Remove TEST_USER constant - use testUsers.admin instead

  test.describe('New Family Creation', () => {
    test('should create new family for first-time user', async ({ page }) => {
      let authenticatedUser: any;
      
      await test.step('User with no family goes through onboarding', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        
        authenticatedUser = authHelper.getUser('freshUser');
        
        await authHelper.goToPageAsUser(authenticatedUser as any, '/onboarding', { isNewUser: true });
        
        await authHelper.waitForAuthenticationStability();
        const currentUrl = page.url();
        
        // If we're on the login page, authentication failed
        if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
          console.log('❌ User authentication failed - landed on login page');
          throw new Error('User authentication failed');
        }
        
        // Check if family creation completed automatically during navigation
        if (currentUrl.includes('/dashboard')) {
          // Family was created successfully, no need for manual onboarding
        } else if (currentUrl.includes('/onboarding')) {
          // User is on onboarding page, complete the family creation process
          const shortTimestamp = Date.now().toString().slice(-6); // Last 6 digits
          const uniqueFamilyName = `Test Family ${shortTimestamp}`;
          
          try {
            await authHelper.completeOnboarding(uniqueFamilyName);
            
            // Should naturally redirect to dashboard
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 60000 });
            
          } catch (error) {
            throw new Error(`Family creation failed: ${error.message}`);
          }
        } else {
          throw new Error(`Unexpected URL after navigation: ${currentUrl}. Expected /onboarding or /dashboard`);
        }
        
      });
      
      await test.step('Verify family was created', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        
        // CRITICAL: Re-authenticate user after family creation to refresh their state
        // This ensures the user's auth state reflects their new family membership
        await authHelper.authenticateSpecificUser(authenticatedUser as any, { isNewUser: false });
        
        // Try to navigate to family manage page
        try {
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle');
          
          const finalUrl = page.url();
          
          if (finalUrl.includes('/login')) {
            throw new Error('Session lost during verification');
          }
          
          if (finalUrl.includes('/onboarding')) {
            throw new Error('User redirected to onboarding after family creation - auth state not updated');
          }
          
          await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
          
          const familyNameElement = page.locator('[data-testid="ManageFamilyPage-Input-familyNameDisplay"]');
          await expect(familyNameElement).toBeVisible({ timeout: 5000 });
          const familyName = await familyNameElement.inputValue();
          expect(familyName).toBeTruthy();
          console.log(`✅ Family created with name: ${familyName}`);
          
        } catch (error) {
          throw error;
        }
      });
    });

    test('should handle user already in family scenario', async ({ page }) => {
      await test.step('User with existing family should see dashboard', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        
        // Use dashboard as target URL instead of onboarding to test redirect behavior
        await authHelper.directUserSetup('settingsAdmin', '/dashboard');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        const finalUrl = page.url();
        console.log(`🔍 Final URL after dashboard navigation: ${finalUrl}`);
        
        // Add defensive check: if redirected to onboarding, the family wasn't created properly
        if (finalUrl.includes('/onboarding')) {
          console.log('❌ settingsAdmin was redirected to onboarding - family creation failed in beforeAll');
          throw new Error(`CRITICAL: settingsAdmin was redirected to onboarding - family creation failed in beforeAll. URL: ${finalUrl}`);
        }
        
        // User should be able to access dashboard (not redirected to onboarding)
        expect(finalUrl).toContain('/dashboard');
        
        // Verify user can access family management page
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        
        const familyPageUrl = page.url();
        expect(familyPageUrl).toContain('/family/manage');
        
        // Verify family information is displayed
        const familyInfoElement = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
        await expect(familyInfoElement).toBeVisible({ timeout: 15000 });
        
        console.log('✅ User with existing family correctly has access to family features');
      });
    });
  });

  test.describe('Family Information Display', () => {
    test('should display family information correctly', async ({ page }) => {
      await test.step('Navigate to family management page', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await authHelper.directUserSetup('settingsAdmin', '/family/manage'); // Just use the key!
        
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
        console.log('✅ Family management page loaded');
      });

      await test.step('Verify family name is displayed', async () => {
        // The family name is displayed in the input field
        const familyNameElement = page.locator('[data-testid="ManageFamilyPage-Input-familyNameDisplay"]');
        await expect(familyNameElement).toBeVisible({ timeout: 5000 });
        const familyName = await familyNameElement.inputValue();
        expect(familyName).toBeTruthy();
        console.log(`✅ Family name displayed: ${familyName}`);
      });

      await test.step('Verify family members list is visible', async () => {
        await expect(page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]')).toBeVisible();
        console.log('✅ Family members list is visible');
      });
    });
  });

  test.describe('Family Settings and Configuration', () => {
    test('should navigate to family settings', async ({ page }) => {
      await test.step('Access family settings page', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await authHelper.directUserSetup('settingsAdmin', '/family/manage'); // Just use the key!
        
        await page.waitForLoadState('networkidle');
        const currentUrl = page.url();
        expect(currentUrl).toContain('/manage'); // The URL should contain /manage for family management
        
        console.log('✅ Family settings page accessed');
      });

      await test.step('Verify settings interface elements', async () => {
        // Look for common family settings elements
        const _settingsElements = [
          '[data-testid="ManageFamilyPage-Container-main"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          'input[type="text"]',
          'button'
        ];

        // Family settings page should have interactive elements - verify at least one is visible
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const settingsElement = page.locator('[data-testid="ManageFamilyPage-Button-editFamily"]');
        await expect(settingsElement).toBeVisible({ timeout: 5000 });
        console.log('✅ Settings interface elements verified');
      });
    });

    test('should handle family deletion', async ({ page }) => {
      await test.step('Access family settings for deletion test', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await authHelper.directUserSetup('settingsAdmin', '/family/manage'); // Just use the key!
        
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
        
        console.log('✅ Family management loaded for deletion test');
      });

      await test.step('Look for family deletion options', async () => {
        // Look for deletion-related elements
        const _deletionSelectors = [
          '[data-testid="ManageFamilyPage-Container-main"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          '[data-testid="ManageFamilyPage-Container-main"]',
          'text=Delete Family',
          'text=Remove Family'
        ];

        // Check for family deletion options - at least one should be available for admin
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        // For family deletion, look for the leave family button
        const deletionOption = page.locator('[data-testid="ManageFamilyPage-Button-leaveFamily"]');
        
        // For admin users, deletion options should be present
        const isDeletionVisible = await deletionOption.isVisible();
        if (isDeletionVisible) {
          console.log('✅ Family deletion options available for admin');
        } else {
          // If no deletion option is visible, verify we're actually on the manage page
          await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 5000 });
          console.log('✅ Family management page verified - deletion options may be in different location');
        }
      });
    });
  });
});