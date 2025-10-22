import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedGroupInvitationPage } from '../UnifiedGroupInvitationPage';
import { unifiedInvitationService } from '../../services/unifiedInvitationService';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { BrowserRouter } from 'react-router-dom';

// Mock services
vi.mock('../../services/unifiedInvitationService', () => ({
  unifiedInvitationService: {
    validateGroupInvitation: vi.fn(),
    acceptGroupInvitation: vi.fn(),
    storePendingInvitation: vi.fn(),
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
    loading: false,
    error: null,
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
const mockStorePendingInvitation = vi.mocked(unifiedInvitationService.storePendingInvitation);
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

    it('should store invitation context when new user creates account', async () => {
      // Override mock for new user scenario
      mockValidateGroupInvitation.mockResolvedValue({
        valid: true,
        groupName: 'Test Carpool Group',
        requiresAuth: true,
        email: 'newuser@example.com',
        existingUser: false,
      });

      mockStorePendingInvitation.mockResolvedValue({
        stored: true,
        invitationType: 'GROUP',
      });

      // Mock authService.requestMagicLink to resolve successfully
      mockRequestMagicLink.mockResolvedValue(undefined);

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
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Admin Family',
          members: [
            { id: 'admin-123', userId: 'admin-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'ADMIN' },
            { id: 'member-123', userId: 'member-123', user: { id: 'member-123', name: 'Family Member', email: 'member@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'MEMBER' },
          ],
        },
        loading: false,
        error: null,
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

  describe('Family Member (Non-Admin) Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'member-123', email: 'member@example.com', name: 'Family Member', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Test Family',
          members: [
            { id: 'admin-123', userId: 'admin-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'ADMIN' },
            { id: 'member-123', userId: 'member-123', user: { id: 'member-123', name: 'Family Member', email: 'member@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'MEMBER' },
          ],
        },
        loading: false,
        error: null,
      });
    });

    it('should show that only admin can accept invitation', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Alert-requiresAdmin')).toBeInTheDocument();
      });

      expect(screen.getByTestId('GroupInvitationPage-Alert-requiresAdmin')).toHaveTextContent('Only your family admin can accept group invitations');
      expect(screen.getByTestId('GroupInvitationPage-Text-adminContact')).toHaveTextContent('Family Admin');
      expect(screen.queryByTestId('GroupInvitationPage-Button-acceptForFamily')).not.toBeInTheDocument();
    });

    it('should show options to contact admin', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin')).toBeInTheDocument();
        expect(screen.getByTestId('GroupInvitationPage-Button-requestAdminRole')).toBeInTheDocument();
      });
    });

    it('should open share dialog when share with admin clicked', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin'));

      expect(screen.getByTestId('ShareDialog-Modal-container')).toBeInTheDocument();
      expect(screen.getByTestId('ShareDialog-Input-message')).toBeInTheDocument();
      expect(screen.getByTestId('ShareDialog-Text-invitationLink')).toHaveTextContent('/groups/join?code=GRP123');
    });

    it('should send message to admin when share dialog submitted', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      
      // Mock the message sending service
      vi.mock('../../services/notificationService', () => ({
        notificationService: {
          sendMessageToFamilyAdmin: mockSendMessage,
        }
      }));

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-shareWithAdmin'));
      
      await userEvent.type(
        screen.getByTestId('ShareDialog-Input-message'),
        'Please accept this group invitation for our family'
      );
      await userEvent.click(screen.getByTestId('ShareDialog-Button-send'));

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Alert-messageSent')).toHaveTextContent('Message sent to Family Admin');
      });
    });
  });

  describe('User Without Family Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'user@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: null,
        loading: false,
        error: null,
      });
    });

    it('should show family onboarding requirement', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Alert-requiresFamily')).toBeInTheDocument();
      });

      expect(screen.getByTestId('GroupInvitationPage-Alert-requiresFamily')).toHaveTextContent('Groups are joined by families');
      expect(screen.getByTestId('GroupInvitationPage-Button-createFamily')).toHaveTextContent('Create Your Family First');
    });

    it('should redirect to family onboarding with preserved context', async () => {
      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('GroupInvitationPage-Button-createFamily')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-createFamily'));

      expect(mockNavigate).toHaveBeenCalledWith('/families/onboarding?returnTo=%2Fgroups%2Fjoin%3Fcode%3DGRP123');
    });
  });

  describe('Family Already Member Flow', () => {
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
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Test Family',
          members: [
            { id: 'admin-123', userId: 'admin-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'ADMIN' },
          ],
        },
        loading: false,
        error: null,
      });

      mockAcceptGroupInvitation.mockResolvedValue({
        alreadyMember: true,
        message: 'Your family is already a member of Test Carpool Group',
      });
    });

    it('should show already member message', async () => {
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
        expect(screen.getByTestId('GroupInvitationPage-Alert-alreadyMember')).toHaveTextContent('Your family is already a member');
      });

      expect(screen.getByTestId('GroupInvitationPage-Button-goToGroup')).toBeInTheDocument();
    });

    it('should navigate to group when go to group clicked', async () => {
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
        expect(screen.getByTestId('GroupInvitationPage-Button-goToGroup')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-goToGroup'));

      // Would navigate to the specific group page
      expect(mockNavigate).toHaveBeenCalledWith('/groups/test carpool group');
    });
  });

  describe('Multi-Admin Coordination', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'admin2-123', email: 'admin2@example.com', name: 'Admin Two', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Test Family',
          members: [
            { id: 'admin2-123', userId: 'admin2-123', user: { id: 'admin2-123', name: 'Admin Two', email: 'admin2@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'ADMIN' },
          ],
        },
        loading: false,
        error: null,
      });
    });

    it('should show already accepted message for second admin', async () => {
      mockAcceptGroupInvitation.mockResolvedValue({
        alreadyAccepted: true,
        acceptedBy: 'Admin One',
        message: 'Admin One already accepted this invitation for your family',
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
        expect(screen.getByTestId('GroupInvitationPage-Alert-alreadyAccepted')).toHaveTextContent('Admin One already accepted this invitation');
      });

      expect(screen.queryByTestId('GroupInvitationPage-Button-acceptForFamily')).not.toBeInTheDocument();
      expect(screen.getByTestId('GroupInvitationPage-Button-goToGroup')).toBeInTheDocument();
    });
  });

  describe('Invalid Invitations', () => {
    it('should show error for invalid invitation code', async () => {
      mockValidateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'Invalid invitation code',
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Alert-error')).toHaveTextContent('Invalid invitation code');
      });

      expect(screen.queryByTestId('GroupInvitationPage-Button-acceptForFamily')).not.toBeInTheDocument();
    });

    it('should show error for expired invitation', async () => {
      mockValidateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'Invitation has expired',
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Alert-error')).toHaveTextContent('Invitation has expired');
      });
    });

    it('should show specific error for email mismatch', async () => {
      mockValidateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
        errorCode: 'EMAIL_MISMATCH',
      });

      render(
        <TestWrapper>
          <UnifiedGroupInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedGroupInvitationPage-Alert-emailMismatch')).toHaveTextContent('This invitation was sent to a different email address');
      });

      expect(screen.queryByTestId('GroupInvitationPage-Button-acceptForFamily')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
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
      });

      mockUseFamily.mockReturnValue({
        currentFamily: {
          id: 'family-123',
          name: 'Test Family',
          members: [
            { id: 'admin-123', userId: 'admin-123', user: { id: 'admin-123', name: 'Family Admin', email: 'admin@example.com', createdAt: new Date(), updatedAt: new Date() }, role: 'ADMIN' },
          ],
        },
        loading: false,
        error: null,
      });
    });

    it('should handle network errors during acceptance', async () => {
      mockAcceptGroupInvitation.mockRejectedValue(new Error('Network error'));

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
        expect(screen.getByTestId('GroupInvitationPage-Alert-networkError')).toHaveTextContent('Network error');
      });

      expect(screen.getByTestId('GroupInvitationPage-Button-retry')).toBeInTheDocument();
    });

    it('should retry on network error', async () => {
      mockAcceptGroupInvitation
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, familyJoined: true });

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
        expect(screen.getByTestId('GroupInvitationPage-Button-retry')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('GroupInvitationPage-Button-retry'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});