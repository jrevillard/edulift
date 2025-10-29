import { BaseEmailService } from './base/BaseEmailService';
import { URL } from 'url';
import { createLogger } from '../utils/logger';

const logger = createLogger('MockEmailService');

export class MockEmailService extends BaseEmailService {
  constructor() {
    super();
  }

  protected async _send(to: string, subject: string, html: string): Promise<void> {
    // Extract key information for better console logging
    if (subject.includes('Secure Login')) {
      // Magic Link Email - Extract URL from HTML
      const urlRegex = /<a href="([^"]+)"/;
      const match = html.match(urlRegex);
      if (match) {
        const magicLinkUrl = match[1];
        const url = new URL(magicLinkUrl);
        
        logger.info('\n🔗 DEVELOPMENT MODE - Magic Link Email');
        logger.info('=====================================');
        logger.info(`📧 To: ${to}`);
        if (url.searchParams.has('token')) {
          logger.info(`🔑 Token: ${url.searchParams.get('token')}`);
        }
        if (url.searchParams.has('inviteCode')) {
          logger.info(`🎫 Invite Code: ${url.searchParams.get('inviteCode')}`);
        }
        logger.info(`🌐 Magic Link: ${magicLinkUrl}`);
        logger.info('=====================================');

        // Add helper command for devcontainer
        if (magicLinkUrl.startsWith('edulift://')) {
          logger.info('💡 To open in Flutter app:');
          logger.info(`   edulift "${magicLinkUrl}"`);
          logger.info('   OR');
          logger.info(`   xdg-open "${magicLinkUrl}"`);
        }
        logger.info('');
      }
    } else if (subject.includes('Invitation')) {
      // Invitation Email - Extract invitation URL
      const urlRegex = /<a href="([^"]+)"/;
      const match = html.match(urlRegex);
      if (match) {
        const inviteUrl = match[1];
        const url = new URL(inviteUrl);
        const isGroupInvitation = subject.includes('group');
        
        logger.info(`\n${isGroupInvitation ? '👥' : '👨‍👩‍👧‍👦'} DEVELOPMENT MODE - ${isGroupInvitation ? 'Group' : 'Family'} Invitation`);
        logger.info('=====================================');
        logger.info(`📧 To: ${to}`);
        if (url.searchParams.has('code')) {
          logger.info(`🔗 Invite Code: ${url.searchParams.get('code')}`);
        }
        logger.info(`🌐 Invite URL: ${inviteUrl}`);
        logger.info('=====================================\n');
      }
    } else {
      // Other emails - generic format
      logger.info('\n📧 DEVELOPMENT MODE - Email');
      logger.info('==========================');
      logger.info(`📧 To: ${to}`);
      logger.info(`📝 Subject: ${subject}`);
      logger.info('==========================\n');
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
