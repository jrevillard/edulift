import { sanitizeSecurityError, logSecurityEvent } from './security';
import { logger } from './logger';

describe('Security Utils', () => {
  describe('sanitizeSecurityError', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should sanitize SECURITY messages in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Authentication failed. Please try again.');
      expect(result.logMessage).toBe('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      expect(result.statusCode).toBe(401);
    });

    it('should preserve SECURITY messages in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      expect(result.logMessage).toBe('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      expect(result.statusCode).toBe(401);
    });

    it('should sanitize PKCE errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('code_verifier required for PKCE validation');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Invalid authentication request. Please try again.');
      expect(result.logMessage).toBe('code_verifier required for PKCE validation');
      expect(result.statusCode).toBe(400);
    });

    it('should sanitize code_challenge errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('code_challenge is required and must be 43-128 characters for PKCE validation');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Invalid authentication request. Please try again.');
      expect(result.logMessage).toBe('code_challenge is required and must be 43-128 characters for PKCE validation');
      expect(result.statusCode).toBe(400);
    });

    it('should sanitize database errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('database connection failed');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Service temporarily unavailable. Please try again.');
      expect(result.logMessage).toBe('database connection failed');
      expect(result.statusCode).toBe(500);
    });

    it('should sanitize security keywords in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('token validation failed');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Authentication error. Please try again.');
      expect(result.logMessage).toBe('token validation failed');
      expect(result.statusCode).toBe(401);
    });

    it('should preserve non-security errors', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Name is required for new users');
      
      const result = sanitizeSecurityError(error);
      
      expect(result.userMessage).toBe('Name is required for new users');
      expect(result.logMessage).toBe('Name is required for new users');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('logSecurityEvent', () => {
    let loggerSpy: jest.SpyInstance;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      loggerSpy = jest.spyOn(logger, 'warn').mockImplementation();
    });

    afterEach(() => {
      loggerSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should log security events with redacted sensitive data in production', () => {
      process.env.NODE_ENV = 'production';

      logSecurityEvent('AUTH_FAILED', {
        error: 'Invalid credentials',
        email: 'user@example.com',
        password: 'secret123',
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        '⚠️ SECURITY WARNING',
        expect.objectContaining({
          event: 'AUTH_FAILED',
          details: expect.objectContaining({
            email: 'user@example.com',
            password: 'secret123',
            sensitive: '[REDACTED]',
          }),
        }),
      );
    });

    it('should log full details in development', () => {
      process.env.NODE_ENV = 'development';

      logSecurityEvent('AUTH_FAILED', {
        error: 'Invalid credentials',
        email: 'user@example.com',
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        '⚠️ SECURITY WARNING',
        expect.objectContaining({
          event: 'AUTH_FAILED',
          details: expect.objectContaining({
            email: 'user@example.com',
            error: 'Invalid credentials',
          }),
        }),
      );
    });

    it('should support different log levels', () => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation();
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation();

      logSecurityEvent('CRITICAL_EVENT', { error: 'Critical issue' }, 'error');
      logSecurityEvent('INFO_EVENT', { info: 'Information' }, 'info');

      expect(errorSpy).toHaveBeenCalledWith(
        '🚨 SECURITY EVENT',
        expect.objectContaining({
          event: 'CRITICAL_EVENT',
          details: { error: 'Critical issue' },
        }),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        'ℹ️ SECURITY INFO',
        expect.objectContaining({
          event: 'INFO_EVENT',
          details: { info: 'Information' },
        }),
      );

      errorSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });
});