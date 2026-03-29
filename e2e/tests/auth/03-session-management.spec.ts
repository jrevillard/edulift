import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Logout Journey', () => {
  test.beforeAll(async () => {
    const authHelper = new UniversalAuthHelper(null as any); // For setup only

    authHelper.defineUser('logoutUser', 'logout-user', 'Logout User');

    authHelper.defineFamily('logoutFamily', 'Logout Test Family', 'logoutUser');

    await authHelper.createUsersInDatabase();

    await authHelper.createMultipleEntitiesInSequence([
      () => authHelper.createFamilyInDatabase('logoutFamily'),
    ]);
  });

  test.setTimeout(120000);

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
      await authHelper.performLogoutWithSync();
      console.log('✅ Logout button clicked successfully with session sync');
    });

    await test.step('Verify redirect to login', async () => {
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page.locator('[data-testid="LoginPage-Heading-welcome"]')).toBeVisible();
      console.log('✅ Successfully redirected to login after logout');
    });

    await test.step('Verify session cleared', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await page.waitForURL(/\/login/);
      console.log('✅ Session properly cleared');
    });
  });

  test('logout clears session across all tabs', async ({ page, context: _context }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);

    await test.step('Authenticate and open multiple tabs', async () => {
      await authHelper.directUserSetup('logoutUser', '/dashboard');

      const secondTab = await _context.newPage();
      const secondAuthHelper = UniversalAuthHelper.forCurrentFile(secondTab);
      await secondAuthHelper.directUserSetup('logoutUser', '/dashboard');

      expect(page.url()).toContain('/dashboard');
      expect(secondTab.url()).toContain('/dashboard');
      console.log('✅ Both tabs authenticated and have dashboard access');

      (page as any).secondTab = secondTab;
    });

    await test.step('Logout from first tab', async () => {
      await authHelper.performLogoutWithSync();
      console.log('✅ Logout performed from first tab with session sync');
    });

    await test.step('Verify second tab session cleared', async () => {
      const secondTab = (page as any).secondTab || _context.pages()[1];

      expect(secondTab).toBeTruthy();
      expect(secondTab.isClosed()).toBeFalsy();

      const secondTabAuth = UniversalAuthHelper.forCurrentFile(secondTab);

      await secondTabAuth.waitForSessionSync('unauthenticated');

      await secondTab.reload();
      await secondTab.waitForLoadState('networkidle');

      await secondTab.waitForURL(/\/login/, { timeout: 10000 });
      expect(secondTab.url()).toContain('/login');
      console.log('✅ Second tab session cleared and redirected to login');

      await secondTab.close();
    });
  });
});
