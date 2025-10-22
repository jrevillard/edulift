import { BaseEmailService } from './base/BaseEmailService';
import { URL } from 'url';

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
        
        console.log('\n🔗 DEVELOPMENT MODE - Magic Link Email');
        console.log('=====================================');
        console.log(`📧 To: ${to}`);
        if (url.searchParams.has('token')) {
          console.log(`🔑 Token: ${url.searchParams.get('token')}`);
        }
        if (url.searchParams.has('inviteCode')) {
          console.log(`🎫 Invite Code: ${url.searchParams.get('inviteCode')}`);
        }
        console.log(`🌐 Magic Link: ${magicLinkUrl}`);
        console.log('=====================================');
        
        // Add helper command for devcontainer
        if (magicLinkUrl.startsWith('edulift://')) {
          console.log('💡 To open in Flutter app:');
          console.log(`   edulift "${magicLinkUrl}"`);
          console.log('   OR');
          console.log(`   xdg-open "${magicLinkUrl}"`);
        }
        console.log('');
      }
    } else if (subject.includes('Invitation')) {
      // Invitation Email - Extract invitation URL
      const urlRegex = /<a href="([^"]+)"/;
      const match = html.match(urlRegex);
      if (match) {
        const inviteUrl = match[1];
        const url = new URL(inviteUrl);
        const isGroupInvitation = subject.includes('group');
        
        console.log(`\n${isGroupInvitation ? '👥' : '👨‍👩‍👧‍👦'} DEVELOPMENT MODE - ${isGroupInvitation ? 'Group' : 'Family'} Invitation`);
        console.log('=====================================');
        console.log(`📧 To: ${to}`);
        if (url.searchParams.has('code')) {
          console.log(`🔗 Invite Code: ${url.searchParams.get('code')}`);
        }
        console.log(`🌐 Invite URL: ${inviteUrl}`);
        console.log('=====================================\n');
      }
    } else {
      // Other emails - generic format
      console.log(`\n📧 DEVELOPMENT MODE - Email`);
      console.log('==========================');
      console.log(`📧 To: ${to}`);
      console.log(`📝 Subject: ${subject}`);
      console.log('==========================\n');
    }
    
    // In development, we simulate successful email sending
    // Users can copy the magic link from console to test authentication
  }

  async verifyConnection(): Promise<boolean> {
    console.log('📧 Mock email service is always connected in development');
    return true;
  }
}

// This is a mock service for development.
// It logs emails to the console instead of sending them.
// This allows developers to test email-related functionality
// without needing to set up an actual email server.
// The output format is designed to be clear and easy to read.
