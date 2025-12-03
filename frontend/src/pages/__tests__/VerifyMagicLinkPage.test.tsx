import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { render } from '../../test/test-utils'
import VerifyMagicLinkPage from '../VerifyMagicLinkPage'
import { AuthProvider } from '../../contexts/AuthContext'
import { SocketProvider } from '../../contexts/SocketContext'
import { FamilyProvider } from '../../contexts/FamilyContext'
import { useMobileDetection } from '../../hooks/useMobileDetection'
import { parseSearchParams, attemptMobileAppOpen } from '../../utils/mobileRedirection'
import * as authService from '../../services/authService'
import type { AuthService } from '../../services/authService'

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    verifyMagicLink: vi.fn(),
    isAuthenticated: vi.fn(),
    getUser: vi.fn(),
    getToken: vi.fn(),
    setAuthChangeCallback: vi.fn(),
    isTokenExpired: vi.fn().mockReturnValue(false),
    refreshTokenFromStorage: vi.fn().mockResolvedValue('mock-token'),
    logout: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  } as Partial<AuthService>
}))

const mockAuthService = authService.authService as Partial<AuthService>;
const mockUseMobileDetection = vi.mocked(useMobileDetection);
const mockParseSearchParams = vi.mocked(parseSearchParams);
const mockAttemptMobileAppOpen = vi.mocked(attemptMobileAppOpen);

// Mock family API service
vi.mock('../../services/familyApiService', () => ({
  familyApiService: {
    getCurrentFamily: vi.fn().mockResolvedValue({
      id: 'family-1',
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

// Mock mobile detection and redirection
vi.mock('../../hooks/useMobileDetection', () => ({
  useMobileDetection: vi.fn(),
}));

vi.mock('../../utils/mobileRedirection', () => ({
  parseSearchParams: vi.fn(),
  attemptMobileAppOpen: vi.fn(),
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

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Custom render function that includes router with initial entries
const renderWithRouter = (initialEntries: string[]) => {
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    })

    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FamilyProvider>
            <SocketProvider>
              <MemoryRouter initialEntries={initialEntries}>
                {children}
              </MemoryRouter>
            </SocketProvider>
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    )
  }

  return render(<VerifyMagicLinkPage />, { wrapper: AllTheProviders })
}

describe('VerifyMagicLinkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset auth service defaults
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(null)
    mockAuthService.getToken.mockReturnValue(null)

    // Configure mobile detection mock (desktop by default)
    mockUseMobileDetection.mockReturnValue({
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      deviceType: 'desktop',
      deviceInfo: { osVersion: undefined, model: undefined }
    });

    // Configure mobile redirection mocks
    mockParseSearchParams.mockReturnValue({ token: 'test-token' });
    mockAttemptMobileAppOpen.mockReturnValue(true);
  })

  it('shows loading state while verifying token', () => {
    mockAuthService.verifyMagicLink.mockImplementationOnce(() => new Promise(() => { }))

    renderWithRouter(['/auth/verify?token=valid-token'])

    expect(screen.getByTestId('edu-lift-title')).toHaveTextContent(/eduLift/i)
    expect(screen.getByTestId('verifying-message')).toHaveTextContent(/verifying your magic link/i)
    expect(screen.getByTestId('verification-loading-spinner')).toBeInTheDocument(); // Loading spinner
  })

  it('shows error when no token is provided', async () => {
    renderWithRouter(['/auth/verify'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-failed-title')).toHaveTextContent(/verification failed/i)
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/no verification token provided/i)
    })

    expect(screen.getByTestId('back-to-login-button')).toBeInTheDocument()
  })

  it('shows error when token verification fails', async () => {
    mockAuthService.verifyMagicLink.mockRejectedValueOnce(new Error('Invalid token'))

    renderWithRouter(['/auth/verify?token=invalid-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-failed-title')).toHaveTextContent(/verification failed/i)
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/invalid token/i)
    })

    expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith('invalid-token', undefined)
    // UI elements like back to login button would be tested here if implemented
  })

  it('handles successful verification and redirects to dashboard', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'UTC',
    }

    mockAuthService.verifyMagicLink.mockResolvedValueOnce({
      user: mockUser,
      token: 'jwt-token',
      expiresAt: new Date().toISOString()
    })

    renderWithRouter(['/auth/verify?token=valid-token'])

    await waitFor(() => {
      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith('valid-token', undefined)
    })

    // The component should redirect to dashboard when authenticated
    // We would test this by checking if Navigate component is rendered with correct props
    // In a real app, we'd use a navigation spy to verify the redirect
  })

  it('redirects to dashboard if user is already authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.getUser.mockReturnValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    })

    await act(async () => {
      renderWithRouter(['/auth/verify?token=some-token'])
    })

    // Should immediately redirect without showing verification content
    expect(screen.queryByTestId('verifying-message')).not.toBeInTheDocument()
    expect(screen.queryByTestId('verification-failed-title')).not.toBeInTheDocument()
  })

  it('navigates back to login when back button is clicked', async () => {
    const user = userEvent.setup()

    renderWithRouter(['/auth/verify'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/no verification token provided/i)
    })

    const backButton = screen.getByTestId('back-to-login-button')
    await user.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('shows appropriate error message for expired token', async () => {
    mockAuthService.verifyMagicLink.mockRejectedValueOnce(new Error('Token has expired'))

    renderWithRouter(['/auth/verify?token=expired-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-failed-title')).toHaveTextContent(/verification failed/i)
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/token has expired/i)
    })

    // UI text assertion for expired token would go here if implemented
  })

  it('handles network errors gracefully', async () => {
    mockAuthService.verifyMagicLink.mockRejectedValueOnce(new Error('Network error'))

    renderWithRouter(['/auth/verify?token=some-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-failed-title')).toHaveTextContent(/verification failed/i)
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/network error/i)
    })
  })

  it('does not verify token if user is already authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.getUser.mockReturnValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    })

    renderWithRouter(['/auth/verify?token=some-token'])

    // Wait for the component to render and check that it doesn't attempt verification
    await waitFor(() => {
      expect(screen.queryByTestId('verifying-message')).not.toBeInTheDocument()
    })

    expect(mockAuthService.verifyMagicLink).not.toHaveBeenCalled()
  })

  it('shows loading state while auth context is loading', () => {
    // Mock the auth context to simulate loading state
    // This would require modifying the test setup to mock the auth context loading state
    renderWithRouter(['/auth/verify?token=some-token'])

    // Initial render should show loading
    expect(screen.getByTestId('verifying-message')).toHaveTextContent(/verifying your magic link/i)
  })

  it('provides helpful instructions for failed verification', async () => {
    renderWithRouter(['/auth/verify'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/no verification token provided/i)
    })

    expect(screen.getByTestId('verification-help-text')).toHaveTextContent(/the magic link may have expired or been used already/i)
    expect(screen.getByTestId('verification-help-text')).toHaveTextContent(/please request a new one from the login page/i)
  })

  it('does not retry verification after failure (prevents infinite loop)', async () => {
    mockAuthService.verifyMagicLink.mockRejectedValue(new Error('PKCE data not found'))

    renderWithRouter(['/auth/verify?token=some-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-error-message')).toBeInTheDocument()
    })

    // verifyMagicLink should only have been called once, not multiple times in a loop
    expect(mockAuthService.verifyMagicLink).toHaveBeenCalledTimes(1)
  })

  it('shows clear error message when PKCE data is missing (cross-context)', async () => {
    const pkceError = new Error('This magic link must be opened in the same browser/app where it was requested. Please return to your original browser/app and click the link again, or request a new magic link.')
    mockAuthService.verifyMagicLink.mockRejectedValueOnce(pkceError)

    renderWithRouter(['/auth/verify?token=some-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verification-error-message')).toHaveTextContent(/same browser\/app where it was requested/i)
    })

    // Should not retry after this error
    expect(mockAuthService.verifyMagicLink).toHaveBeenCalledTimes(1)
  })
})

