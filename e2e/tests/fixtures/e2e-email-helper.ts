/**
 * E2E Email Helper for interacting with MailHog
 * MailHog captures emails sent during E2E tests and provides an API to retrieve them
 */

// Global fetch declaration for Node.js environment
declare const fetch: any;

export interface MailHogMessage {
  ID: string;
  From: {
    Relaying?: string;
    Mailbox: string;
    Domain: string;
    Params: string;
  };
  To: Array<{
    Relaying?: string;
    Mailbox: string;
    Domain: string;
    Params: string;
  }>;
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
    Size: number;
    MIME: null;
  };
  Created: string;
  MIME: null;
  Raw: {
    From: string;
    To: string[];
    Data: string;
    Helo: string;
  };
}

export interface MailHogResponse {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

export class E2EEmailHelper {
  private mailhogUrl: string;

  constructor() {
    this.mailhogUrl = process.env.MAILHOG_URL || 'http://localhost:8025';
  }

  /**
   * Get all emails from MailHog
   */
  async getAllEmails(): Promise<MailHogMessage[]> {
    try {
      const response = await fetch(`${this.mailhogUrl}/api/v2/messages`);
      if (!response.ok) {
        throw new Error(`MailHog API error: ${response.status}`);
      }
      const data: MailHogResponse = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to get emails from MailHog:', error);
      return [];
    }
  }

  /**
   * Get emails for a specific recipient
   */
  async getEmailsForRecipient(email: string): Promise<MailHogMessage[]> {
    const allEmails = await this.getAllEmails();
    return allEmails.filter(msg => 
      msg.To.some(to => `${to.Mailbox}@${to.Domain}`.toLowerCase() === email.toLowerCase())
    );
  }

  /**
   * Get latest email for a specific recipient
   */
  async getLatestEmailForRecipient(email: string): Promise<MailHogMessage | null> {
    const emails = await this.getEmailsForRecipient(email);
    if (emails.length === 0) return null;
    
    // Sort by creation date (most recent first)
    emails.sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    return emails[0];
  }

