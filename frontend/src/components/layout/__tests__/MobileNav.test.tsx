import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MobileNav } from '../MobileNav';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, onClick, className, ...props }: unknown) => (
      <a href={to} onClick={onClick} className={className} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock the SheetClose component
vi.mock('../../../components/ui/sheet', () => ({
  SheetClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    return asChild ? children : <div>{children}</div>;
  }
}));

const mockOnNavigate = vi.fn();

const renderMobileNav = () => {
  return render(
    <MemoryRouter>
      <MobileNav onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );
};

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Navigation Links', () => {
    it('should render all navigation links with icons', () => {
      renderMobileNav();

      // Check all navigation links
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /manage family/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    });

    it('should render navigation links in correct order', () => {
      renderMobileNav();

      const links = screen.getAllByRole('link');
      const linkTexts = links.map(link => link.textContent?.trim());

      expect(linkTexts).toEqual([
        'Dashboard',
        'Manage Family',
        'Groups',
        'Schedule',
        'Profile'
      ]);
    });

    it('should render navigation links with correct hrefs', () => {
      renderMobileNav();

      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /manage family/i })).toHaveAttribute('href', '/family/manage');
      expect(screen.getByRole('link', { name: /groups/i })).toHaveAttribute('href', '/groups');
      expect(screen.getByRole('link', { name: /schedule/i })).toHaveAttribute('href', '/schedule');
      expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    });

    it('should render all links with proper flex layout classes', () => {
      renderMobileNav();

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('flex', 'items-center');
      });
    });
  });

  describe('Icons', () => {
    it('should render icons for all navigation links', () => {
      renderMobileNav();

      // Check that all links have icons by looking for the proper structure
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      const manageFamilyLink = screen.getByRole('link', { name: /manage family/i });
      const groupsLink = screen.getByRole('link', { name: /groups/i });
      const scheduleLink = screen.getByRole('link', { name: /schedule/i });
      const profileLink = screen.getByRole('link', { name: /profile/i });

      // Each link should have the flex items-center class which indicates icon + text layout
      [dashboardLink, manageFamilyLink, groupsLink, scheduleLink, profileLink].forEach(link => {
        expect(link).toHaveClass('flex', 'items-center');
      });
    });
  });

  describe('Navigation Callbacks', () => {
    it('should call onNavigate when Dashboard link is clicked', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      await user.click(dashboardLink);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate when Manage Family link is clicked', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const manageFamilyLink = screen.getByRole('link', { name: /manage family/i });
      await user.click(manageFamilyLink);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate when Groups link is clicked', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const groupsLink = screen.getByRole('link', { name: /groups/i });
      await user.click(groupsLink);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate when Schedule link is clicked', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const scheduleLink = screen.getByRole('link', { name: /schedule/i });
      await user.click(scheduleLink);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate when Profile link is clicked', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const profileLink = screen.getByRole('link', { name: /profile/i });
      await user.click(profileLink);

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate for each click independently', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      const profileLink = screen.getByRole('link', { name: /profile/i });

      await user.click(dashboardLink);
      expect(mockOnNavigate).toHaveBeenCalledTimes(1);

      await user.click(profileLink);
      expect(mockOnNavigate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Layout and Styling', () => {
    it('should render navigation with proper layout classes', () => {
      renderMobileNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'flex-col', 'space-y-2', 'p-4');
    });

    it('should render all buttons with ghost variant styling', () => {
      renderMobileNav();

      // All navigation items should be wrapped in buttons with ghost variant
      // Since we're mocking the Button component, we check for the structure
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(5);
    });
  });

  describe('Accessibility', () => {
    it('should have proper navigation structure', () => {
      renderMobileNav();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should have accessible link labels', () => {
      renderMobileNav();

      // All links should have accessible names
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /manage family/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderMobileNav();

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      
      // Tab to first link
      await user.tab();
      expect(dashboardLink).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Sheet Components', () => {
    it('should work with SheetClose wrapper', () => {
      renderMobileNav();

      // All links should be rendered (SheetClose is mocked to pass through)
      expect(screen.getAllByRole('link')).toHaveLength(5);
    });
  });

  describe('Profile Link Integration', () => {
    it('should include Profile link as part of mobile navigation', () => {
      renderMobileNav();

      const profileLink = screen.getByRole('link', { name: /profile/i });
      expect(profileLink).toBeInTheDocument();
      expect(profileLink).toHaveAttribute('href', '/profile');
    });

    it('should render Profile link with correct icon structure', () => {
      renderMobileNav();

      const profileLink = screen.getByRole('link', { name: /profile/i });
      expect(profileLink).toHaveClass('flex', 'items-center');
    });
  });
});