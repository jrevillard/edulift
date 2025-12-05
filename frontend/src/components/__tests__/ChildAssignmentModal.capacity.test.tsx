import '../../services/__tests__/setup'; // Import setup to load mocks
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import ChildAssignmentModal from '../ChildAssignmentModal';
import { mockClient } from '../../services/__tests__/setup';

// Mock the contexts
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', timezone: 'UTC' }
  }))
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: vi.fn(() => ({
    socket: { emit: vi.fn() }
  }))
}));

describe('ChildAssignmentModal Capacity Tests', () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
  });

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
      scheduleSlot: {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
        childAssignments: [],
        vehicleAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      },
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ChildAssignmentModal {...defaultProps} />
      </QueryClientProvider>
    );
  };

  it('disables add button when vehicle has no remaining capacity', async () => {
    // Mock data for a vehicle at full capacity
    const fullCapacityVehicle = {
      id: 'vehicle-assignment-1',
      scheduleSlotId: 'slot-1',
      vehicleId: 'vehicle-1',
      vehicle: { id: 'vehicle-1', name: 'Small Bus', capacity: 2 }
    };

    const fullCapacitySlot = {
      id: 'slot-1',
      groupId: 'group-1',
      datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
      totalCapacity: 2,
      availableSeats: 0,
      vehicleAssignments: [fullCapacityVehicle],
      childAssignments: [
        {
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-1', name: 'Alice' }
        },
        {
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-2', name: 'Bob' }
        }
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const allChildren = [
      {
        id: 'child-1',
        name: 'Alice',
        age: 7,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-1', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      },
      {
        id: 'child-2',
        name: 'Bob',
        age: 6,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-2', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      },
      {
        id: 'child-3',
        name: 'Charlie',
        age: 8,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-3', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      }
    ];

    mockClient.GET.mockImplementation((path) => {
      if (path === '/children') {
        return Promise.resolve({
          data: { data: allChildren },
          error: undefined
        });
      }
      if (path === '/schedule-slots/{scheduleSlotId}') {
        return Promise.resolve({
          data: { data: fullCapacitySlot },
          error: undefined
        });
      }
      return Promise.resolve({
        data: { data: null },
        error: { message: `Not implemented: ${path}` }
      });
    });

    renderModal({ 
      scheduleSlot: fullCapacitySlot,
      preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
    });

    await waitFor(() => {
      // Check that we're in vehicle-specific mode
      expect(screen.getByTestId('ChildAssignmentModal-Label-addingToVehicle')).toBeInTheDocument();
      // Check for vehicle name in selected vehicle display
      expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Small Bus');
    });

    // Select a child using testid
    const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
    fireEvent.change(childSelect, { target: { value: 'child-3' } });

    await waitFor(() => {
      // Button should be disabled due to no remaining capacity
      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      expect(addButton).toBeDisabled();
    });
  });

  it('enables add button when vehicle has remaining capacity', async () => {
    const partialCapacityVehicle = {
      id: 'vehicle-assignment-1',
      scheduleSlotId: 'slot-1', 
      vehicleId: 'vehicle-1',
      vehicle: { id: 'vehicle-1', name: 'Large Bus', capacity: 5 }
    };

    const partialCapacitySlot = {
      id: 'slot-1',
      groupId: 'group-1',
      datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
      totalCapacity: 5,
      availableSeats: 3,
      vehicleAssignments: [partialCapacityVehicle],
      childAssignments: [
        {
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-1', name: 'Alice' }
        },
        {
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-2', name: 'Bob' }
        }
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const allChildren = [
      {
        id: 'child-1',
        name: 'Alice',
        age: 7,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-1', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      },
      {
        id: 'child-2',
        name: 'Bob',
        age: 6,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-2', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      },
      {
        id: 'child-3',
        name: 'Charlie',
        age: 8,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-3', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      }
    ];

    mockClient.GET.mockImplementation((path) => {
      if (path === '/children') {
        return Promise.resolve({
          data: { data: allChildren },
          error: undefined
        });
      }
      if (path === '/schedule-slots/{scheduleSlotId}') {
        return Promise.resolve({
          data: { data: partialCapacitySlot },
          error: undefined
        });
      }
      return Promise.resolve({
        data: { data: null },
        error: { message: `Not implemented: ${path}` }
      });
    });

    renderModal({ 
      scheduleSlot: partialCapacitySlot,
      preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
    });

    await waitFor(() => {
      expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Large Bus');
    });

    // Select a child
    const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
    fireEvent.change(childSelect, { target: { value: 'child-3' } });

    await waitFor(() => {
      // Button should be enabled since there's remaining capacity
      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      expect(addButton).not.toBeDisabled();
    });
  });

  it('preserves vehicle selection after adding child in vehicle-specific mode', async () => {
    const mockAssignChild = vi.fn().mockResolvedValue({
      data: { success: true },
      error: undefined
    });
    mockClient.POST.mockImplementation((path) => {
      if (path === '/schedule-slots/{scheduleSlotId}/children') {
        return mockAssignChild();
      }
      return Promise.resolve({
        data: { data: null },
        error: { message: `Not implemented: ${path}` }
      });
    });

    const vehicleSlot = {
      id: 'slot-1',
      groupId: 'group-1',
      datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
      totalCapacity: 3,
      availableSeats: 2,
      vehicleAssignments: [{
        id: 'vehicle-assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        vehicle: { id: 'vehicle-1', name: 'Test Bus', capacity: 3 }
      }],
      childAssignments: [{
        vehicleAssignmentId: 'vehicle-assignment-1',
        child: { id: 'child-1', name: 'Alice' }
      }],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const allChildren = [
      {
        id: 'child-1',
        name: 'Alice',
        age: 7,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-1', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      },
      {
        id: 'child-2',
        name: 'Bob',
        age: 7,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ 
          groupId: 'group-1', 
          childId: 'child-2', 
          addedBy: 'user-1', 
          addedAt: '2024-01-01T00:00:00Z', 
          group: { id: 'group-1', name: 'Test Group' } 
        }]
      }
    ];

    mockClient.GET.mockImplementation((path) => {
      if (path === '/children') {
        return Promise.resolve({
          data: { data: allChildren },
          error: undefined
        });
      }
      if (path === '/schedule-slots/{scheduleSlotId}') {
        return Promise.resolve({
          data: { data: vehicleSlot },
          error: undefined
        });
      }
      return Promise.resolve({
        data: { data: null },
        error: { message: `Not implemented: ${path}` }
      });
    });

    renderModal({ 
      scheduleSlot: vehicleSlot,
      preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
    });

    await waitFor(() => {
      expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Test Bus');
      
      // Select and add a child
      const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
      fireEvent.change(childSelect, { target: { value: 'child-2' } });
      
      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(mockClient.POST).toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children', {
        params: { path: { scheduleSlotId: 'slot-1' } },
        body: { childId: 'child-2', vehicleAssignmentId: 'vehicle-assignment-1' }
      });
    });

    // Vehicle info should still be visible (vehicle selection preserved)
    expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Test Bus');
    expect(screen.getByTestId('ChildAssignmentModal-Label-addingToVehicle')).toBeInTheDocument();
  });
});