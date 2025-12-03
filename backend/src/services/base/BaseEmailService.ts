
import { EmailServiceInterface, ScheduleSlotNotificationData, GroupInvitationData, FamilyInvitationData, DailyReminderSlot } from '../../types/EmailServiceInterface';

export abstract class BaseEmailService implements EmailServiceInterface {
  protected abstract _send(to: string, subject: string, html: string, attachments?: any[], from?: string): Promise<void>;

  /**
   * Validates a base URL to ensure it's safe for use in email links
   * @param baseUrl The URL to validate
   * @returns true if the URL is safe, false otherwise
   */
  private validateDeepLinkUrl(baseUrl: string): boolean {
    try {
      // Handle empty/null/undefined URLs
      if (!baseUrl || typeof baseUrl !== 'string') {
        this.logInvalidUrl('Empty or invalid URL type', baseUrl);
        return false;
      }

      const trimmedUrl = baseUrl.trim();
      if (!trimmedUrl) {
        this.logInvalidUrl('Empty URL after trimming', baseUrl);
        return false;
      }

      // Parse the URL to validate its structure
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(trimmedUrl);
      } catch {
        this.logInvalidUrl('Invalid URL format', trimmedUrl);
        return false;
      }

      // Define allowed protocols
      const allowedProtocols = ['http:', 'https:', 'edulift:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        this.logInvalidUrl(`Disallowed protocol: ${parsedUrl.protocol}`, trimmedUrl);
        return false;
      }

      // Additional security checks for http/https URLs
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        // Block localhost in production (unless explicitly allowed)
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
          // Allow localhost only in development
          const nodeEnv = process.env.NODE_ENV || 'development';
          if (nodeEnv === 'production') {
            this.logInvalidUrl('Private IP address in production', trimmedUrl);
            return false;
          }
        }

        // Validate hostname format (prevent weird characters)
        const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
        if (!hostnameRegex.test(hostname)) {
          this.logInvalidUrl('Invalid hostname format', trimmedUrl);
          return false;
        }

