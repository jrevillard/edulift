import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VehicleSelectionModal from '../VehicleSelectionModal';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../services/api';

// Mock dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/SocketContext');
vi.mock('../../services/api');

// Test data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  timezone: 'UTC',
};

const mockVehicles = [
  {
    id: 'vehicle-1',
    name: 'Bus 1',
    capacity: 20,
    familyId: 'family-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'vehicle-2',
    name: 'Van 1',
    capacity: 8,
    familyId: 'family-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockScheduleSlot = {
  id: 'slot-1',
  groupId: 'group-1',
  day: 'MONDAY',
  time: '08:00',
  week: '2024-01',
  vehicleAssignments: [],
  childAssignments: [],
  totalCapacity: 0,
  availableSeats: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('VehicleSelectionModal - Seat Override', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      checkAuth: vi.fn()
    });

    vi.mocked(useSocket).mockReturnValue({
      socket: null,
      isConnected: false
    });

    // Mock the new OpenAPI API calls
    vi.mocked(api.GET).mockImplementation((path: string) => {
      if (path === '/vehicles') {
        return Promise.resolve({ data: { data: mockVehicles }, error: undefined });
      }
      if (path.startsWith('/schedule-slots/')) {
        return Promise.resolve({ data: { data: mockScheduleSlot }, error: undefined });
      }
      return Promise.resolve({ data: undefined, error: undefined });
    });

    vi.mocked(api.POST).mockImplementation((path: string) => {
      if (path.includes('/schedule-slots/')) {
        return Promise.resolve({ data: { data: mockScheduleSlot }, error: undefined });
      }
      return Promise.resolve({ data: undefined, error: undefined });
    });
  });

  it('should render seat override input field', async () => {
    const Wrapper = createWrapper();
    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load and select one to show seat override input
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    // Select a vehicle to show the seat override input
    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    await waitFor(() => {
      expect(screen.getByText(/Seats for this trip/i)).toBeInTheDocument();
    });

    const seatOverrideInput = screen.getByTestId('seat-override-input');
    expect(seatOverrideInput).toBeInTheDocument();
    expect(seatOverrideInput).toHaveAttribute('type', 'number');
    expect(seatOverrideInput).toHaveAttribute('min', '1');
    expect(seatOverrideInput).toHaveAttribute('max', '10');
  });

  it('should allow entering seat override value', async () => {
    const Wrapper = createWrapper();
    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load and select one
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    await waitFor(() => {
      expect(screen.getByTestId('seat-override-input')).toBeInTheDocument();
    });

    const seatOverrideInput = screen.getByTestId('seat-override-input');
    
    fireEvent.change(seatOverrideInput, { target: { value: '15' } });
    
    expect(seatOverrideInput).toHaveValue(15);
  });

  it('should pass seat override when creating new schedule slot with vehicle', async () => {
    const createSpy = vi.fn().mockResolvedValue({ data: { data: mockScheduleSlot }, error: undefined });
    vi.mocked(api.POST).mockImplementation((path: string, options?: any) => {
      if (path.includes('/groups/') && path.includes('/schedule-slots')) {
        createSpy(path, options);
        return Promise.resolve({ data: { data: mockScheduleSlot }, error: undefined });
      }
      return Promise.resolve({ data: undefined, error: undefined });
    });

    const Wrapper = createWrapper();
    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    // Select a vehicle
    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    // Wait for seat override input to appear
    await waitFor(() => {
      expect(screen.getByTestId('seat-override-input')).toBeInTheDocument();
    });

    // Enter seat override
    const seatOverrideInput = screen.getByTestId('seat-override-input');
    fireEvent.change(seatOverrideInput, { target: { value: '15' } });

    // Submit
    const addButton = screen.getByTestId('confirm-assignment');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        '/groups/{groupId}/schedule-slots',
        expect.objectContaining({
          params: { path: { groupId: 'group-1' } },
          body: {
            datetime: '2024-01T08:00:00',
            vehicleId: 'vehicle-1',
            driverId: 'user-1',
            seatOverride: 15
          }
        })
      );
    });
  });

  it('should pass seat override when assigning vehicle to existing slot', async () => {
    const existingSlot = {
      ...mockScheduleSlot,
      id: 'existing-slot-1'
    };

    const assignSpy = vi.fn().mockResolvedValue({ data: { data: {
      id: 'assignment-1',
      scheduleSlotId: 'existing-slot-1',
      vehicleId: 'vehicle-1',
      driverId: 'user-1',
      seatOverride: 15,
      vehicle: mockVehicles[0],
      driver: { id: 'user-1', name: 'Test User' }
    } }, error: undefined });

    vi.mocked(api.POST).mockImplementation((path: string, options?: any) => {
      if (path.includes('/schedule-slots/') && path.includes('/vehicles')) {
        assignSpy(path, options);
        return Promise.resolve({ data: { data: {
          id: 'assignment-1',
          scheduleSlotId: 'existing-slot-1',
          vehicleId: 'vehicle-1',
          driverId: 'user-1',
          seatOverride: 15,
          vehicle: mockVehicles[0],
          driver: { id: 'user-1', name: 'Test User' }
        } }, error: undefined });
      }
      return Promise.resolve({ data: undefined, error: undefined });
    });

    const Wrapper = createWrapper();
    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId="existing-slot-1"
        existingScheduleSlot={existingSlot}
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    // Select a vehicle
    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    // Wait for seat override input to appear
    await waitFor(() => {
      expect(screen.getByTestId('seat-override-input')).toBeInTheDocument();
    });

    // Enter seat override
    const seatOverrideInput = screen.getByTestId('seat-override-input');
    fireEvent.change(seatOverrideInput, { target: { value: '12' } });

    // Submit
    const addButton = screen.getByTestId('confirm-assignment');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        '/schedule-slots/{scheduleSlotId}/vehicles',
        expect.objectContaining({
          params: { path: { scheduleSlotId: 'existing-slot-1' } },
          body: {
            vehicleId: 'vehicle-1',
            driverId: 'user-1',
            seatOverride: 12
          }
        })
      );
    });
  });

  it('should not pass seat override when field is empty', async () => {
    const createSpy = vi.fn().mockResolvedValue({ data: { data: mockScheduleSlot }, error: undefined });
    vi.mocked(api.POST).mockImplementation((path: string, options?: any) => {
      if (path.includes('/groups/') && path.includes('/schedule-slots')) {
        createSpy(path, options);
        return Promise.resolve({ data: { data: mockScheduleSlot }, error: undefined });
      }
      return Promise.resolve({ data: undefined, error: undefined });
    });

    const Wrapper = createWrapper();
    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    // Select a vehicle
    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    // Wait for seat override input to appear
    await waitFor(() => {
      expect(screen.getByTestId('seat-override-input')).toBeInTheDocument();
    });

    // Clear the seat override input (it starts with vehicle capacity)
    const seatOverrideInput = screen.getByTestId('seat-override-input');
    fireEvent.change(seatOverrideInput, { target: { value: '' } });

    // Submit
    const addButton = screen.getByTestId('confirm-assignment');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        '/groups/{groupId}/schedule-slots',
        expect.objectContaining({
          params: { path: { groupId: 'group-1' } },
          body: {
            datetime: '2024-01T08:00:00',
            vehicleId: 'vehicle-1',
            driverId: 'user-1',
            seatOverride: undefined
          }
        })
      );
    });
  });

  it('should display seat override information for assigned vehicles', async () => {
    const slotWithVehicles = {
      ...mockScheduleSlot,
      vehicleAssignments: [
        {
          id: 'assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: 'user-1',
          seatOverride: 15,
          vehicle: mockVehicles[0],
          driver: { id: 'user-1', name: 'Test User' }
        },
        {
          id: 'assignment-2',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-2',
          driverId: 'user-1',
          seatOverride: undefined,
          vehicle: mockVehicles[1],
          driver: { id: 'user-1', name: 'Test User' }
        }
      ]
    };

    vi.mocked(api.GET).mockImplementation((path: string, options?: any) => {
      if (path === '/vehicles') {
        return Promise.resolve({ data: { data: mockVehicles }, error: undefined });
      }
      if (path.includes('/schedule-slots/') && options?.params?.path?.scheduleSlotId === 'slot-1') {
        return Promise.resolve({ data: { data: slotWithVehicles }, error: undefined });
      }
      return Promise.resolve({ data: { data: mockScheduleSlot }, error: undefined });
    });

    render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId="slot-1"
        existingScheduleSlot={slotWithVehicles}
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      // Should show override badge for vehicle with seat override
      expect(screen.getByText(/Override:\s*15\s*seats/)).toBeInTheDocument();
      
      // Should show effective capacity
      expect(screen.getByText(/Capacity:\s*15\s*seats/)).toBeInTheDocument();
      expect(screen.getByText(/\(original:\s*20\)/)).toBeInTheDocument();
      
      // Should show regular capacity for vehicle without override
      expect(screen.getByText(/Capacity:\s*8\s*seats/)).toBeInTheDocument();
    });
  });

  it('should clear seat override input when modal is reopened', async () => {
    const Wrapper = createWrapper();
    const { rerender } = render(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load and select one
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    const vehicleOption = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOption);

    await waitFor(() => {
      expect(screen.getByTestId('seat-override-input')).toBeInTheDocument();
    });

    // Enter a value
    const seatOverrideInput = screen.getByTestId('seat-override-input');
    fireEvent.change(seatOverrideInput, { target: { value: '15' } });
    expect(seatOverrideInput).toHaveValue(15);

    // Close and reopen modal
    rerender(
      <VehicleSelectionModal
        isOpen={false}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    rerender(
      <VehicleSelectionModal
        isOpen={true}
        onClose={() => {}}
        scheduleSlotId=""
        groupId="group-1"
        day="MONDAY"
        time="08:00"
        week="2024-01"
      />,
      { wrapper: Wrapper }
    );

    // Wait for vehicles to load again and select vehicle
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('Bus 1'))).toBeInTheDocument();
    });

    const vehicleOptionReopen = screen.getByTestId('vehicle-option-vehicle-1');
    fireEvent.click(vehicleOptionReopen);

    await waitFor(() => {
      const seatOverrideInputReopened = screen.getByTestId('seat-override-input');
      expect(seatOverrideInputReopened).toHaveValue(20); // Should reset to vehicle capacity
    });
  });
});