/**
 * Centralized URL Generator utility
 *
 * This utility consolidates URL generation logic to eliminate duplication
 * across the application, particularly for email links and deep links.
 */

/**
 * Security levels for URL validation
 */
export enum SecurityLevel {
  STANDARD = 'standard',
  HIGH = 'high',
}

/**
 * URL generation options
 */
export interface UrlGeneratorOptions {
  securityLevel?: SecurityLevel;
  allowCustomProtocols?: boolean;
}

/**
 * Centralized URL Generator class
 * Extracts BaseEmailService URL generation logic for reuse across services
 */
export class UrlGenerator {
  /**
   * Generate URL using DEEP_LINK_BASE_URL with fallbacks and security validation
   * This method extracts the logic from BaseEmailService for reuse across services
   */
  static generateUrl(path: string, params?: URLSearchParams, options: UrlGeneratorOptions = {}): string {
    const candidateUrls = [
      process.env.DEEP_LINK_BASE_URL,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
    ];

    let validBaseUrl: string | null = null;

    // Try each URL in order of preference until we find a valid one
    for (let i = 0; i < candidateUrls.length; i++) {
      const candidateUrl = candidateUrls[i];
      if (candidateUrl && this.validateDeepLinkUrl(candidateUrl, options)) {
        validBaseUrl = candidateUrl;
        break;
      }
    }

    // If no valid URL is found, use localhost as ultimate fallback (but log the issue)
    if (!validBaseUrl) {
      console.warn('No valid base URL found, using localhost fallback. Check DEEP_LINK_BASE_URL and FRONTEND_URL environment variables.');
      validBaseUrl = 'http://localhost:3000';
    }

    // Clean up the base URL
    const cleanBaseUrl = validBaseUrl.trim();
    // Don't remove trailing slash from custom protocols like edulift://
    if (cleanBaseUrl.endsWith('/') && !cleanBaseUrl.startsWith('edulift://')) {
      validBaseUrl = cleanBaseUrl.slice(0, -1);
    }

    // Build the path
    let fullPath = path;
    if (!path.startsWith('/')) {
      fullPath = `/${  path}`;
    }

    // Handle deep linking vs web URLs
    if (cleanBaseUrl.startsWith('edulift://')) {
      // For deep links, don't add the / prefix to the path
      fullPath = path.startsWith('/') ? path.substring(1) : path;
    }

    // Build final URL
    let finalUrl = `${validBaseUrl}${fullPath}`;

    // Add query parameters if provided
    if (params && params.toString()) {
      finalUrl += `?${params.toString()}`;
    }

    return finalUrl;
  }

  /**
   * Enhanced deep link URL validation with configurable security levels
   */
  private static validateDeepLinkUrl(url: string, options: UrlGeneratorOptions = {}): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return false;
    }

    // Check for empty or whitespace-only URLs
    if (/^\s*$/.test(trimmedUrl)) {
      return false;
    }

    const { securityLevel = SecurityLevel.STANDARD, allowCustomProtocols = true } = options;

    // Allow edulift:// custom protocol for deep linking
    if (allowCustomProtocols && trimmedUrl.startsWith('edulift://')) {
      return this.validateCustomProtocolUrl(trimmedUrl, 'edulift://');
    }

    // Standard URL validation for web URLs
    try {
      const urlObj = new URL(trimmedUrl);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // High security level: additional restrictions
      if (securityLevel === SecurityLevel.HIGH) {
        // Restrict to localhost and common production domains
        const allowedHosts = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          'app.edulift.com',
          'staging.edulift.com',
        ];

        // For development/testing, allow localhost with any port
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          return true;
        }

        // For production, restrict to specific domains
        return allowedHosts.includes(urlObj.hostname);
      }

      // Standard security: basic validation
      return true;
    } catch {
      // Invalid URL format
      return false;
    }
  }

  /**
   * Validate custom protocol URLs (like edulift://)
   */
  private static validateCustomProtocolUrl(url: string, protocol: string): boolean {
    if (!url.startsWith(protocol)) {
      return false;
    }

    // Extract the path part after the protocol
    const pathPart = url.substring(protocol.length);

    // Allow empty paths (just the protocol)
    if (!pathPart || pathPart === '/') {
      return true;
    }

    try {
      // Validate the path by decoding and checking for dangerous patterns
      const decodedPath = decodeURIComponent(pathPart);

      // Basic path validation - no dangerous patterns
      const dangerousPatterns = [
        /\.\./,  // Directory traversal
        /</,     // HTML
        />/,     // HTML
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /ftp:/i,
      ];

      return !dangerousPatterns.some(pattern => pattern.test(decodedPath));
    } catch {
      return false;
    }
  }

  /**
   * Helper method to generate magic link URLs
   */
  static generateMagicLinkUrl(token: string, inviteCode?: string): string {
    const params = new URLSearchParams({ token });
    if (inviteCode) {
      params.append('inviteCode', inviteCode);
    }

    return this.generateUrl('/auth/verify', params);
  }

  /**
   * Helper method to generate account deletion URLs
   */
  static generateAccountDeletionUrl(token: string): string {
    const params = new URLSearchParams({ token });
    return this.generateUrl('/auth/profile/delete-confirm', params);
  }
}