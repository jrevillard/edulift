import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import LoginPage from '../LoginPage';
import { useAuth } from '../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext');
const mockUseAuth = useAuth as unknown;

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
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
});

describe('LoginPage 401 Redirect Handling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    
    // Default auth mock - not authenticated
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });
  });

  const renderLoginPage = (locationState = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: locationState }]}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Redirect After Login', () => {
    it('should redirect to stored path from localStorage after authentication', async () => {
      // Simulate stored redirect path from 401
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule?test=1';
        return null;
      });

      // Start not authenticated
      renderLoginPage();

      // Simulate successful authentication
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      // Re-render to trigger useEffect
      renderLoginPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/schedule?test=1', { replace: true });
      });

      // Should clear the stored path
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin');
    });

    it('should redirect to location.state.from if no stored path', async () => {
      // No stored redirect path
      localStorageMock.getItem.mockReturnValue(null);

      // Render with location state (from ProtectedRoute)
      renderLoginPage({ from: { pathname: '/dashboard' } });

      // Simulate successful authentication
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      // Re-render to trigger useEffect
      renderLoginPage({ from: { pathname: '/dashboard' } });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });

      // Should not try to remove non-existent stored path
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('redirectAfterLogin');
    });

    it('should prioritize stored path over location state', async () => {
      // Both stored path and location state exist
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule';
        return null;
      });

      renderLoginPage({ from: { pathname: '/dashboard' } });

      // Simulate successful authentication
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      // Re-render to trigger useEffect
      renderLoginPage({ from: { pathname: '/dashboard' } });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/schedule', { replace: true });
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin');
    });

    it('should redirect to default dashboard if no redirect info', async () => {
      // No stored path, no location state
      localStorageMock.getItem.mockReturnValue(null);

      renderLoginPage();

      // Simulate successful authentication
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      // Re-render to trigger useEffect
      renderLoginPage();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });

  describe('Different Stored Paths', () => {
    const testPaths = [
      '/schedule',
      '/dashboard',
      '/groups',
      '/children',
      '/vehicles',
      '/groups/123/manage',
      '/schedule?group=abc&week=2024-01',
    ];

    testPaths.forEach(path => {
      it(`should redirect to stored path: ${path}`, async () => {
        localStorageMock.getItem.mockImplementation((key) => {
          if (key === 'redirectAfterLogin') return path;
          return null;
        });

        renderLoginPage();

        // Simulate authentication
        mockUseAuth.mockReturnValue({
          user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
          isAuthenticated: true,
          isLoading: false,
          login: vi.fn(),
          verifyMagicLink: vi.fn(),
          logout: vi.fn(),
          refreshToken: vi.fn(),
        });

        renderLoginPage();

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(path, { replace: true });
        });
      });
    });
  });

  describe('Authentication States', () => {
    it('should not redirect when still loading', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule';
        return null;
      });

      // Simulate loading state
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      renderLoginPage();

      // Should not redirect while loading
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should not redirect when not authenticated', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule';
        return null;
      });

      // Not authenticated
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      renderLoginPage();

      // Should not redirect when not authenticated
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed stored redirect path', async () => {
      // Invalid path
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return 'invalid-path';
        return null;
      });

      renderLoginPage();

      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      renderLoginPage();

      await waitFor(() => {
        // Should still redirect (React Router will handle invalid paths)
        expect(mockNavigate).toHaveBeenCalledWith('invalid-path', { replace: true });
      });
    });

    it('should handle localStorage errors gracefully', async () => {
      // Simulate localStorage error
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderLoginPage();

      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      renderLoginPage();

      await waitFor(() => {
        // Should still redirect to default
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });

      consoleSpy.mockRestore();
    });

    it('should handle multiple authentication state changes', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'redirectAfterLogin') return '/schedule';
        return null;
      });

      const { rerender } = renderLoginPage();

      // First auth change - still loading
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(mockNavigate).not.toHaveBeenCalled();

      // Second auth change - authenticated
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/schedule', { replace: true });
      });
    });
  });
});