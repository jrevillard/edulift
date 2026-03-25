/**
 * E2E Email Helper for interacting with MailPit
 * MailPit captures emails sent during E2E tests and provides an API to retrieve them
 *
 * Based on the working Dart implementation from the mobile team
 */

// Global fetch declaration for Node.js environment
declare const fetch: any;

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  To: Array<{
    Address: string;
    Name?: string;
  }>;
  Cc: Array<{
    Address: string;
    Name?: string;
  }>;
  Bcc: Array<{
    Address: string;
    Name?: string;
  }>;
  From: {
    Address: string;
    Name?: string;
  };
  Subject: string;
  Created: string;
  Snippet: string;
  Read: boolean;
  Tags: string[];
  Attachments: number;
}

export interface MailpitFullMessage extends MailpitMessage {
  HTML: string;
  Text: string;
}

export interface MailpitResponse {
  messages: MailpitMessage[];
  total: number;
  count: number;
  start: number;
}

export class E2EEmailHelper {
  private mailpitUrl: string;

  constructor() {
    // Tests run from devcontainer, use localhost (mailpit-e2e port is forwarded)
    // When running from within Docker (playwright-e2e container), use mailpit-e2e
    this.mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025';
  }

  /**
   * Get all emails from MailPit
   * Uses MailPit API v1: GET /api/v1/messages
   */
  async getAllEmails(): Promise<MailpitMessage[]> {
    try {
      const response = await fetch(`${this.mailpitUrl}/api/v1/messages`);
      if (!response.ok) {
        throw new Error(`MailPit API error: ${response.status}`);
      }
      const data: MailpitResponse = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to get emails from MailPit:', error);
      return [];
    }
  }

  /**
   * Get emails for a specific recipient
   * MailPit format: To is array of {Address: string, Name?: string}
   */
  async getEmailsForRecipient(email: string): Promise<MailpitMessage[]> {
    const allEmails = await this.getAllEmails();
    return allEmails.filter(msg =>
      msg.To.some(to => to.Address.toLowerCase() === email.toLowerCase())
    );
  }

  /**
   * Get latest email for a specific recipient
   */
  async getLatestEmailForRecipient(email: string, options: { debug?: boolean } = {}): Promise<MailpitMessage | null> {
    const debug = options.debug !== false;
    const emails = await this.getEmailsForRecipient(email);

    if (emails.length === 0) {
      if (debug) {
        console.log(`  ℹ️ No emails found for ${email}`);
      }
      return null;
    }

    // Sort by creation date (most recent first)
    emails.sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    const latest = emails[0];

    if (debug) {
      console.log(`  📧 Latest email for ${email}: ${latest.Subject} (${latest.Created})`);
    }

    return latest;
  }

