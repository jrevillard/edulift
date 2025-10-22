import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SocketProvider, useSocket } from '../SocketContext'
import { AuthProvider } from '../AuthContext'
import { SOCKET_EVENTS } from '../../shared/events'
import { mockUser } from '../../test/test-utils'

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'mock-socket-id',
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Mock the authentication context
vi.mock('../AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: vi.fn(),
}))

// Mock the connection store
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: vi.fn(() => ({
    setWsStatus: vi.fn(),
  })),
}))

// Import the mocked functions
import { useAuth } from '../AuthContext'
import { useConnectionStore } from '@/stores/connectionStore'
import { io } from 'socket.io-client'

const mockUseAuth = vi.mocked(useAuth)
const mockUseConnectionStore = vi.mocked(useConnectionStore)
const mockIo = vi.mocked(io)

describe('SocketContext', () => {
  let queryClient: QueryClient
  let mockSetWsStatus: any
  let eventHandlers: Record<string, any>

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    })

    // Mock the connection store
    mockSetWsStatus = vi.fn()
    mockUseConnectionStore.mockReturnValue({
      setWsStatus: mockSetWsStatus,
    })

    // Reset localStorage
    localStorage.clear()
    localStorage.setItem('authToken', 'mock-token')

    // Reset event handlers
    eventHandlers = {}
    mockSocket.on.mockImplementation((event: string, handler: any) => {
      eventHandlers[event] = handler
    })

    // Reset all mocks
    vi.clearAllMocks()
    mockIo.mockReturnValue(mockSocket)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = ({ authenticated = true } = {}) => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: authenticated,
      user: authenticated ? mockUser : null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn(),
    })

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    )
  }

  it('should initialize with no socket when user is not authenticated', () => {
    const wrapper = createWrapper({ authenticated: false })
    const { result } = renderHook(() => useSocket(), { wrapper })

    expect(result.current.socket).toBeNull()
    expect(result.current.isConnected).toBe(false)
  })

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useSocket())
    }).toThrow('useSocket must be used within a SocketProvider')
  })

  it('should create socket connection when user is authenticated', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('connecting')
    expect(mockIo).toHaveBeenCalled()
  })

  it('should handle socket connection events', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers.connect?.()
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('connected')
    expect(result.current.isConnected).toBe(true)
  })

  it('should handle socket disconnection events', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers.disconnect?.('io server disconnect')
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('disconnected', 'Server disconnected the connection')
    expect(result.current.isConnected).toBe(false)
  })

  it('should handle different disconnect reasons', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    // Client disconnect
    await act(async () => {
      eventHandlers.disconnect?.('io client disconnect')
    })
    expect(mockSetWsStatus).toHaveBeenCalledWith('disconnected')

    // Connection lost
    await act(async () => {
      eventHandlers.disconnect?.('transport close')
    })
    expect(mockSetWsStatus).toHaveBeenCalledWith('disconnected', 'Connection lost. Attempting to reconnect...')
  })

  it('should handle socket connection errors', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers.connect_error?.(new Error('Connection failed'))
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('error', 'Unable to connect to real-time updates')
  })

  it('should handle authentication errors', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers.connect_error?.(new Error('Unauthorized'))
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('error', 'Authentication failed. Please try logging in again.')
  })

  it('should handle timeout errors', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers.connect_error?.(new Error('timeout'))
    })

    expect(mockSetWsStatus).toHaveBeenCalledWith('error', 'Connection timeout. Please check your internet connection.')
  })

  it('should handle reconnection events', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    // Reconnection attempt
    await act(async () => {
      eventHandlers.reconnect_attempt?.(2)
    })
    expect(mockSetWsStatus).toHaveBeenCalledWith('connecting', 'Reconnecting... (attempt 2)')

    // Successful reconnection
    await act(async () => {
      eventHandlers.reconnect?.(3)
    })
    expect(mockSetWsStatus).toHaveBeenCalledWith('connected')

    // Reconnection failure
    await act(async () => {
      eventHandlers.reconnect_failed?.()
    })
    expect(mockSetWsStatus).toHaveBeenCalledWith('error', 'Failed to reconnect. Please refresh the page to try again.')
  })

  it('should invalidate queries on schedule events', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_UPDATED]?.({ groupId: 'group-1' })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['timeslots', 'group-1'] })
  })

  it('should invalidate queries on schedule slot events', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED]?.({ 
        groupId: 'group-1', 
        scheduleSlotId: 'slot-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot', 'slot-1'] })
  })

  it('should remove queries on schedule slot deleted events', async () => {
    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries')
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_SLOT_DELETED]?.({ 
        groupId: 'group-1', 
        scheduleSlotId: 'slot-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'group-1'] })
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule-slot', 'slot-1'] })
  })

  it('should handle child management events for current user', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.CHILD_ADDED]?.({ 
        userId: mockUser.id, 
        familyId: 'family-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['children'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['recent-activity', 'family-1'] })
  })

  it('should not handle child management events for other users', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.CHILD_ADDED]?.({ 
        userId: 'other-user-id', 
        familyId: 'family-1' 
      })
    })

    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('should handle vehicle management events for current user', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.VEHICLE_UPDATED]?.({ 
        userId: mockUser.id, 
        familyId: 'family-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['recent-activity', 'family-1'] })
  })

  it('should handle group management events', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.GROUP_UPDATED]?.({ 
        groupId: 'group-1', 
        familyId: 'family-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['groups'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['group', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['recent-activity', 'family-1'] })
  })

  it('should handle family management events', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.FAMILY_MEMBER_JOINED]?.({ 
        familyId: 'family-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['recent-activity', 'family-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['families'] })
  })

  it('should handle legacy event support', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_UPDATED]?.({ 
        groupId: 'group-1' 
      })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['weekly-schedule', 'group-1'] })
  })

  it('should handle notification events', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.NOTIFICATION]?.({ 
        message: 'Test notification' 
      })
    })

    expect(consoleLogSpy).toHaveBeenCalledWith('🔔 NOTIFICATION:', { message: 'Test notification' })
    
    consoleLogSpy.mockRestore()
  })

  it('should handle conflict detection events', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.CONFLICT_DETECTED]?.({ 
        conflict: 'Test conflict' 
      })
    })

    expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ CONFLICT_DETECTED:', { conflict: 'Test conflict' })
    
    consoleLogSpy.mockRestore()
  })

  it('should handle capacity warning events', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_WARNING]?.({ 
        scheduleSlotId: 'slot-1' 
      })
    })

    expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ CAPACITY_WARNING:', { scheduleSlotId: 'slot-1' })
    
    consoleLogSpy.mockRestore()
  })

  it('should cleanup socket on unmount', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result, unmount } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    unmount()

    expect(mockSocket.close).toHaveBeenCalled()
  })

  it('should cleanup socket when user becomes unauthenticated', async () => {
    const wrapper = createWrapper({ authenticated: true })
    const { result, rerender } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    // Change auth state to unauthenticated
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      verifyMagicLink: vi.fn(),
      refreshToken: vi.fn(),
    })

    rerender()

    await waitFor(() => {
      expect(mockSocket.close).toHaveBeenCalled()
    })
  })

  it('should handle multiple event types correctly', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    
    const wrapper = createWrapper({ authenticated: true })
    const { result } = renderHook(() => useSocket(), { wrapper })

    await waitFor(() => {
      expect(result.current.socket).not.toBeNull()
    })

    // Test multiple events
    await act(async () => {
      eventHandlers[SOCKET_EVENTS.SCHEDULE_SLOT_CREATED]?.({ groupId: 'group-1' })
      eventHandlers[SOCKET_EVENTS.MEMBER_JOINED]?.({ groupId: 'group-1', familyId: 'family-1' })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'group-1'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['groups'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['user-groups'] })
  })
})