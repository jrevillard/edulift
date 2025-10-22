import { MockEmailService } from '../MockEmailService';
import { BaseEmailService } from '../base/BaseEmailService';

describe('MockEmailService', () => {
  let mockEmailService: MockEmailService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockEmailService = new MockEmailService();
    // Spy on console.log to capture output without polluting the test runner output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.log
    consoleLogSpy.mockRestore();
  });

  it('should be an instance of BaseEmailService', () => {
    expect(mockEmailService).toBeInstanceOf(BaseEmailService);
  });

  describe('sendMagicLink', () => {
    it('should log the correct output for a standard web magic link', async () => {
      const email = 'test@example.com';
      const token = 'web-token-123';
      
      await mockEmailService.sendMagicLink(email, token);

      // Check that console.log was called with the expected mock email format
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🔗 DEVELOPMENT MODE - Magic Link Email'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`📧 To: ${email}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`🔑 Token: ${token}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Token: ${token}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Magic Link: https://app.edulift.com/auth/verify?token=${token}`));
    });

    it('should log the correct output for a magic link with an invite code', async () => {
        const email = 'invitee@example.com';
        const token = 'invite-token-456';
        const inviteCode = 'INVITE123';
        
        await mockEmailService.sendMagicLink(email, token, inviteCode);
  
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Invite Code: ${inviteCode}`));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Magic Link: https://app.edulift.com/auth/verify?token=${token}&inviteCode=${inviteCode}`));
    });

    it('should correctly log a provided native magicLinkUrl (e.g., for mobile)', async () => {
      const email = 'native-user@example.com';
      const token = 'native-token-789';
      const magicLinkUrl = `edulift://auth/verify?token=${token}`;

      await mockEmailService.sendMagicLink(email, token, undefined, magicLinkUrl);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`🔑 Token: ${token}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`🌐 Magic Link: ${magicLinkUrl}`));
    });
  });

  describe('sendGroupInvitation', () => {
    it('should log the correct output for a group invitation', async () => {
        const inviteCode = 'GROUP-INVITE-CODE';
        await mockEmailService.sendGroupInvitation({
            to: 'new.member@example.com',
            groupName: 'The Cool Kids Club',
            inviteCode: inviteCode,
            role: 'MEMBER'
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('👥 DEVELOPMENT MODE - Group Invitation'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`🔗 Invite Code: ${inviteCode}`));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`🌐 Invite URL: https://app.edulift.com/groups/join?code=${inviteCode}`));
    });
  });

  describe('verifyConnection', () => {
    it('should return true and log a confirmation message', async () => {
      const result = await mockEmailService.verifyConnection();
      
      expect(result).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('📧 Mock email service is always connected in development');
    });
  });
});
