import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BottomNav } from '../BottomNav';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../../contexts/AuthContext');
const mockUseAuth = useAuth as vi.MockedFunction<typeof useAuth>;

// Mock connection store
vi.mock('../../../stores/connectionStore', () => {
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

// Mock ConnectionIndicator component
vi.mock('../../../components/ConnectionIndicator', () => ({
  ConnectionIndicator: ({ className }: { className?: string }) => (
    <div data-testid="connection-indicator" className={className} />
  )
}));

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const renderBottomNav = (pathname = '/dashboard') => {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomNav />
    </MemoryRouter>
  );
};

describe('BottomNav', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn()
    });
  });

  describe('Navigation Tabs', () => {
    it('should render all navigation tabs', () => {
      renderBottomNav();

      expect(screen.getByTestId('BottomNav-Button-home')).toBeInTheDocument();
      expect(screen.getByTestId('BottomNav-Button-family')).toBeInTheDocument();
      expect(screen.getByTestId('BottomNav-Button-schedule')).toBeInTheDocument();
      expect(screen.getByTestId('BottomNav-Button-logout')).toBeInTheDocument();
    });

    it('should render tabs with correct labels', () => {
      renderBottomNav();

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.getByText('Schedule')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should render tabs with correct icons', () => {
      renderBottomNav();

      // Check that tabs have proper structure (icons are rendered as SVG elements)
      const homeTab = screen.getByTestId('BottomNav-Button-home');
      const familyTab = screen.getByTestId('BottomNav-Button-family');
      const scheduleTab = screen.getByTestId('BottomNav-Button-schedule');
      const logoutTab = screen.getByTestId('BottomNav-Button-logout');

      // Each tab should contain an SVG icon (lucide-react icons render as SVG)
      expect(homeTab.querySelector('svg')).toBeInTheDocument();
      expect(familyTab.querySelector('svg')).toBeInTheDocument();
      expect(scheduleTab.querySelector('svg')).toBeInTheDocument();
      expect(logoutTab.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Navigation Functionality', () => {
    it('should navigate to dashboard when Home tab is clicked', async () => {
      const user = userEvent.setup();
      renderBottomNav();

      const homeTab = screen.getByTestId('BottomNav-Button-home');
      await user.click(homeTab);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to family manage when Family tab is clicked', async () => {
      const user = userEvent.setup();
      renderBottomNav();

      const familyTab = screen.getByTestId('BottomNav-Button-family');
      await user.click(familyTab);

      expect(mockNavigate).toHaveBeenCalledWith('/family/manage');
    });

    it('should navigate to schedule when Schedule tab is clicked', async () => {
      const user = userEvent.setup();
      renderBottomNav();

      const scheduleTab = screen.getByTestId('BottomNav-Button-schedule');
      await user.click(scheduleTab);

      expect(mockNavigate).toHaveBeenCalledWith('/schedule');
    });

    it('should call logout function when Logout tab is clicked', async () => {
      const user = userEvent.setup();
      renderBottomNav();

      const logoutTab = screen.getByTestId('BottomNav-Button-logout');
      await user.click(logoutTab);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Active State Styling', () => {
    it('should highlight Home tab when on dashboard route', () => {
      renderBottomNav('/dashboard');

      const homeTab = screen.getByTestId('BottomNav-Button-home');
      expect(homeTab).toHaveClass('text-primary');
    });

    it('should highlight Family tab when on family/manage route', () => {
      renderBottomNav('/family/manage');

      const familyTab = screen.getByTestId('BottomNav-Button-family');
      expect(familyTab).toHaveClass('text-primary');
    });

    it('should highlight Schedule tab when on schedule route', () => {
      renderBottomNav('/schedule');

      const scheduleTab = screen.getByTestId('BottomNav-Button-schedule');
      expect(scheduleTab).toHaveClass('text-primary');
    });

    it('should not highlight any navigation tab when on other routes', () => {
      renderBottomNav('/groups');

      const homeTab = screen.getByTestId('BottomNav-Button-home');
      const familyTab = screen.getByTestId('BottomNav-Button-family');
      const scheduleTab = screen.getByTestId('BottomNav-Button-schedule');

      expect(homeTab).toHaveClass('text-muted-foreground');
      expect(familyTab).toHaveClass('text-muted-foreground');
      expect(scheduleTab).toHaveClass('text-muted-foreground');
    });

    it('should always show logout tab with muted foreground (no active state)', () => {
      renderBottomNav('/dashboard');

      const logoutTab = screen.getByTestId('BottomNav-Button-logout');
      expect(logoutTab).toHaveClass('text-muted-foreground');
    });
  });

  describe('Layout and Structure', () => {
    it('should render as fixed bottom navigation', () => {
      renderBottomNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
    });

    it('should have proper grid layout for tabs', () => {
      renderBottomNav();

      const tabContainer = screen.getByRole('navigation').querySelector('.grid.grid-cols-4');
      expect(tabContainer).toBeInTheDocument();
    });

    it('should render connection indicator', () => {
      renderBottomNav();

      const connectionIndicator = screen.getByTestId('connection-indicator');
      expect(connectionIndicator).toBeInTheDocument();
      expect(connectionIndicator).toHaveClass('scale-75');
    });

    it('should position connection indicator correctly', () => {
      renderBottomNav();

      const connectionIndicator = screen.getByTestId('connection-indicator');
      const container = connectionIndicator.parentElement;
      expect(container).toHaveClass('absolute', 'top-1', 'right-2', 'z-10');
    });
  });

  describe('Accessibility', () => {
    it('should have proper navigation structure', () => {
      renderBottomNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should have accessible button labels', () => {
      renderBottomNav();

      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /family/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderBottomNav();

      const homeTab = screen.getByTestId('BottomNav-Button-home');
      
      // Tab to first button
      await user.tab();
      expect(homeTab).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should have minimum touch target size', () => {
      renderBottomNav();

      const tabs = [
        screen.getByTestId('BottomNav-Button-home'),
        screen.getByTestId('BottomNav-Button-family'),
        screen.getByTestId('BottomNav-Button-schedule'),
        screen.getByTestId('BottomNav-Button-logout')
      ];

      tabs.forEach(tab => {
        expect(tab).toHaveClass('min-h-[44px]');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle logout errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      const user = userEvent.setup();
      renderBottomNav();

      const logoutTab = screen.getByTestId('BottomNav-Button-logout');
      await user.click(logoutTab);

      // Should still attempt logout despite error
      expect(mockLogout).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Responsive Design', () => {
    it('should render with mobile-optimized styling', () => {
      renderBottomNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-background', 'border-t');
    });

    it('should have proper spacing and layout for mobile', () => {
      renderBottomNav();

      const tabContainer = screen.getByRole('navigation').querySelector('.h-16');
      expect(tabContainer).toBeInTheDocument();
    });
  });
});