        // Prevent suspicious patterns in hostname
        // eslint-disable-next-line no-script-url
        const suspiciousPatterns = ['<script', 'javascript:', 'data:', 'vbscript:', 'file:'];
        const lowerHostname = hostname.toLowerCase();
        if (suspiciousPatterns.some(pattern => lowerHostname.includes(pattern))) {
          this.logInvalidUrl('Suspicious pattern in hostname', trimmedUrl);
          return false;
        }
      }

      // Additional checks for edulift:// protocol
      if (parsedUrl.protocol === 'edulift:') {
        // For edulift:// URLs, the path should be simple and not contain suspicious content
        const path = parsedUrl.pathname || '';
        // eslint-disable-next-line no-script-url
        const suspiciousPatterns = ['<script', 'javascript:', 'data:', 'vbscript:', 'file:', '..', '%2e%2e'];
        const lowerPath = path.toLowerCase();
        if (suspiciousPatterns.some(pattern => lowerPath.includes(pattern))) {
          this.logInvalidUrl('Suspicious pattern in edulift:// path', trimmedUrl);
          return false;
        }
      }

      return true;
    } catch {
      this.logInvalidUrl('Unexpected validation error', baseUrl);
      return false;
    }
  }

  /**
   * Logs invalid URLs securely without exposing sensitive information
   * @param reason The reason why the URL is invalid
   * @param url The invalid URL (will be partially masked in logs)
   */
  private logInvalidUrl(reason: string, url: string): void {
    try {
      // Mask sensitive parts of the URL for logging
      let maskedUrl = '';
      if (url && typeof url === 'string' && url.length > 0) {
        // Show only first 20 characters and last 10 characters
        if (url.length <= 30) {
          maskedUrl = `${url.substring(0, 10)}***`;
        } else {
          maskedUrl = `${url.substring(0, 20)}***${url.substring(url.length - 10)}`;
        }
      } else {
        maskedUrl = '[null/empty]';
      }

      console.warn(`[BaseEmailService] Invalid URL detected - ${reason}: ${maskedUrl}`, {
        reason,
        urlLength: url?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Fallback logging if masking fails
      console.error('[BaseEmailService] Invalid URL detected - logging error:', reason);
    }
  }

  /**
   * Determines the appropriate separator between base URL and path
   * @param baseUrl The base URL to analyze
   * @returns The separator string ('', '/', etc.)
   */
  private getSeparator(baseUrl: string): string {
    // For edulift:// protocol, no separator needed
    if (baseUrl.startsWith('edulift://')) {
      return '';
    }

    // If base URL already ends with '/', no separator needed
    if (baseUrl.endsWith('/')) {
      return '';
    }

    // Default separator for web URLs
    return '/';
  }

  /**
   * Normalizes a path by removing leading slash and validating format
   * @param path The path to normalize
   * @returns The normalized path
   */
  private normalizePath(path: string): string {
    if (!path || typeof path !== 'string') {
      return '';
    }

    // Remove leading slash for consistent handling
    return path.startsWith('/') ? path.slice(1) : path;
  }

  /**
   * Builds a complete URL from base URL, path, and parameters
   * @param baseUrl The validated base URL
   * @param path The normalized path
   * @param params Optional URL parameters
   * @returns The complete URL
   */
  private buildUrl(baseUrl: string, path: string, params?: URLSearchParams): string {
    const normalizedPath = this.normalizePath(path);
    const separator = this.getSeparator(baseUrl);
    const fullPath = `${baseUrl}${separator}${normalizedPath}`;

    if (params && params.toString()) {
      return `${fullPath}?${params.toString()}`;
    }

    return fullPath;
  }

  /**
   * Generate URL using DEEP_LINK_BASE_URL with fallbacks and security validation
   */
  protected generateUrl(path: string, params?: URLSearchParams): string {
    const candidateUrls = [
      process.env.DEEP_LINK_BASE_URL,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
    ];

    let validBaseUrl: string | null = null;
    let urlSource = '';

    // Try each URL in order of preference until we find a valid one
    for (let i = 0; i < candidateUrls.length; i++) {
      const candidateUrl = candidateUrls[i];
      if (candidateUrl && this.validateDeepLinkUrl(candidateUrl)) {
        validBaseUrl = candidateUrl;
        urlSource = i === 0 ? 'DEEP_LINK_BASE_URL' : i === 1 ? 'FRONTEND_URL' : 'localhost fallback';
        break;
      }
    }

    // If no valid URL is found, use localhost as ultimate fallback (but log the issue)
    if (!validBaseUrl) {
      console.warn('[BaseEmailService] All URL candidates failed validation, using localhost fallback');
      validBaseUrl = 'http://localhost:3000';
      urlSource = 'emergency localhost fallback';
    }

    // Log the URL source for debugging (in development only)
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv !== 'production') {
      console.debug(`[BaseEmailService] Using URL from ${urlSource}: ${validBaseUrl}`);
    }

    // Use the new buildUrl helper for clean URL construction
    return this.buildUrl(validBaseUrl, path, params);
  }

  async sendMagicLink(email: string, token: string, inviteCode?: string, magicLinkUrl?: string): Promise<void> {
    let finalMagicLinkUrl = magicLinkUrl;

    if (!finalMagicLinkUrl) {
      finalMagicLinkUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
      if (inviteCode) {
        finalMagicLinkUrl += `&inviteCode=${inviteCode}`;
      }
    }

    const subject = 'EduLift - Secure Login';
    const html = await this.generateMagicLinkEmail(finalMagicLinkUrl);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendScheduleNotification(email: string, groupName: string, weekInfo: string): Promise<void> {
    const subject = `EduLift - New schedule available for ${groupName}`;
    const html = await this.generateScheduleNotificationEmail(groupName, weekInfo);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendGroupInvitation(data: GroupInvitationData): Promise<void> {
    const params = new URLSearchParams({ code: data.inviteCode });
    const inviteUrl = await this.generateUrl('groups/join', params);
    const subject = `EduLift - Invitation to group ${data.groupName}`;
    const html = await this.generateGroupInvitationEmail(data.groupName, inviteUrl);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(data.to, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendFamilyInvitation(email: string, invitationData: FamilyInvitationData): Promise<void> {
    const params = new URLSearchParams({ code: invitationData.inviteCode });
    const inviteUrl = await this.generateUrl('families/join', params);
    const subject = `EduLift - Invitation to family ${invitationData.familyName}`;
    const html = await this.generateFamilyInvitationEmail(invitationData.familyName, inviteUrl, invitationData.personalMessage);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendScheduleSlotNotification(email: string, data: ScheduleSlotNotificationData): Promise<void> {
    const subject = this.getScheduleSlotNotificationSubject(data);
    const html = await this.generateScheduleSlotNotificationEmail(data);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendDailyReminder(email: string, groupName: string, tomorrowTrips: DailyReminderSlot[]): Promise<void> {
    const subject = `EduLift - Reminder for tomorrow's trips (${groupName})`;
    const html = await this.generateDailyReminderEmail(groupName, tomorrowTrips);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  async sendWeeklySchedule(email: string, groupName: string, weekInfo: string, scheduleData: any): Promise<void> {
    const subject = `EduLift - Weekly schedule ${weekInfo} (${groupName})`;
    const html = await this.generateWeeklyScheduleEmail(groupName, weekInfo, scheduleData);
    const logoAttachment = await this.getLogoAttachment();
    await this._send(email, subject, html, logoAttachment ? [logoAttachment] : undefined);
  }

  abstract verifyConnection(): Promise<boolean>;

  /**
   * Generate email header with CID-based embedded logo
   */
  private generateEmailHeader(): string {
    // Use Content-ID (CID) for embedded logo
    // This avoids quoted-printable encoding issues with base64 data URLs
    const logoCid = 'edulift-logo@edulift.app';

    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <!-- Embedded image using CID -->
        <div style="text-align: center;">
          <img src="cid:${logoCid}" alt="EduLift - Transport Scolaire Collaboratif"
               width="64" height="64"
               style="max-width: 64px; height: auto; display: inline-block; margin: 0 auto;"
               border="0" />
        </div>
      </div>
    `;
  }

  /**
   * Get logo attachment for email embedding
   */
  protected async getLogoAttachment(): Promise<any> {
    try {
      // Import modules dynamically to avoid require statements
      const fs = await import('fs');
      const path = await import('path');
      // Use process.cwd() instead of __dirname for ESM compatibility
      const logoPath = path.join(process.cwd(), 'assets/logo-64.png');

      if (fs.existsSync(logoPath)) {
        return {
          filename: 'logo-64.png',
          path: logoPath,
          cid: 'edulift-logo@edulift.app', // Same CID as used in generateEmailHeader
          contentType: 'image/png',
        };
      }
    } catch (error) {
      console.warn('Could not create logo attachment:', error);
    }

    return null;
  }

  /**
   * Generate email footer with branding
   */
  private async generateEmailFooter(): Promise<string> {
    return `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px; text-align: center;">
        EduLift - Collaborative school transport management<br>
        <small>Making school transportation easier for families.</small>
      </p>
    `;
  }

  private async generateMagicLinkEmail(magicLinkUrl: string): Promise<string> {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EduLift - Secure Login</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
${await this.generateEmailHeader()}
<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
<p style="font-size: 16px; line-height: 1.5;">Hello,</p>
<p style="font-size: 16px; line-height: 1.5;">Click the link below to sign in to your EduLift account:</p>

<!-- Mobile-friendly button with fallback -->
<div style="text-align: center; margin: 30px 0;">
  <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                 href="${magicLinkUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                 arcsize="10%" stroke="f" fillcolor="#2563eb">
      <w:anchorlock/>
      <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
        Sign in to EduLift
      </center>
    </v:roundrect>
  <![endif]-->
  <a href="${magicLinkUrl}"
     style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
            display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
    Sign in to EduLift
  </a>
</div>

<!-- Copyable link fallback for mobile/Outlook -->
<div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
  <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
    📱 If the button doesn't work on mobile:
  </p>
  <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
    <strong>Copy and paste this link in your browser:</strong><br>
    <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
      ${magicLinkUrl}
    </span>
  </p>
</div>

<p style="font-size: 13px; color: #64748b; margin: 20px 0 10px 0;">
  ⏰ This link expires in 15 minutes and can only be used once.
</p>
<p style="font-size: 13px; color: #64748b; margin: 10px 0;">
  🔒 If you did not request this login, you can safely ignore this email.
</p>
</div>
${await this.generateEmailFooter()}
</body>
</html>`;
  }

  private async generateScheduleNotificationEmail(groupName: string, weekInfo: string): Promise<string> {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EduLift - New Schedule</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${await this.generateEmailHeader()}
        <p>Hello,</p>
        <p>A new schedule has been published for the group <strong>${groupName}</strong>.</p>
        <p><strong>Week:</strong> ${weekInfo}</p>
        <p>Sign in to EduLift to view the details and organize your trips.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.generateUrl('dashboard')}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateGroupInvitationEmail(groupName: string, inviteUrl: string): Promise<string> {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EduLift - Group Invitation</title>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        ${await this.generateEmailHeader()}
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.5;">You have been invited to join the group <strong>${groupName}</strong> on EduLift.</p>
          <p style="font-size: 16px; line-height: 1.5;">EduLift helps you organize home-to-school trips collaboratively with other parents.</p>

          <!-- Mobile-friendly button with fallback -->
          <div style="text-align: center; margin: 30px 0;">
            <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                           href="${inviteUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                           arcsize="10%" stroke="f" fillcolor="#10b981">
                <w:anchorlock/>
                <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
                  Join Group
                </center>
              </v:roundrect>
            <![endif]-->
            <a href="${inviteUrl}"
               style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
                      display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
              Join Group
            </a>
          </div>

          <!-- Copyable link fallback for mobile/Outlook -->
          <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
              📱 If the button doesn't work on mobile:
            </p>
            <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
              <strong>Copy and paste this link in your browser:</strong><br>
              <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
                ${inviteUrl}
              </span>
            </p>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            If you do not wish to join this group, you can ignore this email.
          </p>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateFamilyInvitationEmail(familyName: string, inviteUrl: string, personalMessage?: string): Promise<string> {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EduLift - Family Invitation</title>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        ${await this.generateEmailHeader()}
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.5;">You have been invited to join the family <strong>${familyName}</strong> on EduLift.</p>
          ${personalMessage ? `<div style="background: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;"><p style="margin: 0; font-style: italic; color: #1e40af;">💬 "${personalMessage}"</p></div>` : ''}
          <p style="font-size: 16px; line-height: 1.5;">EduLift helps you organize home-to-school trips collaboratively with your family and other parents.</p>

          <!-- Mobile-friendly button with fallback -->
          <div style="text-align: center; margin: 30px 0;">
            <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                           href="${inviteUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                           arcsize="10%" stroke="f" fillcolor="#10b981">
                <w:anchorlock/>
                <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
                  Join Family
                </center>
              </v:roundrect>
            <![endif]-->
            <a href="${inviteUrl}"
               style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
                      display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
              Join Family
            </a>
          </div>

          <!-- Copyable link fallback for mobile/Outlook -->
          <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
              📱 If the button doesn't work on mobile:
            </p>
            <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
              <strong>Copy and paste this link in your browser:</strong><br>
              <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
                ${inviteUrl}
              </span>
            </p>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            If you do not wish to join this family, you can ignore this email.
          </p>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private getScheduleSlotNotificationSubject(data: ScheduleSlotNotificationData): string {
    const datetime = new Date(data.datetime);
    const timeString = datetime.toISOString().slice(0, 16).replace('T', ' '); // YYYY-MM-DD HH:MM

    switch (data.changeType) {
      case 'SLOT_CREATED':
        return `EduLift - New slot created (${timeString})`;
      case 'DRIVER_ASSIGNED':
        return `EduLift - Driver assigned (${timeString})`;
      case 'VEHICLE_ASSIGNED':
        return `EduLift - Vehicle assigned (${timeString})`;
      case 'CHILD_ADDED':
        return `EduLift - Child added to slot (${timeString})`;
      case 'CHILD_REMOVED':
        return `EduLift - Child removed from slot (${timeString})`;
      case 'SLOT_CANCELLED':
        return `EduLift - Slot cancelled (${timeString})`;
      default:
        return `EduLift - Slot modification (${timeString})`;
    }
  }

  private async generateScheduleSlotNotificationEmail(data: ScheduleSlotNotificationData): Promise<string> {
    const vehiclesHtml = data.vehicles && data.vehicles.length > 0
      ? data.vehicles.map(vehicle =>
        `<p><strong>Vehicle:</strong> ${vehicle.name} (${vehicle.capacity} seats)${vehicle.driverName ? ` - Driver: ${vehicle.driverName}` : ''}</p>`,
      ).join('')
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EduLift - Slot Notification</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${await this.generateEmailHeader()}
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #334155; margin-top: 0;">
            📅 ${new Date(data.datetime).toISOString().slice(0, 16).replace('T', ' ')}
          </h2>
          <p><strong>Group:</strong> ${data.groupName}</p>
          ${vehiclesHtml}
          ${data.totalCapacity ? `<p><strong>Total capacity:</strong> ${data.assignedChildren.length}/${data.totalCapacity} seats</p>` : ''}
          ${data.assignedChildren.length > 0 ? `<p><strong>Children:</strong> ${data.assignedChildren.join(', ')}</p>` : ''}
        </div>
        <p>Sign in to EduLift to see all details and manage your slots.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.generateUrl('dashboard')}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateDailyReminderEmail(groupName: string, tomorrowSlots: DailyReminderSlot[]): Promise<string> {
    const slotsHtml = tomorrowSlots.map((slot: DailyReminderSlot) => {
      const timeDisplay = slot.datetime
        ? new Date(slot.datetime).toISOString().slice(0, 16).replace('T', ' ')
        : `${slot.day} - ${slot.time}`;

      return `
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 10px 0;">
          <h3 style="margin: 0 0 10px 0; color: #334155;">
            📅 ${timeDisplay}
          </h3>
          ${slot.driverName ? `<p style="margin: 5px 0;"><strong>Driver:</strong> ${slot.driverName}</p>` : ''}
          ${slot.vehicleName ? `<p style="margin: 5px 0;"><strong>Vehicle:</strong> ${slot.vehicleName}</p>` : ''}
          ${slot.children && slot.children.length > 0 ? `<p style="margin: 5px 0;"><strong>Children:</strong> ${slot.children.join(', ')}</p>` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EduLift - Tomorrow's Slots Reminder</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${await this.generateEmailHeader()}
        <p>Hello,</p>
        <p>Here is a reminder of the slots scheduled for tomorrow for the group <strong>${groupName}</strong>:</p>
        ${slotsHtml}
        <p>Don't forget to check the times and coordinate with other parents.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.generateUrl('dashboard')}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateWeeklyScheduleEmail(groupName: string, weekInfo: string, _scheduleData: any): Promise<string> {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EduLift - Weekly Schedule</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${await this.generateEmailHeader()}
        <p>Hello,</p>
        <p>Here is the schedule for week ${weekInfo} for the group <strong>${groupName}</strong>.</p>
        <p>Sign in to EduLift to see all details and manage your trips.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.generateUrl('dashboard')}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }
}
