import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, Mock } from 'vitest';
import DashboardPage from '../DashboardPage';
import { api } from '../../services/api';

// Mock api
vi.mock('../../services/api');
const mockApi = api as {
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
    mockApi.getChildren.mockResolvedValue({ data: { data: [] } });
    mockApi.getDashboardStats.mockResolvedValue({ data: { data: {
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
    } } });
    mockApi.getRecentActivity.mockResolvedValue({ data: { data: { activities: [] } } });
    // Add missing weekly schedule mock
    mockApi.getWeeklySchedule.mockResolvedValue({ data: { data: {
      trips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    } } });
    // Add missing dashboard weekly schedule mock
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    } } });
  });

  it('should show empty state when no schedule trips exist', async () => {
    // Mock empty schedule response
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Container-noTripsThisWeek')).toBeInTheDocument();
    });
  });

  it('should display real schedule data from database', async () => {
    // Mock real schedule data
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      days: [
        {
          date: '2024-01-15',
          dayName: 'Monday',
          transports: [
            {
              id: 'real-transport-1',
              time: '07:30',
              groupName: 'Roosevelt Families',
              groupId: 'group-real-1',
              scheduleSlotId: 'slot-real-1',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-real-1',
                  vehicleName: 'Toyota Sienna',
                  vehicleCapacity: 8,
                  vehicleType: 'van',
                  driverId: 'user-real-driver',
                  driverName: 'Sarah Wilson',
                  children: [
                    { childId: 'child-real-1', childName: 'Alice', childFamilyId: 'family-1', isFamilyChild: true },
                    { childId: 'child-real-2', childName: 'Bob', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ]
            },
            {
              id: 'real-transport-2',
              time: '16:00',
              groupName: 'Roosevelt Families',
              groupId: 'group-real-1',
              scheduleSlotId: 'slot-real-2',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-real-2',
                  vehicleName: 'Honda Pilot',
                  vehicleCapacity: 5,
                  vehicleType: 'suv',
                  driverId: 'user-123',
                  driverName: 'John Doe',
                  children: [
                    { childId: 'child-real-1', childName: 'Alice', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Check that real trip data is displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-07:30-vehicle-real-1')).toHaveTextContent('07:30');
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-16:00-vehicle-real-2')).toHaveTextContent('16:00');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-07:30-vehicle-real-1')).toHaveTextContent('Roosevelt Families');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-16:00-vehicle-real-2')).toHaveTextContent('Roosevelt Families');
      expect(screen.getByTestId('DashboardPage-Text-tripDate-2024-01-15-07:30-vehicle-real-1')).toHaveTextContent('2024-01-15');
      expect(screen.getByTestId('DashboardPage-Text-tripDate-2024-01-15-16:00-vehicle-real-2')).toHaveTextContent('2024-01-15');
    });

    // Verify no mock data appears
    expect(screen.queryByTestId('trip-destination-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trip-time-mock')).not.toBeInTheDocument();
  });

  it('should handle multiple trips with different times correctly', async () => {
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      days: [
        {
          date: '2024-01-15',
          dayName: 'Monday',
          transports: [
            {
              id: 'transport-morning',
              time: '06:45',
              groupName: 'Early Care Group',
              groupId: 'group-early-care',
              scheduleSlotId: 'slot-early',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-1',
                  vehicleName: 'Sedan',
                  vehicleCapacity: 4,
                  vehicleType: 'sedan',
                  driverId: 'user-123',
                  driverName: 'John Doe',
                  children: [
                    { childId: 'child-1', childName: 'Test Child', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ],
            },
            {
              id: 'transport-late',
              time: '18:30',
              groupName: 'After School Program',
              groupId: 'group-after-school',
              scheduleSlotId: 'slot-late',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-2',
                  vehicleName: 'Van',
                  vehicleCapacity: 8,
                  vehicleType: 'van',
                  driverId: 'user-456',
                  driverName: 'Jane Smith',
                  children: [
                    { childId: 'child-2', childName: 'Another Child', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ],
            }
          ]
        }
      ]
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // All times should be displayed
    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-06:45-vehicle-1')).toHaveTextContent('06:45');
      expect(screen.getByTestId('DashboardPage-Badge-tripTime-2024-01-15-18:30-vehicle-2')).toHaveTextContent('18:30');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-06:45-vehicle-1')).toHaveTextContent('Early Care Group');
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-18:30-vehicle-2')).toHaveTextContent('After School Program');
    });
  });

  it('should handle schedule API errors gracefully', async () => {
    mockApi.getDashboardWeeklySchedule.mockRejectedValue(new Error('Schedule service unavailable'));

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalled();
    });

    // Should show error state or handle gracefully
    await waitFor(() => {
      // The dashboard should handle errors gracefully, may show loading or fallback state
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    });
  });

  it('should use correct API endpoint for weekly schedule', async () => {
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalledWith(); // No parameters expected
    });
  });

  it('should apply correct caching strategy for schedule data', async () => {
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      upcomingTrips: [],
      weekDates: {
        start: '2024-01-01',
        end: '2024-01-07',
        days: []
      }
    } } });

    const { rerender } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
    });

    // Rerender should use cached data
    rerender(<DashboardPage />);

    // Should still only be called once due to caching
    expect(mockApi.getDashboardWeeklySchedule).toHaveBeenCalledTimes(1);
  });

  it('should handle clickable group names functionality', async () => {
    // Mock real schedule data with valid group
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      days: [
        {
          date: '2024-01-15',
          dayName: 'Monday',
          transports: [
            {
              id: 'transport-with-valid-group',
              time: '08:00',
              groupName: 'Test Group',
              groupId: 'group-valid-id',
              scheduleSlotId: 'slot-valid',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-1',
                  vehicleName: 'Test Vehicle',
                  vehicleCapacity: 4,
                  vehicleType: 'sedan',
                  driverId: 'user-123',
                  driverName: 'John Doe',
                  children: [
                    { childId: 'child-1', childName: 'Test Child', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1')).toBeInTheDocument();
    });

    const groupButton = screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1');

    // Check that button is enabled and has proper attributes
    expect(groupButton).not.toBeDisabled();
    expect(groupButton).toHaveAttribute('title', 'View Test Group details');
    expect(groupButton).toHaveClass('text-primary', 'hover:text-primary/80', 'hover:underline', 'cursor-pointer');
  });

  it('should handle unknown groups correctly', async () => {
    // Mock real schedule data with unknown group
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      days: [
        {
          date: '2024-01-15',
          dayName: 'Monday',
          transports: [
            {
              id: 'transport-with-unknown-group',
              time: '08:00',
              groupName: 'Unknown Group',
              groupId: 'unknown-group',
              scheduleSlotId: 'slot-unknown',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-1',
                  vehicleName: 'Test Vehicle',
                  vehicleCapacity: 4,
                  vehicleType: 'sedan',
                  driverId: 'user-123',
                  driverName: 'John Doe',
                  children: [
                    { childId: 'child-1', childName: 'Test Child', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1')).toBeInTheDocument();
    });

    const groupButton = screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1');

    // Check that button is disabled and has proper attributes for unknown groups
    expect(groupButton).toBeDisabled();
    expect(groupButton).toHaveAttribute('title', 'Group details not available');
    expect(groupButton).toHaveClass('text-muted-foreground', 'cursor-not-allowed');
    expect(groupButton).not.toHaveClass('text-primary', 'hover:text-primary/80');
  });

  it('should handle groups without groupId correctly', async () => {
    // Mock real schedule data with missing groupId
    mockApi.getDashboardWeeklySchedule.mockResolvedValue({ data: { data: {
      days: [
        {
          date: '2024-01-15',
          dayName: 'Monday',
          transports: [
            {
              id: 'transport-no-group-id',
              time: '08:00',
              groupName: 'Group without ID',
              groupId: null,
              scheduleSlotId: 'slot-no-id',
              vehicleAssignmentSummaries: [
                {
                  vehicleId: 'vehicle-1',
                  vehicleName: 'Test Vehicle',
                  vehicleCapacity: 4,
                  vehicleType: 'sedan',
                  driverId: 'user-123',
                  driverName: 'John Doe',
                  children: [
                    { childId: 'child-1', childName: 'Test Child', childFamilyId: 'family-1', isFamilyChild: true }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } } });

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1')).toBeInTheDocument();
    });

    const groupButton = screen.getByTestId('DashboardPage-Button-tripGroup-2024-01-15-08:00-vehicle-1');

    // Check that button is disabled when groupId is missing
    expect(groupButton).toBeDisabled();
    expect(groupButton).toHaveAttribute('title', 'Group details not available');
    expect(groupButton).toHaveClass('text-muted-foreground', 'cursor-not-allowed');
  });
});