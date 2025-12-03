import { BaseEmailService } from './base/BaseEmailService';
import { URL } from 'url';
import { createLogger } from '../utils/logger';

const logger = createLogger('MockEmailService');

export class MockEmailService extends BaseEmailService {
  constructor() {
    super();
  }

  protected async _send(to: string, subject: string, html: string, attachments?: any[]): Promise<void> {
    // Log attachments for debugging (in development mode)
    if (attachments && attachments.length > 0) {
      logger.info(`📎 Email includes ${attachments.length} attachment(s)`);
    }
    // Extract key information for better console logging
    if (subject.includes('Secure Login') || subject.includes('Connexion sécurisée')) {
      // Magic Link Email - Extract URL from HTML (handle both English and French)
      const urlRegex = /<a href="([^"]+)"/;
      const match = html.match(urlRegex);
      if (match) {
        const magicLinkUrl = match[1];
        const url = new URL(magicLinkUrl);

        const emailLogData: any = {
          type: 'Magic Link Email',
          to,
          magicLinkUrl,
          isEduliftUrl: magicLinkUrl.startsWith('edulift://'),
        };

        if (url.searchParams.has('token')) {
          emailLogData.token = url.searchParams.get('token');
        }
        if (url.searchParams.has('inviteCode')) {
          emailLogData.inviteCode = url.searchParams.get('inviteCode');
        }

        const logMessage = [
          '🔗 DEVELOPMENT MODE - Magic Link Email',
          '=====================================',
          `📧 Type: ${emailLogData.type}`,
          `📧 To: ${emailLogData.to}`,
          ...(emailLogData.token ? [`🔑 Token: ${emailLogData.token}`] : []),
          ...(emailLogData.inviteCode ? [`🎫 Invite Code: ${emailLogData.inviteCode}`] : []),
          `🌐 Magic Link: ${emailLogData.magicLinkUrl}`,
          ...(emailLogData.isEduliftUrl ? [
            '',
            '💡 To open in Flutter app:',
            `   edulift "${emailLogData.magicLinkUrl}"`,
            '   OR',
            `   xdg-open "${emailLogData.magicLinkUrl}"`,
          ] : []),
          '=====================================',
        ].join('\n');

        logger.info(logMessage);
      }
    } else if (subject.includes('Invitation') || subject.includes('rejoindre')) {
      // Invitation Email - Extract invitation URL (handle both English and French)
      const urlRegex = /<a href="([^"]+)"/;
      const match = html.match(urlRegex);
      if (match) {
        const inviteUrl = match[1];
        const url = new URL(inviteUrl);
        const isGroupInvitation = subject.includes('group') || subject.includes('groupe');

        // Determine invitation type and language
        const isFrenchSubject = subject.includes('rejoindre') || subject.includes('famille');

        const invitationLogData: any = {
          type: isGroupInvitation
            ? (isFrenchSubject ? 'Invitation de groupe' : 'Group Invitation')
            : (isFrenchSubject ? 'Invitation familiale' : 'Family Invitation'),
          to,
          inviteUrl,
        };

        if (url.searchParams.has('code')) {
          invitationLogData.inviteCode = url.searchParams.get('code');
        }

        const invitationLogMessage = [
          `${isGroupInvitation ? '👥' : '👨‍👩‍👧‍👦'} DEVELOPMENT MODE - ${invitationLogData.type}`,
          '=====================================',
          `📧 Type: ${invitationLogData.type}`,
          `📧 To: ${invitationLogData.to}`,
          ...(invitationLogData.inviteCode ? [`🔗 Invite Code: ${invitationLogData.inviteCode}`] : []),
          `🌐 Invite URL: ${invitationLogData.inviteUrl}`,
          ...(isFrenchSubject ? [
            '',
            '🇫🇷 Pour ouvrir dans l\'application :',
            `   edulift "${invitationLogData.inviteUrl}"`,
            '   OU',
            `   xdg-open "${invitationLogData.inviteUrl}"`,
          ] : [
            '',
            '💡 To open in app:',
            `   edulift "${invitationLogData.inviteUrl}"`,
            '   OR',
            `   xdg-open "${invitationLogData.inviteUrl}"`,
          ]),
          '=====================================',
        ].join('\n');

        logger.info(invitationLogMessage);
      }
    } else {
      // Other emails - generic format
      const genericLogMessage = [
        '📧 DEVELOPMENT MODE - Email',
        '==========================',
        `📧 To: ${to}`,
        `📝 Subject: ${subject}`,
        '==========================',
      ].join('\n');

      logger.info(genericLogMessage);
    }

    // In development, we simulate successful email sending
    // Users can copy the magic link from console to test authentication
  }

  async verifyConnection(): Promise<boolean> {
    logger.info('📧 Mock email service is always connected in development');
    return true;
  }
}

// This is a mock service for development.
// It logs emails to the console instead of sending them.
// This allows developers to test email-related functionality
// without needing to set up an actual email server.
// The output format is designed to be clear and easy to read.
