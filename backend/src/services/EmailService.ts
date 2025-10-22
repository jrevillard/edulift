import nodemailer from 'nodemailer';
import { BaseEmailService } from './base/BaseEmailService';

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

  constructor(config: EmailConfig) {
    super();
    this.transporter = nodemailer.createTransport(config);
    this.fromEmail = config.auth.user;
  }

  protected async _send(to: string, subject: string, html: string): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: to,
      subject: subject,
      html: html,
      encoding: 'utf8'
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to send email to ${to} with subject "${subject}"`, error);
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
        console.error('Email service connection failed:', error);
      }
      return false;
    }
  }
}
