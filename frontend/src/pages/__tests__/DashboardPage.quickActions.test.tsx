import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import DashboardPage from '../DashboardPage';
import { render } from '../../test/test-utils';

// Mock the navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      timezone: 'UTC',
    },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SocketContext
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: true,
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock FamilyContext
vi.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => ({
    currentFamily: {
      id: 'family-1',
      name: 'Test Family',
      members: [
        { id: 'member-1', role: 'ADMIN', user: { id: 'user-123', name: 'John Doe', email: 'john@example.com', timezone: 'UTC' } }
      ],
      children: [
        { id: 'child-1', name: 'Test Child', age: 8 }
      ],
      vehicles: [
        { id: 'vehicle-1', name: 'Test Vehicle', capacity: 5 }
      ],
    },
    userPermissions: {
      canManageMembers: true,
      canModifyChildren: true,
      canModifyVehicles: true,
    },
  }),
  FamilyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock api
vi.mock('../../services/api', () => ({
  api: {
    getChildren: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getDashboardStats: vi.fn().mockResolvedValue({ data: { data: {
      groups: 2,
      children: 3,
      vehicles: 1,
      thisWeekTrips: 8,
      trends: {
        groups: { value: '+12%', direction: 'up' },
        children: { value: 'New', direction: 'up' },
        vehicles: { value: '+1', direction: 'up' },
        trips: { value: '+25%', direction: 'up' },
      },
    } } }),
    getTodaySchedule: vi.fn().mockResolvedValue({ data: { data: { upcomingTrips: [] } } }),
    getRecentActivity: vi.fn().mockResolvedValue({ data: { data: { activities: [] } } }),
  },
}));


describe('DashboardPage Quick Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all quick action buttons', async () => {
    render(<DashboardPage />);

    // Wait for the dashboard to load
    await screen.findByTestId('DashboardPage-Heading-welcomeMessage');

    // Check all quick actions are rendered
    expect(screen.getByTestId('DashboardPage-Text-actionLabel-join-a-group')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-actionLabel-add-child')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-actionLabel-add-vehicle')).toBeInTheDocument();

    // Check descriptions
    expect(screen.getByTestId('DashboardPage-Text-actionDescription-join-a-group')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-actionDescription-add-child')).toBeInTheDocument();
    expect(screen.getByTestId('DashboardPage-Text-actionDescription-add-vehicle')).toBeInTheDocument();
  });

  it('should navigate to groups page when Join a Group is clicked', async () => {
    render(<DashboardPage />);

    await screen.findByTestId('DashboardPage-Heading-welcomeMessage');

    const joinGroupButton = screen.getByTestId('DashboardPage-Button-quickAction-join-a-group');
    fireEvent.click(joinGroupButton);

    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('should navigate to children page when Add Child is clicked', async () => {
    render(<DashboardPage />);

    await screen.findByTestId('DashboardPage-Heading-welcomeMessage');

    const addChildButton = screen.getByTestId('DashboardPage-Button-quickAction-add-child');
    fireEvent.click(addChildButton);

    expect(mockNavigate).toHaveBeenCalledWith('/children');
  });

  it('should navigate to vehicles page when Add Vehicle is clicked', async () => {
    render(<DashboardPage />);

    await screen.findByTestId('DashboardPage-Heading-welcomeMessage');

    const addVehicleButton = screen.getByTestId('DashboardPage-Button-quickAction-add-vehicle');
    fireEvent.click(addVehicleButton);

    expect(mockNavigate).toHaveBeenCalledWith('/vehicles');
  });

  it('should apply proper semantic design system classes', async () => {
    render(<DashboardPage />);

    await screen.findByTestId('DashboardPage-Heading-welcomeMessage');

    // Check that buttons have proper variants
    const joinGroupButton = screen.getByTestId('DashboardPage-Button-quickAction-join-a-group');
    expect(joinGroupButton).toHaveClass('justify-start');
    
    // Check that cards exist with proper data-slot attribute
    const cards = document.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBeGreaterThan(0);
    
    // Check that badges use proper semantic data-slot
    const badges = document.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBeGreaterThan(0);
    
    // Check for semantic UI classes (bg-gray, bg-blue, etc instead of custom colors)
    const semanticBgs = document.querySelectorAll('[class*="bg-gray"], [class*="bg-blue"], [class*="bg-green"]');
    expect(semanticBgs.length).toBeGreaterThan(0);
  });
});