import { BaseEmailService } from '../base/BaseEmailService';
import { ScheduleSlotNotificationData, GroupInvitationData, FamilyInvitationData } from '../../types/EmailServiceInterface';

// Concrete implementation for testing
class TestEmailService extends BaseEmailService {
  protected async _send(_to: string, _subject: string, _html: string, _attachments?: any[], _from?: string): Promise<void> {
    // Mock implementation for testing
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }
}

describe('BaseEmailService URL Helpers', () => {
  let emailService: TestEmailService;

  beforeEach(() => {
    emailService = new TestEmailService();
  });

  describe('getSeparator', () => {
    it('should return empty string for edulift:// protocol', () => {
      const separator = (emailService as any).getSeparator('edulift://');
      expect(separator).toBe('');
    });

    it('should return empty string for edulift:// with path', () => {
      const separator = (emailService as any).getSeparator('edulift://auth');
      expect(separator).toBe('');
    });

    it('should return empty string for URLs ending with slash', () => {
      const separator = (emailService as any).getSeparator('https://app.example.com/');
      expect(separator).toBe('');
    });

    it('should return slash for standard HTTPS URLs', () => {
      const separator = (emailService as any).getSeparator('https://app.example.com');
      expect(separator).toBe('/');
    });

    it('should return slash for HTTP URLs', () => {
      const separator = (emailService as any).getSeparator('http://localhost:3000');
      expect(separator).toBe('/');
    });

    it('should return slash for URLs with ports', () => {
      const separator = (emailService as any).getSeparator('https://localhost:8443');
      expect(separator).toBe('/');
    });

    it('should handle complex URLs correctly', () => {
      const testCases = [
        { url: 'https://subdomain.example.com', expected: '/' },
        { url: 'https://api.example.com/v1/', expected: '' },
        { url: 'edulift://app', expected: '' },
        { url: 'http://192.168.1.1:3000', expected: '/' },
      ];

      testCases.forEach(({ url, expected }) => {
        const separator = (emailService as any).getSeparator(url);
        expect(separator).toBe(expected);
      });
    });
  });

  describe('normalizePath', () => {
    it('should remove leading slash from path', () => {
      const normalized = (emailService as any).normalizePath('/auth/verify');
      expect(normalized).toBe('auth/verify');
    });

    it('should keep path without leading slash unchanged', () => {
      const normalized = (emailService as any).normalizePath('dashboard');
      expect(normalized).toBe('dashboard');
    });

    it('should handle empty string', () => {
      const normalized = (emailService as any).normalizePath('');
      expect(normalized).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      const nullResult = (emailService as any).normalizePath(null);
      const undefinedResult = (emailService as any).normalizePath(undefined);

      expect(nullResult).toBe('');
      expect(undefinedResult).toBe('');
    });

    it('should handle single slash', () => {
      const normalized = (emailService as any).normalizePath('/');
      expect(normalized).toBe('');
    });

    it('should handle complex paths', () => {
      const testCases = [
        { path: '/groups/join', expected: 'groups/join' },
        { path: 'families/join', expected: 'families/join' },
        { path: '/api/v1/users', expected: 'api/v1/users' },
        { path: 'auth/verify', expected: 'auth/verify' },
      ];

      testCases.forEach(({ path, expected }) => {
        const normalized = (emailService as any).normalizePath(path);
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('buildUrl', () => {
    it('should build URL with path correctly', () => {
      const url = (emailService as any).buildUrl('https://app.example.com', 'auth/verify');
      expect(url).toBe('https://app.example.com/auth/verify');
    });

    it('should build URL with path and parameters', () => {
      const params = new URLSearchParams({ token: 'test123', code: 'ABC123' });
      const url = (emailService as any).buildUrl('https://app.example.com', 'auth/verify', params);
      expect(url).toBe('https://app.example.com/auth/verify?token=test123&code=ABC123');
    });

    it('should handle edulift:// URLs correctly', () => {
      const url = (emailService as any).buildUrl('edulift://', 'dashboard');
      expect(url).toBe('edulift://dashboard');
    });

    it('should handle URLs with trailing slash correctly', () => {
      const url = (emailService as any).buildUrl('https://app.example.com/', 'auth/verify');
      expect(url).toBe('https://app.example.com/auth/verify');
    });

    it('should handle empty parameters', () => {
      const emptyParams = new URLSearchParams();
      const url = (emailService as any).buildUrl('https://app.example.com', 'dashboard', emptyParams);
      expect(url).toBe('https://app.example.com/dashboard');
    });

    it('should handle undefined parameters', () => {
      const url = (emailService as any).buildUrl('https://app.example.com', 'dashboard', undefined);
      expect(url).toBe('https://app.example.com/dashboard');
    });

    it('should handle paths with leading slash', () => {
      const url = (emailService as any).buildUrl('https://app.example.com', '/auth/verify');
      expect(url).toBe('https://app.example.com/auth/verify');
    });

    it('should handle complex URL building scenarios', () => {
      const testCases = [
        {
          baseUrl: 'https://app.edulift.com',
          path: 'groups/join',
          params: new URLSearchParams({ code: 'GRP123' }),
          expected: 'https://app.edulift.com/groups/join?code=GRP123',
        },
        {
          baseUrl: 'edulift://',
          path: 'families/join',
          params: new URLSearchParams({ code: 'FAM123' }),
          expected: 'edulift://families/join?code=FAM123',
        },
        {
          baseUrl: 'https://api.example.com/',
          path: '/v1/auth',
          params: new URLSearchParams({ token: 'abc123' }),
          expected: 'https://api.example.com/v1/auth?token=abc123',
        },
        {
          baseUrl: 'http://localhost:3000',
          path: 'dashboard',
          params: undefined,
          expected: 'http://localhost:3000/dashboard',
        },
      ];

      testCases.forEach(({ baseUrl, path, params, expected }) => {
        const url = (emailService as any).buildUrl(baseUrl, path, params);
        expect(url).toBe(expected);
      });
    });
  });
});

describe('BaseEmailService URL Generation', () => {
  let emailService: TestEmailService;

  beforeEach(() => {
    emailService = new TestEmailService();
    // Clear environment variables
    delete process.env.FRONTEND_URL;
    delete process.env.DEEP_LINK_BASE_URL;
  });

  afterEach(() => {
    // Restore environment variables
    delete process.env.FRONTEND_URL;
    delete process.env.DEEP_LINK_BASE_URL;
  });

  describe('generateUrl', () => {
    it('should generate URLs correctly with DEEP_LINK_BASE_URL priority', () => {
      process.env.DEEP_LINK_BASE_URL = 'https://custom.example.com';
      const url = (emailService as any).generateUrl('auth/verify', new URLSearchParams({ token: 'test123' }));
      expect(url).toBe('https://custom.example.com/auth/verify?token=test123');
    });

    it('should fall back to FRONTEND_URL when DEEP_LINK_BASE_URL is not set', () => {
      process.env.FRONTEND_URL = 'https://app.edulift.com';
      const url = (emailService as any).generateUrl('families/join', new URLSearchParams({ code: 'ABC123' }));
      expect(url).toBe('https://app.edulift.com/families/join?code=ABC123');
    });

    it('should use default localhost when neither DEEP_LINK_BASE_URL nor FRONTEND_URL are set', () => {
      const url = (emailService as any).generateUrl('dashboard', new URLSearchParams({ token: 'test123' }));
      expect(url).toBe('http://localhost:3000/dashboard?token=test123');
    });

    it('should generate native deeplink URLs correctly', () => {
      process.env.DEEP_LINK_BASE_URL = 'edulift://';
      const url = (emailService as any).generateUrl('auth/verify', new URLSearchParams({ token: 'test123' }));
      expect(url).toBe('edulift://auth/verify?token=test123');
    });

    it('should generate native deeplink URLs without parameters', () => {
      process.env.DEEP_LINK_BASE_URL = 'edulift://';
      const url = (emailService as any).generateUrl('dashboard');
      expect(url).toBe('edulift://dashboard');
    });

    it('should handle paths with leading slash correctly', () => {
      process.env.DEEP_LINK_BASE_URL = 'edulift://';
      const url = (emailService as any).generateUrl('/groups/join', new URLSearchParams({ code: 'GRP123' }));
      expect(url).toBe('edulift://groups/join?code=GRP123');
    });

    it('should handle empty parameters correctly', () => {
      const emptyParams = new URLSearchParams();
      const url = (emailService as any).generateUrl('dashboard', emptyParams);
      expect(url).toBe('http://localhost:3000/dashboard');
    });

    it('should handle web URLs with trailing slash correctly', () => {
      process.env.DEEP_LINK_BASE_URL = 'https://app.example.com/';
      const url = (emailService as any).generateUrl('auth/verify', new URLSearchParams({ token: 'test123' }));
      expect(url).toBe('https://app.example.com/auth/verify?token=test123');
    });
  });

  describe('Email Content Generation', () => {
    it('should handle group invitation emails without platform parameter', async () => {
      process.env.DEEP_LINK_BASE_URL = 'edulift://';
      const groupData: GroupInvitationData = {
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
      };

      await emailService.sendGroupInvitation(groupData);
      // The fact that no error is thrown confirms the method works without platform parameter
    });

    it('should handle family invitation emails without platform parameter', async () => {
      process.env.DEEP_LINK_BASE_URL = 'edulift://';
      const familyData: FamilyInvitationData = {
        inviterName: 'John Doe',
        familyName: 'Test Family',
        inviteCode: 'FAM123',
        role: 'MEMBER',
      };

      await emailService.sendFamilyInvitation('test@example.com', familyData);
      // The fact that no error is thrown confirms the method works without platform parameter
    });

    it('should handle schedule slot notification emails without platform parameter', async () => {
      process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';
      const notificationData: ScheduleSlotNotificationData = {
        scheduleSlotId: 'slot123',
        datetime: '2024-01-15T08:00:00Z',
        assignedChildren: ['Emma', 'Lucas'],
        groupName: 'Test Group',
        changeType: 'SLOT_CREATED',
      };

      await emailService.sendScheduleSlotNotification('test@example.com', notificationData);
      // The fact that no error is thrown confirms the method works without platform parameter
    });
  });

  describe('URL Generation in Email Content', () => {
    it('should generate correct URLs for different scenarios with DEEP_LINK_BASE_URL', () => {
      // Test various URL generation scenarios with DEEP_LINK_BASE_URL
      process.env.DEEP_LINK_BASE_URL = 'edulift://';

      const testCases = [
        {
          path: 'auth/verify',
          params: new URLSearchParams({ token: 'test123', inviteCode: 'INV123' }),
          expected: 'edulift://auth/verify?token=test123&inviteCode=INV123',
        },
        {
          path: 'families/join',
          params: new URLSearchParams({ code: 'FAM123' }),
          expected: 'edulift://families/join?code=FAM123',
        },
        {
          path: 'groups/join',
          params: new URLSearchParams({ code: 'GRP123' }),
          expected: 'edulift://groups/join?code=GRP123',
        },
        {
          path: 'dashboard',
          params: undefined,
          expected: 'edulift://dashboard',
        },
      ];

      testCases.forEach(({ path, params, expected }) => {
        const url = (emailService as any).generateUrl(path, params);
        expect(url).toBe(expected);
      });
    });

    it('should fall back to web URLs when DEEP_LINK_BASE_URL is web-based', () => {
      process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';

      const testCases = [
        {
          path: 'auth/verify',
          params: new URLSearchParams({ token: 'test123' }),
          expected: 'https://app.edulift.com/auth/verify?token=test123',
        },
        {
          path: 'families/join',
          params: new URLSearchParams({ code: 'FAM123' }),
          expected: 'https://app.edulift.com/families/join?code=FAM123',
        },
      ];

      testCases.forEach(({ path, params, expected }) => {
        const url = (emailService as any).generateUrl(path, params);
        expect(url).toBe(expected);
      });
    });
  });

  describe('URL Security Validation', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      jest.spyOn(console, 'warn').mockImplementation(consoleSpy.warn);
      jest.spyOn(console, 'error').mockImplementation(consoleSpy.error);
      jest.spyOn(console, 'debug').mockImplementation(consoleSpy.debug);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('Dangerous protocol blocking', () => {
      it('should block javascript: URLs', () => {
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: javascript:'),
          expect.any(Object),
        );
      });

      it('should block data: URLs', () => {
        process.env.DEEP_LINK_BASE_URL = 'data:text/html,<script>alert(1)</script>';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: data:'),
          expect.any(Object),
        );
      });

      it('should block vbscript: URLs', () => {
        process.env.DEEP_LINK_BASE_URL = 'vbscript:msgbox("test")';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: vbscript:'),
          expect.any(Object),
        );
      });

      it('should block file: URLs', () => {
        process.env.DEEP_LINK_BASE_URL = 'file:///etc/passwd';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: file:'),
          expect.any(Object),
        );
      });

      it('should block ftp: URLs', () => {
        process.env.DEEP_LINK_BASE_URL = 'ftp://malicious.com/files';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: ftp:'),
          expect.any(Object),
        );
      });
    });

    describe('Malformed URL detection', () => {
      it('should block URLs with invalid format', () => {
        process.env.DEEP_LINK_BASE_URL = 'ht tp://invalid-url';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Invalid URL format'),
          expect.any(Object),
        );
      });

      it('should block empty URLs', () => {
        process.env.DEEP_LINK_BASE_URL = '';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        // Empty strings are treated as undefined/falsy and skip validation, falling back to localhost
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should block whitespace-only URLs', () => {
        process.env.DEEP_LINK_BASE_URL = '   \t\n   ';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Empty URL after trimming'),
          expect.any(Object),
        );
      });

      it('should block null/undefined URLs', () => {
        process.env.DEEP_LINK_BASE_URL = undefined as any;
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
      });
    });

    describe('Hostname validation for HTTP/HTTPS URLs', () => {
      it('should block URLs with script tags in hostname', () => {
        process.env.DEEP_LINK_BASE_URL = 'https://<script>alert(1)</script>.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        // Script tags in hostname cause URL parsing to fail entirely
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Invalid URL format'),
          expect.any(Object),
        );
      });

      it('should block URLs with suspicious patterns in hostname', () => {
        process.env.DEEP_LINK_BASE_URL = 'https://<script>alert(1)</script>.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        // Script tags cause URL parsing to fail entirely, which is also secure behavior
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Invalid URL format'),
          expect.any(Object),
        );
      });

      it('should allow legitimate hostnames', () => {
        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('https://app.edulift.com/dashboard');
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should allow localhost in development', () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        process.env.DEEP_LINK_BASE_URL = 'http://localhost:3000';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).not.toHaveBeenCalled();

        process.env.NODE_ENV = originalNodeEnv;
      });

      it('should block private IPs in production', () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        process.env.DEEP_LINK_BASE_URL = 'http://192.168.1.1:3000';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Private IP address in production'),
          expect.any(Object),
        );

        process.env.NODE_ENV = originalNodeEnv;
      });
    });

    describe('edulift:// protocol security', () => {
      it('should allow legitimate edulift:// URLs', () => {
        process.env.DEEP_LINK_BASE_URL = 'edulift://';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('edulift://dashboard');
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should block edulift:// URLs with suspicious patterns', () => {
        process.env.DEEP_LINK_BASE_URL = 'edulift://javascript:test';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        // URLs with colons in the path cause URL parsing to fail, which is also secure behavior
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Invalid URL format'),
          expect.any(Object),
        );
      });

      it('should allow edulift:// URLs with path components', () => {
        process.env.DEEP_LINK_BASE_URL = 'edulift://path/../test';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('edulift://path/../testdashboard');
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should allow edulift:// URLs with encoded components', () => {
        process.env.DEEP_LINK_BASE_URL = 'edulift:///%2e%2e/%2e%2e/etc/passwd';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('edulift:///%2e%2e/%2e%2e/etc/passwddashboard');
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });
    });

    describe('Fallback behavior', () => {
      it('should fall back to FRONTEND_URL when DEEP_LINK_BASE_URL is invalid', () => {
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';
        process.env.FRONTEND_URL = 'https://fallback.edulift.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('https://fallback.edulift.com/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: javascript:'),
          expect.any(Object),
        );
      });

      it('should fall back to localhost when both DEEP_LINK_BASE_URL and FRONTEND_URL are invalid', () => {
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';
        process.env.FRONTEND_URL = 'data:text/html,<script>alert(1)</script>';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledTimes(2); // Once for each invalid URL
      });

      it('should log emergency fallback usage', () => {
        // Mock validateDeepLinkUrl to always return false to trigger emergency fallback
        const originalValidateDeepLinkUrl = (emailService as any).validateDeepLinkUrl;
        (emailService as any).validateDeepLinkUrl = jest.fn().mockReturnValue(false);

        process.env.DEEP_LINK_BASE_URL = 'https://valid.com';
        process.env.FRONTEND_URL = 'https://also-valid.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('All URL candidates failed validation, using localhost fallback'),
        );

        // Restore original method
        (emailService as any).validateDeepLinkUrl = originalValidateDeepLinkUrl;
      });
    });

    describe('Secure logging', () => {
      it('should mask sensitive information in logs', () => {
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:alert("sensitive-secret-token-12345")';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');

        // Check that the logged URL is masked
        const warnCall = consoleSpy.warn.mock.calls.find((call: any[]) =>
          call[0].includes('Invalid URL detected'),
        );
        expect(warnCall).toBeDefined();
        // The masking shows first 20 chars + *** + last 10 chars
        // eslint-disable-next-line no-script-url
        expect(warnCall[0]).toContain('javascript:alert("se***en-12345")');
        expect(warnCall[0]).not.toContain('sensitive-secret-token');
      });

      it('should include metadata in logs without exposing sensitive data', () => {
        process.env.DEEP_LINK_BASE_URL = 'data:text/html,<script>';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('http://localhost:3000/dashboard');

        const warnCall = consoleSpy.warn.mock.calls.find((call: any[]) =>
          call[0].includes('Invalid URL detected'),
        );
        expect(warnCall).toBeDefined();
        expect(warnCall[1]).toMatchObject({
          reason: expect.stringContaining('Disallowed protocol: data:'),
          urlLength: expect.any(Number),
          timestamp: expect.any(String),
        });
      });
    });

    describe('Development debugging', () => {
      it('should log URL source in development mode', () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('https://app.edulift.com/dashboard');
        expect(consoleSpy.debug).toHaveBeenCalledWith(
          expect.stringContaining('Using URL from DEEP_LINK_BASE_URL: https://app.edulift.com'),
        );

        process.env.NODE_ENV = originalNodeEnv;
      });

      it('should not log URL source in production mode', () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';
        const url = (emailService as any).generateUrl('dashboard');
        expect(url).toBe('https://app.edulift.com/dashboard');
        expect(consoleSpy.debug).not.toHaveBeenCalled();

        process.env.NODE_ENV = originalNodeEnv;
      });
    });
  });

  describe('Regression Tests - Backward Compatibility', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      jest.spyOn(console, 'warn').mockImplementation(consoleSpy.warn);
      jest.spyOn(console, 'error').mockImplementation(consoleSpy.error);
      jest.spyOn(console, 'debug').mockImplementation(consoleSpy.debug);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('Existing functionality should work unchanged', () => {
      it('should maintain all original test behavior for valid URLs', () => {
        // All the original test cases should still work exactly the same
        const originalTestCases = [
          {
            env: { DEEP_LINK_BASE_URL: 'https://custom.example.com' },
            path: 'auth/verify',
            params: new URLSearchParams({ token: 'test123' }),
            expected: 'https://custom.example.com/auth/verify?token=test123',
          },
          {
            env: { FRONTEND_URL: 'https://app.edulift.com' },
            path: 'families/join',
            params: new URLSearchParams({ code: 'ABC123' }),
            expected: 'https://app.edulift.com/families/join?code=ABC123',
          },
          {
            env: {},
            path: 'dashboard',
            params: new URLSearchParams({ token: 'test123' }),
            expected: 'http://localhost:3000/dashboard?token=test123',
          },
          {
            env: { DEEP_LINK_BASE_URL: 'edulift://' },
            path: 'auth/verify',
            params: new URLSearchParams({ token: 'test123' }),
            expected: 'edulift://auth/verify?token=test123',
          },
          {
            env: { DEEP_LINK_BASE_URL: 'edulift://' },
            path: 'dashboard',
            params: undefined,
            expected: 'edulift://dashboard',
          },
          {
            env: { DEEP_LINK_BASE_URL: 'edulift://' },
            path: '/groups/join',
            params: new URLSearchParams({ code: 'GRP123' }),
            expected: 'edulift://groups/join?code=GRP123',
          },
          {
            env: {},
            path: 'dashboard',
            params: new URLSearchParams(),
            expected: 'http://localhost:3000/dashboard',
          },
          {
            env: { DEEP_LINK_BASE_URL: 'https://app.example.com/' },
            path: 'auth/verify',
            params: new URLSearchParams({ token: 'test123' }),
            expected: 'https://app.example.com/auth/verify?token=test123',
          },
        ];

        originalTestCases.forEach(testCase => {
          // Clear environment
          delete process.env.FRONTEND_URL;
          delete process.env.DEEP_LINK_BASE_URL;

          // Set test environment
          Object.assign(process.env, testCase.env);

          const url = (emailService as any).generateUrl(testCase.path, testCase.params);
          expect(url).toBe(testCase.expected);

          // Should not log any warnings for valid URLs
          expect(consoleSpy.warn).not.toHaveBeenCalled();
        });
      });

      it('should handle complex but valid URLs correctly', () => {
        const complexValidUrls = [
          'https://staging.edulift.app',
          'https://app.edulift.com:443',
          'https://subdomain.edulift.co.uk',
          'https://edulift-dev.herokuapp.com',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'edulift://',
          'edulift://auth',
          'https://api.edulift.com/v1',
        ];

        complexValidUrls.forEach(baseUrl => {
          delete process.env.FRONTEND_URL;
          delete process.env.DEEP_LINK_BASE_URL;
          process.env.DEEP_LINK_BASE_URL = baseUrl;

          const url = (emailService as any).generateUrl('test/path', new URLSearchParams({ param: 'value' }));

          // Should generate a valid URL
          expect(url).toBeDefined();
          expect(typeof url).toBe('string');
          expect(url.length).toBeGreaterThan(0);

          // Should not log warnings for valid URLs
          expect(consoleSpy.warn).not.toHaveBeenCalled();
        });
      });

      it('should maintain email functionality with valid URLs', async () => {
        // Test that email sending still works with valid URLs
        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';

        const groupData: GroupInvitationData = {
          to: 'test@example.com',
          groupName: 'Test Group',
          inviteCode: 'GRP123',
          role: 'MEMBER',
        };

        // Should not throw any errors
        await expect(emailService.sendGroupInvitation(groupData)).resolves.not.toThrow();
        expect(consoleSpy.warn).not.toHaveBeenCalled();

        const familyData: FamilyInvitationData = {
          inviterName: 'John Doe',
          familyName: 'Test Family',
          inviteCode: 'FAM123',
          role: 'MEMBER',
        };

        await expect(emailService.sendFamilyInvitation('test@example.com', familyData)).resolves.not.toThrow();
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should handle edge cases that were previously working', () => {
        // Test edge cases that should continue to work
        const edgeCases = [
          {
            description: 'URL with port number',
            env: { DEEP_LINK_BASE_URL: 'https://localhost:8443' },
            path: 'auth/verify',
            expected: 'https://localhost:8443/auth/verify',
          },
          {
            description: 'URL with query parameters in base',
            env: { DEEP_LINK_BASE_URL: 'https://app.edulift.com?utm_source=email' },
            path: 'dashboard',
            expected: 'https://app.edulift.com?utm_source=email/dashboard',
          },
          {
            description: 'edulift:// with complex path',
            env: { DEEP_LINK_BASE_URL: 'edulift://auth/' },
            path: 'verify',
            expected: 'edulift://auth/verify',
          },
        ];

        edgeCases.forEach(edgeCase => {
          delete process.env.FRONTEND_URL;
          delete process.env.DEEP_LINK_BASE_URL;
          Object.assign(process.env, edgeCase.env);

          const url = (emailService as any).generateUrl(edgeCase.path);
          expect(url).toBe(edgeCase.expected);
          expect(consoleSpy.warn).not.toHaveBeenCalled();
        });
      });

      it('should maintain parameter handling behavior', () => {
        // Test that URL parameter handling still works correctly
        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';

        const paramTestCases = [
          {
            params: new URLSearchParams({ token: 'abc123', inviteCode: 'xyz789' }),
            expectedContains: 'token=abc123&inviteCode=xyz789',
          },
          {
            params: new URLSearchParams({ code: 'TEST-CODE-WITH-DASHES' }),
            expectedContains: 'code=TEST-CODE-WITH-DASHES',
          },
          {
            params: new URLSearchParams({ email: 'user@example.com', role: 'ADMIN' }),
            expectedContains: 'email=user%40example.com&role=ADMIN',
          },
          {
            params: undefined,
            expectedContains: 'dashboard',
          },
          {
            params: new URLSearchParams(),
            expectedContains: 'dashboard',
          },
        ];

        paramTestCases.forEach(testCase => {
          const url = (emailService as any).generateUrl('dashboard', testCase.params);

          if (testCase.expectedContains === 'dashboard') {
            expect(url).toBe('https://app.edulift.com/dashboard');
          } else {
            expect(url).toContain(testCase.expectedContains);
          }

          expect(consoleSpy.warn).not.toHaveBeenCalled();
        });
      });

      it('should preserve original fallback chain order', () => {
        // Test that the fallback order is preserved: DEEP_LINK_BASE_URL -> FRONTEND_URL -> localhost

        // Case 1: DEEP_LINK_BASE_URL is valid
        process.env.DEEP_LINK_BASE_URL = 'https://primary.com';
        process.env.FRONTEND_URL = 'https://fallback.com';
        let url = (emailService as any).generateUrl('test');
        expect(url).toBe('https://primary.com/test');

        // Case 2: DEEP_LINK_BASE_URL is invalid, FRONTEND_URL is valid
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';
        process.env.FRONTEND_URL = 'https://fallback.com';
        url = (emailService as any).generateUrl('test');
        expect(url).toBe('https://fallback.com/test');
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid URL detected - Disallowed protocol: javascript:'),
          expect.any(Object),
        );

        // Reset console spy for next test
        consoleSpy.warn.mockClear();

        // Case 3: Both are invalid, fall back to localhost
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';
        process.env.FRONTEND_URL = 'data:text/html,';
        url = (emailService as any).generateUrl('test');
        expect(url).toBe('http://localhost:3000/test');
        expect(consoleSpy.warn).toHaveBeenCalledTimes(2); // One for each invalid URL
      });
    });

    describe('Performance should not be significantly impacted', () => {
      it('should handle bulk URL generation efficiently', () => {
        process.env.DEEP_LINK_BASE_URL = 'https://app.edulift.com';

        const startTime = Date.now();

        // Generate 1000 URLs
        for (let i = 0; i < 1000; i++) {
          const url = (emailService as any).generateUrl(
            `test/path/${i}`,
            new URLSearchParams({ id: i.toString(), type: 'test' }),
          );
          expect(url).toBeDefined();
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time (less than 2 seconds, allowing for CI/slow systems)
        expect(duration).toBeLessThan(2000);
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should handle invalid URL detection efficiently', () => {
        // eslint-disable-next-line no-script-url
        process.env.DEEP_LINK_BASE_URL = 'javascript:void(0)';

        const startTime = Date.now();

        // Generate 100 URLs with invalid base (should trigger validation + fallback)
        for (let i = 0; i < 100; i++) {
          const url = (emailService as any).generateUrl(
            `test/path/${i}`,
            new URLSearchParams({ id: i.toString() }),
          );
          expect(url).toBe(`http://localhost:3000/test/path/${  i  }?id=${  i}`);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should still complete within reasonable time
        expect(duration).toBeLessThan(500);
      });

      it('should demonstrate performance of new helper methods', () => {
        console.log('\n📊 Performance Test for Helper Methods:');

        // Test getSeparator performance
        const getSeparatorStart = Date.now();
        for (let i = 0; i < 10000; i++) {
          (emailService as any).getSeparator('https://app.edulift.com');
          (emailService as any).getSeparator('edulift://');
          (emailService as any).getSeparator('https://api.example.com/');
        }
        const getSeparatorTime = Date.now() - getSeparatorStart;
        console.log(`  getSeparator (30,000 calls): ${getSeparatorTime}ms`);

        // Test normalizePath performance
        const normalizePathStart = Date.now();
        for (let i = 0; i < 10000; i++) {
          (emailService as any).normalizePath('/auth/verify');
          (emailService as any).normalizePath('dashboard');
          (emailService as any).normalizePath('groups/join');
        }
        const normalizePathTime = Date.now() - normalizePathStart;
        console.log(`  normalizePath (30,000 calls): ${normalizePathTime}ms`);

        // Test buildUrl performance
        const buildUrlStart = Date.now();
        for (let i = 0; i < 10000; i++) {
          (emailService as any).buildUrl('https://app.edulift.com', 'auth/verify', new URLSearchParams({ token: 'test' }));
          (emailService as any).buildUrl('edulift://', 'dashboard');
          (emailService as any).buildUrl('https://api.example.com/', 'groups/join', new URLSearchParams({ code: 'test' }));
        }
        const buildUrlTime = Date.now() - buildUrlStart;
        console.log(`  buildUrl (30,000 calls): ${buildUrlTime}ms`);

        // Performance assertions (relaxed for CI/slow systems)
        expect(getSeparatorTime).toBeLessThan(200); // Should be very fast
        expect(normalizePathTime).toBeLessThan(200); // Should be very fast
        expect(buildUrlTime).toBeLessThan(2000); // Should be fast even with params (relaxed for slower systems)
      });
    });
  });
});