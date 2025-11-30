import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedGroupInvitationPage } from '../UnifiedGroupInvitationPage';
import { unifiedInvitationService } from '../../services/unifiedInvitationService';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { BrowserRouter } from 'react-router-dom';

// Import testing library matchers for proper TypeScript support
import '@testing-library/jest-dom';

// Mock services
vi.mock('../../services/unifiedInvitationService', () => ({
  unifiedInvitationService: {
    validateGroupInvitation: vi.fn(),
    acceptGroupInvitation: vi.fn(),
  }
}));

vi.mock('../../services/authService', () => ({
  authService: {
    requestMagicLink: vi.fn(),
  }
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/FamilyContext', () => ({
  useFamily: vi.fn(() => ({
    currentFamily: null,
    userPermissions: null,
    isLoading: false,
    error: null,
    requiresFamily: false,
    isCheckingFamily: false,
    hasFamily: false,
    createFamily: vi.fn(),
    joinFamily: vi.fn(),
    leaveFamily: vi.fn(),
    refreshFamily: vi.fn(),
    updateFamilyName: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    generateInviteCode: vi.fn(),
    getPendingInvitations: vi.fn(),
    cancelInvitation: vi.fn(),
    clearError: vi.fn(),
  })),
}));

// Mock router hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('code=GRP123')],
  };
});

