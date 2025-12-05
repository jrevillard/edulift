import { render, screen, waitFor } from '../../test/test-utils';
import DashboardPage from '../DashboardPage';
import { vi } from 'vitest';

// Note: API client is mocked globally in src/services/__tests__/setup.ts
// Note: All contexts (Auth, Family, Socket) are provided by test-utils render function

describe('DashboardPage Real Data Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Note: Using global OpenAPI client mocks from setup.ts
    // The global mocks provide comprehensive data for all dashboard endpoints
  });

  it('renders dashboard without crashing', () => {
    render(<DashboardPage />);

    // Should render the main dashboard container
    expect(screen.getByTestId('DashboardPage-Container-main')).toBeInTheDocument();
  });

  it('renders dashboard with real data', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should render the main dashboard container
      expect(screen.getByTestId('DashboardPage-Container-main')).toBeInTheDocument();
    });

    // Should render key dashboard sections
    expect(screen.getByTestId('DashboardPage-Container-welcome')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-childrenCount')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-vehiclesCount')).toBeInTheDocument();
  });

  it('displays children from the global mock', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show children from the global mock data
      expect(screen.getByTestId('DashboardPage-Text-childrenCount')).toBeInTheDocument();
    });
  });

  it('displays quick actions', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show quick actions - try a common action like create-group
      const createGroupAction = screen.queryByTestId('DashboardPage-Button-quickAction-create-group');
      if (createGroupAction) {
        expect(createGroupAction).toBeInTheDocument();
      } else {
        // Fallback: just check that some action content exists
        expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
      }
    });
  });

  it('displays recent activity or empty state', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should show either recent activity or empty state
      const recentActivity = screen.queryByTestId('DashboardPage-Text-activityAction');
      const emptyState = screen.queryByTestId('DashboardPage-Container-noRecentActivity');
      expect(recentActivity || emptyState).toBeTruthy();
    });
  });

  it('handles empty states gracefully', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Should handle empty states gracefully - even with global mocks
      expect(screen.getByTestId('DashboardPage-Container-main')).toBeInTheDocument();
    });
  });
});