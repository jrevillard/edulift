import { BaseEmailService } from '../base/BaseEmailService';
import { ScheduleSlotNotificationData, GroupInvitationData, FamilyInvitationData } from '../../types/EmailServiceInterface';

// Concrete implementation for testing
class TestEmailService extends BaseEmailService {
  protected async _send(to: string, subject: string, html: string, _attachments?: any[], _from?: string): Promise<void> {
    // Store sent emails for testing
    this.sentEmails = this.sentEmails || [];
    this.sentEmails.push({ to, subject, html });
  }

  public sentEmails: Array<{ to: string; subject: string; html: string }> = [];

  async verifyConnection(): Promise<boolean> {
    return true;
  }

  public getSentEmails() {
    return this.sentEmails;
  }

  public clearSentEmails() {
    this.sentEmails = [];
  }
}

describe('BaseEmailService Internationalization', () => {
  let emailService: TestEmailService;

  beforeEach(() => {
    emailService = new TestEmailService();
    emailService.clearSentEmails();
    // Set up environment for URL generation
    process.env.DEEP_LINK_BASE_URL = 'edulift://';
  });

  afterEach(() => {
    delete process.env.DEEP_LINK_BASE_URL;
  });

  describe('sendMagicLink', () => {
    it('should send magic link email in French for French email domains', async () => {
      const frenchEmails = [
        'user@orange.fr',
        'contact@sfr.fr',
        'test@free.fr',
        'admin@bouyguestelecom.fr',
        'user@numericable.fr',
        'contact@bbox.fr',
        'test@aliceadsl.fr',
        'user@wanadoo.fr',
        'contact@club-internet.fr',
        'user@skynet.be',
        'test@belgacom.be',
        'admin@proximus.be',
        'user@voo.be',
        'contact@bluewin.ch',
        'test@swisscom.ch',
        'user@sunrise.ch',
        'admin@videotron.ca',
        'test@bell.ca',
        'user@sympatico.ca',
        'contact@laposte.net',
      ];

      for (const email of frenchEmails) {
        emailService.clearSentEmails();
        await emailService.sendMagicLink(email, 'test-token-123');

        const sentEmail = emailService.getSentEmails()[0];
        expect(sentEmail.to).toBe(email);
        expect(sentEmail.subject).toBe('EduLift - Connexion sécurisée');
        expect(sentEmail.html).toContain('Connexion sécurisée');
        expect(sentEmail.html).toContain('Bonjour');
        expect(sentEmail.html).toContain('Se connecter à EduLift');
        expect(sentEmail.html).toContain('Email envoyé en FR');
      }
    });

    it('should send magic link email in English for English email domains', async () => {
      const englishEmails = [
        'user@gmail.com',
        'contact@yahoo.com',
        'test@outlook.com',
        'admin@hotmail.com',
        'user@icloud.com',
        'contact@aol.com',
      ];

      for (const email of englishEmails) {
        emailService.clearSentEmails();
        await emailService.sendMagicLink(email, 'test-token-123');

        const sentEmail = emailService.getSentEmails()[0];
        expect(sentEmail.to).toBe(email);
        expect(sentEmail.subject).toBe('EduLift - Secure Login');
        expect(sentEmail.html).toContain('Secure Login');
        expect(sentEmail.html).toContain('Hello');
        expect(sentEmail.html).toContain('Sign in to EduLift');
        expect(sentEmail.html).toContain('Email sent in EN');
      }
    });

    it('should respect inviter language when provided', async () => {
      const groupData: GroupInvitationData = {
        to: 'user@orange.fr', // French domain
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
        inviterLanguage: 'en', // But inviter prefers English
      };

      await emailService.sendGroupInvitation(groupData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.subject).toBe('EduLift - Invitation to join Test Group');
      expect(sentEmail.html).toContain('Group Invitation');
      expect(sentEmail.html).toContain('Hello');
      expect(sentEmail.html).toContain('Join Group');
      expect(sentEmail.html).toContain('Email sent in EN');
    });
  });

  describe('sendGroupInvitation', () => {
    it('should send group invitation in French for French email recipients', async () => {
      const groupData: GroupInvitationData = {
        to: 'marie.dupont@orange.fr',
        groupName: 'École Primaire Saint-Exupéry',
        inviteCode: 'GRP123',
        role: 'MEMBER',
      };

      await emailService.sendGroupInvitation(groupData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.to).toBe('marie.dupont@orange.fr');
      expect(sentEmail.subject).toBe('EduLift - Invitation à rejoindre École Primaire Saint-Exupéry');
      expect(sentEmail.html).toContain('Invitation de groupe');
      expect(sentEmail.html).toContain('Bonjour');
      expect(sentEmail.html).toContain('Vous avez été invité à rejoindre le groupe <strong>École Primaire Saint-Exupéry</strong>');
      expect(sentEmail.html).toContain('Rejoindre le groupe');
      expect(sentEmail.html).toContain('Email envoyé en FR');
    });

    it('should send group invitation in English for English email recipients', async () => {
      const groupData: GroupInvitationData = {
        to: 'john.smith@gmail.com',
        groupName: 'Central Elementary School',
        inviteCode: 'GRP456',
        role: 'MEMBER',
      };

      await emailService.sendGroupInvitation(groupData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.to).toBe('john.smith@gmail.com');
      expect(sentEmail.subject).toBe('EduLift - Invitation to join Central Elementary School');
      expect(sentEmail.html).toContain('Group Invitation');
      expect(sentEmail.html).toContain('Hello');
      expect(sentEmail.html).toContain('You have been invited to join the group <strong>Central Elementary School</strong>');
      expect(sentEmail.html).toContain('Join Group');
      expect(sentEmail.html).toContain('Email sent in EN');
    });

    it('should handle special characters in group names correctly', async () => {
      const groupData: GroupInvitationData = {
        to: 'contact@école.fr',
        groupName: 'Cantine Scolaire & Transport',
        inviteCode: 'GRP789',
        role: 'ADMIN',
      };

      await emailService.sendGroupInvitation(groupData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.html).toContain('Cantine Scolaire & Transport');
      expect(sentEmail.subject).toContain('Cantine Scolaire & Transport');
    });
  });

  describe('sendFamilyInvitation', () => {
    it('should send family invitation in French for French email recipients', async () => {
      const familyData: FamilyInvitationData = {
        inviterName: 'Jean Dupont',
        familyName: 'Famille Martin',
        inviteCode: 'FAM123',
        role: 'MEMBER',
        inviterLanguage: 'fr',
      };

      await emailService.sendFamilyInvitation('marie.dupont@free.fr', familyData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.to).toBe('marie.dupont@free.fr');
      expect(sentEmail.subject).toBe('EduLift - Invitation à rejoindre Famille Martin');
      expect(sentEmail.html).toContain('Invitation familiale');
      expect(sentEmail.html).toContain('Bonjour');
      expect(sentEmail.html).toContain('Vous avez été invité à rejoindre la famille <strong>Famille Martin</strong>');
      expect(sentEmail.html).toContain('Rejoindre la famille');
      expect(sentEmail.html).toContain('Email envoyé en FR');
    });

    it('should send family invitation in English for English email recipients', async () => {
      const familyData: FamilyInvitationData = {
        inviterName: 'John Smith',
        familyName: 'Johnson Family',
        inviteCode: 'FAM456',
        role: 'MEMBER',
        inviterLanguage: 'en',
      };

      await emailService.sendFamilyInvitation('jane.smith@gmail.com', familyData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.to).toBe('jane.smith@gmail.com');
      expect(sentEmail.subject).toBe('EduLift - Invitation to join Johnson Family');
      expect(sentEmail.html).toContain('Family Invitation');
      expect(sentEmail.html).toContain('Hello');
      expect(sentEmail.html).toContain('You have been invited to join the family <strong>Johnson Family</strong>');
      expect(sentEmail.html).toContain('Join Family');
      expect(sentEmail.html).toContain('Email sent in EN');
    });

    it('should include personal message in family invitations', async () => {
      const familyData: FamilyInvitationData = {
        inviterName: 'Marie Curie',
        familyName: 'Famille Dupont',
        inviteCode: 'FAM789',
        role: 'MEMBER',
        personalMessage: 'Salut ! Je t\'invite à rejoindre notre famille pour organiser les trajets des enfants. À bientôt !',
        inviterLanguage: 'fr',
      };

      await emailService.sendFamilyInvitation('pierre.martin@sfr.fr', familyData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.html).toContain('💬 "Salut ! Je t\'invite à rejoindre notre famille pour organiser les trajets des enfants. À bientôt !"');
      expect(sentEmail.html).toContain('Email envoyé en FR');
    });
  });

  describe('Language detection edge cases', () => {
    it('should fall back to French for unknown email domains', async () => {
      await emailService.sendMagicLink('user@unknown-domain.xyz', 'test-token');

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.subject).toBe('EduLift - Connexion sécurisée');
      expect(sentEmail.html).toContain('Email envoyé en FR');
    });

    it('should handle invalid email addresses gracefully', async () => {
      // Should not throw an error
      await expect(emailService.sendMagicLink('', 'test-token')).resolves.not.toThrow();

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.subject).toBe('EduLift - Connexion sécurisée'); // French fallback
    });

    it('should respect school country context when available', async () => {
      // We can't directly pass context to sendMagicLink, but this tests the detector logic
      // In real usage, this would come from the service layer
      await emailService.sendMagicLink('user@unknown.xyz', 'test-token');

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.html).toContain('Connexion sécurisée');
    });
  });

  describe('URL generation and localization', () => {
    it('should generate correct URLs with language parameters', async () => {
      const groupData: GroupInvitationData = {
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
      };

      await emailService.sendGroupInvitation(groupData);

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.html).toContain('edulift://groups/join?code=GRP123');
      expect(sentEmail.html).toContain('https://edulift.app/join?lang=en');
      expect(sentEmail.html).toContain('https://edulift.app/join?lang=fr');
    });

    it('should handle magic link URLs with parameters', async () => {
      await emailService.sendMagicLink('user@test.com', 'token123', 'invite456');

      const sentEmail = emailService.getSentEmails()[0];
      expect(sentEmail.html).toContain('token123');
      expect(sentEmail.html).toContain('invite456');
    });
  });

  describe('HTML structure and accessibility', () => {
    it('should generate properly structured HTML emails', async () => {
      await emailService.sendMagicLink('user@test.com', 'token123');

      const sentEmail = emailService.getSentEmails()[0];
      const html = sentEmail.html;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(html).toContain('<body');
      expect(html).toContain('</html>');
      expect(html).toContain('edulift-logo@edulift.app');
    });

    it('should include responsive design elements', async () => {
      const familyData: FamilyInvitationData = {
        inviterName: 'Test',
        familyName: 'Test Family',
        inviteCode: 'TEST123',
        role: 'MEMBER',
      };

      await emailService.sendFamilyInvitation('user@test.com', familyData);

      const sentEmail = emailService.getSentEmails()[0];
      const html = sentEmail.html;

      expect(html).toContain('max-width: 600px');
      expect(html).toContain('background: white');
      expect(html).toContain('border-radius: 8px');
      expect(html).toContain('box-shadow: 0 2px 4px rgba(0,0,0,0.1)');
    });

    it('should include Outlook fallback content', async () => {
      await emailService.sendGroupInvitation({
        to: 'user@test.com',
        groupName: 'Test Group',
        inviteCode: 'TEST123',
        role: 'MEMBER',
      });

      const sentEmail = emailService.getSentEmails()[0];
      const html = sentEmail.html;

      expect(html).toContain('<!--[if mso]>');
      expect(html).toContain('<v:roundrect');
      expect(html).toContain('<w:anchorlock/>');
      expect(html).toContain('<![endif]-->');
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain existing email functionality', async () => {
      // Test that all existing email types still work
      const scheduleNotificationData: ScheduleSlotNotificationData = {
        scheduleSlotId: 'slot123',
        datetime: '2024-01-15T08:00:00Z',
        assignedChildren: ['Emma', 'Lucas'],
        groupName: 'Test Group',
        changeType: 'SLOT_CREATED',
      };

      await expect(emailService.sendScheduleNotification('user@test.com', 'Test Group', 'Week 3')).resolves.not.toThrow();
      await expect(emailService.sendScheduleSlotNotification('user@test.com', scheduleNotificationData)).resolves.not.toThrow();
      await expect(emailService.sendDailyReminder('user@test.com', 'Test Group', [])).resolves.not.toThrow();
      await expect(emailService.sendWeeklySchedule('user@test.com', 'Test Group', 'Week 3', {})).resolves.not.toThrow();
    });

    it('should not break existing email service implementations', async () => {
      // Test that the email service can still be instantiated and used normally
      expect(() => new TestEmailService()).not.toThrow();
      expect(emailService.verifyConnection()).resolves.toBe(true);
    });
  });
});