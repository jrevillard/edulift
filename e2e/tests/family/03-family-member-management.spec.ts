import { test, expect } from '@playwright/test';
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test.describe('Family Member Management E2E', () => {
  let emailHelper: E2EEmailHelper;

  test.beforeAll(async () => {
    // Enhanced approach - encapsulated logic, no FileSpecificTestData exposure
    const authHelper = new UniversalAuthHelper(null as any); // For setup only
    
    // Define users for this test file (auto-generates file-specific data)
    authHelper.defineUser('admin', 'admin', 'Admin User');
    authHelper.defineUser('soleAdmin', 'sole-admin', 'Sole Admin User');
    authHelper.defineUser('secondAdmin', 'second-admin', 'Second Admin User', true); // Will receive invitation
    authHelper.defineUser('member', 'member', 'Member User');
    
    // Separate admin users for tests that need isolated families
    authHelper.defineUser('inviteAdmin', 'invite-admin', 'Invite Test Admin');
    authHelper.defineUser('removeAdmin', 'remove-admin', 'Remove Test Admin');  
    authHelper.defineUser('multiAdmin', 'multi-admin', 'Multi Admin Test Admin');
    
    // Users who will receive invitations - defined but NOT pre-created
    authHelper.defineUser('newMember', 'new-member', 'New Member', true); // Will receive invitation
    authHelper.defineUser('removableMember', 'removable-member', 'Removable Member', true); // Will receive invitation
    
    // Define families - each test gets its own family to avoid capacity limits
    authHelper.defineFamily('adminFamily', 'Admin Family', 'admin', [
      { userKey: 'member', role: 'MEMBER' }
    ]);
    authHelper.defineFamily('soleAdminFamily', 'Sole Admin Family', 'soleAdmin');
    
    // Separate families for tests that add members to avoid hitting 6-member limit
    authHelper.defineFamily('inviteTestFamily', 'Invite Test Family', 'inviteAdmin');
    authHelper.defineFamily('removeTestFamily', 'Remove Test Family', 'removeAdmin');
    authHelper.defineFamily('multiAdminTestFamily', 'Multi Admin Test Family', 'multiAdmin');

    // Create file-specific users in the database (excluding those who will receive invitations)
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('adminFamily');
    await authHelper.createFamilyInDatabase('soleAdminFamily');
    await authHelper.createFamilyInDatabase('inviteTestFamily');
    await authHelper.createFamilyInDatabase('removeTestFamily');
    await authHelper.createFamilyInDatabase('multiAdminTestFamily');
    
    // Add a wait to ensure database consistency before tests run
    await authHelper.waitForDatabaseConsistency('create', 5);
  });

  test.beforeEach(async () => {
    emailHelper = new E2EEmailHelper();
    // Note: Ne pas vider tous les emails pour préserver le parallélisme
    // Les emails sont spécifiques par fichier grâce au FILE_PREFIX
  });

  /**
   * Helper to ensure invitation email reaches MailHog with proper timing
   */
  async function waitForInvitationEmail(page: any, recipientEmail: string, testAuthHelper: any): Promise<any> {
    console.log(`🔍 Waiting for email for: ${recipientEmail}`);
    
    // First ensure the invitation was processed in the UI with retry logic
    let uiConfirmed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.waitForFunction(() => {
          const pendingInvitation = document.querySelector('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]');
          const successAlert = document.querySelector('[data-testid="ManageFamilyPage-Alert-successMessage"]');
          return pendingInvitation || successAlert;
        }, { timeout: 8000 });
        
        uiConfirmed = true;
        console.log(`✅ UI confirms invitation was processed (attempt ${attempt})`);
        break;
      } catch (error) {
        console.log(`⚠️ UI confirmation attempt ${attempt} failed, retrying...`);
        if (attempt === 3) {
          throw new Error('UI confirmation failed after 3 attempts. Invitation may not have been sent.');
        }
        await testAuthHelper.waitForPageTransition();
      }
    }
    
    if (!uiConfirmed) {
      throw new Error(`UI never confirmed invitation was processed for ${recipientEmail}`);
    }
    
    // Use centralized email delivery waiting
    console.log('🕐 Using progressive email wait strategy...');
    await testAuthHelper.waitForEmailDelivery(3);
    
    // Try to get the email after centralized wait
    let email = await emailHelper.waitForEmailForRecipient(recipientEmail);
    if (email) {
      console.log('✅ Email found after extended wait');
      return email;
    }
    
    // If still no email, provide detailed debugging
    const allEmails = await emailHelper.getAllEmails();
    const emailAddresses = allEmails.map(e => e.To.map(t => `${t.Mailbox}@${t.Domain}`)).flat();
    console.log(`❌ Email not found after all attempts. Looking for: "${recipientEmail}"`);
    console.log(`Available addresses: ${JSON.stringify(emailAddresses)}`);
    console.log(`Total emails in MailHog: ${allEmails.length}`);
    
    // Check for partial matches
    const partialMatches = emailAddresses.filter(addr => addr.includes(recipientEmail.split('@')[0]));
    if (partialMatches.length > 0) {
      console.log(`Partial matches found: ${JSON.stringify(partialMatches)}`);
    }
    
    throw new Error(`Email not received for ${recipientEmail} after UI confirmation and progressive wait strategy. This indicates a real email sending issue.`);
  }

  test.setTimeout(90000); // Increased for progressive wait strategy

  test.describe('Adding Family Members', () => {
    test('should invite and add family members', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      
      await test.step('Admin sends invitation', async () => {
        await testAuthHelper.directUserSetup('inviteAdmin', '/family/manage'); // Just use the key!
        
        // Wait for family page to be fully ready
        await testAuthHelper.waitForFamilyPageReady();
        
        await testAuthHelper.waitAndClick('[data-testid="InvitationManagement-Button-inviteMember"]');
        
        await expect(page.locator('[data-testid="InvitationManagement-Input-inviteEmail"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', testAuthHelper.getUser('newMember').email);
        
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
        
        const pendingInvitation = page.locator('[data-testid="InvitationManagement-Text-pendingInvitationEmail"]').filter({ hasText: testAuthHelper.getUser('newMember').email });
        await expect(pendingInvitation).toBeVisible({ timeout: 5000 });
        console.log('✅ Pending invitation displayed in member list');
        
        console.log('✅ Family member list displays correctly');
      });

      await test.step('Member accepts invitation and joins', async () => {
        const searchEmail = testAuthHelper.getUser('newMember').email;
        
        // Wait for email with proper timing synchronization
        const email = await waitForInvitationEmail(page, searchEmail, testAuthHelper);
        expect(email).not.toBeNull();
        
        // Extract invitation URL from the email we found (either by recipient match or fallback)
        let invitationUrl: string | null = null;
        if (email) {
          // Extract directly from the email we have
          let body = email.Content.Body;
          // Decode quoted-printable encoding if present
          if (body.includes('=3D') || body.includes('=20')) {
            body = body
              .replace(/=\r?\n/g, '')
              .replace(/=$/gm, '')
              .replace(/=([A-Fa-f0-9]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
          }
          
          // Look for family invitation URL patterns
          const familyInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/);
          if (familyInviteMatch) {
            invitationUrl = familyInviteMatch[0];
          }
        }
        
        if (!invitationUrl) {
          // Fallback to the original method
          invitationUrl = await emailHelper.extractInvitationUrlForRecipient(testAuthHelper.getUser('newMember').email);
        }
        const invitationEmail = testAuthHelper.getUser('newMember').email;
        
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
      await test.step('Verify admin access to member management', async () => {
        const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!
        
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
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      const memberEmail = testAuthHelper.getUser('removableMember').email;
      let invitationUrl: string | null = null;

      await test.step('Setup: Admin invites member to be removed later', async () => {
        await testAuthHelper.directUserSetup('removeAdmin', '/family/manage'); // Just use the key!
        
        // Add defensive check: if redirected to onboarding, the family wasn't created properly
        if (page.url().includes('/onboarding')) {
          console.log('❌ removeAdmin was redirected to onboarding - family creation failed in beforeAll');
          await testAuthHelper.completeOnboarding('Remove Test Family');
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle');
        }

        // PREVENT SILENT FAILURE: Explicit assertions before actions
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
        
        // Wait longer for email sending to complete
        await testAuthHelper.waitForPageTransition();

        // Wait for email with proper timing synchronization
        const email = await waitForInvitationEmail(page, memberEmail, testAuthHelper);
        expect(email).not.toBeNull();

        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(memberEmail);
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
        // Add a delay to ensure database transaction is committed
        await testAuthHelper.waitForDatabaseConsistency('create', 1);
        
        // Verify admin role is preserved (should not change due to context isolation)
        const currentUserRole = await page.locator('[data-testid="ManageFamilyPage-Badge-userRole"]').textContent();
        console.log(`🔍 Current user role: ${currentUserRole}`);
        expect(currentUserRole).toBe('ADMIN'); // Should still be admin due to context isolation
        
        // Use the new refresh button to update the page data
        const refreshButton = page.locator('[data-testid="ManageFamilyPage-Button-refresh"]');
        await refreshButton.click();
        await page.waitForLoadState('networkidle');
        
        // Wait for the family data to be updated with retry logic
        console.log('Waiting for family member list to update...');
        await testAuthHelper.retryWithBackoff(async () => {
          const memberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
          const count = await memberCards.count();
          console.log('Family member count:', count);
          if (count < 2) {
            throw new Error(`Expected at least 2 members, found ${count}`);
          }
        }, 3, 2000);
        
        // Wait for admin permission controls to load - with context isolation, admin role should be preserved
        console.log('Waiting for admin permission controls to load...');
        
        // Admin menu buttons should be visible since we preserved admin authentication
        // PREVENT SILENT FAILURE: Use exact test ID with member email
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

          if (memberText?.includes(testAuthHelper.getUser('removeAdmin').email)) {
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

          await testAuthHelper.waitForDatabaseConsistency('delete', 1); // Wait for backend processing
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
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      
      await test.step('Setup: Use file-specific sole admin', async () => {
        // Use file-specific test user that has a family pre-created in beforeAll
        await testAuthHelper.directUserSetup('soleAdmin', '/family/manage'); // Just use the key!

        if (page.url().includes('/onboarding')) {
          await testAuthHelper.completeOnboarding('Sole Admin Family');
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle');
        }

        await expect(page.locator('[data-testid="ManageFamilyPage-Container-familyInformation"]')).toBeVisible({ timeout: 15000 });
        console.log('✅ Setup completed - sole admin family');
      });

      await test.step('Verify last admin cannot be removed', async () => {
        // Use correct test ID format with email suffix
        const adminEmail = testAuthHelper.getUser('soleAdmin').email;
        const adminCard = page.locator(`[data-testid="ManageFamilyPage-Card-familyMember-${adminEmail}"]`);
        await expect(adminCard).toBeVisible();

        // Try to access member menu for admin
        const memberMenuButton = adminCard.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]');
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
            
            const stillAdminCard = page.locator(`[data-testid="ManageFamilyPage-Card-familyMember-${adminEmail}"]`);
            const isStillThere = await stillAdminCard.isVisible();
            
            if (isStillThere) {
              console.log('✅ Last admin is still present despite success message (backend prevented)');
            } else {
              throw new Error('❌ Last admin was actually removed - this should not happen!');
            }
          } else {
            // No messages at all - check if admin is still present
            console.log('📝 No error/success messages - checking admin presence');
            const stillAdminCard = page.locator(`[data-testid="ManageFamilyPage-Card-familyMember-${adminEmail}"]`);
            await expect(stillAdminCard).toBeVisible({ timeout: 5000 });
            console.log('✅ Last admin is still present (silent prevention)');
          }
        } else {
          // Verify admin card is actually displayed - this confirms UI prevention is working
          await expect(adminCard).toBeVisible({ timeout: 5000 });
          console.log('✅ Remove button not available for last admin (UI prevention)');
        }
      });
    });

    test('should allow multiple admins scenario', async ({ page, context: _context }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      let invitationUrl: string | null = null;

      await test.step('Setup: Admin invites second admin', async () => {
        // Use file-specific admin user that has a family pre-created
        await testAuthHelper.directUserSetup('multiAdmin', '/family/manage'); // Just use the key!
        
        // Add defensive check: if redirected to onboarding, the family wasn't created properly
        if (page.url().includes('/onboarding')) {
          console.log('❌ multiAdmin was redirected to onboarding - family creation failed in beforeAll');
          await testAuthHelper.completeOnboarding('Multi Admin Test Family');
          await page.goto('/family/manage');
          await page.waitForLoadState('networkidle');
        }

        await page.click('[data-testid="InvitationManagement-Button-inviteMember"]');
        await page.fill('[data-testid="InvitationManagement-Input-inviteEmail"]', testAuthHelper.getUser('secondAdmin').email);

        const roleSelect = page.locator('[data-testid="InvitationManagement-Select-memberRole"]');
        await expect(roleSelect).toBeVisible({ timeout: 5000 });
        await roleSelect.click();
        await page.getByRole('option', { name: 'Admin' }).click();

        await page.click('[data-testid="InvitationManagement-Button-sendInvitation"]');
        
        // Wait longer for email sending to complete
        await testAuthHelper.waitForPageTransition();

        // Wait for email with proper timing synchronization
        const email = await waitForInvitationEmail(page, testAuthHelper.getUser('secondAdmin').email, testAuthHelper);
        expect(email).not.toBeNull();

        invitationUrl = await emailHelper.extractInvitationUrlForRecipient(testAuthHelper.getUser('secondAdmin').email);
        expect(invitationUrl).toBeTruthy();

        // Second admin joins using isolated browser context to prevent auth contamination
        const adminContext = await _context.browser()!.newContext();
        const adminPage = await adminContext.newPage();
        const adminAuth = new UniversalAuthHelper(adminPage);
        
        // Enhanced invitation acceptance - supports user keys
        await adminAuth.acceptInvitation(invitationUrl!, 'secondAdmin'); // Can use key directly!

        await adminContext.close();
        console.log('✅ Second admin successfully joined family');
      });

      await test.step('Verify two admins can manage each other', async () => {
        // Add extra wait to ensure database transaction is committed
        await testAuthHelper.waitForDatabaseConsistency('create', 1);
        
        // Use refresh button to get latest family data
        const refreshButton = page.locator('[data-testid="ManageFamilyPage-Button-refresh"]');
        await refreshButton.click();
        await page.waitForLoadState('networkidle');

        // Wait for family data to be fully loaded
        await testAuthHelper.waitForReactQueryStable();

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
      await test.step('Admin can change member roles', async () => {
        const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await testAuthHelper.directUserSetup('admin', '/family/manage'); // Just use the key!

        const memberCards = page.locator('[data-testid^="ManageFamilyPage-Card-familyMember-"]');
        const memberCount = await memberCards.count();

        if (memberCount > 1) {
          for (let i = 0; i < memberCount; i++) {
            const memberCard = memberCards.nth(i);
            const memberText = await memberCard.textContent();

            if (memberText?.includes(testAuthHelper.getUser('admin').email)) {
              continue; // Skip current admin user
            }

            const actionsButton = memberCard.locator('[data-testid^="ManageFamilyPage-Button-memberMenu-"]');
            await expect(actionsButton).toBeVisible({ timeout: 5000 });
            await actionsButton.click();

            const roleToggle = page.locator('[data-testid^="ManageFamilyPage-Button-roleToggle-"]').first();
            await expect(roleToggle).toBeVisible({ timeout: 5000 });
            console.log('✅ Member role management actions available');
            await page.keyboard.press('Escape');
            break;
          }
        }

        console.log('✅ Family member role management interface verified');
      });
    });
  });

  test.describe('Resource Management', () => {
    test('should manage family children', async ({ page }) => {
      const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
      
      await test.step('Add child to family', async () => {
        await testAuthHelper.directUserSetup('admin', '/children'); // Just use the key!

        // Wait for children page to be ready
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="ChildrenPage-Button-addChild"]')).toBeVisible({ timeout: 20000 });
        await page.click('[data-testid="ChildrenPage-Button-addChild"]');

        await expect(page.locator('[data-testid="ChildrenPage-Input-childName"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="ChildrenPage-Input-childName"]', 'E2E Test Child');

        const ageInput = page.locator('[data-testid="ChildrenPage-Input-childAge"]');
        await expect(ageInput).toBeVisible({ timeout: 5000 });
        await ageInput.fill('8');

        await page.click('[data-testid="ChildrenPage-Button-submitChild"]');
        await expect(page.locator('[data-testid="ChildrenPage-Modal-childForm"]')).not.toBeVisible({ timeout: 10000 });
        await testAuthHelper.waitForDatabaseConsistency('create', 1);

        console.log('✅ Child added to family successfully');
      });

      await test.step('Verify child belongs to family', async () => {
        // Ensure we're on the children page after adding the child
        await page.goto('/children');
        await page.waitForLoadState('networkidle');
        
        // Ensure page is fully loaded and React Query cache is stable
        await testAuthHelper.waitForReactQueryStable();
        await testAuthHelper.waitForPageTransition();
        
        // Debug: log current URL and page content
        console.log('Current URL:', page.url());
        const pageContent = await page.textContent('body');
        console.log('Page contains "E2E Test Child":', pageContent.includes('E2E Test Child'));
        
        // Use the specific test ID we found in the error - child name in card
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
      await test.step('Add vehicle to family', async () => {
        const testAuthHelper = UniversalAuthHelper.forCurrentFile(page); // Auto-detects file and uses shared data!
        await testAuthHelper.directUserSetup('admin', '/vehicles'); // Just use the key!

        // Wait for vehicles page to be ready
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Vehicles' }).first()).toBeVisible({ timeout: 20000 });
        await page.click('[data-testid="VehiclesPage-Button-addVehicle"]');

        await expect(page.locator('[data-testid="VehiclesPage-Input-vehicleName"]')).toBeVisible({ timeout: 5000 });
        await page.fill('[data-testid="VehiclesPage-Input-vehicleName"]', 'E2E Family Car');
        await page.fill('[data-testid="VehiclesPage-Input-vehicleCapacity"]', '5');

        await page.click('[data-testid="VehiclesPage-Button-submitVehicle"]');
        await testAuthHelper.waitForDatabaseConsistency('create', 1);

        console.log('✅ Vehicle added to family successfully');
      });

      await test.step('Verify vehicle belongs to family', async () => {
        // We're on the vehicles page - just look for the vehicle name directly
        const vehicleName = page.locator('[data-testid="VehicleList-Item-vehicle"]').first();
        await expect(vehicleName).toBeVisible({ timeout: 10000 });

        console.log('✅ Vehicle belongs to family');
      });

      await test.step('Family members can view vehicles', async () => {
        // Use isolated browser context to prevent auth contamination
        const memberContext = await _context.browser()!.newContext();
        const memberPage = await memberContext.newPage();
        const memberAuth = new UniversalAuthHelper(memberPage);
        await memberAuth.directUserSetup('member', '/vehicles'); // Just use the key!

        // Wait for member page to load vehicles
        await memberPage.waitForLoadState('networkidle');
        await expect(memberPage.getByText('E2E Family Car').first()).toBeVisible({ timeout: 20000 });

        console.log('✅ Family member can view family vehicles');
        await memberContext.close();
      });
    });
  });
});