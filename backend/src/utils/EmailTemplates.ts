/**
 * Multilingual email templates for EduLift
 * Supports French (fr) and English (en) with automatic language detection
 */

import { SupportedLanguage } from './LanguageDetector';

export interface EmailTemplateData {
  language: SupportedLanguage;
  [key: string]: any;
}

export class EmailTemplates {
  private static readonly TRANSLATIONS = {
    fr: {
      common: {
        hello: 'Bonjour',
        click_here: 'Cliquez ici',
        sign_in: 'Se connecter',
        view_schedule: 'Voir le planning',
        join_group: 'Rejoindre le groupe',
        join_family: 'Rejoindre la famille',
        copy_paste_mobile: '📱 Si le bouton ne fonctionne pas sur mobile :',
        copy_link: 'Copiez-collez ce lien dans votre navigateur :',
        ignore_email: 'Si vous ne souhaitez pas rejoindre ce groupe, vous pouvez ignorer cet email.',
        link_expires: '⏰ Ce lien expire dans 15 minutes et ne peut être utilisé qu\'une seule fois.',
        secure_login: '🔒 Si vous n\'avez pas demandé cette connexion, vous pouvez ignorer cet email en toute sécurité.',
        making_transportation_easier: 'Rendre le transport scolaire plus simple pour les familles.',
        collaborative_school_transport: 'Transport scolaire collaboratif',
      },
      magic_link: {
        subject: 'EduLift - Connexion sécurisée',
        title: 'Connexion sécurisée',
        greeting: 'Bonjour,',
        instruction: 'Cliquez sur le lien ci-dessous pour vous connecter à votre compte EduLift :',
        button_text: 'Se connecter à EduLift',
      },
      group_invitation: {
        subject: 'EduLift - Invitation à rejoindre {{groupName}}',
        title: 'Invitation de groupe',
        greeting: 'Bonjour,',
        invited_to_group: 'Vous avez été invité à rejoindre le groupe <strong>{{groupName}}</strong> sur EduLift.',
        app_description: 'EduLift vous aide à organiser les trajets maison-école en collaboration avec d\'autres parents.',
        button_text: 'Rejoindre le groupe',
      },
      family_invitation: {
        subject: 'EduLift - Invitation à rejoindre {{familyName}}',
        title: 'Invitation familiale',
        greeting: 'Bonjour,',
        invited_to_family: 'Vous avez été invité à rejoindre la famille <strong>{{familyName}}</strong> sur EduLift.',
        app_description: 'EduLift vous aide à organiser les trajets maison-école en collaboration avec votre famille et d\'autres parents.',
        button_text: 'Rejoindre la famille',
        ignore_email: 'Si vous ne souhaitez pas rejoindre cette famille, vous pouvez ignorer cet email.',
      },
      schedule_notification: {
        subject: 'EduLift - Nouveau planning disponible pour {{groupName}}',
        title: 'Nouveau planning',
        greeting: 'Bonjour,',
        new_schedule_published: 'Un nouveau planning a été publié pour le groupe <strong>{{groupName}}</strong>.',
        week_label: 'Semaine :',
        sign_in_to_view: 'Connectez-vous à EduLift pour voir les détails et organiser vos trajets.',
        button_text: 'Voir le planning',
      },
      slot_notification: {
        slot_created: 'EduLift - Nouveau créneau créé ({{time}})',
        driver_assigned: 'EduLift - Conducteur assigné ({{time}})',
        vehicle_assigned: 'EduLift - Véhicule assigné ({{time}})',
        child_added: 'EduLift - Enfant ajouté au créneau ({{time}})',
        child_removed: 'EduLift - Enfant retiré du créneau ({{time}})',
        slot_cancelled: 'EduLift - Créneau annulé ({{time}})',
        slot_modified: 'EduLift - Modification du créneau ({{time}})',
        group_label: 'Groupe :',
        vehicle_label: 'Véhicule :',
        driver_label: 'Conducteur :',
        capacity_label: 'Capacité totale :',
        children_label: 'Enfants :',
        seats_label: 'places',
        sign_in_to_see_details: 'Connectez-vous à EduLift pour voir tous les détails et gérer vos créneaux.',
      },
      daily_reminder: {
        subject: 'EduLift - Rappel pour les trajets de demain ({{groupName}})',
        title: 'Rappel pour demain',
        greeting: 'Bonjour,',
        reminder_text: 'Voici un rappel des créneaux prévus pour demain pour le groupe <strong>{{groupName}}</strong> :',
        dont_forget: 'N\'oubliez pas de vérifier les horaires et de coordonner avec les autres parents.',
        button_text: 'Voir le planning',
      },
      weekly_schedule: {
        subject: 'EduLift - Planning hebdomadaire {{weekInfo}} ({{groupName}})',
        title: 'Planning hebdomadaire',
        greeting: 'Bonjour,',
        schedule_text: 'Voici le planning pour la semaine {{weekInfo}} du groupe <strong>{{groupName}}</strong>.',
        sign_in_to_manage: 'Connectez-vous à EduLift pour voir tous les détails et gérer vos trajets.',
        button_text: 'Voir le planning',
      },
    },
    en: {
      common: {
        hello: 'Hello',
        click_here: 'Click here',
        sign_in: 'Sign in to EduLift',
        view_schedule: 'View Schedule',
        join_group: 'Join Group',
        join_family: 'Join Family',
        copy_paste_mobile: '📱 If the button doesn\'t work on mobile:',
        copy_link: 'Copy and paste this link in your browser:',
        ignore_email: 'If you do not wish to join this group, you can ignore this email.',
        link_expires: '⏰ This link expires in 15 minutes and can only be used once.',
        secure_login: '🔒 If you did not request this login, you can safely ignore this email.',
        making_transportation_easier: 'Making school transportation easier for families.',
        collaborative_school_transport: 'Collaborative school transport management',
      },
      magic_link: {
        subject: 'EduLift - Secure Login',
        title: 'Secure Login',
        greeting: 'Hello,',
        instruction: 'Click the link below to sign in to your EduLift account:',
        button_text: 'Sign in to EduLift',
      },
      group_invitation: {
        subject: 'EduLift - Invitation to join {{groupName}}',
        title: 'Group Invitation',
        greeting: 'Hello,',
        invited_to_group: 'You have been invited to join the group <strong>{{groupName}}</strong> on EduLift.',
        app_description: 'EduLift helps you organize home-to-school trips collaboratively with other parents.',
        button_text: 'Join Group',
      },
      family_invitation: {
        subject: 'EduLift - Invitation to join {{familyName}}',
        title: 'Family Invitation',
        greeting: 'Hello,',
        invited_to_family: 'You have been invited to join the family <strong>{{familyName}}</strong> on EduLift.',
        app_description: 'EduLift helps you organize home-to-school trips collaboratively with your family and other parents.',
        button_text: 'Join Family',
        ignore_email: 'If you do not wish to join this family, you can ignore this email.',
      },
      schedule_notification: {
        subject: 'EduLift - New schedule available for {{groupName}}',
        title: 'New Schedule',
        greeting: 'Hello,',
        new_schedule_published: 'A new schedule has been published for the group <strong>{{groupName}}</strong>.',
        week_label: 'Week:',
        sign_in_to_view: 'Sign in to EduLift to view the details and organize your trips.',
        button_text: 'View Schedule',
      },
      slot_notification: {
        slot_created: 'EduLift - New slot created ({{time}})',
        driver_assigned: 'EduLift - Driver assigned ({{time}})',
        vehicle_assigned: 'EduLift - Vehicle assigned ({{time}})',
        child_added: 'EduLift - Child added to slot ({{time}})',
        child_removed: 'EduLift - Child removed from slot ({{time}})',
        slot_cancelled: 'EduLift - Slot cancelled ({{time}})',
        slot_modified: 'EduLift - Slot modification ({{time}})',
        group_label: 'Group:',
        vehicle_label: 'Vehicle:',
        driver_label: 'Driver:',
        capacity_label: 'Total capacity:',
        children_label: 'Children:',
        seats_label: 'seats',
        sign_in_to_see_details: 'Sign in to EduLift to see all details and manage your slots.',
      },
      daily_reminder: {
        subject: 'EduLift - Reminder for tomorrow\'s trips ({{groupName}})',
        title: 'Tomorrow\'s Reminder',
        greeting: 'Hello,',
        reminder_text: 'Here is a reminder of the slots scheduled for tomorrow for the group <strong>{{groupName}}</strong>:',
        dont_forget: 'Don\'t forget to check the times and coordinate with other parents.',
        button_text: 'View Schedule',
      },
      weekly_schedule: {
        subject: 'EduLift - Weekly schedule {{weekInfo}} ({{groupName}})',
        title: 'Weekly Schedule',
        greeting: 'Hello,',
        schedule_text: 'Here is the schedule for week {{weekInfo}} for the group <strong>{{groupName}}</strong>.',
        sign_in_to_manage: 'Sign in to EduLift to see all details and manage your trips.',
        button_text: 'View Schedule',
      },
    },
  };

