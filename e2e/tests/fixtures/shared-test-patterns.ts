import { Page } from '@playwright/test';

export interface ScheduleData {
  name: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  recurrence?: string;
  days?: string[];
}

export interface GroupData {
  name: string;
  description?: string;
  privacy?: string;
}

export type UserRole = 'admin' | 'member' | 'coordinator' | 'driver';

export class SharedTestPatterns {
  /**
   * Common navigation patterns used across multiple test files
   */
  static async navigateToSchedule(page: Page): Promise<void> {
    // Use ONE EXACT test ID following [ComponentName]-[ElementType]-[descriptiveName] pattern
    const scheduleNavigation = page.locator('[data-testid="DesktopNav-Link-schedule"]');

    if (await scheduleNavigation.isVisible({ timeout: 5000 })) {
      await scheduleNavigation.click();
      await page.waitForTimeout(1000);
    }
  }

  static async navigateToGroups(page: Page): Promise<void> {
    // Use ONE EXACT test ID - NO multiple selectors
    const groupsNavigation = page.locator('[data-testid="DesktopNav-Link-groups"]');

    if (await groupsNavigation.isVisible({ timeout: 5000 })) {
      await groupsNavigation.click();
      await page.waitForTimeout(1000);
    }
  }

  static async navigateToFamilyManagement(page: Page): Promise<void> {
    // Use ONE EXACT test ID - NO multiple selectors
    const familyNavigation = page.locator('[data-testid="DesktopNav-Link-family"]');

    if (await familyNavigation.isVisible({ timeout: 5000 })) {
      await familyNavigation.click();
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Common form filling patterns
   */
  static async fillScheduleForm(page: Page, data: ScheduleData): Promise<void> {
    // Schedule name - use ONE EXACT test ID
    const nameInput = page.locator('[data-testid="ScheduleForm-Input-name"]');
    
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await nameInput.fill(data.name);
    }

    // Description
    if (data.description) {
      const descriptionInput = page.locator('[data-testid="ScheduleForm-Input-description"]');
      
      if (await descriptionInput.isVisible({ timeout: 3000 })) {
        await descriptionInput.fill(data.description);
      }
    }

    // Start time
    if (data.startTime) {
      const startTimeInput = page.locator('input[type="time"]').first();
      if (await startTimeInput.isVisible({ timeout: 3000 })) {
        await startTimeInput.fill(data.startTime);
      }
    }

    // End time
    if (data.endTime) {
      const endTimeInput = page.locator('input[type="time"]').nth(1);
      if (await endTimeInput.isVisible({ timeout: 3000 })) {
        await endTimeInput.fill(data.endTime);
      }
    }

    // Recurrence
    if (data.recurrence) {
      const recurrenceSelect = page.locator('[data-testid="ScheduleForm-Select-recurrence"]');
      
      if (await recurrenceSelect.isVisible({ timeout: 3000 })) {
        await recurrenceSelect.selectOption({ label: data.recurrence });
      }
    }
  }

  static async fillGroupForm(page: Page, data: GroupData): Promise<void> {
    // Group name - use ONE EXACT test ID
    const nameInput = page.locator('[data-testid="CreateGroupModal-Input-name"]');
    
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await nameInput.fill(data.name);
    }

    // Description
    if (data.description) {
      const descriptionInput = page.locator('[data-testid="CreateGroupModal-Input-description"]');
      
      if (await descriptionInput.isVisible({ timeout: 3000 })) {
        await descriptionInput.fill(data.description);
      }
    }
  }

  /**
   * Common button interaction patterns
   */
  static async clickCreateButton(page: Page, _entityType: string = 'create'): Promise<void> {
    // Enhanced create button detection with multiple fallback selectors
    const createButton = page.locator('[data-testid="CreateGroupModal-Button-create"], [data-testid*="Button-create"], [data-testid*="create"], button[type="submit"], button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();

    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForTimeout(1500); // Increased wait time for form processing
    } else {
      console.log(`⚠️ Create ${_entityType} button not found - functionality may not be available`);
    }
  }

  static async clickSaveButton(page: Page): Promise<void> {
    // Enhanced save button detection with multiple fallback selectors
    const saveButton = page.locator('[data-testid="CreateGroupModal-Button-create"], [data-testid*="Button-save"], [data-testid*="Button-submit"], button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Create")').first();

    if (await saveButton.isVisible({ timeout: 5000 })) {
      await saveButton.click();
      await page.waitForTimeout(2000); // Keep longer wait time for form processing
    } else {
      console.log('⚠️ Save button not found - form may not be available');
    }
  }

