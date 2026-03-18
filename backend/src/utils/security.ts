/**
 * SECURITY: Production-safe error message sanitization
 * Prevents information leakage in production environments
 */

import { logger } from './logger';

export interface SecurityErrorDetails {
  userMessage: string;
  logMessage: string;
  statusCode: number;
}

/**
 * Sanitizes error messages for production environment
 * Removes sensitive implementation details while preserving functionality
 */
export const sanitizeSecurityError = (error: Error): SecurityErrorDetails => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // SECURITY messages that should be sanitized in production
  if (error.message.includes('🚨 SECURITY') || error.message.includes('SECURITY:')) {
    return {
      userMessage: isProduction 
        ? 'Authentication failed. Please try again.' 
        : error.message,
      logMessage: error.message, // Full details for logging
      statusCode: 401,
    };
  }
  
  // PKCE-related errors
  if (error.message.includes('code_verifier') || error.message.includes('code_challenge')) {
    return {
      userMessage: isProduction 
        ? 'Invalid authentication request. Please try again.'
        : error.message,
      logMessage: error.message,
      statusCode: 400,
    };
  }
  
  // Database or implementation-specific errors
  if (error.message.includes('database') || error.message.includes('repository')) {
    return {
      userMessage: isProduction 
        ? 'Service temporarily unavailable. Please try again.'
        : error.message,
      logMessage: error.message,
      statusCode: 500,
    };
  }
  
  // Generic fallback for security-sensitive operations
  const securityKeywords = ['token', 'validation', 'verification', 'challenge'];
  const containsSecurityKeyword = securityKeywords.some(keyword => 
    error.message.toLowerCase().includes(keyword),
  );
  
  if (containsSecurityKeyword && isProduction) {
    return {
      userMessage: 'Authentication error. Please try again.',
      logMessage: error.message,
      statusCode: 401,
    };
  }
  
  // Return original message for non-security errors or non-production
  return {
    userMessage: error.message,
    logMessage: error.message,
    statusCode: 500,
  };
};

/**
 * Logs security events with appropriate detail level
 */
export const logSecurityEvent = (event: string, details: unknown, level: 'info' | 'warn' | 'error' = 'warn'): void => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details: process.env.NODE_ENV === 'production'
      ? { ...(details as Record<string, unknown>), sensitive: '[REDACTED]' }
      : details,
    environment: process.env.NODE_ENV || 'development',
  };
  
  switch (level) {
    case 'error':
      logger.error('🚨 SECURITY EVENT', logEntry);
      break;
    case 'warn':
      logger.warn('⚠️ SECURITY WARNING', logEntry);
      break;
    default:
      logger.info('ℹ️ SECURITY INFO', logEntry);
  }
};
/**
 * Sanitize user-agent strings to prevent log injection attacks.
 *
 * Removes control characters that could be used to inject fake log entries,
 * including CRLF (Carriage Return Line Feed) sequences and other control chars.
 *
 * @param userAgent - Raw user-agent string from request header
 * @returns Sanitized user-agent string safe for logging
 *
 * @example
 * sanitizeUserAgent('Mozilla/5.0\r\nFake log entry') // Returns 'Mozilla/5.0Fake log entry'
 */
export const sanitizeUserAgent = (userAgent: string): string => {
  // Remove CRLF and other control characters (0x00-0x1F and 0x7F)
  // This prevents log injection via crafted user-agent strings
  return userAgent.replace(/[\r\n\t\x00-\x1F\x7F]/g, '');
};

/**
 * Sanitize any string value to prevent log injection.
 *
 * Generic sanitizer for any string that will be logged, removing
 * control characters that could be used for log injection attacks.
 *
 * @param value - Raw string value
 * @returns Sanitized string safe for logging
 */
export const sanitizeLogValue = (value: unknown): string => {
  if (typeof value !== 'string') {
    return String(value);
  }
  // Remove control characters but preserve whitespace
  return value.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ');
};
