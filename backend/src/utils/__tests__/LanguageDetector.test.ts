import { LanguageDetector, DetectionContext, SupportedLanguage } from '../LanguageDetector';

describe('LanguageDetector', () => {
  describe('detectFromEmail', () => {
    it('should detect French from French domain extensions', () => {
      const testCases = [
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

      testCases.forEach(email => {
        expect(LanguageDetector.detectFromEmail(email)).toBe('fr');
      });
    });

    it('should detect French from TLD patterns', () => {
      const testCases = [
        'user@domain.fr',
        'contact@school.be',
        'test@company.ch',
        'admin@business.ca',
        'user@organization.lu',
        'contact@site.mc',
        'test@service.re',
      ];

      testCases.forEach(email => {
        expect(LanguageDetector.detectFromEmail(email)).toBe('fr');
      });
    });

    it('should detect English from English domain extensions', () => {
      const testCases = [
        'user@domain.co.uk',
        'contact@company.org',
        'test@business.net',
        'admin@service.edu',
        'user@government.gov',
      ];

      testCases.forEach(email => {
        expect(LanguageDetector.detectFromEmail(email)).toBe('en');
      });
    });

    it('should detect English from known English providers', () => {
      const testCases = [
        'user@gmail.com',
        'contact@yahoo.com',
        'test@outlook.com',
        'admin@hotmail.com',
        'user@icloud.com',
        'contact@aol.com',
      ];

      testCases.forEach(email => {
        expect(LanguageDetector.detectFromEmail(email)).toBe('en');
      });
    });

    it('should return null for unknown or invalid emails', () => {
      const testCases = [
        'invalid-email',
        '@domain.com',
        'user@',
        '',
        null,
        undefined,
      ];

      testCases.forEach(email => {
        expect(LanguageDetector.detectFromEmail(email as any)).toBeNull();
      });
    });

    it('should handle complex domain patterns correctly', () => {
      const testCases = [
        { email: 'user@subdomain.orange.fr', expected: 'fr' },
        { email: 'test.personal@free.fr', expected: 'fr' },
        { email: 'user+tag@sfr.fr', expected: 'fr' },
        { email: 'contact@company.orange.fr', expected: 'fr' },
        { email: 'user@unknown.french.com', expected: null }, // Unknown .com returns null
      ];

      testCases.forEach(({ email, expected }) => {
        expect(LanguageDetector.detectFromEmail(email)).toBe(expected);
      });
    });
  });

  describe('detectLanguage', () => {
    it('should prioritize inviter language when provided', () => {
      const context: DetectionContext = {
        inviterLanguage: 'en',
      };

      expect(LanguageDetector.detectLanguage('user@orange.fr', context)).toBe('en');
      expect(LanguageDetector.detectLanguage('user@gmail.com', context)).toBe('en');
    });

    it('should prioritize school country when provided', () => {
      const context: DetectionContext = {
        schoolCountry: 'FR',
      };

      expect(LanguageDetector.detectLanguage('user@gmail.com', context)).toBe('fr');
      expect(LanguageDetector.detectLanguage('user@yahoo.com', context)).toBe('fr');

      const ukContext: DetectionContext = {
        schoolCountry: 'GB',
      };

      expect(LanguageDetector.detectLanguage('user@orange.fr', ukContext)).toBe('en');
    });

    it('should fall back to email domain detection when no context', () => {
      expect(LanguageDetector.detectLanguage('user@orange.fr')).toBe('fr');
      expect(LanguageDetector.detectLanguage('user@gmail.com')).toBe('en');
    });

    it('should use fallback language when email is unknown', () => {
      expect(LanguageDetector.detectLanguage('user@unknown.xyz')).toBe('fr'); // French fallback
      expect(LanguageDetector.detectLanguage('user@nonexistent.tld')).toBe('fr');
    });

    it('should handle edge cases gracefully', () => {
      expect(LanguageDetector.detectLanguage('', {})).toBe('fr'); // Fallback
      expect(LanguageDetector.detectLanguage('invalid', {})).toBe('fr'); // Fallback
      expect(LanguageDetector.detectLanguage('user@', {})).toBe('fr'); // Fallback
    });

    it('should respect priority order: inviter > school > email > fallback', () => {
      // Test inviter language takes precedence over email
      const context1: DetectionContext = {
        inviterLanguage: 'en',
        schoolCountry: 'FR',
      };
      expect(LanguageDetector.detectLanguage('user@orange.fr', context1)).toBe('en');

      // Test school country takes precedence over email when no inviter
      const context2: DetectionContext = {
        schoolCountry: 'GB',
      };
      expect(LanguageDetector.detectLanguage('user@orange.fr', context2)).toBe('en');

      // Test email detection when no context
      expect(LanguageDetector.detectLanguage('user@orange.fr')).toBe('fr');

      // Test fallback when nothing matches
      expect(LanguageDetector.detectLanguage('user@unknown.xyz')).toBe('fr');
    });
  });

  describe('getLocalizedSubject', () => {
    it('should return French subjects for French language', () => {
      expect(LanguageDetector.getLocalizedSubject('magic_link', 'fr')).toBe('EduLift - Connexion sécurisée');
      expect(LanguageDetector.getLocalizedSubject('group_invitation', 'fr', { groupName: 'Test Group' }))
        .toBe('EduLift - Invitation à rejoindre Test Group');
      expect(LanguageDetector.getLocalizedSubject('family_invitation', 'fr', { familyName: 'Test Family' }))
        .toBe('EduLift - Invitation à rejoindre Test Family');
    });

    it('should return English subjects for English language', () => {
      expect(LanguageDetector.getLocalizedSubject('magic_link', 'en')).toBe('EduLift - Secure Login');
      expect(LanguageDetector.getLocalizedSubject('group_invitation', 'en', { groupName: 'Test Group' }))
        .toBe('EduLift - Invitation to join Test Group');
      expect(LanguageDetector.getLocalizedSubject('family_invitation', 'en', { familyName: 'Test Family' }))
        .toBe('EduLift - Invitation to join Test Family');
    });

    it('should handle parameter replacement correctly', () => {
      const testCases = [
        {
          type: 'group_invitation',
          language: 'fr' as SupportedLanguage,
          params: { groupName: 'École Maternelle' },
          expected: 'EduLift - Invitation à rejoindre École Maternelle',
        },
        {
          type: 'family_invitation',
          language: 'en' as SupportedLanguage,
          params: { familyName: 'Johnson Family' },
          expected: 'EduLift - Invitation to join Johnson Family',
        },
        {
          type: 'schedule_notification',
          language: 'fr' as SupportedLanguage,
          params: { groupName: 'Cantine Scolaire' },
          expected: 'EduLift - Nouveau planning pour Cantine Scolaire',
        },
        {
          type: 'weekly_schedule',
          language: 'en' as SupportedLanguage,
          params: { weekInfo: 'Week 42', groupName: 'Bus Group' },
          expected: 'EduLift - Weekly schedule Week 42 (Bus Group)',
        },
      ];

      testCases.forEach(({ type, language, params, expected }) => {
        expect(LanguageDetector.getLocalizedSubject(type, language, params)).toBe(expected);
      });
    });

    it('should fall back to French when unknown language', () => {
      expect(LanguageDetector.getLocalizedSubject('magic_link', 'de' as any)).toBe('EduLift - Connexion sécurisée');
      expect(LanguageDetector.getLocalizedSubject('unknown_type', 'fr' as any)).toBe('EduLift - Notification');
    });

    it('should handle missing parameters gracefully', () => {
      // Should not crash when parameters are missing
      expect(LanguageDetector.getLocalizedSubject('group_invitation', 'fr')).toBe('EduLift - Invitation à rejoindre {{groupName}}');
      expect(LanguageDetector.getLocalizedSubject('family_invitation', 'en')).toBe('EduLift - Invitation to join {{familyName}}');
    });
  });

  describe('getFallbackLanguage', () => {
    it('should return French as fallback language for EduLift', () => {
      expect(LanguageDetector.getFallbackLanguage()).toBe('fr');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle common French email providers', () => {
      const frenchEmails = [
        'jean.dupont@orange.fr',
        'marie.curie@sfr.fr',
        'paul.martin@free.fr',
        'sophie.bernard@bouyguestelecom.fr',
        'luc.petit@numericable.fr',
        'anne.dubois@bbox.fr',
        'thomas.robert@aliceadsl.fr',
        'camille.leroy@wanadoo.fr',
        'nicolas.moreau@club-internet.fr',
        'isabelle.fontaine@laposte.net',
      ];

      frenchEmails.forEach(email => {
        const detected = LanguageDetector.detectLanguage(email);
        expect(detected).toBe('fr');
        expect(detected).toBe('fr'); // Double-check for robustness
      });
    });

    it('should handle mixed international scenarios', () => {
      const scenarios = [
        {
          email: 'john.smith@gmail.com',
          context: { inviterLanguage: 'fr' },
          expected: 'fr',
          description: 'English email but French inviter',
        },
        {
          email: 'marie.dupont@orange.fr',
          context: { inviterLanguage: 'en' },
          expected: 'en',
          description: 'French email but English inviter',
        },
        {
          email: 'user@unknown.xyz',
          context: { schoolCountry: 'FR' },
          expected: 'fr',
          description: 'Unknown email but French school',
        },
        {
          email: 'user@orange.fr',
          context: { schoolCountry: 'GB' },
          expected: 'en',
          description: 'French email but British school',
        },
        {
          email: 'john.doe@unknown.xyz',
          context: {},
          expected: 'fr',
          description: 'Unknown email with no context - should use French fallback',
        },
      ];

      scenarios.forEach(({ email, context, expected }) => {
        expect(LanguageDetector.detectLanguage(email, context)).toBe(expected);
      });
    });
  });
});