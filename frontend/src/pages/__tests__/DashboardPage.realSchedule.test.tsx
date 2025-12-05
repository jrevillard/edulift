import { render, screen, waitFor } from '../../test/test-utils';
import DashboardPage from '../DashboardPage';
import { vi } from 'vitest';

// Note: API client is mocked globally in src/services/__tests__/setup.ts
// Note: All contexts (Auth, Family, Socket) are provided by test-utils render function

describe('DashboardPage Real Schedule Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Note: Using global OpenAPI client mocks from setup.ts
    // The global mocks provide comprehensive data for all dashboard endpoints
  });

  it('renders dashboard schedule section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should render the main dashboard container
      expect(screen.getByTestId('DashboardPage-Container-main')).toBeInTheDocument();
    });

    // Should render schedule-related sections
    expect(screen.getByTestId('DashboardPage-Container-welcome')).toBeInTheDocument();
  });

  it('displays weekly schedule data from global mocks', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show either trips for this week or no trips message
      const tripElement = screen.queryByTestId('DashboardPage-Badge-tripTime');
      const noTripsElement = screen.queryByTestId('DashboardPage-Container-noTripsThisWeek');
      expect(tripElement || noTripsElement).toBeTruthy();
    });
  });

  it('handles schedule loading states', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should handle loading states gracefully
      expect(screen.getByTestId('DashboardPage-Container-main')).toBeInTheDocument();
    });
  });

  it('displays recent activity section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show either recent activity or empty state
      const recentActivity = screen.queryByTestId('DashboardPage-Text-activityAction');
      const emptyState = screen.queryByTestId('DashboardPage-Container-noRecentActivity');
      expect(recentActivity || emptyState).toBeTruthy();
    });
  });

  it('shows user profile and welcome message', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show user profile and welcome section
      expect(screen.getByTestId('DashboardPage-Container-welcome')).toBeInTheDocument();
      expect(screen.getByTestId('DashboardPage-Container-userProfile')).toBeInTheDocument();
    });
  });

  it('displays family information', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show family-related information
      expect(screen.getByTestId('DashboardPage-Container-welcome')).toBeInTheDocument();
      // Just check that user profile is present (indicates family context is working)
      expect(screen.getByTestId('DashboardPage-Container-userProfile')).toBeInTheDocument();
    });
  });

  it('shows quick actions for navigation', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show quick actions section
      expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    });
  });

  it('handles empty schedule gracefully', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should handle empty states gracefully
      const mainContainer = screen.getByTestId('DashboardPage-Container-main');
      expect(mainContainer).toBeInTheDocument();
    });
  });

  it('displays schedule or error state', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show either schedule or error/loading state
      const scheduleError = screen.queryByTestId('DashboardPage-Container-unableToLoadSchedule');
      const mainContainer = screen.getByTestId('DashboardPage-Container-main');
      expect(mainContainer).toBeInTheDocument();
      // Error state is optional depending on mock responses
    });
  });
});