  private static t(language: SupportedLanguage, category: string, key: string): string {
    const langTranslations = this.TRANSLATIONS[language] || this.TRANSLATIONS.fr;
    const categoryTranslations = langTranslations[category as keyof typeof langTranslations];
    if (categoryTranslations && typeof categoryTranslations === 'object') {
      return (categoryTranslations as any)[key] || (this.TRANSLATIONS.fr[category as keyof typeof this.TRANSLATIONS.fr] as any)?.[key] || key;
    }
    return key;
  }

  private static replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  /**
   * Generate email header with localized alt text
   */
  static generateEmailHeader(language: SupportedLanguage): string {
    const altText = this.t(language, 'common', 'collaborative_school_transport');
    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <!-- Embedded image using CID -->
        <div style="text-align: center;">
          <img src="cid:edulift-logo@edulift.app" alt="${altText}"
               width="64" height="64"
               style="max-width: 64px; height: auto; display: inline-block; margin: 0 auto;"
               border="0" />
        </div>
      </div>
    `;
  }

  /**
   * Generate email footer with localized text and language selection
   */
  static generateEmailFooter(language: SupportedLanguage): string {
    const tagline = this.t(language, 'common', 'making_transportation_easier');

    return `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px; text-align: center;">
        EduLift - ${tagline}<br>
        <small>
          ${language === 'fr' ? 'Email envoyé en' : 'Email sent in'} ${language.toUpperCase()} •
          <a href="https://edulift.app/join?lang=en" style="color: #666;">English</a> •
          <a href="https://edulift.app/join?lang=fr" style="color: #666;">Français</a>
        </small>
      </p>
    `;
  }

  /**
   * Generate magic link email with localized content
   */
  static generateMagicLinkEmail(magicLinkUrl: string, language: SupportedLanguage): string {
    const title = this.t(language, 'magic_link', 'title');
    const greeting = this.t(language, 'magic_link', 'greeting');
    const instruction = this.t(language, 'magic_link', 'instruction');
    const buttonText = this.t(language, 'magic_link', 'button_text');
    const copyPaste = this.t(language, 'common', 'copy_paste_mobile');
    const copyLink = this.t(language, 'common', 'copy_link');
    const linkExpires = this.t(language, 'common', 'link_expires');
    const secureLogin = this.t(language, 'common', 'secure_login');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
${this.generateEmailHeader(language)}
<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
<p style="font-size: 16px; line-height: 1.5;">${greeting}</p>
<p style="font-size: 16px; line-height: 1.5;">${instruction}</p>

<!-- Mobile-friendly button with fallback -->
<div style="text-align: center; margin: 30px 0;">
  <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                 href="${magicLinkUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                 arcsize="10%" stroke="f" fillcolor="#2563eb">
      <w:anchorlock/>
      <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
        ${buttonText}
      </center>
    </v:roundrect>
  <![endif]-->
  <a href="${magicLinkUrl}"
     style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
            display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
    ${buttonText}
  </a>
</div>

<!-- Copyable link fallback for mobile/Outlook -->
<div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
  <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
    ${copyPaste}
  </p>
  <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
    <strong>${copyLink}</strong><br>
    <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
      ${magicLinkUrl}
    </span>
  </p>
</div>

<p style="font-size: 13px; color: #64748b; margin: 20px 0 10px 0;">
  ${linkExpires}
</p>
<p style="font-size: 13px; color: #64748b; margin: 10px 0;">
  ${secureLogin}
</p>
</div>
${this.generateEmailFooter(language)}
</body>
</html>`;
  }

