import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Member Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeEach(async () => {
    emailHelper = new E2EEmailHelper();
    await emailHelper.deleteAllEmails();
  });

  test.describe('Adding Family Members', () => {
    test('should invite and add family members', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const recipientEmail = testAuthHelper.getFileSpecificEmail(`recipient.invite.${timestamp}`);

      await test.step('Admin creates account and family', async () => {
        const { email: adminEmail, familyName } = await testAuthHelper.setupAdminUser(
          'admin.invite',
          `Admin Invite ${timestamp}`,
          `Invite Family ${timestamp}`
        );
        console.log(`✅ Admin created: ${adminEmail} with family ${familyName}`);
      });

      await test.step('Navigate to family management and send invitation', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Wait for family page to be fully ready
        await testAuthHelper.waitForFamilyPageReady();

        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');

        await expect(page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', recipientEmail);
        
        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Member' }).click();
        
        // Monitor network requests to see if invitation POST is sent
        const responsePromise = page.waitForResponse(response => 
          response.url().includes('/invite') && response.request().method() === 'POST', 
        { timeout: 10000 }
        ).catch(() => null);
        
        console.log('🔄 Clicking send invitation button...');
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-sendInvitation"]');
        
        console.log('✅ Send invitation button clicked, waiting for response...');
        
        // Check if POST request was made
        const response = await responsePromise;
        if (response) {
          console.log(`✅ POST request sent to: ${response.url()}, status: ${response.status()}`);
          if (response.status() >= 400) {
            const responseText = await response.text().catch(() => 'Could not read response');
            console.log(`❌ Invitation request failed: ${responseText}`);
          }
        } else {
          console.log('❌ No POST request to /invite detected - frontend issue!');
        }
        
        // Wait for UI to update after invitation is sent - look for the pending invitation to appear
        await page.waitForFunction(() => {
          const pendingInvitationElement = document.querySelector('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]');
          const pendingBadge = document.querySelector('[data-testid="InvitationManagement-Badge-pendingInvitationRole"]');
          return pendingInvitationElement || pendingBadge;
        }, { timeout: 10000 });
        
        console.log('✅ Pending invitation UI element found - invitation was processed successfully');
      });

      await test.step('Verify member list and roles', async () => {
        await expect(page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]')).toBeVisible();

        // PREVENT SILENT FAILURE: Use exact test ID prefix
        const adminMember = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' }).first();
        await expect(adminMember).toBeVisible();

        const pendingInvitation = page.locator('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]').filter({ hasText: recipientEmail });
        await expect(pendingInvitation).toBeVisible({ timeout: 5000 });
        console.log('✅ Pending invitation displayed in member list');

        console.log('✅ Family member list displays correctly');
      });

      await test.step('Member accepts invitation and joins', async () => {
        // Wait for invitation email and extract URL
        const invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail, { timeoutMs: 30000 });
        expect(invitationUrl).not.toBeNull();

        if (!invitationUrl) {
          // Fallback to the original method
          invitationUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
        }
        const invitationEmail = recipientEmail;
        
        // Use isolated browser context to prevent auth contamination
        const memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();
        const memberAuth = new UniversalAuthHelper(memberPage);
        
        // Enhanced invitation acceptance - supports direct email
        await memberAuth.acceptInvitation(invitationUrl!, invitationEmail);
        
        console.log('✅ New member successfully joined family');
        await memberContext.close();
      });
    });

    test('should enforce admin requirements', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create admin with family', async () => {
        const { email: adminEmail, familyName } = await testAuthHelper.setupAdminUser(
          'admin.enforce',
          `Admin Enforce ${timestamp}`,
          `Enforce Family ${timestamp}`
        );
        console.log(`✅ Admin created: ${adminEmail} with family ${familyName}`);
      });

      await test.step('Navigate to family management and verify admin access', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });
        
        await expect(page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]')).toBeVisible({ timeout: 15000 });
        
        // Wait explicitly for admin permissions to be loaded
        console.log('Waiting for admin permissions to be loaded...');
        await page.waitForFunction(() => {
          // Check if admin-only elements are present
          const inviteButton = document.querySelector('[data-testid="InvitationManagement-Button-inviteMember"]');
          // PREVENT SILENT FAILURE: Use exact test ID prefix
          const memberCards = document.querySelectorAll('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
          
          console.log('Admin permission elements check:', {
            inviteButtonVisible: !!inviteButton,
            memberCardCount: memberCards.length
          });
          
          // Admin should see invite button and at least one member card (themselves)
          return inviteButton && memberCards.length > 0;
        }, { timeout: 15000 });
        
        console.log('✅ Admin has access to family member management with proper permissions');
      });

      await test.step('Verify family has admin users', async () => {
        // PREVENT SILENT FAILURE: Use exact test ID prefix
        const adminMember = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' }).first();
        await expect(adminMember).toBeVisible();
        
        console.log('✅ Family has admin users present');
      });
    });
  });

  test.describe('Removing Family Members', () => {
    test('should allow admin to remove regular members', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const memberEmail = testAuthHelper.getFileSpecificEmail(`member.remove.${timestamp}`);
      let invitationUrl: string | null = null;
      let adminEmail: string;

      await test.step('Setup: Admin creates account and family', async () => {
        const result = await testAuthHelper.setupAdminUser(
          'admin.remove',
          `Admin Remove ${timestamp}`,
          `Remove Family ${timestamp}`
        );
        adminEmail = result.email;
      });

      await test.step('Setup: Admin invites member', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Wait for family page to be fully ready
        await testAuthHelper.waitForFamilyPageReady();

        // Send invitation
        const inviteButton = page.locator('[data-testid="InvitationManagement-Button-inviteMember"]');
        await expect(inviteButton).toBeVisible({ timeout: 5000 });
        await inviteButton.click();

        const emailInput = page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]');
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(memberEmail);
        await expect(emailInput).toHaveValue(memberEmail);

        const sendButton = page.locator('[data-testid="InvitationManagement-Button-sendInvitation"]');
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for invitation email
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();

        // Member joins family using isolated browser context to prevent auth contamination
        const memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();
        const memberAuth = new UniversalAuthHelper(memberPage);
        await memberAuth.acceptInvitation(invitationUrl!, memberEmail);
        await memberContext.close(); // Close entire context to ensure complete isolation
        console.log('✅ Member successfully joined family for removal test');
      });

      await test.step('Admin removes the member', async () => {
        // Navigate to family management page first
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        console.log('✅ Navigated to family management page');

        // Wait for page to refresh and show updated member list
        // Give more time for the new member to appear in the list
        console.log('Waiting for family member list to update with new member...');

        // Wait for the family data to be updated with retry logic
        let retries = 0;
        let memberCount = 0;
        while (retries < 10) {
          const memberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
          memberCount = await memberCards.count();
          console.log(`Attempt ${retries + 1}/10: Family member count: ${memberCount}`);
          if (memberCount >= 2) {
            console.log('✅ New member appeared in list!');
            break;
          }
          // Wait for member list to update
          await page.waitForResponse(response => response.url().includes('/family') && response.request().method() === 'GET', { timeout: 5000 }).catch(() => {});
          retries++;
        }

        if (memberCount < 2) {
          throw new Error(`New member never appeared in family list. Final count: ${memberCount}`);
        }

        // Admin menu buttons should be visible since we are the admin
        const memberMenuButton = page.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]').first();
        await expect(memberMenuButton).toBeVisible({
          timeout: 15000
        });
        console.log('✅ Admin permission controls loaded successfully');

        const finalMemberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
        const finalMemberCount = await finalMemberCards.count();

        expect(finalMemberCount).toBeGreaterThan(1);
        console.log(`Found ${finalMemberCount} member cards to check`);

        // Find the first non-admin member card and remove it
        let memberRemoved = false;
        for (let i = 0; i < finalMemberCount; i++) {
          const memberCard = finalMemberCards.nth(i);
          const memberText = await memberCard.textContent();
          console.log(`Member card ${i}: ${memberText}`);

          if (memberText?.includes(adminEmail)) {
            console.log('Skipping admin user');
            continue; // Skip admin user
          }

          // Look for the member menu button using exact test ID prefix
          const memberMenuButton = memberCard.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]');
          await expect(memberMenuButton).toBeVisible({ timeout: 5000 });
          console.log('Found member menu button, opening dropdown');
          await memberMenuButton.click();

          // Wait for dropdown to appear and then click remove button using exact test ID prefix
          const removeButton = page.locator('[data-testid^="ManageFamilyPage-Button-removeMember-"]').first();
          await expect(removeButton).toBeVisible({ timeout: 5000 });
          console.log('Clicking remove button for non-admin member');
          await removeButton.click();

          // Wait for confirmation dialog using exact test ID
          const confirmDialog = page.locator('[data-testid="ManageFamilyPage-Modal-removeMemberConfirm"]');
          await expect(confirmDialog).toBeVisible({ timeout: 5000 });
          console.log('Confirmation dialog appeared, confirming removal');

          // PREVENT SILENT FAILURE: Use exact test ID for confirm button
          const confirmButton = page.locator('[data-testid="ManageFamilyPage-Button-confirmRemoveMember"]');
          await expect(confirmButton).toBeVisible({ timeout: 5000 });
          await confirmButton.click();
          console.log('✅ Member removal confirmed');
          memberRemoved = true;

          // Wait for dialog to close and backend to process
          await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
          break;
        }
        
        expect(memberRemoved).toBe(true);

        console.log('✅ Family member removed successfully');
      });

      await test.step('Verify member no longer in family', async () => {
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="ManageFamilyPage-List-familyMembers"]')).toBeVisible({ timeout: 15000 });

        // Check all member cards after removal
        const allMemberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
        const currentMemberCount = await allMemberCards.count();
        console.log(`After removal, found ${currentMemberCount} member cards`);
        
        for (let i = 0; i < currentMemberCount; i++) {
          const cardText = await allMemberCards.nth(i).textContent();
          console.log(`Remaining member card ${i}: ${cardText}`);
        }

        const removedMemberCard = page.locator(`[data-testid="ManageFamilyPage-Card-familyMember-${memberEmail}"]`);
        // Removed member should no longer be visible
        await expect(removedMemberCard).not.toBeVisible();
        console.log('✅ Removed member no longer appears in family list');
      });
    });

    test('should prevent removal of last admin', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Setup: Create sole admin with family', async () => {
        await testAuthHelper.setupAdminUser(
          'soleadmin',
          `Sole Admin ${timestamp}`,
          `Sole Admin Family ${timestamp}`
        );

        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
        console.log('✅ Setup completed - sole admin family');
      });

      await test.step('Verify last admin cannot be removed', async () => {
        // Use prefix selector to find admin member card
        const adminMemberCard = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' }).first();
        await expect(adminMemberCard).toBeVisible();

        // Try to access member menu for admin
        const memberMenuButton = adminMemberCard.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]');
        await expect(memberMenuButton).toBeVisible({ timeout: 5000 });
        await memberMenuButton.click();
        
        // Wait for dropdown to open
        await testAuthHelper.waitForPageTransition();
        
        const removeButton = page.locator('[data-testid^="ManageFamilyPage-Button-removeMember-"]').first();
        
        const isRemoveButtonVisible = await removeButton.isVisible();
        if (isRemoveButtonVisible) {
          await removeButton.click();

          // Wait for confirmation dialog
          const confirmDialog = page.locator('[data-testid="ManageFamilyPage-Modal-removeMemberConfirm"]');
          await expect(confirmDialog).toBeVisible({ timeout: 5000 });

          // Click confirm to trigger the backend error
          const confirmButton = page.locator('[data-testid="ManageFamilyPage-Button-confirmRemoveMember"]');
          await expect(confirmButton).toBeVisible({ timeout: 5000 });
          await confirmButton.click();

          // Wait for the dialog to close and check result
          await testAuthHelper.waitForPageTransition();

          // Check for error messages (which indicate proper prevention)
          const lastAdminError = page.locator('[data-testid="ManageFamilyPage-Alert-lastAdminError"]');
          const generalError = page.locator('[data-testid="ManageFamilyPage-Alert-errorMessage"]');
          const successMessage = page.locator('[data-testid="ManageFamilyPage-Alert-successMessage"]');

          const hasLastAdminError = await lastAdminError.isVisible();
          const hasGeneralError = await generalError.isVisible();
          const hasSuccessMessage = await successMessage.isVisible();

          if (hasLastAdminError) {
            console.log('✅ Last admin removal prevented with specific error');
          } else if (hasGeneralError) {
            console.log('✅ Last admin removal prevented with general error');
          } else if (hasSuccessMessage) {
            // This shouldn't happen for last admin - but let's verify the admin is still there
            console.log('⚠️ Success message shown - checking if admin was actually removed');
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Wait for the family management page to be fully loaded
            await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 10000 });

            const stillAdminCard = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' }).first();
            const isStillThere = await stillAdminCard.isVisible();

            if (isStillThere) {
              console.log('✅ Last admin is still present despite success message (backend prevented)');
            } else {
              throw new Error('❌ Last admin was actually removed - this should not happen!');
            }
          } else {
            // No messages at all - check if admin is still present
            console.log('📝 No error/success messages - checking admin presence');
            const stillAdminCard = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]').filter({ hasText: 'ADMIN' }).first();
            await expect(stillAdminCard).toBeVisible({ timeout: 5000 });
            console.log('✅ Last admin is still present (silent prevention)');
          }
        } else {
          // Remove button not available (UI prevention) - this is already sufficient proof
          console.log('✅ Remove button not available for last admin (UI prevention)');
        }
      });
    });

    test('should allow multiple admins scenario', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const secondAdminEmail = testAuthHelper.getFileSpecificEmail(`secondadmin.multi.${timestamp}`);
      let invitationUrl: string | null = null;

      await test.step('Setup: First admin creates account and family', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.multi',
          `Multi Admin ${timestamp}`,
          `Multi Admin Family ${timestamp}`
        );
      });

      await test.step('Setup: First admin invites second admin', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Wait for family page to be fully ready
        await testAuthHelper.waitForFamilyPageReady();

        // Send invitation to second admin
        await page.click('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', secondAdminEmail);

        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Admin' }).click();

        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');

        // Wait for invitation email
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(secondAdminEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();

        // Second admin joins using isolated browser context to prevent auth contamination
        const adminContext = await _context.browser()!.newContext();
        const adminPage = await adminContext.newPage();
        const adminAuth = new UniversalAuthHelper(adminPage);

        // Enhanced invitation acceptance - supports direct email
        await adminAuth.acceptInvitation(invitationUrl!, secondAdminEmail);

        await adminContext.close();
        console.log('✅ Second admin successfully joined family');
      });

      await test.step('Verify two admins can manage each other', async () => {
        // Navigate to family management page first
        await page.goto('/family/manage');
        await page.waitForLoadState('networkidle');
        console.log('✅ Navigated to family management page');

        // Wait for family page to be fully loaded
        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 10000 });

        // Use prefix selector to find all family member cards
        const allMemberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
        const memberCount = await allMemberCards.count();

        // Count admins by looking for ADMIN text in member cards
        const adminCards = allMemberCards.filter({ hasText: 'ADMIN' });
        const adminCount = await adminCards.count();
        console.log(`🔍 Total members found: ${memberCount}`);

        for (let i = 0; i < memberCount; i++) {
          const memberCard = allMemberCards.nth(i);
          const memberText = await memberCard.textContent();
          console.log(`🔍 Member ${i + 1}: ${memberText}`);
        }

        console.log(`🔍 Admin cards found: ${adminCount}`);
        expect(adminCount).toBeGreaterThanOrEqual(2);

        console.log('✅ Multiple admins successfully configured');
      });
    });
  });

  test.describe('Role Management', () => {
    test('should manage member roles', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create admin with family', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.role',
          `Admin Role ${timestamp}`,
          `Role Family ${timestamp}`
        );
      });

      await test.step('Navigate to family management and verify role management interface', async () => {
        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        const memberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
        const memberCount = await memberCards.count();

        // For a single admin family, there should be at least the admin card
        if (memberCount >= 1) {
          // Check that admin card has role management actions (even if they can't be used on themselves)
          const adminCard = memberCards.filter({ hasText: 'ADMIN' }).first();
          await expect(adminMemberCard).toBeVisible();

          const actionsButton = adminCard.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]');
          await expect(actionsButton).toBeVisible({ timeout: 5000 });
          await actionsButton.click();

          // Verify role toggle button exists (it might be disabled for the last admin)
          const roleToggle = page.locator('[data-testid^="ManageFamilyPage-Button-roleToggle-"]').first();
          await expect(roleToggle).toBeVisible({ timeout: 5000 });
          console.log('✅ Member role management actions available');
          await page.keyboard.press('Escape');
        }

        console.log('✅ Family member role management interface verified');
      });
    });
  });

  test.describe('Resource Management', () => {
    test('should manage family children', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create admin with family', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.child',
          `Admin Child ${timestamp}`,
          `Child Family ${timestamp}`
        );
      });

      await test.step('Add child to family', async () => {
        // Navigate to children page
        await page.goto('/children');
        await page.waitForLoadState('networkidle');

        // Wait for children page to be ready
        await expect(page.locator('[data-testid="ChildrenPage-Button-addChild"]')).toBeVisible({ timeout: 20000 });
        await page.click('[data-testid="ChildrenPage-Button-addChild"]');

        await expect(page.locator('[data-testid="ChildrenPage-Input-childName"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="ChildrenPage-Input-childName"]', 'E2E Test Child');

        const ageInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
        await expect(ageInput).toBeVisible({ timeout: 5000 });
        await ageInput.fill('8');

        await page.click('[data-testid="ChildrenPage-Button-submitChild"]');
        await expect(page.locator('[data-testid="ChildrenPage-Modal-childForm"]')).not.toBeVisible({ timeout: 10000 });

        // Wait for child to appear in list
        await expect(page.locator('[data-testid^="ChildrenPage-Text-childName-"]')).toBeVisible({ timeout: 5000 });

        console.log('✅ Child added to family successfully');
      });

      await test.step('Verify child belongs to family', async () => {
        // Reload page to see updated children list
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Debug: log current URL and page content
        console.log('Current URL:', page.url());
        const pageContent = await page.textContent('body');
        console.log('Page contains "E2E Test Child":', pageContent.includes('E2E Test Child'));

        // Use the specific test ID - child name in card
        const childNameInCard = page.locator('[data-testid^="ChildrenPage-Text-childName-"]');
        await expect(childNameInCard).toBeVisible({ timeout: 10000 });
        console.log('✅ Child appears in the children list via card title');

        // Also verify the child name text matches
        const childText = await childNameInCard.textContent();
        expect(childText).toContain('E2E Test Child');
        console.log('✅ Child name matches expected value');

        console.log('✅ Child belongs to family');
      });
    });

    test('should manage family vehicles', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();

      await test.step('Create admin with family', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.vehicle',
          `Admin Vehicle ${timestamp}`,
          `Vehicle Family ${timestamp}`
        );
      });

      await test.step('Add vehicle to family', async () => {
        // Navigate to vehicles page
        await page.goto('/vehicles');
        await page.waitForLoadState('networkidle');

        // Wait for vehicles page to be ready
        await expect(page.getByRole('heading', { name: 'Vehicles' }).first()).toBeVisible({ timeout: 20000 });
        await page.click('[data-testid="VehiclesPage-Button-addVehicle"]');

        await expect(page.locator('[data-testid="VehiclesPage-Input-vehicleName"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="VehiclesPage-Input-vehicleName"]', 'E2E Family Car');
        await page.fill('[data-testid="VehiclesPage-Input-vehicleCapacity"]', '5');

        await page.click('[data-testid="VehiclesPage-Button-submitVehicle"]');

        // Wait for modal to close and vehicle to appear
        await expect(page.locator('[data-testid="VehiclesPage-Modal-vehicleForm"]')).not.toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]')).toBeVisible({ timeout: 5000 });

        console.log('✅ Vehicle added to family successfully');
      });

      await test.step('Verify vehicle belongs to family', async () => {
        // Reload page to see updated vehicles list
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Look for vehicle name using correct testid pattern
        const vehicleName = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').first();
        await expect(vehicleName).toBeVisible({ timeout: 10000 });

        const vehicleText = await vehicleName.textContent();
        expect(vehicleText).toContain('E2E Family Car');
        console.log('✅ Vehicle belongs to family');
      });

      await test.step('Admin can view vehicles', async () => {
        // Verify admin (who is also a family member) can access vehicles
        await page.goto('/vehicles');
        await page.waitForLoadState('networkidle');

        // Verify vehicles are accessible
        await expect(page.getByRole('heading', { name: 'Vehicles' }).first()).toBeVisible({ timeout: 20000 });

        // Verify the vehicle we just added is visible
        const vehicleName = page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').first();
        await expect(vehicleName).toBeVisible({ timeout: 10000 });

        const vehicleText = await vehicleName.textContent();
        expect(vehicleText).toContain('E2E Family Car');

        console.log('✅ Admin can view family vehicles');
      });
    });

    test('should allow members (MEMBER role) to view family vehicles', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page);
      const timestamp = Date.now();
      const memberEmail = testAuthHelper.getFileSpecificEmail(`member.vehicle.${timestamp}`);
      let invitationUrl: string | null = null;

      await test.step('Setup: Admin creates family and adds vehicle', async () => {
        await testAuthHelper.setupAdminUser(
          'admin.member.vehicle',
          `Admin Member Vehicle ${timestamp}`,
          `Member Vehicle Family ${timestamp}`
        );

        // Add a vehicle
        await page.goto('/vehicles');
        await page.waitForLoadState('networkidle');

        await page.click('[data-testid="VehiclesPage-Button-addVehicle"]');
        await expect(page.locator('[data-testid="VehiclesPage-Input-vehicleName"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="VehiclesPage-Input-vehicleName"]', 'Test Vehicle');
        await page.fill('[data-testid="VehiclesPage-Input-vehicleCapacity"]', '5');

        await page.click('[data-testid="VehiclesPage-Button-submitVehicle"]');

        // Wait for modal to close and vehicle to be added
        await expect(page.locator('[data-testid="VehiclesPage-Modal-vehicleForm"]')).not.toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]')).toBeVisible({ timeout: 5000 });

        console.log('✅ Admin created family and added vehicle');
      });

      await test.step('Admin invites member with MEMBER role', async () => {
        // Navigate to dashboard first
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Navigate to family management
        const manageButton = page.getByRole('button', { name: 'Manage Family', exact: true });
        await manageButton.waitFor({ state: 'visible', timeout: 5000 });
        await manageButton.click();
        await page.waitForURL('/family/manage', { timeout: 10000 });

        // Invite member with MEMBER role
        await page.click('[data-testid="InvitationManagement-Button-inviteMember"]');

        await expect(page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', memberEmail);

        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Member' }).click();

        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');

        // Wait for invitation email
        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail, { timeoutMs: 30000 });
        expect(invitationUrl).toBeTruthy();

        console.log('✅ Member invited with MEMBER role');
      });

      await test.step('Member (MEMBER role) accepts invitation and can view vehicles', async () => {
        // Member accepts invitation in isolated context
        const memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();
        const memberAuth = new UniversalAuthHelper(memberPage);

        await memberAuth.acceptInvitation(invitationUrl!, memberEmail);

        // Verify member can access vehicles
        await memberPage.goto('/vehicles');
        await memberPage.waitForLoadState('networkidle');

        // Verify vehicles page is accessible
        await expect(memberPage.getByRole('heading', { name: 'Vehicles' }).first()).toBeVisible({ timeout: 20000 });

        // Verify the vehicle is visible
        const vehicleName = memberPage.locator('[data-testid^="VehiclesPage-Text-vehicleName-"]').first();
        await expect(vehicleName).toBeVisible({ timeout: 10000 });

        const vehicleText = await vehicleName.textContent();
        expect(vehicleText).toContain('Test Vehicle');

        console.log('✅ Member (MEMBER role) can view family vehicles');

        await memberContext.close();
      });
    });
  });
});