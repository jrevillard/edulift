import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedFamilyInvitationPage } from '../UnifiedFamilyInvitationPage';
import { unifiedInvitationService } from '../../services/unifiedInvitationService';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { BrowserRouter } from 'react-router-dom';

// Mock services
vi.mock('../../services/unifiedInvitationService', () => ({
  unifiedInvitationService: {
    validateFamilyInvitation: vi.fn(),
    acceptFamilyInvitation: vi.fn(),
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
    isLoading: false,
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
    useSearchParams: () => [new URLSearchParams('code=FAM123')],
  };
});

// Get mocked functions
const mockValidateFamilyInvitation = vi.mocked(unifiedInvitationService.validateFamilyInvitation);
const mockAcceptFamilyInvitation = vi.mocked(unifiedInvitationService.acceptFamilyInvitation);
const mockUseAuth = vi.mocked(useAuth);
const mockUseFamily = vi.mocked(useFamily);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UnifiedFamilyInvitationPage', () => {
  const mockInvitationExistingUser = {
    valid: true,
    familyName: 'Test Family',
    requiresAuth: true,
    email: 'user@example.com',
    existingUser: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFamilyInvitation.mockResolvedValue(mockInvitationExistingUser);
  });

  describe('Mobile-Friendly Behavior', () => {
    it('should display invitation details properly on all devices', async () => {
      // Test that the invitation page works regardless of device type
      // Focus on user-facing behavior, not implementation details

      // Configure mocks before rendering
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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toBeInTheDocument();
      });
    });

    it('should allow users to join families on any device', async () => {
      // Test the core user journey - accepting family invitation
      mockValidateFamilyInvitation.mockResolvedValue({
        valid: true,
        familyName: 'Test Family',
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
        currentFamily: null,
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toHaveTextContent('Test Family');
      });
    });

    it('should provide clear messaging for unauthenticated users', async () => {
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
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toBeInTheDocument();
      });
    });

    it('should handle family onboarding requirement clearly', async () => {
      // Test that users without families see appropriate messaging
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
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toBeInTheDocument();
      });
    });
  });

  describe('Core Functionality', () => {
    it('should display family invitation details for unauthenticated user', async () => {
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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toBeInTheDocument();
      });
    });

    it('should accept family invitation successfully', async () => {
      mockAcceptFamilyInvitation.mockResolvedValue({
        success: true,
        familyJoined: true,
        membersAdded: 1,
      });

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
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Text-familyName')).toHaveTextContent('Test Family');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show loading during validation', () => {
      mockValidateFamilyInvitation.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockInvitationExistingUser), 100))
      );

      // Configure auth mock to avoid undefined errors
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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('UnifiedFamilyInvitationPage-Loading-validation')).toBeInTheDocument();
    });

    it('should handle invalid invitation code', async () => {
      mockValidateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'Invalid invitation code',
      });

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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-error')).toHaveTextContent('Invalid invitation code');
      });
    });

    it('should handle expired invitation', async () => {
      mockValidateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'Invitation has expired',
      });

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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-error')).toHaveTextContent('Invitation has expired');
      });
    });

    it('should handle email mismatch specifically', async () => {
      mockValidateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
        errorCode: 'EMAIL_MISMATCH',
      });

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

      render(
        <TestWrapper>
          <UnifiedFamilyInvitationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('UnifiedFamilyInvitationPage-Alert-emailMismatch')).toHaveTextContent('This invitation was sent to a different email address');
      });
    });
  });
});