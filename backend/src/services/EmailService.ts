import nodemailer from 'nodemailer';
import { BaseEmailService } from './base/BaseEmailService';
import { createLogger } from '../utils/logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  requireTLS?: boolean;
}

export class EmailService extends BaseEmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private logger = createLogger('email');

  constructor(config: EmailConfig) {
    super();
    this.transporter = nodemailer.createTransport(config);
    // For MailPit/MailHog without auth, use default from address
    this.fromEmail = config.auth?.user || process.env.EMAIL_USER || 'noreply@edulift.com';
  }

  protected async _send(to: string, subject: string, html: string, attachments?: any[]): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to,
      subject,
      html,
      attachments,
      encoding: 'utf8',
    };

    // Log email send attempt in all environments for E2E debugging
    this.logger.info(`Sending email to ${to} with subject "${subject}"`);

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info(`Email sent successfully to ${to}, messageId: ${info.messageId}`);
    } catch (error) {
      // Always log errors, even in test mode
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to} with subject "${subject}"`, { error: errorMessage });

      // Throw specific error that can be caught and handled by controllers
      const emailError = new Error('Email service temporarily unavailable') as any;
      emailError.code = 'EMAIL_SERVICE_UNAVAILABLE';
      emailError.retryable = true;
      emailError.originalError = errorMessage;
      throw emailError;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.error('Email service connection failed:', { error: error instanceof Error ? error.message : String(error) });
      }
      return false;
    }
  }
}
