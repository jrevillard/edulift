import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedFamilyInvitationPage } from '../UnifiedFamilyInvitationPage';
import { unifiedInvitationService } from '../../services/unifiedInvitationService';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { BrowserRouter } from 'react-router-dom';

// Mock services
vi.mock('../../services/unifiedInvitationService', () => ({
  unifiedInvitationService: {
    validateFamilyInvitation: vi.fn(),
    acceptFamilyInvitation: vi.fn(),
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
  useFamily: vi.fn(),
}));

// Mock router hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('code=FAM123')],
  };
});

// Get mocked functions
const mockValidateFamilyInvitation = vi.mocked(unifiedInvitationService.validateFamilyInvitation);
const mockAcceptFamilyInvitation = vi.mocked(unifiedInvitationService.acceptFamilyInvitation);
const mockRequestMagicLink = vi.mocked(authService.requestMagicLink);
const mockUseAuth = vi.mocked(useAuth);
const mockUseFamily = vi.mocked(useFamily);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UnifiedFamilyInvitationPage - Updated Tests', () => {
  const mockInvitationExistingUser = {
    valid: true,
    familyName: 'Test Family',
    role: 'MEMBER' as const,
    personalMessage: 'Welcome to our family!',
    email: 'existing@example.com',
    existingUser: true,
  };

  const mockInvitationNewUser = {
    valid: true,
    familyName: 'Test Family',
    role: 'MEMBER' as const,
    personalMessage: 'Welcome to our family!',
    email: 'newuser@example.com',
    existingUser: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFamilyInvitation.mockResolvedValue(mockInvitationExistingUser);
    
    // Mock useFamily to return no current family
    mockUseFamily.mockReturnValue({
      currentFamily: null,
      loading: false,
      error: null,
      refreshFamily: vi.fn(),
    });
  });

  describe('Cas 1: Utilisateur non authentifié - Utilisateur existant', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });

    it('should display invitation details', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Title-familyInvitation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toHaveTextContent('Test Family');
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-personalMessage')).toHaveTextContent('Welcome to our family!');
    });

    it('should show Send Magic Link for existing user', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-existingUserMessage')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-existingUserMessage')).toHaveTextContent('existing@example.com');
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-sendMagicLink')).toHaveTextContent('Send Magic Link');
    });

    it('should send magic link with inviteCode for existing user', async () => {
      mockRequestMagicLink.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-sendMagicLink')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-sendMagicLink'));

      await waitFor(() => {
        expect(mockRequestMagicLink).toHaveBeenCalledWith(
          'existing@example.com',
          expect.objectContaining({
            inviteCode: 'FAM123'
          })
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/login?email=existing%40example.com&returnTo=%2Ffamilies%2Fjoin%3Fcode%3DFAM123&success=true');
    });
  });

  describe('Cas 1: Utilisateur non authentifié - Nouvel utilisateur', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      mockValidateFamilyInvitation.mockResolvedValue(mockInvitationNewUser);
    });

    it('should show Sign In to join button for new user', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-newUserMessage')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-newUserMessage')).toHaveTextContent('newuser@example.com');
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-signInToJoin')).toHaveTextContent('Sign In to join Test Family');
    });

    it('should show name-only form when clicked', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-signInToJoin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-signInToJoin'));

      expect(screen.getByTestId('SignupForm-Container-form')).toBeInTheDocument();
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-emailPreset')).toHaveTextContent('newuser@example.com');
      expect(screen.getByTestId('SignupForm-Input-name')).toBeInTheDocument();
    });

    it('should send magic link with invitation context', async () => {
      mockRequestMagicLink.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      // Click sign in to join
      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-signInToJoin')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-signInToJoin'));

      // Fill name and submit
      await userEvent.type(screen.getByTestId('SignupForm-Input-name'), 'New User');
      await userEvent.click(screen.getByTestId('SignupForm-Button-submit'));

      await waitFor(() => {
        expect(mockRequestMagicLink).toHaveBeenCalledWith(
          'newuser@example.com',
          expect.objectContaining({
            inviteCode: 'FAM123',
            name: 'New User'
          })
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/login?email=newuser%40example.com&returnTo=%2Ffamilies%2Fjoin%3Fcode%3DFAM123&success=true');
    });
  });

  describe('Cas 2: Utilisateur authentifié sans famille', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'user@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: null,
      });
    });

    it('should show join button', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-joinFamily')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-joinFamily')).toHaveTextContent('Join Test Family');
    });

    it('should join family successfully', async () => {
      mockAcceptFamilyInvitation.mockResolvedValue({
        success: true,
        familyId: 'family-123',
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-joinFamily')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-joinFamily'));

      await waitFor(() => {
        expect(mockAcceptFamilyInvitation).toHaveBeenCalledWith('FAM123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Cas 3: Utilisateur authentifié avec famille existante', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'user@example.com', name: 'Test User', timezone: 'UTC' },
        isAuthenticated: true,
        isLoading: false,
        family: { id: 'current-family', name: 'Current Family', role: 'MEMBER' },
      });

      // Mock useFamily to return current family for conflict detection
      mockUseFamily.mockReturnValue({
        currentFamily: { id: 'current-family', name: 'Current Family', role: 'MEMBER' },
        loading: false,
        error: null,
        refreshFamily: vi.fn(),
      });
    });

    it('should show family conflict message', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-alreadyInFamily')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-alreadyInFamily')).toHaveTextContent('You already belong to a family');
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-currentFamily')).toHaveTextContent('Current Family');
      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-newFamily')).toHaveTextContent('Test Family');
    });

    it('should show leave and join option', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin')).toBeInTheDocument();
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-cancel')).toBeInTheDocument();
      });

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin')).toHaveTextContent('Leave current family and join');
    });

    it('should show confirmation dialog', async () => {
      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin'));

      expect(screen.getByTestId('ConfirmDialog-Modal-container')).toBeInTheDocument();
      expect(screen.getByTestId('ConfirmDialog-Text-warning')).toHaveTextContent('leave your current family');
    });

    it('should switch families when confirmed', async () => {
      mockAcceptFamilyInvitation.mockResolvedValue({
        success: true,
        familyId: 'family-123',
        leftPreviousFamily: true,
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('UnifiedFamilyInvitationPage-Button-leaveAndJoin'));
      await userEvent.click(screen.getByTestId('ConfirmDialog-Button-confirm'));

      await waitFor(() => {
        expect(mockAcceptFamilyInvitation).toHaveBeenCalledWith('FAM123', {
          leaveCurrentFamily: true,
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Invitations invalides', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });

    it('should show error for invalid invitation', async () => {
      mockValidateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'Invalid invitation code',
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-error')).toHaveTextContent('Invalid invitation code');
      });
    });

    it('should show loading during validation', () => {
      mockValidateFamilyInvitation.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockInvitationExistingUser), 100))
      );

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Loading-validation')).toBeInTheDocument();
    });
  });
});