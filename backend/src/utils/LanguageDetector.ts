/**
 * Simple language detector for emails based on email domain and context
 * Prioritizes French for EduLift's target markets (France, Belgium, Switzerland, Canada)
 */

export interface DetectionContext {
  inviterLanguage?: string;
  schoolCountry?: string;
  groupContext?: string;
  [key: string]: any; // Allow additional properties
}

export type SupportedLanguage = 'fr' | 'en';

export class LanguageDetector {
  private static readonly DOMAIN_PATTERNS: Record<string, SupportedLanguage> = {
    // French domains
    '.fr': 'fr',
    '.be': 'fr', // Belgium - prioritize French (60% French speakers)
    '.ch': 'fr', // Switzerland - prioritize French
    '.ca': 'fr', // Canada - prioritize French (Quebec)
    '.lu': 'fr', // Luxembourg
    '.mc': 'fr', // Monaco
    '.re': 'fr', // Réunion
    '.mq': 'fr', // Martinique
    '.gp': 'fr', // Guadeloupe
    '.nc': 'fr', // New Caledonia

    // French ISPs
    'orange.fr': 'fr',
    'sfr.fr': 'fr',
    'free.fr': 'fr',
    'bouyguestelecom.fr': 'fr',
    'numericable.fr': 'fr',
    'bbox.fr': 'fr',
    'aliceadsl.fr': 'fr',
    'wanadoo.fr': 'fr',
    'club-internet.fr': 'fr',

    // Belgian ISPs
    'skynet.be': 'fr',
    'belgacom.be': 'fr',
    'proximus.be': 'fr',
    'voo.be': 'fr',
    'telenet.be': 'fr',

    // Swiss ISPs
    'bluewin.ch': 'fr',
    'swisscom.ch': 'fr',
    'sunrise.ch': 'fr',

    // Canadian ISPs (Quebec)
    'videotron.ca': 'fr',
    'bell.ca': 'fr',
    'sympatico.ca': 'fr',

    // Generic French indicators
    'laposte.net': 'fr',

    // English providers
    'gmail.com': 'en',
    'yahoo.com': 'en',
    'outlook.com': 'en',
    'hotmail.com': 'en',
    'icloud.com': 'en',
    'aol.com': 'en',

    // English domains (fallbacks)
    '.co.uk': 'en',
    // Note: .com is handled separately to check for specific providers first
    '.org': 'en',
    '.net': 'en',
    '.edu': 'en',
    '.gov': 'en',
  };

  /**
   * Detect language from email address
   */
  static detectFromEmail(email: string): SupportedLanguage | null {
    if (!email || !email.includes('@')) {
      return null;
    }

    const domain = email.toLowerCase().split('@')[1];
    if (!domain) {
      return null;
    }

    // Check exact domain matches first
    if (this.DOMAIN_PATTERNS[domain]) {
      return this.DOMAIN_PATTERNS[domain];
    }

    // Check TLD patterns
    for (const [pattern, language] of Object.entries(this.DOMAIN_PATTERNS)) {
      if (pattern.startsWith('.') && domain.endsWith(pattern)) {
        return language;
      }
    }

    // Check if domain contains French indicators
    if (domain.includes('orange') ||
        domain.includes('sfr') ||
        domain.includes('free') ||
        domain.includes('laposte') ||
        domain.includes('bouygues') ||
        domain.includes('numericable')) {
      return 'fr';
    }

    // Handle .com specially - only treat as English if it's a known English provider
    if (domain.endsWith('.com')) {
      const englishProviders = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'aol'];
      if (englishProviders.some(provider => domain.includes(provider))) {
        return 'en';
      }
      // Unknown .com domain - treat as unknown for better detection accuracy
      return null;
    }

    return null; // Unknown
  }

  /**
   * Get fallback language with preference for French (EduLift's target market)
   */
  static getFallbackLanguage(): SupportedLanguage {
    return 'fr'; // EduLift is Franco-Belgian, prioritize French
  }

  /**
   * Detect language combining email analysis with context
   */
  static detectLanguage(email: string, context: DetectionContext = {}): SupportedLanguage {
    // 1. Check explicit context first
    if (context.inviterLanguage && ['fr', 'en'].includes(context.inviterLanguage)) {
      return context.inviterLanguage as SupportedLanguage;
    }

    // 2. Check school context
    if (context.schoolCountry) {
      const countryLanguages: Record<string, SupportedLanguage> = {
        FR: 'fr',
        BE: 'fr',
        CH: 'fr',
        LU: 'fr',
        CA: 'fr',
        GB: 'en',
        US: 'en',
        IE: 'en',
        AU: 'en',
        NZ: 'en',
      };
      if (countryLanguages[context.schoolCountry]) {
        return countryLanguages[context.schoolCountry];
      }
    }

    // 3. Check email domain
    const emailLanguage = this.detectFromEmail(email);
    if (emailLanguage) {
      return emailLanguage;
    }

    // 4. Fallback to French (EduLift's primary market)
    return this.getFallbackLanguage();
  }

  /**
   * Get localized subject line
   */
  static getLocalizedSubject(type: string, language: SupportedLanguage, params?: Record<string, string>): string {
    const subjects: Record<string, Record<SupportedLanguage, string>> = {
      magic_link: {
        fr: 'EduLift - Connexion sécurisée',
        en: 'EduLift - Secure Login',
      },
      group_invitation: {
        fr: 'EduLift - Invitation à rejoindre {{groupName}}',
        en: 'EduLift - Invitation to join {{groupName}}',
      },
      family_invitation: {
        fr: 'EduLift - Invitation à rejoindre {{familyName}}',
        en: 'EduLift - Invitation to join {{familyName}}',
      },
      schedule_notification: {
        fr: 'EduLift - Nouveau planning pour {{groupName}}',
        en: 'EduLift - New schedule for {{groupName}}',
      },
      daily_reminder: {
        fr: 'EduLift - Rappel pour demain ({{groupName}})',
        en: 'EduLift - Reminder for tomorrow ({{groupName}})',
      },
      weekly_schedule: {
        fr: 'EduLift - Planning hebdomadaire {{weekInfo}} ({{groupName}})',
        en: 'EduLift - Weekly schedule {{weekInfo}} ({{groupName}})',
      },
    };

    let subject = subjects[type]?.[language] || subjects[type]?.['fr'] || 'EduLift - Notification';

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        subject = subject.replace(`{{${key}}}`, value);
      });
    }

    return subject;
  }
}