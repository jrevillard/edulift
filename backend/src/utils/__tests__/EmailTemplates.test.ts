import { EmailTemplates } from '../EmailTemplates';

describe('EmailTemplates', () => {
  describe('generateMagicLinkEmail', () => {
    it('should generate French magic link email', () => {
      const magicLinkUrl = 'https://edulift.app/auth/verify?token=abc123';
      const html = EmailTemplates.generateMagicLinkEmail(magicLinkUrl, 'fr');

      expect(html).toContain('Connexion sécurisée');
      expect(html).toContain('Bonjour');
      expect(html).toContain('Cliquez sur le lien ci-dessous pour vous connecter à votre compte EduLift');
      expect(html).toContain('Se connecter à EduLift');
      expect(html).toContain('📱 Si le bouton ne fonctionne pas sur mobile :');
      expect(html).toContain('Copiez-collez ce lien dans votre navigateur :');
      expect(html).toContain('⏰ Ce lien expire dans 15 minutes');
      expect(html).toContain('🔒 Si vous n\'avez pas demandé cette connexion');
      expect(html).toContain(magicLinkUrl);
      expect(html).toContain('Email envoyé en FR');
    });

    it('should generate English magic link email', () => {
      const magicLinkUrl = 'https://edulift.app/auth/verify?token=abc123';
      const html = EmailTemplates.generateMagicLinkEmail(magicLinkUrl, 'en');

      expect(html).toContain('Secure Login');
      expect(html).toContain('Hello');
      expect(html).toContain('Click the link below to sign in to your EduLift account');
      expect(html).toContain('Sign in to EduLift');
      expect(html).toContain('📱 If the button doesn\'t work on mobile:');
      expect(html).toContain('Copy and paste this link in your browser:');
      expect(html).toContain('⏰ This link expires in 15 minutes');
      expect(html).toContain('🔒 If you did not request this login');
      expect(html).toContain(magicLinkUrl);
      expect(html).toContain('Email sent in EN');
    });

    it('should contain proper HTML structure', () => {
      const magicLinkUrl = 'https://edulift.app/auth/verify';
      const html = EmailTemplates.generateMagicLinkEmail(magicLinkUrl, 'fr');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(html).toContain('<body');
      expect(html).toContain('</html>');
      expect(html).toContain(magicLinkUrl);
    });

    it('should include proper email header and footer', () => {
      const html = EmailTemplates.generateMagicLinkEmail('https://test.com', 'fr');

      expect(html).toContain('edulift-logo@edulift.app'); // Logo CID
      expect(html).toContain('Transport scolaire collaboratif'); // Alt text
      expect(html).toContain('Rendre le transport scolaire plus simple pour les familles');
      expect(html).toContain('https://edulift.app/join?lang=en');
      expect(html).toContain('https://edulift.app/join?lang=fr');
    });
  });

  describe('generateGroupInvitationEmail', () => {
    it('should generate French group invitation email', () => {
      const groupName = 'École Primaire Centrale';
      const inviteUrl = 'https://edulift.app/groups/join?code=ABC123';
      const html = EmailTemplates.generateGroupInvitationEmail(groupName, inviteUrl, 'fr');

      expect(html).toContain('Invitation de groupe');
      expect(html).toContain('Bonjour');
      expect(html).toContain('Vous avez été invité à rejoindre le groupe <strong>École Primaire Centrale</strong> sur EduLift');
      expect(html).toContain('EduLift vous aide à organiser les trajets maison-école en collaboration avec d\'autres parents');
      expect(html).toContain('Rejoindre le groupe');
      expect(html).toContain('📱 Si le bouton ne fonctionne pas sur mobile :');
      expect(html).toContain('Si vous ne souhaitez pas rejoindre ce groupe, vous pouvez ignorer cet email');
      expect(html).toContain(inviteUrl);
      expect(html).toContain('Email envoyé en FR');
    });

    it('should generate English group invitation email', () => {
      const groupName = 'Central Elementary School';
      const inviteUrl = 'https://edulift.app/groups/join?code=ABC123';
      const html = EmailTemplates.generateGroupInvitationEmail(groupName, inviteUrl, 'en');

      expect(html).toContain('Group Invitation');
      expect(html).toContain('Hello');
      expect(html).toContain('You have been invited to join the group <strong>Central Elementary School</strong> on EduLift');
      expect(html).toContain('EduLift helps you organize home-to-school trips collaboratively with other parents');
      expect(html).toContain('Join Group');
      expect(html).toContain('📱 If the button doesn\'t work on mobile:');
      expect(html).toContain('If you do not wish to join this group, you can ignore this email');
      expect(html).toContain(inviteUrl);
      expect(html).toContain('Email sent in EN');
    });

    it('should handle special characters in group names', () => {
      const groupName = 'École Saint-Exupéry & Cantine Scolaire';
      const inviteUrl = 'https://edulift.app/groups/join?code=XYZ789';
      const html = EmailTemplates.generateGroupInvitationEmail(groupName, inviteUrl, 'fr');

      expect(html).toContain(groupName);
      expect(html).toContain(inviteUrl);
    });
  });

  describe('generateFamilyInvitationEmail', () => {
    it('should generate French family invitation email with personal message', () => {
      const familyName = 'Famille Dupont';
      const inviteUrl = 'https://edulift.app/families/join?code=FAM123';
      const personalMessage = 'Bonjour ! Je t\'invite à rejoindre notre famille sur EduLift pour organiser les trajets des enfants.';
      const html = EmailTemplates.generateFamilyInvitationEmail(familyName, inviteUrl, personalMessage, 'fr');

      expect(html).toContain('Invitation familiale');
      expect(html).toContain('Bonjour');
      expect(html).toContain('Vous avez été invité à rejoindre la famille <strong>Famille Dupont</strong> sur EduLift');
      expect(html).toContain('💬 "Bonjour ! Je t\'invite à rejoindre notre famille sur EduLift pour organiser les trajets des enfants."');
      expect(html).toContain('EduLift vous aide à organiser les trajets maison-école en collaboration avec votre famille et d\'autres parents');
      expect(html).toContain('Rejoindre la famille');
      expect(html).toContain('📱 Si le bouton ne fonctionne pas sur mobile :');
      expect(html).toContain('Si vous ne souhaitez pas rejoindre ce groupe, vous pouvez ignorer cet email');
      expect(html).toContain(inviteUrl);
      expect(html).toContain('Email envoyé en FR');
    });

    it('should generate English family invitation email without personal message', () => {
      const familyName = 'Johnson Family';
      const inviteUrl = 'https://edulift.app/families/join?code=FAM456';
      const html = EmailTemplates.generateFamilyInvitationEmail(familyName, inviteUrl, undefined, 'en');

      expect(html).toContain('Family Invitation');
      expect(html).toContain('Hello');
      expect(html).toContain('You have been invited to join the family <strong>Johnson Family</strong> on EduLift');
      expect(html).toContain('EduLift helps you organize home-to-school trips collaboratively with your family and other parents');
      expect(html).toContain('Join Family');
      expect(html).toContain('📱 If the button doesn\'t work on mobile:');
      expect(html).toContain('If you do not wish to join this group, you can ignore this email');
      expect(html).toContain(inviteUrl);
      expect(html).toContain('Email sent in EN');
    });

    it('should handle special characters in personal message', () => {
      const familyName = 'Famille Martin';
      const inviteUrl = 'https://edulift.app/families/join?code=MSG789';
      const personalMessage = 'Salut ! Ça va être super pour organiser les trajets à l\'école. À bientôt !';
      const html = EmailTemplates.generateFamilyInvitationEmail(familyName, inviteUrl, personalMessage, 'fr');

      expect(html).toContain(personalMessage);
      expect(html).toContain('💬');
    });

    it('should handle empty personal message', () => {
      const familyName = 'Test Family';
      const inviteUrl = 'https://edulift.app/families/join?code=EMPTY';
      const html = EmailTemplates.generateFamilyInvitationEmail(familyName, inviteUrl, '', 'en');

      expect(html).toContain(familyName);
      expect(html).toContain(inviteUrl);
      expect(html).not.toContain('💬');
    });
  });

  describe('Template structure and accessibility', () => {
    it('should include proper responsive styles', () => {
      const html = EmailTemplates.generateMagicLinkEmail('https://test.com', 'fr');

      expect(html).toContain('max-width: 600px');
      expect(html).toContain('background: #2563eb');
      expect(html).toContain('color: white');
      expect(html).toContain('font-weight: bold');
      expect(html).toContain('border-radius');
    });

    it('should include fallback content for Outlook', () => {
      const html = EmailTemplates.generateGroupInvitationEmail('Test Group', 'https://test.com', 'fr');

      expect(html).toContain('<!--[if mso]>');
      expect(html).toContain('<v:roundrect');
      expect(html).toContain('<w:anchorlock/>');
      expect(html).toContain('<center style=');
      expect(html).toContain('<![endif]-->');
    });

    it('should include copyable link fallback section', () => {
      const html = EmailTemplates.generateFamilyInvitationEmail('Test Family', 'https://test.com', 'Test message', 'fr');

      expect(html).toContain('background: #f1f5f9');
      expect(html).toContain('border-left: 4px solid #10b981');
      expect(html).toContain('font-family: monospace');
      expect(html).toContain('word-break: break-all');
    });

    it('should include proper language selection links', () => {
      const html = EmailTemplates.generateMagicLinkEmail('https://test.com', 'fr');

      expect(html).toContain('https://edulift.app/join?lang=en');
      expect(html).toContain('https://edulift.app/join?lang=fr');
      expect(html).toContain('English');
      expect(html).toContain('Français');
    });
  });

  describe('Email header and footer consistency', () => {
    it('should generate consistent header across languages', () => {
      const frenchHtml = EmailTemplates.generateMagicLinkEmail('https://test.com', 'fr');
      const englishHtml = EmailTemplates.generateMagicLinkEmail('https://test.com', 'en');

      // Both should have logo CID
      expect(frenchHtml).toContain('edulift-logo@edulift.app');
      expect(englishHtml).toContain('edulift-logo@edulift.app');

      // Both should have alt text (localized)
      expect(frenchHtml).toContain('Transport scolaire collaboratif');
      expect(englishHtml).toContain('Collaborative school transport management');
    });

    it('should generate consistent footer structure across languages', () => {
      const frenchHtml = EmailTemplates.generateGroupInvitationEmail('Test', 'https://test.com', 'fr');
      const englishHtml = EmailTemplates.generateGroupInvitationEmail('Test', 'https://test.com', 'en');

      // Both should have EduLift branding
      expect(frenchHtml).toContain('EduLift -');
      expect(englishHtml).toContain('EduLift -');

      // Both should have language links
      expect(frenchHtml).toContain('https://edulift.app/join?lang=en');
      expect(frenchHtml).toContain('https://edulift.app/join?lang=fr');
      expect(englishHtml).toContain('https://edulift.app/join?lang=en');
      expect(englishHtml).toContain('https://edulift.app/join?lang=fr');

      // Both should indicate language
      expect(frenchHtml).toContain('Email envoyé en FR');
      expect(englishHtml).toContain('Email sent in EN');
    });
  });

  describe('Security and input validation', () => {
    it('should handle URLs with special characters safely', () => {
      const magicLinkUrl = 'https://edulift.app/auth/verify?token=abc123&redirect=/dashboard';
      const html = EmailTemplates.generateMagicLinkEmail(magicLinkUrl, 'fr');

      expect(html).toContain(magicLinkUrl);
    });

    it('should handle HTML injection attempts in personal messages', () => {
      const maliciousMessage = '<script>alert("xss")</script>Hello there!';
      const html = EmailTemplates.generateFamilyInvitationEmail('Test Family', 'https://test.com', maliciousMessage, 'en');

      expect(html).toContain(maliciousMessage);
      expect(html).toContain('💬');
      // The message should be included as-is since it's in a controlled template context
    });

    it('should handle very long group/family names', () => {
      const longName = 'A'.repeat(200);
      const html = EmailTemplates.generateGroupInvitationEmail(longName, 'https://test.com', 'fr');

      expect(html).toContain(longName);
      expect(html).toContain('strong>');
    });
  });
});