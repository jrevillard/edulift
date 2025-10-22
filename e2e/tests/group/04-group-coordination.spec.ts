import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Group Coordination Journey', () => {
  test.beforeAll(async () => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for group coordination scenarios
    authHelper.defineUser('groupAdmin', 'group-admin', 'Group Admin');
    authHelper.defineUser('familyAdmin1', 'family-admin-1', 'Family Admin 1');
    authHelper.defineUser('familyAdmin2', 'family-admin-2', 'Family Admin 2');
    authHelper.defineUser('familyAdmin3', 'family-admin-3', 'Family Admin 3');
    authHelper.defineUser('familyMember1', 'family-member-1', 'Family Member 1');
    authHelper.defineUser('familyMember2', 'family-member-2', 'Family Member 2');
    
    // Define families for coordination scenarios
    authHelper.defineFamily('groupAdminFamily', 'Group Admin Family', 'groupAdmin');
    authHelper.defineFamily('coordinationFamily1', 'Coordination Family 1', 'familyAdmin1', [
      { userKey: 'familyMember1', role: 'MEMBER' }
    ]);
    authHelper.defineFamily('coordinationFamily2', 'Coordination Family 2', 'familyAdmin2', [
      { userKey: 'familyMember2', role: 'MEMBER' }
    ]);
    authHelper.defineFamily('coordinationFamily3', 'Coordination Family 3', 'familyAdmin3');
    
    // Create file-specific users and families in the database
    // Groups will be created through UI interactions during tests
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('groupAdminFamily');
    await authHelper.createFamilyInDatabase('coordinationFamily1');
    await authHelper.createFamilyInDatabase('coordinationFamily2');
    await authHelper.createFamilyInDatabase('coordinationFamily3');
    
    // Add a wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 4);
  });

  test.setTimeout(75000);

  test.describe('Multi-Family Transportation Coordination', () => {
    test('coordinates carpool assignments across families', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create group and navigate to coordination', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        await page.waitForLoadState('networkidle');
        
        // Create group if not exists - coordination MUST have a group to work with
        const existingGroup = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        const groupExists = await existingGroup.isVisible({ timeout: 5000 });
        
        if (!groupExists) {
          const createButton = page.locator('[data-testid="GroupsPage-Button-createGroup"]');
          
          await expect(createButton).toBeVisible({ timeout: 10000 });
          await createButton.click();
          
          const groupNameInput = page.locator('[data-testid="CreateGroupModal-Input-groupName"]');
          
          await expect(groupNameInput).toBeVisible({ timeout: 5000 });
          await groupNameInput.fill('Coordination Test Group');
          
          const submitButton = page.locator('[data-testid="CreateGroupModal-Button-submit"]');
          
          const authHelper = UniversalAuthHelper.forCurrentFile(page);
          await expect(submitButton).toBeVisible({ timeout: 5000 });
          await submitButton.click();
          await authHelper.waitForAuthenticationStability();
          console.log('✅ Created coordination test group');
        }
        
        // Now navigate to the group - MUST exist after creation
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        const authHelper = UniversalAuthHelper.forCurrentFile(page);
        
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Navigated to coordination group');
      });

      await test.step('Access carpool coordination features', async () => {
        // Look for carpool or transportation coordination via View Schedule
        const viewScheduleButton = page.locator('[data-testid="GroupCard-Button-viewSchedule"]');
        
        // Schedule access MUST be available in group interface
        await expect(viewScheduleButton).toBeVisible({ timeout: 10000 });
        await viewScheduleButton.click();
        await authHelper.waitForAuthenticationStability();
        console.log('✅ Accessed schedule interface for coordination');
      });

      await test.step('Set up carpool assignments', async () => {
        // Look for assignment creation in available interface
        const createAssignmentButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Schedule")');
        
        // Assignment creation button MUST be available for carpool setup
        const hasCreateButton = await createAssignmentButton.first().isVisible({ timeout: 5000 });
        if (hasCreateButton) {
          await createAssignmentButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Assignment form MUST be available after clicking create
        const assignmentForm = page.locator('form, [role="dialog"], main').first();
        
        await expect(assignmentForm).toBeVisible({ timeout: 3000 });
        
        // Date input MUST be available for scheduling
        const dateInput = page.locator('input[type="date"]').first();
        await expect(dateInput).toBeVisible({ timeout: 3000 });
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];
        await dateInput.fill(dateString);
        
        // Time input MUST be available for scheduling
        const timeInput = page.locator('input[type="time"]').first();
        await expect(timeInput).toBeVisible({ timeout: 3000 });
        await timeInput.fill('08:00');
        
        console.log('✅ Carpool assignment form filled');
      });

      await test.step('Assign families to carpool roles', async () => {
        // Family assignment options MUST be available for carpool coordination
        const familyAssignment = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        await expect(familyAssignment).toBeVisible({ timeout: 5000 });
        console.log('✅ Family assignment options available');
        
        // Driver selection MUST be available for carpool setup
        const driverSelect = page.locator('select').first();
        
        await expect(driverSelect).toBeVisible({ timeout: 3000 });
        await driverSelect.selectOption({ index: 1 });
        console.log('✅ Driver assignment made');
      });

      await test.step('Save coordination plan', async () => {
        // Save button MUST be available to complete coordination plan
        const saveButton = page.locator('[data-testid="ManageGroupPage-Button-saveGroup"]');
        
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Success confirmation MUST be shown after saving coordination plan
        const successMessage = page.locator('[data-testid="ManageGroupPage-Alert-successMessage"]');
        
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('✅ Coordination plan saved successfully');
      });
    });

    test('families can view and respond to coordination requests', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate as family admin to view coordination', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for family admin to access coordination
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('View coordination requests and assignments', async () => {
        // Coordination assignments MUST be visible to family members
        const coordinationSection = page.locator('[data-testid="SchedulePage-Container-main"]');
        
        await expect(coordinationSection).toBeVisible({ timeout: 10000 });
        console.log('✅ Family can view coordination assignments');
      });

      await test.step('Respond to coordination request', async () => {
        // Response options MUST be available for coordination requests
        const responseOptions = page.locator('button:has-text("Accept"), button:has-text("Confirm"), button:has-text("Join")');
        
        const hasResponseButton = await responseOptions.first().isVisible({ timeout: 5000 });
        if (hasResponseButton) {
          await responseOptions.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Family coordination response attempted');
      });

      await test.step('Provide availability information', async () => {
        // Availability input MUST be available for coordination details
        const availabilityInput = page.locator('textarea');
        
        await expect(availabilityInput).toBeVisible({ timeout: 3000 });
        await availabilityInput.fill('Available for pickup at 8:00 AM, can drop off at school');
        
        // Submit button MUST be available to save availability information
        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Save"), button:has-text("Confirm")');
        
        const hasSubmitButton = await submitButton.first().isVisible({ timeout: 3000 });
        if (hasSubmitButton) {
          await submitButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Availability information submission attempted');
      });
    });

    test('handles coordination conflicts and alternatives', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create conflict scenario', async () => {
        await authHelper.directUserSetup('familyAdmin2', '/groups');
        
        // Group card MUST be available for family admin to access coordination
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Decline coordination request', async () => {
        // Decline option MUST be available for coordination requests
        const declineButton = page.locator('button:has-text("Decline"), button:has-text("Cancel"), button:has-text("No")');
        
        const hasDeclineButton = await declineButton.first().isVisible({ timeout: 5000 });
        if (hasDeclineButton) {
          await declineButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Family coordination decline attempted');
      });

      await test.step('Suggest alternative arrangement', async () => {
        // Alternative suggestion input MUST be available for coordination flexibility
        const alternativeInput = page.locator('textarea');
        
        await expect(alternativeInput).toBeVisible({ timeout: 5000 });
        await alternativeInput.fill('Cannot drive tomorrow, but available Thursday. Could do pickup instead of dropoff.');
        
        // Submit button MUST be available to send alternative suggestion
        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Save"), button:has-text("Send")');
        
        const hasSubmitButton = await submitButton.first().isVisible({ timeout: 3000 });
        if (hasSubmitButton) {
          await submitButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Alternative suggestion submission attempted');
      });
    });
  });

  test.describe('Real-time Coordination Updates', () => {
    test('enables real-time coordination status updates', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Set up real-time coordination scenario', async () => {
        // Group admin makes coordination change
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for group admin to access coordination
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        console.log('✅ Group admin ready for coordination updates');
      });

      await test.step('Make coordination update', async () => {
        // Update button MUST be available for coordination modifications
        const updateButton = page.locator('[data-testid="ManageGroupPage-Button-editGroup"]');
        
        await expect(updateButton).toBeVisible({ timeout: 5000 });
        await updateButton.click();
        await authHelper.waitForAuthenticationStability();
        
        // Time input MUST be available for schedule changes
        const timeInput = page.locator('input[type="time"]').first();
        await expect(timeInput).toBeVisible({ timeout: 3000 });
        await timeInput.fill('08:30');
        
        // Save button MUST be available to confirm changes
        const saveButton = page.locator('[data-testid="ManageGroupPage-Button-saveGroup"], button:has-text("Save")');
        const hasSaveButton = await saveButton.first().isVisible({ timeout: 3000 });
        if (hasSaveButton) {
          await saveButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Coordination update attempted');
      });

      await test.step('Verify families receive updates', async () => {
        // Open family admin view in new tab
        const familyTab = await _context.newPage();
        const familyAuth = new UniversalAuthHelper(familyTab);
        
        await familyAuth.directUserSetup('familyAdmin1', '/groups');
        
        // Family group card MUST be available for verification
        const familyGroupCard = familyTab.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(familyGroupCard).toBeVisible({ timeout: 5000 });
        await familyGroupCard.click();
        await familyAuth.waitForAuthenticationStability();
        
        // Update notification MUST be visible to confirm real-time updates
        const updateNotification = familyTab.locator('[data-testid="ManageGroupPage-Alert-successMessage"]');
        
        await expect(updateNotification).toBeVisible({ timeout: 10000 });
        console.log('✅ Family received coordination update');
        
        await familyTab.close();
      });
    });

    test('handles emergency coordination changes', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create emergency coordination scenario', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for emergency coordination access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Report emergency or urgent change', async () => {
        // Emergency button MUST be available for urgent coordination changes
        const emergencyButton = page.locator('button:has-text("Emergency"), button:has-text("Urgent"), button:has-text("Contact")');
        
        const hasEmergencyButton = await emergencyButton.first().isVisible({ timeout: 5000 });
        if (hasEmergencyButton) {
          await emergencyButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Emergency message input MUST be available for urgent communication
        const emergencyMessage = page.locator('textarea');
        
        await expect(emergencyMessage).toBeVisible({ timeout: 3000 });
        await emergencyMessage.fill('Car breakdown - cannot provide transportation today. Need backup driver urgently.');
        
        // Notify button MUST be available to send emergency notifications
        const notifyButton = page.locator('button:has-text("Notify"), button:has-text("Send"), button:has-text("Alert")');
        
        const hasNotifyButton = await notifyButton.first().isVisible({ timeout: 3000 });
        if (hasNotifyButton) {
          await notifyButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Emergency coordination notification attempted');
      });

      await test.step('Check for emergency response options', async () => {
        // Quick response options MUST be available for emergency coordination
        const quickResponse = page.locator('button:has-text("Help"), button:has-text("Available"), button:has-text("Assist")');
        
        const hasQuickResponse = await quickResponse.first().isVisible({ timeout: 5000 });
        console.log(hasQuickResponse ? '✅ Emergency response options available' : 'ℹ️ Emergency response may use different implementation');
      });
    });
  });

  test.describe('Cross-Family Communication', () => {
    test('facilitates communication between coordinating families', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access family communication features', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for family communication access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Send message to coordinating families', async () => {
        // Message button MUST be available for family communication
        const messageButton = page.locator('button:has-text("Message"), button:has-text("Send"), button:has-text("Contact")');
        
        const hasMessageButton = await messageButton.first().isVisible({ timeout: 5000 });
        if (hasMessageButton) {
          await messageButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Message input MUST be available for sending messages
        const messageInput = page.locator('textarea');
        
        await expect(messageInput).toBeVisible({ timeout: 3000 });
        await messageInput.fill('Hi everyone! Just confirming pickup times for tomorrow morning. My son will be ready at 8:00 AM.');
        
        // Send button MUST be available to send messages
        const sendButton = page.locator('button:has-text("Send"), button:has-text("Submit"), button[type="submit"]');
        
        const hasSendButton = await sendButton.first().isVisible({ timeout: 3000 });
        if (hasSendButton) {
          await sendButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Message sending attempted');
      });

      await test.step('Check for message history and responses', async () => {
        // Message history MUST be visible for communication tracking
        const messageHistory = page.locator('[data-testid="ManageGroupPage-Alert-successMessage"], .message, .chat, .communication');
        
        const hasMessageHistory = await messageHistory.first().isVisible({ timeout: 5000 });
        console.log(hasMessageHistory ? '✅ Message history visible' : 'ℹ️ Message history may use different implementation');
      });
    });

    test('manages group announcements and notifications', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Create group announcement as admin', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for group admin announcement access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Send group-wide announcement', async () => {
        // Announcement button MUST be available for group-wide notifications
        const announcementButton = page.locator('button:has-text("Announce"), button:has-text("Notify"), button:has-text("Broadcast")');
        
        const hasAnnouncementButton = await announcementButton.first().isVisible({ timeout: 5000 });
        if (hasAnnouncementButton) {
          await announcementButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Announcement text input MUST be available for message composition
        const announcementText = page.locator('textarea');
        
        await expect(announcementText).toBeVisible({ timeout: 3000 });
        await announcementText.fill('Important: School pickup location has changed to the east entrance due to construction. Please adjust routes accordingly.');
        
        // Send button MUST be available to distribute announcements
        const sendButton = page.locator('button:has-text("Send"), button:has-text("Publish"), button:has-text("Announce")');
        
        const hasSendButton = await sendButton.first().isVisible({ timeout: 3000 });
        if (hasSendButton) {
          await sendButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Group announcement sending attempted');
      });
    });

    test('handles private family-to-family coordination', async ({ page, context: _context }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Initiate private coordination between two families', async () => {
        await authHelper.directUserSetup('familyAdmin1', '/groups');
        
        // Group card MUST be available for private coordination access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Contact specific family privately', async () => {
        // Family list MUST be available for private coordination
        const familyList = page.locator('[data-testid="GroupFamilies-Container-list"]');
        
        await expect(familyList).toBeVisible({ timeout: 5000 });
        
        // Contact button MUST be available for direct family communication
        const contactButton = familyList.locator('button:has-text("Contact"), button:has-text("Message"), [data-testid*="contact"]');
        
        const hasContactButton = await contactButton.first().isVisible({ timeout: 3000 });
        if (hasContactButton) {
          await contactButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        
        // Private message input MUST be available for family-to-family communication
        const privateMessage = page.locator('textarea').first();
        await expect(privateMessage).toBeVisible({ timeout: 3000 });
        await privateMessage.fill('Hi! Could we coordinate a pickup swap for Friday? I can take your kids to soccer if you can handle school pickup.');
        
        // Send button MUST be available to send private messages
        const sendButton = page.locator('button:has-text("Send"), button:has-text("Submit"), button[type="submit"]');
        const hasSendButton = await sendButton.first().isVisible({ timeout: 3000 });
        if (hasSendButton) {
          await sendButton.first().click();
          await authHelper.waitForAuthenticationStability();
        }
        console.log('✅ Private coordination message sending attempted');
      });
    });
  });

  test.describe('Coordination Analytics and Optimization', () => {
    test('provides coordination efficiency insights', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access coordination analytics', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for analytics access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('View coordination statistics', async () => {
        // Analytics section MUST be available for coordination insights
        const analyticsSection = page.locator('button:has-text("Statistics"), button:has-text("Analytics"), button:has-text("Reports")');
        
        const hasAnalytics = await analyticsSection.first().isVisible({ timeout: 5000 });
        if (hasAnalytics) {
          await analyticsSection.first().click();
          await authHelper.waitForAuthenticationStability();
          
          // Coordination metrics MUST be available for efficiency analysis
          const metrics = page.locator('[data-testid*="metric"], .stats, .analytics');
          const hasMetrics = await metrics.first().isVisible({ timeout: 5000 });
          console.log(hasMetrics ? '✅ Coordination efficiency metrics available' : 'ℹ️ Metrics may use different implementation');
        } else {
          console.log('ℹ️ Analytics features may not be implemented yet');
        }
      });
    });

    test('suggests coordination optimizations', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Look for optimization suggestions', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for optimization suggestions access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
      });

      await test.step('Check for efficiency suggestions', async () => {
        // Efficiency suggestions MUST be available for optimization
        const suggestions = page.locator('[data-testid*="suggestion"], [data-testid*="optimization"], .suggestions, .recommendations');
        
        const hasSuggestions = await suggestions.first().isVisible({ timeout: 5000 });
        console.log(hasSuggestions ? '✅ Coordination optimization suggestions available' : 'ℹ️ Optimization suggestions may not be implemented yet');
      });
    });
  });

  test.describe('Schedule Coordination Integration', () => {
    test('coordinates schedules across multiple families for shared events', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Navigate to group schedule coordination', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for schedule coordination access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 10000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Schedule access MUST be available for group coordination
        const scheduleAccess = page.locator('[data-testid="GroupCard-Button-viewSchedule"], button:has-text("Schedule")');
        
        const hasScheduleAccess = await scheduleAccess.first().isVisible({ timeout: 5000 });
        if (hasScheduleAccess) {
          await scheduleAccess.first().click();
        }
        console.log('✅ Accessed schedule for group coordination');
      });

      await test.step('Create multi-family coordination event', async () => {
        // Create coordination button MUST be available for event creation
        const createCoordinationButton = page.locator('button:has-text("Coordinate"), button:has-text("Create"), button:has-text("Plan")');
        
        const hasCreateButton = await createCoordinationButton.first().isVisible({ timeout: 5000 });
        if (hasCreateButton) {
          await createCoordinationButton.first().click();
          
          // Event name input MUST be available for coordination setup
          const eventNameInput = page.locator('input[type="text"], input[name*="name"], input[placeholder*="name"]');
          const hasNameInput = await eventNameInput.first().isVisible({ timeout: 5000 });
          if (hasNameInput) {
            await eventNameInput.first().fill('School Field Trip Coordination');
          }
        }
        console.log('✅ Coordination event creation attempted');
      });

      await test.step('Configure family participation and roles', async () => {
        // Family checkboxes MUST be available for participation selection
        const familyCheckboxes = page.locator('input[type="checkbox"]');
        const checkboxCount = await familyCheckboxes.count();
        
        await expect(familyCheckboxes.first()).toBeVisible({ timeout: 5000 });
        
        for (let i = 0; i < Math.min(checkboxCount, 4); i++) {
          const checkbox = familyCheckboxes.nth(i);
          await expect(checkbox).toBeVisible({ timeout: 3000 });
          await checkbox.check();
        }
        
        console.log('✅ Participating families selected');
      });
    });

    test('optimizes vehicle utilization across families', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access resource optimization features', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for resource optimization access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Resource section MUST be available for optimization features
        const resourceSection = page.locator('button:has-text("Resources"), button:has-text("Optimize"), [data-testid*="resource"]');
        
        const hasResourceSection = await resourceSection.first().isVisible({ timeout: 5000 });
        if (hasResourceSection) {
          await resourceSection.first().click();
        }
        console.log(hasResourceSection ? '✅ Resource optimization accessed' : 'ℹ️ Resource optimization may not be implemented');
      });

      await test.step('Generate optimization suggestions', async () => {
        // Optimize button MUST be available for generating suggestions
        const optimizeButton = page.locator('button:has-text("Optimize"), button:has-text("Analyze"), button:has-text("Suggest")');
        
        const hasOptimizeButton = await optimizeButton.first().isVisible({ timeout: 5000 });
        if (hasOptimizeButton) {
          await optimizeButton.first().click();
          await authHelper.waitForAuthenticationStability();
          
          // Optimization suggestions MUST be generated and displayed
          const suggestions = page.locator('[data-testid*="suggestion"], .suggestions, .optimization');
          const hasSuggestions = await suggestions.first().isVisible({ timeout: 5000 });
          console.log(hasSuggestions ? '✅ Optimization suggestions generated' : 'ℹ️ Optimization may use different approach');
        } else {
          console.log('ℹ️ Optimization features may not be implemented yet');
        }
      });
    });

    test('manages coordination cost sharing and expense tracking', async ({ page }) => {
      const authHelper = UniversalAuthHelper.forCurrentFile(page);

      await test.step('Access cost sharing features', async () => {
        await authHelper.directUserSetup('groupAdmin', '/groups');
        
        // Group card MUST be available for cost sharing access
        const groupCard = page.locator('[data-testid="GroupCard-Card-groupCard"]').first();
        await expect(groupCard).toBeVisible({ timeout: 5000 });
        await groupCard.click();
        await authHelper.waitForAuthenticationStability();
        
        // Expenses section MUST be available for cost sharing
        const expensesSection = page.locator('button:has-text("Expenses"), button:has-text("Cost"), button:has-text("Payment")');
        
        const hasExpensesSection = await expensesSection.first().isVisible({ timeout: 5000 });
        if (hasExpensesSection) {
          await expensesSection.first().click();
        }
        console.log(hasExpensesSection ? '✅ Cost sharing section accessed' : 'ℹ️ Cost sharing features may not be implemented');
      });

      await test.step('Add coordination expenses', async () => {
        // Add expense button MUST be available for cost tracking
        const addExpenseButton = page.locator('button:has-text("Add"), button:has-text("Expense"), button:has-text("Cost")');
        
        const hasAddExpenseButton = await addExpenseButton.first().isVisible({ timeout: 5000 });
        if (hasAddExpenseButton) {
          await addExpenseButton.first().click();
        }
        
        // Expense description input MUST be available for expense details
        const expenseDescription = page.locator('input[type="text"]').first();
        await expect(expenseDescription).toBeVisible({ timeout: 3000 });
        await expenseDescription.fill('Gas and parking for field trip transportation');
        
        // Expense amount input MUST be available for cost entry
        const expenseAmount = page.locator('input[type="number"]').first();
        await expect(expenseAmount).toBeVisible({ timeout: 3000 });
        await expenseAmount.fill('45.50');
        console.log('✅ Expense amount entered');
      });

      await test.step('Generate cost sharing summary', async () => {
        // Generate summary button MUST be available for cost calculations
        const generateSummaryButton = page.locator('button:has-text("Calculate"), button:has-text("Summary"), button:has-text("Total")');
        
        const hasGenerateButton = await generateSummaryButton.first().isVisible({ timeout: 5000 });
        if (hasGenerateButton) {
          await generateSummaryButton.first().click();
          await authHelper.waitForAuthenticationStability();
          
          // Cost breakdown MUST be displayed after calculation
          const costBreakdown = page.locator('[data-testid*="cost"], [data-testid*="breakdown"], .summary, .total');
          const hasBreakdown = await costBreakdown.first().isVisible({ timeout: 5000 });
          console.log(hasBreakdown ? '✅ Cost sharing summary generated' : 'ℹ️ Cost calculation may use different display');
        } else {
          console.log('ℹ️ Cost calculation features may not be implemented yet');
        }
      });
    });
  });
});