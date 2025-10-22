import { E2EEmailHelper } from './tests/fixtures/e2e-email-helper.ts';

async function debugEmailExtraction() {
  const emailHelper = new E2EEmailHelper();
  
  console.log('🔍 Debug: Email extraction test');
  
  // Get all emails
  const allEmails = await emailHelper.getAllEmails();
  console.log(`📧 Total emails found: ${allEmails.length}`);
  
  if (allEmails.length > 0) {
    const latestEmail = allEmails[0];
    console.log('\n📧 Latest email details:');
    console.log('From:', `${latestEmail.From.Mailbox}@${latestEmail.From.Domain}`);
    console.log('To:', latestEmail.To.map(t => `${t.Mailbox}@${t.Domain}`).join(', '));
    console.log('Subject:', latestEmail.Content.Headers['Subject']?.[0] || 'No Subject');
    
    console.log('\n📧 Raw email body:');
    console.log('================');
    console.log(latestEmail.Content.Body);
    console.log('================');
    
    // Test the regex patterns
    let body = latestEmail.Content.Body;
    
    // Check for quoted-printable encoding
    const hasQuotedPrintable = body.includes('=3D') || body.includes('=20');
    console.log(`\n🔍 Has quoted-printable encoding: ${hasQuotedPrintable}`);
    
    if (hasQuotedPrintable) {
      body = body
        .replace(/=\r?\n/g, '')
        .replace(/=$/gm, '')
        .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
      
      console.log('\n📧 Decoded email body:');
      console.log('================');
      console.log(body);
      console.log('================');
    }
    
    // Test URL extraction regex
    const familyInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/);
    console.log(`\n🔍 Family invite regex match: ${familyInviteMatch ? familyInviteMatch[0] : 'null'}`);
    
    if (familyInviteMatch) {
      console.log(`🔍 Extracted code: ${familyInviteMatch[1]}`);
    }
    
    // Test alternative regex patterns
    const alternativeMatches = [
      body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9A-F]+)/), // Allow uppercase hex
      body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9]+)/),    // Basic alphanumeric
      body.match(/http:\/\/localhost:[0-9]+\/families\/join\?code=([a-zA-Z0-9A-F]+)/), // Specific localhost
    ];
    
    console.log('\n🔍 Alternative regex results:');
    alternativeMatches.forEach((match, i) => {
      console.log(`Pattern ${i + 1}: ${match ? match[0] : 'null'}`);
    });
    
    // Test with a specific email recipient
    const recipientEmail = latestEmail.To[0] ? `${latestEmail.To[0].Mailbox}@${latestEmail.To[0].Domain}` : null;
    if (recipientEmail) {
      console.log(`\n🔍 Testing extraction for recipient: ${recipientEmail}`);
      const extractedUrl = await emailHelper.extractInvitationUrlForRecipient(recipientEmail);
      console.log(`🔍 Extracted URL: ${extractedUrl}`);
    }
  }
}

debugEmailExtraction().catch(console.error);