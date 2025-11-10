import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../authService';
import { secureStorage } from '@/utils/secureStorage';

const mockSecureStorage = vi.mocked(secureStorage);

// Mock sessionStorage for redirect paths
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock secureStorage
vi.mock('@/utils/secureStorage', () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock window.location
const mockLocation = {
  pathname: '/schedule',
  search: '?test=1',
  href: 'http://localhost:3000/schedule?test=1',
};

Object.defineProperty(global, 'location', {
  value: mockLocation,
  writable: true,
});

describe('AuthService 401 Redirect - Simple Test', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockSecureStorage.getItem.mockResolvedValue(null);
    sessionStorageMock.getItem.mockReturnValue(null);
    mockLocation.pathname = '/schedule';
    mockLocation.search = '?test=1';
  });

  describe('Basic Auth Service Functionality', () => {
    it('should be able to set and call auth change callback', () => {
      const callback = vi.fn();
      
      // Test that we can register a callback
      authService.setAuthChangeCallback(callback);
      
      // Test that clearing auth calls the callback
      (authService as unknown as { clearAuth: () => void }).clearAuth();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should clear secureStorage when auth is cleared', () => {
      (authService as unknown as { clearAuth: () => void }).clearAuth();

      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('userData');
    });

    it('should store redirect path correctly', () => {
      const redirectToLogin = (authService as unknown as { redirectToLogin: () => void }).redirectToLogin.bind(authService);

      redirectToLogin();

      // Should store the current path
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'redirectAfterLogin',
        '/schedule?test=1'
      );
    });

    it('should not store root path as redirect', () => {
      mockLocation.pathname = '/';
      mockLocation.search = '';

      const redirectToLogin = (authService as unknown as { redirectToLogin: () => void }).redirectToLogin.bind(authService);
      redirectToLogin();

      // Should not store root path
      expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith(
        'redirectAfterLogin',
        expect.any(String)
      );
    });

    it('should not store login path as redirect', () => {
      mockLocation.pathname = '/login';
      mockLocation.search = '';

      const redirectToLogin = (authService as unknown as { redirectToLogin: () => void }).redirectToLogin.bind(authService);
      redirectToLogin();

      // Should not store login path
      expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith(
        'redirectAfterLogin',
        expect.any(String)
      );
    });
  });

  describe('Auth State Management', () => {
    it('should check if user is authenticated', () => {
      // With no token/user, should be false
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should get redirect after login path', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule?test=1';
        return null;
      });

      expect(authService.getRedirectAfterLogin()).toBe('/schedule?test=1');
    });

    it('should clear redirect after login path', () => {
      authService.clearRedirectAfterLogin();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin');
    });
  });

  describe('Redirect Path Logic', () => {
    const testPaths = [
      { path: '/schedule', search: '?test=1', expected: '/schedule?test=1', shouldStore: true },
      { path: '/dashboard', search: '', expected: '/dashboard', shouldStore: true },
      { path: '/groups', search: '?id=123', expected: '/groups?id=123', shouldStore: true },
      { path: '/', search: '', expected: '/', shouldStore: false },
      { path: '/login', search: '', expected: '/login', shouldStore: false },
    ];

    testPaths.forEach(({ path, search, expected, shouldStore }) => {
      it(`should ${shouldStore ? 'store' : 'not store'} path: ${expected}`, () => {
        mockLocation.pathname = path;
        mockLocation.search = search;

        sessionStorageMock.setItem.mockClear();

        const redirectToLogin = (authService as unknown as { redirectToLogin: () => void }).redirectToLogin.bind(authService);
        redirectToLogin();

        if (shouldStore) {
          expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
            'redirectAfterLogin',
            expected
          );
        } else {
          expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith(
            'redirectAfterLogin',
            expect.any(String)
          );
        }
      });
    });
  });
});