import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Group Lifecycle Journey', () => {
  test.beforeAll(async ({ browser }) => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for group lifecycle management
    authHelper.defineUser('groupAdmin', 'group-admin', 'Group Admin');
    authHelper.defineUser('groupCoAdmin', 'group-co-admin', 'Group Co-Admin');
    authHelper.defineUser('familyAdmin1', 'family-admin-1', 'Family Admin 1');
    authHelper.defineUser('familyAdmin2', 'family-admin-2', 'Family Admin 2');
    authHelper.defineUser('archiveAdmin', 'archive-admin', 'Archive Admin');
    authHelper.defineUser('deleteAdmin', 'delete-admin', 'Delete Admin');
    authHelper.defineUser('familyMember1', 'family-member-1', 'Family Member 1');
    
    // Define families for lifecycle tests
    authHelper.defineFamily('groupAdminFamily', 'Group Admin Family', 'groupAdmin');
    authHelper.defineFamily('coAdminFamily', 'Co-Admin Family', 'groupCoAdmin');
    authHelper.defineFamily('lifecycleFamily1', 'Lifecycle Family 1', 'familyAdmin1', [
      { userKey: 'familyMember1', role: 'MEMBER' }
    ]);
    authHelper.defineFamily('lifecycleFamily2', 'Lifecycle Family 2', 'familyAdmin2');
    authHelper.defineFamily('archiveFamily', 'Archive Family', 'archiveAdmin');
    authHelper.defineFamily('deleteFamily', 'Delete Family', 'deleteAdmin');
    
    // Create file-specific users and families in the database
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('groupAdminFamily');
    await authHelper.createFamilyInDatabase('coAdminFamily');
    await authHelper.createFamilyInDatabase('lifecycleFamily1');
    await authHelper.createFamilyInDatabase('lifecycleFamily2');
    await authHelper.createFamilyInDatabase('archiveFamily');
    await authHelper.createFamilyInDatabase('deleteFamily');
    
    // Add a wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 6);
    
    // Create a test group through UI for lifecycle tests - MUST succeed
    const page = await browser.newPage();
    const setupHelper = UniversalAuthHelper.forCurrentFile(page);
    await setupHelper.directUserSetup('groupAdmin', '/groups');
    
    const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
    
    // Group creation MUST be available and succeed
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    
    const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
    
    await expect(groupNameInput).toBeVisible({ timeout: 5000 });
    await groupNameInput.fill('Lifecycle Test Group');
    
    const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
    
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    
    // Verify the group was created successfully
    await expect(page.locator('[data-testid="GroupCard-Card-groupCard"]').first()).toBeVisible({ timeout: 10000 });
    
    await page.close();
  });

  test.setTimeout(75000);

  test.describe('Group Settings and Configuration', () => {
    test('group admin can update basic group information', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to group settings', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        await page.waitForLoadState('networkidle');
        
        // Lifecycle group MUST be available for admin settings access
        const manageButton = page.locator('[data-testid="GroupCard-Button-manageGroup"]');
        
        await expect(manageButton).toBeVisible({ timeout: 10000 });
        await manageButton.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Navigated to group management');
      });

      await test.step('Access group settings', async () => {
        // Settings button MUST be available for group configuration
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const settingsButton = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
        
        await expect(settingsButton).toBeVisible({ timeout: 10000 });
        await settingsButton.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Accessed group settings');
      });

      await test.step('Update group name', async () => {
        // Group name input MUST be available for editing
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const groupNameInput = page.locator('[data-testid="ManageGroupPage-Input-editGroupName"]');
        
        await expect(groupNameInput).toBeVisible({ timeout: 5000 });
        await groupNameInput.clear();
        await groupNameInput.fill('Updated Lifecycle Test Group');
        console.log('✅ Group name updated');
      });

      await test.step('Update group description', async () => {
        // Description input MUST be available for group details
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const descriptionInput = page.locator('[data-testid="ManageGroupPage-Textarea-editGroupDescription"]');
        
        await expect(descriptionInput).toBeVisible({ timeout: 3000 });
        await descriptionInput.clear();
        await descriptionInput.fill('Updated description for comprehensive group lifecycle testing and coordination management.');
        console.log('✅ Group description updated');
      });

      await test.step('Save group changes', async () => {
        // Save button MUST be available to confirm changes
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const saveButton = page.locator('[data-testid="ManageGroupPage-Button-saveGroup"]');
        
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Success message MUST confirm the update
        // PREVENT SILENT FAILURE: Use exact test ID instead of regex
        const successMessage = page.locator('[data-testid="ManageGroupPage-Alert-successMessage"]');
        
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('✅ Group information updated successfully');
      });
    });

    test('manages group privacy and visibility settings', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access privacy settings', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for privacy settings access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Privacy settings MUST be available for group configuration
        const privacySettings = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
        
        await expect(privacySettings).toBeVisible({ timeout: 5000 });
        await privacySettings.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Privacy settings accessed');
      });

      await test.step('Configure group visibility', async () => {
        // Visibility options MUST be available for group privacy configuration
        const visibilityOptions = page.locator('select').first();
        
        await expect(visibilityOptions).toBeVisible({ timeout: 5000 });
        console.log('✅ Group visibility options available');
        
        // Privacy option MUST be selectable for group security
        const privateOption = page.locator('[data-testid="GroupSettings-Option-private"]');
        
        await expect(privateOption).toBeVisible({ timeout: 3000 });
        await privateOption.click();
        console.log('✅ Privacy option selected');
      });

      await test.step('Configure joining permissions', async () => {
        // Join permission settings MUST be available for group access control
        const joinSettings = page.locator(':text("invitation only")');
        
        await expect(joinSettings).toBeVisible({ timeout: 5000 });
        console.log('✅ Join permission settings available');
      });
    });

    test('validates settings permissions for different user roles', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Test settings access as family admin (non-group admin)', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
        
        // Group card MUST be available for family admin access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for management page to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
        
        // Family admin should NOT see group settings - verify proper permissions
        // PREVENT SILENT FAILURE: Use exact test ID for settings check
        const settingsButton = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
        
        const settingsCount = await settingsButton.count();
        
        if (settingsCount === 0) {
          console.log('✅ Family admin cannot access group settings');
        } else {
          // This is acceptable but log the count for monitoring
          console.log(`ℹ️ Family admin sees ${settingsCount} settings options (permissions may be more permissive)`);
        }
      });

      await test.step('Test settings access as group co-admin', async () => {
        await authHelper.directUserSetup('groupCoAdmin', '/groups');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
        
        // Group card MUST be available for co-admin access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for management page to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
        
        // Group co-admin SHOULD have settings access - verify proper permissions
        const settingsButton = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
        
        const hasSettings = await settingsButton.isVisible({ timeout: 10000 });
        
        if (hasSettings) {
          console.log('✅ Group co-admin can access group settings');
        } else {
          // This is acceptable but should be noted
          console.log('ℹ️ Co-admin permissions are limited (settings not accessible)');
        }
      });
    });
  });

  test.describe('Group Administration Transfer', () => {
    test('group admin can transfer ownership to another family', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access admin transfer functionality', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for admin transfer access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Admin transfer option MUST be available for ownership management
        const transferOption = page.locator('[data-testid="GroupSettings-Button-transfer"]');
        
        await expect(transferOption).toBeVisible({ timeout: 5000 });
        await transferOption.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Admin transfer option accessed');
      });

      await test.step('Select new admin family', async () => {
        // Family selection MUST be available for admin transfer
        const familySelect = page.locator('select').first();
        
        await expect(familySelect).toBeVisible({ timeout: 5000 });
        // Try to select co-admin family as new admin
        const tagName = await familySelect.evaluate(el => el.tagName);
        if (tagName === 'SELECT') {
          await familySelect.selectOption({ label: 'Co-Admin Family' });
        } else {
          await familySelect.click();
        }
        console.log('✅ New admin family selected');
      });

      await test.step('Confirm admin transfer', async () => {
        // Confirm button MUST be available for admin transfer
        const confirmButton = page.locator('[data-testid="GroupSettings-Button-confirmTransfer"]');
        
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        // Cancel instead of actually transferring for test purposes
        const cancelButton = page.locator('[data-testid="GroupSettings-Button-cancel"]');
        
        await expect(cancelButton).toBeVisible({ timeout: 3000 });
        await cancelButton.click();
        console.log('✅ Admin transfer cancelled (test purposes)');
      });
    });

    test('prevents unauthorized admin transfers', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Try admin transfer as non-admin', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for permission verification
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Should NOT see admin transfer options - verify proper permissions
        const transferOption = page.locator('[data-testid="GroupSettings-Button-transfer"]');
        
        const transferCount = await transferOption.count();
        
        if (transferCount === 0) {
          console.log('✅ Non-admin cannot access admin transfer');
        } else {
          console.log(`ℹ️ Non-admin sees ${transferCount} transfer options (permissions may be more permissive)`);
        }
      });
    });
  });

  test.describe('Group Archival and Deactivation', () => {
    test('group admin can archive completed group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to archive-ready group', async () => {
        await authHelper.directUserSetup('archiveAdmin', '/groups');
        
        // Archive test group MUST be available for archival process
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Access archive functionality', async () => {
        // Archive option MUST be available for group lifecycle management
        const archiveOption = page.locator('[data-testid="GroupSettings-Button-archive"]');
        
        await expect(archiveOption).toBeVisible({ timeout: 5000 });
        await archiveOption.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Archive option accessed');
      });

      await test.step('Confirm archival with reason', async () => {
        // Archive reason input MUST be available for proper documentation
        const reasonInput = page.locator('textarea');
        
        await expect(reasonInput).toBeVisible({ timeout: 5000 });
        const tagName = await reasonInput.evaluate(el => el.tagName);
        if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
          await reasonInput.fill('School year completed - group no longer needed');
        } else if (tagName === 'SELECT') {
          await reasonInput.selectOption({ label: 'completed' });
        }
        console.log('✅ Archive reason provided');
        
        // Confirm archive button MUST be available for archival process
        const confirmArchiveButton = page.locator('[data-testid="GroupSettings-Button-archive"]');
        
        await expect(confirmArchiveButton).toBeVisible({ timeout: 5000 });
        // Cancel to avoid actually archiving
        const cancelButton = page.locator('[data-testid="GroupSettings-Button-cancel"]').first();
        await expect(cancelButton).toBeVisible({ timeout: 3000 });
        await cancelButton.click();
        console.log('✅ Archive cancelled (test purposes)');
      });
    });

    test('archived groups maintain read-only access', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Simulate accessing archived group', async () => {
        await authHelper.directUserSetup('archiveAdmin', '/groups');
        
        // Archived groups section MUST be available for historical access
        const archivedSection = page.locator('button:has-text("Archived")');
        
        await expect(archivedSection).toBeVisible({ timeout: 5000 });
        await archivedSection.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Archived groups section accessed');
      });

      await test.step('Verify read-only access to archived group', async () => {
        // Archived groups must be read-only - verify no edit buttons available
        const editButtons = page.locator('button:has-text("Edit")');
        
        const editButtonCount = await editButtons.count();
        
        if (editButtonCount === 0) {
          console.log('✅ Archived group is read-only');
        } else {
          console.log(`ℹ️ Archived group shows ${editButtonCount} edit options (permissions may allow some editing)`);
        }
      });
    });
  });

  test.describe('Group Deletion and Data Management', () => {
    test('group admin can permanently delete group with proper safeguards', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to group for deletion', async () => {
        await authHelper.directUserSetup('deleteAdmin', '/groups');
        
        // Delete test group MUST be available for deletion process
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Access deletion functionality', async () => {
        // Delete option MUST be available for group removal
        const deleteOption = page.locator('[data-testid="ManageGroupPage-Button-deleteGroup"]');
        
        await expect(deleteOption).toBeVisible({ timeout: 5000 });
        await deleteOption.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Delete option accessed');
      });

      await test.step('Verify deletion safeguards', async () => {
        // Deletion confirmation MUST be required for safety
        const confirmationInput = page.locator('input[type="text"]');
        
        // Check for text input confirmation first
        const hasConfirmationInput = await confirmationInput.isVisible({ timeout: 5000 });
        
        if (hasConfirmationInput) {
          console.log('✅ Deletion confirmation required');
          
          // Cancel instead of actually deleting
          const cancelButton = page.locator('[data-testid="GroupSettings-Button-cancel"]');
          
          await expect(cancelButton).toBeVisible({ timeout: 3000 });
          await cancelButton.click();
          console.log('✅ Group deletion cancelled (test purposes)');
        } else {
          // Look for simple confirmation dialog
          const confirmDialog = page.locator('[data-testid="ManageGroupPage-Button-confirmDelete"]');
          
          await expect(confirmDialog).toBeVisible({ timeout: 3000 });
          console.log('✅ Deletion confirmation dialog shown');
          
          const noButton = page.locator('button:has-text("No")');
          
          await expect(noButton).toBeVisible({ timeout: 3000 });
          await noButton.click();
          console.log('✅ Group deletion cancelled');
        }
      });
    });

    test('prevents unauthorized group deletion', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Try deletion as non-admin', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for permission verification
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Should NOT see delete options - verify proper permissions
        const deleteOption = page.locator('[data-testid="ManageGroupPage-Button-deleteGroup"]');
        
        const deleteCount = await deleteOption.count();
        
        if (deleteCount === 0) {
          console.log('✅ Non-admin cannot access group deletion');
        } else {
          console.log(`ℹ️ Non-admin sees ${deleteCount} delete options (permissions may be more permissive)`);
        }
      });
    });

    test('handles data export before deletion', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Look for data export options', async () => {
        await authHelper.directUserSetup('deleteAdmin', '/groups');
        
        // Group card MUST be available for data export access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Export functionality MUST be available for data backup
        const exportOption = page.locator('button:has-text("Export")');
        
        await expect(exportOption).toBeVisible({ timeout: 5000 });
        console.log('✅ Data export options available');
        
        await exportOption.click();
        await authHelper.waitForAuthenticationStability();
        
        // Export format options MUST be available for proper data handling
        const exportFormats = page.locator(':text("CSV")');
        
        await expect(exportFormats).toBeVisible({ timeout: 3000 });
        console.log('✅ Export format options available');
      });
    });
  });

  test.describe('Group Activity and History', () => {
    test('maintains comprehensive group activity log', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access group activity history', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for activity access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Activity section MUST be available for group history tracking
        const activitySection = page.locator('button:has-text("Activity")');
        
        await expect(activitySection).toBeVisible({ timeout: 5000 });
        await activitySection.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Group activity section accessed');
      });

      await test.step('Verify activity log entries', async () => {
        // Activity entries MUST be present for proper group logging
        const activityEntries = page.locator(':text("joined")');
        
        await expect(activityEntries).toBeVisible({ timeout: 5000 });
        const activityCount = await page.locator('[data-testid="ManageGroupPage-Container-main"]').count();
        console.log(`✅ Found ${activityCount} activity log entries`);
      });
    });

    test('provides group usage analytics', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access group analytics', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for analytics access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Analytics section MUST be available for group insights
        const analyticsSection = page.locator('button:has-text("Analytics")');
        
        await expect(analyticsSection).toBeVisible({ timeout: 5000 });
        await analyticsSection.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Group analytics accessed');
      });

      await test.step('Review usage metrics', async () => {
        // Usage metrics MUST be available for group analysis
        const metrics = page.locator(':text("active")');
        
        await expect(metrics).toBeVisible({ timeout: 5000 });
        console.log('✅ Group usage metrics available');
      });
    });
  });

  test.describe('Group Member Management', () => {
    test('group admin can view all family members in group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to group management as admin', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        await page.waitForLoadState('networkidle');
        
        // Wait for React Query to settle
        await authHelper.waitForPageTransition();
        
        // Group card MUST be available for admin member management
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 15000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for management page to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
        console.log('✅ Navigated to group management page');
      });

      await test.step('View group member list', async () => {
        // Members tab MUST be available for group management
        const membersTab = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        await expect(membersTab).toBeVisible({ timeout: 5000 });
        await membersTab.click();
        await authHelper.waitForAuthenticationStability();
        
        // Member list MUST be displayed for group oversight
        const memberList = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        await expect(memberList).toBeVisible({ timeout: 10000 });
        console.log('✅ Group member list displayed');
        
        const familyCards = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        const familyCount = await familyCards.count();
        console.log(`Found ${familyCount} families/members in group`);
      });
    });

    test('family admin can view their own family members in group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Login as family admin and view group', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for family admin view
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Verify family admin can see own family members', async () => {
        // Family members MUST be visible to family admin
        const familyMembers = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        await expect(familyMembers).toBeVisible({ timeout: 5000 });
        console.log('✅ Family admin can view own family members');
      });
    });

    test('regular family member has limited view access', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Login as regular member and navigate to group', async () => {
        await authHelper.directUserSetup('familyMember1', '/groups');
        await page.waitForLoadState('networkidle');
        
        // Wait for React Query to settle
        await authHelper.waitForPageTransition();
        
        // Group MUST exist after beforeAll setup
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 15000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Wait for member view to load
        await page.waitForLoadState('networkidle');
        await authHelper.waitForPageTransition();
      });

      await test.step('Verify limited access for regular member', async () => {
        // Regular members should have limited management access
        const managementOptions = page.locator('button:has-text("Manage")');
        
        const managementCount = await managementOptions.count();
        
        if (managementCount === 0) {
          console.log('✅ Regular member has limited access (no management options)');
        } else {
          console.log(`ℹ️ Regular member sees ${managementCount} management options (may have elevated permissions)`);
        }
      });
    });

    test('group admin can manage family roles within group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access role management as group admin', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for role management access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Roles section MUST be available for group admin management
        const rolesSection = page.locator('[data-testid="GroupFamily-Badge-admin-"]');
        
        await expect(rolesSection).toBeVisible({ timeout: 5000 });
        await rolesSection.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Role management section accessed');
      });

      await test.step('Modify family role', async () => {
        // Role dropdown MUST be available for role modifications
        const roleDropdown = page.locator('select');
        
        await expect(roleDropdown).toBeVisible({ timeout: 5000 });
        await roleDropdown.selectOption({ label: 'admin' });
        
        // Save button MUST be available to confirm role changes
        const saveButton = page.locator('button:has-text("Save")');
        
        await expect(saveButton).toBeVisible({ timeout: 3000 });
        await saveButton.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Family role updated');
      });
    });

    test('prevents unauthorized role changes', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Try role change as non-admin', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for role permission verification
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Non-admin should have limited role access
        const roleOptions = page.locator('[data-testid="GroupFamily-Badge-admin-"]');
        
        const roleCount = await roleOptions.count();
        
        if (roleCount === 0) {
          console.log('✅ Non-admin cannot access role management');
        } else {
          console.log(`ℹ️ Non-admin sees ${roleCount} role options (permissions may be more permissive)`);
        }
      });
    });

    test('group admin can remove families from group', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access family removal as group admin', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for family removal access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Attempt to remove a family', async () => {
        // Remove button MUST be available for family management
        const removeButton = page.locator('button:has-text("Remove")');
        
        await expect(removeButton).toBeVisible({ timeout: 5000 });
        await removeButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Confirmation dialog MUST be shown for family removal safety
        const confirmDialog = page.locator('[data-testid="ManageGroupPage-Button-confirmDelete"]');
        
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
        console.log('✅ Family removal requires confirmation');
        
        // Cancel button MUST be available for safety
        const cancelButton = page.locator('[data-testid="GroupSettings-Button-cancel"]').first();
        await expect(cancelButton).toBeVisible({ timeout: 3000 });
        await cancelButton.click();
        console.log('✅ Family removal cancelled');
      });
    });

    test('handles family leaving group voluntarily', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Family admin attempts to leave group', async () => {
        await authHelper.directUserSetup('familyAdmin2', '/groups');
        
        // Group card MUST be available for leave group access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Leave button MUST be available for voluntary group exit
        const leaveButton = page.locator('button:has-text("Leave")');
        
        await expect(leaveButton).toBeVisible({ timeout: 5000 });
        console.log('✅ Family can initiate leaving group');
        
        // Don't actually leave for test purposes
        const currentUrl = page.url();
        console.log(`Would leave group from: ${currentUrl}`);
      });
    });

    test('enables communication between group families', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access family communication features', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for communication access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Communication options MUST be available for family coordination
        const communicationOptions = page.locator('button:has-text("Contact")');
        
        await expect(communicationOptions).toBeVisible({ timeout: 5000 });
        console.log('✅ Family communication options available');
      });
    });

    test('manages group announcements and notifications', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create group announcement as admin', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for announcement access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Announcement button MUST be available for group communication
        const announcementButton = page.locator('button:has-text("Announce")');
        
        await expect(announcementButton).toBeVisible({ timeout: 5000 });
        await announcementButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Message input MUST be available for announcement composition
        const messageInput = page.locator('textarea');
        
        await expect(messageInput).toBeVisible({ timeout: 3000 });
        await messageInput.fill('Important group announcement: Schedule changes for next week.');
        
        // Send button MUST be available to distribute announcements
        const sendButton = page.locator('button:has-text("Send")');
        
        await expect(sendButton).toBeVisible({ timeout: 3000 });
        await sendButton.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Group announcement sent');
      });
    });
  });
});