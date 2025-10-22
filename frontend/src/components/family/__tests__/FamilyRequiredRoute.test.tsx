import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FamilyRequiredRoute } from '../FamilyRequiredRoute';
import { useFamily } from '../../../contexts/FamilyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';

// Mock the contexts
vi.mock('../../../contexts/FamilyContext');
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../contexts/SocketContext');
vi.mock('../FamilyOnboardingWizard', () => ({
  FamilyOnboardingWizard: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="family-onboarding-wizard">
      <p>Family Onboarding Wizard</p>
      <button onClick={onComplete}>Complete Onboarding</button>
    </div>
  )
}));

const mockUseFamily = vi.mocked(useFamily);
const mockUseAuth = vi.mocked(useAuth);
const mockUseSocket = vi.mocked(useSocket);

describe('FamilyRequiredRoute', () => {
  const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
  const FallbackComponent = () => <div data-testid="fallback-content">Fallback Content</div>;
  
  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        {component}
      </MemoryRouter>
    );
  };

  const defaultAuthContextValue = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    verifyMagicLink: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn()
  };

  const defaultFamilyContextValue = {
    currentFamily: null,
    userPermissions: null,
    requiresFamily: false,
    isCheckingFamily: false,
    isLoading: false,
    error: null,
    hasFamily: false,
    createFamily: vi.fn(),
    joinFamily: vi.fn(),
    leaveFamily: vi.fn(),
    refreshFamily: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    generateInviteCode: vi.fn(),
    clearError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthContextValue);
    mockUseFamily.mockReturnValue(defaultFamilyContextValue);
    mockUseSocket.mockReturnValue({
      socket: null,
      isConnected: true
    });
  });

  describe('Loading states', () => {
    it('should show loading when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthContextValue,
        isLoading: true
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show loading when family is being checked', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        isCheckingFamily: true
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show loading when family context is loading', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        isLoading: true
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication states', () => {
    it('should render nothing when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthContextValue,
        isAuthenticated: false,
        user: null
      });

      const { container } = renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render fallback when user is not authenticated and fallback is provided', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthContextValue,
        isAuthenticated: false,
        user: null
      });

      renderWithRouter(
        <FamilyRequiredRoute fallback={<FallbackComponent />}>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Family requirement states', () => {
    it('should navigate to onboarding when family is required', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: true,
        hasFamily: false
      });

      const { container } = renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      // Component should navigate away, so content should be empty
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should navigate to onboarding when user has no family', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: false,
        hasFamily: false
      });

      const { container } = renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      // Component should navigate away, so content should be empty
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render protected content when user has family', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: false,
        hasFamily: true,
        currentFamily: {
          id: 'family-1',
          name: 'Test Family',
          inviteCode: 'ABC123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          members: [],
          children: [],
          vehicles: []
        }
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByTestId('protected-content')).toHaveTextContent('Protected Content');
      expect(screen.queryByTestId('family-onboarding-wizard')).not.toBeInTheDocument();
    });
  });

  describe('Onboarding completion', () => {
    it('should navigate to onboarding when completion is required', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: true,
        hasFamily: false
      });

      const { container } = renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      // Component should navigate to onboarding
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should prioritize loading states over family requirements', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthContextValue,
        isLoading: true
      });
      
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: true,
        hasFamily: false
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading')).toBeInTheDocument();
      expect(screen.queryByTestId('family-onboarding-wizard')).not.toBeInTheDocument();
    });

    it('should handle multiple children components', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        requiresFamily: false,
        hasFamily: true,
        currentFamily: {
          id: 'family-1',
          name: 'Test Family',
          inviteCode: 'ABC123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          members: [],
          children: [],
          vehicles: []
        }
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
          <div data-testid="second-component">Second Component</div>
        </FamilyRequiredRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByTestId('second-component')).toBeInTheDocument();
    });
  });

  describe('Loading UI', () => {
    it('should render loading spinner and text', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        isCheckingFamily: true
      });

      renderWithRouter(
        <FamilyRequiredRoute>
          <TestComponent />
        </FamilyRequiredRoute>
      );

      // Check for loading elements without being too specific about CSS classes
      expect(screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading')).toBeInTheDocument();
      
      // The component should be wrapped in a loading container
      const loadingContainer = screen.getByTestId('FamilyRequiredRoute-Text-familyStatusLoading').closest('div');
      expect(loadingContainer).toBeInTheDocument();
    });
  });
});