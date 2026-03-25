import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import VehiclesPage from '../VehiclesPage';
import { useFamily } from '../../contexts/FamilyContext';
import { api } from '../../services/api';
import { usePageState } from '../../hooks/usePageState';

// Mock dependencies
vi.mock('../../contexts/FamilyContext');
vi.mock('../../services/api');
vi.mock('../../hooks/usePageState');

const mockUseFamily = vi.mocked(useFamily);
const mockApi = vi.mocked(api);
const mockUsePageState = vi.mocked(usePageState);

const mockVehicle = {
  id: 'vehicle-1',
  name: 'Original Bus',
  capacity: 8,
  driverName: 'John Driver',
  familyId: 'family-1'
};

const mockFamilyContext = {
  currentFamily: {
    id: 'family-1',
    name: 'Test Family',
    members: [],
    children: [],
    vehicles: [mockVehicle]
  },
  userPermissions: {
    canModifyVehicles: true,
    canManageMembers: false,
    canModifyChildren: false,
    canViewDetails: true
  },
  isLoading: false,
  error: null,
  requiresFamily: false,
  isCheckingFamily: false,
  hasFamily: true,
  createFamily: vi.fn(),
  joinFamily: vi.fn(),
  leaveFamily: vi.fn(),
  updateFamilyName: vi.fn(),
  inviteMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  generateInviteCode: vi.fn(),
  getPendingInvitations: vi.fn(),
  cancelInvitation: vi.fn(),
  clearError: vi.fn()
};

describe('VehiclesPage - Cache Invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockUseFamily.mockReturnValue(mockFamilyContext);
    
    // Mock usePageState to show vehicle list (not loading)
    mockUsePageState.mockReturnValue({
      data: [mockVehicle],
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false
    });

    // Mock API responses for OpenAPI client
    mockApi.GET.mockResolvedValue({
      data: {
        data: [mockVehicle]
      }
    });
    // Mock PATCH to return complete Family (rich response pattern)
    mockApi.PATCH.mockResolvedValue({
      data: {
        data: {
          ...mockFamilyContext.currentFamily,
          vehicles: [
            {
              ...mockVehicle,
              name: 'Updated Bus'
            }
          ]
        }
      }
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <VehiclesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should invalidate schedule-related queries when vehicle is updated', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    renderComponent();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('VehiclesPage-Text-vehicleName-vehicle-1')).toHaveTextContent('Original Bus');
    });

    // Click edit button
    const editButton = screen.getByTestId('VehiclesPage-Button-editVehicle-vehicle-1');
    fireEvent.click(editButton);

    // Update the name
    const nameInput = screen.getByTestId('VehiclesPage-Input-vehicleName');
    fireEvent.change(nameInput, { target: { value: 'Updated Bus' } });

    // Submit the form
    const saveButton = screen.getByTestId('VehiclesPage-Button-submitVehicle');
    fireEvent.click(saveButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.PATCH).toHaveBeenCalledWith('/api/v1/vehicles/{vehicleId}', {
        params: { path: { vehicleId: 'vehicle-1' } },
        body: { name: 'Updated Bus', capacity: 8 }
      });
    });

    // Verify setQueryData was called for immediate cache update
    expect(setQueryDataSpy).toHaveBeenCalledWith(['current-family'], expect.objectContaining({
      id: 'family-1',
      vehicles: expect.arrayContaining([
        expect.objectContaining({ id: 'vehicle-1', name: 'Updated Bus', capacity: 8 })
      ])
    }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['vehicles'], expect.arrayContaining([
      expect.objectContaining({ id: 'vehicle-1', name: 'Updated Bus', capacity: 8 })
    ]));
    // Verify schedule queries were invalidated (they're not in Family object)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
  });

  it('should invalidate schedule-related queries when vehicle is created', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    mockApi.POST.mockResolvedValue({
      data: {
        data: {
          ...mockFamilyContext.currentFamily,
          vehicles: [
            mockVehicle,
            {
              id: 'vehicle-2',
              name: 'New Van',
              capacity: 6,
              driverName: 'Jane Driver',
              familyId: 'family-1'
            }
          ]
        }
      }
    });

    renderComponent();

    // Click add button
    const addButton = screen.getByTestId('VehiclesPage-Button-addVehicle');
    fireEvent.click(addButton);

    // Fill in the form
    const nameInput = screen.getByTestId('VehiclesPage-Input-vehicleName');
    const capacityInput = screen.getByTestId('VehiclesPage-Input-vehicleCapacity');
    fireEvent.change(nameInput, { target: { value: 'New Van' } });
    fireEvent.change(capacityInput, { target: { value: '6' } });

    // Submit the form
    const createButton = screen.getByTestId('VehiclesPage-Button-submitVehicle');
    fireEvent.click(createButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.POST).toHaveBeenCalledWith('/api/v1/vehicles', {
        body: { name: 'New Van', capacity: 6 }
      });
    });

    // Verify setQueryData was called for immediate cache update
    expect(setQueryDataSpy).toHaveBeenCalledWith(['current-family'], expect.objectContaining({
      id: 'family-1',
      vehicles: expect.arrayContaining([
        expect.objectContaining({ name: 'New Van', capacity: 6 })
      ])
    }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['vehicles'], expect.arrayContaining([
      expect.objectContaining({ name: 'New Van', capacity: 6 })
    ]));
    // Verify schedule queries were invalidated (they're not in Family object)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
  });

  it('should invalidate schedule-related queries when vehicle is deleted', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    // Mock DELETE to return Family without the deleted vehicle
    mockApi.DELETE.mockResolvedValue({
      data: {
        data: {
          ...mockFamilyContext.currentFamily,
          vehicles: [] // No vehicles after deletion
        }
      }
    });

    renderComponent();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('VehiclesPage-Text-vehicleName-vehicle-1')).toHaveTextContent('Original Bus');
    });

    // Click delete button
    const deleteButton = screen.getByTestId('VehiclesPage-Button-deleteVehicle-vehicle-1');
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByTestId('ConfirmationDialog-Button-confirm');
    fireEvent.click(confirmButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.DELETE).toHaveBeenCalledWith('/api/v1/vehicles/{vehicleId}', {
        params: { path: { vehicleId: 'vehicle-1' } }
      });
    });

    // Verify setQueryData was called for immediate cache update
    expect(setQueryDataSpy).toHaveBeenCalledWith(['current-family'], expect.objectContaining({
      id: 'family-1',
      vehicles: expect.not.arrayContaining([
        expect.objectContaining({ id: 'vehicle-1' })
      ])
    }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['vehicles'], expect.not.arrayContaining([
      expect.objectContaining({ id: 'vehicle-1' })
    ]));
    // Verify schedule queries were invalidated (they're not in Family object)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
  });
});