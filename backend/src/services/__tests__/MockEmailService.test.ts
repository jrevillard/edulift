import { MockEmailService } from '../MockEmailService';
import { BaseEmailService } from '../base/BaseEmailService';

describe('MockEmailService', () => {
  let mockEmailService: any;

  beforeEach(() => {
    mockEmailService = new MockEmailService();
  });

  it('should be an instance of BaseEmailService', () => {
    expect(mockEmailService).toBeInstanceOf(BaseEmailService);
  });

  describe('sendMagicLink', () => {
    it('should successfully send magic link for web', async () => {
      const email = 'test@example.com';
      const token = 'web-token-123';

      // Should not throw
      await expect(mockEmailService.sendMagicLink(email, token)).resolves.toBeUndefined();
    });

    it('should successfully send magic link with invite code', async () => {
        const email = 'invitee@example.com';
        const token = 'invite-token-456';
        const inviteCode = 'INVITE123';

        await expect(mockEmailService.sendMagicLink(email, token, inviteCode)).resolves.toBeUndefined();
    });

    it('should successfully send magic link with native URL', async () => {
      const email = 'native-user@example.com';
      const token = 'native-token-789';
      const magicLinkUrl = `edulift://auth/verify?token=${token}`;

      await expect(mockEmailService.sendMagicLink(email, token, undefined, magicLinkUrl)).resolves.toBeUndefined();
    });
  });

  describe('sendGroupInvitation', () => {
    it('should successfully send group invitation', async () => {
        const inviteCode = 'GROUP-INVITE-CODE';
        await expect(mockEmailService.sendGroupInvitation({
            to: 'new.member@example.com',
            groupName: 'The Cool Kids Club',
            inviteCode,
            role: 'MEMBER',
        })).resolves.toBeUndefined();
    });
  });

  describe('verifyConnection', () => {
    it('should return true', async () => {
      const result = await mockEmailService.verifyConnection();

      expect(result).toBe(true);
    });
  });
});
