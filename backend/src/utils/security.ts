/**
 * SECURITY: Production-safe error message sanitization
 * Prevents information leakage in production environments
 */

export interface SecurityErrorDetails {
  userMessage: string;
  logMessage: string;
  statusCode: number;
}

/**
 * Sanitizes error messages for production environment
 * Removes sensitive implementation details while preserving functionality
 */
export function sanitizeSecurityError(error: Error): SecurityErrorDetails {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // SECURITY messages that should be sanitized in production
  if (error.message.includes('🚨 SECURITY') || error.message.includes('SECURITY:')) {
    return {
      userMessage: isProduction 
        ? 'Authentication failed. Please try again.' 
        : error.message,
      logMessage: error.message, // Full details for logging
      statusCode: 401
    };
  }
  
  // PKCE-related errors
  if (error.message.includes('code_verifier') || error.message.includes('code_challenge')) {
    return {
      userMessage: isProduction 
        ? 'Invalid authentication request. Please try again.'
        : error.message,
      logMessage: error.message,
      statusCode: 400
    };
  }
  
  // Database or implementation-specific errors
  if (error.message.includes('database') || error.message.includes('repository')) {
    return {
      userMessage: isProduction 
        ? 'Service temporarily unavailable. Please try again.'
        : error.message,
      logMessage: error.message,
      statusCode: 500
    };
  }
  
  // Generic fallback for security-sensitive operations
  const securityKeywords = ['token', 'validation', 'verification', 'challenge'];
  const containsSecurityKeyword = securityKeywords.some(keyword => 
    error.message.toLowerCase().includes(keyword)
  );
  
  if (containsSecurityKeyword && isProduction) {
    return {
      userMessage: 'Authentication error. Please try again.',
      logMessage: error.message,
      statusCode: 401
    };
  }
  
  // Return original message for non-security errors or non-production
  return {
    userMessage: error.message,
    logMessage: error.message,
    statusCode: 500
  };
}

/**
 * Logs security events with appropriate detail level
 */
export function logSecurityEvent(event: string, details: any, level: 'info' | 'warn' | 'error' = 'warn') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details: process.env.NODE_ENV === 'production' 
      ? { ...details, sensitive: '[REDACTED]' } 
      : details,
    environment: process.env.NODE_ENV || 'development'
  };
  
  switch (level) {
    case 'error':
      console.error('🚨 SECURITY EVENT:', JSON.stringify(logEntry, null, 2));
      break;
    case 'warn':
      console.warn('⚠️ SECURITY WARNING:', JSON.stringify(logEntry, null, 2));
      break;
    default:
      console.log('ℹ️ SECURITY INFO:', JSON.stringify(logEntry, null, 2));
  }
}