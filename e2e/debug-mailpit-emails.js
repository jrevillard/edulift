#!/usr/bin/env node

/**
 * Simple debug script to analyze current emails in MailPit
 * This script will examine existing emails and test URL extraction
 */

import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.ts';

const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';

class MailpitDebugger {
  constructor() {
    this.emailHelper = new E2EEmailHelper();
  }

  /**
   * Analyze all emails currently in MailPit
   */
  async analyzeCurrentEmails() {
    console.log('🔍 Analyzing current emails in MailPit...');
    console.log('📡 MailPit URL:', MAILPIT_URL);

    const emails = await this.emailHelper.getAllEmails();
    console.log(`📊 Found ${emails.length} emails in MailPit`);

    if (emails.length === 0) {
      console.log('❌ No emails found in MailPit!');
      console.log('💡 Make sure:');
      console.log('   - MailPit is running at', MAILPIT_URL);
      console.log('   - E2E tests have been run recently');
      console.log('   - Email sending is working in the application');
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
        console.log('  HTML Size:', fullMessage.HTML.length, 'characters');
        console.log('  Text Size:', fullMessage.Text.length, 'characters');

        // Analyze body content
        await this.analyzeEmailBody(fullMessage);
      } else {
        console.log('  ⚠️ Could not fetch full message');
      }

      // Test URL extraction methods
      await this.testUrlExtractionMethods(email);
    }
  }

  /**
   * Analyze email body structure
   */
  async analyzeEmailBody(fullMessage) {
    console.log('\n  📝 Body Analysis:');

    // Use HTML content if available, otherwise use text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';

    console.log('  Body type:', bodyType);
    console.log('  Body length:', body.length);

    // Check for different patterns
    const patterns = [
      { name: 'HTML tags', test: body.includes('<') && body.includes('>') },
      { name: 'Magic links (/auth/verify)', test: body.includes('/auth/verify') },
      { name: 'Family invitations (/families/join)', test: body.includes('/families/join') },
      { name: 'Group invitations (/groups/join)', test: body.includes('/groups/join') },
      { name: 'Token parameters', test: body.includes('token=') },
      { name: 'Code parameters', test: body.includes('code=') }
    ];

    patterns.forEach(pattern => {
      console.log(`  ${pattern.test ? '✅' : '❌'} ${pattern.name}`);
    });

    // Show body preview
    console.log('  Body preview (first 300 chars):');
    const preview = body.substring(0, 300)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/</g, '<')
      .replace(/>/g, '>');
    console.log('  "' + preview + '"');

    // Test URL patterns on body
    this.testUrlPatterns(body);
  }

  /**
   * Test various URL patterns against email body
   */
  testUrlPatterns(body) {
    console.log('\n  🧪 Testing URL patterns:');

    const patterns = [
      {
        name: 'Family Invitation (current)',
        regex: /https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/,
        description: 'Matches family invitation URLs with code parameter'
      },
      {
        name: 'Group Invitation (current)',
        regex: /https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/,
        description: 'Matches group invitation URLs with code parameter'
      },
      {
        name: 'Magic Link (current)',
        regex: /https?:\/\/[^\s<>"]+\/auth\/verify\?token=([a-f0-9]+)/,
        description: 'Matches magic link URLs with token parameter'
      },
      {
        name: 'Any HTTP URL',
        regex: /https?:\/\/[^\s<>"]+/,
        description: 'Matches any HTTP/HTTPS URL'
      },
      {
        name: 'Any localhost URL',
        regex: /https?:\/\/localhost[^\s<>"']*/,
        description: 'Matches any localhost URL'
      },
      {
        name: 'Any code parameter',
        regex: /code=([a-zA-Z0-9_-]+)/,
        description: 'Matches any code= parameter'
      },
      {
        name: 'Any token parameter',
        regex: /token=([a-f0-9]+)/,
        description: 'Matches any token= parameter'
      },
      {
        name: 'Relaxed family URL',
        regex: /\/families\/join\?code=([^&\s<>"']+)/,
        description: 'Matches family URLs without protocol requirement'
      },
      {
        name: 'Relaxed group URL',
        regex: /\/groups\/join\?code=([^&\s<>"']+)/,
        description: 'Matches group URLs without protocol requirement'
      }
    ];

    patterns.forEach(pattern => {
      const matches = body.match(pattern.regex);
      if (matches) {
        console.log(`  ✅ ${pattern.name}: ${matches[0]}`);
        if (matches[1]) {
          console.log(`    Parameter: ${matches[1]}`);
        }
      } else {
        console.log(`  ❌ ${pattern.name}: No match`);
      }
    });
  }

  /**
   * Test the actual helper methods
   */
  async testUrlExtractionMethods(email) {
    console.log('\n  🔧 Testing helper methods:');

    const recipientEmail = email.To[0] ? email.To[0].Address : 'unknown@example.com';
    console.log(`  Testing methods for recipient: ${recipientEmail}`);

    try {
      const invitationUrl = await this.emailHelper.extractInvitationUrlForRecipient(recipientEmail);
      console.log('  extractInvitationUrlForRecipient:', invitationUrl || 'null');

      const invitationCode = await this.emailHelper.extractInvitationCodeForRecipient(recipientEmail);
      console.log('  extractInvitationCodeForRecipient:', invitationCode || 'null');

      const magicLink = await this.emailHelper.extractMagicLinkForRecipient(recipientEmail);
      console.log('  extractMagicLinkForRecipient:', magicLink || 'null');

      const magicLinkToken = await this.emailHelper.extractMagicLinkTokenForRecipient(recipientEmail);
      console.log('  extractMagicLinkTokenForRecipient:', magicLinkToken || 'null');

    } catch (error) {
      console.log('  ❌ Error testing helper methods:', error.message);
    }
  }

  /**
   * Test connectivity to MailPit
   */
  async testMailpitConnectivity() {
    console.log('🔌 Testing MailPit connectivity...');

    try {
      const response = await fetch(`${MAILPIT_URL}/messages`);
      if (response.ok) {
        console.log('✅ MailPit API is accessible');
        const data = await response.json();
        console.log(`📊 MailPit reports ${data.total} total messages`);
      } else {
        console.log('❌ MailPit API returned error:', response.status);
      }
    } catch (error) {
      console.log('❌ Failed to connect to MailPit:', error.message);
      console.log('💡 Make sure MailPit is running at:', MAILPIT_URL);
    }
  }

  /**
   * Run the debug analysis
   */
  async runDebug() {
    console.log('🐛 MailPit Email Debug Analysis');
    console.log('=====================================\n');

    try {
      await this.testMailpitConnectivity();
      await this.analyzeCurrentEmails();

      console.log('\n✅ Debug analysis complete!');
      console.log('\n💡 If extractInvitationUrlForRecipient is returning null:');
      console.log('   1. Check if the email body contains the expected URL format');
      console.log('   2. Verify the regex patterns match the actual URLs in emails');
      console.log('   3. Check if the email is being sent to the correct recipient');

    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const emailDebugger = new MailpitDebugger();
  emailDebugger.runDebug().catch(console.error);
}

export { MailpitDebugger };