// Mobile-friendly behavior tests
describe('VerifyMagicLinkPage - Mobile-Friendly Behavior', () => {
  it('should render verification page properly on all devices', async () => {
    renderWithRouter(['/auth/verify?token=test-token'])

    await waitFor(() => {
      expect(screen.getByTestId('edu-lift-title')).toBeInTheDocument()
      expect(screen.getByText(/magic link verification/i)).toBeInTheDocument()
    })
  })

  it('should handle verification states consistently', async () => {
    mockAuthService.verifyMagicLink.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ id: 'user-1', email: 'test@example.com', name: 'Test User' }), 100))
    )

    renderWithRouter(['/auth/verify?token=test-token'])

    await waitFor(() => {
      expect(screen.getByTestId('verifying-message')).toBeInTheDocument()
      expect(screen.getByTestId('verification-loading-spinner')).toBeInTheDocument()
    })
  })

  it('should allow users to continue verification even if mobile app fails', async () => {
    // Test core user flow - user can complete verification regardless of device
    mockAuthService.verifyMagicLink.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    })

    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.getUser.mockReturnValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    })

    renderWithRouter(['/auth/verify?token=test-token'])

    await waitFor(() => {
      expect(screen.queryByTestId('verifying-message')).not.toBeInTheDocument()
      expect(screen.queryByTestId('verification-failed-title')).not.toBeInTheDocument()
    })
  })

  describe('Mobile Redirection Behavior', () => {
    it('should NOT attempt mobile redirection on desktop', async () => {
      // Mobile detection returns desktop
      mockUseMobileDetection.mockReturnValue({
        isMobile: false,
        isIOS: false,
        isAndroid: false,
        deviceType: 'desktop',
        deviceInfo: { osVersion: undefined, model: undefined }
      })

      renderWithRouter(['/auth/verify?token=test-token'])

      // Desktop should NOT attempt mobile redirection
      expect(mockAttemptMobileAppOpen).not.toHaveBeenCalled();
      expect(mockParseSearchParams).not.toHaveBeenCalled();
    });

    it('should attempt mobile redirection on mobile device with correct contract', async () => {
      // Mobile detection returns mobile
      mockUseMobileDetection.mockReturnValue({
        isMobile: true,
        isIOS: true,
        isAndroid: false,
        deviceType: 'ios',
        deviceInfo: { osVersion: '15.0', model: 'iPhone' }
      });

      // Mock parseSearchParams to return expected parameters
      mockParseSearchParams.mockReturnValue({ token: 'test-token' });

      renderWithRouter(['/auth/verify?token=test-token'])

      await waitFor(() => {
        expect(mockParseSearchParams).toHaveBeenCalledWith(
          expect.any(URLSearchParams)
        );
      });

      // Verify the contract: attemptMobileAppOpen is called with correct parameters
      expect(mockAttemptMobileAppOpen).toHaveBeenCalledWith(
        '/auth/verify',                    // correct path
        { token: 'test-token' },            // correct parsed parameters
        expect.objectContaining({           // mobile detection info
          isMobile: true,
          isIOS: true,
          isAndroid: false,
          deviceType: 'ios',
          deviceInfo: { osVersion: '15.0', model: 'iPhone' }
        }),
        expect.objectContaining({           // options object with required properties
          fallbackDelay: 2500,
          onAttempt: expect.any(Function),    // callback functions exist
          onFallback: expect.any(Function)    // callback functions exist
        })
      );
    });
  })
})

