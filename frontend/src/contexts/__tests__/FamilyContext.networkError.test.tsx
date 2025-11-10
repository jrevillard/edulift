import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { FamilyProvider, useFamily } from '../FamilyContext';
import { useAuth } from '../AuthContext';
import { familyApiService } from '../../services/familyApiService';

// Mock dependencies
vi.mock('../AuthContext');
vi.mock('../../services/familyApiService');
vi.mock('@/utils/secureStorage', () => ({
  secureStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined)
  }
}));

const mockUseAuth = vi.mocked(useAuth);
const mockFamilyApiService = vi.mocked(familyApiService);

// Test component to access family context
const TestComponent = () => {
  const { requiresFamily, isCheckingFamily, error } = useFamily();
  return (
    <div>
      <div data-testid="requires-family">{requiresFamily.toString()}</div>
      <div data-testid="is-checking">{isCheckingFamily.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
    </div>
  );
};

describe('FamilyContext - Network Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useAuth with complete interface matching AuthContextType
    // CRITICAL: Ensure re-render happens for useEffect to trigger
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      isAuthenticated: true,
      isLoading: false,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      updateUser: vi.fn()
    });

    // Reset getCurrentFamily mock to ensure clean state
    mockFamilyApiService.getCurrentFamily.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Network Errors - Should NOT require family', () => {
    it('should NOT set requiresFamily to true on Failed to fetch errors', async () => {
      // Mock network error when fetching family
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('Failed to fetch')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      // Wait for family checking to complete
      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // Should NOT require family on network error
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('Failed to fetch');
    });

    it('should NOT set requiresFamily to true on connection refused errors', async () => {
      // Mock connection refused error
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('ERR_CONNECTION_REFUSED')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // Should NOT require family on connection error
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('ERR_CONNECTION_REFUSED');
    });

    it('should NOT set requiresFamily to true on NetworkError', async () => {
      // Mock NetworkError
      console.log('🔍 DEBUG TEST: Setting up NetworkError mock');
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('NetworkError')
      );
      console.log('🔍 DEBUG TEST: Mock getCurrentFamily calls:', mockFamilyApiService.getCurrentFamily.mock.calls);

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      console.log('🔍 DEBUG TEST: Waiting for family checking to complete...');

      await waitFor(
        () => {
          console.log('🔍 DEBUG TEST: is-checking.textContent =', getByTestId('is-checking').textContent);
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      console.log('🔍 DEBUG TEST: Final assertions');
      console.log('🔍 DEBUG TEST: requires-family.textContent =', getByTestId('requires-family').textContent);
      console.log('🔍 DEBUG TEST: error.textContent =', getByTestId('error').textContent);

      // Should NOT require family on network error
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('NetworkError');
    });

    it('should NOT set requiresFamily to true on ERR_NETWORK errors', async () => {
      // Mock ERR_NETWORK error
      console.log('🔍 DEBUG TEST ERR_NETWORK: Setting up mock');
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('ERR_NETWORK')
      );
      console.log('🔍 DEBUG TEST ERR_NETWORK: Mock setup complete');

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      console.log('🔍 DEBUG TEST ERR_NETWORK: Starting waitFor');
      await waitFor(
        () => {
          const isCheckingText = getByTestId('is-checking').textContent;
          console.log('🔍 DEBUG TEST ERR_NETWORK: is-checking.textContent =', isCheckingText);
          expect(isCheckingText).toBe('false');
        },
        { timeout: 10000 }
      );
      console.log('🔍 DEBUG TEST ERR_NETWORK: waitFor completed');

      // Should NOT require family on network error
      const requiresFamilyText = getByTestId('requires-family').textContent;
      const errorText = getByTestId('error').textContent;
      console.log('🔍 DEBUG TEST ERR_NETWORK: requires-family.textContent =', requiresFamilyText);
      console.log('🔍 DEBUG TEST ERR_NETWORK: error.textContent =', errorText);

      expect(requiresFamilyText).toBe('false');
      expect(errorText).toBe('ERR_NETWORK');
    });

    it('should NOT set requiresFamily to true on 500 server errors', async () => {
      // Mock 500 server error
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('500 Internal Server Error')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // Should NOT require family on server error
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('500 Internal Server Error');
    });

    it('should NOT set requiresFamily to true on 502/503/504 errors', async () => {
      // Mock 503 service unavailable error
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('503 Service Unavailable')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // Should NOT require family on service unavailable error
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('503 Service Unavailable');
    });
  });

  describe('Non-Network Errors - Should require family', () => {
    it('should set requiresFamily to true on authentication errors', async () => {
      // Mock non-network error (e.g., authentication error)
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('Unauthorized')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // SHOULD require family on non-network errors
      expect(getByTestId('requires-family').textContent).toBe('true');
      expect(getByTestId('error').textContent).toBe('Unauthorized');
    });

    it('should set requiresFamily to true on permission errors', async () => {
      // Mock permission error
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('Forbidden')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // SHOULD require family on permission errors
      expect(getByTestId('requires-family').textContent).toBe('true');
      expect(getByTestId('error').textContent).toBe('Forbidden');
    });

    it('should set requiresFamily to true on not found errors', async () => {
      // Mock not found error that's not network-related
      mockFamilyApiService.getCurrentFamily.mockRejectedValue(
        new Error('User not found in family system')
      );

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // SHOULD require family on business logic errors
      expect(getByTestId('requires-family').textContent).toBe('true');
      expect(getByTestId('error').textContent).toBe('User not found in family system');
    });
  });

  describe('Success Cases', () => {
    it('should set requiresFamily to true when family is null (no error)', async () => {
      // Mock successful response with no family
      mockFamilyApiService.getCurrentFamily.mockResolvedValue(null);

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // SHOULD require family when user has no family
      expect(getByTestId('requires-family').textContent).toBe('true');
      expect(getByTestId('error').textContent).toBe('no-error');
    });

    it('should set requiresFamily to false when user has a family', async () => {
      // Mock successful response with family
      mockFamilyApiService.getCurrentFamily.mockResolvedValue({
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'TEST123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      });

      // Mock user permissions response
      mockFamilyApiService.getUserPermissions.mockResolvedValue({
        canManageMembers: true,
        canModifyChildren: true,
        canModifyVehicles: true,
        canViewFamily: true
      });

      const { getByTestId } = render(
        <FamilyProvider>
          <TestComponent />
        </FamilyProvider>
      );

      await waitFor(
        () => {
          expect(getByTestId('is-checking').textContent).toBe('false');
        },
        { timeout: 10000 }
      );

      // Should NOT require family when user has one
      expect(getByTestId('requires-family').textContent).toBe('false');
      expect(getByTestId('error').textContent).toBe('no-error');
    });
  });
});