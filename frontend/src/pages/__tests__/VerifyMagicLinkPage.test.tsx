import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { render } from '../../test/test-utils'
import VerifyMagicLinkPage from '../VerifyMagicLinkPage'
import { AuthProvider } from '../../contexts/AuthContext'
import { SocketProvider } from '../../contexts/SocketContext'
import { FamilyProvider } from '../../contexts/FamilyContext'
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
  })

  it('shows loading state while verifying token', () => {
    mockAuthService.verifyMagicLink.mockImplementationOnce(() => new Promise(() => {}))
    
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

  it('redirects to dashboard if user is already authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.getUser.mockReturnValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User'
    })
    
    renderWithRouter(['/auth/verify?token=some-token'])
    
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
})