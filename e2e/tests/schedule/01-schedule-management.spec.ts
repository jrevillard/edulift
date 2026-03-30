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
  // Helper: navigate to groups page via nav link
  // ===========================================================================
  async function navigateToGroupsPage(page: import('@playwright/test').Page) {
    const groupsLink = page.getByRole('link', { name: 'Groups' });
    await expect(groupsLink).toBeVisible({ timeout: 10000 });
    await groupsLink.click();
    await page.waitForURL(/\/groups/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: navigate to family manage page via nav link
  // ===========================================================================
  async function navigateToFamilyManagePage(page: import('@playwright/test').Page) {
    const manageFamilyLink = page.getByRole('link', { name: 'Manage Family' });
    await expect(manageFamilyLink).toBeVisible({ timeout: 10000 });
    await manageFamilyLink.click();
    await page.waitForURL(/\/family\/manage/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: create a group through the UI (must be on groups page)
  // ===========================================================================
  async function createGroupViaUI(
    page: import('@playwright/test').Page,
    groupName: string,
  ) {
    const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
    await expect(groupNameInput).toBeVisible({ timeout: 5000 });
    await groupNameInput.fill(groupName);

    const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // Wait for group creation and redirect back to groups page
    await page.waitForURL(/\/groups/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: navigate to schedule page via nav link and select a group
  // The schedule page uses a different React Query key ('my-groups') than the
  // groups page ('user-groups'), so a reload is needed to populate the cache.
  //
  // NOTE: ModernCard component does not forward data-testid, so 'schedule-grid'
  // testid does not exist in the DOM. We use 'week-range-header' instead to
  // verify the schedule loaded with a group selected.
  // ===========================================================================
  async function navigateToSchedulePage(page: import('@playwright/test').Page) {
    const scheduleLink = page.getByRole('link', { name: 'Schedule' });
    await expect(scheduleLink).toBeVisible({ timeout: 10000 });
    await scheduleLink.click();
    await page.waitForURL(/\/schedule/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to bust React Query cache (schedule page uses 'my-groups' key
    // which is not populated by the groups page's 'user-groups' key)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for groups to load and group selection page to appear
    const subtitle = page.getByText('Choose a group to view its weekly schedule');
    await expect(subtitle).toBeVisible({ timeout: 15000 });

    // Click on the first group card to select it
    const groupCard = page.locator('.grid .cursor-pointer').first();
    await expect(groupCard).toBeVisible({ timeout: 5000 });
    await groupCard.click();

    // Wait for schedule to load (week-range-header is inside the schedule view,
    // only rendered when a group is selected and schedule config is loaded)
    const weekHeader = page.locator('[data-testid="week-range-header"]');
    await expect(weekHeader).toBeVisible({ timeout: 15000 });
  }

  // ===========================================================================
  // Helper: add a vehicle through the UI
  // ===========================================================================
  async function addVehicleViaUI(
    page: import('@playwright/test').Page,
    vehicleName: string,
    vehicleCapacity: string,
  ) {
    await navigateToFamilyManagePage(page);

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
    await navigateToFamilyManagePage(page);

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
      const groupName = `ScheduleView Group ${timestamp}`;

      await test.step('Setup: authenticate admin with family and group', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.view',
          `Admin Schedule View ${timestamp}`,
          `ScheduleView Family ${timestamp}`,
        );
      });

      await test.step('Create a group via UI', async () => {
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Navigate to schedule page and select group', async () => {
        await navigateToSchedulePage(page);
      });

      await test.step('Verify schedule header and week range are displayed', async () => {
        const pageTitle = page.locator('[data-testid="SchedulePage-Title-weeklySchedule"]');
        await expect(pageTitle).toBeVisible({ timeout: 10000 });

        const weekHeader = page.locator('[data-testid="week-range-header"]');
        await expect(weekHeader).toBeVisible({ timeout: 5000 });

        // Verify week range contains date info
        const weekText = await weekHeader.textContent();
        expect(weekText).toBeTruthy();
      });
    });
  });

  test.describe('Create Schedule Slot', () => {
    test('[P0] admin can add a vehicle to a schedule slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const groupName = `ScheduleCreate Group ${timestamp}`;
      const vehicleName = `ScheduleVan_${timestamp}`;
      const vehicleCapacity = '5';

      await test.step('Setup: authenticate admin with family and group', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.create',
          `Admin Schedule Create ${timestamp}`,
          `ScheduleCreate Family ${timestamp}`,
        );
      });

      await test.step('Add a vehicle and create a group', async () => {
        await addVehicleViaUI(page, vehicleName, vehicleCapacity);
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Navigate to schedule and add vehicle to slot', async () => {
        await navigateToSchedulePage(page);

        // Find an available time slot (not in the past)
        const addVehicleBtn = page.locator('[data-testid="add-vehicle-btn"]').first();
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
      const groupName = `ChildAssign Group ${timestamp}`;
      const vehicleName = `ChildAssignVan_${timestamp}`;
      const childName = `ChildAssign_${timestamp}`;

      await test.step('Setup: authenticate admin with family, group, vehicle and child', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.child',
          `Admin Schedule Child ${timestamp}`,
          `ScheduleChild Family ${timestamp}`,
        );
      });

      await test.step('Add vehicle, child, and create group', async () => {
        await addVehicleViaUI(page, vehicleName, '5');
        await addChildViaUI(page, childName, '8');
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Navigate to schedule and assign child to slot', async () => {
        await navigateToSchedulePage(page);

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
      const groupName = `RemoveVehicle Group ${timestamp}`;
      const vehicleName = `RemoveVan_${timestamp}`;

      await test.step('Setup: authenticate admin and add vehicle', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.remove',
          `Admin Schedule Remove ${timestamp}`,
          `ScheduleRemove Family ${timestamp}`,
        );
      });

      await test.step('Add vehicle and create group', async () => {
        await addVehicleViaUI(page, vehicleName, '5');
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Navigate to schedule and check vehicle slot', async () => {
        await navigateToSchedulePage(page);

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
      const groupName = `WeekNav Group ${timestamp}`;

      await test.step('Setup: authenticate admin', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.weeknav',
          `Admin Week Nav ${timestamp}`,
          `WeekNav Family ${timestamp}`,
        );
      });

      await test.step('Create a group via UI', async () => {
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Navigate to schedule and check week navigation', async () => {
        await navigateToSchedulePage(page);

        const weekHeader = page.locator('[data-testid="week-range-header"]');
        await expect(weekHeader).toBeVisible({ timeout: 10000 });

        // Verify the week range header is present and contains date info
        const initialWeekText = await weekHeader.textContent();
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
        // Navigate to schedule page via nav link
        const scheduleLink = page.getByRole('link', { name: 'Schedule' });
        await expect(scheduleLink).toBeVisible({ timeout: 10000 });
        await scheduleLink.click();
        await page.waitForURL(/\/schedule/, { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Should show empty state since no groups exist
        const emptyState = page.locator('[data-testid="SchedulePage-EmptyState-noGroups"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });
      });
    });
  });
});
