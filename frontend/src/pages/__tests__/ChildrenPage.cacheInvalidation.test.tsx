import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ChildrenPage from '../ChildrenPage';
import { useFamily } from '../../contexts/FamilyContext';
import { api } from '../../services/api';
import { createMockOpenAPIClient } from '../../test/test-utils';

// Mock dependencies
vi.mock('../../contexts/FamilyContext');
vi.mock('../../services/api');

// Mock connection store
vi.mock('../../stores/connectionStore', () => {
  const mockStore = {
    apiStatus: 'connected',
    isConnected: () => true,
    hasConnectionIssues: () => false,
    setApiStatus: vi.fn(),
    setConnected: vi.fn()
  };

  const mockUseConnectionStore = vi.fn(() => mockStore);
  mockUseConnectionStore.getState = vi.fn(() => mockStore);

  return {
    useConnectionStore: mockUseConnectionStore
  };
});

const mockUseFamily = vi.mocked(useFamily);
const mockApi = api as unknown;

const testChild = {
  id: 'child-1',
  name: 'Original Name',
  age: 8,
  familyId: 'family-1',
  groupMemberships: []
};

const mockFamilyContext = {
  currentFamily: {
    id: 'family-1',
    name: 'Test Family',
    members: [],
    children: [testChild],
    vehicles: []
  },
  userPermissions: {
    canModifyChildren: true,
    canManageMembers: false,
    canModifyVehicles: false,
    canViewDetails: true
  },
  refreshFamily: vi.fn(),
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

describe('ChildrenPage - Cache Invalidation', () => {
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

    // Apply comprehensive OpenAPI client mocks
    const comprehensiveMocks = createMockOpenAPIClient();
    Object.assign(mockApi, comprehensiveMocks);

    // Override specific mocks for this test
    vi.mocked(mockApi.GET).mockImplementation((path: string) => {
      if (path === '/children') {
        return Promise.resolve({
          data: { data: [testChild], success: true },
          error: undefined
        });
      }
      return Promise.resolve({
        data: { data: [], success: true },
        error: undefined
      });
    });

    vi.mocked(mockApi.PATCH).mockResolvedValue({
      data: { data: { ...testChild, name: 'Updated Name' }, success: true },
      error: undefined
    });

    vi.mocked(mockApi.POST).mockResolvedValue({
      data: { data: testChild, success: true },
      error: undefined
    });

    vi.mocked(mockApi.DELETE).mockResolvedValue({
      data: { data: null, success: true },
      error: undefined
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChildrenPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should invalidate schedule-related queries when child is updated', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    
    renderComponent();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Text-childName-child-1')).toHaveTextContent('Original Name');
    });

    // Click edit button on the first child card
    const editButton = screen.getByTestId('ChildrenPage-Button-editChild-child-1');
    fireEvent.click(editButton);

    // Update the name
    const nameInput = screen.getByTestId('ChildrenPage-Input-childName');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    // Submit the form
    const saveButton = screen.getByTestId('ChildrenPage-Button-submitChild');
    fireEvent.click(saveButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.PATCH).toHaveBeenCalledWith('/children/{childId}', {
        params: { path: { childId: 'child-1' } },
        body: {
          name: 'Updated Name',
          age: 8
        }
      });
    });

    // Verify that all necessary queries were invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['children'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
    
    // Verify family context was refreshed
    expect(mockFamilyContext.refreshFamily).toHaveBeenCalled();
  });

  it('should invalidate schedule-related queries when child is created', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderComponent();

    // Wait for component to load and click the main add button (the big one in the header)
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument();
    });
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild');
    fireEvent.click(addButton);

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Title-childModalTitle')).toHaveTextContent('Add New Child');
    });

    // Fill in the form
    const nameInput = screen.getByTestId('ChildrenPage-Input-childName');
    const ageInput = screen.getByTestId('ChildrenPage-Input-childAge');
    fireEvent.change(nameInput, { target: { value: 'New Child' } });
    fireEvent.change(ageInput, { target: { value: '6' } });

    // Submit the form (this will be the submit button in the dialog)
    const createButton = screen.getByTestId('ChildrenPage-Button-submitChild');
    fireEvent.click(createButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.POST).toHaveBeenCalledWith('/children', {
        body: { name: 'New Child', age: 6 }
      });
    });

    // Verify that all necessary queries were invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['children'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
  });

  it('should invalidate schedule-related queries when child is deleted', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderComponent();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Text-childName-child-1')).toHaveTextContent('Original Name');
    });

    // Click delete button on the first child card
    const deleteButton = screen.getByTestId('ChildrenPage-Button-deleteChild-child-1');
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByTestId('ConfirmationDialog-Button-confirm');
    fireEvent.click(confirmButton);

    // Wait for mutation to complete
    await waitFor(() => {
      expect(mockApi.DELETE).toHaveBeenCalledWith('/children/{childId}', {
        params: { path: { childId: 'child-1' } }
      });
    });

    // Verify that all necessary queries were invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['children'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot'] });
  });
});