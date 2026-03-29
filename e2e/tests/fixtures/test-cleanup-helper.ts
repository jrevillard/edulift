// EduLift E2E - Test Cleanup Helper
// Provides centralized cleanup operations for test isolation

import { Page } from '@playwright/test';
import { E2EEmailHelper } from './e2e-email-helper';

/// Helper functions for test cleanup and isolation
export class TestCleanupHelper {
  private emailHelper: E2EEmailHelper;

  constructor() {
    this.emailHelper = new E2EEmailHelper();
  }

  // ============================================================
  // SECTION 1: Complete Test Cleanup
  // ============================================================

  /// Perform complete cleanup before or after a test
  /// This ensures perfect test isolation
  async performCompleteCleanup(page: Page): Promise<void> {
    console.log('🧹 Performing complete test cleanup...');

    await this.clearBrowserStorage(page);
    await this.deleteAllEmails();

    console.log('✅ Test cleanup completed');
  }

  // ============================================================
  // SECTION 2: Browser Storage Cleanup
  // ============================================================

  /// Clear all browser storage (localStorage, sessionStorage, cookies)
  /// This ensures no authentication state persists between tests
  async clearBrowserStorage(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear all cookies
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name  }=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    });
    console.log('🗑️ Browser storage cleared');
  }

  // ============================================================
  // SECTION 3: Email Cleanup
  // ============================================================

  /// Delete all emails from MailPit
  /// This prevents email contamination between tests
  async deleteAllEmails(): Promise<void> {
    await this.emailHelper.deleteAllEmails();
  }

  // ============================================================
  // SECTION 4: Selective Cleanup
  // ============================================================

  /// Quick cleanup for tests that need minimal isolation
  /// Only clears authentication-related storage
  async clearAuthenticationState(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Clear auth tokens from localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');

      // Clear sessionStorage (often used for auth state)
      sessionStorage.clear();
    });
    console.log('🔐 Authentication state cleared');
  }

  /// Cleanup for returning user tests
  /// Clears emails but preserves some browser state for efficiency
  async cleanupForReturningUserTest(page: Page): Promise<void> {
    await this.clearBrowserStorage(page);
    await this.deleteAllEmails();
    console.log('🔄 Cleanup completed for returning user test');
  }

  // ============================================================
  // SECTION 5: Utility Methods
  // ============================================================

  /// Get current storage size (for debugging cleanup issues)
  async getStorageSize(page: Page): Promise<{ localStorage: number; sessionStorage: number }> {
    const sizes = await page.evaluate(() => ({
      localStorage: JSON.stringify(localStorage).length,
      sessionStorage: JSON.stringify(sessionStorage).length,
    }));
    return sizes;
  }

  /// Log current storage state (for debugging)
  async logStorageState(page: Page): Promise<void> {
    const storage = await page.evaluate(() => ({
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      cookies: document.cookie,
    }));
    console.log('📊 Current storage state:', storage);
  }
}
