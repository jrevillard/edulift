import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { DesktopNav } from '../DesktopNav';
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
  ConnectionIndicator: () => <div data-testid="connection-indicator" />
}));

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: unknown) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

const renderDesktopNav = () => {
  return render(
    <MemoryRouter>
      <DesktopNav />
    </MemoryRouter>
  );
};

describe('DesktopNav', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'UTC',
  };

  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn()
    });
  });

  describe('Navigation Links', () => {
    it('should render all navigation links with icons', () => {
      renderDesktopNav();

      // Check main navigation links
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /manage family/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument();
    });

    it('should render navigation links in correct order', () => {
      renderDesktopNav();

      const links = screen.getAllByRole('link');
      const navLinks = links.filter(link => 
        link.textContent?.includes('Dashboard') ||
        link.textContent?.includes('Manage Family') ||
        link.textContent?.includes('Groups') ||
        link.textContent?.includes('Schedule')
      );

      expect(navLinks[0]).toHaveTextContent('Dashboard');
      expect(navLinks[1]).toHaveTextContent('Manage Family');
      expect(navLinks[2]).toHaveTextContent('Groups');
      expect(navLinks[3]).toHaveTextContent('Schedule');
    });

    it('should render navigation links with correct hrefs', () => {
      renderDesktopNav();

      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /manage family/i })).toHaveAttribute('href', '/family/manage');
      expect(screen.getByRole('link', { name: /groups/i })).toHaveAttribute('href', '/groups');
      expect(screen.getByRole('link', { name: /schedule/i })).toHaveAttribute('href', '/schedule');
    });
  });

  describe('User Menu', () => {
    it('should display user name in dropdown trigger', () => {
      renderDesktopNav();

      expect(screen.getByTestId('DesktopNav-Text-userName')).toHaveTextContent('Test User');
    });

    it('should display user menu trigger with correct test id', () => {
      renderDesktopNav();

      expect(screen.getByTestId('DesktopNav-Container-userMenuTrigger')).toBeInTheDocument();
    });

    it('should open dropdown menu when user name is clicked', async () => {
      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      await user.click(userMenuTrigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Check for Profile link and Logout button within the menu
      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByTestId('DesktopNav-Button-logout')).toBeInTheDocument();
      });
    });

    it('should render Profile link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      await user.click(userMenuTrigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      }, { timeout: 2000 });

      await waitFor(() => {
        const profileText = screen.getByText('Profile');
        expect(profileText).toBeInTheDocument();
        
        // Check that the profile link exists (it's wrapped in the dropdown item)
        const profileLink = profileText.closest('a');
        expect(profileLink).toHaveAttribute('href', '/profile');
      });
    });

    it('should call logout function when logout is clicked', async () => {
      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      await user.click(userMenuTrigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      }, { timeout: 2000 });

      const logoutButton = await screen.findByTestId('DesktopNav-Button-logout');
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Authentication States', () => {
    it('should display user name when user is authenticated', () => {
      renderDesktopNav();

      expect(screen.getByTestId('DesktopNav-Text-userName')).toHaveTextContent('Test User');
    });

    it('should handle missing user gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        logout: mockLogout,
        isAuthenticated: false,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        refreshToken: vi.fn()
      });

      renderDesktopNav();

      const userName = screen.getByTestId('DesktopNav-Text-userName');
      expect(userName).toBeEmptyDOMElement();
    });
  });

  describe('Connection Indicator', () => {
    it('should render connection indicator', () => {
      renderDesktopNav();

      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper navigation structure', () => {
      renderDesktopNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should have accessible dropdown menu', async () => {
      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      await user.click(userMenuTrigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should have proper keyboard navigation support', async () => {
      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      
      // Focus directly on the user menu trigger (since tab order may vary)
      userMenuTrigger.focus();
      expect(userMenuTrigger).toHaveFocus();

      // Open menu with Enter key
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle logout errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      const user = userEvent.setup();
      renderDesktopNav();

      const userMenuTrigger = screen.getByTestId('DesktopNav-Container-userMenuTrigger');
      await user.click(userMenuTrigger);

      await waitFor(() => {
        const logoutButton = screen.getByTestId('DesktopNav-Button-logout');
        expect(logoutButton).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId('DesktopNav-Button-logout');
      await user.click(logoutButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });
});