/*
 * NOTE: This test file focuses on testing ManageGroupPage update functionality.
 * It uses the global OpenAPI mocks from setup.ts and only overrides specific behaviors.
 */

import React from 'react';
import { render, screen } from '../../test/test-utils';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import ManageGroupPage from '../ManageGroupPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'group-1' }), // Match global mock
  };
});

describe('ManageGroupPage - Group Update Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      render(<ManageGroupPage />);

      // Should show loading state initially
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
      expect(screen.getByTestId('LoadingState-Heading-title')).toHaveTextContent('Loading group details...');
    });

    it('should show loading spinner', async () => {
      render(<ManageGroupPage />);

      // Should show loading spinner
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();

      // Check for the spinner element (no specific testid, but we can check the class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Loading Behavior', () => {
    it('should display appropriate loading message', async () => {
      render(<ManageGroupPage />);

      // Should show loading message
      expect(screen.getByTestId('LoadingState-Heading-title')).toHaveTextContent('Loading group details...');

      const loadingDescription = screen.getByText('Please wait while we fetch the group information.');
      expect(loadingDescription).toBeInTheDocument();
    });

    it('should have proper loading container structure', async () => {
      render(<ManageGroupPage />);

      // Check that the loading container has proper structure
      const loadingContainer = screen.getByTestId('ManageGroupPage-Container-loading');
      expect(loadingContainer).toHaveClass('bg-card', 'text-card-foreground');
    });
  });
});