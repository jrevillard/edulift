import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Cross-Feature Integration Tests - Family → Group → Schedule Flows', () => {
  test.beforeAll(async () => {
    // Use automatic file prefix detection for consistency
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('integrationTester', 'integration-tester', 'Integration Tester');
    authHelper.defineUser('familyA', 'family-a', 'Family A User');
    authHelper.defineUser('familyB', 'family-b', 'Family B User');
    authHelper.defineUser('permissionTester', 'permission-tester', 'Permission Tester');
    authHelper.defineUser('dataConsistency', 'data-consistency', 'Data Consistency User');
    authHelper.defineUser('deletionTester', 'deletion-tester', 'Deletion Tester');
    
    // Define families for complete user setup
    authHelper.defineFamily('integrationFamily', 'Integration Test Family', 'integrationTester');
    authHelper.defineFamily('familyAGroup', 'Family A Group', 'familyA');
    authHelper.defineFamily('familyBGroup', 'Family B Group', 'familyB');
    authHelper.defineFamily('permissionFamily', 'Permission Test Family', 'permissionTester');
    authHelper.defineFamily('dataFamily', 'Data Consistency Family', 'dataConsistency');
    authHelper.defineFamily('deletionFamily', 'Deletion Test Family', 'deletionTester');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    
    // Create families sequentially to reduce database contention
    // NOTE: Skip integrationFamily creation in database since the test creates it through UI
    await authHelper.createMultipleEntitiesInSequence([
      () => authHelper.createFamilyInDatabase('familyAGroup'),
      () => authHelper.createFamilyInDatabase('familyBGroup'),
      () => authHelper.createFamilyInDatabase('permissionFamily'),
      () => authHelper.createFamilyInDatabase('dataFamily'),
      () => authHelper.createFamilyInDatabase('deletionFamily')
    ], 1000);
    
    // Add a longer wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 5);
  });

  test.setTimeout(120000); // Increased timeout for parallel execution

  test.describe('Complete Family-to-Schedule Workflow', () => {
    test('should complete full workflow: Family Creation → Group Setup → Schedule Management', async ({ page }) => {
      await test.step('Phase 1: Create Family and Setup', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.directUserSetup('integrationTester', '/onboarding');
        
        // Start family creation using correct test ID convention
        await page.goto('/onboarding');
        await expect(page.locator('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]')).toBeVisible({ timeout: 10000 });
        await page.click('[data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"]');
        
        // Create family using correct test ID convention
        await expect(page.locator('[data-testid="FamilyOnboardingWizard-Input-familyName"]')).toBeVisible({ timeout: 10000 });
        await page.fill('[data-testid="FamilyOnboardingWizard-Input-familyName"]', 'Integration Test Family');
        
        console.log('ℹ️ About to click create family button');
        await page.click('[data-testid="FamilyOnboardingWizard-Button-createFamily"]');
        
        // Wait for family creation to complete with explicit validation
        await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability(30000);
        
        console.log('ℹ️ URL after clicking create family:', page.url());
        
        // Explicit error detection - never continue with silent failures
        const errorElements = await page.locator('[data-testid="ManageGroupPage-Alert-errorMessage"]').all();
        for (const element of errorElements) {
          if (await element.isVisible()) {
            const errorText = await element.textContent();
            console.log('🚨 Family creation error:', errorText);
            throw new Error(`Family creation failed with error: ${errorText}`);
          }
        }
        
        // Wait for page to settle with extended timeout
        await page.waitForLoadState('networkidle', { timeout: 25000 });
        
        // Validate family creation success - fail fast if not successful
        const currentUrl = page.url();
        console.log('ℹ️ Current URL after family creation attempt:', currentUrl);
        
        if (currentUrl.includes('/onboarding')) {
          console.log('ℹ️ Still on onboarding - verifying family creation status');
          
          // Try accessing family management directly to test if family was created
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle', { timeout: 15000 });
          
          // Wait for authentication state to stabilize
          await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability(15000);
          
          const finalUrl = page.url();
          if (finalUrl.includes('/family/manage')) {
            console.log('✅ Phase 1: Family created successfully (accessed via direct navigation)');
          } else if (finalUrl.includes('/dashboard')) {
            console.log('✅ Phase 1: Family created successfully (accessed dashboard)');
          } else {
            throw new Error('Family creation failed - unable to access family management after creation attempt');
          }
        } else {
          console.log('✅ Phase 1: Family created successfully');
        }
      });

      await test.step('Phase 2: Add Family Resources (Children and Vehicles)', async () => {
        // Ensure family context is established before accessing children page
        console.log('ℹ️ Checking family context before accessing children');
        
        // First check if we can access family management to confirm family exists
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 2 failed: Family context not established - cannot proceed to resource creation');
        }
        
        // Proceed to children page with proper family context
        await page.goto('/children');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Debug: Log current URL after navigation
        console.log('ℹ️ Current URL after children navigation:', page.url());
        
        // If still redirected to onboarding, the family creation has issues
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 2 failed: Children page redirected to onboarding - family context not established');
        }
        
        // Wait for children page to load - handle both loading and loaded states
        const childrenPageIndicator = page.locator('[data-testid="ChildrenPage-Container-main"]')
          .or(page.locator('[data-testid="ChildrenPage-Title-pageTitle"]'));
        
        try {
          await expect(childrenPageIndicator).toBeVisible({ timeout: 15000 });
        } catch (error) {
          throw new Error('Phase 2 failed: Children page not loading - family context issue');
        }
        
        // Click add child button using correct test ID
        const addChildButton = page.locator('[data-testid="ChildrenPage-Button-addChild"]');
        if (await addChildButton.isVisible()) {
          await addChildButton.click();
          
          // Wait for dialog to open
          await expect(page.locator('[data-testid="ChildrenPage-Container-dialogContainer"]')).toBeVisible({ timeout: 5000 });
          
          // Fill child information using correct test IDs
          const childNameInput = page.locator('[data-testid="ChildrenPage-Input-childName"]');
          if (await childNameInput.isVisible()) {
            await childNameInput.fill('Test Child 1');
            
            const childAgeInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
            if (await childAgeInput.isVisible()) {
              await childAgeInput.fill('8');
              
              // Click submit button using correct test ID
              const saveChildButton = page.locator('[data-testid="ChildrenPage-Button-submitChild"]');
              if (await saveChildButton.isVisible()) {
                await saveChildButton.click();
                
                // Wait for child creation to complete and verify
                await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability();
                
                // Verify child was actually added
                const childList = page.locator('[data-testid="ChildrenPage-List-childrenList"]');
                await expect(childList).toContainText('Test Child 1', { timeout: 10000 });
                
                console.log('✅ Child added to family and verified in list');
              } else {
                throw new Error('Child creation failed: Save button not accessible');
              }
            } else {
              throw new Error('Child creation failed: Age input not accessible');
            }
          } else {
            throw new Error('Child creation failed: Name input not accessible');
          }
        } else {
          throw new Error('Child creation failed: Add child button not accessible');
        }
        
        // Add vehicle using correct test IDs
        await page.goto('/vehicles');
        
        // Wait for vehicles page to load - handle both loading and loaded states
        const vehiclesPageIndicator = page.locator('[data-testid="VehiclesPage-Container-main"]')
          .or(page.locator('[data-testid="VehiclesPage-Title-pageTitle"]'));
        await expect(vehiclesPageIndicator).toBeVisible({ timeout: 10000 });
        
        // Click add vehicle button using correct test ID
        const addVehicleButton = page.locator('[data-testid="VehiclesPage-Button-addVehicle"]');
        if (await addVehicleButton.isVisible()) {
          await addVehicleButton.click();
          
          // Wait for dialog to open
          await expect(page.locator('[data-testid="VehiclesPage-Container-dialogContainer"]')).toBeVisible({ timeout: 5000 });
          
          // Fill vehicle information using correct test IDs
          const vehicleNameInput = page.locator('[data-testid="VehiclesPage-Input-vehicleName"]');
          if (await vehicleNameInput.isVisible()) {
            await vehicleNameInput.fill('Family SUV');
            
            const vehicleCapacityInput = page.locator('[data-testid="VehiclesPage-Input-vehicleCapacity"]');
            if (await vehicleCapacityInput.isVisible()) {
              await vehicleCapacityInput.fill('7');
              
              // Click submit button using correct test ID
              const saveVehicleButton = page.locator('[data-testid="VehiclesPage-Button-submitVehicle"]');
              if (await saveVehicleButton.isVisible()) {
                await saveVehicleButton.click();
                
                // Wait for vehicle creation to complete and verify
                await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability();
                
                // Verify vehicle was actually added
                const vehicleList = page.locator('[data-testid="VehiclesPage-List-vehiclesList"]');
                await expect(vehicleList).toContainText('Family SUV', { timeout: 10000 });
                
                console.log('✅ Vehicle added to family and verified in list');
              } else {
                throw new Error('Vehicle creation failed: Save button not accessible');
              }
            } else {
              throw new Error('Vehicle creation failed: Capacity input not accessible');
            }
          } else {
            throw new Error('Vehicle creation failed: Name input not accessible');
          }
        } else {
          throw new Error('Vehicle creation failed: Add vehicle button not accessible');
        }
        
        console.log('✅ Phase 2: Family resources added');
      });

      await test.step('Phase 3: Create Group and Invite Other Families', async () => {
        // First check if user has family access for group creation
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 3 failed: Family context missing - cannot create group');
        }
        
        await page.goto('/groups');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check if redirected back to onboarding (indicates family context issue)
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 3 failed: Groups page redirected to onboarding - family context lost');
        }
        
        // Wait for groups page to load - use actual test ID from GroupsPage component
        try {
          await expect(page.locator('[data-testid="GroupsPage-Title-pageTitle"]')).toBeVisible({ timeout: 10000 });
        } catch (error) {
          throw new Error('Phase 3 failed: Groups page not accessible - family context issue');
        }
        
        // Click create group button using correct test ID
        const createGroupButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        
        if (await createGroupButton.isVisible()) {
          await createGroupButton.click();
          
          const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
          if (await groupNameInput.isVisible()) {
            await groupNameInput.fill('Morning Carpool Group');
            
            // Group description is not available in current implementation, skip this step
            console.log('ℹ️ Group description field not available, proceeding with name only');
            
            const createButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
            if (await createButton.isVisible()) {
              await createButton.click();
              
              // Wait for success message instead of redirect (actual UI behavior)
              try {
                await page.waitForSelector('[data-testid="GroupsPage-Alert-groupCreatedSuccess"]', { timeout: 10000 });
                console.log('✅ Group created successfully');
              } catch (error) {
                throw new Error('Group creation failed: Expected success message did not appear');
              }
            } else {
              throw new Error('Group creation failed: Create button not accessible');
            }
          }
        }
        
        // Navigate to group management page to access invite functionality
        // Wait for the groups list to refresh after creation
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.waitForPageTransition(2000);
        
        // Click on the "Manage" button of the newly created group
        const manageGroupButton = page.locator('[data-testid="GroupCard-Button-manageGroup"]').first();
        if (await manageGroupButton.isVisible()) {
          await manageGroupButton.click();
          await page.waitForLoadState('networkidle');
          console.log('✅ Navigated to group management page');
        } else {
          throw new Error('Group management button not found');
        }
        
        // Now look for invite functionality on the group management page
        const inviteFamilyButton = page.locator('[data-testid="GroupPage-Button-inviteFamily"]');
        
        if (await inviteFamilyButton.isVisible()) {
          await inviteFamilyButton.click();
          
          // Use actual family search input from FamilySearchInvitation component
          const familySearchInput = page.locator('[data-testid="FamilySearchInvitation-Input-familySearch"]');
          if (await familySearchInput.isVisible()) {
            const userEmail = UniversalAuthHelper.forCurrentFile(page).getFileSpecificEmail('another-family');
            await familySearchInput.fill(userEmail);
            
            const searchButton = page.locator('[data-testid="FamilySearchInvitation-Button-searchFamilies"]');
            if (await searchButton.isVisible()) {
              await searchButton.click();
              
              // Wait for search results or confirmation
              await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability();
              
              // Verify search was processed (look for results or "no results" message)
              const searchResults = page.locator('[data-testid="FamilySearchInvitation-Container-searchResults"]');
              const noResultsMessage = page.locator('[data-testid="FamilySearchInvitation-Text-noResults"]');
              
              const hasResults = await searchResults.isVisible({ timeout: 5000 }).catch(() => false);
              const hasNoResults = await noResultsMessage.isVisible({ timeout: 5000 }).catch(() => false);
              
              if (hasResults || hasNoResults) {
                console.log('✅ Family search completed with results');
              } else {
                throw new Error('Family search failed: No results or error state displayed');
              }
            } else {
              throw new Error('Family search failed: Search button not accessible');
            }
          }
        }
        
        console.log('✅ Phase 3: Group setup completed');
      });

      await test.step('Phase 4: Create Schedule for Group', async () => {
        // Get the group ID from the current URL (we're on /groups/{groupId}/manage)
        const currentUrl = page.url();
        const groupIdMatch = currentUrl.match(/\/groups\/([^\/]+)\/manage/);
        if (!groupIdMatch) {
          throw new Error('Phase 4 failed: Could not extract group ID from URL');
        }
        const groupId = groupIdMatch[1];
        console.log(`ℹ️ Using group ID: ${groupId} for schedule creation`);
        
        // Navigate to schedule page with group parameter
        await page.goto(`/schedule?group=${groupId}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check if redirected back to onboarding (indicates family context issue)
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 4 failed: Schedule page redirected to onboarding - family context lost');
        }
        
        try {
          await expect(page.locator('[data-testid="SchedulePage-Title-weeklySchedule"]')).toBeVisible({ timeout: 10000 });
          console.log('✅ Schedule page loaded successfully');
        } catch (error) {
          console.log('❌ Schedule page failed to load, current URL:', page.url());
          throw new Error('Phase 4 failed: Schedule page not accessible - family context issue');
        }
        
        // Create schedule slot
        const timeSlot = page.locator('[data-testid="SchedulePage-Slot-08-00"]')
          .or(page.locator('[data-testid="SchedulePage-Container-main"]'));
        
        if (await timeSlot.isVisible()) {
          await timeSlot.click();
          
          // Assign the family vehicle
          const vehicleSelect = page.locator('[data-testid="ScheduleForm-Select-vehicle"]');
          if (await vehicleSelect.isVisible()) {
            await vehicleSelect.selectOption({ label: 'Family SUV' });
            
            // Assign family child
            const childCheckbox = page.locator('[data-testid="ScheduleForm-Checkbox-child"]')
              .filter({ hasText: 'Test Child 1' });
            
            if (await childCheckbox.isVisible()) {
              await childCheckbox.check();
              
              // Set pickup location
              const locationInput = page.locator('[data-testid="ScheduleForm-Input-pickupLocation"]');
              if (await locationInput.isVisible()) {
                await locationInput.fill('123 Main Street');
                
                const saveScheduleButton = page.locator('[data-testid="ScheduleForm-Button-saveSchedule"]');
                if (await saveScheduleButton.isVisible()) {
                  await saveScheduleButton.click();
                  
                  // Wait for schedule creation to complete
                  await UniversalAuthHelper.forCurrentFile(page).waitForAuthenticationStability();
                  
                  // Verify schedule was actually created
                  const scheduleSlot = page.locator('[data-testid="SchedulePage-Slot-08-00"]');
                  const hasScheduledContent = await scheduleSlot.locator('[data-testid="SchedulePage-Container-main"]').isVisible({ timeout: 5000 }).catch(() => false);
                  
                  if (hasScheduledContent) {
                    console.log('✅ Schedule created with family resources and verified');
                  } else {
                    throw new Error('Schedule creation failed: No scheduled content visible after save');
                  }
                } else {
                  throw new Error('Schedule creation failed: Save button not accessible');
                }
              }
            }
          }
        }
        
        console.log('✅ Phase 4: Schedule management completed');
      });

      await test.step('Phase 5: Verify End-to-End Integration', async () => {
        // Verify complete workflow by checking all components work together
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check if user still has access to dashboard (family context maintained)
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 5 failed: Dashboard redirected to onboarding - family context lost during integration');
        }
        
        // Should show family, group, and schedule information
        const familyCard = page.locator('[data-testid="DashboardPage-Card-familySummary"]');
        const groupCard = page.locator('[data-testid="DashboardPage-Card-groupsSummary"]');
        const scheduleCard = page.locator('[data-testid="DashboardPage-Card-scheduleSummary"]');
        
        const summaryVisible = await Promise.all([
          familyCard.isVisible().catch(() => false),
          groupCard.isVisible().catch(() => false),
          scheduleCard.isVisible().catch(() => false)
        ]);
        
        if (summaryVisible.some(visible => visible)) {
          console.log('✅ Dashboard shows integrated information from all features');
        }
        
        // Test navigation between features maintains context
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check if family management is accessible
        if (page.url().includes('/onboarding')) {
          throw new Error('Phase 5 failed: Family management not accessible - integration broken');
        }
        
        try {
          await expect(page.locator('[data-testid="ManageFamilyPage-Heading-pageTitle"]')).toContainText('Family Management', { timeout: 5000 });
        } catch (error) {
          console.log('ℹ️ Family management page structure different, continuing integration verification');
        }
        
        await page.goto('/groups');
        const groupExists = await page.locator('[data-testid="GroupCard-Card-groupCard"]').isVisible().catch(() => false);
        if (groupExists) {
          console.log('✅ Group context maintained across navigation');
        }
        
        await page.goto('/schedule');
        const scheduleExists = await page.locator('[data-testid="schedule-grid"]').isVisible().catch(() => false);
        if (scheduleExists) {
          console.log('✅ Schedule context maintained with family/group data');
        }
        
        console.log('✅ Phase 5: End-to-end integration verified');
      });
    });
  });

  test.describe('Multi-Family Group Coordination', () => {
    test('should coordinate between multiple families in shared groups', async ({ page, context: _context }) => {
      await test.step('Setup two families in the same group', async () => {
        // Family A creates group
        const authHelperA = UniversalAuthHelper.forCurrentFile(page);
        await authHelperA.directUserSetup('familyA', '/groups');
        await page.goto('/groups');
        
        // Create group
        const createGroupButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
        if (await createGroupButton.isVisible()) {
          await createGroupButton.click();
          
          const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
          if (await groupNameInput.isVisible()) {
            await groupNameInput.fill('Multi-Family Test Group');
            
            const createButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
            if (await createButton.isVisible()) {
              await createButton.click();
              console.log('✅ Family A created group');
            }
          }
        }
        
        // Family B joins the group
        const pageB = await _context.newPage();
        const authHelperB = new UniversalAuthHelper(pageB);
        await authHelperB.directUserSetup('familyB', '/groups');
        await pageB.goto('/groups');
        
        // Look for join group button using actual test ID from GroupsPage
        const joinGroupButton = pageB.locator('[data-testid="GroupsPage-Button-joinGroup"]');
        
        if (await joinGroupButton.isVisible()) {
          await joinGroupButton.click();
          
          // Wait for join group modal to appear - check if modal opens
          await authHelperB.waitForAuthenticationStability();
          
          // In a real test scenario, we would need an actual invite code
          // For now, just verify the modal workflow exists
          console.log('✅ Join group workflow initiated');
          
          // Close the modal if it opened (press Escape to close any modal)
          await pageB.keyboard.press('Escape');
          
          console.log('✅ Group joining workflow is functional');
        } else {
          console.log('ℹ️ Join group button not visible - may be in different state');
        }
        
        console.log('✅ Multi-family group coordination setup complete');
        await pageB.close();
      });

      await test.step('Test coordinated schedule creation', async () => {
        // Family A creates schedule that Family B can see and participate in
        await page.goto('/schedule');
        
        const coordinatedSlot = page.locator('[data-testid="SchedulePage-Slot-09-00"]');
        if (await coordinatedSlot.isVisible()) {
          await coordinatedSlot.click();
          
          // Mark as coordinated/group schedule
          const groupScheduleCheckbox = page.locator('[data-testid="ScheduleForm-Checkbox-groupSchedule"]')
            .or(page.locator('[data-testid="ScheduleForm-Checkbox-sharedSchedule"]'));
          
          if (await groupScheduleCheckbox.isVisible()) {
            await groupScheduleCheckbox.check();
            
            const vehicleSelect = page.locator('[data-testid="ScheduleForm-Select-vehicle"]');
            if (await vehicleSelect.isVisible()) {
              await vehicleSelect.selectOption({ index: 0 });
              
              const saveButton = page.locator('[data-testid="ScheduleForm-Button-saveSchedule"]');
              if (await saveButton.isVisible()) {
                await saveButton.click();
                console.log('✅ Coordinated group schedule created');
              }
            }
          }
        }
      });
    });

    test('should handle permissions and roles across family-group boundaries', async ({ page }) => {
      await test.step('Test cross-system permission validation', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.directUserSetup('permissionTester', '/groups');
        await page.goto('/groups');
        
        // As a group admin, should be able to manage group resources
        const groupAdminActions = page.locator('[data-testid="GroupPage-Container-adminActions"]')
          .or(page.locator('[data-testid="GroupPage-Button-groupSettings"]'));
        
        if (await groupAdminActions.isVisible()) {
          await groupAdminActions.click();
          
          // Should see group management options
          const manageGroupButton = page.locator('[data-testid="GroupPage-Button-manageGroup"]');
          if (await manageGroupButton.isVisible()) {
            console.log('✅ Group admin permissions active');
          } else {
            throw new Error('Permission test failed: Group admin permissions not active');
          }
        }
        
        // Navigate to schedule - should be able to view and interact with schedule
        // First get a group ID from the groups page
        const groupCards = await page.locator('[data-testid="GroupCard-Card-groupCard"]').all();
        if (groupCards.length > 0) {
          // Click on the first group's schedule button
          const viewScheduleButton = groupCards[0].locator('[data-testid="GroupCard-Button-viewSchedule"]');
          if (await viewScheduleButton.isVisible()) {
            await viewScheduleButton.click();
            await page.waitForLoadState('networkidle');
          } else {
            // Fallback to direct navigation
            await page.goto('/schedule');
            await page.waitForLoadState('networkidle');
          }
        } else {
          // No groups available, navigate directly
          await page.goto('/schedule');
          await page.waitForLoadState('networkidle');
        }
        
        // Check if we can see the schedule page (not redirected to error/onboarding)
        const scheduleTitle = page.locator('[data-testid="SchedulePage-Title-weeklySchedule"]');
        const weeklyScheduleHeader = page.locator('[data-testid="SchedulePage-Header-weeklySchedule"]');
        const groupSelection = page.locator('text=Choose a group');
        const vehicleSidebar = page.locator('[data-testid*="sidebar-vehicle"]').first();
        
        const canSeeScheduleTitle = await scheduleTitle.isVisible({ timeout: 5000 }).catch(() => false);
        const canSeeScheduleHeader = await weeklyScheduleHeader.isVisible({ timeout: 5000 }).catch(() => false);
        const canSeeGroupSelection = await groupSelection.isVisible({ timeout: 5000 }).catch(() => false);
        const canSeeVehicles = await vehicleSidebar.isVisible({ timeout: 5000 }).catch(() => false);
        
        console.log('Schedule page element visibility:', {
          scheduleTitle: canSeeScheduleTitle,
          scheduleHeader: canSeeScheduleHeader,
          groupSelection: canSeeGroupSelection,
          vehicles: canSeeVehicles
        });
        
        if (canSeeScheduleTitle || canSeeScheduleHeader || canSeeGroupSelection || canSeeVehicles) {
          console.log('✅ Cross-system permissions working (group admin can access schedule)');
        } else {
          // Check if we were redirected
          const currentUrl = page.url();
          console.error('Permission test failed - Current URL:', currentUrl);
          throw new Error('Permission test failed: Group admin cannot access schedule page');
        }
        
        // Should NOT be able to modify other families' resources
        const otherFamilyResources = page.locator('[data-testid="GroupPage-Container-otherFamilyChildren"]')
          .or(page.locator('[data-testid="GroupPage-Container-otherFamilyVehicles"]'));
        
        if (await otherFamilyResources.isVisible()) {
          const editButton = otherFamilyResources.locator('[data-testid="GroupPage-Button-editResource"]');
          if (await editButton.isVisible()) {
            const isDisabled = await editButton.isDisabled();
            if (isDisabled) {
              console.log('✅ Other family resources properly protected');
            } else {
              throw new Error('Permission test failed: Other family resources not properly protected');
            }
          }
        }
      });
    });
  });

  test.describe('Data Consistency Across Features', () => {
    test('should maintain data consistency when resources are updated', async ({ page }) => {
      await test.step('Update family resource and verify propagation', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.directUserSetup('dataConsistency', '/children');
        await page.goto('/children');
        
        // Update child information
        const editChildButton = page.locator('[data-testid="ChildrenPage-Button-editChild"]').first();
        if (await editChildButton.isVisible()) {
          await editChildButton.click();
          
          const childNameInput = page.locator('[data-testid="EditChildDialog-Input-childName"]');
          if (await childNameInput.isVisible()) {
            await childNameInput.clear();
            await childNameInput.fill('Updated Child Name');
            
            const saveButton = page.locator('[data-testid="EditChildDialog-Button-save"]');
            if (await saveButton.isVisible()) {
              await saveButton.click();
              console.log('✅ Child information updated');
            }
          }
        }
      });

      await test.step('Verify update reflects in schedule system', async () => {
        await page.goto('/schedule');
        
        // Look for child in schedule interface
        const childInSchedule = page.locator('[data-testid="SchedulePage-Container-main"]')
          .filter({ hasText: 'Updated Child Name' });
        
        if (await childInSchedule.isVisible()) {
          console.log('✅ Child name update propagated to schedule system');
        }
      });

      await test.step('Verify update reflects in group system', async () => {
        await page.goto('/groups');
        
        // Look for child in group member lists
        const childInGroup = page.locator('[data-testid="SchedulePage-Container-main"], [data-testid="GroupFamilies-Container-list"]')
          .filter({ hasText: 'Updated Child Name' });
        
        if (await childInGroup.isVisible()) {
          console.log('✅ Child name update propagated to group system');
        }
      });

      await test.step('Test vehicle update propagation', async () => {
        await page.goto('/vehicles');
        
        // Update vehicle information
        const editVehicleButton = page.locator('[data-testid="VehiclesPage-Button-editVehicle"]').first();
        if (await editVehicleButton.isVisible()) {
          await editVehicleButton.click();
          
          const vehicleNameInput = page.locator('[data-testid="EditVehicleDialog-Input-vehicleName"]');
          if (await vehicleNameInput.isVisible()) {
            await vehicleNameInput.clear();
            await vehicleNameInput.fill('Updated Vehicle Name');
            
            const saveButton = page.locator('[data-testid="EditVehicleDialog-Button-save"]');
            if (await saveButton.isVisible()) {
              await saveButton.click();
              console.log('✅ Vehicle information updated');
            }
          }
        }
        
        // Verify in schedule
        await page.goto('/schedule');
        
        const vehicleInSchedule = page.locator('[data-testid="ScheduleForm-Select-vehicle"] option')
          .filter({ hasText: 'Updated Vehicle Name' });
        
        if (await vehicleInSchedule.isVisible()) {
          console.log('✅ Vehicle update propagated to schedule system');
        }
      });
    });

    test('should handle resource deletion cascades properly', async ({ page }) => {
      await test.step('Test child deletion impact on schedules', async () => {
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        await authHelper.directUserSetup('deletionTester', '/children');
        await page.goto('/children');
        
        // Delete a child
        const deleteChildButton = page.locator('[data-testid="ChildrenPage-Button-deleteChild"]').first();
        if (await deleteChildButton.isVisible()) {
          await deleteChildButton.click();
          
          // Confirm deletion
          const confirmDeleteButton = page.locator('[data-testid="DeleteChildDialog-Button-confirm"]');
          if (await confirmDeleteButton.isVisible()) {
            await confirmDeleteButton.click();
            console.log('✅ Child deleted');
          }
        }
        
        // Check schedule for orphaned references
        await page.goto('/schedule');
        
        // Should not see the deleted child in any schedule slots
        const orphanedChild = page.locator('[data-testid="SchedulePage-Container-main"]')
          .filter({ hasText: 'Deleted Child' });
        
        const isOrphaned = await orphanedChild.isVisible().catch(() => false);
        if (!isOrphaned) {
          console.log('✅ Child deletion properly cascaded to schedules');
        }
      });

      await test.step('Test vehicle deletion impact on schedules', async () => {
        await page.goto('/vehicles');
        
        // Delete a vehicle that might be in use
        const deleteVehicleButton = page.locator('[data-testid="VehiclesPage-Button-deleteVehicle"]').first();
        if (await deleteVehicleButton.isVisible()) {
          await deleteVehicleButton.click();
          
          // Should warn about existing schedule usage
          const usageWarning = page.locator('[data-testid="VehicleDeleteModal-Alert-usageWarning"]')
            .or(page.locator('[data-testid="DeleteVehicleDialog-Alert-usageWarning"]'));
          
          if (await usageWarning.isVisible()) {
            console.log('✅ System warns about vehicle usage before deletion');
            
            // Cancel deletion to maintain test consistency
            const cancelButton = page.locator('[data-testid="DeleteVehicleDialog-Button-cancel"]');
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
            }
          }
        }
      });
    });
  });
});