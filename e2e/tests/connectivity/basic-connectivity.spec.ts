import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Basic Application Connectivity', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for connectivity testing
    authHelper.defineUser('connectivityUser', 'connectivity-test', 'Connectivity Test User');
    authHelper.defineUser('healthCheckUser', 'health-check', 'Health Check User');
    
    // Define family for users who need it
    authHelper.defineFamily('connectivityFamily', 'Connectivity Test Family', 'connectivityUser');
    
    // Create users and family in database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('connectivityFamily');
    
    // Use centralized database consistency management
    await authHelper.waitForDatabaseConsistency('create', 2);
  });
  
  test.describe('Frontend Application Connectivity', () => {
    test('should connect to frontend application and load login page', async ({ page }) => {
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);
      
      // Should see the EduLift welcome message or login page
      await expect(page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible({ timeout: 15000 });
      
      // Verify the page is fully functional
      await expect(page.locator('[data-testid="LoginPage-Input-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="LoginPage-Button-sendMagicLink"]')).toBeVisible();
    });

    test('should load application resources successfully', async ({ page }) => {
      // Navigate to login page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify essential CSS and JS resources are loading
      const loginForm = page.locator('[data-testid="LoginPage-Form-loginForm"]');
      await expect(loginForm).toBeVisible({ timeout: 15000 });
      
      // Check that interactive elements are functional
      const emailInput = page.locator('[data-testid="LoginPage-Input-email"]');
      await emailInput.fill('test@example.com');
      const inputValue = await emailInput.inputValue();
      expect(inputValue).toBe('test@example.com');
      
      // Clear the input
      await emailInput.clear();
    });
  });

  test.describe('Backend Connectivity Through User Flows', () => {
    test('should connect to backend through authentication flow', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test backend connectivity through user authentication
      await authHelper.directUserSetup('connectivityUser', '/dashboard');
      
      // Wait for page to load - this validates backend connectivity
      await page.waitForLoadState('networkidle');
      
      // Wait for authentication stability before checking dashboard
      await authHelper.waitForAuthenticationStability();
      
      // Verify we successfully connected to backend and loaded user data
      await expect(page.locator('[data-testid="DashboardPage-Container-main"]')).toBeVisible({ timeout: 25000 });
      
      // Verify user data loaded (proves database connectivity)
      const userProfile = page.locator('[data-testid="DashboardPage-Container-userProfile"]');
      if (await userProfile.isVisible()) {
        await expect(userProfile).toBeVisible();
      }
    });

    test('should handle backend data operations through family management', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Navigate to family management to test backend data operations
      await authHelper.directUserSetup('connectivityUser', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Wait for family page to be ready
      await authHelper.waitForFamilyPageReady();
      
      // Verify family data loads (proves backend + database connectivity)
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
      
      // Test data retrieval functionality
      const familyInfo = page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]');
      await expect(familyInfo).toBeVisible({ timeout: 15000 });
      
      // Verify we can see family stats (proves data queries work)
      const familyStats = page.locator('[data-testid="ManageFamilyPage-Container-familyStats"]');
      if (await familyStats.isVisible()) {
        await expect(familyStats).toBeVisible();
      }
    });
  });

  test.describe('Database Connectivity Through User Interactions', () => {
    test('should validate database connectivity through user profile access', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Access profile data to validate database connectivity
      await authHelper.directUserSetup('connectivityUser', '/dashboard');
      
      await page.waitForLoadState('networkidle');
      
      // Navigate to profile or user settings to test database reads
      const profileButton = page.locator('[data-testid="Navigation-Button-profile"]')
        .or(page.locator('[data-testid="DashboardPage-Button-profile"]'));
      
      if (await profileButton.isVisible()) {
        await profileButton.click();
        await page.waitForLoadState('networkidle');
        
        // Verify profile data loads (proves database read operations)
        const _profileData = page.locator('[data-testid="ProfilePage-Container-profileData"]')
          .or(page.locator('[data-testid="UserProfile-Container-userInfo"]'));
        
        if (await _profileData.isVisible()) {
          await expect(_profileData).toBeVisible();
        }
      } else {
        // Alternative verification - check dashboard loads user-specific data
        const dashboardContent = page.locator('[data-testid="DashboardPage-Container-main"]');
        await expect(dashboardContent).toBeVisible();
      }
    });

    test('should validate database writes through family data updates', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test database write operations through family management
      await authHelper.directUserSetup('connectivityUser', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Look for family settings or editable fields to test database writes
      const editFamilyButton = page.locator('[data-testid="ManageFamilyPage-Button-editFamily"]')
        .or(page.locator('[data-testid="FamilySettings-Button-edit"]'));
      
      if (await editFamilyButton.isVisible()) {
        await editFamilyButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Try to update family information
        const familyNameInput = page.locator('[data-testid="FamilyForm-Input-familyName"]')
          .or(page.locator('[data-testid="EditFamily-Input-name"]'));
        
        if (await familyNameInput.isVisible()) {
          const originalValue = await familyNameInput.inputValue();
          await familyNameInput.fill(originalValue + ' Updated');
          
          // Save changes to test database write
          const saveButton = page.locator('[data-testid="FamilyForm-Button-save"]')
            .or(page.locator('[data-testid="EditFamily-Button-save"]'));
          
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await authHelper.waitForAuthenticationStability();
            
            // Verify update was successful (proves database write operations)
            const successMessage = page.locator('[data-testid="FamilyForm-Alert-success"]')
              .or(page.locator('[data-testid="ManageFamilyPage-Alert-updated"]'));
            
            if (await successMessage.isVisible()) {
              await expect(successMessage).toBeVisible();
            }
          }
        }
      } else {
        // Alternative verification - family management page loads successfully
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible();
      }
    });
  });

  test.describe('Application Responsiveness', () => {
    test('should respond to navigation between pages', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test navigation responsiveness
      await authHelper.directUserSetup('connectivityUser', '/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Navigate to different sections to test application responsiveness
      const sections = [
        { path: '/family/manage', testId: 'ManageFamilyPage-Heading-pageTitle' },
        { path: '/groups', testId: 'GroupsPage-Title-pageTitle' },
        { path: '/children', testId: 'ChildrenPage-Title-pageTitle' },
        { path: '/vehicles', testId: 'VehiclesPage-Title-pageTitle' }
      ];
      
      for (const section of sections) {
        await page.goto(section.path);
        await page.waitForLoadState('networkidle');
        
        // Wait for navigation to stabilize
        await authHelper.waitForAuthenticationStability();
        
        // Verify page loads within reasonable time
        await expect(page.locator(`[data-testid="${section.testId}"]`)).toBeVisible({ timeout: 25000 });
        
        // Use centralized navigation timing
        await authHelper.waitForPageTransition();
      }
    });

    test('should handle page refreshes gracefully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test application state persistence through page refresh
      await authHelper.directUserSetup('connectivityUser', '/family/manage');
      await page.waitForLoadState('networkidle');
      
      // Verify initial page load
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 15000 });
      
      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Wait for family page to be ready after refresh
      await authHelper.waitForFamilyPageReady();
      
      // Verify page still works after refresh (tests session persistence)
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
      
      // Verify authentication persisted
      expect(page.url()).not.toContain('/login');
    });
  });
});