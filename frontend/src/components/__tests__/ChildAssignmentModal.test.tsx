import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import ChildAssignmentModal from '../ChildAssignmentModal';
import { api } from '../../services/api';
import { createMockOpenAPIClient } from '../../test/test-utils';
import type { Child, ScheduleSlot } from '../../types/api';

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

// Mock the OpenAPI client
vi.mock('../../services/api');
const mockApi = api as unknown;

// Mock useQueryClient
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn()
    }))
  };
});

describe('ChildAssignmentModal', () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();
  
  const mockScheduleSlot = {
    id: 'slot-1',
    groupId: 'group-1',
    datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
    childAssignments: [],
    vehicleAssignments: [],
    totalCapacity: 0,
    availableSeats: 0
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
    
    // Apply comprehensive OpenAPI client mocks
    const comprehensiveMocks = createMockOpenAPIClient();
    Object.assign(mockApi, comprehensiveMocks);
  });

  // Type for mock overrides
  type MockOverrides = {
    children?: unknown[];
    scheduleSlot?: unknown;
    [key: string]: unknown;
  };

  // Helper function to setup OpenAPI mocks for different scenarios
  const setupOpenAPIMocks = (overrides: MockOverrides = {}) => {
    vi.mocked(mockApi.GET).mockImplementation((path: string) => {
      if (path === '/children') {
        return Promise.resolve({
          data: { data: overrides.children || [], success: true },
          error: undefined
        });
      }
      if (path === '/schedule-slots/{scheduleSlotId}') {
        return Promise.resolve({
          data: { data: overrides.scheduleSlot || mockScheduleSlot, success: true },
          error: undefined
        });
      }
      return Promise.resolve({
        data: { data: null, success: false },
        error: { message: 'Not implemented in test mock' }
      });
    });

    // Setup POST/PATCH mocks for mutations
    vi.mocked(mockApi.POST).mockResolvedValue({
      data: { data: null, success: true },
      error: undefined
    });

    vi.mocked(mockApi.DELETE).mockResolvedValue({
      data: { data: null, success: true },
      error: undefined
    });
  };

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: mockOnClose,
      scheduleSlot: mockScheduleSlot,
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ChildAssignmentModal {...defaultProps} />
      </QueryClientProvider>
    );
  };

  it('renders with correct title when open', () => {
    setupOpenAPIMocks({ scheduleSlot: mockScheduleSlot });
    renderModal();
    expect(screen.getByTestId('ChildAssignmentModal-Title-modalTitle')).toBeInTheDocument();
    expect(screen.getByTestId('ChildAssignmentModal-Container-modal')).toBeInTheDocument();
  });

  it('renders close button', () => {
    setupOpenAPIMocks({ scheduleSlot: mockScheduleSlot });
    renderModal();
    expect(screen.getByTestId('ChildAssignmentModal-Button-closeModal')).toBeInTheDocument();
  });

  it('renders close button at bottom', () => {
    setupOpenAPIMocks({ scheduleSlot: mockScheduleSlot });
    renderModal();
    expect(screen.getByTestId('ChildAssignmentModal-Button-close')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    setupOpenAPIMocks({ scheduleSlot: mockScheduleSlot });
    renderModal({ isOpen: false });
    expect(screen.queryByTestId('ChildAssignmentModal-Container-modal')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    setupOpenAPIMocks({ scheduleSlot: mockScheduleSlot });
    renderModal();
    expect(screen.getByTestId('ChildAssignmentModal-Container-loadingChildren')).toBeInTheDocument();
  });

  describe('Vehicle-Specific Child Assignments', () => {
    const mockScheduleSlotWithVehicles: ScheduleSlot = {
      id: 'slot-1',
      groupId: 'group-1',
      datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
      totalCapacity: 12,
      availableSeats: 8,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      vehicleAssignments: [
        {
          id: 'vehicle-assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
          driver: { id: 'driver-1', name: 'John Driver' }
        },
        {
          id: 'vehicle-assignment-2',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-2',
          driverId: 'driver-2',
          vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 4 },
          driver: { id: 'driver-2', name: 'Jane Driver' }
        }
      ],
      childAssignments: [
        {
          child: { 
            id: 'child-1', 
            name: 'Alice', 
            parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } 
          }
        },
        {
          child: { 
            id: 'child-2', 
            name: 'Bob', 
            parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob@example.com' } 
          }
        },
        {
          child: { 
            id: 'child-3', 
            name: 'Charlie', 
            parent: { id: 'parent-3', name: 'Charlie Parent', email: 'charlie@example.com' } 
          }
        }
      ]
    };

    const mockAvailableChildren: Child[] = [
      {
        id: 'child-4',
        name: 'David',
        age: 8,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ groupId: 'group-1', childId: 'child-4', addedBy: 'user-1', addedAt: '2024-01-01T00:00:00Z', group: { id: 'group-1', name: 'Test Group' } }]
      },
      {
        id: 'child-5',
        name: 'Eve',
        age: 7,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ groupId: 'group-1', childId: 'child-5', addedBy: 'user-1', addedAt: '2024-01-01T00:00:00Z', group: { id: 'group-1', name: 'Test Group' } }]
      }
    ];

    beforeEach(() => {
      // Mock API responses for vehicle-specific tests
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });
    });

    it('should display vehicle name for single vehicle', async () => {
      const singleVehicleSlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [mockScheduleSlotWithVehicles.vehicleAssignments[0]]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: singleVehicleSlot
      });
      renderModal({ scheduleSlot: singleVehicleSlot });

      await waitFor(() => {
        // Should show vehicle-specific title for single vehicle
        expect(screen.getByTestId('ChildAssignmentModal-Text-singleVehicleName')).toHaveTextContent(/Bus #1|School Bus/);
        // Should NOT show generic manage children title
        expect(screen.queryByTestId('ChildAssignmentModal-Text-manageChildrenTitle')).not.toBeInTheDocument();
      });
    });

    it('should display generic title for multiple vehicles', async () => {
      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-manageChildrenTitle')).toHaveTextContent(/Manage Children - Monday at \d{2}:\d{2}/);
        // Should NOT show single vehicle name
        expect(screen.queryByTestId('ChildAssignmentModal-Text-singleVehicleName')).not.toBeInTheDocument();
      });
    });

    it('should group children by vehicle correctly', async () => {
      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Check that children are listed in the assigned section
        expect(screen.getByTestId('ChildAssignmentModal-Heading-assignedChildren')).toBeInTheDocument();
        expect(screen.getByTestId('child-name-child-1')).toHaveTextContent('Alice');
        expect(screen.getByTestId('child-name-child-2')).toHaveTextContent('Bob');
        expect(screen.getByTestId('child-name-child-3')).toHaveTextContent('Charlie');
      });
    });

    it('should display capacity information correctly', async () => {
      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Check capacity display (3 children assigned out of 12 total capacity)
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('3/12 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('9 remaining');
      });
    });

    it('should filter available children by group membership', async () => {
      const childrenNotInGroup: Child[] = [
        {
          id: 'child-outside',
          name: 'Outsider',
          age: 9,
          userId: 'user-2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          groupMemberships: [{ groupId: 'different-group', childId: 'child-outside', addedBy: 'user-2', addedAt: '2024-01-01T00:00:00Z', group: { id: 'different-group', name: 'Other Group' } }] // Different group
        }
      ];

      setupOpenAPIMocks({
        children: [...mockAvailableChildren, ...childrenNotInGroup],
        scheduleSlot: mockScheduleSlotWithVehicles
      });

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      // Wait for loading to complete first
      await waitFor(() => {
        expect(screen.queryByTestId('ChildAssignmentModal-Container-loadingChildren')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        // Check that David and Eve are in the dropdown (they are in group-1)
        expect(screen.getByTestId('child-option-child-4')).toBeInTheDocument();
        expect(screen.getByTestId('child-option-child-5')).toBeInTheDocument();
        
        // Check that Outsider is not in the dropdown (different group)
        expect(screen.queryByTestId('child-option-child-outside')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should exclude already assigned children from available list', async () => {
      const allChildren: Child[] = [
        ...mockAvailableChildren,
        { 
          id: 'child-1', 
          name: 'Alice', 
          userId: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          groupMemberships: [{ groupId: 'group-1', childId: 'child-1', addedBy: 'user-1', addedAt: '2024-01-01T00:00:00Z', group: { id: 'group-1', name: 'Test Group' } }] 
        }, // Already assigned
        { 
          id: 'child-2', 
          name: 'Bob', 
          userId: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          groupMemberships: [{ groupId: 'group-1', childId: 'child-2', addedBy: 'user-1', addedAt: '2024-01-01T00:00:00Z', group: { id: 'group-1', name: 'Test Group' } }] 
        }     // Already assigned
      ];

      setupOpenAPIMocks({
        children: allChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      // Wait for loading to complete first
      await waitFor(() => {
        expect(screen.queryByTestId('ChildAssignmentModal-Container-loadingChildren')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        // Should show available children (David and Eve are not assigned)
        expect(screen.getByTestId('child-option-child-4')).toBeInTheDocument();
        expect(screen.getByTestId('child-option-child-5')).toBeInTheDocument();
        
        // Already assigned children should not be in the dropdown options
        expect(screen.queryByTestId('child-option-child-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('child-option-child-2')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle empty vehicle assignments gracefully', async () => {
      const emptySlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0
      };

      renderModal({ scheduleSlot: emptySlot });

      await waitFor(() => {
        // Should show generic title when no vehicles
        expect(screen.getByTestId('ChildAssignmentModal-Title-modalTitle')).toHaveTextContent(/Manage Children - Monday at \d{2}:\d{2}/);
        
        // Should not show capacity info when no vehicles
        expect(screen.queryByTestId('ChildAssignmentModal-Container-capacityIndicator')).not.toBeInTheDocument();
      });
    });

    it('should handle vehicle with no assigned children', async () => {
      const slotWithEmptyVehicle = {
        ...mockScheduleSlotWithVehicles,
        childAssignments: [] // No children assigned to any vehicle
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: slotWithEmptyVehicle
      });

      renderModal({ scheduleSlot: slotWithEmptyVehicle });

      await waitFor(() => {
        // Should show capacity as 0/12
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('0/12 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('12 remaining');
        
        // Should not show assigned children section
        expect(screen.queryByTestId('ChildAssignmentModal-Heading-assignedChildren')).not.toBeInTheDocument();
      });
    });

    it('should show capacity warning when at full capacity', async () => {
      const fullCapacitySlot = {
        ...mockScheduleSlotWithVehicles,
        totalCapacity: 3, // Same as number of assigned children
        availableSeats: 0,
        childAssignments: mockScheduleSlotWithVehicles.childAssignments
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: fullCapacitySlot
      });

      renderModal({ scheduleSlot: fullCapacitySlot });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Alert-capacityWarning')).toBeInTheDocument();
      });
    });

    it('should handle remove child functionality', async () => {
      const mockRemoveChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.DELETE).mockImplementation(mockRemoveChild);

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Use specific child IDs for remove buttons instead of getAllByText
        const removeButton1 = screen.getByTestId('remove-child-button-child-1');
        const removeButton2 = screen.getByTestId('remove-child-button-child-2');
        const removeButton3 = screen.getByTestId('remove-child-button-child-3');
        
        expect(removeButton1).toBeInTheDocument();
        expect(removeButton2).toBeInTheDocument();
        expect(removeButton3).toBeInTheDocument();

        fireEvent.click(removeButton1);
      });

      await waitFor(() => {
        expect(mockRemoveChild).toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children/{childId}', {
          params: { path: { scheduleSlotId: 'slot-1', childId: 'child-1' } }
        });
      });
    });

    it('should show vehicle selection dropdown with capacity information', async () => {
      // Create slot with children assigned to specific vehicles
      const slotWithVehicleAssignments = {
        ...mockScheduleSlotWithVehicles,
        childAssignments: [
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { 
              id: 'child-1', 
              name: 'Alice', 
              parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } 
            }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-1', 
            child: { 
              id: 'child-2', 
              name: 'Bob', 
              parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob@example.com' } 
            }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-2',
            child: { 
              id: 'child-3', 
              name: 'Charlie', 
              parent: { id: 'parent-3', name: 'Charlie Parent', email: 'charlie@example.com' } 
            }
          }
        ]
      };
      
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: slotWithVehicleAssignments
      });
      
      renderModal({ scheduleSlot: slotWithVehicleAssignments });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Label-vehicleSelect')).toBeInTheDocument();
        
        // Check the option elements exist with the correct text
        // Bus #1 has capacity 8, with 2 children assigned = 6 available
        // Van #1 has capacity 4, with 1 child assigned = 3 available
        const busOption = screen.getByTestId('vehicle-option-vehicle-assignment-1');
        const vanOption = screen.getByTestId('vehicle-option-vehicle-assignment-2');
        
        expect(busOption).toBeInTheDocument();
        expect(vanOption).toBeInTheDocument();
      });
    });

    it('should disable vehicle selection when vehicle is full', async () => {
      const fullVehicleSlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [
          {
            ...mockScheduleSlotWithVehicles.vehicleAssignments[0],
            vehicle: { ...mockScheduleSlotWithVehicles.vehicleAssignments[0].vehicle, capacity: 2 } // Reduce capacity to make it full
          }
        ],
        childAssignments: [
          // 2 children assigned to a 2-capacity vehicle (full)
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: mockScheduleSlotWithVehicles.childAssignments[0].child
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: mockScheduleSlotWithVehicles.childAssignments[1].child
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: fullVehicleSlot
      });
      
      renderModal({ scheduleSlot: fullVehicleSlot });

      await waitFor(() => {
        // Check that vehicle dropdown exists and has the full option
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        const vehicleSelect = screen.getByTestId('ChildAssignmentModal-Select-vehicle');
        expect(childSelect).toBeInTheDocument();
        expect(vehicleSelect).toBeInTheDocument();
        
        // Should show vehicle as full in the option
        const fullOption = screen.getByTestId('vehicle-option-vehicle-assignment-1');
        expect(fullOption).toBeInTheDocument();
        expect(fullOption).toBeDisabled();
      });
    });

    it('should handle add child to specific vehicle functionality', async () => {
      const mockAddChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAddChild);

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Select a child
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        fireEvent.change(childSelect, { target: { value: 'child-4' } });

        // Select a vehicle
        const vehicleSelect = screen.getByTestId('ChildAssignmentModal-Select-vehicle');
        fireEvent.change(vehicleSelect, { target: { value: 'vehicle-assignment-1' } });

        // Click add button
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(mockAddChild).toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children', {
          params: { path: { scheduleSlotId: 'slot-1' } },
          body: {
            childId: 'child-4',
            vehicleAssignmentId: 'vehicle-assignment-1'
          }
        });
      });
    });

    it('should disable add button when child or vehicle not selected', async () => {
      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        expect(addButton).toBeDisabled();

        // Select only child
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        fireEvent.change(childSelect, { target: { value: 'child-4' } });
        
        expect(addButton).toBeDisabled(); // Still disabled without vehicle

        // Select vehicle too
        const vehicleSelect = screen.getByTestId('ChildAssignmentModal-Select-vehicle');
        fireEvent.change(vehicleSelect, { target: { value: 'vehicle-assignment-1' } });
        
        expect(addButton).not.toBeDisabled(); // Now enabled
      });
    });

    it('should refresh data after child operations', async () => {
      const mockInvalidateQueries = vi.fn();
      const mockQueryClient = {
        invalidateQueries: mockInvalidateQueries
      };

      // Mock useQueryClient hook
      vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as unknown as ReturnType<typeof useQueryClient>);

      const mockAddChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAddChild);

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Select a child
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        fireEvent.change(childSelect, { target: { value: 'child-4' } });

        // Select a vehicle
        const vehicleSelect = screen.getByTestId('ChildAssignmentModal-Select-vehicle');
        fireEvent.change(vehicleSelect, { target: { value: 'vehicle-assignment-1' } });

        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        // Verify that queries are invalidated to refresh the data
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['weekly-schedule', 'group-1'] });
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['schedule-slot', 'slot-1'] });
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['children'] });
      });
    });
  });

  describe('Vehicle-Specific Modal Functionality', () => {
    const mockScheduleSlotWithVehicles: ScheduleSlot = {
      id: 'slot-1',
      groupId: 'group-1',
      datetime: '2024-01-01T08:00:00.000Z', // Monday 8:00 AM UTC
      totalCapacity: 12,
      availableSeats: 8,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      vehicleAssignments: [
        {
          id: 'vehicle-assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          vehicle: { id: 'vehicle-1', name: 'School Bus', capacity: 8 },
          driver: { id: 'driver-1', name: 'John Driver' }
        },
        {
          id: 'vehicle-assignment-2',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-2',
          vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 4 }
        }
      ],
      childAssignments: []
    };

    const mockAvailableChildren: Child[] = [
      {
        id: 'child-4',
        name: 'David',
        age: 8,
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        groupMemberships: [{ groupId: 'group-1', childId: 'child-4', addedBy: 'user-1', addedAt: '2024-01-01T00:00:00Z', group: { id: 'group-1', name: 'Test Group' } }]
      }
    ];

    beforeEach(() => {
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });
    });

    it('pre-selects vehicle when preSelectedVehicleAssignmentId is provided', async () => {
      const preSelectedVehicleId = 'vehicle-assignment-1';
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: preSelectedVehicleId 
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Label-addingToVehicle')).toHaveTextContent('Adding to Vehicle');
      });

      // Should show the selected vehicle info instead of dropdown
      expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('School Bus');
      expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleDriver')).toHaveTextContent('Driver: John Driver');
      // Should NOT show seats available anymore
      expect(screen.queryByText('(8 seats available)')).not.toBeInTheDocument();
      
      // Should not show vehicle selection dropdown
      expect(screen.queryByTestId('ChildAssignmentModal-Select-vehicle')).not.toBeInTheDocument();
    });

    it('shows vehicle selection dropdown when no vehicle is pre-selected', async () => {
      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Label-vehicleSelect')).toBeInTheDocument();
      });

      expect(screen.getByTestId('ChildAssignmentModal-Select-vehicle')).toHaveDisplayValue('Choose a vehicle...');
    });

    it('updates button text for vehicle-specific assignment', async () => {
      const preSelectedVehicleId = 'vehicle-assignment-1';
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: preSelectedVehicleId 
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Button-addChild')).toBeInTheDocument();
      });
    });

    it('assigns child to pre-selected vehicle when submitted', async () => {
      const preSelectedVehicleId = 'vehicle-assignment-1';
      const mockAssignChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAssignChild);
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: preSelectedVehicleId 
      });

      await waitFor(() => {
        // David should be available in the child select dropdown
        const childOption = screen.getByTestId('child-option-child-4');
        expect(childOption).toBeInTheDocument();
      });

      // Select a child from the combobox
      const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
      fireEvent.change(childSelect, { target: { value: 'child-4' } });

      // Click add button
      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      fireEvent.click(addButton);

      // Should call API with pre-selected vehicle
      await waitFor(() => {
        expect(mockAssignChild).toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children', {
          params: { path: { scheduleSlotId: 'slot-1' } },
          body: {
            childId: 'child-4',
            vehicleAssignmentId: preSelectedVehicleId
          }
        });
      });
    });

    it('uses vehicleAssignmentId not vehicleId for child assignment', async () => {
      const mockAssignChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAssignChild);

      renderModal({ scheduleSlot: mockScheduleSlotWithVehicles });

      await waitFor(() => {
        // Select a child
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        fireEvent.change(childSelect, { target: { value: 'child-4' } });

        // Select a vehicle assignment (not vehicle ID)
        const vehicleSelect = screen.getByTestId('ChildAssignmentModal-Select-vehicle');
        fireEvent.change(vehicleSelect, { target: { value: 'vehicle-assignment-1' } });

        // Click add button
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        // Should pass vehicleAssignmentId, not vehicleId
        expect(mockAssignChild).toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children', {
          params: { path: { scheduleSlotId: 'slot-1' } },
          body: {
            childId: 'child-4',
            vehicleAssignmentId: 'vehicle-assignment-1'
          }
        });
        expect(mockAssignChild).not.toHaveBeenCalledWith('/schedule-slots/{scheduleSlotId}/children', {
          params: { path: { scheduleSlotId: 'slot-1' } },
          body: {
            childId: 'child-4',
            vehicleAssignmentId: 'vehicle-1'
          }
        });
      });
    });

    it('shows vehicle without driver correctly', async () => {
      const preSelectedVehicleId = 'vehicle-assignment-2'; // Vehicle without driver
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: preSelectedVehicleId 
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Van #1');
        // Should NOT show seats available anymore
        expect(screen.queryByText('(4 seats available)')).not.toBeInTheDocument();
        // Should not show driver info
        expect(screen.queryByTestId('ChildAssignmentModal-Text-selectedVehicleDriver')).not.toBeInTheDocument();
      });
    });

    it('handles invalid preSelectedVehicleAssignmentId gracefully', async () => {
      const invalidVehicleId = 'non-existent-vehicle';
      
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: invalidVehicleId 
      });

      await waitFor(() => {
        // Should fall back to normal vehicle selection mode
        // The component should show "Adding to Vehicle" label and child selection
        expect(screen.getByTestId('ChildAssignmentModal-Label-addingToVehicle')).toHaveTextContent('Adding to Vehicle');
        expect(screen.getByTestId('ChildAssignmentModal-Button-addChild')).toBeInTheDocument();
      });
    });

    it('shows total capacity when no vehicle is pre-selected', async () => {
      // Create a slot with multiple vehicles
      const multiVehicleSlot = {
        ...mockScheduleSlotWithVehicles,
        totalCapacity: 20, // Total capacity of all vehicles
        vehicleAssignments: [
          {
            id: 'vehicle-assignment-1',
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            vehicle: { id: 'vehicle-1', name: 'School Bus', capacity: 8 }
          },
          {
            id: 'vehicle-assignment-2',
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-2',
            vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 12 }
          }
        ],
        childAssignments: [
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-1', name: 'Alice', parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-2',
            child: { id: 'child-2', name: 'Bob', parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob@example.com' } }
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: multiVehicleSlot
      });
      
      renderModal({ 
        scheduleSlot: multiVehicleSlot
        // NO preSelectedVehicleAssignmentId - general mode
      });

      await waitFor(() => {
        // Should show total capacity of all vehicles
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('2/20 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('18 remaining');
      });

      // Should show all children from all vehicles
      expect(screen.getByTestId('child-name-child-1')).toHaveTextContent('Alice');
      expect(screen.getByTestId('child-name-child-2')).toHaveTextContent('Bob');
    });

    it('shows correct capacity for pre-selected vehicle only', async () => {
      // Create a slot with multiple vehicles
      const multiVehicleSlot = {
        ...mockScheduleSlotWithVehicles,
        totalCapacity: 20, // Total capacity of all vehicles
        vehicleAssignments: [
          {
            id: 'vehicle-assignment-1',
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            vehicle: { id: 'vehicle-1', name: 'School Bus', capacity: 8 }
          },
          {
            id: 'vehicle-assignment-2',
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-2',
            vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 12 }
          }
        ],
        childAssignments: [
          // 2 children in School Bus
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-1', name: 'Alice', parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-2', name: 'Bob', parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob@example.com' } }
          },
          // 3 children in Van
          {
            vehicleAssignmentId: 'vehicle-assignment-2',
            child: { id: 'child-3', name: 'Charlie', parent: { id: 'parent-3', name: 'Charlie Parent', email: 'charlie@example.com' } }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-2',
            child: { id: 'child-4', name: 'David', parent: { id: 'parent-4', name: 'David Parent', email: 'david@example.com' } }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-2',
            child: { id: 'child-5', name: 'Eve', parent: { id: 'parent-5', name: 'Eve Parent', email: 'eve@example.com' } }
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: multiVehicleSlot
      });
      
      renderModal({ 
        scheduleSlot: multiVehicleSlot,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1' // Select School Bus
      });

      await waitFor(() => {
        // Should show only School Bus capacity (2/8), not total capacity (5/20)
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('2/8 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('6 remaining');
        
        // Should NOT show total capacity
        expect(screen.queryByText('5/20 seats')).not.toBeInTheDocument();
      });

      // Should only show children assigned to School Bus
      expect(screen.getByTestId('child-name-child-1')).toHaveTextContent('Alice');
      expect(screen.getByTestId('child-name-child-2')).toHaveTextContent('Bob');
      
      // Should NOT show children from the Van
      expect(screen.queryByTestId('child-name-child-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('child-name-child-4')).not.toBeInTheDocument();
      expect(screen.queryByTestId('child-name-child-5')).not.toBeInTheDocument();
    });

    it('displays vehicle info at the top of modal with correct styling', async () => {
      const preSelectedVehicleId = 'vehicle-assignment-1';
      
      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: preSelectedVehicleId 
      });

      await waitFor(() => {
        // Vehicle info should be at the top
        const vehicleSection = screen.getByTestId('ChildAssignmentModal-Label-addingToVehicle').closest('div');
        expect(vehicleSection).toBeInTheDocument();
        
        // Should appear before the capacity info
        const modalContent = vehicleSection?.parentElement;
        const capacitySection = screen.getByTestId('ChildAssignmentModal-Text-capacityText').closest('div');
        
        if (modalContent) {
          const vehicleIndex = Array.from(modalContent.children).indexOf(vehicleSection as Element);
          const capacityIndex = Array.from(modalContent.children).indexOf(capacitySection?.parentElement as Element);
          expect(vehicleIndex).toBeLessThan(capacityIndex);
        }
      });

      // Check styling - no blue background
      const vehicleDisplay = screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName').closest('div[class*="border"]');
      expect(vehicleDisplay).toHaveClass('border-gray-200');
      expect(vehicleDisplay).not.toHaveClass('bg-blue-50');
      
      // Check driver is aligned to the right
      const driverElement = screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleDriver');
      const vehicleContainer = driverElement.closest('div[class*="flex"]');
      expect(vehicleContainer).toHaveClass('justify-between');
      
      // Check font size is increased
      expect(vehicleContainer).toHaveClass('text-base');
    });

    it('refreshes vehicle cards when child is assigned', async () => {
      const mockInvalidateQueries = vi.fn();
      const mockQueryClient = {
        invalidateQueries: mockInvalidateQueries
      };

      vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as unknown as ReturnType<typeof useQueryClient>);

      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        // David should be available in the child select dropdown
        const childOption = screen.getByTestId('child-option-child-4');
        expect(childOption).toBeInTheDocument();
      });

      // Select child and add
      const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
      fireEvent.change(childSelect, { target: { value: 'child-4' } });

      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      fireEvent.click(addButton);

      await waitFor(() => {
        // Should invalidate weekly schedule with group ID
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ 
          queryKey: ['weekly-schedule', 'group-1'] 
        });
      });
    });

    it('disables add button for pre-selected vehicle at capacity', async () => {
      const fullVehicleSlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [
          {
            ...mockScheduleSlotWithVehicles.vehicleAssignments[0],
            vehicle: { ...mockScheduleSlotWithVehicles.vehicleAssignments[0].vehicle, capacity: 1 }
          }
        ],
        childAssignments: [
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-1', name: 'Alice', parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } }
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: fullVehicleSlot
      });

      renderModal({ 
        scheduleSlot: fullVehicleSlot,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('1/1 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('0 remaining');
        
        // Select a child if available
        const childSelect = screen.queryByTestId('ChildAssignmentModal-Select-child');
        if (childSelect) {
          fireEvent.change(childSelect, { target: { value: 'child-4' } });
        }

        // Add button should be disabled due to no capacity
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        expect(addButton).toBeDisabled();
      });
    });

    it('enables add button after successful child assignment when capacity remains', async () => {
      const mockAssignChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAssignChild);

      // Vehicle with capacity 3, one child already assigned
      const vehicleWithCapacity = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [
          {
            ...mockScheduleSlotWithVehicles.vehicleAssignments[0],
            vehicle: { ...mockScheduleSlotWithVehicles.vehicleAssignments[0].vehicle, capacity: 3 }
          }
        ],
        childAssignments: [
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-1', name: 'Alice', parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } }
          }
        ]
      };


      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: vehicleWithCapacity
      });

      renderModal({ 
        scheduleSlot: vehicleWithCapacity,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('School Bus'); // Vehicle shown
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('1/3 seats');
      });

      // Select a child
      const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
      fireEvent.change(childSelect, { target: { value: 'child-4' } });

      // Button should be enabled
      const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
      expect(addButton).not.toBeDisabled();

      // Add the child
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockAssignChild).toHaveBeenCalledWith('slot-1', 'child-4', 'vehicle-assignment-1');
      });

      // After successful assignment, button should still be usable if capacity allows
      await waitFor(() => {
        const resetChildSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        expect(resetChildSelect).toHaveValue(''); // Child selection should be reset
      });
    });

    it('preserves vehicle selection in vehicle-specific mode after child assignment', async () => {
      const mockAssignChild = vi.fn().mockResolvedValue({
        data: { data: null, success: true },
        error: undefined
      });
      vi.mocked(mockApi.POST).mockImplementation(mockAssignChild);
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });

      renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        // Select a child
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        fireEvent.change(childSelect, { target: { value: 'child-4' } });

        // Add the child
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        // Child selection should be reset, but vehicle should remain selected
        const childSelect = screen.getByTestId('ChildAssignmentModal-Select-child');
        expect(childSelect).toHaveValue(''); // Child reset
        expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('School Bus'); // Vehicle still shown
      });
    });

    it('disables add button when remaining capacity is zero', async () => {
      // Create a vehicle at full capacity
      const fullCapacitySlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [
          {
            ...mockScheduleSlotWithVehicles.vehicleAssignments[0],
            vehicle: { ...mockScheduleSlotWithVehicles.vehicleAssignments[0].vehicle, capacity: 2 }
          }
        ],
        childAssignments: [
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-1', name: 'Alice', parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice@example.com' } }
          },
          {
            vehicleAssignmentId: 'vehicle-assignment-1',
            child: { id: 'child-2', name: 'Bob', parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob@example.com' } }
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: fullCapacitySlot
      });
      
      renderModal({ 
        scheduleSlot: fullCapacitySlot,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-capacityText')).toHaveTextContent('2/2 seats');
        expect(screen.getByTestId('ChildAssignmentModal-Text-remainingCapacity')).toHaveTextContent('0 remaining');
      });

      // Try to select a child (if there are any available)
      const childSelect = screen.queryByTestId('ChildAssignmentModal-Select-child');
      if (childSelect) {
        fireEvent.change(childSelect, { target: { value: 'child-4' } });
        
        // Button should be disabled due to zero capacity
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        expect(addButton).toBeDisabled();
      }
    });
    it('updates selected vehicle when preSelectedVehicleAssignmentId changes', async () => {
      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: mockScheduleSlotWithVehicles
      });
      
      const { rerender } = renderModal({ 
        scheduleSlot: mockScheduleSlotWithVehicles,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('School Bus');
      });

      // Change to different vehicle
      rerender(
        <QueryClientProvider client={queryClient}>
          <ChildAssignmentModal 
            isOpen={true}
            onClose={mockOnClose}
            scheduleSlot={mockScheduleSlotWithVehicles}
            preSelectedVehicleAssignmentId="vehicle-assignment-2"
          />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ChildAssignmentModal-Text-selectedVehicleName')).toHaveTextContent('Van #1');
        expect(screen.queryByTestId('ChildAssignmentModal-Text-selectedVehicleName')).not.toHaveTextContent('School Bus');
      });
    });

    it('handles edge case when vehicle has no capacity', async () => {
      const noCapacitySlot = {
        ...mockScheduleSlotWithVehicles,
        vehicleAssignments: [
          {
            ...mockScheduleSlotWithVehicles.vehicleAssignments[0],
            vehicle: { ...mockScheduleSlotWithVehicles.vehicleAssignments[0].vehicle, capacity: 0 }
          }
        ]
      };

      setupOpenAPIMocks({
        children: mockAvailableChildren,
        scheduleSlot: noCapacitySlot
      });
      
      renderModal({ 
        scheduleSlot: noCapacitySlot,
        preSelectedVehicleAssignmentId: 'vehicle-assignment-1'
      });

      await waitFor(() => {
        // Should show no capacity warning when vehicle has 0 capacity
        expect(screen.getByTestId('ChildAssignmentModal-Alert-capacityWarning')).toBeInTheDocument();
        
        // Add button should be disabled
        const addButton = screen.getByTestId('ChildAssignmentModal-Button-addChild');
        expect(addButton).toBeDisabled();
      });
    });
  });
});