import { EmailService } from './EmailService';
import { MockEmailService } from './MockEmailService';

export class EmailServiceFactory {
  private static instance: EmailService | MockEmailService | null = null;

  static getInstance(): EmailService | MockEmailService {
    if (!this.instance) {
      this.instance = this.createEmailService();
    }
    return this.instance;
  }

  private static createEmailService(): EmailService | MockEmailService {
    const hasEmailCredentials = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
    const hasEmailConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT);
    const emailEncryption = process.env.EMAIL_ENCRYPTION || 'STARTTLS';

    console.log('🔍 EmailServiceFactory configuration check:');
    console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST || 'NOT SET'}`);
    console.log(`EMAIL_PORT: ${process.env.EMAIL_PORT || 'NOT SET'}`);  
    console.log(`EMAIL_ENCRYPTION: ${emailEncryption}`);
    console.log(`EMAIL_USER: ${process.env.EMAIL_USER || 'NOT SET'}`);
    console.log(`EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET'}`);
    console.log(`hasEmailConfig: ${hasEmailConfig}, hasEmailCredentials: ${hasEmailCredentials}`);

    if (hasEmailConfig && hasEmailCredentials) {
      const emailConfig: any = {
        host: process.env.EMAIL_HOST!,
        port: parseInt(process.env.EMAIL_PORT!),
        auth: {
          user: process.env.EMAIL_USER!,
          pass: process.env.EMAIL_PASSWORD!
        }
      };

      // Configure encryption based on EMAIL_ENCRYPTION setting
      switch (emailEncryption.toUpperCase()) {
        case 'SSL':
          emailConfig.secure = true;
          emailConfig.requireTLS = false;
          break;
        case 'STARTTLS':
          emailConfig.secure = false;
          emailConfig.requireTLS = true;
          break;
        case 'NONE':
          emailConfig.secure = false;
          emailConfig.requireTLS = false;
          break;
        default:
          // Default to STARTTLS for backward compatibility
          emailConfig.secure = false;
          emailConfig.requireTLS = true;
          console.warn(`⚠️ EmailServiceFactory: Unknown EMAIL_ENCRYPTION value: ${emailEncryption}. Defaulting to STARTTLS.`);
      }

      const emailService = new EmailService(emailConfig);
      console.log(`📧 EmailServiceFactory: Using EmailService with host: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT} (${emailEncryption} encryption)`);
      return emailService;
    } else {
      console.log('📧 EmailServiceFactory: Using MockEmailService (missing EMAIL_HOST, EMAIL_PORT, or credentials)');
      return new MockEmailService();
    }
  }

  // For testing purposes - allow resetting the instance
  static reset(): void {
    this.instance = null;
  }
}