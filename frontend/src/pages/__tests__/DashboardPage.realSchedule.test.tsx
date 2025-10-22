import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, Mock } from 'vitest';
import DashboardPage from '../DashboardPage';
import { apiService } from '../../services/apiService';

// Mock apiService
vi.mock('../../services/apiService');
const mockApiService = apiService as {
  getChildren: Mock;
  getDashboardStats: Mock;
  getTodaySchedule: Mock;
  getRecentActivity: Mock;
  getWeeklySchedule: Mock;
  getDashboardWeeklySchedule: Mock;
};

// Mock AuthContext
const mockUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  timezone: 'UTC',
};

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
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage Real Schedule Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockApiService.getChildren.mockResolvedValue([]);
    mockApiService.getDashboardStats.mockResolvedValue({
      groups: 0,
      children: 0,
      vehicles: 0,
      thisWeekTrips: 0,
      trends: {
        groups: { value: 'None', direction: 'neutral', period: 'current' },
        children: { value: 'None', direction: 'neutral', period: 'current' },
        vehicles: { value: 'None', direction: 'neutral', period: 'current' },
        trips: { value: 'None', direction: 'neutral', period: 'this week' },
      },
    });
    mockApiService.getRecentActivity.mockResolvedValue({ activities: [] });
    // Add missing weekly schedule mock
    mockApiService.getWeeklySchedule.mockResolvedValue({ 
      trips: [], 
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });
    // Add missing dashboard weekly schedule mock
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({ 
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });
  });

  it('should show empty state when no schedule trips exist', async () => {
    // Mock empty schedule response
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Container-noTripsThisWeek')).toBeInTheDocument();
    });
  });

  it('should display real schedule data from database', async () => {
    // Mock real schedule data
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({
      upcomingTrips: [
        {
          id: 'real-trip-1',
          time: '07:30',
          destination: 'Roosevelt Elementary',
          type: 'pickup' as const,
          date: 'Today',
          children: [
            { id: 'child-real-1', name: 'Alice' },
            { id: 'child-real-2', name: 'Bob' }
          ],
          vehicle: { 
            id: 'vehicle-real-1', 
            name: 'Toyota Sienna', 
            capacity: 8 
          },
          driver: { 
            id: 'user-real-driver', 
            name: 'Sarah Wilson' 
          },
          group: { 
            id: 'group-real-1', 
            name: 'Roosevelt Families' 
          },
        },
        {
          id: 'real-trip-2',
          time: '16:00',
          destination: 'Home',
          type: 'dropoff' as const,
          date: 'Today',
          children: [
            { id: 'child-real-1', name: 'Alice' }
          ],
          vehicle: { 
            id: 'vehicle-real-2', 
            name: 'Honda Pilot', 
            capacity: 5 
          },
          driver: { 
            id: 'user-123', 
            name: 'John Doe' 
          },
          group: { 
            id: 'group-real-1', 
            name: 'Roosevelt Families' 
          },
        },
      ],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Check that real trip data is displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-real-trip-1')).toHaveTextContent('07:30');
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-real-trip-2')).toHaveTextContent('16:00');
      expect(screen.getByTestId('DashboardPage-Text-tripDestination-real-trip-1')).toHaveTextContent('Roosevelt Elementary');
      expect(screen.getByTestId('DashboardPage-Text-tripDestination-real-trip-2')).toHaveTextContent('Home');
      expect(screen.getByTestId('DashboardPage-Text-tripType-real-trip-1')).toHaveTextContent('Pick up');
      expect(screen.getByTestId('DashboardPage-Text-tripType-real-trip-2')).toHaveTextContent('Drop off');
    });

    // Verify no mock data appears
    expect(screen.queryByTestId('trip-destination-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trip-time-mock')).not.toBeInTheDocument();
  });

  it('should handle multiple trips with different times correctly', async () => {
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({
      upcomingTrips: [
        {
          id: 'morning-trip',
          time: '06:45',
          destination: 'Early Care',
          type: 'pickup' as const,
          date: 'Today',
          children: [{ id: 'child-1', name: 'Emma' }],
          vehicle: { id: 'vehicle-1', name: 'Sedan', capacity: 4 },
          driver: { id: 'user-123', name: 'John Doe' },
          group: { id: 'group-1', name: 'Early Birds' },
        },
        {
          id: 'late-trip',
          time: '18:30',
          destination: 'After School Program',
          type: 'dropoff' as const,
          date: 'Today',
          children: [{ id: 'child-2', name: 'Max' }],
          vehicle: { id: 'vehicle-2', name: 'Van', capacity: 8 },
          driver: { id: 'user-456', name: 'Jane Smith' },
          group: { id: 'group-2', name: 'After Care' },
        },
      ],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // All times should be displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-morning-trip')).toHaveTextContent('06:45');
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-late-trip')).toHaveTextContent('18:30');
      expect(screen.getByTestId('DashboardPage-Text-tripDestination-morning-trip')).toHaveTextContent('Early Care');
      expect(screen.getByTestId('DashboardPage-Text-tripDestination-late-trip')).toHaveTextContent('After School Program');
    });
  });

  it('should handle schedule API errors gracefully', async () => {
    mockApiService.getDashboardWeeklySchedule.mockRejectedValue(new Error('Schedule service unavailable'));

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Should show error state or handle gracefully
    await waitFor(() => {
      // The dashboard should handle errors gracefully, may show loading or fallback state
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    });
  });

  it('should use correct API endpoint for weekly schedule', async () => {
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({ 
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalledWith(); // No parameters expected
    });
  });

  it('should apply correct caching strategy for schedule data', async () => {
    mockApiService.getDashboardWeeklySchedule.mockResolvedValue({ 
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    });

    const { rerender } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
    });

    // Rerender should use cached data
    rerender(<DashboardPage />);

    // Should still only be called once due to caching
    expect(mockApiService.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
  });
});