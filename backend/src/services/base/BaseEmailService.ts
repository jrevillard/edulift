
import { EmailServiceInterface, ScheduleSlotNotificationData, GroupInvitationData, FamilyInvitationData, DailyReminderSlot } from '../../types/EmailServiceInterface';

export abstract class BaseEmailService implements EmailServiceInterface {
  protected abstract _send(to: string, subject: string, html: string, from?: string): Promise<void>;

  /**
   * Generate URL based on platform type (web or native)
   */
  protected generateUrl(path: string, params?: URLSearchParams, platform: 'web' | 'native' = 'web'): string {
    const baseUrl = platform === 'native'
      ? 'edulift://'
      : (process.env.FRONTEND_URL || 'http://localhost:3000');

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const separator = platform === 'native' ? '' : '/';
    const fullPath = `${baseUrl}${separator}${cleanPath}`;

    if (params && params.toString()) {
      return `${fullPath}?${params.toString()}`;
    }

    return fullPath;
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
    await this._send(email, subject, html);
  }

  async sendScheduleNotification(email: string, groupName: string, weekInfo: string, platform: 'web' | 'native' = 'web'): Promise<void> {
    const subject = `EduLift - New schedule available for ${groupName}`;
    const html = await this.generateScheduleNotificationEmail(groupName, weekInfo, platform);
    await this._send(email, subject, html);
  }

  async sendGroupInvitation(data: GroupInvitationData): Promise<void> {
    const params = new URLSearchParams({ code: data.inviteCode });
    const inviteUrl = await this.generateUrl('groups/join', params, data.platform || 'web');
    const subject = `EduLift - Invitation to group ${data.groupName}`;
    const html = await this.generateGroupInvitationEmail(data.groupName, inviteUrl);
    await this._send(data.to, subject, html);
  }

  async sendFamilyInvitation(email: string, invitationData: FamilyInvitationData): Promise<void> {
    const params = new URLSearchParams({ code: invitationData.inviteCode });
    const inviteUrl = await this.generateUrl('families/join', params, invitationData.platform || 'web');
    const subject = `EduLift - Invitation to family ${invitationData.familyName}`;
    const html = await this.generateFamilyInvitationEmail(invitationData.familyName, inviteUrl, invitationData.personalMessage);
    await this._send(email, subject, html);
  }

  async sendScheduleSlotNotification(email: string, data: ScheduleSlotNotificationData, platform: 'web' | 'native' = 'web'): Promise<void> {
    const subject = this.getScheduleSlotNotificationSubject(data);
    const html = await this.generateScheduleSlotNotificationEmail(data, platform);
    await this._send(email, subject, html);
  }

  async sendDailyReminder(email: string, groupName: string, tomorrowTrips: DailyReminderSlot[], platform: 'web' | 'native' = 'web'): Promise<void> {
    const subject = `EduLift - Reminder for tomorrow's trips (${groupName})`;
    const html = await this.generateDailyReminderEmail(groupName, tomorrowTrips, platform);
    await this._send(email, subject, html);
  }

  async sendWeeklySchedule(email: string, groupName: string, weekInfo: string, scheduleData: any, platform: 'web' | 'native' = 'web'): Promise<void> {
    const subject = `EduLift - Weekly schedule ${weekInfo} (${groupName})`;
    const html = await this.generateWeeklyScheduleEmail(groupName, weekInfo, scheduleData, platform);
    await this._send(email, subject, html);
  }

  abstract verifyConnection(): Promise<boolean>;

  /**
   * Generate email header with embedded logo and fallback
   */
  private async generateEmailHeader(): Promise<string> {
    try {
      // Import modules dynamically to avoid require statements
      const fs = await import('fs');
      const path = await import('path');
      const logoPath = path.join(__dirname, '../../assets/logo-192.png');

      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

        return `
          <div style="text-align: center; margin-bottom: 30px;">
            <!-- Fallback text first -->
            <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; display: none;" id="logoFallback">
              🚐 EduLift
            </div>
            <!-- Embedded image -->
            <img src="${logoBase64}" alt="EduLift - Transport Scolaire Collaboratif"
                 style="max-width: 120px; height: auto; display: block;"
                 onerror="this.style.display='none'; document.getElementById('logoFallback').style.display='block';" />
            <!-- Alternative text for email clients that don't support onerror -->
            <noscript>
              <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">
                🚐 EduLift
              </div>
            </noscript>
          </div>
        `;
      }
    } catch (error) {
      // Fallback if logo file is not accessible
      console.warn('Could not embed logo:', error);
    }

    // Fallback header
    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 24px; font-weight: bold; color: #2563eb;">
          🚐 EduLift
        </div>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
          Transport Scolaire Collaboratif
        </p>
      </div>
    `;
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

  private async generateScheduleNotificationEmail(groupName: string, weekInfo: string, platform: 'web' | 'native' = 'web'): Promise<string> {
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
          <a href="${await this.generateUrl('dashboard', undefined, platform)}"
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

  private async generateScheduleSlotNotificationEmail(data: ScheduleSlotNotificationData, platform: 'web' | 'native' = 'web'): Promise<string> {
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
          <a href="${await this.generateUrl('dashboard', undefined, platform)}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateDailyReminderEmail(groupName: string, tomorrowSlots: DailyReminderSlot[], platform: 'web' | 'native' = 'web'): Promise<string> {
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
          <a href="${await this.generateUrl('dashboard', undefined, platform)}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Schedule
          </a>
        </div>
        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }

  private async generateWeeklyScheduleEmail(groupName: string, weekInfo: string, _scheduleData: any, platform: 'web' | 'native' = 'web'): Promise<string> {
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
          <a href="${await this.generateUrl('dashboard', undefined, platform)}" 
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
