import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from '../AuthContext'
import * as authService from '../../services/authService'
import { mockUser } from '../../test/test-utils'

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    isTokenExpired: vi.fn(),
    getUser: vi.fn(),
    getToken: vi.fn(),
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    setAuthChangeCallback: vi.fn(),
  },
}))

const mockAuthService = vi.mocked(authService.authService)

// Create a wrapper component for testing
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage
    localStorage.clear()
  })

  it('provides initial unauthenticated state', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('initializes with authenticated user if token is valid', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.isTokenExpired.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(mockUser)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('refreshes token if expired but present', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue('expired-token')
    mockAuthService.refreshToken.mockResolvedValueOnce(undefined)
    mockAuthService.getUser.mockReturnValue(mockUser)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(mockAuthService.refreshToken).toHaveBeenCalled()
    expect(result.current.user).toEqual(mockUser)
  })

  it('clears auth if token refresh fails', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue('expired-token')
    mockAuthService.refreshToken.mockRejectedValueOnce(new Error('Refresh failed'))
    mockAuthService.logout.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(mockAuthService.logout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('handles login successfully without name or invite code', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.login('test@example.com')
    })
    
    expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith('test@example.com', undefined)
  })

  it('handles login successfully with name only', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.login('test@example.com', 'Test User')
    })
    
    expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith('test@example.com', { name: 'Test User' })
  })

  it('handles login successfully with invite code only', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.login('test@example.com', undefined, 'ABC123')
    })
    
    expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith('test@example.com', { inviteCode: 'ABC123' })
  })

  it('handles login successfully with both name and invite code', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.requestMagicLink.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.login('test@example.com', 'Test User', 'ABC123')
    })
    
    expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith('test@example.com', { name: 'Test User', inviteCode: 'ABC123' })
  })

  it('handles login errors', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.requestMagicLink.mockRejectedValueOnce(new Error('Login failed'))
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await expect(
      act(async () => {
        await result.current.login('test@example.com', 'Test User')
      })
    ).rejects.toThrow('Login failed')
  })

  it('handles magic link verification successfully', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.verifyMagicLink.mockResolvedValueOnce({
      user: mockUser,
      token: 'valid-token',
      expiresAt: new Date().toISOString()
    })
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await act(async () => {
      await result.current.verifyMagicLink('magic-token')
    })
    
    expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith('magic-token', undefined)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles magic link verification errors', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)
    mockAuthService.getToken.mockReturnValue(null)
    mockAuthService.verifyMagicLink.mockRejectedValueOnce(new Error('Verification failed'))
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    await expect(
      act(async () => {
        await result.current.verifyMagicLink('invalid-token')
      })
    ).rejects.toThrow('Verification failed')
  })

  it('handles logout successfully', async () => {
    // Start with authenticated state
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.isTokenExpired.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(mockUser)
    mockAuthService.logout.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })
    
    await act(async () => {
      await result.current.logout()
    })
    
    expect(mockAuthService.logout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('clears user state even if logout fails', async () => {
    // Start with authenticated state
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.isTokenExpired.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(mockUser)
    mockAuthService.logout.mockRejectedValueOnce(new Error('Logout failed'))
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })
    
    await act(async () => {
      await result.current.logout()
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('handles token refresh successfully', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.isTokenExpired.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(mockUser)
    mockAuthService.refreshToken.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })
    
    await act(async () => {
      await result.current.refreshToken()
    })
    
    expect(mockAuthService.refreshToken).toHaveBeenCalled()
  })

  it('logs out user if token refresh fails', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true)
    mockAuthService.isTokenExpired.mockReturnValue(false)
    mockAuthService.getUser.mockReturnValue(mockUser)
    mockAuthService.refreshToken.mockRejectedValueOnce(new Error('Refresh failed'))
    mockAuthService.logout.mockResolvedValueOnce(undefined)
    
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })
    
    await expect(
      act(async () => {
        await result.current.refreshToken()
      })
    ).rejects.toThrow('Refresh failed')
    
    // Verify logout was called (the main behavior we care about)
    expect(mockAuthService.logout).toHaveBeenCalled()
  })

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })
})