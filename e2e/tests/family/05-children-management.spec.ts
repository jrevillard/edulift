import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Children Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  // ===========================================================================
  // Helper: navigate from dashboard to children page via UI
  // ===========================================================================
  async function navigateToChildrenPage(page: import('@playwright/test').Page) {
    const manageButton = page.getByRole('link', { name: 'Manage Family', exact: true });
    await manageButton.waitFor({ state: 'visible', timeout: 5000 });
    await manageButton.click();
    await page.waitForURL('/family/manage', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const manageChildrenButton = page.locator('[data-testid="ManageFamilyPage-Button-manageChildren"]');
    await manageChildrenButton.click();
    await page.waitForURL('/children', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: add a child through the UI and return its card locator
  // ===========================================================================
  async function addChildViaUI(
    page: import('@playwright/test').Page,
    childName: string,
    childAge: string,
  ) {
    await page.click('[data-testid="ChildrenPage-Button-addChild"]');

    // Wait for the dialog to open
    const dialogContainer = page.locator('[data-testid="ChildrenPage-Container-dialogContainer"]');
    await expect(dialogContainer).toBeVisible({ timeout: 5000 });

    const nameInput = page.locator('[data-testid="ChildrenPage-Input-childName"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(childName);

    const ageInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
    await expect(ageInput).toBeVisible({ timeout: 5000 });
    await ageInput.fill(childAge);

    await page.click('[data-testid="ChildrenPage-Button-submitChild"]');

    // Wait for dialog to close
    await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });
  }

  // ===========================================================================
  // P0 Tests
  // ===========================================================================
  test.describe('Add Child', () => {
    test('[P0] admin can add a child to the family', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const childName = `Child_${timestamp}`;
      const childAge = '8';

      await test.step('Setup: authenticate admin and create family', async () => {
        await testAuthHelper.setupAdminUser(
          'child.add',
          `Admin Child Add ${timestamp}`,
          `AddChild Family ${timestamp}`,
        );
        console.log('✅ Admin user created with family');
      });

      await test.step('Navigate to children page', async () => {
        await navigateToChildrenPage(page);

        // Verify page loaded
        await expect(page.locator('[data-testid="ChildrenPage-Title-pageTitle"]')).toBeVisible({ timeout: 10000 });
        console.log('✅ Navigated to children page');
      });

      await test.step('Add a new child', async () => {
        await addChildViaUI(page, childName, childAge);
        console.log('✅ Child form submitted');
      });

      await test.step('Verify child appears in the list', async () => {
        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify children list is visible
        await expect(page.locator('[data-testid="ChildrenPage-List-childrenList"]')).toBeVisible({ timeout: 10000 });

        // Verify the child name is displayed
        const childNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: childName });
        await expect(childNameElement).toBeVisible({ timeout: 10000 });

        // Verify the child age is displayed
        const childAgeElement = page.locator('[data-testid^="ChildrenPage-Text-childAge-"]').filter({ hasText: childAge });
        await expect(childAgeElement).toBeVisible({ timeout: 5000 });

        const displayedName = await childNameElement.textContent();
        expect(displayedName).toContain(childName);

        console.log('✅ Child verified in list with correct name and age');
      });
    });
  });

  test.describe('Edit Child', () => {
    test('[P0] admin can edit an existing child', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const originalName = `ChildOrig_${timestamp}`;
      const originalAge = '6';
      const updatedName = `ChildUpdated_${timestamp}`;
      const updatedAge = '10';

      await test.step('Setup: authenticate admin and create family', async () => {
        await testAuthHelper.setupAdminUser(
          'child.edit',
          `Admin Child Edit ${timestamp}`,
          `EditChild Family ${timestamp}`,
        );
        console.log('✅ Admin created with family');
      });

      await test.step('Navigate to children page and add a child', async () => {
        await navigateToChildrenPage(page);
        await addChildViaUI(page, originalName, originalAge);
        console.log('✅ Child added for editing');
      });

      await test.step('Edit the child name and age', async () => {
        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Find the edit button for the child
        const childNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: originalName });
        await expect(childNameElement).toBeVisible({ timeout: 10000 });

        // The edit button testid is ChildrenPage-Button-editChild-[child.id]
        const editButton = page.locator('[data-testid^="ChildrenPage-Button-editChild-"]').first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        // Wait for dialog to open in edit mode
        const dialogTitle = page.locator('[data-testid="ChildrenPage-Title-childModalTitle"]');
        await expect(dialogTitle).toBeVisible({ timeout: 5000 });
        const titleText = await dialogTitle.textContent();
        expect(titleText).toContain('Edit Child');

        // Update name (fill() clears the field first, no need for clear())
        const nameInput = page.locator('[data-testid="ChildrenPage-Input-childName"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await nameInput.fill(updatedName);

        // Update age (fill() clears the field first, no need for clear())
        const ageInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
        await expect(ageInput).toBeVisible({ timeout: 5000 });
        await ageInput.fill(updatedAge);

        // Submit
        await page.click('[data-testid="ChildrenPage-Button-submitChild"]');

        // Wait for dialog to close — must use DialogContent testid (renders a DOM element),
        // NOT the Dialog Root testid (Radix Root renders no DOM element, causing
        // .not.toBeVisible() to pass immediately without waiting for the mutation)
        const dialogContainer = page.locator('[data-testid="ChildrenPage-Container-dialogContainer"]');
        await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });

        // Wait for all background queries (children refetch) to settle before reload
        await page.waitForLoadState('networkidle');
      });

      await test.step('Verify updated values are displayed', async () => {
        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify updated name
        const updatedNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: updatedName });
        await expect(updatedNameElement).toBeVisible({ timeout: 10000 });

        const displayedName = await updatedNameElement.textContent();
        expect(displayedName).toContain(updatedName);

        // Verify updated age
        const updatedAgeElement = page.locator('[data-testid^="ChildrenPage-Text-childAge-"]').filter({ hasText: updatedAge });
        await expect(updatedAgeElement).toBeVisible({ timeout: 5000 });

        const displayedAge = await updatedAgeElement.textContent();
        expect(displayedAge).toContain(updatedAge);

        // Verify original name is no longer present
        const originalNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: originalName });
        await expect(originalNameElement).not.toBeVisible({ timeout: 5000 });

        console.log('✅ Updated child name and age verified');
      });
    });
  });

  test.describe('Delete Child', () => {
    test('[P0] admin can delete a child from the family', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const childName = `ChildDel_${timestamp}`;
      const childAge = '7';

      await test.step('Setup: authenticate admin and create family', async () => {
        await testAuthHelper.setupAdminUser(
          'child.delete',
          `Admin Child Delete ${timestamp}`,
          `DeleteChild Family ${timestamp}`,
        );
        console.log('✅ Admin created with family');
      });

      await test.step('Navigate to children page and add a child', async () => {
        await navigateToChildrenPage(page);
        await addChildViaUI(page, childName, childAge);
        console.log('✅ Child added for deletion');
      });

      await test.step('Delete the child', async () => {
        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify child is in the list before deletion
        const childNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: childName });
        await expect(childNameElement).toBeVisible({ timeout: 10000 });

        // Click delete button
        const deleteButton = page.locator('[data-testid^="ChildrenPage-Button-deleteChild-"]').first();
        await expect(deleteButton).toBeVisible({ timeout: 5000 });
        await deleteButton.click();
        console.log('✅ Delete button clicked');

        // Confirm deletion in the confirmation dialog
        const confirmDialog = page.locator('[data-testid="ConfirmationDialog-Button-confirm"]');
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        await confirmDialog.click();
        console.log('✅ Deletion confirmed in dialog');
      });

      await test.step('Verify child is removed from the list', async () => {
        // Reload to ensure fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify child name is no longer displayed
        const childNameElement = page.locator('[data-testid^="ChildrenPage-Text-childName-"]').filter({ hasText: childName });
        await expect(childNameElement).not.toBeVisible({ timeout: 10000 });

        // Verify empty state is now visible (no children left)
        const emptyState = page.locator('[data-testid="ChildrenPage-Container-emptyState"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });

        console.log('✅ Child removed and empty state displayed');
      });
    });
  });

  // ===========================================================================
  // P1 Tests
  // ===========================================================================
  test.describe('Empty State', () => {
    test('[P1] children page displays empty state when no children', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup: authenticate admin and create family', async () => {
        await testAuthHelper.setupAdminUser(
          'child.empty',
          `Admin Child Empty ${timestamp}`,
          `EmptyChild Family ${timestamp}`,
        );
        console.log('✅ Admin created with family');
      });

      await test.step('Navigate to children page and verify empty state', async () => {
        await navigateToChildrenPage(page);

        // Verify page title is visible
        await expect(page.locator('[data-testid="ChildrenPage-Title-pageTitle"]')).toBeVisible({ timeout: 10000 });

        // Verify empty state container is visible
        const emptyState = page.locator('[data-testid="ChildrenPage-Container-emptyState"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });

        // Verify children list is NOT visible (no children exist)
        const childrenList = page.locator('[data-testid="ChildrenPage-List-childrenList"]');
        await expect(childrenList).not.toBeVisible({ timeout: 5000 });

        console.log('✅ Empty state displayed correctly for family with no children');
      });
    });
  });

  test.describe('Member Role Access Control', () => {
    test('[P1] member role can view but cannot add children', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const memberEmail = testAuthHelper.getFileSpecificEmail(`member.children.${timestamp}`);
      let invitationUrl: string | null = null;

      await test.step('Setup: Admin creates family', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.member.children',
          `Admin Member Children ${timestamp}`,
          `MemberChildren Family ${timestamp}`,
        );
        console.log('✅ Admin created with family');
      });

      await test.step('Admin invites a member with MEMBER role', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('link', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        await testAuthHelper.waitForFamilyPageReady();

        // Send invitation with MEMBER role
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 5000 });
        await inviteButton.click();

        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(memberEmail);
        await expect(emailInput).toHaveValue(memberEmail);

        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Member' }).click();

        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for invitation email
        invitationUrl = await emailHelper.requireInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();

        console.log('✅ Member invited with MEMBER role');
      });

      await test.step('Member accepts invitation in isolated context', async () => {
        const memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();

        // Clear any inherited auth state
        await memberPage.goto('/login');
        await memberPage.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await memberPage.reload();
        await memberPage.waitForLoadState('networkidle');

        const memberAuth = new UniversalAuthHelper(memberPage);
        await memberAuth.acceptInvitation(invitationUrl!, memberEmail);

        console.log('✅ Member accepted invitation');

        await test.step('Member navigates to children page and verifies restrictions', async () => {
          // Navigate to family management
          await memberPage.getByRole('link', { name: 'Manage Family' }).click();
          await memberPage.waitForURL('/family/manage', { timeout: 10000 });
          await memberPage.waitForLoadState('networkidle');

          // Navigate to children page
          const manageChildrenButton = memberPage.locator('[data-testid="ManageFamilyPage-Button-manageChildren"]');
          await manageChildrenButton.click();
          await memberPage.waitForURL('/children', { timeout: 10000 });
          await memberPage.waitForLoadState('networkidle');

          // Verify page loaded
          await expect(memberPage.locator('[data-testid="ChildrenPage-Title-pageTitle"]')).toBeVisible({ timeout: 10000 });

          // Verify add child button is NOT visible for member role
          const addChildButton = memberPage.locator('[data-testid="ChildrenPage-Button-addChild"]');
          await expect(addChildButton).not.toBeVisible({ timeout: 5000 });

          // Verify empty state is shown (member has no children)
          const emptyState = memberPage.locator('[data-testid="ChildrenPage-Container-emptyState"]');
          await expect(emptyState).toBeVisible({ timeout: 10000 });

          console.log('✅ Member role cannot add children - add button is hidden');
        });

        await memberContext.close();
      });
    });
  });
});
