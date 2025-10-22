import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing authService
vi.mock('axios');

// Mock connection store
vi.mock('../../stores/connectionStore', () => {
  const mockStore = {
    apiStatus: 'connected',
    isConnected: () => true,
    hasConnectionIssues: () => false,
    setApiStatus: vi.fn(),
    setConnected: vi.fn()
  };
  
  const mockUseConnectionStore = vi.fn(() => mockStore);
  mockUseConnectionStore.getState = vi.fn(() => mockStore);
  
  return {
    useConnectionStore: mockUseConnectionStore
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window.location
const mockLocation = {
  pathname: '/schedule',
  search: '?test=1',
  href: 'http://localhost:3000/schedule?test=1',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('AuthService 401 Redirect', () => {
  let authChangeCallback: (user: unknown) => void;
  let authService: any;
  let requestInterceptor: any;
  let responseErrorInterceptor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset location mock
    mockLocation.pathname = '/schedule';
    mockLocation.search = '?test=1';
    mockLocation.href = 'http://localhost:3000/schedule?test=1';
    
    // Setup axios mock structure
    const requestInterceptorUse = vi.fn((onFulfilled) => {
      // Store interceptors for later use in tests
      requestInterceptor = onFulfilled;
      return 1; // interceptor id
    });
    
    const responseInterceptorUse = vi.fn((onFulfilled, onRejected) => {
      // Store interceptors for later use in tests
      responseErrorInterceptor = onRejected;
      return 1; // interceptor id
    });
    
    (axios as unknown as { interceptors: { request: { use: typeof requestInterceptorUse }; response: { use: typeof responseInterceptorUse } }; post: typeof vi.fn; request: typeof vi.fn }).interceptors = {
      request: { use: requestInterceptorUse },
      response: { use: responseInterceptorUse }
    };
    
    (axios as unknown as { post: typeof vi.fn; request: typeof vi.fn }).post = vi.fn();
    (axios as unknown as { post: typeof vi.fn; request: typeof vi.fn }).request = vi.fn();
    
    // Clear module cache to get fresh instance
    vi.resetModules();
    
    // Import authService after mocks are set up
    const authServiceModule = await import('../authService');
    authService = authServiceModule.authService;
    
    // Set auth change callback
    authChangeCallback = vi.fn();
    authService.setAuthChangeCallback(authChangeCallback);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should save redirect location and clear auth on 401 response', async () => {
    // Mock token in storage
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'test-token';
      if (key === 'userData') return JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' });
      return null;
    });

    // Simulate a 401 error
    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
        },
      },
    };

    // Call the error interceptor
    const result = await responseErrorInterceptor(error);

    // Should save current location
    expect(localStorageMock.setItem).toHaveBeenCalledWith('redirectAfterLogin', '/schedule?test=1');
    
    // Should clear auth
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('userData');
    
    // Should return resolved promise (not throw)
    expect(result).toBeUndefined();
    
    // Should call auth change callback
    expect(authChangeCallback).toHaveBeenCalled();
  });

  it('should handle 401 for all endpoints the same way', async () => {
    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/auth/login',
        },
      },
    };

    const result = await responseErrorInterceptor(error);
    
    // Should clear auth and return resolved promise
    expect(result).toBeUndefined();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
  });

  it('should not save redirect for login page', async () => {
    mockLocation.pathname = '/login';
    mockLocation.href = 'http://localhost:3000/login';

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
        },
      },
    };

    await responseErrorInterceptor(error);

    // Should not save login page as redirect
    expect(localStorageMock.setItem).not.toHaveBeenCalledWith('redirectAfterLogin', expect.any(String));
  });

  it('should handle non-401 errors without redirecting', async () => {
    const error = {
      response: {
        status: 500,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
        },
      },
    };

    await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
    
    // Should not clear auth
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('authToken');
  });

  it('should handle network errors without redirecting', async () => {
    const error = {
      code: 'ECONNREFUSED',
      message: 'Network Error',
    };

    await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
    
    // Should not clear auth
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('authToken');
  });

  it('should save redirect location on 401 from API endpoints', async () => {
    mockLocation.pathname = '/children';
    mockLocation.search = '?filter=active';
    mockLocation.href = 'http://localhost:3000/children?filter=active';

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/children',
        },
      },
    };

    await responseErrorInterceptor(error);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('redirectAfterLogin', '/children?filter=active');
  });

  it('should save redirect for onboarding pages', async () => {
    mockLocation.pathname = '/onboarding';
    mockLocation.search = '';
    mockLocation.href = 'http://localhost:3000/onboarding';

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
        },
      },
    };

    await responseErrorInterceptor(error);

    // Current implementation saves all non-login paths
    expect(localStorageMock.setItem).toHaveBeenCalledWith('redirectAfterLogin', '/onboarding');
  });

  it('should handle 401 for refresh token endpoint', async () => {
    const error = {
      response: {
        status: 401,
      },
      config: {
        url: 'http://localhost:3001/api/v1/auth/refresh',
      },
    };

    const result = await responseErrorInterceptor(error);
    
    // Should clear auth immediately without attempting another refresh
    expect(result).toBeUndefined();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
  });

  it('should handle 401 for verify magic link endpoint', async () => {
    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/auth/verify-magic-link',
        },
      },
    };

    const result = await responseErrorInterceptor(error);
    
    // Should clear auth like any other 401
    expect(result).toBeUndefined();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
  });

  it('should clear auth data on 401 redirect', async () => {
    // Set initial auth data
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'existing-token';
      if (key === 'userData') return JSON.stringify({ id: '1', email: 'user@example.com', name: 'User', timezone: 'UTC' });
      return null;
    });

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/protected-endpoint',
        },
      },
    };

    await responseErrorInterceptor(error);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('userData');
    expect(authChangeCallback).toHaveBeenCalled();
  });

  it('should include auth token in API requests', async () => {
    // Mock token in storage
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'test-auth-token';
      return null;
    });

    // Re-import to pick up the token
    vi.resetModules();
    const authServiceModule = await import('../authService');
    void authServiceModule.authService;

    const config = {
      url: 'http://localhost:3001/api/v1/test',
      headers: {},
    };

    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBe('Bearer test-auth-token');
  });

  it('should not add auth header to non-API requests', () => {
    const config = {
      url: 'https://external-api.com/endpoint',
      headers: {},
    };

    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('should attempt token refresh when user has token and gets 401', async () => {
    // Mock user has token
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'old-token';
      if (key === 'userData') return JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' });
      return null;
    });

    // Re-import to pick up the token
    vi.resetModules();
    const authServiceModule = await import('../authService');
    authService = authServiceModule.authService;
    authService.setAuthChangeCallback(authChangeCallback);

    // Mock refreshToken to fail
    authService.refreshToken = vi.fn().mockRejectedValue(new Error('Refresh failed'));

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
        },
      },
    };

    const result = await responseErrorInterceptor(error);

    // Should attempt refresh
    expect(authService.refreshToken).toHaveBeenCalled();
    
    // After refresh fails, should clear auth
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    expect(result).toBeUndefined();
  });

  it('should retry request after successful token refresh', async () => {
    // Mock user has token
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'old-token';
      if (key === 'userData') return JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' });
      return null;
    });

    // Re-import to pick up the token
    vi.resetModules();
    const authServiceModule = await import('../authService');
    authService = authServiceModule.authService;
    authService.setAuthChangeCallback(authChangeCallback);

    // Mock refreshToken to succeed
    authService.refreshToken = vi.fn().mockResolvedValue({ token: 'new-token' });

    // Mock axios.request for retry
    const retryResponse = { data: 'success' };
    (axios as unknown as { request: { mockResolvedValue: typeof vi.fn } }).request.mockResolvedValue(retryResponse);

    const error = {
      response: {
        status: 401,
        config: {
          url: 'http://localhost:3001/api/v1/some-endpoint',
          headers: {},
        },
      },
    };

    const result = await responseErrorInterceptor(error);

    // Should attempt refresh
    expect(authService.refreshToken).toHaveBeenCalled();
    
    // Should retry request
    expect(axios.request).toHaveBeenCalledWith(error.config);
    
    // Should return retry response
    expect(result).toEqual(retryResponse);
  });

  it('should prevent infinite loop when refresh token endpoint returns 401', async () => {
    // Mock user has token
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'expired-token';
      if (key === 'userData') return JSON.stringify({ id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' });
      return null;
    });

    // Re-import to pick up the token
    vi.resetModules();
    const authServiceModule = await import('../authService');
    authService = authServiceModule.authService;
    authService.setAuthChangeCallback(authChangeCallback);

    // Mock the refreshToken method to ensure it's not called
    const refreshTokenSpy = vi.spyOn(authService, 'refreshToken');

    // Simulate refresh token endpoint returning 401
    const refreshError = {
      response: {
        status: 401,
      },
      config: {
        url: 'http://localhost:3001/api/v1/auth/refresh',
        headers: { Authorization: 'Bearer expired-token' },
      },
    };

    const result = await responseErrorInterceptor(refreshError);

    // Should immediately clear auth without attempting another refresh
    expect(result).toBeUndefined();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('userData');
    expect(authChangeCallback).toHaveBeenCalled();
    
    // Should not attempt another refresh (no recursive call)
    expect(refreshTokenSpy).not.toHaveBeenCalled();
  });
});