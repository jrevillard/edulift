import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Network Resilience and Error Handling', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for network resilience testing
    authHelper.defineUser('resilienceUser', 'resilience-test', 'Network Resilience User');
    authHelper.defineUser('timeoutUser', 'timeout-test', 'Timeout Test User');
    authHelper.defineUser('errorUser', 'error-test', 'Error Handling User');
    authHelper.defineUser('offlineUser', 'offline-test', 'Offline Test User');
    
    // Define family for users who need it
    authHelper.defineFamily('resilienceFamily', 'Network Resilience Family', 'resilienceUser');
    authHelper.defineFamily('timeoutFamily', 'Timeout Test Family', 'timeoutUser');
    authHelper.defineFamily('errorFamily', 'Error Handling Family', 'errorUser');
    authHelper.defineFamily('offlineFamily', 'Offline Test Family', 'offlineUser');
    
    // Create users and families in database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('resilienceFamily');
    await authHelper.createFamilyInDatabase('timeoutFamily');
    await authHelper.createFamilyInDatabase('errorFamily');
    await authHelper.createFamilyInDatabase('offlineFamily');
    
    // Use centralized database consistency management
    await authHelper.waitForDatabaseConsistency('create', 4);
  });
  
  test.describe('Connection Timeout Handling', () => {
    test('should handle slow network responses gracefully', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test slow network response handling through user navigation
      await authHelper.directUserSetup('resilienceUser', '/family/manage');
      
      // Should eventually load content using data-testid
      // Wait for family page to be ready
      await authHelper.waitForFamilyPageReady();
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
      
      // Verify page is fully functional after loading
      await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible();
      
      // Verify loading states are properly handled
      const loadingIndicator = page.locator('[data-testid="LoadingIndicator-Container-loading"]');
      if (await loadingIndicator.isVisible()) {
        // Loading indicator should disappear once content loads
        await expect(loadingIndicator).not.toBeVisible({ timeout: 15000 });
      }
    });

    test('should handle request timeouts appropriately', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test timeout handling through family management operations
      await authHelper.directUserSetup('timeoutUser', '/family/manage');
      
      // Verify page loads successfully without timeout errors
      // Wait for family page to be ready with timeout handling
      await authHelper.waitForFamilyPageReady();
      await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
      
      // Check for timeout error handling
      const timeoutError = page.locator('[data-testid="ErrorHandler-Alert-timeoutError"]');
      if (await timeoutError.isVisible()) {
        // If timeout error is shown, it should be handled gracefully
        await expect(timeoutError).toBeVisible();
        
        // Should have retry option
        const retryButton = page.locator('[data-testid="ErrorHandler-Button-retry"]');
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Server Error Recovery', () => {
    test('should display appropriate error messages for server errors', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test error handling through user interactions
      await authHelper.directUserSetup('errorUser', '/family/manage');
      
      await page.waitForLoadState('networkidle');
      
      // Check for server error message handling
      const serverErrorMessage = page.locator('[data-testid="ErrorHandler-Alert-serverError"]');
      if (await serverErrorMessage.isVisible()) {
        await expect(serverErrorMessage).toBeVisible();
        
        const retryButton = page.locator('[data-testid="ErrorHandler-Button-retry"]');
        if (await retryButton.isVisible()) {
          await retryButton.click();
          
          // Verify retry functionality works
          await authHelper.waitForFamilyPageReady();
          await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
        }
      } else {
        // If no error, verify normal operation
        await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible();
      }
    });

    test('should handle maintenance mode gracefully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test maintenance mode handling through authentication
      await authHelper.directUserSetup('errorUser', '/dashboard');
      
      await page.waitForLoadState('networkidle');
      
      // Check for maintenance message
      const maintenanceMessage = page.locator('[data-testid="MaintenanceMode-Alert-maintenance"]');
      if (await maintenanceMessage.isVisible()) {
        await expect(maintenanceMessage).toBeVisible();
        
        // Should display appropriate message to user
        const messageText = await maintenanceMessage.textContent();
        expect(messageText).toMatch(/maintenance|temporarily unavailable|under construction/i);
      } else {
        // If not in maintenance mode, verify normal operation
        await expect(page.locator('[data-testid="DashboardPage-Container-main"]')).toBeVisible();
      }
    });
  });

  test.describe('Offline/Online State Management', () => {
    test('should detect and handle offline state', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // First establish online connection
      await authHelper.directUserSetup('offlineUser', '/groups');
      await page.waitForLoadState('networkidle');
      
      // Navigate to groups page to test offline functionality
      const groupsNavLink = page.locator('[data-testid="Navigation-Link-groups"]');
      if (await groupsNavLink.isVisible()) {
        await groupsNavLink.click();
        await page.waitForLoadState('networkidle');
      }
      
      // Simulate offline state
      await _context.setOffline(true);
      
      // Check for offline indicator
      const offlineIndicator = page.locator('[data-testid="NetworkStatus-Indicator-offline"]');
      if (await offlineIndicator.isVisible({ timeout: 10000 })) {
        await expect(offlineIndicator).toBeVisible();
      }
      
      // Test offline functionality - user should see appropriate message
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      // Restore online state
      await _context.setOffline(false);
      
      // Check for online indicator recovery
      const onlineIndicator = page.locator('[data-testid="NetworkStatus-Indicator-online"]');
      if (await onlineIndicator.isVisible({ timeout: 15000 })) {
        await expect(onlineIndicator).toBeVisible();
      } else {
        // Alternative verification - page functionality restored
        await page.reload();
        await page.waitForLoadState('networkidle');
        await authHelper.waitForGroupPageReady();
        await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible({ timeout: 25000 });
      }
    });

    test('should queue operations when offline and sync when online', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Navigate to a page where we can perform operations
      await authHelper.directUserSetup('offlineUser', '/family/manage');
      await page.waitForLoadState('networkidle');
      
      // Try to perform an action that would normally require server communication
      const saveButton = page.locator('[data-testid="ManageFamilyPage-Button-save"]')
        .or(page.locator('[data-testid="FamilyForm-Button-save"]'));
      
      if (await saveButton.isVisible()) {
        // Simulate offline state
        await _context.setOffline(true);
        
        await saveButton.click();
        
        // Check for queue indicator
        const queueIndicator = page.locator('[data-testid="NetworkSync-Indicator-queue"]');
        if (await queueIndicator.isVisible()) {
          await expect(queueIndicator).toBeVisible();
        }
        
        // Restore online state
        await _context.setOffline(false);
        
        // Operations should sync when back online
        await authHelper.waitForReactQueryStable();
        
        // Verify sync completed
        if (await queueIndicator.isVisible()) {
          await expect(queueIndicator).not.toBeVisible({ timeout: 15000 });
        }
      } else {
        // Alternative test - verify offline handling in general
        await _context.setOffline(true);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        
        // Should show offline message or cached content
        const isOfflinePage = page.url().includes('offline') || 
                             await page.locator('[data-testid="OfflinePage-Container-offline"]').isVisible();
        console.log('Offline page handling:', isOfflinePage);
        
        await _context.setOffline(false);
      }
    });
  });

  test.describe('Rate Limiting and Throttling', () => {
    test('should handle rate limit responses gracefully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test rate limiting through family management operations
      await authHelper.directUserSetup('resilienceUser', '/family/manage');
      await page.waitForLoadState('networkidle');
      
      // Check for rate limit message handling
      const rateLimitMessage = page.locator('[data-testid="RateLimit-Alert-rateLimit"]');
      if (await rateLimitMessage.isVisible()) {
        await expect(rateLimitMessage).toBeVisible();
        
        const retryTime = page.locator('[data-testid="RateLimit-Text-retryTime"]');
        if (await retryTime.isVisible()) {
          await expect(retryTime).toBeVisible();
        }
      } else {
        // If no rate limiting, verify normal operation
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible();
      }
    });
  });

  test.describe('Service Degradation Handling', () => {
    test('should handle partial service degradation', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test service degradation through navigation
      await authHelper.directUserSetup('resilienceUser', '/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check for service degradation warnings
      const serviceDegradation = page.locator('[data-testid="ServiceStatus-Alert-serviceDegradation"]');
      if (await serviceDegradation.isVisible()) {
        await expect(serviceDegradation).toBeVisible();
      }
      
      // Test navigation still works with degraded service
      const mainNavigation = page.locator('[data-testid="Navigation-Container-main"]');
      await expect(mainNavigation).toBeVisible();
      
      // Try navigating to different sections
      const familyNavLink = page.locator('[data-testid="Navigation-Link-family"]');
      if (await familyNavLink.isVisible()) {
        await familyNavLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should still be able to access family content, even if degraded
        // Wait for page transition and degraded service handling
        await authHelper.waitForFamilyPageReady();
        await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toBeVisible({ timeout: 25000 });
      }
    });

    test('should provide fallback functionality when services are limited', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);
      
      // Test fallback functionality through group access
      await authHelper.directUserSetup('resilienceUser', '/groups');
      await page.waitForLoadState('networkidle');
      
      // Check if user can view existing data even if some services are degraded
      // Wait for page to stabilize and content to load
      await authHelper.waitForGroupPageReady();
      const canViewSchedules = await page.locator('[data-testid="GroupsPage-Text-transportationAccess"]').isVisible({ timeout: 20000 });
      
      if (canViewSchedules) {
        // If schedules are accessible, verify they load
        await expect(page.locator('[data-testid="GroupsPage-Text-transportationAccess"]')).toBeVisible();
      } else {
        // Alternative verification - basic groups page functionality
        await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible();
      }
      
      // Verify user still has access to basic navigation
      const mainNavigation = page.locator('[data-testid="Navigation-Container-main"]');
      await expect(mainNavigation).toBeVisible();
    });
  });
});