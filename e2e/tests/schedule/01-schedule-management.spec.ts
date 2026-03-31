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

    await page.waitForURL(/\/groups/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  }

  // ===========================================================================
  // Helper: navigate to schedule page via nav link and select a group
  //
  // NOTE: ModernCard component does not forward data-testid, so 'schedule-grid'
  // testid does not exist in the DOM. We use 'week-range-header' instead.
  // ===========================================================================
  async function navigateToSchedulePage(page: import('@playwright/test').Page) {
    const scheduleLink = page.getByRole('link', { name: 'Schedule' });
    await expect(scheduleLink).toBeVisible({ timeout: 10000 });
    await scheduleLink.click();
    await page.waitForURL(/\/schedule/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Reload to bust React Query stale cache
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for groups to load and group selection page to appear
    const subtitle = page.getByText('Choose a group to view its weekly schedule');
    await expect(subtitle).toBeVisible({ timeout: 15000 });

    // Click on the first group card to select it
    const groupCard = page.locator('.grid .cursor-pointer').first();
    await expect(groupCard).toBeVisible({ timeout: 5000 });
    await groupCard.click();

    // Wait for schedule to load
    const weekHeader = page.locator('[data-testid="week-range-header"]');
    await expect(weekHeader).toBeVisible({ timeout: 15000 });
  }

  // ===========================================================================
  // Helper: configure schedule hours for a group
  // Must be on the groups page with the group card visible.
  // Navigates to group manage page, opens config modal, adds a time slot,
  // and saves.
  // ===========================================================================
  async function configureGroupSchedule(page: import('@playwright/test').Page) {
    // Click "Manage" on the first group card (admin only)
    const manageBtn = page.locator('[data-testid="GroupCard-Button-manageGroup"]').first();
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    // Navigates to /groups/{groupId}/manage
    await page.waitForURL(/\/groups\/.*\/manage/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Open the schedule config modal
    const configureScheduleBtn = page.locator('[data-testid="ManageGroupPage-Button-configureSchedule"]');
    await expect(configureScheduleBtn).toBeVisible({ timeout: 10000 });
    await configureScheduleBtn.click();

    // Wait for modal to open
    const modal = page.locator('[data-testid="GroupScheduleConfigModal-Content-dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Switch to a future day tab (avoid Monday if it's already past)
    // Pick the first day that isn't in the past: if today is Mon-Sat, use tomorrow;
    // if today is Sunday, use Monday of next week (but since config only has Mon-Fri,
    // pick the next weekday that isn't past)
    const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayMap: Record<number, string> = {
      0: 'monday',    // Sunday → Monday
      1: 'tuesday',   // Monday → Tuesday
      2: 'wednesday', // Tuesday → Wednesday
      3: 'thursday',  // Wednesday → Thursday
      4: 'friday',    // Thursday → Friday
      5: 'monday',    // Friday → Monday (next week, but within same config)
      6: 'monday',    // Saturday → Monday
    };
    const targetDay = dayMap[today] || 'tuesday';
    const dayTab = page.locator(`[data-testid="GroupScheduleConfigModal-Tab-${targetDay}"]`);
    await expect(dayTab).toBeVisible({ timeout: 5000 });
    await dayTab.click();

    // Select a future time slot (first available option)
    const timeSlotSelect = page.locator('[data-testid="GroupScheduleConfigModal-Select-newTimeSlot"]');
    await expect(timeSlotSelect).toBeVisible({ timeout: 5000 });
    await timeSlotSelect.selectOption({ index: 0 });

    // Add the time slot
    const addSlotBtn = page.locator('[data-testid="GroupScheduleConfigModal-Button-addTimeSlot"]');
    await expect(addSlotBtn).toBeVisible({ timeout: 5000 });
    await addSlotBtn.click();

    // Save the configuration
    const saveBtn = page.locator('[data-testid="GroupScheduleConfigModal-Button-saveConfiguration"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // Wait for modal to close and save to complete
    await expect(modal).not.toBeVisible({ timeout: 10000 });
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
  // Helper: assign a vehicle to the first available schedule slot
  // Must be on the schedule page with a group selected and config set.
  // ===========================================================================
  async function assignVehicleToSlot(page: import('@playwright/test').Page) {
    // Wait for schedule config to load (separate API call after page render)
    await page.waitForLoadState('networkidle');

    // Navigate through day pages to find an available slot with "+ Add vehicle" button
    // The schedule paginates days (e.g., 2 of 5 days shown), so the configured day
    // may not be on the first page
    const addVehicleBtn = page.locator('button[data-testid^="add-vehicle"]').first();
    let isBtnVisible = await addVehicleBtn.isVisible({ timeout: 3000 }).catch(() => false);

    while (!isBtnVisible) {
      const nextDayBtn = page.getByRole('button', { name: 'Next' }).last();
      const isNextEnabled = await nextDayBtn.isEnabled().catch(() => false);
      if (!isNextEnabled) break;
      await nextDayBtn.click();
      await page.waitForLoadState('networkidle');
      isBtnVisible = await addVehicleBtn.isVisible({ timeout: 3000 }).catch(() => false);
    }

    await addVehicleBtn.scrollIntoViewIfNeeded();
    await expect(addVehicleBtn).toBeVisible({ timeout: 10000 });
    await addVehicleBtn.click();

    // Vehicle selection modal should open — select the first available vehicle
    const vehicleOption = page.locator('[data-testid^="vehicle-option-"]').first();
    await expect(vehicleOption).toBeVisible({ timeout: 5000 });
    await vehicleOption.click();

    // Confirm the assignment
    const confirmBtn = page.locator('[data-testid="confirm-assignment"]');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Wait for the modal to close (mutation calls onClose on success)
    const modalClose = page.locator('[data-testid="VehicleSelectionModal"]');
    await expect(modalClose).not.toBeVisible({ timeout: 15000 });

    // Verify the slot now shows a vehicle assignment instead of "+ Add vehicle"
    const scheduleVehicle = page.locator('[data-testid^="schedule-vehicle-"]').first();
    await expect(scheduleVehicle).toBeVisible({ timeout: 10000 });
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

      await test.step('Setup: authenticate admin with family and group', async () => {
        await testAuthHelper.setupAdminUser(
          'schedule.create',
          `Admin Schedule Create ${timestamp}`,
          `ScheduleCreate Family ${timestamp}`,
        );
      });

      await test.step('Add a vehicle and create a group', async () => {
        await addVehicleViaUI(page, vehicleName, '5');
        await navigateToGroupsPage(page);
        await createGroupViaUI(page, groupName);
      });

      await test.step('Configure group schedule hours', async () => {
        await configureGroupSchedule(page);
      });

      await test.step('Navigate to schedule page and select group', async () => {
        await navigateToSchedulePage(page);
      });

      await test.step('Assign vehicle to first available slot', async () => {
        await assignVehicleToSlot(page);
      });
    });
  });

  // ===========================================================================
  // P1 Tests
  // ===========================================================================
  test.describe('Assign Children to Slot', () => {
    test('[P1] child assignment modal opens from vehicle slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const groupName = `ChildAssign Group ${timestamp}`;
      const vehicleName = `ChildAssignVan_${timestamp}`;
      const childName = `ChildAssign_${timestamp}`;

      await test.step('Setup: authenticate admin with family', async () => {
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

      await test.step('Configure group schedule hours', async () => {
        await configureGroupSchedule(page);
      });

      await test.step('Navigate to schedule page, select group, and assign vehicle', async () => {
        await navigateToSchedulePage(page);
        await assignVehicleToSlot(page);
      });

      await test.step('Open child assignment modal from vehicle slot', async () => {
        // Click on the vehicle card (not the gear button) to open child assignment
        const vehicleCard = page.locator('[data-testid^="schedule-vehicle-"]').first();
        await expect(vehicleCard).toBeVisible({ timeout: 10000 });
        await vehicleCard.click();

        const childModal = page.locator('[data-testid="ChildAssignmentModal-Container-modal"]');
        await expect(childModal).toBeVisible({ timeout: 5000 });

        const capacityText = page.locator('[data-testid="ChildAssignmentModal-Text-capacityText"]');
        await expect(capacityText).toBeVisible({ timeout: 5000 });
      });
    });
  });

  test.describe('Vehicle Assignment Display', () => {
    test('[P1] vehicle assignment shows capacity info on schedule slot', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const groupName = `RemoveVehicle Group ${timestamp}`;
      const vehicleName = `RemoveVan_${timestamp}`;

      await test.step('Setup: authenticate admin', async () => {
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

      await test.step('Configure group schedule hours', async () => {
        await configureGroupSchedule(page);
      });

      await test.step('Navigate to schedule page, select group, and assign vehicle', async () => {
        await navigateToSchedulePage(page);
        await assignVehicleToSlot(page);
      });

      await test.step('Verify vehicle assignment with capacity info', async () => {
        const scheduleVehicle = page.locator('[data-testid^="schedule-vehicle-"]').first();
        await expect(scheduleVehicle).toBeVisible({ timeout: 10000 });

        const capacityIndicator = page.locator('[data-testid^="capacity-indicator-"]').first();
        await expect(capacityIndicator).toBeVisible({ timeout: 5000 });
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
        const scheduleLink = page.getByRole('link', { name: 'Schedule' });
        await expect(scheduleLink).toBeVisible({ timeout: 10000 });
        await scheduleLink.click();
        await page.waitForURL(/\/schedule/, { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        const emptyState = page.locator('[data-testid="SchedulePage-EmptyState-noGroups"]');
        await expect(emptyState).toBeVisible({ timeout: 10000 });
      });
    });
  });
});