  /**
   * Extract magic link from the latest email for a recipient
   * MailPit requires fetching the full message content separately
   *
   * @param email - Recipient email address
   * @param options - Optional parameters
   * @param options.timeoutMs - Wait timeout in milliseconds (default: 0 = no wait, use waitForEmailForRecipient first)
   * @param options.debug - Enable debug logging (default: true)
   *
   * @example
   * // With automatic wait (recommended for E2E tests)
   * const magicLink = await emailHelper.extractMagicLinkForRecipient(email, { timeoutMs: 30000 });
   *
   * @example
   * // With manual wait (backward compatibility)
   * await emailHelper.waitForEmailForRecipient(email);
   * const magicLink = await emailHelper.extractMagicLinkForRecipient(email);
   */
  async extractMagicLinkForRecipient(
    email: string,
    options: { timeoutMs?: number; debug?: boolean; expectNewEmail?: boolean } = {}
  ): Promise<string | null> {
    const { timeoutMs = 0, debug = true, expectNewEmail = false } = options;

    // Count emails before waiting if we expect a new one
    let emailCountBefore = 0;
    if (expectNewEmail) {
      const emailsBefore = await this.getEmailsForRecipient(email);
      emailCountBefore = emailsBefore.length;
      if (debug) {
        console.log(`📊 Email count before: ${emailCountBefore}`);
      }
    }

    // Automatically wait for email if timeout is specified
    if (timeoutMs > 0) {
      if (debug) {
        console.log(`⏳ Waiting for email to ${email} (timeout: ${timeoutMs}ms)...`);
      }
      const emailReceived = await this.waitForEmailForRecipient(email, timeoutMs, 1000, { debug });
      if (!emailReceived) {
        if (debug) {
          console.log(`  ❌ Email not received within timeout`);
        }
        return null;
      }
    }

    if (debug) {
      console.log(`🔍 Looking for magic link in email for ${email}...`);
    }

    const latestEmail = await this.getLatestEmailForRecipient(email, { debug });
    if (!latestEmail) {
      if (debug) {
        console.log(`  ❌ No email found for ${email}`);
      }
      return null;
    }

    // If expecting a new email, verify we got one more than before
    if (expectNewEmail) {
      const emailsAfter = await this.getEmailsForRecipient(email);
      const emailCountAfter = emailsAfter.length;
      if (debug) {
        console.log(`📊 Email count after: ${emailCountAfter}`);
      }

      if (emailCountAfter <= emailCountBefore) {
        if (debug) {
          console.log(`  ❌ No new email received (still ${emailCountAfter} emails)`);
        }
        return null;
      }
      if (debug) {
        console.log(`  ✅ New email received (${emailCountAfter - emailCountBefore} new)`);
      }
    }

    // Fetch full message content from MailPit
    const fullMessage = await this.getMessageById(latestEmail.ID);
    if (!fullMessage) {
      if (debug) {
        console.log(`  ❌ Could not fetch full message ${latestEmail.ID}`);
      }
      return null;
    }

    // Try HTML content first, then fallback to text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';

    if (debug) {
      console.log(`  📄 Using ${bodyType} body (${body.length} chars)`);
    }

    // Look for magic link URL pattern in email body
    // Token is generated using randomBytes(32).toString('hex') which produces 64 hex characters
    // The regex matches: protocol://domain/auth/verify?token=HEX_TOKEN[&additional_params]
    // Supports: http://, https://, and custom protocols (e.g., edulift://)
    const magicLinkMatch = body.match(/[a-z]+:\/\/[^<>"'\s]+\/auth\/verify\?token=[a-f0-9]+(?:&[^<>"'\s]+)?/);
    if (magicLinkMatch) {
      if (debug) {
        console.log(`  ✅ Magic link found: ${magicLinkMatch[0].substring(0, 80)}...`);
      }
      return magicLinkMatch[0];
    }

    if (debug) {
      console.log(`  ❌ No magic link found in email body`);
      // Show parts of body that contain relevant keywords
      const authIndex = body.toLowerCase().indexOf('auth');
      if (authIndex >= 0) {
        console.log(`  📄 Found 'auth' at position ${authIndex}, showing context:`);
        console.log(`     ${body.substring(Math.max(0, authIndex - 50), Math.min(body.length, authIndex + 150))}`);
      } else {
        console.log(`  📄 Email body preview (first 300 chars):`);
        console.log(`     ${body.substring(0, 300)}`);
      }
    }
    return null;
  }

  /**
   * Get full message content by ID
   * MailPit API: GET /api/v1/message/{id}
   */
  async getMessageById(messageId: string): Promise<MailpitFullMessage | null> {
    try {
      const response = await fetch(`${this.mailpitUrl}/api/v1/message/${messageId}`);
      if (!response.ok) {
        throw new Error(`MailPit API error: ${response.status}`);
      }
      const data: MailpitFullMessage = await response.json();
      return data;
    } catch (error) {
      console.error(`Failed to get message ${messageId} from MailPit:`, error);
      return null;
    }
  }

  /**
   * Extract invitation URL from the latest email for a recipient
   *
   * @param email - Recipient email address
   * @param options - Optional parameters
   * @param options.timeoutMs - Wait timeout in milliseconds (default: 0 = no wait)
   * @param options.debug - Enable debug logging (default: true)
   */
  async extractInvitationUrlForRecipient(
    email: string,
    options: { timeoutMs?: number; debug?: boolean } = {}
  ): Promise<string | null> {
    const { timeoutMs = 0, debug = true } = options;

    // Automatically wait for email if timeout is specified
    if (timeoutMs > 0) {
      if (debug) {
        console.log(`⏳ Waiting for email to ${email} (timeout: ${timeoutMs}ms)...`);
      }
      const emailReceived = await this.waitForEmailForRecipient(email, timeoutMs, 1000, { debug });
      if (!emailReceived) {
        if (debug) {
          console.log(`  ❌ Email not received within timeout`);
        }
        return null;
      }
    }

    if (debug) {
      console.log(`🔍 Looking for invitation URL in email for ${email}...`);
    }

    const latestEmail = await this.getLatestEmailForRecipient(email, { debug });
    if (!latestEmail) {
      if (debug) {
        console.log(`  ❌ No email found for ${email}`);
      }
      return null;
    }

    // Fetch full message content from MailPit
    const fullMessage = await this.getMessageById(latestEmail.ID);
    if (!fullMessage) {
      if (debug) {
        console.log(`  ❌ Could not fetch full message ${latestEmail.ID}`);
      }
      return null;
    }

    // Try HTML content first, then fallback to text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';

    if (debug) {
      console.log(`  📄 Using ${bodyType} body (${body.length} chars)`);
    }

    // Look for family or group invitation URL patterns
    // Note: Codes can be lowercase, uppercase, numbers, and special characters
    const familyInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/families\/join\?code=([a-zA-Z0-9_-]+)/);
    if (familyInviteMatch) {
      if (debug) {
        console.log(`  ✅ Family invitation URL found: ${familyInviteMatch[0].substring(0, 80)}...`);
      }
      return familyInviteMatch[0];
    }

    const groupInviteMatch = body.match(/https?:\/\/[^\s<>"]+\/groups\/join\?code=([a-zA-Z0-9_-]+)/);
    if (groupInviteMatch) {
      if (debug) {
        console.log(`  ✅ Group invitation URL found: ${groupInviteMatch[0].substring(0, 80)}...`);
      }
      return groupInviteMatch[0];
    }

    if (debug) {
      console.log(`  ❌ No invitation URL found in email body`);
    }
    return null;
  }

  /**
   * Extract magic link token from the latest email for a recipient
   */
  async extractMagicLinkTokenForRecipient(email: string, options: { debug?: boolean } = {}): Promise<string | null> {
    const debug = options.debug !== false;

    if (debug) {
      console.log(`🔍 Looking for magic link token in email for ${email}...`);
    }

    const latestEmail = await this.getLatestEmailForRecipient(email, { debug });
    if (!latestEmail) {
      if (debug) {
        console.log(`  ❌ No email found for ${email}`);
      }
      return null;
    }

    // Fetch full message content from MailPit
    const fullMessage = await this.getMessageById(latestEmail.ID);
    if (!fullMessage) {
      if (debug) {
        console.log(`  ❌ Could not fetch full message ${latestEmail.ID}`);
      }
      return null;
    }

    // Try HTML content first, then fallback to text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';

    if (debug) {
      console.log(`  📄 Using ${bodyType} body (${body.length} chars)`);
    }

    // Look for magic link token in email body
    // Token is generated using randomBytes(32).toString('hex') which produces 64 hex characters
    const tokenMatch = body.match(/token=([a-f0-9]+)/);
    if (tokenMatch) {
      if (debug) {
        console.log(`  ✅ Token found: ${tokenMatch[1].substring(0, 20)}...`);
      }
      return tokenMatch[1];
    }

    if (debug) {
      console.log(`  ❌ No token found in email body`);
    }
    return null;
  }

  /**
   * Extract invitation code from the latest email for a recipient
   */
  async extractInvitationCodeForRecipient(email: string, options: { debug?: boolean } = {}): Promise<string | null> {
    const debug = options.debug !== false;

    if (debug) {
      console.log(`🔍 Looking for invitation code in email for ${email}...`);
    }

    const latestEmail = await this.getLatestEmailForRecipient(email, { debug });
    if (!latestEmail) {
      if (debug) {
        console.log(`  ❌ No email found for ${email}`);
      }
      return null;
    }

    // Fetch full message content from MailPit
    const fullMessage = await this.getMessageById(latestEmail.ID);
    if (!fullMessage) {
      if (debug) {
        console.log(`  ❌ Could not fetch full message ${latestEmail.ID}`);
      }
      return null;
    }

    // Try HTML content first, then fallback to text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;
    const bodyType = fullMessage.HTML.length > 0 ? 'HTML' : 'Text';

    if (debug) {
      console.log(`  📄 Using ${bodyType} body (${body.length} chars)`);
    }

    // Look for invitation code patterns - multiple patterns to handle different code formats
    let codeMatch;

    // 1. Try 25-character alphanumeric codes (current issue format)
    codeMatch = body.match(/code=([a-zA-Z0-9]{20,30})/);
    if (codeMatch) {
      if (debug) {
        console.log(`  ✅ Code found (20-30 chars): ${codeMatch[1]}`);
      }
      return codeMatch[1];
    }

    // 2. Try 16-character hex codes (standard family invite codes)
    codeMatch = body.match(/code=([A-Fa-f0-9]{16})/);
    if (codeMatch) {
      if (debug) {
        console.log(`  ✅ Code found (16 hex): ${codeMatch[1]}`);
      }
      return codeMatch[1];
    }

    // 3. Try 7-character invitation codes
    codeMatch = body.match(/code=([A-Z0-9]{7})/);
    if (codeMatch) {
      if (debug) {
        console.log(`  ✅ Code found (7 chars): ${codeMatch[1]}`);
      }
      return codeMatch[1];
    }

    // 4. Fallback: any code= parameter
    codeMatch = body.match(/code=([a-zA-Z0-9]+)/);
    if (codeMatch) {
      if (debug) {
        console.log(`  ✅ Code found (fallback): ${codeMatch[1]}`);
      }
      return codeMatch[1];
    }

    if (debug) {
      console.log(`  ❌ No invitation code found in email body`);
    }
    return null;
  }

  /**
   * Wait for an email to arrive for a specific recipient with debugging
   */
  async waitForEmailForRecipient(
    email: string,
    timeoutMs: number = 30000,
    checkIntervalMs: number = 1000,
    options: { debug?: boolean } = {}
  ): Promise<MailpitMessage | null> {
    const startTime = Date.now();
    const debug = options.debug !== false; // Debug enabled by default

    while (Date.now() - startTime < timeoutMs) {
      const latestEmail = await this.getLatestEmailForRecipient(email);
      if (latestEmail) {
        if (debug) {
          console.log(`✅ Email found for ${email}`);
        }
        return latestEmail;
      }

      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }

    // If email not found and debug mode is enabled, provide debugging info
    if (debug) {
      const allEmails = await this.getAllEmails();
      const emailAddresses = allEmails.map(e => e.To.map(t => t.Address)).flat();
      console.log(`❌ Email not found after all attempts. Looking for: "${email}"`);
      console.log(`Available addresses: ${JSON.stringify(emailAddresses)}`);
      console.log(`Total emails in MailPit: ${allEmails.length}`);

      // Check for partial matches
      const partialMatches = emailAddresses.filter(addr => addr.includes(email.split('@')[0]));
      if (partialMatches.length > 0) {
        console.log(`Partial matches found: ${JSON.stringify(partialMatches)}`);
      }
    }

    return null;
  }

  /**
   * Delete all emails from MailPit
   * MailPit API: DELETE /api/v1/messages
   */
  async deleteAllEmails(): Promise<boolean> {
    try {
      const response = await fetch(`${this.mailpitUrl}/api/v1/messages`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(`MailPit API error: ${response.status}`);
      }
      console.log('🗑️ All emails deleted from MailPit');
      return true;
    } catch (error) {
      console.error('Failed to delete emails from MailPit:', error);
      return false;
    }
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
    console.log(`\n📧 MailPit Email Summary (${emails.length} emails):`);

    emails.forEach((email, index) => {
      const to = email.To.map(t => t.Address).join(', ');
      const from = email.From.Address;
      const subject = email.Subject;

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
    timeoutMs: number = 30000,
    options: { debug?: boolean } = {}
  ): Promise<{ found: boolean; email?: { body: string; subject: string; to: string; from: string } }> {
    const debug = options.debug !== false;

    if (debug) {
      console.log(`⏳ Waiting for email to ${email} (timeout: ${timeoutMs}ms)...`);
    }

    const mailpitEmail = await this.waitForEmailForRecipient(email, timeoutMs, 1000, { debug });

    if (!mailpitEmail) {
      if (debug) {
        console.log(`  ❌ No email received for ${email} within timeout`);
      }
      return { found: false };
    }

    // Fetch full message to get body content
    const fullMessage = await this.getMessageById(mailpitEmail.ID);
    if (!fullMessage) {
      if (debug) {
        console.log(`  ❌ Could not fetch full message ${mailpitEmail.ID}`);
      }
      return { found: false };
    }

    // Use HTML content if available, otherwise use text
    const body = fullMessage.HTML.length > 0 ? fullMessage.HTML : fullMessage.Text;

    if (debug) {
      console.log(`  ✅ Email received: ${mailpitEmail.Subject}`);
    }

    return {
      found: true,
      email: {
        body: body,
        subject: mailpitEmail.Subject || 'No Subject',
        to: mailpitEmail.To.map(t => t.Address).join(', '),
        from: mailpitEmail.From.Address
      }
    };
  }
}