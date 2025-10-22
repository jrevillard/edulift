import { vi } from 'vitest';

export const mockAuthService = {
  isAuthenticated: vi.fn().mockReturnValue(true),
  getUser: vi.fn().mockReturnValue({ id: 'user-1', email: 'test@example.com', name: 'Test User' }),
  getToken: vi.fn().mockReturnValue('mock-token'),
  setAuthChangeCallback: vi.fn(),
  isTokenExpired: vi.fn().mockReturnValue(false),
  logout: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  refreshToken: vi.fn(),
  refreshTokenFromStorage: vi.fn().mockResolvedValue(true),
  clearAuth: vi.fn(),
  storeCredentials: vi.fn(),
  getStoredCredentials: vi.fn(),
  removeStoredCredentials: vi.fn(),
};

// Common authService mock for tests
export const createAuthServiceMock = () => ({
  authService: mockAuthService
});