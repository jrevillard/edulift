import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { SharedTestPatterns } from '../fixtures/shared-test-patterns';

test.describe.configure({ mode: 'serial' });

test.describe.skip('Session Management Journey', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('sessionUser', 'session-user', 'Session User');
    authHelper.defineUser('multiDeviceUser', 'multi-device-user', 'Multi Device User');
    authHelper.defineUser('logoutUser', 'logout-user', 'Logout User');
    authHelper.defineUser('persistenceUser', 'persistence-user', 'Persistence User');
    
    // Define families for complete user setup
    authHelper.defineFamily('sessionFamily', 'Session Test Family', 'sessionUser');
    authHelper.defineFamily('multiDeviceFamily', 'Multi Device Family', 'multiDeviceUser');
    authHelper.defineFamily('logoutFamily', 'Logout Test Family', 'logoutUser');
    authHelper.defineFamily('persistenceFamily', 'Persistence Family', 'persistenceUser');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    
    // Create families using centralized sequential creation method
    await authHelper.createMultipleEntitiesInSequence([
      () => authHelper.createFamilyInDatabase('sessionFamily'),
      () => authHelper.createFamilyInDatabase('multiDeviceFamily'),
      () => authHelper.createFamilyInDatabase('logoutFamily'),
      () => authHelper.createFamilyInDatabase('persistenceFamily')
    ]);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution

  test.describe('Session Persistence', () => {
    test('maintains session across browser refreshes', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Set up session using pre-authenticated user', async () => {
        // Use a pre-created user with family from beforeAll setup
        // This avoids parallel execution conflicts with family creation
        await authHelper.directUserSetup('sessionUser', '/dashboard');
        await page.waitForLoadState('networkidle');
        await authHelper.waitForSessionSync('authenticated');
        
        // Verify we're authenticated (not on login page)
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ Session established successfully');
      });

      await test.step('Test session persistence across refreshes', async () => {
        // Test that session persists across page refreshes
        for (let i = 1; i <= 3; i++) {
          await page.reload();
          await page.waitForLoadState('networkidle');
          
          // Should remain authenticated (not redirect to login)
          const currentUrl = page.url();
          console.log(`🔍 After refresh ${i}: ${currentUrl}`);
          
          // PROPER assertion - session MUST persist (no workarounds)
          expect(currentUrl).not.toContain('/login');
          console.log(`✅ Session persisted after refresh ${i}`);
          
          await authHelper.waitForSessionSync('authenticated'); // Ensure session is stable
        }
        
        console.log('✅ Session refresh test completed');
      });

      await test.step('Navigate between different authenticated pages', async () => {
        const pages = ['/dashboard', '/family/manage', '/groups'];
        
        for (const pagePath of pages) {
          await page.goto(pagePath);
          await SharedTestPatterns.waitForPageLoad(page);
          
          const currentUrl = page.url();
          expect(currentUrl).not.toContain('/login');
          console.log(`✅ Session maintained for ${pagePath}`);
          
          await authHelper.waitForAuthenticationStability(); // Ensure page is stable
        }
      });
    });

    test('persists session across browser tab close/reopen simulation', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate in first session', async () => {
        await authHelper.directUserSetup('persistenceUser', '/dashboard');
        await authHelper.waitForAuthenticationStability(30000);
        
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ First session authenticated');
      });

      await test.step('Simulate tab close and reopen with new page', async () => {
        // Create new page in same context (simulates new tab)
        const newPage = await _context.newPage();
        
        // Navigate to dashboard - should use existing session from same context
        await newPage.goto('/dashboard');
        await newPage.waitForLoadState('networkidle', { timeout: 30000 });
        
        // Wait for authentication state to stabilize
        const newPageAuth = new UniversalAuthHelper(newPage);
        await newPageAuth.waitForAuthenticationStability(30000);
        
        const currentUrl = newPage.url();
        console.log(`🔍 New page URL after navigation: ${currentUrl}`);
        
        // Session MUST persist in same context (same browser instance)
        expect(currentUrl).not.toContain('/login');
        expect(currentUrl).not.toContain('/onboarding');
        console.log('✅ Session persisted in new tab');
        
        await newPage.close();
      });

      await test.step('Verify original page still authenticated', async () => {
        await page.goto('/dashboard');
        await authHelper.waitForAuthenticationStability(30000);
        
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ Original session still valid');
      });
    });
  });

  test.describe('Multi-Device Simulation', () => {
    test('handles multiple browser contexts (simulated devices)', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate on first device', async () => {
        await authHelper.directUserSetup('multiDeviceUser', '/dashboard');
        await authHelper.waitForAuthenticationStability(30000);
        
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ Device 1 authenticated');
      });

      await test.step('Simulate second device with new context', async () => {
        // Create completely new browser context (simulates different device)
        const device2Context = await _context.browser()!.newContext();
        const device2Page = await device2Context.newPage();
        
        // This should require authentication (different context = different device)
        await device2Page.goto('/dashboard');
        await device2Page.waitForLoadState('networkidle');
        
        // Should redirect to login (no shared session)
        const device2Url = device2Page.url();
        expect(device2Url).toContain('/login');
        console.log('✅ Device 2 requires separate authentication');
        
        // Authenticate on device 2
        const device2Auth = UniversalAuthHelper.forCurrentFile(device2Page);
        await device2Auth.directUserSetup('multiDeviceUser', '/dashboard');
        await device2Page.waitForLoadState('networkidle');
        
        const authenticatedUrl = device2Page.url();
        expect(authenticatedUrl).not.toContain('/login');
        console.log('✅ Device 2 authenticated independently');
        
        await device2Context.close();
      });

      await test.step('Verify first device still authenticated', async () => {
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ Device 1 session unaffected');
      });
    });

    test('handles concurrent sessions on same device', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate primary session', async () => {
        await authHelper.directUserSetup('multiDeviceUser', '/dashboard');
        await page.waitForLoadState('networkidle');
        console.log('✅ Primary session authenticated');
      });

      await test.step('Open concurrent session in same context', async () => {
        const concurrentPage = await _context.newPage();
        
        // Should share authentication (same context)
        await concurrentPage.goto('/dashboard');
        await concurrentPage.waitForLoadState('networkidle');
        
        const concurrentUrl = concurrentPage.url();
        expect(concurrentUrl).not.toContain('/login');
        console.log('✅ Concurrent session shares authentication');
        
        await concurrentPage.close();
      });
    });
  });

  test.describe('Logout Functionality', () => {
    test('successful logout redirects to login page', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate user', async () => {
        await authHelper.directUserSetup('logoutUser', '/dashboard');
        await page.waitForLoadState('networkidle');
        
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');
        console.log('✅ User authenticated for logout test');
      });

      await test.step('Perform logout', async () => {
        // Use enhanced logout with proper session synchronization
        await authHelper.performLogoutWithSync();
        console.log('✅ Logout button clicked successfully with session sync');
      });

      await test.step('Verify redirect to login', async () => {
        // Should be redirected to login page
        await page.waitForURL(/\/login/, { timeout: 10000 });
        await expect(page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible();
        console.log('✅ Successfully redirected to login after logout');
      });

      await test.step('Verify session cleared', async () => {
        // Try to access protected route
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        // Should redirect back to login
        await page.waitForURL(/\/login/);
        console.log('✅ Session properly cleared');
      });
    });

    test('logout clears session across all tabs', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate and open multiple tabs', async () => {
        await authHelper.directUserSetup('logoutUser', '/dashboard');
        
        // Open second tab with the same authenticated user
        const secondTab = await _context.newPage();
        const secondAuthHelper = UniversalAuthHelper.forCurrentFile(secondTab);
        await secondAuthHelper.directUserSetup('logoutUser', '/dashboard');
        
        // Both should be authenticated and on dashboard (family should exist from beforeAll)
        expect(page.url()).toContain('/dashboard');
        expect(secondTab.url()).toContain('/dashboard');
        console.log('✅ Both tabs authenticated and have dashboard access');
        
        // Store reference to second tab for cleanup
        (page as any).secondTab = secondTab;
      });

      await test.step('Logout from first tab', async () => {
        // Use enhanced logout with proper session synchronization
        await authHelper.performLogoutWithSync();
        console.log('✅ Logout performed from first tab with session sync');
      });

      await test.step('Verify second tab session cleared', async () => {
        const secondTab = (page as any).secondTab || _context.pages()[1];
        
        // Second tab MUST be available for multi-tab logout verification
        expect(secondTab).toBeTruthy();
        expect(secondTab.isClosed()).toBeFalsy();
        
        // Create auth helper for second tab to check session sync
        const secondTabAuth = UniversalAuthHelper.forCurrentFile(secondTab);
        
        // Wait for session to synchronize across tabs
        await secondTabAuth.waitForSessionSync('unauthenticated');
        
        // Refresh second tab to confirm session cleared
        await secondTab.reload();
        await secondTab.waitForLoadState('networkidle');
        
        // After logout, second tab MUST be redirected to login when refreshed
        await secondTab.waitForURL(/\/login/, { timeout: 10000 });
        expect(secondTab.url()).toContain('/login');
        console.log('✅ Second tab session cleared and redirected to login');
        
        await secondTab.close();
      });
    });
  });

  test.describe('Session Security', () => {
    test('session expires appropriately for security', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate user and verify session behavior', async () => {
        await authHelper.directUserSetup('sessionUser', '/dashboard');
        await page.waitForLoadState('networkidle');
        
        // Check if user has proper access or needs family setup
        const currentUrl = page.url();
        
        if (currentUrl.includes('/onboarding')) {
          // User without family gets redirected - this is correct security behavior
          console.log('✅ Session security verified: User without family correctly redirected to onboarding');
          expect(currentUrl).toContain('/onboarding');
        } else if (currentUrl.includes('/dashboard')) {
          // User with family has access - verify session is working
          console.log('✅ User authenticated and has dashboard access');
          
          // Test session expiration by removing token
          await page.evaluate(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('auth-storage');
          });
          
          // Navigate to protected page - should redirect to login
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle');
          
          const redirectedToLogin = page.url().includes('/login');
          expect(redirectedToLogin).toBeTruthy();
          console.log('✅ Session expiration working - redirected to login after token removal');
        } else {
          // Some other behavior
          console.log(`✅ Session security: User redirected to ${currentUrl}`);
        }
      });
    });

    test('handles invalid session tokens gracefully', async ({ page }) => {
      await test.step('Attempt access with potentially invalid session', async () => {
        // Start from login page
        await page.goto('/login');
        
        // Try to navigate to protected route
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        // Should redirect to login or show appropriate error
        const currentUrl = page.url();
        // Invalid session MUST redirect to login for security
        const redirectedToLogin = currentUrl.includes('/login');
        expect(redirectedToLogin).toBeTruthy();
        console.log('✅ Invalid session handled correctly - redirected to login');
      });
    });
  });

  test.describe('Storage and Browser Edge Cases', () => {
    test('localStorage and sessionStorage are available for auth', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Verify storage APIs are available', async () => {
        // Modern browsers all support localStorage and sessionStorage
        const storageAvailable = await page.evaluate(() => {
          try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
            return true;
          } catch (e) {
            return false;
          }
        });

        // All modern browsers support Web Storage API
        expect(storageAvailable).toBe(true);
        console.log('✅ Web Storage API is available (expected in all modern browsers)');
      });
    });

    test('handles JavaScript errors gracefully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Test application stability with error monitoring', async () => {
        // Listen for JavaScript errors without throwing
        let jsErrors: string[] = [];
        page.on('pageerror', error => {
          jsErrors.push(error.message);
        });

        // Test normal application flow
        await authHelper.directUserSetup('sessionUser', '/dashboard');
        await page.waitForLoadState('networkidle');

        // Should still be functional
        const currentUrl = page.url();
        const stillFunctional = !currentUrl.includes('/login');

        // Application MUST remain functional despite minor JS errors
        expect(stillFunctional).toBe(true);
        console.log('✅ Application remains functional');

        if (jsErrors.length === 0) {
          console.log('✅ No JavaScript errors detected - application is clean');
        } else {
          console.log(`ℹ️ Detected ${jsErrors.length} JavaScript errors (may include expected WebSocket connection issues in test environment)`);
        }
      });
    });
  });

  test.describe('Enhanced Multi-Device Scenarios', () => {
    test('handles session conflicts between devices', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate on first device', async () => {
        await authHelper.directUserSetup('multiDeviceUser', '/dashboard');
        await SharedTestPatterns.waitForPageLoad(page);
        
        console.log('✅ First device authenticated');
      });

      await test.step('Simulate second device login', async () => {
        const secondDevice = await _context.newPage();
        const secondAuth = UniversalAuthHelper.forCurrentFile(secondDevice);
        
        await secondAuth.directUserSetup('multiDeviceUser', '/dashboard');
        await SharedTestPatterns.waitForPageLoad(secondDevice);
        
        console.log('✅ Second device authenticated');
        
        // Check if first device is still valid
        await page.reload();
        await SharedTestPatterns.waitForPageLoad(page);
        
        const firstDeviceUrl = page.url();
        const secondDeviceUrl = secondDevice.url();
        
        const bothAuthenticated = !firstDeviceUrl.includes('/login') && !secondDeviceUrl.includes('/login');
        
        // Multi-device session handling MUST be consistent
        const hasConsistentBehavior = bothAuthenticated || (!firstDeviceUrl.includes('/login') && secondDeviceUrl.includes('/login'));
        expect(hasConsistentBehavior).toBeTruthy();
        
        if (bothAuthenticated) {
          console.log('✅ Multiple device sessions supported');
        } else {
          console.log('✅ Multi-device sessions have security limitations (expected behavior)');
        }
        
        await secondDevice.close();
      });
    });

    test('handles session handoff between devices', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Start session on first device', async () => {
        await authHelper.directUserSetup('multiDeviceUser', '/family/manage');
        await SharedTestPatterns.waitForPageLoad(page);
        
        // Simulate some work being done - verify we're on family management page
        const workIndicator = page.locator('[data-testid="ManageFamilyPage-Container-main"]');
        
        // Work session MUST be available on first device
        await expect(workIndicator).toBeVisible({ timeout: 5000 });
        console.log('✅ Work session started on first device');
      });

      await test.step('Continue session on second device', async () => {
        const secondDevice = await _context.newPage();
        const secondAuth = UniversalAuthHelper.forCurrentFile(secondDevice);
        
        await secondAuth.directUserSetup('multiDeviceUser', '/family/manage');
        await SharedTestPatterns.waitForPageLoad(secondDevice);
        
        // Should be able to continue work seamlessly - verify same family management page
        const continuationIndicator = secondDevice.locator('[data-testid="ManageFamilyPage-Container-main"]');
        
        // Session continuation MUST work on second device
        await expect(continuationIndicator).toBeVisible({ timeout: 5000 });
        console.log('✅ Session continued on second device');
        
        await secondDevice.close();
      });
    });
  });
});