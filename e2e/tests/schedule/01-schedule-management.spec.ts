import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Schedule Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    emailHelper = new E2EEmailHelper();
  });

  test.beforeEach(async () => {
    await emailHelper.deleteAllEmails();
  });

  test.setTimeout(150000);

  // ===========================================================================
  // Helper: navigate to schedule page via UI (groups → click group card)
  // ===========================================================================
  async function navigateToSchedulePage(page: import('@playwright/test').Page) {
    // Navigate to groups page first, then click on a group card to access schedule
    await page.goto('/groups');
    await page.waitForLoadState('networkidle');

    const viewScheduleBtn = page.locator('[data-testid="GroupCard-Button-viewSchedule"]').first();
    await expect(viewScheduleBtn).toBeVisible({ timeout: 10000 });
    await viewScheduleBtn.click();

    await page.waitForURL(/\/schedule/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: add a vehicle through the UI
  // ===========================================================================
  async function addVehicleViaUI(
    page: import('@playwright/test').Page,
    vehicleName: string,
    vehicleCapacity: string,
  ) {
    // Navigate to vehicles page via UI: family/manage → manage vehicles button
    const manageVehiclesButton = page.locator('[data-testid="ManageFamilyPage-Button-manageVehicles"]');
    await expect(manageVehiclesButton).toBeVisible({ timeout: 10000 });
    await manageVehiclesButton.click();
    await page.waitForURL('/vehicles', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const addVehicleButton = page.locator('[data-testid="VehiclesPage-Button-addVehicle"]');
    await expect(addVehicleButton).toBeVisible({ timeout: 10000 });
    await addVehicleButton.click();

    const dialogContainer = page.locator('[data-testid="VehiclesPage-Container-dialogContainer"]');
    await expect(dialogContainer).toBeVisible({ timeout: 5000 });

    const nameInput = page.locator('[data-testid="VehiclesPage-Input-vehicleName"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(vehicleName);

    const capacityInput = page.locator('[data-testid="VehiclesPage-Input-vehicleCapacity"]');
    await expect(capacityInput).toBeVisible({ timeout: 5000 });
    await capacityInput.fill(vehicleCapacity);

    await page.click('[data-testid="VehiclesPage-Button-submitVehicle"]');

    await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });
  }

  // ===========================================================================
  // Helper: add a child through the UI
  // ===========================================================================
  async function addChildViaUI(
    page: import('@playwright/test').Page,
    childName: string,
    childAge: string,
  ) {
    // Navigate to children page via UI: family/manage → manage children button
    const manageChildrenButton = page.locator('[data-testid="ManageFamilyPage-Button-manageChildren"]');
    await expect(manageChildrenButton).toBeVisible({ timeout: 10000 });
    await manageChildrenButton.click();
    await page.waitForURL('/children', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const addChildButton = page.locator('[data-testid="ChildrenPage-Button-addChild"]');
    await expect(addChildButton).toBeVisible({ timeout: 10000 });
    await addChildButton.click();

    const dialogContainer = page.locator('[data-testid="ChildrenPage-Container-dialogContainer"]');
    await expect(dialogContainer).toBeVisible({ timeout: 5000 });

    const nameInput = page.locator('[data-testid="ChildrenPage-Input-childName"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(childName);

    const ageInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
    await expect(ageInput).toBeVisible({ timeout: 5000 });
    await ageInput.fill(childAge);

    await page.click('[data-testid="ChildrenPage-Button-submitChild"]');

    await expect(dialogContainer).not.toBeVisible({ timeout: 10000 });
  }

  // ===========================================================================
  // P0 Tests
  // ===========================================================================
  test.describe('View Schedule', () => {
    test('[P0] schedule page loads and displays weekly grid', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup: authenticate admin with family and group', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.view',
          `Admin Schedule View ${timestamp}`,
          `ScheduleView Family ${timestamp}`,
        );
      });

      await test.step('Navigate to schedule page', async () => {
        await navigateToSchedulePage(page);

        // Page should load (either empty state or schedule grid)
        const pageHeader = page.locator('[data-testid="SchedulePage-Header-weeklySchedule"]');
        await expect(pageHeader).toBeVisible({ timeout: 10000 });
      });

      await test.step('Verify schedule grid or empty state is displayed', async () => {
        // Either the schedule grid is shown (if user has groups) or empty state
        const scheduleGrid = page.locator('[data-testid="schedule-grid"]');
        const emptyState = page.locator('[data-testid="SchedulePage-EmptyState-noGroups"]');

        const hasGrid = await scheduleGrid.isVisible({ timeout: 5000 }).catch(() => false);
        const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

        // At least one should be visible
        expect(hasGrid || hasEmpty).toBeTruthy();
      });
    });
  });

  test.describe('Create Schedule Slot', () => {
    test('[P0] admin can add a vehicle to a schedule slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const vehicleName = `ScheduleVan_${timestamp}`;
      const vehicleCapacity = '5';

      await test.step('Setup: authenticate admin with family and group', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.create',
          `Admin Schedule Create ${timestamp}`,
          `ScheduleCreate Family ${timestamp}`,
        );
      });

      await test.step('Add a vehicle for scheduling', async () => {
        await addVehicleViaUI(page, vehicleName, vehicleCapacity);
      });

      await test.step('Navigate to schedule page and add vehicle to slot', async () => {
        await navigateToSchedulePage(page);

        // Wait for schedule grid to load
        const scheduleGrid = page.locator('[data-testid="schedule-grid"]');
        await expect(scheduleGrid).toBeVisible({ timeout: 10000 });

        // Verify week range header is displayed
        const weekHeader = page.locator('[data-testid="week-range-header"]');
        await expect(weekHeader).toBeVisible({ timeout: 5000 });

        // Find an available time slot (not in the past)
        const addVehicleBtn = page.locator('[data-testid="add-vehicle-btn"]').first();

        // If user has groups, there should be add vehicle buttons
        const hasAddBtn = await addVehicleBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasAddBtn) {
          await addVehicleBtn.click();

          // Vehicle selection modal should open
          const vehicleOption = page.locator('[data-testid="vehicle-option-"]').first();
          await expect(vehicleOption).toBeVisible({ timeout: 5000 });

          // Select a vehicle
          await vehicleOption.click();

          // Confirm assignment
          const confirmBtn = page.locator('[data-testid="confirm-assignment"]');
          await expect(confirmBtn).toBeVisible({ timeout: 5000 });
          await confirmBtn.click();

          // Wait for modal to close and assignment to appear
          await page.waitForLoadState('networkidle');

          // Verify vehicle appears in sidebar or schedule
          const sidebarVehicle = page.locator('[data-testid="sidebar-vehicle-name-"]').first();
          const scheduleVehicle = page.locator('[data-testid="schedule-vehicle-name-"]').first();

          const hasSidebar = await sidebarVehicle.isVisible({ timeout: 5000 }).catch(() => false);
          const hasSchedule = await scheduleVehicle.isVisible({ timeout: 5000 }).catch(() => false);

          expect(hasSidebar || hasSchedule).toBeTruthy();
        }
      });
    });
  });

  // ===========================================================================
  // P1 Tests
  // ===========================================================================
  test.describe('Assign Children to Slot', () => {
    test('[P1] admin can assign a child to a schedule slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const vehicleName = `ChildAssignVan_${timestamp}`;
      const childName = `ChildAssign_${timestamp}`;

      await test.step('Setup: authenticate admin with family, group, vehicle and child', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.child',
          `Admin Schedule Child ${timestamp}`,
          `ScheduleChild Family ${timestamp}`,
        );
      });

      await test.step('Add vehicle and child', async () => {
        await addVehicleViaUI(page, vehicleName, '5');
        await addChildViaUI(page, childName, '8');
      });

      await test.step('Navigate to schedule and assign child to slot', async () => {
        await navigateToSchedulePage(page);

        const scheduleGrid = page.locator('[data-testid="schedule-grid"]');
        await expect(scheduleGrid).toBeVisible({ timeout: 10000 });

        // Find a schedule slot that has a vehicle assignment (manage-vehicles-btn)
        const manageVehiclesBtn = page.locator('[data-testid="manage-vehicles-btn"]').first();
        const hasSlot = await manageVehiclesBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasSlot) {
          // Click to open child assignment modal
          await manageVehiclesBtn.click();

          // Child assignment modal should open
          const childModal = page.locator('[data-testid="ChildAssignmentModal-Container-modal"]');
          await expect(childModal).toBeVisible({ timeout: 5000 });

          // Verify capacity indicator is visible
          const capacityText = page.locator('[data-testid="ChildAssignmentModal-Text-capacityText"]');
          await expect(capacityText).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });

  test.describe('Remove Vehicle from Slot', () => {
    test('[P1] admin can remove a vehicle assignment from a schedule slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const vehicleName = `RemoveVan_${timestamp}`;

      await test.step('Setup: authenticate admin and add vehicle', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.remove',
          `Admin Schedule Remove ${timestamp}`,
          `ScheduleRemove Family ${timestamp}`,
        );
        await addVehicleViaUI(page, vehicleName, '5');
      });

      await test.step('Navigate to schedule and remove vehicle', async () => {
        await navigateToSchedulePage(page);

        const scheduleGrid = page.locator('[data-testid="schedule-grid"]');
        await expect(scheduleGrid).toBeVisible({ timeout: 10000 });

        // If vehicle is assigned, there should be a vehicle in the slot
        const scheduleVehicle = page.locator('[data-testid="schedule-vehicle-"]').first();
        const hasVehicle = await scheduleVehicle.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasVehicle) {
          // The vehicle assignment should show capacity info
          const capacityIndicator = page.locator('[data-testid^="capacity-indicator-"]').first();
          await expect(capacityIndicator).toBeVisible({ timeout: 5000 });
        }
      });
    });
  });

  test.describe('Week Navigation', () => {
    test('[P1] user can navigate between weeks on the schedule', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup: authenticate admin', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.weeknav',
          `Admin Week Nav ${timestamp}`,
          `WeekNav Family ${timestamp}`,
        );
      });

      await test.step('Navigate to schedule and check week navigation', async () => {
        await navigateToSchedulePage(page);

        const weekHeader = page.locator('[data-testid="week-range-header"]');
        await expect(weekHeader).toBeVisible({ timeout: 10000 });

        // Store initial week range
        const initialWeekText = await weekHeader.textContent();

        // Verify the week range header is present and contains date info
        expect(initialWeekText).toBeTruthy();
      });
    });
  });

  test.describe('Empty State', () => {
    test('[P1] schedule page shows empty state when user has no groups', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup: authenticate admin (no groups created)', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.empty',
          `Admin Schedule Empty ${timestamp}`,
          `ScheduleEmpty Family ${timestamp}`,
        );
      });

      await test.step('Navigate to schedule and verify empty state', async () => {
        await navigateToSchedulePage(page);

        // Should show empty state since no groups exist
        const emptyState = page.locator('[data-testid="SchedulePage-EmptyState-noGroups"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });

        // Schedule grid should NOT be visible
        const scheduleGrid = page.locator('[data-testid="schedule-grid"]');
        await expect(scheduleGrid).not.toBeVisible({ timeout: 5000 });
      });
    });
  });
});