  /**
   * Generate group invitation email with localized content
   */
  static generateGroupInvitationEmail(groupName: string, inviteUrl: string, language: SupportedLanguage): string {
    const title = this.t(language, 'group_invitation', 'title');
    const greeting = this.t(language, 'group_invitation', 'greeting');
    const invitedToGroup = this.replaceVariables(
      this.t(language, 'group_invitation', 'invited_to_group'),
      { groupName },
    );
    const appDescription = this.t(language, 'group_invitation', 'app_description');
    const buttonText = this.t(language, 'group_invitation', 'button_text');
    const copyPaste = this.t(language, 'common', 'copy_paste_mobile');
    const copyLink = this.t(language, 'common', 'copy_link');
    const ignoreEmail = this.t(language, 'common', 'ignore_email');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
${this.generateEmailHeader(language)}
<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <p style="font-size: 16px; line-height: 1.5;">${greeting}</p>
  <p style="font-size: 16px; line-height: 1.5;">${invitedToGroup}</p>
  <p style="font-size: 16px; line-height: 1.5;">${appDescription}</p>

  <!-- Mobile-friendly button with fallback -->
  <div style="text-align: center; margin: 30px 0;">
    <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                   href="${inviteUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                   arcsize="10%" stroke="f" fillcolor="#10b981">
        <w:anchorlock/>
        <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
          ${buttonText}
        </center>
      </v:roundrect>
    <![endif]-->
    <a href="${inviteUrl}"
       style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
              display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
      ${buttonText}
    </a>
  </div>

  <!-- Copyable link fallback for mobile/Outlook -->
  <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
    <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
      ${copyPaste}
    </p>
    <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
      <strong>${copyLink}</strong><br>
      <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
        ${inviteUrl}
      </span>
    </p>
  </div>

  <p style="font-size: 13px; color: #64748b;">
    ${ignoreEmail}
  </p>
</div>
${this.generateEmailFooter(language)}
</body>
</html>`;
  }

  /**
   * Generate family invitation email with localized content
   */
  static generateFamilyInvitationEmail(familyName: string, inviteUrl: string, personalMessage?: string, language: SupportedLanguage = 'fr'): string {
    const title = this.t(language, 'family_invitation', 'title');
    const greeting = this.t(language, 'family_invitation', 'greeting');
    const invitedToFamily = this.replaceVariables(
      this.t(language, 'family_invitation', 'invited_to_family'),
      { familyName },
    );
    const appDescription = this.t(language, 'family_invitation', 'app_description');
    const buttonText = this.t(language, 'family_invitation', 'button_text');
    const copyPaste = this.t(language, 'common', 'copy_paste_mobile');
    const copyLink = this.t(language, 'common', 'copy_link');
    const ignoreEmail = this.t(language, 'common', 'ignore_email');
    const personalMessageLabel = language === 'fr' ? '💬' : '💬';

    const personalMessageHtml = personalMessage ?
      `<div style="background: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;"><p style="margin: 0; font-style: italic; color: #1e40af;">${personalMessageLabel} "${personalMessage}"</p></div>` : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
${this.generateEmailHeader(language)}
<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <p style="font-size: 16px; line-height: 1.5;">${greeting}</p>
  <p style="font-size: 16px; line-height: 1.5;">${invitedToFamily}</p>
  ${personalMessageHtml}
  <p style="font-size: 16px; line-height: 1.5;">${appDescription}</p>

  <!-- Mobile-friendly button with fallback -->
  <div style="text-align: center; margin: 30px 0;">
    <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                   href="${inviteUrl}" style="height:50px;v-text-anchor:middle; width:200px;"
                   arcsize="10%" stroke="f" fillcolor="#10b981">
        <w:anchorlock/>
        <center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">
          ${buttonText}
        </center>
      </v:roundrect>
    <![endif]-->
    <a href="${inviteUrl}"
       style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;
              display: inline-block; font-weight: bold; font-size: 16px; -webkit-text-size-adjust: none;">
      ${buttonText}
    </a>
  </div>

  <!-- Copyable link fallback for mobile/Outlook -->
  <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
    <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold;">
      ${copyPaste}
    </p>
    <p style="margin: 0; font-size: 12px; color: #475569; word-break: break-all;">
      <strong>${copyLink}</strong><br>
      <span style="background: white; padding: 8px; border-radius: 4px; display: inline-block; font-family: monospace;">
        ${inviteUrl}
      </span>
    </p>
  </div>

  <p style="font-size: 13px; color: #64748b;">
    ${ignoreEmail}
  </p>
</div>
${this.generateEmailFooter(language)}
</body>
</html>`;
  }
}