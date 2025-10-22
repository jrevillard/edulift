/**
 * Enhanced Timing Helper - Replaces Static Timeouts with Condition-Based Waits
 * 
 * This module provides event-driven, condition-based timing mechanisms that eliminate
 * the race conditions and flaky behavior caused by static timeouts in E2E tests.
 */

import { Page, Locator } from '@playwright/test';

// Global fetch declaration for Node.js environment
declare const fetch: any;

export interface TimingConfig {
  defaultTimeout: number;
  retryInterval: number;
  maxRetries: number;
  exponentialBackoff: boolean;
}

export class EnhancedTimingHelper {
  private page: Page;
  private config: TimingConfig;

  constructor(page: Page, config: Partial<TimingConfig> = {}) {
    this.page = page;
    this.config = {
      defaultTimeout: 15000,
      retryInterval: 500,
      maxRetries: 30,
      exponentialBackoff: true,
      ...config
    };
  }

  /**
   * Replace: await page.waitForTimeout(1500) + await page.waitForTimeout(2000)
   * With: await timingHelper.waitForAuthenticationReady()
   */
  async waitForAuthenticationReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      // Check for authentication tokens
      const authToken = localStorage.getItem('authToken');
      const authStorage = localStorage.getItem('auth-storage');
      
      if (!authToken || !authStorage) {
        return false;
      }

