import { EmailService } from './EmailService';
import { MockEmailService } from './MockEmailService';
import { logger } from '../utils/logger';

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

    logger.info('EmailServiceFactory configuration check', {
      EMAIL_HOST: process.env.EMAIL_HOST || 'NOT SET',
      EMAIL_PORT: process.env.EMAIL_PORT || 'NOT SET',
      EMAIL_ENCRYPTION: emailEncryption,
      EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET',
      hasEmailConfig,
      hasEmailCredentials,
    });

    if (hasEmailConfig && hasEmailCredentials) {
      const emailConfig: any = {
        host: process.env.EMAIL_HOST!,
        port: parseInt(process.env.EMAIL_PORT!),
      };

      // MailHog/Mailpit don't support SMTP authentication
      // Detect them by host name or encryption setting
      const isMailHog = process.env.EMAIL_HOST?.includes('mailhog') ||
                       process.env.EMAIL_HOST?.includes('mailpit') ||
                       emailEncryption.toUpperCase() === 'NONE';

      if (!isMailHog) {
        emailConfig.auth = {
          user: process.env.EMAIL_USER!,
          pass: process.env.EMAIL_PASSWORD!,
        };
      } else {
        logger.info('EmailServiceFactory: Detected MailHog/Mailpit (no SMTP auth required)');
      }

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
          logger.warn(`EmailServiceFactory: Unknown EMAIL_ENCRYPTION value: ${emailEncryption}. Defaulting to STARTTLS.`);
      }

      const emailService = new EmailService(emailConfig);
      logger.info('EmailServiceFactory: Using EmailService', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        encryption: emailEncryption,
      });
      return emailService;
    } else {
      logger.info('EmailServiceFactory: Using MockEmailService (missing EMAIL_HOST, EMAIL_PORT, or credentials)');
      return new MockEmailService();
    }
  }

  // For testing purposes - allow resetting the instance
  static reset(): void {
    this.instance = null;
  }
}