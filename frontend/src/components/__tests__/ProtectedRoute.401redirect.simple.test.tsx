import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

// Mock the AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

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

// Mock React Router Navigate to prevent redirect loops
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-to">{to}</div>,
  };
});

// Mock console.log to test logging
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ProtectedRoute 401 Redirect - Simple Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockClear();
  });

  const renderProtectedRoute = (initialEntries = ['/schedule']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <ProtectedRoute>
          <div data-testid="protected-content">Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
  };

  describe('When user is authenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should render protected content', () => {
      renderProtectedRoute();
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should not log redirect messages', () => {
      renderProtectedRoute();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('ProtectedRoute: User not authenticated')
      );
    });
  });

  describe('When user is not authenticated', () => {
    beforeEach(() => {
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

    it('should not render protected content', () => {
      renderProtectedRoute();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should log redirect messages for schedule page', () => {
      renderProtectedRoute(['/schedule']);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🛡️ ProtectedRoute: User not authenticated, redirecting to login'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🛡️ ProtectedRoute: Current location:', '/schedule'
      );
    });

    it('should log redirect messages for different protected routes', () => {
      const testRoutes = ['/dashboard', '/groups', '/children', '/vehicles'];
      
      testRoutes.forEach(route => {
        consoleLogSpy.mockClear();
        renderProtectedRoute([route]);
        
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '🛡️ ProtectedRoute: Current location:', route
        );
      });
    });
  });

  describe('When authentication is loading', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should show loading state', () => {
      renderProtectedRoute();
      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should not log redirect messages during loading', () => {
      renderProtectedRoute();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('ProtectedRoute: User not authenticated')
      );
    });
  });
});