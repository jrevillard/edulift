// EduLift E2E - Onboarding Flow Helper
// Provides reusable helper functions for onboarding E2E tests
// Encapsulates the complete onboarding flow with family creation

import { Page, expect } from '@playwright/test';

/// Helper functions for onboarding E2E tests
export class OnboardingFlowHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ============================================================
  // SECTION 1: Onboarding Detection
  // ============================================================

  /// Check if user is currently on onboarding page
  async isOnOnboardingPage(): Promise<boolean> {
    const currentUrl = this.page.url();
    return currentUrl.includes('/onboarding');
  }

  /// Wait for onboarding page to be ready
  async waitForOnboardingPage(timeout = 5000): Promise<void> {
    const welcomeHeading = this.page.locator('h1:has-text("Welcome to EduLift!")');
    await expect(welcomeHeading).toBeVisible({ timeout });
  }

  // ============================================================
  // SECTION 2: Family Creation Flow
  // ============================================================

  /// Complete onboarding by creating a new family
  ///
  /// Prerequisites: User must be authenticated and on onboarding page
  ///
  /// [familyName] - Name for the new family (optional, will generate if not provided)
  ///
  /// Returns: The family name that was created
  async completeOnboardingWithFamily(familyName?: string): Promise<string> {
    console.log('🏠 Starting onboarding flow...');

    // Ensure we're on onboarding page
    const isOnOnboarding = await this.isOnOnboardingPage();
    if (!isOnOnboarding) {
      console.log('ℹ️ User not on onboarding page, skipping onboarding');
      return '';
    }

    await this.waitForOnboardingPage();
    console.log('✅ Onboarding page loaded');

    // Step 1: Click "Create a New Family" button using data-testid
    const createFamilyChoiceButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]');
    await expect(createFamilyChoiceButton).toBeVisible({ timeout: 5000 });
    await createFamilyChoiceButton.click();
    console.log('✅ Clicked "Create a New Family" button');

    // Wait for the form transition
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);

    // Step 2: Generate family name if not provided
    const finalFamilyName = familyName || this.generateUniqueFamilyName();

    // Step 3: Fill family name input using data-testid
    const familyInput = this.page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]');
    await expect(familyInput).toBeVisible({ timeout: 5000 });
    await familyInput.fill(finalFamilyName);
    console.log(`✅ Family name filled: ${finalFamilyName}`);

    // Step 4: Submit family creation using data-testid
    const submitButton = this.page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamily"]');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();
    console.log('✅ Family creation submitted');

    // Step 5: Wait for redirect to family/dashboard
    await this.page.waitForURL(
      url => url.href.includes('/family') || url.href.includes('/dashboard'),
      { timeout: 15000 },
    );

    console.log('✅ Onboarding completed successfully');
    return finalFamilyName;
  }

  /// Complete onboarding if user is on onboarding page
  /// This is a convenience method that checks and completes if needed
  async completeOnboardingIfNeeded(familyName?: string): Promise<string> {
    if (await this.isOnOnboardingPage()) {
      return await this.completeOnboardingWithFamily(familyName);
    }
    return '';
  }

  // ============================================================
  // SECTION 3: Utility Methods
  // ============================================================

  /// Generate a unique family name for testing
  private generateUniqueFamilyName(): string {
    const timestamp = Date.now();
    const uuid = Math.random().toString(36).substring(2, 8);
    return `Family_${timestamp}_${uuid}`;
  }

  /// Get the current onboarding step/title
  async getOnboardingTitle(): Promise<string> {
    const heading = this.page.locator('h1');
    return await heading.textContent() || '';
  }
}
