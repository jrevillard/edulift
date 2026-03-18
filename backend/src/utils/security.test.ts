import { sanitizeSecurityError, logSecurityEvent, sanitizeUserAgent, sanitizeLogValue } from './security';
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

describe('sanitizeUserAgent', () => {
  it('should remove CRLF characters to prevent log injection', () => {
    const malicious = 'Mozilla/5.0\r\n[Fake Log Entry] Malicious content';
    const sanitized = sanitizeUserAgent(malicious);

    expect(sanitized).toBe('Mozilla/5.0[Fake Log Entry] Malicious content');
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
  });

  it('should remove tab characters', () => {
    const withTabs = 'Mozilla/5.0\t[TAB]\tInjection';
    const sanitized = sanitizeUserAgent(withTabs);

    expect(sanitized).not.toContain('\t');
    expect(sanitized).toBe('Mozilla/5.0[TAB]Injection');
  });

  it('should remove other control characters (0x00-0x1F)', () => {
    const withControlChars = 'Agent\x00\x01\x02Control\x1FChars';
    const sanitized = sanitizeUserAgent(withControlChars);

    expect(sanitized).toBe('AgentControlChars');
  });

  it('should remove DEL character (0x7F)', () => {
    const withDEL = 'Mozilla\x7FWithDEL';
    const sanitized = sanitizeUserAgent(withDEL);

    expect(sanitized).toBe('MozillaWithDEL');
  });

  it('should preserve normal characters', () => {
    const normal = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const sanitized = sanitizeUserAgent(normal);

    expect(sanitized).toBe(normal);
  });

  it('should use fast-path optimization for legitimate user-agents', () => {
    const legitimateUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const sanitized = sanitizeUserAgent(legitimateUA);

    // Fast-path: should return the same string reference (no control chars = no processing)
    expect(sanitized).toBe(legitimateUA);
    expect(sanitized).toEqual(legitimateUA);
  });

  it('should handle empty string', () => {
    const sanitized = sanitizeUserAgent('');

    expect(sanitized).toBe('');
  });

  it('should handle special browser user agents', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
    const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';

    expect(sanitizeUserAgent(chrome)).toBe(chrome);
    expect(sanitizeUserAgent(firefox)).toBe(firefox);
    expect(sanitizeUserAgent(safari)).toBe(safari);
  });

  it('should handle mobile user agents', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    const android = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

    expect(sanitizeUserAgent(ios)).toBe(ios);
    expect(sanitizeUserAgent(android)).toBe(android);
  });

  it('should remove mixed control characters', () => {
    const mixed = 'Agent\r\nWith\tVarious\x00Control\x7FChars';
    const sanitized = sanitizeUserAgent(mixed);

    expect(sanitized).toBe('AgentWithVariousControlChars');
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).not.toContain('\t');
    expect(sanitized).not.toContain('\x00');
    expect(sanitized).not.toContain('\x7F');
  });
});

describe('sanitizeLogValue', () => {
  it('should sanitize string values', () => {
    const withCRLF = 'Value\r\nInjected';
    const sanitized = sanitizeLogValue(withCRLF);

    expect(sanitized).toBe('Value  Injected'); // CRLF becomes spaces
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
  });

  it('should convert non-string values to string', () => {
    expect(sanitizeLogValue(123)).toBe('123');
    expect(sanitizeLogValue(null)).toBe('null');
    expect(sanitizeLogValue(undefined)).toBe('undefined');
    expect(sanitizeLogValue(true)).toBe('true');
  });

  it('should replace control characters with spaces', () => {
    const withControl = 'Value\x00With\tControl\rChars\n';
    const sanitized = sanitizeLogValue(withControl);

    expect(sanitized).toBe('Value With Control Chars ');
  });

  it('should preserve normal whitespace', () => {
    const withSpaces = 'Normal Value with   spaces';
    const sanitized = sanitizeLogValue(withSpaces);

    expect(sanitized).toBe(withSpaces);
  });

  it('should handle empty string', () => {
    const sanitized = sanitizeLogValue('');

    expect(sanitized).toBe('');
  });

  it('should handle objects and arrays', () => {
    const obj = { key: 'value' };
    const arr = ['item1', 'item2'];

    // Objects and arrays are converted to string representation
    expect(sanitizeLogValue(obj)).toContain('[object Object]');
    expect(sanitizeLogValue(arr)).toContain('item1');
  });
});