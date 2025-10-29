import { createLogger } from '../../utils/logger';

describe('MockEmailService', () => {
  let mockEmailService: any;
  let mockLogger: any;
  let loggerInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create a mock logger and spy on it
    mockLogger = createLogger('MockEmailService');
    loggerInfoSpy = jest.spyOn(mockLogger, 'info').mockImplementation(() => {});

    // Mock the module to return our logger
    jest.doMock('../../utils/logger', () => ({
      createLogger: jest.fn(() => mockLogger),
      logger: mockLogger
    }));

    // Clear module cache and create service with mocked logger
    jest.resetModules();
    const { MockEmailService: MockEmailServiceClass } = require('../MockEmailService');
    mockEmailService = new MockEmailServiceClass();
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('should be an instance of BaseEmailService', () => {
    const { BaseEmailService } = require('../base/BaseEmailService');
    expect(mockEmailService).toBeInstanceOf(BaseEmailService);
  });

  describe('sendMagicLink', () => {
    it('should log the correct output for a standard web magic link', async () => {
      const email = 'test@example.com';
      const token = 'web-token-123';

      await mockEmailService.sendMagicLink(email, token);

      // Check that Pino logger calls console.info with the expected messages
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔗 DEVELOPMENT MODE - Magic Link Email')
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`📧 To: ${email}`)
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`🔑 Token: ${token}`)
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Magic Link: https://app.edulift.com/auth/verify?token=${token}`)
      );
    });

    it('should log the correct output for a magic link with an invite code', async () => {
        const email = 'invitee@example.com';
        const token = 'invite-token-456';
        const inviteCode = 'INVITE123';

        await mockEmailService.sendMagicLink(email, token, inviteCode);

        expect(loggerInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Invite Code: ${inviteCode}`)
        );
        expect(loggerInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Magic Link: https://app.edulift.com/auth/verify?token=${token}&inviteCode=${inviteCode}`)
        );
    });

    it('should correctly log a provided native magicLinkUrl (e.g., for mobile)', async () => {
      const email = 'native-user@example.com';
      const token = 'native-token-789';
      const magicLinkUrl = `edulift://auth/verify?token=${token}`;

      await mockEmailService.sendMagicLink(email, token, undefined, magicLinkUrl);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`🔑 Token: ${token}`)
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`🌐 Magic Link: ${magicLinkUrl}`)
      );
    });
  });

  describe('sendGroupInvitation', () => {
    it('should log the correct output for a group invitation', async () => {
        const inviteCode = 'GROUP-INVITE-CODE';
        await mockEmailService.sendGroupInvitation({
            to: 'new.member@example.com',
            groupName: 'The Cool Kids Club',
            inviteCode,
            role: 'MEMBER',
        });

        expect(loggerInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('👥 DEVELOPMENT MODE - Group Invitation')
        );
        expect(loggerInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining(`🔗 Invite Code: ${inviteCode}`)
        );
        expect(loggerInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining(`🌐 Invite URL: https://app.edulift.com/groups/join?code=${inviteCode}`)
        );
    });
  });

  describe('verifyConnection', () => {
    it('should return true and log a confirmation message', async () => {
      const result = await mockEmailService.verifyConnection();

      expect(result).toBe(true);
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        '📧 Mock email service is always connected in development'
      );
    });
  });
});