      // Verify auth storage is valid JSON and has user data
      try {
        const auth = JSON.parse(authStorage);
        return auth.state?.user && auth.state?.isAuthenticated === true;
      } catch {
        return false;
      }
    }, { timeout: this.config.defaultTimeout });

    // Wait for React authentication context to be ready
    await this.page.waitForFunction(() => {
      // Allow authentication and onboarding pages to load properly
      if (window.location.pathname === '/login' || 
          window.location.pathname.includes('/auth') ||
          window.location.pathname.includes('/onboarding')) {
        return document.readyState === 'complete';
      }
      
      // For other pages, ensure they're ready and not auth pages
      return window.location.pathname !== '/login' && 
             !window.location.pathname.includes('/auth') &&
             document.readyState === 'complete';
    }, { timeout: this.config.defaultTimeout });
  }

  /**
   * Replace: URL stability polling with 500ms intervals
   * With: Event-driven navigation completion detection
   */
  async waitForNavigationStable(): Promise<void> {
    // Wait for initial navigation to complete
    await this.page.waitForLoadState('networkidle');
    
    // Wait for authentication state to be consistent
    await this.waitForAuthenticationReady();
    
    // Wait for React router to settle
    await this.page.waitForFunction(() => {
      // Check if we're not in a redirect loop
      const url = window.location.href;
      const hasRedirectIndicators = url.includes('redirecting') || 
                                  url.includes('loading') ||
                                  document.title.includes('Loading');
      
      return !hasRedirectIndicators && document.readyState === 'complete';
    }, { timeout: 10000 });
  }

  /**
   * Replace: Promise.race() with inadequate error handling
   * With: Robust concurrent condition waiting
   */
  async waitForAnyCondition<T>(
    conditions: Array<() => Promise<T>>,
    options: { timeout?: number; requireSuccess?: boolean } = {}
  ): Promise<T> {
    const timeout = options.timeout || this.config.defaultTimeout;
    const requireSuccess = options.requireSuccess ?? true;
    
    const results = await Promise.allSettled(
      conditions.map(condition => 
        Promise.race([
          condition(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Condition timeout')), timeout)
          )
        ])
      )
    );

    // Find first successful result
    for (const result of results) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }

    if (requireSuccess) {
      const errors = results
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason?.message || 'Unknown error');
      
      throw new Error(`All conditions failed: ${errors.join(', ')}`);
    }

    throw new Error('No conditions were met within timeout');
  }

  /**
   * Replace: Database operation without transaction awareness
   * With: Transaction-aware database verification
   */
  async waitForDatabaseTransaction(
    verificationFn: () => Promise<boolean>,
    operation: string
  ): Promise<void> {
    let retryCount = 0;
    const maxRetries = 10;
    
    while (retryCount < maxRetries) {
      try {
        const isReady = await verificationFn();
        if (isReady) {
          return;
        }
      } catch (error) {
        console.log(`Database verification attempt ${retryCount + 1} failed for ${operation}:`, error.message);
      }

      retryCount++;
      
      // Exponential backoff with jitter
      const baseDelay = this.config.exponentialBackoff ? 
        Math.min(1000 * Math.pow(2, retryCount), 5000) : 1000;
      const jitter = Math.random() * 200;
      
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }

    throw new Error(`Database transaction verification failed for ${operation} after ${maxRetries} attempts`);
  }

  /**
   * Replace: Session sync polling with hardcoded delays
   * With: Event-driven session state monitoring
   */
  async waitForSessionStateChange(
    expectedState: 'authenticated' | 'unauthenticated'
  ): Promise<void> {
    // First, trigger any pending storage events to complete
    await this.page.evaluate(() => {
      return new Promise<void>(resolve => {
        let eventCount = 0;
        const maxEvents = 5;
        
        const storageHandler = () => {
          eventCount++;
          if (eventCount >= maxEvents) {
            window.removeEventListener('storage', storageHandler);
            setTimeout(resolve, 100); // Brief settle time
          }
        };
        
        window.addEventListener('storage', storageHandler);
        
        // Also resolve if no events occur within 500ms
        setTimeout(() => {
          window.removeEventListener('storage', storageHandler);
          resolve();
        }, 500);
      });
    });

    // Now verify the expected state
    await this.page.waitForFunction((expected) => {
      const authToken = localStorage.getItem('authToken');
      const authStorage = localStorage.getItem('auth-storage');
      
      const isAuthenticated = !!(authToken && authStorage);
      
      if (expected === 'authenticated') {
        // For authenticated state, also verify we're not on login/auth pages
        const isOnAuthPage = window.location.pathname.includes('/login') || 
                           window.location.pathname.includes('/auth');
        return isAuthenticated && !isOnAuthPage;
      } else {
        // For unauthenticated state, verify tokens are cleared
        return !isAuthenticated;
      }
    }, expectedState, { timeout: this.config.defaultTimeout });
  }

  /**
   * Replace: Family creation with arbitrary delays
   * With: API-backed family verification
   */
  async waitForFamilyCreation(userId: string): Promise<void> {
    await this.waitForDatabaseTransaction(async () => {
      // Use the actual API endpoint to verify family exists
      const response = await this.page.evaluate(async () => {
        return await fetch('/api/user/family-status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        return data.familyId !== null && data.familyId !== undefined;
      });
    }, `family creation for user ${userId}`);
  }

  /**
   * Replace: Onboarding completion with Promise.race() issues
   * With: Comprehensive completion verification
   */
  async waitForOnboardingCompletion(): Promise<void> {
    // Wait for any of the completion indicators
    await this.waitForAnyCondition([
      // Success message appears
      async () => {
        await this.page.locator('[data-testid="FamilyOnboardingWizard-Alert-familyCreated"]')
          .waitFor({ timeout: 30000 });
        return 'success-message';
      },
      
      // URL changes away from onboarding
      async () => {
        await this.page.waitForURL(url => !url.toString().includes('/onboarding'), 
          { timeout: 30000 });
        return 'url-change';
      },
      
      // Direct dashboard navigation
      async () => {
        await this.page.waitForURL('/dashboard', { timeout: 30000 });
        return 'dashboard-direct';
      }
    ], { timeout: 45000, requireSuccess: false });

    // Additional verification: ensure user actually has family access
    await this.page.waitForFunction(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const auth = JSON.parse(authStorage);
          return auth.state?.user?.familyId !== undefined;
        } catch {
          return false;
        }
      }
      return false;
    }, { timeout: 10000 });
  }

  /**
   * Enhanced retry mechanism with exponential backoff and jitter
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.log(`${operationName} attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          break; // Don't wait after the last attempt
        }

        // Exponential backoff with jitter
        const baseDelay = this.config.exponentialBackoff ? 
          Math.min(1000 * Math.pow(2, attempt), 8000) : this.config.retryInterval;
        const jitter = Math.random() * 500;
        
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Wait for element to be ready for interaction (visible, enabled, stable)
   */
  async waitForInteractable(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    await locator.waitFor({ state: 'attached' });
    
    // Wait for element to be enabled and stable
    await this.page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      
      const isEnabled = !element.hasAttribute('disabled') && 
                       !element.getAttribute('aria-disabled');
      const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;
      
      return isEnabled && isVisible;
    }, await locator.getAttribute('data-testid') ? 
      `[data-testid="${await locator.getAttribute('data-testid')}"]` : 
      await locator.innerHTML());
  }
}

// Export utility function for easy integration
export function createTimingHelper(page: Page, config?: Partial<TimingConfig>): EnhancedTimingHelper {
  return new EnhancedTimingHelper(page, config);
}