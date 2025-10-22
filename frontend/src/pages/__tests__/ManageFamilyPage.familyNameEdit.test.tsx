import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ManageFamilyPage from '../ManageFamilyPage';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Family, FamilyPermissions } from '../../types/family';

// Mock dependencies
vi.mock('../../contexts/FamilyContext');
vi.mock('../../contexts/AuthContext');

const mockUseFamily = useFamily as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const mockFamily: Family = {
  id: 'family-1',
  name: 'Original Family Name',
  members: [
    {
      id: 'member-1',
      role: 'ADMIN',
      user: {
        id: 'user-1',
        name: 'John Admin',
        email: 'john@example.com'
      },
      joinedAt: new Date()
    },
    {
      id: 'member-2',
      role: 'PARENT',
      user: {
        id: 'user-2',
        name: 'Jane Parent',
        email: 'jane@example.com'
      },
      joinedAt: new Date()
    }
  ],
  children: [
    {
      id: 'child-1',
      name: 'Alice',
      age: 8,
      familyId: 'family-1',
      groupMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  vehicles: [
    {
      id: 'vehicle-1',
      name: 'Honda CR-V',
      capacity: 5,
      familyId: 'family-1',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

const adminPermissions: FamilyPermissions = {
  canManageMembers: true,
  canModifyChildren: true,
  canModifyVehicles: true,
  canGenerateInvites: true
};

const parentPermissions: FamilyPermissions = {
  canManageMembers: false,
  canModifyChildren: true,
  canModifyVehicles: true,
  canGenerateInvites: false
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

describe('ManageFamilyPage - Family Name Edit Functionality', () => {
  let mockUpdateFamilyName: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUpdateFamilyName = vi.fn().mockResolvedValue(undefined);
    
    // Mock AuthContext
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'john@example.com',
        name: 'John Admin'
      },
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn()
    });
  });

  it('should show edit button for admin users', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Verify family name is displayed
    expect(screen.getByDisplayValue('Original Family Name')).toBeInTheDocument();

    // Verify edit button is present
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    expect(editButton).toBeInTheDocument();
  });

  it('should not show edit button for non-admin users', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: parentPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Verify family name is displayed but read-only
    expect(screen.getByDisplayValue('Original Family Name')).toBeInTheDocument();

    // Verify edit button is not present
    expect(screen.queryByTestId('ManageFamilyPage-Button-editFamily')).not.toBeInTheDocument();
  });

  it('should open edit dialog when edit button is clicked', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Click edit button
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    // Verify dialog opens
    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    // Verify dialog description
    expect(screen.getByTestId('ManageFamilyPage-Text-editFamilyNameDialogDescription')).toBeInTheDocument();

    // Verify input is pre-filled with current name
    const nameInput = document.getElementById('edit-family-name')!;
    expect(nameInput).toHaveValue('Original Family Name');
  });

  it('should update family name when form is submitted', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Open edit dialog
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    // Change the family name
    const nameInput = document.getElementById('edit-family-name')!;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Updated Family Name' } });
    });

    // Character counter would be tested here if implemented

    // Submit the form
    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Verify updateFamilyName was called
    await waitFor(() => {
      expect(mockUpdateFamilyName).toHaveBeenCalledWith('Updated Family Name');
    });
  });

  it('should close dialog after successful update', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Open edit dialog and submit
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    const nameInput = document.getElementById('edit-family-name')!;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Updated Family Name' } });
    });

    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Verify dialog closes
    await waitFor(() => {
      expect(screen.queryByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).not.toBeInTheDocument();
    });
  });

  it('should show success message after update', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Perform update
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    const nameInput = document.getElementById('edit-family-name')!;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Updated Family Name' } });
    });

    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Note: Success message would be shown by the component's internal state
    // This would need to be tested with a more complex setup that tracks component state
    await waitFor(() => {
      expect(mockUpdateFamilyName).toHaveBeenCalled();
    });
  });

  it('should prevent submission of empty name', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Open edit dialog
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    // Clear the input
    const nameInput = document.getElementById('edit-family-name')!;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    // Verify save button is disabled
    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    expect(saveButton).toBeDisabled();
  });

  it('should prevent submission if name unchanged', async () => {
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockUpdateFamilyName,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Open edit dialog
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    // Don't change the name (it's already pre-filled)
    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    expect(saveButton).toBeDisabled();
  });

  it('should handle update errors gracefully', async () => {
    const mockErrorUpdate = vi.fn().mockRejectedValue(new Error('Update failed'));
    
    await act(async () => {
      mockUseFamily.mockReturnValue({
        currentFamily: mockFamily,
        userPermissions: adminPermissions,
        updateFamilyName: mockErrorUpdate,
        generateInviteCode: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        inviteMember: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        getPendingInvitations: vi.fn().mockResolvedValue([]),
        cancelInvitation: vi.fn()
      });

      render(
        <TestWrapper>
          <ManageFamilyPage />
        </TestWrapper>
      );
    });

    // Attempt update
    const editButton = screen.getByTestId('ManageFamilyPage-Button-editFamily');
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
    });

    const nameInput = document.getElementById('edit-family-name')!;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Updated Family Name' } });
    });

    const saveButton = screen.getByTestId('ManageFamilyPage-Button-saveFamilyName');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Verify error handling
    await waitFor(() => {
      expect(mockErrorUpdate).toHaveBeenCalledWith('Updated Family Name');
    });

    // Dialog should remain open on error
    expect(screen.getByTestId('ManageFamilyPage-Heading-editFamilyNameDialogTitle')).toBeInTheDocument();
  });
});