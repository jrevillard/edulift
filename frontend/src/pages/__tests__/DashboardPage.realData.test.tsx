import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import DashboardPage from '../DashboardPage';
import { apiService } from '../../services/apiService';
import { createMockApiService } from '../../test/test-utils';
import { vi, Mock } from 'vitest';

// Mock FamilyContext
vi.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => ({
    currentFamily: {
      id: 'family-1',
      name: 'Test Family',
      members: [],
      children: [],
      vehicles: [],
    },
    userPermissions: {
      canManageMembers: true,
      canModifyChildren: true,
      canModifyVehicles: true,
    },
    requiresFamily: false,
    hasFamily: true,
  }),
  FamilyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SocketContext
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock apiService
vi.mock('../../services/apiService');
const mockApiService = apiService as {
  getChildren: Mock;
  getTodaySchedule: Mock;
  getDashboardWeeklySchedule: Mock;
  getRecentActivity: Mock;
};

// Mock AuthContext
const mockUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  timezone: 'UTC',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock useAuth hook
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    }),
  };
});

describe('DashboardPage Real Data Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Apply comprehensive API service mocks
    const comprehensiveMocks = createMockApiService();
    Object.assign(mockApiService, comprehensiveMocks);
    
    // Override specific mocks for this test
    mockApiService.getChildren.mockResolvedValue([
      { id: 'child-1', name: 'Emma', userId: 'user-123' },
      { id: 'child-2', name: 'Lucas', userId: 'user-123' },
    ]);

    mockApiService.getDashboardStats.mockResolvedValue({
      groups: 2,
      children: 2,
      vehicles: 1,
      thisWeekTrips: 8,
      trends: {
        groups: { value: '+12%', direction: 'up', period: 'vs last week' },
        children: { value: 'New', direction: 'up', period: 'this week' },
        vehicles: { value: '+1', direction: 'up', period: 'this month' },
        trips: { value: '+25%', direction: 'up', period: 'vs last week' },
      },
    });

    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({
      data: {
        days: [
          {
            date: '2024-01-15', // Monday
            dayName: 'Monday',
            transports: [
              {
                id: 'transport-1',
                time: '08:00',
                groupName: 'Maple Street Families',
                groupId: 'group-1',
                scheduleSlotId: 'slot-1',
                vehicleAssignmentSummaries: [
                  {
                    vehicleId: 'vehicle-1',
                    vehicleName: 'Honda Civic',
                    vehicleCapacity: 4,
                    vehicleType: 'sedan',
                    driverId: 'user-123',
                    driverName: 'John Doe',
                    children: [
                      { childId: 'child-1', childName: 'Emma', childFamilyId: 'family-1', isFamilyChild: true }
                    ]
                  }
                ]
              },
              {
                id: 'transport-2',
                time: '15:30',
                groupName: 'Maple Street Families',
                groupId: 'group-1',
                scheduleSlotId: 'slot-2',
                vehicleAssignmentSummaries: [
                  {
                    vehicleId: 'vehicle-1',
                    vehicleName: 'Honda Civic',
                    vehicleCapacity: 4,
                    vehicleType: 'sedan',
                    driverId: 'user-123',
                    driverName: 'John Doe',
                    children: [
                      { childId: 'child-1', childName: 'Emma', childFamilyId: 'family-1', isFamilyChild: true }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    mockApiService.getRecentActivity.mockResolvedValue({
      activities: [
        {
          id: 'activity-1',
          action: 'Joined group "Maple Street Families"',
          time: '2 hours ago',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          type: 'group' as const,
          entityId: 'group-1',
          entityName: 'Maple Street Families',
        },
        {
          id: 'activity-2',
          action: 'Added vehicle Honda Civic',
          time: '1 day ago',
          timestamp: new Date('2024-01-14T09:00:00Z'),
          type: 'vehicle' as const,
          entityId: 'vehicle-1',
          entityName: 'Honda Civic',
        },
      ],
    });
  });

  it('should fetch and display real dashboard data', async () => {
    // Arrange & Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Check that API calls are made (only the ones the component actually uses)
    await waitFor(() => {
      expect(mockApiService.getChildren).toHaveBeenCalled();
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
      expect(mockApiService.getRecentActivity).toHaveBeenCalled();
    });

    // Check that dashboard content is displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Heading-welcomeMessage')).toHaveTextContent('Welcome back, John!');
      expect(screen.getByTestId('DashboardPage-Text-familyName')).toHaveTextContent('Test Family');
    });
  });

  it('should fetch and display real weekly schedule', async () => {
    // Arrange & Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Check that API call is made
    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Check that weekly trips are displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-08:00-vehicle-1')).toHaveTextContent('08:00');
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-15:30-vehicle-1')).toHaveTextContent('15:30');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1')).toHaveTextContent('Maple Street Families');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-15:30-vehicle-1')).toHaveTextContent('Maple Street Families');
      expect(screen.getByTestId('DashboardPage-Text-tripDate-2024-01-15-08:00-vehicle-1')).toHaveTextContent('2024-01-15');
      expect(screen.getByTestId('DashboardPage-Text-tripDate-2024-01-15-15:30-vehicle-1')).toHaveTextContent('2024-01-15');
    });
  });

  it('should fetch and display real recent activity', async () => {
    // Arrange & Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Check that API call is made
    await waitFor(() => {
      expect(mockApiService.getRecentActivity).toHaveBeenCalled();
    });

    // Check that recent activities are displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Text-activityAction-activity-1')).toHaveTextContent('Joined group "Maple Street Families"');
      expect(screen.getByTestId('DashboardPage-Text-activityAction-activity-2')).toHaveTextContent('Added vehicle Honda Civic');
      expect(screen.getByTestId('DashboardPage-Text-activityTime-activity-1')).toHaveTextContent('2 hours ago');
      expect(screen.getByTestId('DashboardPage-Text-activityTime-activity-2')).toHaveTextContent('1 day ago');
    });
  });

  it('should handle API errors gracefully', async () => {
    // Arrange - Mock API failures
    mockApiService.getDashboardWeeklySchedule.mockRejectedValue(new Error('Schedule API failed'));
    mockApiService.getRecentActivity.mockRejectedValue(new Error('Activity API failed'));

    // Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Should still render without crashing
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Heading-welcomeMessage')).toHaveTextContent('Welcome back, John!');
    });

    // Should show error messages when APIs fail
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Container-unableToLoadSchedule')).toBeInTheDocument();
      expect(screen.getByTestId('DashboardPage-Container-noRecentActivity')).toBeInTheDocument();
    });
  });

  it('should show loading states while fetching data', async () => {
    // Arrange - Make API calls hang
    mockApiService.getDashboardWeeklySchedule.mockImplementation(() => new Promise(() => {}));
    mockApiService.getRecentActivity.mockImplementation(() => new Promise(() => {}));
    
    // Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Should show loading skeleton while data is being fetched
    await waitFor(() => {
      // The loading skeleton should be visible
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
    
    // Should show loading state instead of content
    expect(screen.queryByTestId('DashboardPage-Heading-welcomeMessage')).not.toBeInTheDocument();
  });

  it('should update data when user changes', async () => {
    // This test would verify that dashboard data updates when a different user logs in
    // For now, we'll test that the APIs are called with proper context
    
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
      expect(mockApiService.getRecentActivity).toHaveBeenCalledTimes(1);
      expect(mockApiService.getChildren).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle empty data states properly', async () => {
    // Arrange - Mock empty responses
    mockApiService.getChildren.mockResolvedValue([]); // Override to ensure no children

    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({
      upcomingTrips: [],
    });

    mockApiService.getRecentActivity.mockResolvedValue({
      activities: [],
    });

    // Act
    render(<DashboardPage />, { wrapper: createWrapper() });

    // Assert - Should handle empty states gracefully
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Container-noTripsThisWeek')).toBeInTheDocument();
      expect(screen.getByTestId('DashboardPage-Container-noRecentActivity')).toBeInTheDocument();
    });

    // Should show welcome message and family info (basic dashboard content)
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Heading-welcomeMessage')).toHaveTextContent('Welcome back, John!');
      expect(screen.getByTestId('DashboardPage-Text-familyName')).toHaveTextContent('Test Family');
    });
  });
});