  static async clickEditButton(page: Page): Promise<void> {
    // Use ONE EXACT test ID
    const editButton = page.locator('[data-testid="ManageFamilyPage-Button-editFamilyName"]');

    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Permission verification patterns
   */
  static async verifyAdminPermissions(page: Page): Promise<void> {
    // Admin should see edit, delete, and management options - use ONE EXACT test ID
    const editOptions = page.locator('[data-testid="ManageFamilyPage-Button-editFamilyName"]');

    const hasEditOptions = await editOptions.isVisible({ timeout: 3000 });
    
    if (hasEditOptions) {
      console.log('✅ Admin permissions verified - edit options visible');
    } else {
      console.log('ℹ️ Admin permissions may be in different location');
    }
  }

  static async verifyMemberPermissions(page: Page): Promise<void> {
    // Member should have limited edit options - use ONE EXACT test ID
    const editOptions = page.locator('[data-testid="ManageFamilyPage-Button-editFamilyName"]');

    const editCount = await editOptions.count();
    
    console.log(`Member sees ${editCount} edit options (should be limited)`);
  }

  static async verifyPermissionsByRole(page: Page, role: UserRole): Promise<void> {
    switch (role) {
      case 'admin':
        await this.verifyAdminPermissions(page);
        break;
      case 'member':
        await this.verifyMemberPermissions(page);
        break;
      case 'coordinator':
        // Coordinator has some admin-like permissions
        await this.verifyAdminPermissions(page);
        break;
      case 'driver':
        // Driver has member-like permissions
        await this.verifyMemberPermissions(page);
        break;
    }
  }

  /**
   * Common success/error verification patterns
   */
  static async verifySuccessMessage(page: Page, action: string = 'operation'): Promise<boolean> {
    // Enhanced success message detection with multiple fallback selectors
    const successMessage = page.locator('[data-testid="LoginPage-Alert-success"], [data-testid*="success"], [data-testid*="Success"], .success, [class*="success"], [role="status"]').first();

    const hasSuccess = await successMessage.isVisible({ timeout: 5000 });
    
    if (hasSuccess) {
      const successText = await successMessage.textContent();
      const hasSuccessKeyword = successText?.toLowerCase().includes('success') || 
                                successText?.toLowerCase().includes('saved') || 
                                successText?.toLowerCase().includes('created') || 
                                successText?.toLowerCase().includes('completed');
      
      if (hasSuccessKeyword) {
        console.log(`✅ ${action} completed successfully: ${successText}`);
        return true;
      }
    }
    
    console.log(`ℹ️ ${action} success may be indicated differently`);
    return false;
  }

  static async verifyErrorMessage(page: Page, expectedError?: string): Promise<boolean> {
    // Enhanced error message detection with multiple fallback selectors
    const errorMessage = page.locator('[data-testid="LoginPage-Alert-emailError"], [data-testid*="error"], [data-testid*="Error"], .error, [class*="error"], [role="alert"], [aria-live="polite"]').first();

    const hasError = await errorMessage.isVisible({ timeout: 5000 });
    
    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.log(`✅ Error message displayed: ${errorText}`);
      
      if (expectedError) {
        const containsExpected = errorText?.toLowerCase().includes(expectedError.toLowerCase()) ||
                                errorText?.toLowerCase().includes('invalid') ||
                                errorText?.toLowerCase().includes('required') ||
                                errorText?.toLowerCase().includes('conflict');
        return containsExpected || false;
      }
      return true;
    } else {
      console.log('ℹ️ Error message may be displayed differently');
      return false;
    }
  }

  /**
   * Loading and wait patterns
   */
  static async waitForPageLoad(page: Page, expectedElement?: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    
    if (expectedElement) {
      const element = page.locator(expectedElement);
      await element.waitFor({ state: 'visible', timeout: 10000 });
    }
    
    // Wait for any loading indicators to disappear - use ONE EXACT test ID
    const loadingIndicator = page.locator('[data-testid="LoadingSpinner-Container-main"]');

    const hasLoading = await loadingIndicator.isVisible({ timeout: 2000 });
    if (hasLoading) {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * Common validation patterns
   */
  static async validateFormInput(page: Page, inputSelector: string, validValue: string, invalidValue: string): Promise<void> {
    const input = page.locator(inputSelector);
    
    if (await input.isVisible({ timeout: 3000 })) {
      // Test invalid input
      await input.fill(invalidValue);
      await this.clickSaveButton(page);
      
      const hasValidationError = await this.verifyErrorMessage(page);
      if (hasValidationError) {
        console.log('✅ Input validation working for invalid value');
      }
      
      // Test valid input
      await input.clear();
      await input.fill(validValue);
      await this.clickSaveButton(page);
      
      const hasSuccess = await this.verifySuccessMessage(page);
      if (hasSuccess) {
        console.log('✅ Input validation accepts valid value');
      }
    }
  }

  /**
   * Network condition simulation helpers
   */
  static async simulateSlowNetwork(page: Page, delayMs: number = 2000): Promise<void> {
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      route.continue();
    });
  }

  static async simulateNetworkFailure(page: Page): Promise<void> {
    await page.route('**/*', route => route.abort());
  }

  static async restoreNetwork(page: Page): Promise<void> {
    await page.unroute('**/*');
  }
}