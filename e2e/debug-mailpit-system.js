#!/usr/bin/env node

/**
 * Debug script for E2E email system
 * This script will:
 * 1. Send an invitation in the E2E environment
 * 2. Fetch all emails from MailPit
 * 3. Show email content and structure
 * 4. Test URL extraction regex against actual email bodies
 */

import { chromium } from '@playwright/test';
import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.js';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';
const TEST_EMAIL = 'debug-test@example.com';
const ADMIN_EMAIL = 'admin.test@edulift.com';
const ADMIN_NAME = 'Admin Test User';

class EmailSystemDebugger {
  constructor() {
    this.emailHelper = new E2EEmailHelper();
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('🔧 Setting up browser...');
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    // Clear existing emails
    await this.clearMailpit();
    console.log('✅ Cleared existing emails from MailPit');
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Clear all emails from MailPit
   */
  async clearMailpit() {
    try {
      const response = await fetch(`${MAILPIT_URL}/messages`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        console.warn(`Warning: Could not clear MailPit emails: ${response.status}`);
      }
    } catch (error) {
      console.warn('Warning: Could not clear MailPit emails:', error.message);
    }
  }

  /**
   * Login as admin using localStorage (similar to E2E auth setup)
   */
  async loginAsAdmin() {
    console.log('🔐 Logging in as admin...');

    await this.page.goto(BASE_URL);

    // Set up authentication state in localStorage
    await this.page.evaluate((userData) => {
      const _authData = {
        state: {
          user: {
            id: 'test-admin-id',
            email: userData.email,
            name: userData.name
          },
          isAuthenticated: true,
          accessToken: 'test-jwt-token',
          refreshToken: 'test-refresh-token'
        },
        version: 0
      };
      localStorage.setItem('auth-storage', JSON.stringify(_authData));
    }, { email: ADMIN_EMAIL, name: ADMIN_NAME });

    // Refresh page to apply authentication state
    await this.page.reload();

    // Wait for dashboard or authenticated state
    try {
      await this.page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
      console.log('✅ Successfully logged in as admin');
    } catch (error) {
      console.log('ℹ️ Dashboard not loaded, but auth state should be set');
    }
  }

  /**
   * Send a family invitation
   */
  async sendFamilyInvitation() {
    console.log('📧 Sending family invitation...');

    // Navigate to family management
    await this.page.goto(`${BASE_URL}/families`);

    // Try to create a family first or use existing one
    try {
      // Look for create family button
      const createButton = await this.page.locator('[data-testid="create-family-button"]');
      if (await createButton.isVisible()) {
        await createButton.click();
        await this.page.fill('[data-testid="family-name-input"]', 'Debug Test Family');
        await this.page.click('[data-testid="create-family-confirm-button"]');
        console.log('✅ Created debug test family');
      }
    } catch (error) {
      console.log('ℹ️ Using existing family or skipping creation');
    }

    // Send invitation
    await this.page.waitForSelector('[data-testid="invite-family-member-button"]');
    await this.page.click('[data-testid="invite-family-member-button"]');

    await this.page.fill('[data-testid="invite-email-input"]', TEST_EMAIL);
    await this.page.click('[data-testid="send-invitation-button"]');

    // Wait for invitation to be sent
    await this.page.waitForSelector('[data-testid="invitation-sent-message"]');
    console.log('✅ Family invitation sent successfully');
  }

  /**
   * Send a group invitation
   */
  async sendGroupInvitation() {
    console.log('📧 Sending group invitation...');

    // Navigate to groups
    await this.page.goto(`${BASE_URL}/groups`);

    // Try to create a group first or use existing one
    try {
      const createButton = await this.page.locator('[data-testid="create-group-button"]');
      if (await createButton.isVisible()) {
        await createButton.click();
        await this.page.fill('[data-testid="group-name-input"]', 'Debug Test Group');
        await this.page.click('[data-testid="create-group-confirm-button"]');
        console.log('✅ Created debug test group');
      }
    } catch (error) {
      console.log('ℹ️ Using existing group or skipping creation');
    }

    // Send invitation
    await this.page.waitForSelector('[data-testid="invite-group-member-button"]');
    await this.page.click('[data-testid="invite-group-member-button"]');

    await this.page.fill('[data-testid="invite-email-input"]', TEST_EMAIL);
    await this.page.click('[data-testid="send-invitation-button"]');

    // Wait for invitation to be sent
    await this.page.waitForSelector('[data-testid="invitation-sent-message"]');
    console.log('✅ Group invitation sent successfully');
  }

  /**
   * Analyze all emails in MailPit
   */
  async analyzeEmails() {
    console.log('\n🔍 Analyzing emails in MailPit...');

    // Wait a bit for emails to arrive
    await new Promise(resolve => setTimeout(resolve, 2000));

    const emails = await this.emailHelper.getAllEmails();
    console.log(`📊 Found ${emails.length} emails in MailPit`);

    if (emails.length === 0) {
      console.log('❌ No emails found! Check if email sending is working.');
      return;
    }

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`\n📧 Email ${i + 1}:`);
      console.log('  ID:', email.ID);
      console.log('  From:', email.From.Address);
      console.log('  To:', email.To.map(t => t.Address).join(', '));
      console.log('  Subject:', email.Subject);
      console.log('  Created:', email.Created);
      console.log('  Snippet:', email.Snippet?.substring(0, 100) || 'No Snippet');

      // Fetch full message to get body content
      const fullMessage = await this.emailHelper.getMessageById(email.ID);
      if (fullMessage) {
        const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
        const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';
        console.log(`  Body Size (${bodyType}):`, body.length, 'characters');

        // Show first 200 characters of body
        console.log('  Body Preview:');
        const preview = body.substring(0, 200)
          .replace(/\n/g, '\\n')
          .replace(/</g, '<')
          .replace(/>/g, '>');
        console.log('  ' + preview);

        // Test URL extraction
        await this.testUrlExtraction(email, fullMessage);
      } else {
        console.log('  ⚠️ Could not fetch full message');
      }
    }
  }

  /**
   * Test URL extraction on a specific email
   */
  async testUrlExtraction(email, fullMessage) {
    console.log('\n  🧪 Testing URL extraction:');

    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    console.log('  Body length:', body.length);

    // Test different regex patterns
    const patterns = [
      { name: 'Family Invitation', regex: /https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/ },
      { name: 'Group Invitation', regex: /https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/ },
      { name: 'Magic Link', regex: /https?:\/\/[^\s<>"]+\/auth\/verify\?token=([a-f0-9]+)/ },
      { name: 'Any URL', regex: /https?:\/\/[^\s<>"]+/ },
      { name: 'Any code= parameter', regex: /code=([a-zA-Z0-9_-]+)/ },
      { name: 'Any token= parameter', regex: /token=([a-f0-9]+)/ }
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern.regex);
      if (match) {
        console.log(`  ✅ ${pattern.name}: ${match[0]}`);
        if (match[1]) {
          console.log(`    Extracted parameter: ${match[1]}`);
        }
      } else {
        console.log(`  ❌ ${pattern.name}: No match`);
      }
    }

    // Test the actual helper methods
    const recipientEmail = email.To[0] ? email.To[0].Address : TEST_EMAIL;
    console.log(`  \n  🔧 Testing helper methods for ${recipientEmail}:`);

    const invitationUrl = await this.emailHelper.extractInvitationUrlForRecipient(recipientEmail);
    console.log('  extractInvitationUrlForRecipient:', invitationUrl || 'null');

    const invitationCode = await this.emailHelper.extractInvitationCodeForRecipient(recipientEmail);
    console.log('  extractInvitationCodeForRecipient:', invitationCode || 'null');

    const magicLink = await this.emailHelper.extractMagicLinkForRecipient(recipientEmail);
    console.log('  extractMagicLinkForRecipient:', magicLink || 'null');
  }

  /**
   * Test specific scenarios
   */
  async testScenarios() {
    console.log('\n🎯 Testing specific scenarios...');

    // Test 1: Send family invitation and extract URL
    console.log('\n📋 Test 1: Family Invitation');
    await this.clearMailpit();
    await this.sendFamilyInvitation();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const familyUrl = await this.emailHelper.extractInvitationUrlForRecipient(TEST_EMAIL);
    console.log('Family invitation URL:', familyUrl || 'null');

    // Test 2: Send group invitation and extract URL
    console.log('\n📋 Test 2: Group Invitation');
    await this.clearMailpit();
    await this.sendGroupInvitation();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const groupUrl = await this.emailHelper.extractInvitationUrlForRecipient(TEST_EMAIL);
    console.log('Group invitation URL:', groupUrl || 'null');
  }

  /**
   * Run full debug analysis
   */
  async runDebug() {
    try {
      await this.setup();
      await this.loginAsAdmin();
      await this.testScenarios();
      await this.analyzeEmails();

      console.log('\n✅ Debug analysis complete!');
    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      console.error('Stack trace:', error.stack);
    } finally {
      await this.teardown();
    }
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const emailDebugger = new EmailSystemDebugger();
  emailDebugger.runDebug().catch(console.error);
}

export { EmailSystemDebugger };
