#!/usr/bin/env node

/**
 * Debug script to specifically test code extraction patterns
 */

import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.ts';

class CodeExtractionDebugger {
  constructor() {
    this.emailHelper = new E2EEmailHelper();
  }

  testCodeExtractionPatterns() {
    console.log('🔍 Testing code extraction patterns:\n');

    const testBodies = [
      `http://localhost:8001/families/join?code=E2CD9F2`,
      `Please visit: http://localhost:8001/families/join?code=E2CD9F2 to join`,
      `code=E2CD9F2`,
      `code=ABC123XYZ`,
      `code=abc123xyz`,
      `code=A1B2C3D4E5F6`,
      `code=12345678901234567890123456789`,
      `code=ABC-123-XYZ`,
      `code=ABC_123_XYZ`,
      `<a href="http://localhost:8001/families/join?code=E2CD9F2">Join</a>`,
      `http://localhost:8001/families/join?code=E2CD9F2&utm_source=email`,
      `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com

Hello,

You have been invited to join The Smith Family on EduLift.

Please click the link below to accept the invitation:

http://localhost:8001/families/join?code=E2CD9F2

If you have any questions, please contact us.

Best regards,
The EduLift Team
`
    ];

    const patterns = [
      { name: '25-character alphanumeric codes', regex: /code=([a-zA-Z0-9]{20,30})/ },
      { name: '16-character hex codes', regex: /code=([A-Fa-f0-9]{16})/ },
      { name: '7-character invitation codes', regex: /code=([A-Z0-9]{7})/ },
      { name: 'Fallback: any code= parameter', regex: /code=([a-zA-Z0-9]+)/ },
      { name: 'Current URL pattern (from extractInvitationUrlForRecipient)', regex: /https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/ }
    ];

    testBodies.forEach((body, bodyIndex) => {
      console.log(`📧 Test Body ${bodyIndex + 1}:`);
      console.log('Body:', body.replace(/\n/g, '\\n').substring(0, 100));
      
      patterns.forEach(pattern => {
        const match = body.match(pattern.regex);
        if (match) {
          console.log(`  ✅ ${pattern.name}: ${match[1]}`);
        } else {
          console.log(`  ❌ ${pattern.name}: No match`);
        }
      });
      
      console.log('');
    });
  }

  testSpecificCode() {
    console.log('🎯 Testing specific code E2CD9F2:\n');
    
    const code = 'E2CD9F2';
    const testString = `http://localhost:8001/families/join?code=${code}`;
    
    console.log('Test string:', testString);
    console.log('Code:', code);
    console.log('Code length:', code.length);
    console.log('Code is uppercase:', code === code.toUpperCase());
    console.log('Code is alphanumeric:', /^[A-Z0-9]+$/.test(code));
    
    // Test each pattern individually
    const patterns = [
      { name: 'Pattern 1: 20-30 chars', regex: /code=([a-zA-Z0-9]{20,30})/ },
      { name: 'Pattern 2: 16 hex chars', regex: /code=([A-Fa-f0-9]{16})/ },
      { name: 'Pattern 3: 7 uppercase alphanumeric', regex: /code=([A-Z0-9]{7})/ },
      { name: 'Pattern 4: Any alphanumeric', regex: /code=([a-zA-Z0-9]+)/ }
    ];

    patterns.forEach(pattern => {
      const match = testString.match(pattern.regex);
      if (match) {
        console.log(`✅ ${pattern.name}: MATCH - ${match[1]}`);
      } else {
        console.log(`❌ ${pattern.name}: NO MATCH`);
      }
    });
  }

  async testActualHelperMethod() {
    console.log('\n🔧 Testing actual helper method:\n');
    
    const mockEmail = {
      ID: 'test-123',
      From: { Mailbox: 'noreply', Domain: 'edulift.com', Params: '' },
      To: [{ Mailbox: 'test', Domain: 'example.com', Params: '' }],
      Content: {
        Headers: { 'Subject': ['Family Invitation - Join The Smith Family'] },
        Body: `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com

Hello,

You have been invited to join The Smith Family on EduLift.

Please click the link below to accept the invitation:

http://localhost:8001/families/join?code=E2CD9F2

If you have any questions, please contact us.

Best regards,
The EduLift Team
`,
        Size: 0,
        MIME: null
      },
      Created: new Date().toISOString(),
      MIME: null,
      Raw: { From: '', To: [], Data: '', Helo: '' }
    };

    // Mock the email helper methods
    const originalGetLatestEmail = this.emailHelper.getLatestEmailForRecipient;
    this.emailHelper.getLatestEmailForRecipient = async () => mockEmail;

    try {
      console.log('Mock email body:');
      console.log(mockEmail.Content.Body);
      
      const invitationUrl = await this.emailHelper.extractInvitationUrlForRecipient('test@example.com');
      console.log('extractInvitationUrlForRecipient result:', invitationUrl);
      
      const invitationCode = await this.emailHelper.extractInvitationCodeForRecipient('test@example.com');
      console.log('extractInvitationCodeForRecipient result:', invitationCode);
      
      // Test the decoded body directly
      const decodedBody = this.emailHelper.decodeQuotedPrintable(mockEmail.Content.Body);
      console.log('\nDecoded body:');
      console.log(decodedBody);
      
      // Test patterns on decoded body
      console.log('\nTesting patterns on decoded body:');
      const patterns = [
        { name: '25-character alphanumeric codes', regex: /code=([a-zA-Z0-9]{20,30})/ },
        { name: '16-character hex codes', regex: /code=([A-Fa-f0-9]{16})/ },
        { name: '7-character invitation codes', regex: /code=([A-Z0-9]{7})/ },
        { name: 'Fallback: any code= parameter', regex: /code=([a-zA-Z0-9]+)/ }
      ];

      patterns.forEach(pattern => {
        const match = decodedBody.match(pattern.regex);
        if (match) {
          console.log(`✅ ${pattern.name}: ${match[1]}`);
        } else {
          console.log(`❌ ${pattern.name}: No match`);
        }
      });
      
    } finally {
      this.emailHelper.getLatestEmailForRecipient = originalGetLatestEmail;
    }
  }

  async runDebug() {
    console.log('🐛 Code Extraction Debug Analysis');
    console.log('==================================\n');
    
    try {
      this.testCodeExtractionPatterns();
      this.testSpecificCode();
      await this.testActualHelperMethod();
      
      console.log('\n✅ Code extraction debug analysis complete!');
    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const codeDebugger = new CodeExtractionDebugger();
  codeDebugger.runDebug().catch(console.error);
}

export { CodeExtractionDebugger };