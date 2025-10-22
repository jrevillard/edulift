#!/usr/bin/env node

/**
 * Simple debug script to analyze current emails in MailHog
 * This script will examine existing emails and test URL extraction
 */

import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.ts';

const MAILHOG_URL = process.env.MAILHOG_URL || 'http://localhost:8025';

class MailHogDebugger {
  constructor() {
    this.emailHelper = new E2EEmailHelper();
  }

  /**
   * Analyze all emails currently in MailHog
   */
  async analyzeCurrentEmails() {
    console.log('🔍 Analyzing current emails in MailHog...');
    console.log('📡 MailHog URL:', MAILHOG_URL);
    
    const emails = await this.emailHelper.getAllEmails();
    console.log(`📊 Found ${emails.length} emails in MailHog`);
    
    if (emails.length === 0) {
      console.log('❌ No emails found in MailHog!');
      console.log('💡 Make sure:');
      console.log('   - MailHog is running at', MAILHOG_URL);
      console.log('   - E2E tests have been run recently');
      console.log('   - Email sending is working in the application');
      return;
    }

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`\n📧 Email ${i + 1}:`);
      console.log('  ID:', email.ID);
      console.log('  From:', `${email.From.Mailbox}@${email.From.Domain}`);
      console.log('  To:', email.To.map(t => `${t.Mailbox}@${t.Domain}`).join(', '));
      console.log('  Subject:', email.Content.Headers['Subject']?.[0] || 'No Subject');
      console.log('  Created:', email.Created);
      console.log('  Content-Type:', email.Content.Headers['Content-Type']?.[0] || 'Not specified');
      console.log('  Body Size:', email.Content.Body.length, 'characters');
      
      // Analyze body content
      await this.analyzeEmailBody(email);
      
      // Test URL extraction methods
      await this.testUrlExtractionMethods(email);
    }
  }

  /**
   * Analyze email body structure
   */
  async analyzeEmailBody(email) {
    console.log('\n  📝 Body Analysis:');
    
    let rawBody = email.Content.Body;
    console.log('  Raw body length:', rawBody.length);
    
    // Check for different encodings
    const encodings = [
      { name: 'Quoted-Printable (=3D)', test: rawBody.includes('=3D') },
      { name: 'Quoted-Printable (=20)', test: rawBody.includes('=20') },
      { name: 'Base64', test: /^[A-Za-z0-9+/]*={0,2}$/.test(rawBody.replace(/\s/g, '')) },
      { name: 'URL encoding (%)', test: rawBody.includes('%') },
      { name: 'HTML tags', test: rawBody.includes('<') && rawBody.includes('>') }
    ];
    
    encodings.forEach(enc => {
      console.log(`  ${enc.test ? '✅' : '❌'} ${enc.name}`);
    });
    
    // Show raw body preview
    console.log('  Raw body preview (first 300 chars):');
    console.log('  "' + rawBody.substring(0, 300).replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"');
    
    // Decode quoted-printable if present
    if (rawBody.includes('=3D') || rawBody.includes('=20')) {
      console.log('\n  🔄 Decoding quoted-printable...');
      const decodedBody = this.emailHelper.decodeQuotedPrintable(rawBody);
      console.log('  Decoded body length:', decodedBody.length);
      console.log('  Decoded body preview (first 300 chars):');
      console.log('  "' + decodedBody.substring(0, 300).replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"');
      
      // Test URL patterns on decoded body
      this.testUrlPatterns(decodedBody);
    } else {
      // Test URL patterns on raw body
      this.testUrlPatterns(rawBody);
    }
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
    
    const recipientEmail = email.To[0] ? `${email.To[0].Mailbox}@${email.To[0].Domain}` : 'unknown@example.com';
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
   * Test connectivity to MailHog
   */
  async testMailHogConnectivity() {
    console.log('🔌 Testing MailHog connectivity...');
    
    try {
      const response = await fetch(`${MAILHOG_URL}/api/v2/messages`);
      if (response.ok) {
        console.log('✅ MailHog API is accessible');
        const data = await response.json();
        console.log(`📊 MailHog reports ${data.total} total messages`);
      } else {
        console.log('❌ MailHog API returned error:', response.status);
      }
    } catch (error) {
      console.log('❌ Failed to connect to MailHog:', error.message);
      console.log('💡 Make sure MailHog is running at:', MAILHOG_URL);
    }
  }

  /**
   * Run the debug analysis
   */
  async runDebug() {
    console.log('🐛 MailHog Email Debug Analysis');
    console.log('=====================================\n');
    
    try {
      await this.testMailHogConnectivity();
      await this.analyzeCurrentEmails();
      
      console.log('\n✅ Debug analysis complete!');
      console.log('\n💡 If extractInvitationUrlForRecipient is returning null:');
      console.log('   1. Check if the email body contains the expected URL format');
      console.log('   2. Verify the regex patterns match the actual URLs in emails');
      console.log('   3. Check if quoted-printable decoding is working correctly');
      console.log('   4. Ensure the email is being sent to the correct recipient');
      
    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const emailDebugger = new MailHogDebugger();
  emailDebugger.runDebug().catch(console.error);
}

export { MailHogDebugger };