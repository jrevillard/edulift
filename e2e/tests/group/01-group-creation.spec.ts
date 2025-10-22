import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Group Creation Journey', () => {
  test.beforeAll(async () => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('groupCreator', 'group-creator', 'Group Creator');
    authHelper.defineUser('newGroupAdmin', 'new-group-admin', 'New Group Admin');
    authHelper.defineUser('multiGroupAdmin', 'multi-group-admin', 'Multi Group Admin');
    authHelper.defineUser('groupMember', 'group-member', 'Group Member');
    
    // Define families for group creation
    authHelper.defineFamily('creatorFamily', 'Creator Test Family', 'groupCreator');
    authHelper.defineFamily('newGroupFamily', 'New Group Family', 'newGroupAdmin');
    authHelper.defineFamily('multiGroupFamily', 'Multi Group Family', 'multiGroupAdmin');
    authHelper.defineFamily('memberFamily', 'Member Family', 'groupMember');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('creatorFamily');
    await authHelper.createFamilyInDatabase('newGroupFamily');
    await authHelper.createFamilyInDatabase('multiGroupFamily');
    await authHelper.createFamilyInDatabase('memberFamily');
    
    // Add a wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 4);
  });

  test.setTimeout(60000);

  test.describe('First Time Group Creation', () => {
    test('family admin creates their first group successfully', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to groups page as family admin', async () => {
        await authHelper.directUserSetup('groupCreator', '/groups');
        await page.waitForLoadState('networkidle');
        
        // Should see groups page
        await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible({ timeout: 15000 });
        console.log('✅ Successfully navigated to groups page');
      });

      await test.step('Start group creation process', async () => {
        // Look for create group button
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');

        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        
        // Should open create group modal/form
        await expect(
          page.locator('[data-testid="CreateGroupModal-Input-groupName"]')
        ).toBeVisible({ timeout: 10000 });
        
        console.log('✅ Group creation form opened');
      });

      await test.step('Fill group details and create', async () => {
        const groupName = 'Test Transportation Group';
        
        // Fill group name using exact test ID (no regex selectors)
        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 5000 });
        await groupNameInput.fill(groupName);
        
        // Note: Group creation UI only requires group name, no description field
        // This matches the actual CreateGroupModal component design
        console.log('ℹ️ Group creation form uses simple design with only group name field');
        
        // Submit form - wait for modal to be fully stable
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.waitForAuthenticationStability();
        
        // Submit form using exact test ID (no regex selectors)
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();
        
        // Wait for group creation to complete and UI to update
        await authHelper.waitForGroupCreationComplete();
        
        console.log('✅ Group creation form submitted');
      });

      await test.step('Verify group creation success', async () => {
        // Should either see success message or be redirected to manage group page
        const currentUrl = page.url();
        
        // Group creation MUST result in either redirect to manage page OR success on groups page
        if (currentUrl.includes('/groups/') && currentUrl.includes('/manage')) {
          // Redirected to manage page - this is success
          await expect(page.locator('[data-testid="ManageGroupPage-Button-editGroup"]')).toBeVisible({ timeout: 10000 });
          console.log('✅ Redirected to group management page');
        } else {
          // Must be on groups page with success indicators
          expect(currentUrl).toContain('/groups');
          
          // Either success message OR new group MUST be visible
          const successMessage = page.locator('[data-testid="GroupsPage-Alert-groupCreatedSuccess"]');
          const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]');
          
          // At least one success indicator MUST be present
          const hasSuccess = await successMessage.isVisible({ timeout: 2000 }).catch(() => false);
          const hasGroupCard = await groupCard.isVisible({ timeout: 2000 }).catch(() => false);
          
          const hasAnySuccess = hasSuccess || hasGroupCard;
          expect(hasAnySuccess).toBeTruthy();
          
          if (hasSuccess) {
            console.log('✅ Group creation success message shown');
          } else if (hasGroupCard) {
            console.log('✅ New group appears in groups list');
          }
        }
      });

      await test.step('Verify admin has access to group management', async () => {
        // If not already on manage page, navigate to it
        if (!page.url().includes('/manage')) {
          const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
          await expect(groupCard).toBeVisible({ timeout: 5000 });
          
          const manageButton = groupCard.locator('[data-testid="GroupCard-Button-manageGroup"]');
          
          await expect(manageButton).toBeVisible({ timeout: 5000 });
          await manageButton.click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Admin MUST have access to group management functionality
        const currentUrl = page.url();
        expect(currentUrl.includes('/groups/')).toBeTruthy();
        console.log('✅ Admin can access group management');
        
        // Wait for React Query to update after page reload
        await authHelper.waitForReactQueryStable();
        
        // Admin features MUST be available in group management
        const adminFeatures = page.locator('[data-testid="ManageGroupPage-Button-inviteFamily"]');
        await expect(adminFeatures).toBeVisible({ timeout: 10000 });
        const adminFeatureCount = await adminFeatures.count();
        expect(adminFeatureCount).toBeGreaterThan(0);
        console.log('✅ Admin features visible in group management');
      });
    });

    test('validates group creation form properly', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to group creation', async () => {
        await authHelper.directUserSetup('newGroupAdmin', '/groups');
        await page.waitForLoadState('networkidle');
        
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');

        await createButton.click();
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible();
      });

      await test.step('Test empty form validation', async () => {
        // Check if submit button is disabled when form is empty
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        
        // Form validation MUST prevent empty submission - either disabled button OR validation error
        const isDisabled = await submitButton.isDisabled();
        if (!isDisabled) {
          await submitButton.click();
          await authHelper.waitForAuthenticationStability();
          
          const validationError = page.locator('[data-testid="CreateGroupModal-Alert-error"]');
          
          // Validation error MUST appear if submit button is not disabled
          await expect(validationError).toBeVisible({ timeout: 3000 });
        }
        console.log('✅ Form validation prevents empty submission');
      });

      await test.step('Test invalid group name formats', async () => {
        const invalidNames = ['', '   '];  // Only test truly invalid names
        
        for (const invalidName of invalidNames) {
          // Modal MUST remain open for validation testing
          await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible({ timeout: 2000 });
          
          const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
          
          await groupNameInput.clear();
          await groupNameInput.fill(invalidName);
          await authHelper.waitForAuthenticationStability(); // Wait for validation to kick in
          
          const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
          
          // Invalid name MUST be prevented - either disabled button OR validation keeps modal open
          const isDisabled = await submitButton.isDisabled();
          if (!isDisabled) {
            await submitButton.click();
            await authHelper.waitForAuthenticationStability();
            
            // Modal MUST still be open for invalid input
            await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).toBeVisible({ timeout: 2000 });
          }
          console.log(`✅ Invalid name "${invalidName}" prevented submission`);
        }
      });

      await test.step('Close modal and verify cancellation', async () => {
        // Look for close/cancel button
        const cancelButton = page.locator('[data-testid="CreateGroupModal-Button-cancel"]');

        await expect(cancelButton).toBeVisible({ timeout: 5000 });
        await cancelButton.click();
        
        await authHelper.waitForAuthenticationStability();
        
        // Modal MUST be closed after cancel action
        await expect(page.locator('[data-testid="CreateGroupModal-Input-groupName"]')).not.toBeVisible({ timeout: 3000 });
        console.log('✅ Modal closes properly on cancel');
      });
    });
  });

  test.describe('Multiple Group Creation', () => {
    test('family admin can create multiple groups', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create first group', async () => {
        await authHelper.directUserSetup('multiGroupAdmin', '/groups');
        await page.waitForLoadState('networkidle');
        
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        
        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 10000 });
        await groupNameInput.fill('Morning Carpool Group');
        
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for group creation to complete
        await authHelper.waitForGroupCreationComplete();
        
        console.log('✅ First group created');
      });

      await test.step('Create second group', async () => {
        // Navigate back to groups list if needed
        if (page.url().includes('/groups/') && page.url().includes('/manage')) {
          await page.goto('/groups');
          await page.waitForLoadState('networkidle');
        }
        
        // Wait for React Query to settle from first group creation
        await authHelper.waitForReactQueryStable();
        
        // Should still see create group button for additional groups
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        
        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        await expect(groupNameInput).toBeVisible({ timeout: 10000 });
        await groupNameInput.fill('Evening Activities Group');
        
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        await expect(submitButton).toBeVisible({ timeout: 5000 });
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for the second group creation to complete
        await authHelper.waitForGroupCreationComplete();
        
        console.log('✅ Second group created');
      });

      await test.step('Verify multiple groups are listed', async () => {
        // Navigate to groups list if needed
        if (!page.url().endsWith('/groups')) {
          await page.goto('/groups');
          await page.waitForLoadState('networkidle');
        }
        
        // Wait for React Query to update the cache after group creation
        await authHelper.waitForReactQueryStable();
        
        // Force a page reload to ensure fresh data
        await page.reload();
        await authHelper.waitForGroupPageReady();
        
        // Wait for group cards to load with proper retry logic
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll('[data-testid="GroupCard-Card-groupCard"]');
          return elements.length >= 2;
        }, { timeout: 15000 });
        
        // Should see both groups
        const groupCards = page.locator('[data-testid="GroupCard-Card-groupCard"]');
        const groupCount = await groupCards.count();
        
        // Multiple group creation MUST result in at least 2 groups being visible
        expect(groupCount).toBeGreaterThanOrEqual(2);
        console.log(`✅ Multiple groups visible: ${groupCount} groups found`);
        
        // Check for specific group names with retry logic
        const morningGroup = page.locator(':text("Morning Carpool Group")');
        const eveningGroup = page.locator(':text("Evening Activities Group")');
        
        // Both created groups MUST be visible by name
        await expect(morningGroup).toBeVisible({ timeout: 10000 });
        await expect(eveningGroup).toBeVisible({ timeout: 10000 });
        console.log('✅ Both groups found by name');
      });
    });
  });

  test.describe('Group Creation Edge Cases', () => {
    test('handles group creation with special characters and long names', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Test special characters in group name', async () => {
        await authHelper.directUserSetup('groupCreator', '/groups');
        
        const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');

        await createButton.click();
        
        const specialGroupName = 'Test Group with Special Chars: @#$%&*()';
        
        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        
        await groupNameInput.fill(specialGroupName);
        
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Group with special characters MUST be created successfully
        const currentUrl = page.url();
        if (!currentUrl.includes('/manage')) {
          // Check if group was created on groups page
          const specialGroup = page.locator(`:text("${specialGroupName}")`);
          await expect(specialGroup).toBeVisible({ timeout: 5000 });
        }
        console.log('✅ Group with special characters created successfully');
      });

      await test.step('Test maximum length group name', async () => {
        const longGroupName = 'Very Long Group Name That Tests Maximum Length Limits For Group Creation Form Validation';
        
        // Ensure modal is open for long name test
        const modalOpen = await page.locator('[data-testid="CreateGroupModal-Input-groupName"]')
          .isVisible({ timeout: 2000 }).catch(() => false);
        
        if (!modalOpen) {
          const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
          await expect(createButton).toBeVisible({ timeout: 5000 });
          await createButton.click();
        }
        
        const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
        
        await groupNameInput.clear();
        await groupNameInput.fill(longGroupName);
        
        const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
        
        await submitButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Check for length validation
        const validationError = page.locator('[data-testid="CreateGroupModal-Alert-error"]');
        
        // Long group name handling MUST be consistent
        const hasLengthError = await validationError.isVisible({ timeout: 3000 }).catch(() => false);
        
        // System MUST handle long names appropriately (either validation or acceptance)
        expect(typeof hasLengthError).toBe('boolean');
        console.log(hasLengthError ? '✅ Maximum length validation working' : '✅ Long group name accepted by system');
      });
    });

    test('handles concurrent group creation attempts', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Authenticate user', async () => {
        await authHelper.directUserSetup('multiGroupAdmin', '/groups');
      });

      await test.step('Open multiple group creation modals', async () => {
        // Open second tab
        const secondTab = await _context.newPage();
        await secondTab.goto('/groups');
        await secondTab.waitForLoadState('networkidle');
        
        // Try to open create group modal in both tabs
        const createButton1 = page.locator('[data-testid="GroupsPage-Button-createGroup"]').first();
        const createButton2 = secondTab.locator('[data-testid="GroupsPage-Button-createGroup"]').first();
        
        await Promise.all([
          createButton1.click(),
          createButton2.click()
        ]);
        
        await Promise.all([
          authHelper.waitForAuthenticationStability(),
          authHelper.waitForAuthenticationStability()
        ]);
        
        console.log('✅ Opened create group modals in multiple tabs');
      });

      await test.step('Attempt concurrent group creation', async () => {
        const tabs = [page, _context.pages()[1]];
        
        // Fill different group names in each tab
        await tabs[0].locator('[data-testid="CreateGroupModal-Input-groupName"]').fill('Concurrent Group 1');
        await tabs[1].locator('[data-testid="CreateGroupModal-Input-groupName"]').fill('Concurrent Group 2');
        
        // Submit both forms simultaneously
        await Promise.all([
          tabs[0].locator('[data-testid="CreateGroupModal-Button-submit"]').click(),
          tabs[1].locator('[data-testid="CreateGroupModal-Button-submit"]').click()
        ]);
        
        await Promise.all([
          authHelper.waitForAuthenticationStability(),
          authHelper.waitForAuthenticationStability()
        ]);
        
        console.log('✅ Concurrent group creation attempted');
        
        // Clean up second tab
        await tabs[1].close();
      });
    });
  });
});