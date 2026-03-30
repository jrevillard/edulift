import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Vehicles Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  /**
   * Helper: Navigate from dashboard to the Vehicles page via UI links.
   * Uses the family management page as the intermediate step.
   */
  async function navigateToVehiclesPage(page: import('@playwright/test').Page): Promise<void> {
    const manageButton = page.getByRole('link', { name: 'Manage Family', exact: true });
    await manageButton.waitFor({ state: 'visible', timeout: 5000 });
    await manageButton.click();
    await page.waitForURL('/family/manage', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const manageVehiclesButton = page.locator('[data-testid="ManageFamilyPage-Button-manageVehicles"]');
    await expect(manageVehiclesButton).toBeVisible({ timeout: 10000 });
    await manageVehiclesButton.click();
    await page.waitForURL('/vehicles', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  /**
   * Helper: Add a vehicle with the given name and capacity.
   * Assumes the Vehicles page is already loaded and the add vehicle dialog is NOT open.
   * Returns the vehicle ID extracted from the rendered card testid.
   */
  async function addVehicle(
    page: import('@playwright/test').Page,
    name: string,
    capacity: string,
  ): Promise<string> {
    const addVehicleButton = page.locator('[data-testid="VehiclesPage-Button-addVehicle"]');
    await expect(addVehicleButton).toBeVisible({ timeout: 10000 });
    await addVehicleButton.click();

    // Wait for the dialog to open
    const dialogContainer = page.locator('[data-testid="VehiclesPage-Container-dialogContainer"]');
    await expect(dialogContainer).toBeVisible({ timeout: 5000 });

    const nameInput = page.locator('[data-testid="VehiclesPage-Input-vehicleName"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(name);

    const capacityInput = page.locator('[data-testid="VehiclesPage-Input-vehicleCapacity"]');
    await expect(capacityInput).toBeVisible({ timeout: 5000 });
    await capacityInput.fill(capacity);

    const submitButton = page.locator('[data-testid="VehiclesPage-Button-submitVehicle"]');
    await submitButton.click();

    // Wait for dialog to close
    await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });

    // Wait for vehicle to appear in list
    const vehicleNameElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').filter({ hasText: name }).first();
    await expect(vehicleNameElement).toBeVisible({ timeout: 10000 });

    // Extract vehicle ID from the testid attribute
    const vehicleId = await vehicleNameElement.getAttribute('data-testid');
    // testid format: VehiclesPage-Text-vehicleName-{vehicleId}
    const id = vehicleId!.replace('VehiclesPage-Text-vehicleName-', '');
    return id;
  }

  // =========================================================================
  // [P0] Test 1: Admin can add a vehicle to the family
  // =========================================================================
  test('[P0] admin can add a vehicle to the family', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();
    const vehicleName = `TestCar_${timestamp}`;
    const vehicleCapacity = '5';

    await test.step('Setup: create admin user with family', async () => {
      await authHelper.setupAdminUser(
        'vehicles.add',
        `Vehicle Add User ${timestamp}`,
        `Vehicle Add Family ${timestamp}`,
      );
      console.log('✅ Admin user created with family');
    });

    await test.step('Navigate to Vehicles page', async () => {
      await navigateToVehiclesPage(page);

      // Verify the page header is visible
      const pageTitle = page.locator('[data-testid="VehiclesPage-Title-pageTitle"]');
      await expect(pageTitle).toBeVisible({ timeout: 10000 });
      console.log('✅ Navigated to Vehicles page');
    });

    await test.step('Add a new vehicle via the dialog', async () => {
      await addVehicle(page, vehicleName, vehicleCapacity);
      console.log('✅ Vehicle added via dialog');
    });

    await test.step('Verify vehicle appears in the list', async () => {
      // Verify the vehicle name is displayed
      const vehicleNameElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').filter({ hasText: vehicleName });
      await expect(vehicleNameElement).toBeVisible({ timeout: 5000 });

      // Verify the vehicle capacity is displayed
      const vehicleCapacityElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleCapacity-"]').filter({ hasText: new RegExp(`${vehicleCapacity} seat`) });
      await expect(vehicleCapacityElement).toBeVisible({ timeout: 5000 });

      console.log('✅ Vehicle displayed correctly in list');
    });
  });

  // =========================================================================
  // [P0] Test 2: Admin can edit an existing vehicle
  // =========================================================================
  test('[P0] admin can edit an existing vehicle', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();
    const originalName = `EditCar_${timestamp}`;
    const updatedName = `EditCar_Updated_${timestamp}`;
    const originalCapacity = '3';
    const updatedCapacity = '7';

    await test.step('Setup: create admin user with family', async () => {
      await authHelper.setupAdminUser(
        'vehicles.edit',
        `Vehicle Edit User ${timestamp}`,
        `Vehicle Edit Family ${timestamp}`,
      );
      console.log('✅ Admin user created with family');
    });

    await test.step('Navigate to Vehicles page and add a vehicle', async () => {
      await navigateToVehiclesPage(page);

      const vehicleId = await addVehicle(page, originalName, originalCapacity);
      expect(vehicleId).toBeTruthy();
      console.log('✅ Vehicle created for editing');
    });

    await test.step('Open edit dialog for the vehicle', async () => {
      // Reload to ensure edit buttons are rendered for the newly added vehicle
      await page.reload();
      await page.waitForLoadState('networkidle');

      const editButton = page.locator('[data-testid^="VehiclesPage-Button-editVehicle-"]').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // Wait for the dialog to open and show the edit title
      const dialogContainer = page.locator('[data-testid="VehiclesPage-Container-dialogContainer"]');
      await expect(dialogContainer).toBeVisible({ timeout: 5000 });

      const modalTitle = page.locator('[data-testid="VehiclesPage-Title-vehicleModalTitle"]');
      await expect(modalTitle).toHaveText('Edit Vehicle');
      console.log('✅ Edit dialog opened');
    });

    await test.step('Update vehicle name and capacity', async () => {
      const nameInput = page.locator('[data-testid="VehiclesPage-Input-vehicleName"]');
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await nameInput.clear();
      await nameInput.fill(updatedName);

      const capacityInput = page.locator('[data-testid="VehiclesPage-Input-vehicleCapacity"]');
      await expect(capacityInput).toBeVisible({ timeout: 5000 });
      await capacityInput.clear();
      await capacityInput.fill(updatedCapacity);

      const submitButton = page.locator('[data-testid="VehiclesPage-Button-submitVehicle"]');
      await submitButton.click();

      // Wait for dialog to close
      const dialogContainer = page.locator('[data-testid="VehiclesPage-Container-dialogContainer"]');
      await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });
      console.log('✅ Vehicle updated');
    });

    await test.step('Verify updated values are displayed', async () => {
      // Verify the updated name
      const vehicleNameElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').filter({ hasText: updatedName });
      await expect(vehicleNameElement).toBeVisible({ timeout: 5000 });

      // Verify the updated capacity
      const vehicleCapacityElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleCapacity-"]').filter({ hasText: new RegExp(`${updatedCapacity} seat`) });
      await expect(vehicleCapacityElement).toBeVisible({ timeout: 5000 });

      // Verify the original name is no longer present
      const oldNameElement = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').filter({ hasText: originalName });
      await expect(oldNameElement).not.toBeVisible({ timeout: 5000 });

      console.log('✅ Updated vehicle values displayed correctly');
    });
  });

  // =========================================================================
  // [P0] Test 3: Admin can delete a vehicle from the family
  // =========================================================================
  test('[P0] admin can delete a vehicle from the family', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();
    const vehicleName = `DeleteCar_${timestamp}`;
    const vehicleCapacity = '4';
    let vehicleId: string;

    await test.step('Setup: create admin user with family', async () => {
      await authHelper.setupAdminUser(
        'vehicles.delete',
        `Vehicle Delete User ${timestamp}`,
        `Vehicle Delete Family ${timestamp}`,
      );
      console.log('✅ Admin user created with family');
    });

    await test.step('Navigate to Vehicles page and add a vehicle', async () => {
      await navigateToVehiclesPage(page);

      vehicleId = await addVehicle(page, vehicleName, vehicleCapacity);
      expect(vehicleId).toBeTruthy();
      console.log('✅ Vehicle created for deletion');
    });

    await test.step('Click delete button and confirm deletion', async () => {
      const deleteButton = page.locator(`[data-testid="VehiclesPage-Button-deleteVehicle-${vehicleId}"]`);
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
      await deleteButton.click();

      // Wait for the confirmation dialog to appear
      const confirmDialogTitle = page.locator('[data-testid="ConfirmationDialog-Title-dialog"]');
      await expect(confirmDialogTitle).toBeVisible({ timeout: 5000 });
      await expect(confirmDialogTitle).toHaveText('Delete Vehicle');

      const confirmDescription = page.locator('[data-testid="ConfirmationDialog-Description-dialog"]');
      await expect(confirmDescription).toContainText(vehicleName);

      // Confirm deletion
      const confirmButton = page.locator('[data-testid="ConfirmationDialog-Button-confirm"]');
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();

      // Wait for confirmation dialog to close
      await expect(confirmDialogTitle).not.toBeVisible({ timeout: 10000 });
      console.log('✅ Vehicle deletion confirmed');
    });

    await test.step('Verify vehicle is removed from the list', async () => {
      // The deleted vehicle should no longer appear
      const deletedVehicle = page.locator(`[data-testid="VehiclesPage-Text-vehicleName-${vehicleId}"]`);
      await expect(deletedVehicle).not.toBeVisible({ timeout: 5000 });

      // Verify empty state or that the vehicle list does not contain the deleted vehicle
      const emptyState = page.locator('[data-testid="VehiclesPage-Container-emptyState"]');

      // After deleting the only vehicle, empty state should be shown
      await expect(emptyState).toBeVisible({ timeout: 10000 });
      console.log('✅ Vehicle removed and empty state displayed');
    });
  });

  // =========================================================================
  // [P1] Test 4: Vehicles page displays empty state when no vehicles
  // =========================================================================
  test('[P1] vehicles page displays empty state when no vehicles', async ({ page }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();

    await test.step('Setup: create admin user with family (no vehicles)', async () => {
      await authHelper.setupAdminUser(
        'vehicles.empty',
        `Vehicle Empty User ${timestamp}`,
        `Vehicle Empty Family ${timestamp}`,
      );
      console.log('✅ Admin user created with family');
    });

    await test.step('Navigate to Vehicles page', async () => {
      await navigateToVehiclesPage(page);
      console.log('✅ Navigated to Vehicles page');
    });

    await test.step('Verify empty state is displayed', async () => {
      const emptyState = page.locator('[data-testid="VehiclesPage-Container-emptyState"]');
      await expect(emptyState).toBeVisible({ timeout: 10000 });

      // The vehicles list should NOT be visible
      const vehiclesList = page.locator('[data-testid="VehiclesPage-List-vehiclesList"]');
      await expect(vehiclesList).not.toBeVisible();

      console.log('✅ Empty state displayed correctly');
    });
  });

  // =========================================================================
  // [P1] Test 5: Member role can view but cannot add vehicles
  // =========================================================================
  test('[P1] member role can view but cannot add vehicles', async ({ page, context: _context }) => {
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    const timestamp = Date.now();
    const memberEmail = authHelper.getFileSpecificEmail(`member.vehicles.${timestamp}`);
    const vehicleName = `SharedCar_${timestamp}`;
    let invitationUrl: string | null = null;

    await test.step('Setup: admin creates family and adds a vehicle', async () => {
      await authHelper.setupAdminUser(
        'admin.member.vehicles',
        `Admin Member Vehicles ${timestamp}`,
        `Member Vehicles Family ${timestamp}`,
      );

      // Navigate to vehicles and add a vehicle
      await navigateToVehiclesPage(page);
      await addVehicle(page, vehicleName, '5');

      console.log('✅ Admin created family with vehicle');
    });

    await test.step('Admin invites a member with MEMBER role', async () => {
      // Navigate to family management via UI
      const manageButton = page.getByRole('link', { name: 'Manage Family', exact: true });
      await manageButton.waitFor({ state: 'visible', timeout: 5000 });
      await manageButton.click();
      await page.waitForURL('/family/manage', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');

      await authHelper.waitForFamilyPageReady();

      // Send invitation with MEMBER role
      const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
      await expect(inviteButton).toBeVisible({ timeout: 5000 });
      await inviteButton.click();

      const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
      await expect(emailInput).toBeVisible({ timeout: 5000 });
      await emailInput.fill(memberEmail);

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

      // Clear any inherited state
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

      await test.step('Member navigates to Vehicles page', async () => {
        const manageLink = memberPage.getByRole('link', { name: 'Manage Family', exact: true });
        await manageLink.waitFor({ state: 'visible', timeout: 5000 });
        await manageLink.click();
        await memberPage.waitForURL('/family/manage', { timeout: 10000 });
        await memberPage.waitForLoadState('networkidle');

        const manageVehiclesButton = memberPage.locator('[data-testid="ManageFamilyPage-Button-manageVehicles"]');
        await expect(manageVehiclesButton).toBeVisible({ timeout: 10000 });
        await manageVehiclesButton.click();
        await memberPage.waitForURL('/vehicles', { timeout: 10000 });
        await memberPage.waitForLoadState('networkidle');

        console.log('✅ Member navigated to Vehicles page');
      });

      await test.step('Member can view existing vehicles', async () => {
        // Verify the vehicle added by admin is visible to the member
        const vehicleNameElement = memberPage.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').filter({ hasText: vehicleName });
        await expect(vehicleNameElement).toBeVisible({ timeout: 10000 });

        const vehicleCapacityElement = memberPage.locator('[data-testid^="VehiclesPage-Text-vehicleCapacity-"]').filter({ hasText: /5 seat/ });
        await expect(vehicleCapacityElement).toBeVisible({ timeout: 5000 });

        console.log('✅ Member can view existing vehicles');
      });

      await test.step('Member cannot add a vehicle (button hidden for non-admin)', async () => {
        // The Add Vehicle button should NOT be visible for member role
        const addVehicleButton = memberPage.locator('[data-testid="VehiclesPage-Button-addVehicle"]');
        await expect(addVehicleButton).not.toBeVisible({ timeout: 5000 });

        // Verify edit/delete buttons are also hidden
        const editButton = memberPage.locator('[data-testid^="VehiclesPage-Button-editVehicle-"]');
        await expect(editButton).not.toBeVisible({ timeout: 5000 });

        const deleteButton = memberPage.locator('[data-testid^="VehiclesPage-Button-deleteVehicle-"]');
        await expect(deleteButton).not.toBeVisible({ timeout: 5000 });

        console.log('✅ Member cannot add/edit vehicles - buttons are hidden');
      });

      await memberContext.close();
    });
  });
});
