import { EmailService, EmailConfig } from '../EmailService';
import { BaseEmailService } from '../base/BaseEmailService';

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let config: EmailConfig;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'password',
      },
    };
    emailService = new EmailService(config);
    jest.clearAllMocks();
  });

  it('should be an instance of BaseEmailService', () => {
    expect(emailService).toBeInstanceOf(BaseEmailService);
  });

  describe('sendMagicLink', () => {
    it('should call _send with the correct parameters for a magic link', async () => {
      const _sendSpy = jest.spyOn(emailService as any, '_send');
      const email = 'test@example.com';
      const token = 'magic-token-123';

      await emailService.sendMagicLink(email, token);

      expect(_sendSpy).toHaveBeenCalledTimes(1);
      expect(_sendSpy).toHaveBeenCalledWith(
        email,
        'EduLift - Secure Login',
        expect.stringContaining(token),
        expect.any(Array), // attachments array
      );
    });

    it('should use the magicLinkUrl when provided', async () => {
        const _sendSpy = jest.spyOn(emailService as any, '_send');
        const email = 'test@example.com';
        const token = 'magic-token-123';
        const magicLinkUrl = 'edulift://custom-link';

        await emailService.sendMagicLink(email, token, undefined, magicLinkUrl);

        expect(_sendSpy).toHaveBeenCalledWith(
            email,
            'EduLift - Secure Login',
            expect.stringContaining(magicLinkUrl),
            expect.any(Array), // attachments array
        );
    });
  });

  describe('_send implementation', () => {
    it('should use nodemailer to send the email', async () => {
      const to = 'recipient@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML</p>';
      mockSendMail.mockResolvedValueOnce({ messageId: '123' });

      // We are testing the protected method directly.
      // This is generally not recommended, but for this case it's acceptable
      // to ensure the nodemailer transport is being used correctly.
      await (emailService as any)._send(to, subject, html);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: config.auth.user,
        to,
        subject,
        html,
        attachments: undefined, // no attachments in this test
        encoding: 'utf8',
      });
    });

    it('should throw an error if sending fails', async () => {
        mockSendMail.mockRejectedValueOnce(new Error('SMTP Error'));

        await expect((emailService as any)._send('a@b.com', 's', 'h')).rejects.toThrow('Failed to send email');
    });
  });

  describe('verifyConnection', () => {
    it('should return true on successful verification', async () => {
      mockVerify.mockResolvedValueOnce(true);
      const result = await emailService.verifyConnection();
      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should return false on failed verification', async () => {
      mockVerify.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await emailService.verifyConnection();
      expect(result).toBe(false);
    });
  });
});
