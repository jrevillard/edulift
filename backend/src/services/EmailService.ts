import nodemailer from 'nodemailer';
import { BaseEmailService } from './base/BaseEmailService';
import { createLogger } from '../utils/logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
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
    this.fromEmail = config.auth.user;
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

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.error(`Failed to send email to ${to} with subject "${subject}"`, { error: error instanceof Error ? error.message : String(error) });
      }
      throw new Error('Failed to send email');
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
