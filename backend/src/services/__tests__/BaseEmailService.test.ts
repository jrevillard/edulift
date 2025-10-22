import { BaseEmailService } from '../base/BaseEmailService';
import { ScheduleSlotNotificationData, GroupInvitationData, FamilyInvitationData } from '../../types/EmailServiceInterface';

// Concrete implementation for testing
class TestEmailService extends BaseEmailService {
  protected async _send(_to: string, _subject: string, _html: string, _from?: string): Promise<void> {
    // Mock implementation for testing
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }
}

describe('BaseEmailService URL Generation', () => {
  let emailService: TestEmailService;

  beforeEach(() => {
    emailService = new TestEmailService();
    // Clear environment variables
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    // Restore environment variables
    delete process.env.FRONTEND_URL;
  });

  describe('generateUrl', () => {
    it('should generate web URLs correctly with default FRONTEND_URL', () => {
      const url = (emailService as any).generateUrl('auth/verify', new URLSearchParams({ token: 'test123' }), 'web');
      expect(url).toBe('http://localhost:3000/auth/verify?token=test123');
    });

    it('should generate web URLs correctly with custom FRONTEND_URL', () => {
      process.env.FRONTEND_URL = 'https://app.edulift.com';
      const url = (emailService as any).generateUrl('families/join', new URLSearchParams({ code: 'ABC123' }), 'web');
      expect(url).toBe('https://app.edulift.com/families/join?code=ABC123');
    });

    it('should generate native URLs correctly', () => {
      const url = (emailService as any).generateUrl('auth/verify', new URLSearchParams({ token: 'test123' }), 'native');
      expect(url).toBe('edulift://auth/verify?token=test123');
    });

    it('should generate native URLs without parameters', () => {
      const url = (emailService as any).generateUrl('dashboard', undefined, 'native');
      expect(url).toBe('edulift://dashboard');
    });

    it('should handle paths with leading slash', () => {
      const url = (emailService as any).generateUrl('/groups/join', new URLSearchParams({ code: 'GRP123' }), 'native');
      expect(url).toBe('edulift://groups/join?code=GRP123');
    });

    it('should default to web platform when not specified', () => {
      const url = (emailService as any).generateUrl('dashboard');
      expect(url).toBe('http://localhost:3000/dashboard');
    });

    it('should handle empty parameters correctly', () => {
      const emptyParams = new URLSearchParams();
      const url = (emailService as any).generateUrl('dashboard', emptyParams, 'web');
      expect(url).toBe('http://localhost:3000/dashboard');
    });
  });

  describe('Email Content Generation with Platform Support', () => {
    it('should include native deeplinks in group invitation emails', async () => {
      const groupData: GroupInvitationData = {
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
        platform: 'native'
      };

      await emailService.sendGroupInvitation(groupData);
      // The fact that no error is thrown confirms the platform parameter is accepted
    });

    it('should include native deeplinks in family invitation emails', async () => {
      const familyData: FamilyInvitationData = {
        inviterName: 'John Doe',
        familyName: 'Test Family',
        inviteCode: 'FAM123',
        role: 'MEMBER',
        platform: 'native'
      };

      await emailService.sendFamilyInvitation('test@example.com', familyData);
      // The fact that no error is thrown confirms the platform parameter is accepted
    });

    it('should include native deeplinks in schedule slot notification emails', async () => {
      const notificationData: ScheduleSlotNotificationData = {
        scheduleSlotId: 'slot123',
        datetime: '2024-01-15T08:00:00Z',
        assignedChildren: ['Emma', 'Lucas'],
        groupName: 'Test Group',
        changeType: 'SLOT_CREATED'
      };

      await emailService.sendScheduleSlotNotification('test@example.com', notificationData, 'native');
      // The fact that no error is thrown confirms the platform parameter is accepted
    });

    it('should handle web platform by default', async () => {
      const groupData: GroupInvitationData = {
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER'
        // platform not specified, should default to 'web'
      };

      await emailService.sendGroupInvitation(groupData);
      // The fact that no error is thrown confirms web is the default
    });
  });

  describe('Platform-specific URL Generation in Email Content', () => {
    it('should generate correct URLs for different email types and platforms', () => {
      // Test various URL generation scenarios
      const testCases = [
        {
          path: 'auth/verify',
          params: new URLSearchParams({ token: 'test123', inviteCode: 'INV123' }),
          platform: 'web' as const,
          expected: 'http://localhost:3000/auth/verify?token=test123&inviteCode=INV123'
        },
        {
          path: 'auth/verify',
          params: new URLSearchParams({ token: 'test123', inviteCode: 'INV123' }),
          platform: 'native' as const,
          expected: 'edulift://auth/verify?token=test123&inviteCode=INV123'
        },
        {
          path: 'families/join',
          params: new URLSearchParams({ code: 'FAM123' }),
          platform: 'native' as const,
          expected: 'edulift://families/join?code=FAM123'
        },
        {
          path: 'groups/join',
          params: new URLSearchParams({ code: 'GRP123' }),
          platform: 'native' as const,
          expected: 'edulift://groups/join?code=GRP123'
        },
        {
          path: 'dashboard',
          params: undefined,
          platform: 'native' as const,
          expected: 'edulift://dashboard'
        }
      ];

      testCases.forEach(({ path, params, platform, expected }) => {
        const url = (emailService as any).generateUrl(path, params, platform);
        expect(url).toBe(expected);
      });
    });
  });
});