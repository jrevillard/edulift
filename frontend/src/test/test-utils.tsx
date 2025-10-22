import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider } from '../contexts/AuthContext'
import { SocketProvider } from '../contexts/SocketContext'
import { FamilyProvider } from '../contexts/FamilyContext'

// Mock implementations for testing - removed unused mockAuthService

// Create a wrapper component that provides all necessary contexts
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // Create a new QueryClient for each test to avoid state pollution
  const queryClient = new QueryClient({
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <FamilyProvider>
            <MemoryRouter>
              {children}
            </MemoryRouter>
          </FamilyProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Helper function to create a test QueryClient
export const createTestQueryClient = () => {
  return new QueryClient({
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
}

// Mock user data for testing
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  timezone: 'UTC',
}

// Mock group data for testing
export const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  inviteCode: 'TEST123',
  familyId: 'family-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ownerFamily: {
    id: 'family-1',
    name: 'Test Family',
    members: [{
      user: mockUser,
      role: 'ADMIN'
    }]
  }
}

// Mock child data for testing
export const mockChild = {
  id: 'child-1',
  name: 'Test Child',
  age: 10,
  familyId: 'family-1',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

// Mock vehicle data for testing
export const mockVehicle = {
  id: 'vehicle-1',
  name: 'Test Vehicle',
  capacity: 5,
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

// Mock family data for testing
export const mockFamily = {
  id: 'family-1',
  name: 'Test Family',
  inviteCode: 'FAM123',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  members: [],
  children: [],
  vehicles: []
}

// Comprehensive API service mock factory
export const createMockApiService = () => ({
  // Children API
  getChildren: vi.fn().mockResolvedValue([mockChild]),
  createChild: vi.fn().mockResolvedValue(mockChild),
  updateChild: vi.fn().mockResolvedValue(mockChild),
  deleteChild: vi.fn().mockResolvedValue(undefined),
  
  // Groups API
  getUserGroups: vi.fn().mockResolvedValue([{
    userId: 'user-1',
    groupId: 'group-1',
    role: 'ADMIN' as const,
    joinedAt: '2024-01-01T00:00:00Z',
    group: {
      id: 'group-1',
      name: 'Test Group',
      admin: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com'
      },
      _count: {
        members: 1
      }
    }
  }]),
  createGroup: vi.fn().mockResolvedValue(mockGroup),
  updateGroup: vi.fn().mockResolvedValue(mockGroup),
  deleteGroup: vi.fn().mockResolvedValue(undefined),
  joinGroup: vi.fn().mockResolvedValue(mockGroup),
  leaveGroup: vi.fn().mockResolvedValue(undefined),
  
  // Vehicles API
  getVehicles: vi.fn().mockResolvedValue([mockVehicle]),
  createVehicle: vi.fn().mockResolvedValue(mockVehicle),
  updateVehicle: vi.fn().mockResolvedValue(mockVehicle),
  deleteVehicle: vi.fn().mockResolvedValue(undefined),
  
  // Dashboard API
  getDashboardStats: vi.fn().mockResolvedValue({
    groups: 1,
    children: 1,
    vehicles: 1,
    thisWeekTrips: 0,
    trends: {
      groups: { value: 'None', direction: 'neutral', period: 'current' },
      children: { value: 'None', direction: 'neutral', period: 'current' },
      vehicles: { value: 'None', direction: 'neutral', period: 'current' },
      trips: { value: 'None', direction: 'neutral', period: 'this week' }
    }
  }),
  getDashboardWeeklySchedule: vi.fn().mockResolvedValue({
    upcomingTrips: [],
    weekDates: {
      start: '2024-01-01',
      end: '2024-01-07',
      days: []
    }
  }),
  getTodaySchedule: vi.fn().mockResolvedValue({ upcomingTrips: [] }),
  getRecentActivity: vi.fn().mockResolvedValue({ activities: [] }),
  
  // Schedule API
  getWeeklySchedule: vi.fn().mockResolvedValue({
    trips: [],
    weekDates: {
      start: '2024-01-01',
      end: '2024-01-07',
      days: []
    }
  }),
  getScheduleSlotDetails: vi.fn().mockResolvedValue({
    id: 'slot-1',
    groupId: 'group-1',
    day: 'MONDAY',
    time: '08:00',
    week: '2024-01',
    childAssignments: [],
    vehicleAssignments: [],
    totalCapacity: 0,
    availableSeats: 0
  }),
  assignChildToScheduleSlot: vi.fn().mockResolvedValue(undefined),
  
  // Group members API
  getGroupFamilies: vi.fn().mockResolvedValue([]),
  inviteGroupMember: vi.fn().mockResolvedValue(undefined),
  updateGroupMemberRole: vi.fn().mockResolvedValue(undefined),
  removeGroupMember: vi.fn().mockResolvedValue(undefined),
  
  // Default catch-all for any missing methods
  [Symbol.for('defaultMethod')]: vi.fn().mockResolvedValue(undefined)
})

// Family API service mock factory
export const createMockFamilyApiService = () => ({
  getCurrentFamily: vi.fn().mockResolvedValue(mockFamily),
  getUserPermissions: vi.fn().mockResolvedValue({
    canManageFamily: true,
    canInviteChildren: true,
    canManageVehicles: true,
    canCreateGroups: true,
  }),
  createFamily: vi.fn().mockResolvedValue(mockFamily),
  joinFamily: vi.fn().mockResolvedValue(mockFamily),
  updateFamilyName: vi.fn().mockResolvedValue(mockFamily),
  leaveFamily: vi.fn().mockResolvedValue(undefined),
  inviteMember: vi.fn().mockResolvedValue(undefined),
  updateMemberRole: vi.fn().mockResolvedValue(undefined),
  removeMember: vi.fn().mockResolvedValue(undefined),
  generateInviteCode: vi.fn().mockResolvedValue('FAM123'),
  getPendingInvitations: vi.fn().mockResolvedValue([]),
  cancelInvitation: vi.fn().mockResolvedValue(undefined),
  validateInviteCode: vi.fn().mockResolvedValue({
    valid: true,
    family: mockFamily
  }),
})

// Auth service mock factory
export const createMockAuthService = () => ({
  login: vi.fn().mockResolvedValue({ user: mockUser, token: 'mock-token' }),
  verifyMagicLink: vi.fn().mockResolvedValue({ user: mockUser, token: 'mock-token' }),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshToken: vi.fn().mockResolvedValue({ user: mockUser, token: 'new-token' }),
  refreshTokenFromStorage: vi.fn().mockResolvedValue('mock-token'),
  setAuthChangeCallback: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(true),
  getUser: vi.fn().mockReturnValue(mockUser),
  getToken: vi.fn().mockReturnValue('mock-token'),
  isTokenExpired: vi.fn().mockReturnValue(false),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue({ user: mockUser, token: 'mock-token' }),
})

// Connection store mock factory
export const createMockConnectionStore = () => ({
  apiStatus: 'connected' as const,
  isConnected: true,
  hasConnectionIssues: vi.fn(() => false),
  setApiStatus: vi.fn(),
  setConnected: vi.fn(),
  getState: vi.fn(() => ({
    apiStatus: 'connected' as const,
    isConnected: true,
    hasConnectionIssues: vi.fn(() => false),
    setApiStatus: vi.fn(),
    setConnected: vi.fn()
  }))
})

// Family context mock factory
export const createMockFamilyContext = () => ({
  family: mockFamily,
  isLoading: false,
  error: null,
  refreshFamily: vi.fn().mockResolvedValue(undefined),
  createFamily: vi.fn().mockResolvedValue(mockFamily),
  joinFamily: vi.fn().mockResolvedValue(mockFamily),
  updateFamilyName: vi.fn().mockResolvedValue(mockFamily),
  leaveFamily: vi.fn().mockResolvedValue(undefined),
  inviteMember: vi.fn().mockResolvedValue(undefined),
  updateMemberRole: vi.fn().mockResolvedValue(undefined),
  removeMember: vi.fn().mockResolvedValue(undefined),
  generateInviteCode: vi.fn().mockResolvedValue('FAM123'),
  cancelInvitation: vi.fn().mockResolvedValue(undefined),
  getPendingInvitations: vi.fn().mockResolvedValue([]),
})