import { Page, expect } from '@playwright/test';
import { AuthHelper } from './auth-helpers';
import { TestUser, TestFamily, TestChild, TestVehicle, TEST_USERS, TEST_FAMILIES, TEST_CHILDREN, TEST_VEHICLES } from './test-data';

export class FamilyTestHelper {
  constructor(private _page: Page, private _authHelper: AuthHelper) {}

  /**
   * Sets up a complete family environment for testing.
   * This ensures the user has a family with children and vehicles,
   * which is now mandatory in the new architecture.
   */
  async setupFamilyEnvironment(
    userType: keyof typeof TEST_USERS,
    familyType: keyof typeof TEST_FAMILIES = 'SMITH',
    includeChildren: boolean = true,
    includeVehicles: boolean = true
  ): Promise<{
    user: TestUser;
    family: TestFamily;
    children?: TestChild[];
    vehicles?: TestVehicle[];
  }> {
    const user = TEST_USERS[userType];
    const family = TEST_FAMILIES[familyType];
    const children = includeChildren ? [TEST_CHILDREN.EMMA, TEST_CHILDREN.NOAH] : [];
    const vehicles = includeVehicles ? [TEST_VEHICLES.HONDA_CRV] : [];

    // Step 1: Login the user (this will create the user if needed)
    await this.authHelper.login(userType);

    // Wait a bit for authentication to be fully processed
    await this._page.waitForTimeout(1000);

    // Step 2: Check if user already has a family by trying to navigate to dashboard
    await this._page.goto('/dashboard');
    await this._page.waitForURL(/\/(dashboard|onboarding|login)/, { timeout: 15000 });
    
    const currentUrl = this._page.url();
    
    if (currentUrl.includes('/login')) {
      // Authentication failed - user ended up on login page
      throw new Error('Authentication failed - user redirected to login page. Check test authentication setup.');
    } else if (currentUrl.includes('/onboarding')) {
      // User needs onboarding - complete the full onboarding flow
      await this.completeOnboardingFlow(family, children, vehicles);
    } else if (currentUrl.includes('/dashboard')) {
      // User is on dashboard - check if they actually have a family
      const hasFamilyName = await this._page.locator('[data-testid="family-name"]').isVisible();
      
      if (!hasFamilyName) {
        // User is on dashboard but doesn't have family - force them to onboarding
        await this._page.goto('/onboarding');
        await this._page.waitForURL('/onboarding', { timeout: 10000 });
        await this.completeOnboardingFlow(family, children, vehicles);
      } else {
        // User already has a family - verify it's the expected one
        await this.ensureFamilyHasRequiredData(family, children, vehicles);
      }
    } else {
      throw new Error(`Unexpected navigation state: ${currentUrl}`);
    }

    return { user, family, children, vehicles };
  }

  /**
   * Completes the full onboarding flow with family, children, and vehicles
   */
  private async completeOnboardingFlow(
    family: TestFamily,
    children: TestChild[],
    vehicles: TestVehicle[]
  ): Promise<void> {
    // Wait for onboarding page to load
    await expect(this._page.getByRole('heading', { name: 'Create Your Family' })).toBeVisible();

    // Step 1: Create family
    await this._page.fill('[data-testid="family-name-input"]', family.name);
    await this._page.click('[data-testid="create-family-button"]');
    await expect(this._page.locator('[data-testid="family-created"]')).toBeVisible();
    await this._page.click('[data-testid="continue-button"]');

    // Step 2: Add children
    await expect(this._page.getByRole('heading', { name: 'Add Your Children' })).toBeVisible();
    
    for (const child of children) {
      await this._page.fill('[data-testid="child-name-input"]', child.name);
      await this._page.fill('[data-testid="child-age-input"]', child.age.toString());
      await this._page.click('[data-testid="ChildAssignmentModal-Button-addChild"]');
      await expect(this._page.locator(`text=${child.name}`)).toBeVisible();
    }
    
    // Use the correct continue button (not continue-to-vehicles-button)
    await this._page.click('[data-testid="continue-button"]');

    // Step 3: Add vehicles
    await expect(this._page.getByRole('heading', { name: 'Add Your Vehicles' })).toBeVisible();
    
    for (const vehicle of vehicles) {
      await this._page.fill('[data-testid="vehicle-name-input"]', vehicle.name);
      await this._page.fill('[data-testid="vehicle-capacity-input"]', vehicle.capacity.toString());
      await this._page.click('[data-testid="add-vehicle-button"]');
      await expect(this._page.locator(`text=${vehicle.name}`)).toBeVisible();
    }
    
    await this._page.click('[data-testid="complete-onboarding-button"]');

    // Step 4: Verify completion - should be on dashboard
    await this._page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(this._page.locator('[data-testid="family-name"]')).toContainText(family.name);
  }

  /**
   * Ensures an existing family has the required test data
   */
  private async ensureFamilyHasRequiredData(
    _family: TestFamily,
    _children: TestChild[],
    _vehicles: TestVehicle[]
  ): Promise<void> {
    // For now, just verify the family exists on dashboard
    // In the future, we could add logic to create missing children/vehicles
    await expect(this._page.locator('[data-testid="family-name"]')).toBeVisible();
    
    // TODO: Add logic to verify and create missing children/vehicles if needed
    // This would involve navigating to children/vehicles pages and adding them
  }

  /**
   * Quick setup for tests that just need a family but don't care about the details
   */
  async quickFamilySetup(userType: keyof typeof TEST_USERS = 'ADMIN'): Promise<void> {
    await this.setupFamilyEnvironment(userType, 'SMITH', true, true);
  }

  /**
   * Setup for tests that need a family without children or vehicles
   */
  async minimalFamilySetup(userType: keyof typeof TEST_USERS = 'ADMIN'): Promise<void> {
    await this.setupFamilyEnvironment(userType, 'SMITH', false, false);
  }

  /**
   * Navigates to a specific page and ensures the family context is loaded
   */
  async navigateWithFamilyContext(path: string): Promise<void> {
    await this._page.goto(path);
    
    // Wait for family context to load
    await expect(this._page.locator('[data-testid="family-name"]')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verifies that the user has the expected family setup
   */
  async verifyFamilySetup(expectedFamilyName: string): Promise<void> {
    await expect(this._page.locator('[data-testid="family-name"]')).toContainText(expectedFamilyName);
  }
}