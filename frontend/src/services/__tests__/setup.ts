// Test setup for API client tests
import { vi } from 'vitest';

// Mock data for testing
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  timezone: 'UTC',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockChild = {
  id: 'child-1',
  name: 'Test Child',
  age: 10,
  familyId: 'family-1',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockVehicle = {
  id: 'vehicle-1',
  name: 'Test Vehicle',
  capacity: 5,
  familyId: 'family-1',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockFamily = {
  id: 'family-1',
  name: 'Test Family',
  inviteCode: 'FAM123',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  members: [{
    id: 'user-1',
    role: 'ADMIN',
    user: mockUser,
    familyId: 'family-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }],
  children: [mockChild],
  vehicles: [mockVehicle]
};

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  description: 'Test Description',
  inviteCode: 'TEST123',
  familyId: 'family-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  userRole: 'ADMIN' as const,
  joinedAt: '2024-01-01T00:00:00Z',
  ownerFamily: {
    id: 'family-1',
    name: 'Test Family',
  },
  familyCount: 3,
  scheduleCount: 2,
  _count: {
    members: 1,
    families: 3,
    schedules: 2
  }
};

const mockGroupFamilies = [
  {
    id: 'family-1',
    name: 'Test Family',
    role: 'OWNER' as const,
    joinedAt: '2024-01-01T00:00:00Z',
    inviteCode: 'FAM123',
    memberCount: 2,
    _count: {
      members: 1,
      children: 1,
      vehicles: 1
    }
  },
  {
    id: 'family-2',
    name: 'Another Family',
    role: 'MEMBER' as const,
    joinedAt: '2024-01-02T00:00:00Z',
    inviteCode: 'FAM456',
    memberCount: 3,
    _count: {
      members: 1,
      children: 2,
      vehicles: 1
    }
  }
];

// Comprehensive OpenAPI client mock implementation
const createMockClient = () => {
  const mockClient = {
    use: vi.fn(),
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
    PUT: vi.fn(),
  };

  // Setup comprehensive mock implementations based on API paths
  mockClient.GET.mockImplementation((path: string, options?: { params?: Record<string, unknown> }) => {

    switch (path) {
      // Groups endpoints
      case '/api/v1/groups':
        return Promise.resolve({
          data: { data: [mockGroup], success: true, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
          error: undefined
        });
      case '/api/v1/groups/my-groups':
        return Promise.resolve({
          data: { data: [mockGroup], success: true, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
          error: undefined
        });
      case '/api/v1/groups/{groupId}':
        return Promise.resolve({
          data: { data: mockGroup, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/families':
        return Promise.resolve({
          data: { data: mockGroupFamilies, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/invitations':
        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/schedule-slots':
        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/schedule-config':
        return Promise.resolve({
          data: {
            data: {
              id: 'config-1',
              groupId: 'group-1',
              scheduleHours: {
                'MONDAY': ['07:00', '07:30', '08:00'],
                'TUESDAY': ['07:00', '07:30', '08:00'],
                'WEDNESDAY': ['07:00', '07:30', '08:00'],
                'THURSDAY': ['07:00', '07:30', '08:00'],
                'FRIDAY': ['07:00', '07:30', '08:00']
              },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              isDefault: false
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/schedule-config/time-slots':
        return Promise.resolve({
          data: {
            data: {
              groupId: 'group-1',
              weekday: 'MONDAY',
              timeSlots: ['07:00', '07:30', '08:00']
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/groups/schedule-config/default':
        return Promise.resolve({
          data: {
            data: {
              scheduleHours: {
                'MONDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'TUESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'WEDNESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'THURSDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'FRIDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30']
              },
              isDefault: true
            },
            success: true
          },
          error: undefined
        });

      // Family endpoints
      case '/api/v1/families/current':
        return Promise.resolve({
          data: { data: mockFamily, success: true },
          error: undefined
        });
      case '/api/v1/families':
        return Promise.resolve({
          data: { data: [mockFamily], success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}':
        return Promise.resolve({
          data: { data: mockFamily, success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/permissions':
        return Promise.resolve({
          data: {
            data: {
              canManageFamily: true,
              canInviteMembers: true,
              canCreateGroups: true,
              canManageVehicles: true,
              canManageChildren: true
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/families/{familyId}/children':
        return Promise.resolve({
          data: { data: [mockChild], success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/vehicles':
        return Promise.resolve({
          data: { data: [mockVehicle], success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/members':
        return Promise.resolve({
          data: { data: mockFamily.members, success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/invitations':
        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });

      // Children endpoints
      case '/api/v1/children':
        return Promise.resolve({
          data: { data: [mockChild], success: true },
          error: undefined
        });
      case '/api/v1/children/{childId}':
        return Promise.resolve({
          data: { data: mockChild, success: true },
          error: undefined
        });

      // Vehicles endpoints
      case '/api/v1/vehicles':
        return Promise.resolve({
          data: { data: [mockVehicle], success: true },
          error: undefined
        });
      case '/api/v1/vehicles/{vehicleId}':
        return Promise.resolve({
          data: { data: mockVehicle, success: true },
          error: undefined
        });

      // Schedule endpoints
      case '/api/v1/schedule-slots/{scheduleSlotId}':
        return Promise.resolve({
          data: {
            data: {
              id: options?.params?.scheduleSlotId || 'slot-1',
              groupId: 'group-1',
              day: 'MONDAY',
              time: '08:00',
              week: '2024-01',
              childAssignments: [],
              vehicleAssignments: [],
              totalCapacity: 0,
              availableSeats: 0
            },
            success: true
          },
          error: undefined
        });

      // Dashboard endpoints
      case '/api/v1/dashboard/stats':
        return Promise.resolve({
          data: {
            data: {
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
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/dashboard/weekly':
        return Promise.resolve({
          data: {
            data: {
              days: [
                {
                  date: '2024-01-15', // Monday
                  dayName: 'Monday',
                  transports: [
                    {
                      id: 'transport-1',
                      time: '08:00',
                      groupName: 'Test Group',
                      groupId: 'group-1',
                      scheduleSlotId: 'slot-1',
                      vehicleAssignmentSummaries: [
                        {
                          vehicleId: 'vehicle-1',
                          vehicleName: 'Test Vehicle',
                          vehicleType: 'CAR',
                          driverName: 'Test Driver',
                          capacity: 5,
                          assignedChildren: [
                            { id: 'child-1', name: 'Test Child', age: 10 }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/dashboard/weekly-schedule':
        return Promise.resolve({
          data: {
            data: {
              upcomingTrips: [],
              weekDates: {
                start: '2024-01-01',
                end: '2024-01-07',
                days: []
              }
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/dashboard/today-schedule':
        return Promise.resolve({
          data: {
            data: {
              upcomingTrips: [],
              today: '2024-01-01'
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/dashboard/recent-activity':
        return Promise.resolve({
          data: {
            data: {
              activities: []
            },
            success: true
          },
          error: undefined
        });

      // Auth endpoints
      case '/auth/me':
        return Promise.resolve({
          data: { data: mockUser, success: true },
          error: undefined
        });

      default:
        // Return empty data for unimplemented endpoints
        return Promise.resolve({
          data: { data: null, success: false },
          error: { message: `Not implemented in test mock: ${path}` }
        });
    }
  });

  mockClient.POST.mockImplementation((path: string) => {
    switch (path) {
      case '/api/v1/groups/{groupId}/schedule-config/reset':
        return Promise.resolve({
          data: {
            data: {
              id: 'config-1',
              groupId: 'group-1',
              scheduleHours: {
                'MONDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'TUESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'WEDNESDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'THURSDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30'],
                'FRIDAY': ['07:00', '07:30', '08:00', '08:30', '15:00', '15:30', '16:00', '16:30']
              },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
              isDefault: true
            },
            success: true
          },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/invite-family':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/leave':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/invite':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/children':
        return Promise.resolve({
          data: { data: mockChild, success: true },
          error: undefined
        });
      case '/api/v1/vehicles':
        return Promise.resolve({
          data: { data: mockVehicle, success: true },
          error: undefined
        });
      case '/api/v1/schedule-slots/{scheduleSlotId}/assign-child':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/schedule-slots/{scheduleSlotId}/assign-vehicle':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      default:
        return Promise.resolve({
          data: { data: null, success: true },
          error: undefined
        });
    }
  });

  mockClient.PATCH.mockImplementation((path: string) => {
    switch (path) {
      case '/api/v1/groups/{groupId}':
        return Promise.resolve({
          data: { data: { ...mockGroup, name: 'Updated Group' }, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/families/{familyId}/role':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/children/{childId}':
        return Promise.resolve({
          data: { data: mockChild, success: true },
          error: undefined
        });
      case '/api/v1/vehicles/{vehicleId}':
        return Promise.resolve({
          data: { data: mockVehicle, success: true },
          error: undefined
        });
      default:
        return Promise.resolve({
          data: { data: null, success: true },
          error: undefined
        });
    }
  });

  mockClient.DELETE.mockImplementation((path: string) => {

    switch (path) {
      case '/api/v1/groups/{groupId}':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/families/{familyId}':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/groups/{groupId}/invitations/{invitationId}':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/children/{childId}':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/vehicles/{vehicleId}':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      case '/api/v1/families/{familyId}/leave':
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      default:
        return Promise.resolve({
          data: { data: null, success: true },
          error: undefined
        });
    }
  });

  mockClient.PUT.mockImplementation((path: string) => {
    switch (path) {
      case '/api/v1/groups/{groupId}/schedule-config':
        return Promise.resolve({
          data: {
            data: {
              id: 'config-1',
              groupId: 'group-1',
              scheduleHours: {
                'MONDAY': ['07:00', '07:30', '08:00'],
                'TUESDAY': ['07:00', '07:30', '08:00'],
                'WEDNESDAY': ['07:00', '07:30', '08:00'],
                'THURSDAY': ['07:00', '07:30', '08:00'],
                'FRIDAY': ['07:00', '07:30', '08:00']
              },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
              isDefault: false
            },
            success: true
          },
          error: undefined
        });
      default:
        return Promise.resolve({
          data: { data: null, success: true },
          error: undefined
        });
    }
  });

  return mockClient;
};

// Create and export the mock client
const mockClient = createMockClient();

// Mock openapi-fetch to return our comprehensive mock client
vi.mock('openapi-fetch', () => ({
  default: vi.fn(() => mockClient),
}));

// Export for potential use in individual test files
export { mockClient, createMockClient };

// Global test environment setup
Object.defineProperty(window, '__TEST_ENVIRONMENT__', {
  value: true,
  writable: true,
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress specific log messages during tests
  // log: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};