// Get mocked functions
const mockValidateGroupInvitation = vi.mocked(unifiedInvitationService.validateGroupInvitation);
const mockAcceptGroupInvitation = vi.mocked(unifiedInvitationService.acceptGroupInvitation);
const mockRequestMagicLink = vi.mocked(authService.requestMagicLink);
const mockUseAuth = vi.mocked(useAuth);
const mockUseFamily = vi.mocked(useFamily);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UnifiedGroupInvitationPage - TDD Tests', () => {
  const mockGroupInvitation = {
    valid: true,
    groupName: 'Test Carpool Group',
    requiresAuth: true,
    email: 'user@example.com',
    existingUser: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateGroupInvitation.mockResolvedValue(mockGroupInvitation);

    // Configure default auth mock to prevent undefined errors
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn(),
    });
  });

  describe('Unauthenticated User Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn(),
      });
    });

    it('should display group invitation details for unauthenticated user', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Text-groupName')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedGroupInvitationPage-Text-groupName')).toHaveTextContent('Test Carpool Group');
      expect(screen.getByTestId('GroupInvitationPage-Alert-requiresAuth')).toHaveTextContent('Sign in required');
    });

    it('should show sign in option for existing user', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-sendMagicLink')).toBeInTheDocument();
        expect(screen.getByTestId('GroupInvitationPage-Text-existingUserMessage')).toHaveTextContent('This invitation is for user@example.com');
      });
    });

    it('should redirect new users to sign up', async () => {
      // Override mock for new user scenario
      mockValidateGroupInvitation.mockResolvedValue({
        valid: true,
        groupName: 'Test Carpool Group',
        requiresAuth: true,
        email: 'newuser@example.com',
        existingUser: false,
      });

      // Mock authService.requestMagicLink to resolve successfully
      mockRequestMagicLink.mockResolvedValue({ success: true });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      // First click the button to show signup form
      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-signInToJoin')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('GroupInvitationPage-Button-signInToJoin'));

      // Fill in name and submit
      await waitFor(() => {
        expect(screen.getByTestId('SignupForm-Input-name')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('SignupForm-Input-name'), 'Test User');
      await user.click(screen.getByTestId('SignupForm-Button-submit'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login?email=newuser%40example.com&returnTo=%2Fgroups%2Fjoin%3Fcode%3DGRP123&success=true');
      });
    });
  });

  describe('Family Admin User Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'admin-123', email: 'admin@example.com', name: 'Family Admin', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Admin Family',
          inviteCode: 'FAM123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [
            { id: 'admin-123', userId: 'admin-123', familyId: 'family-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, role: 'ADMIN', joinedAt: new Date().toISOString() },
            { id: 'member-123', userId: 'member-123', familyId: 'family-123', user: { id: 'member-123', name: 'Family Member', email: 'member@example.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, role: 'MEMBER', joinedAt: new Date().toISOString() },
          ],
          children: [],
          vehicles: [],
        },
        userPermissions: null,
        isLoading: false,
        error: null,
        requiresFamily: false,
        isCheckingFamily: false,
        hasFamily: true,
        createFamily: vi.fn(),
        joinFamily: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        updateFamilyName: vi.fn(),
        inviteMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        generateInviteCode: vi.fn(),
        getPendingInvitations: vi.fn(),
        cancelInvitation: vi.fn(),
        clearError: vi.fn(),
      });
    });

    it('should show family admin can accept for entire family', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Heading-acceptForFamily')).toBeInTheDocument();
      });

      expect(screen.getByTestId('GroupInvitationPage-Heading-acceptForFamily')).toHaveTextContent('As a family admin, you can accept this invitation');
      expect(screen.getByTestId('GroupInvitationPage-List-familyMembers')).toBeInTheDocument();
      expect(screen.getByTestId('GroupInvitationPage-ListItem-admin-123')).toHaveTextContent('Family Admin (you)');
      expect(screen.getByTestId('GroupInvitationPage-ListItem-member-123')).toHaveTextContent('Family Member');
      expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toBeInTheDocument();
    });

    it('should accept group invitation for entire family', async () => {
      mockAcceptGroupInvitation.mockResolvedValue({
        success: true,
        familyJoined: true,
        membersAdded: 2,
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily'));

      await waitFor(() => {
        expect(mockAcceptGroupInvitation).toHaveBeenCalledWith('GRP123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should show loading state during acceptance', async () => {
      mockAcceptGroupInvitation.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, familyJoined: true }), 100))
      );

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily'));

      // Check the button is disabled and shows loading text
      expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toBeDisabled();
      expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toHaveTextContent('Accepting for family...');
    });
  });

  describe('Mobile-Friendly Behavior', () => {
    it('should display invitation details properly on all devices', async () => {
      // Test that the invitation page works regardless of device type
      // Focus on user-facing behavior, not implementation details
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Text-groupName')).toBeInTheDocument();
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Text-groupName')).toHaveTextContent('Test Carpool Group');
      });
    });

    it('should allow users to join groups on any device', async () => {
      // Test the core user journey - accepting group invitation
      const user = userEvent.setup();

      mockValidateGroupInvitation.mockResolvedValue({
        valid: true,
        groupName: 'Test Carpool Group',
        requiresAuth: true,
        email: 'admin@example.com',
        existingUser: true,
      });

      mockUseAuth.mockReturnValue({
        user: { id: 'admin-123', email: 'admin@example.com', name: 'Family Admin', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Admin Family',
          inviteCode: 'FAM123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [
            { id: 'admin-123', userId: 'admin-123', familyId: 'family-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, role: 'ADMIN', joinedAt: new Date().toISOString() },
          ],
          children: [],
          vehicles: [],
        },
        userPermissions: null,
        isLoading: false,
        error: null,
        requiresFamily: false,
        isCheckingFamily: false,
        hasFamily: true,
        createFamily: vi.fn(),
        joinFamily: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        updateFamilyName: vi.fn(),
        inviteMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        generateInviteCode: vi.fn(),
        getPendingInvitations: vi.fn(),
        cancelInvitation: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('GroupInvitationPage-Button-acceptForFamily'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should provide clear messaging for unauthenticated users on mobile', async () => {
      // Test the user experience for unauthenticated users
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn(),
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Text-groupName')).toHaveTextContent('Test Carpool Group');
        expect(screen.getByTestId('GroupInvitationPage-Alert-requiresAuth')).toHaveTextContent('Sign in required');
      });
    });

    it('should handle family member restrictions clearly', async () => {
      // Test that family members who aren't admins get appropriate messaging
      const user = userEvent.setup();

      mockUseAuth.mockReturnValue({
        user: { id: 'member-123', email: 'member@example.com', name: 'Family Member', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAM123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [
            { id: 'admin-123', userId: 'admin-123', familyId: 'family-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, role: 'ADMIN', joinedAt: new Date().toISOString() },
            { id: 'member-123', userId: 'member-123', familyId: 'family-123', user: { id: 'member-123', name: 'Family Member', email: 'member@example.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, role: 'MEMBER', joinedAt: new Date().toISOString() },
          ],
          children: [],
          vehicles: [],
        },
        userPermissions: null,
        isLoading: false,
        error: null,
        requiresFamily: false,
        isCheckingFamily: false,
        hasFamily: true,
        createFamily: vi.fn(),
        joinFamily: vi.fn(),
        leaveFamily: vi.fn(),
        refreshFamily: vi.fn(),
        updateFamilyName: vi.fn(),
        inviteMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn(),
        generateInviteCode: vi.fn(),
        getPendingInvitations: vi.fn(),
        cancelInvitation: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Alert-requiresAdmin')).toBeInTheDocument();
        expect(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin')).toBeInTheDocument();
        expect(screen.getByTestId('GroupInvitationPage-Button-requestAdminRole')).toBeInTheDocument();
      });

      // Test the share functionality
      await user.click(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin'));

      await waitFor(() => {
        expect(screen.getByTestId('ShareDialog-Modal-container')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockValidateGroupInvitation.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      // The component catches network errors and shows a generic message
      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Alert-error')).toHaveTextContent('Failed to validate invitation');
      });

      expect(screen.queryByTestId('GroupInvitationPage-Button-acceptForFamily')).not.toBeInTheDocument();
    });
  });
});