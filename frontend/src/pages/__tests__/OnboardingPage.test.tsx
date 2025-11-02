import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPage from '../OnboardingPage';
import * as AuthContext from '../../contexts/AuthContext';
import * as FamilyContext from '../../contexts/FamilyContext';
import '@testing-library/jest-dom';

// Mock the contexts
vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/FamilyContext');

// Mock the FamilyOnboardingWizard component
vi.mock('../../components/family/FamilyOnboardingWizard', () => ({
  FamilyOnboardingWizard: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="family-onboarding-wizard">
      <button onClick={onComplete}>Complete Onboarding</button>
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OnboardingPage', () => {
  const mockUseAuth = vi.mocked(AuthContext.useAuth);
  const mockUseFamily = vi.mocked(FamilyContext.useFamily);

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows loading state while checking authentication and family status', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn(),
    });

    mockUseFamily.mockReturnValue({
      hasFamily: false,
      isCheckingFamily: false,
      isLoading: false,
      requiresFamily: false,
      currentFamily: null,
      userPermissions: null,
      error: null,
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
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to dashboard when user already has a family', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn(),
    });

    mockUseFamily.mockReturnValue({
      hasFamily: true,
      isCheckingFamily: false,
      isLoading: false,
      requiresFamily: false,
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'test-code',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        members: [],
        children: [],
        vehicles: [],
      },
      userPermissions: null,
      error: null,
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
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('shows onboarding wizard when user has no family', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn(),
    });

    mockUseFamily.mockReturnValue({
      hasFamily: false,
      isCheckingFamily: false,
      isLoading: false,
      requiresFamily: true,
      currentFamily: null,
      userPermissions: null,
      error: null,
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
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('family-onboarding-wizard')).toBeInTheDocument();
  });

  it('does not redirect when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn(),
    });

    mockUseFamily.mockReturnValue({
      hasFamily: false,
      isCheckingFamily: false,
      isLoading: false,
      requiresFamily: false,
      currentFamily: null,
      userPermissions: null,
      error: null,
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
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    // Should show the wizard since ProtectedRoute will handle the redirect
    expect(screen.getByTestId('family-onboarding-wizard')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
