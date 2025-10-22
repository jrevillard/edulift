/*
 * NOTE: This test file was converted from Jest to Vitest but has mocking compatibility issues.
 * The core functionality is thoroughly tested in the backend unit tests:
 * - GroupController.updateGroup.test.ts (14 tests passing)
 * - GroupService.updateGroup.test.ts (10 tests passing)
 * The E2E tests also cover the complete user flow.
 * 
 * TODO: Resolve Vitest component mocking issues for complete frontend unit test coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import ManageGroupPage from '../ManageGroupPage';
import * as apiService from '../../services/apiService';
import { Group, GroupMember } from '../../types/api';

// Mock API service with Vitest
vi.mock('../../services/apiService', () => ({
  apiService: {
    getGroup: vi.fn(),
    getGroupFamilies: vi.fn(),
    getGroupPendingInvitations: vi.fn(),
    getGroupInvitations: vi.fn(),
    updateGroup: vi.fn(),
    getUserGroups: vi.fn(),
    regenerateInviteCode: vi.fn(),
    deleteGroup: vi.fn(),
    leaveGroup: vi.fn(),
  }
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'group123' }),
  };
});

// Mock auth service
vi.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockReturnValue({ id: 'user123', email: 'admin@test.com', name: 'Admin User', timezone: 'UTC' }),
    getToken: vi.fn().mockReturnValue('mock-token'),
    setAuthChangeCallback: vi.fn(),
    isTokenExpired: vi.fn().mockReturnValue(false),
    verifyMagicLink: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
    refreshTokenFromStorage: vi.fn().mockResolvedValue('mock-token'),
  },
}));

// Mock family API service
vi.mock('../../services/familyApiService', () => ({
  familyApiService: {
    getCurrentFamily: vi.fn().mockResolvedValue({
      id: 'family123',
      name: 'Test Family',
      inviteCode: 'FAM123',
      members: [],
      children: [],
      vehicles: []
    }),
    getUserPermissions: vi.fn().mockResolvedValue({
      canManageFamily: true,
      canInviteChildren: true,
      canManageVehicles: true,
      canCreateGroups: true,
    }),
  },
}));

// Mock connection store
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: vi.fn(() => ({
    apiStatus: 'connected',
    wsStatus: 'connected',
    isConnected: true,
    setApiStatus: vi.fn(),
    setWsStatus: vi.fn(),
  })),
}));

// TestWrapper is now handled by test-utils.tsx

// Get the mocked functions
const mockApiService = apiService.apiService as any;
const mockGetGroup = vi.mocked(apiService.apiService.getGroup);
const mockGetGroupFamilies = vi.mocked(apiService.apiService.getGroupFamilies);
const mockGetGroupPendingInvitations = vi.mocked(apiService.apiService.getGroupPendingInvitations);
const mockGetGroupInvitations = vi.mocked(apiService.apiService.getGroupInvitations);
const mockUpdateGroup = vi.mocked(apiService.apiService.updateGroup);

describe('ManageGroupPage - Group Update Functionality', () => {
  const mockGroup: Group = {
    id: 'group123',
    name: 'Test Group',
    description: 'Test description',
    familyId: 'family123',
    ownerId: 'owner123',
    inviteCode: 'INVITE123',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockMembers: GroupMember[] = [
    {
      id: 'member1',
      groupId: 'group123',
      familyId: 'family123',
      role: 'ADMIN',
      joinedAt: '2024-01-01T00:00:00Z',
      family: {
        id: 'family123',
        name: 'Test Family',
        members: [
          {
            id: 'user123',
            userId: 'user123',
            familyId: 'family123',
            role: 'ADMIN',
            joinedAt: '2024-01-01T00:00:00Z',
            user: { id: 'user123', email: 'admin@test.com', name: 'Admin User', timezone: 'UTC' },
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    mockApiService.getUserGroups.mockResolvedValue([{
      id: 'group123',
      name: 'Test Group',
      description: 'Test description',
      inviteCode: 'INVITE123',
      familyId: 'family123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      userRole: 'ADMIN' as const,
      joinedAt: '2024-01-01T00:00:00Z',
      ownerFamily: {
        id: 'family123',
        name: 'Test Family',
      },
      familyCount: 1,
      scheduleCount: 0,
    }]);
    mockGetGroup.mockResolvedValue(mockGroup);
    mockGetGroupFamilies.mockResolvedValue(mockMembers);
    mockGetGroupPendingInvitations.mockResolvedValue([]);
    mockGetGroupInvitations.mockResolvedValue([]);
    mockUpdateGroup.mockResolvedValue({ ...mockGroup, name: 'Updated Group' });
  });

  describe('Group Edit Dialog', () => {
    it('should open edit dialog when edit button is clicked', async () => {
      render(<ManageGroupPage />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Click edit button
      const editButton = screen.getByTestId('ManageGroupPage-Button-editGroup');
      fireEvent.click(editButton);

      // Check if dialog opens
      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Check if form fields are populated
      expect(screen.getByTestId('ManageGroupPage-Input-editGroupName')).toHaveValue('Test Group');
      expect(screen.getByTestId('ManageGroupPage-Textarea-editGroupDescription')).toHaveValue('Test description');
    });

    it('should close dialog when cancel button is clicked', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Click cancel
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-cancelGroupEdit'));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('edit-group-dialog-title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Group Name Update', () => {
    it('should successfully update group name', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: 'Updated Group Name' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called correctly
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          name: 'Updated Group Name',
        });
      });

      // Check success message
      await waitFor(() => {
        expect(screen.getByText('Group updated successfully')).toBeInTheDocument();
      });

      // Dialog should close
      expect(screen.queryByTestId('edit-group-dialog-title')).not.toBeInTheDocument();
    });

    it('should disable save button when group name is empty', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Clear name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: '' } });

      // Check that save button is disabled
      const saveButton = screen.getByTestId('ManageGroupPage-Button-saveGroup');
      expect(saveButton).toBeDisabled();

      // API should not be called
      expect(mockUpdateGroup).not.toHaveBeenCalled();
    });

    it('should trim whitespace from group name', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update name with whitespace
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: '  Trimmed Name  ' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called with trimmed name
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          name: 'Trimmed Name',
        });
      });
    });
  });

  describe('Group Description Update', () => {
    it('should successfully update group description', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update description
      const descriptionTextarea = screen.getByTestId('ManageGroupPage-Textarea-editGroupDescription');
      fireEvent.change(descriptionTextarea, { target: { value: 'New description' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called correctly
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          description: 'New description',
        });
      });
    });

    it('should clear description when empty string is provided', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Clear description
      const descriptionTextarea = screen.getByTestId('ManageGroupPage-Textarea-editGroupDescription');
      fireEvent.change(descriptionTextarea, { target: { value: '' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called with empty description
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          description: '',
        });
      });
    });

    it('should trim whitespace from description', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update description with whitespace
      const descriptionTextarea = screen.getByTestId('ManageGroupPage-Textarea-editGroupDescription');
      fireEvent.change(descriptionTextarea, { target: { value: '  Trimmed description  ' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called with trimmed description
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          description: 'Trimmed description',
        });
      });
    });
  });

  describe('Combined Updates', () => {
    it('should update both name and description', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update both fields
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      const descriptionTextarea = screen.getByTestId('ManageGroupPage-Textarea-editGroupDescription');
      
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      fireEvent.change(descriptionTextarea, { target: { value: 'New description' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check API was called with both updates
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          name: 'New Name',
          description: 'New description',
        });
      });
    });

    it('should not call API if no changes are made', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Save without making changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // API should not be called
      expect(mockUpdateGroup).not.toHaveBeenCalled();

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('edit-group-dialog-title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when update fails', async () => {
      mockUpdateGroup.mockRejectedValue(new Error('Update failed'));

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check error message
      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });

    it('should show generic error message when error has no message', async () => {
      mockUpdateGroup.mockRejectedValue(new Error());

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // Save changes
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-saveGroup'));

      // Check generic error message
      await waitFor(() => {
        expect(screen.getByText('Failed to update group')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should call update API when saving changes', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      });

      // Open edit dialog
      fireEvent.click(screen.getByTestId('ManageGroupPage-Button-editGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('edit-group-dialog-title')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-editGroupName');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // Save changes
      const saveButton = screen.getByTestId('ManageGroupPage-Button-saveGroup');
      fireEvent.click(saveButton);

      // Check that the mutation was called
      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith('group123', {
          name: 'Updated Name',
        });
      });

      // Wait for completion and success message
      await waitFor(() => {
        expect(screen.getByText('Group updated successfully')).toBeInTheDocument();
      });
    });
  });
});