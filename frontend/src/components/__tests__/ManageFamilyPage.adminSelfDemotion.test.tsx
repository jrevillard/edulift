import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ManageFamilyPage from '../../pages/ManageFamilyPage';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Mock the contexts
vi.mock('../../contexts/FamilyContext');
vi.mock('../../contexts/AuthContext');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockNavigate = vi.fn();
const mockUseFamily = vi.mocked(useFamily);
const mockUseAuth = vi.mocked(useAuth);
const mockUseNavigate = vi.mocked(useNavigate);

// Mock data definitions (must be before mocks)
const mockCurrentUser = {
  id: 'admin-user-1',
  email: 'admin@test.com',
  name: 'Admin User',
  timezone: 'UTC',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockOtherUser = {
  id: 'other-user-1',
  email: 'member@test.com',
  name: 'Member User',
  timezone: 'UTC',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockFamily = {
  id: 'family-1',
  name: 'Test Family',
  inviteCode: 'TEST123',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  members: [
    {
      id: 'member-1',
      familyId: 'family-1',
      userId: 'admin-user-1',
      role: 'ADMIN' as const,
      joinedAt: '2024-01-01T00:00:00Z',
      user: mockCurrentUser
    },
    {
      id: 'member-2',
      familyId: 'family-1',
      userId: 'other-user-1',
      role: 'MEMBER' as const,
      joinedAt: '2024-01-01T00:00:00Z',
      user: mockOtherUser
    }
  ],
  children: [
    {
      id: 'child-1',
      name: 'Test Child',
      age: 8,
      familyId: 'family-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ],
  vehicles: [
    {
      id: 'vehicle-1',
      name: 'Test Vehicle',
      capacity: 8,
      familyId: 'family-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]
};

describe('ManageFamilyPage - Admin Self-Demotion Prevention', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseNavigate.mockReturnValue(mockNavigate);
    
    mockUseAuth.mockReturnValue({
      user: mockCurrentUser,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn(),
    });

    const mockUserPermissions = {
      canManageMembers: true,
      canModifyChildren: true,
      canModifyVehicles: true,
      canViewFamily: true,
    };

    mockUseFamily.mockReturnValue({
      currentFamily: mockFamily,
      userPermissions: mockUserPermissions,
      generateInviteCode: vi.fn().mockResolvedValue('TEST123'),
      updateMemberRole: vi.fn().mockResolvedValue(undefined),
      removeMember: vi.fn().mockResolvedValue(undefined),
      inviteMember: vi.fn().mockResolvedValue(undefined),
      leaveFamily: vi.fn().mockResolvedValue(undefined),
      refreshFamily: vi.fn().mockResolvedValue(undefined),
      updateFamilyName: vi.fn().mockResolvedValue(undefined),
      createFamily: vi.fn().mockResolvedValue(undefined),
      joinFamily: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
      getPendingInvitations: vi.fn().mockResolvedValue([]),
      cancelInvitation: vi.fn().mockResolvedValue(undefined),
      hasFamily: true,
      requiresFamily: false,
      isCheckingFamily: false,
      isLoading: false,
      error: null,
      family: mockFamily,
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ManageFamilyPage />
      </MemoryRouter>
    );
  };

  it('should render family management page with members', async () => {
    renderComponent();

    // Wait for component to render 
    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Heading-pageTitle')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('ManageFamilyPage-Container-familyMembersSection')).toBeInTheDocument();
    
    // Check that family members are displayed
    const adminMemberRow = screen.getByTestId('ManageFamilyPage-Card-familyMember-admin@test.com');
    const otherMemberRow = screen.getByTestId('ManageFamilyPage-Card-familyMember-member@test.com');
    
    expect(adminMemberRow).toBeInTheDocument();
    expect(otherMemberRow).toBeInTheDocument();
  });

  it('should show admin member with correct role badge', async () => {
    renderComponent();

    await waitFor(() => {
      const adminMemberRow = screen.getByTestId('ManageFamilyPage-Card-familyMember-admin@test.com');
      expect(adminMemberRow).toBeInTheDocument();
    });
    
    // Admin should have ADMIN badge visible - use getAllByText since there might be multiple ADMIN badges
    const adminBadges = screen.getAllByText('ADMIN');
    expect(adminBadges.length).toBeGreaterThan(0);
  });

  it('should have member management functionality available for admins', async () => {
    renderComponent();

    // Check that admin has access to member management functions
    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Container-familyMembersSection')).toBeInTheDocument();
    });
    
    // Admin should see member menu buttons with unique email-based IDs
    const adminMemberMenu = screen.getByTestId('ManageFamilyPage-Button-memberMenu-admin@test.com');
    const otherMemberMenu = screen.getByTestId('ManageFamilyPage-Button-memberMenu-member@test.com');
    
    expect(adminMemberMenu).toBeInTheDocument();
    expect(otherMemberMenu).toBeInTheDocument();
  });

  it('should prevent admin from demoting themselves', async () => {
    const user = userEvent.setup();
    
    renderComponent();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Container-familyMembersSection')).toBeInTheDocument();
    });

    // Click on the admin's own member menu
    const adminMemberMenu = screen.getByTestId('ManageFamilyPage-Button-memberMenu-admin@test.com');
    
    await user.click(adminMemberMenu);
    
    // Wait for the dropdown to open and show the role toggle
    await waitFor(() => {
      const roleToggle = screen.getByTestId('ManageFamilyPage-Button-roleToggle-admin@test.com');
      expect(roleToggle).toBeInTheDocument();
    });
    
    // Should show the "Cannot change own role" text
    expect(screen.getByText('Cannot change own role')).toBeInTheDocument();
    
    // The role toggle should be disabled
    const roleToggle = screen.getByTestId('ManageFamilyPage-Button-roleToggle-admin@test.com');
    expect(roleToggle).toHaveAttribute('aria-disabled', 'true');
  });

  it('should allow role changes for other members', async () => {
    const user = userEvent.setup();
    
    renderComponent();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('ManageFamilyPage-Container-familyMembersSection')).toBeInTheDocument();
    });

    // Click on another member's menu
    const otherMemberMenu = screen.getByTestId('ManageFamilyPage-Button-memberMenu-member@test.com');
    
    await user.click(otherMemberMenu);
    
    // Wait for the dropdown to open and show the role toggle
    await waitFor(() => {
      const roleToggle = screen.getByTestId('ManageFamilyPage-Button-roleToggle-member@test.com');
      expect(roleToggle).toBeInTheDocument();
    });
    
    // Should allow role change for other members
    const roleToggle = screen.getByTestId('ManageFamilyPage-Button-roleToggle-member@test.com');
    expect(roleToggle).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Make Admin')).toBeInTheDocument();
  });
});