  /**
   * Extract magic link from the latest email for a recipient
   */
  async extractMagicLinkForRecipient(email: string): Promise<string | null> {
    const latestEmail = await this.getLatestEmailForRecipient(email);
    if (!latestEmail) return null;

    let body = latestEmail.Content.Body;
    
    // Decode Quoted-Printable encoding that MailHog might apply
    body = this.decodeQuotedPrintable(body);
    
    // Look for magic link URL pattern in email body
    // Token is generated using randomBytes(32).toString('hex') which produces 64 hex characters
    const magicLinkMatch = body.match(/https?:\/\/[^\s<>"]+\/auth\/verify\?token=([a-f0-9]+)/);
    if (magicLinkMatch) {
      return magicLinkMatch[0];
    }
    
    return null;
  }

  /**
   * Decode Quoted-Printable encoding commonly used in emails
   */
  private decodeQuotedPrintable(input: string): string {
    return input
      // Replace soft line breaks (= at end of line) first
      .replace(/=\r?\n/g, '')
      .replace(/=$/gm, '')
      // Replace all hex encodings (including =3D for =)
      .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Extract invitation URL from the latest email for a recipient
   */
  async extractInvitationUrlForRecipient(email: string): Promise<string | null> {
    const latestEmail = await this.getLatestEmailForRecipient(email);
    if (!latestEmail) return null;

    let body = latestEmail.Content.Body;
    
    // Decode quoted-printable encoding if present
    if (body.includes('=3D') || body.includes('=20')) {
      body = this.decodeQuotedPrintable(body);
    }
    
    // Look for family or group invitation URL patterns
    // Note: Codes can be lowercase, uppercase, numbers, and special characters
    const familyInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/);
    if (familyInviteMatch) {
      return familyInviteMatch[0];
    }
    
    const groupInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/);
    if (groupInviteMatch) {
      return groupInviteMatch[0];
    }
    
    return null;
  }

  /**
   * Extract magic link token from the latest email for a recipient
   */
  async extractMagicLinkTokenForRecipient(email: string): Promise<string | null> {
    const latestEmail = await this.getLatestEmailForRecipient(email);
    if (!latestEmail) return null;

    let body = latestEmail.Content.Body;
    
    // Decode quoted-printable encoding if present (same logic as extractInvitationUrlForRecipient)
    if (body.includes('=3D') || body.includes('=20')) {
      body = this.decodeQuotedPrintable(body);
    }
    
    // Look for magic link token in email body
    // Token is generated using randomBytes(32).toString('hex') which produces 64 hex characters
    const tokenMatch = body.match(/token=([a-f0-9]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
    
    return null;
  }

  /**
   * Extract invitation code from the latest email for a recipient
   */
  async extractInvitationCodeForRecipient(email: string): Promise<string | null> {
    const latestEmail = await this.getLatestEmailForRecipient(email);
    if (!latestEmail) return null;

    let body = latestEmail.Content.Body;
    
    // Decode quoted-printable encoding if present (same logic as extractInvitationUrlForRecipient)
    if (body.includes('=3D') || body.includes('=20')) {
      body = this.decodeQuotedPrintable(body);
    }
    
    // Look for invitation code patterns - multiple patterns to handle different code formats
    let codeMatch;
    
    // 1. Try 25-character alphanumeric codes (current issue format)
    codeMatch = body.match(/code=([a-zA-Z0-9]{20,30})/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // 2. Try 16-character hex codes (standard family invite codes)
    codeMatch = body.match(/code=([A-Fa-f0-9]{16})/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // 3. Try 7-character invitation codes
    codeMatch = body.match(/code=([A-Z0-9]{7})/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // 4. Fallback: any code= parameter
    codeMatch = body.match(/code=([a-zA-Z0-9]+)/);
    if (codeMatch) {
      return codeMatch[1];
    }
    
    return null;
  }

  /**
   * Wait for an email to arrive for a specific recipient
   */
  async waitForEmailForRecipient(
    email: string, 
    timeoutMs: number = 30000,
    checkIntervalMs: number = 1000
  ): Promise<MailHogMessage | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const latestEmail = await this.getLatestEmailForRecipient(email);
      if (latestEmail) {
        return latestEmail;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    return null;
  }

  /**
   * Get email count for debugging
   */
  async getEmailCount(): Promise<number> {
    const emails = await this.getAllEmails();
    return emails.length;
  }

  /**
   * Print email summary for debugging
   */
  async printEmailSummary(): Promise<void> {
    const emails = await this.getAllEmails();
    console.log(`\n📧 MailHog Email Summary (${emails.length} emails):`);
    
    emails.forEach((email, index) => {
      const to = email.To.map(t => `${t.Mailbox}@${t.Domain}`).join(', ');
      const from = `${email.From.Mailbox}@${email.From.Domain}`;
      const subject = email.Content.Headers['Subject']?.[0] || 'No Subject';
      
      console.log(`  ${index + 1}. From: ${from}`);
      console.log(`     To: ${to}`);
      console.log(`     Subject: ${subject}`);
      console.log(`     Created: ${email.Created}`);
      console.log('');
    });
  }

  /**
   * Wait for an email to arrive for a specific user (alternative interface)
   * Returns object with found status and email data
   */
  async waitForEmailToUser(
    email: string, 
    timeoutMs: number = 30000
  ): Promise<{ found: boolean; email?: { body: string; subject: string; to: string; from: string } }> {
    const mailhogEmail = await this.waitForEmailForRecipient(email, timeoutMs);
    
    if (!mailhogEmail) {
      return { found: false };
    }

    // Decode body and return simplified format
    let body = mailhogEmail.Content.Body;
    body = this.decodeQuotedPrintable(body);
    
    return {
      found: true,
      email: {
        body: body,
        subject: mailhogEmail.Content.Headers['Subject']?.[0] || 'No Subject',
        to: mailhogEmail.To.map(t => `${t.Mailbox}@${t.Domain}`).join(', '),
        from: `${mailhogEmail.From.Mailbox}@${mailhogEmail.From.Domain}`
      }
    };
  }
}