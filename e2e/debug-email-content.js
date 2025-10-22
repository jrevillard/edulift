#!/usr/bin/env node

/**
 * Debug script to analyze actual email content structure
 * This script creates a mock email body and tests the regex patterns
 */

import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.ts';

const mockEmailBodies = [
  // Mock family invitation email body (typical format)
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
`,

  // Mock group invitation email body (typical format)
  `
Subject: Group Invitation - Join Study Group
From: noreply@edulift.com
To: test@example.com

Hello,

You have been invited to join the Study Group on EduLift.

Please click the link below to accept the invitation:

http://localhost:8001/groups/join?code=ABC123XYZ

If you have any questions, please contact us.

Best regards,
The EduLift Team
`,

  // Mock magic link email body (typical format)
  `
Subject: Your Magic Link - EduLift Login
From: noreply@edulift.com
To: test@example.com

Hello,

Click the link below to sign in to EduLift:

http://localhost:8001/auth/verify?token=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

This link will expire in 15 minutes.

Best regards,
The EduLift Team
`,

  // Mock quoted-printable encoded email body
  `
Subject: =?UTF-8?Q?Family_Invitation_-_Join_The_Smith_Family?=
From: noreply@edulift.com
To: test@example.com

Hello,

You have been invited to join The Smith Family on EduLift.

Please click the link below to accept the invitation:

http://localhost:8001/families/join?code=3DE2CD9F2

If you have any questions, please contact us.

Best regards,
The EduLift Team
`,

  // Mock HTML email body
  `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com
Content-Type: text/html

<html>
<body>
<h1>Family Invitation</h1>
<p>You have been invited to join The Smith Family on EduLift.</p>
<p>Please click the link below to accept the invitation:</p>
<a href="http://localhost:8001/families/join?code=E2CD9F2">Join Family</a>
<p>If you have any questions, please contact us.</p>
<p>Best regards,<br>The EduLift Team</p>
</body>
</html>
`,

  // Mock multipart email body with quoted-printable
  `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com
Content-Type: multipart/mixed

--boundary123
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

Hello,

You have been invited to join The Smith Family on EduLift.

Please click the link below to accept the invitation:

http://localhost:8001/families/join?code=3DE2CD9F2

If you have any questions, please contact us.

Best regards,
The EduLift Team

--boundary123--
`,

  // Mock email with URL parameters in different formats
  `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com

Hello,

You have been invited to join The Smith Family on EduLift.

Please click the link below to accept the invitation:

https://app.edulift.com/families/join?code=E2CD9F2&utm_source=email&utm_medium=invitation

If you have any questions, please contact us.

Best regards,
The EduLift Team
`,

  // Mock email with different code formats
  `
Subject: Family Invitation - Join The Smith Family
From: noreply@edulift.com
To: test@example.com

Hello,

Different code formats for testing:
- Short code: http://localhost:8001/families/join?code=ABC123
- Long code: http://localhost:8001/families/join?code=abcdef123456789012345678901234567890
- With dashes: http://localhost:8001/families/join?code=ABC-123-XYZ
- With underscores: http://localhost:8001/families/join?code=ABC_123_XYZ

Best regards,
The EduLift Team
`
];

class EmailContentDebugger {
  constructor() {
    this.emailHelper = new E2EEmailHelper();
  }

  testUrlPatterns(body, emailIndex) {
    console.log(`\n  🧪 Testing URL patterns on email ${emailIndex + 1}:`);
    
    const patterns = [
      { 
        name: 'Family Invitation (current)', 
        regex: /https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/,
        description: 'Current family invitation pattern'
      },
      { 
        name: 'Group Invitation (current)', 
        regex: /https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/,
        description: 'Current group invitation pattern'
      },
      { 
        name: 'Magic Link (current)', 
        regex: /https?:\/\/[^\s<>"]+\/auth\/verify\?token=([a-f0-9]+)/,
        description: 'Current magic link pattern'
      },
      { 
        name: 'Family Invitation (relaxed)', 
        regex: /\/families\/join\?code=([^&\s<>"']+)/,
        description: 'Relaxed family invitation pattern (no protocol)'
      },
      { 
        name: 'Group Invitation (relaxed)', 
        regex: /\/groups\/join\?code=([^&\s<>"']+)/,
        description: 'Relaxed group invitation pattern (no protocol)'
      },
      { 
        name: 'Any code parameter', 
        regex: /code=([a-zA-Z0-9_-]+)/,
        description: 'Any code parameter'
      },
      { 
        name: 'Any code parameter (relaxed)', 
        regex: /code=([^&\s<>"']+)/,
        description: 'Any code parameter (relaxed)'
      }
    ];

    let foundAnyMatch = false;
    patterns.forEach(pattern => {
      const matches = body.match(pattern.regex);
      if (matches) {
        console.log(`  ✅ ${pattern.name}: ${matches[0]}`);
        if (matches[1]) {
          console.log(`    Parameter: ${matches[1]}`);
        }
        foundAnyMatch = true;
      } else {
        console.log(`  ❌ ${pattern.name}: No match`);
      }
    });

    if (!foundAnyMatch) {
      console.log('  ⚠️ No URL patterns matched this email body');
    }
  }

  testQuotedPrintableDecoding(body, emailIndex) {
    console.log(`\n  🔄 Testing quoted-printable decoding on email ${emailIndex + 1}:`);
    
    if (body.includes('=3D') || body.includes('=20') || body.includes('=\n')) {
      console.log('  ✅ Body contains quoted-printable encoding');
      const decoded = this.emailHelper.decodeQuotedPrintable(body);
      console.log('  Original length:', body.length);
      console.log('  Decoded length:', decoded.length);
      console.log('  Decoded preview:', decoded.substring(0, 200).replace(/\n/g, '\\n'));
      
      // Test patterns on decoded body
      this.testUrlPatterns(decoded, emailIndex);
    } else {
      console.log('  ℹ️ Body does not appear to have quoted-printable encoding');
    }
  }

  testAllMockEmails() {
    console.log('🐛 Email Content Debug Analysis');
    console.log('=================================\n');
    
    mockEmailBodies.forEach((body, index) => {
      console.log(`📧 Mock Email ${index + 1}:`);
      console.log('  Body length:', body.length);
      console.log('  Body preview:', body.substring(0, 100).replace(/\n/g, '\\n'));
      
      // Test patterns on original body
      this.testUrlPatterns(body, index);
      
      // Test quoted-printable decoding
      this.testQuotedPrintableDecoding(body, index);
      
      console.log('\n' + '─'.repeat(50) + '\n');
    });
  }

  /**
   * Test the actual helper methods with mock data
   */
  async testHelperMethods() {
    console.log('🔧 Testing helper methods with mock data:\n');
    
    // Create a mock MailHog message
    const mockMessage = {
      ID: 'test-123',
      From: { Mailbox: 'noreply', Domain: 'edulift.com', Params: '' },
      To: [{ Mailbox: 'test', Domain: 'example.com', Params: '' }],
      Content: {
        Headers: { 'Subject': ['Family Invitation - Join The Smith Family'] },
        Body: mockEmailBodies[0], // Use the first mock email
        Size: mockEmailBodies[0].length,
        MIME: null
      },
      Created: new Date().toISOString(),
      MIME: null,
      Raw: {
        From: 'noreply@edulift.com',
        To: ['test@example.com'],
        Data: mockEmailBodies[0],
        Helo: 'localhost'
      }
    };

    // Mock the getAllEmails method temporarily
    const originalGetAllEmails = this.emailHelper.getAllEmails;
    this.emailHelper.getAllEmails = async () => [mockMessage];

    try {
      console.log('📧 Testing with mock email data:');
      
      const invitationUrl = await this.emailHelper.extractInvitationUrlForRecipient('test@example.com');
      console.log('  extractInvitationUrlForRecipient:', invitationUrl || 'null');
      
      const invitationCode = await this.emailHelper.extractInvitationCodeForRecipient('test@example.com');
      console.log('  extractInvitationCodeForRecipient:', invitationCode || 'null');
      
      const magicLink = await this.emailHelper.extractMagicLinkForRecipient('test@example.com');
      console.log('  extractMagicLinkForRecipient:', magicLink || 'null');
      
      const magicLinkToken = await this.emailHelper.extractMagicLinkTokenForRecipient('test@example.com');
      console.log('  extractMagicLinkTokenForRecipient:', magicLinkToken || 'null');
      
      console.log('\n✅ Helper method testing complete');
      
    } finally {
      // Restore original method
      this.emailHelper.getAllEmails = originalGetAllEmails;
    }
  }

  /**
   * Test different URL formats specifically
   */
  testUrlFormats() {
    console.log('\n🔗 Testing different URL formats:\n');
    
    const testUrls = [
      'http://localhost:8001/families/join?code=E2CD9F2',
      'https://app.edulift.com/families/join?code=E2CD9F2',
      'http://localhost:8001/families/join?code=ABC123XYZ',
      'http://localhost:8001/families/join?code=abc123xyz',
      'http://localhost:8001/families/join?code=ABC-123-XYZ',
      'http://localhost:8001/families/join?code=ABC_123_XYZ',
      'http://localhost:8001/families/join?code=A1B2C3D4E5F6',
      'http://localhost:8001/groups/join?code=E2CD9F2',
      'http://localhost:8001/auth/verify?token=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
    ];

    const patterns = [
      { name: 'Family Invitation', regex: /https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/ },
      { name: 'Group Invitation', regex: /https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/ },
      { name: 'Magic Link', regex: /https?:\/\/[^\s<>"]+\/auth\/verify\?token=([a-f0-9]+)/ }
    ];

    testUrls.forEach((url, urlIndex) => {
      console.log(`🔗 Testing URL ${urlIndex + 1}: ${url}`);
      
      patterns.forEach(pattern => {
        const match = url.match(pattern.regex);
        if (match) {
          console.log(`  ✅ ${pattern.name}: ${match[0]}`);
          if (match[1]) {
            console.log(`    Parameter: ${match[1]}`);
          }
        } else {
          console.log(`  ❌ ${pattern.name}: No match`);
        }
      });
      
      console.log('');
    });
  }

  async runDebug() {
    try {
      this.testAllMockEmails();
      this.testUrlFormats();
      await this.testHelperMethods();
      
      console.log('\n✅ Email content debug analysis complete!');
      console.log('\n💡 Key findings:');
      console.log('   - Check if URLs are being extracted correctly from mock data');
      console.log('   - Verify regex patterns match expected URL formats');
      console.log('   - Ensure quoted-printable decoding is working properly');
      console.log('   - Confirm helper methods return expected results');
      
    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const contentDebugger = new EmailContentDebugger();
  contentDebugger.runDebug().catch(console.error);
}

export { EmailContentDebugger };