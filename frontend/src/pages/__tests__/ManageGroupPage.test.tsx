import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ManageGroupPage from '../ManageGroupPage';
import { api } from '../../services/api';
import type { GroupFamily } from '../../types/api';
import { mockClient } from '../../services/__tests__/setup';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'group-1' }),
  };
});

// Note: API client is mocked globally in src/services/__tests__/setup.ts

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

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

// Mock auth service to ensure user is authenticated
vi.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getUser: vi.fn().mockReturnValue({ id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' }),
    getToken: vi.fn().mockReturnValue('mock-token'),
    setAuthChangeCallback: vi.fn(),
    isTokenExpired: vi.fn().mockReturnValue(false),
    logout: vi.fn(),
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    refreshToken: vi.fn(),
    refreshTokenFromStorage: vi.fn().mockResolvedValue(true),
  },
}));

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
      canInviteMembers: true,
      canCreateGroups: true,
    }),
  },
}));

// Mock SocketContext to prevent connection attempts
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Note: OpenAPI client is mocked globally in setup.ts

const mockUserGroups = [
  {
    id: 'group-1',
    name: 'Test Group',
    description: 'Test Description',
    inviteCode: 'invite123',
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
      families: 3,
      schedules: 2,
      members: 1
    }
  },
];

const mockFamilies: GroupFamily[] = [
  {
    id: 'family-1',
    name: 'Test Family',
    role: 'OWNER',
    isMyFamily: true,
    canManage: false,
    admins: [{ name: 'Test Admin', email: 'admin@example.com' }],
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
    name: 'Member Family',
    role: 'MEMBER',
    isMyFamily: false,
    canManage: true,
    admins: [{ name: 'Test Member', email: 'member@example.com' }],
    joinedAt: '2024-01-02T00:00:00Z',
    inviteCode: 'FAM456',
    memberCount: 3,
    _count: {
      members: 1,
      children: 2,
      vehicles: 1
    }
  },
];

const mockOtherFamily: GroupFamily = {
  id: 'family-other',
  name: 'Other Family',
  role: 'MEMBER',
  isMyFamily: false,
  canManage: true,
  admins: [{ name: 'Other Admin', email: 'other@example.com' }],
  joinedAt: '2024-01-03T00:00:00Z',
  inviteCode: 'FAM789',
  memberCount: 2,
  _count: {
    members: 1,
    children: 1,
    vehicles: 1
  }
};

// Helper function to create standard GET mocks
const createStandardGetMocks = (userGroupsData = mockUserGroups, familiesData = mockFamilies) => {
  return (path: string, options?: any) => {
    const { params } = options || {};

    switch (path) {
      case '/groups/my-groups':
        console.log('🐛 API CALL: /groups/my-groups returning:', userGroupsData);
        return Promise.resolve({
          data: { data: userGroupsData, success: true, pagination: { page: 1, limit: 10, total: userGroupsData.length, totalPages: 1 } },
          error: undefined
        });
      case '/groups/{groupId}':
        if (params?.groupId === 'group-1') {
          console.log('🐛 API CALL: /groups/{groupId} returning:', userGroupsData[0]);
          return Promise.resolve({
            data: { data: userGroupsData[0], success: true },
            error: undefined
          });
        }
        break;
      case '/groups/{groupId}/families':
        if (params?.groupId === 'group-1') {
          console.log('🐛 API CALL: /groups/{groupId}/families returning:', familiesData);
          return Promise.resolve({
            data: { data: familiesData, success: true },
            error: undefined
          });
        }
        break;
      default:
        console.log('🐛 API CALL: Unhandled path:', path);
        // Let the global mock handle other cases
        break;
    }

    // Fall back to default global mock behavior
    return Promise.resolve({
      data: { data: [], success: true },
      error: undefined
    });
  };
};

describe('ManageGroupPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Use global mocks from setup.ts and override specific endpoints
    mockClient.GET.mockImplementation(createStandardGetMocks());

    // Setup POST mocks for group operations
    mockClient.POST.mockImplementation((path: string) => {
      switch (path) {
        case '/groups/{groupId}/leave':
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
        default:
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
      }
    });

    // Setup PATCH mocks for updating family roles
    mockClient.PATCH.mockImplementation((path: string, options?: any) => {
      const { params } = options || {};

      switch (path) {
        case '/groups/{groupId}/families/{familyId}/role':
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
        default:
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
      }
    });

    // Setup DELETE mocks for group operations
    mockClient.DELETE.mockImplementation((path: string, options?: any) => {
      const { params } = options || {};

      switch (path) {
        case '/groups/{groupId}':
          if (params?.groupId === 'group-1') {
            return Promise.resolve({
              data: { data: { success: true }, success: true },
              error: undefined
            });
          }
          break;
        case '/groups/{groupId}/invitations/{invitationId}':
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
        default:
          return Promise.resolve({
            data: { data: { success: true }, success: true },
            error: undefined
          });
      }

      return Promise.resolve({
        data: { data: { success: true }, success: true },
        error: undefined
      });
    });
  });

  describe('Basic Rendering', () => {
    it('renders loading state initially', async () => {
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/my-groups') {
          return Promise.resolve({
            data: { data: mockUserGroups, success: true, pagination: { page: 1, limit: 10, total: mockUserGroups.length, totalPages: 1 } },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return new Promise(() => {}); // Never resolves to keep loading state
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }
        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('renders group information correctly', async () => {
      render(<ManageGroupPage />);

      // Debug: Let's see what's actually rendered
      await waitFor(() => {
        const errorElement = screen.queryByTestId('ErrorState-Container-error');
        if (errorElement) {
          console.log('🐛 Error state found, DOM:', errorElement.innerHTML);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Heading-pageTitle')).toBeInTheDocument();
      });

      expect(screen.getByTestId('ManageGroupPage-Input-groupName')).toHaveValue('Test Group');
      expect(screen.getByTestId('ManageGroupPage-Label-ownerFamily')).toHaveTextContent('Owner Family');
      expect(screen.getByTestId('ManageGroupPage-Text-ownerFamilyName')).toHaveTextContent('Test Family');
      expect(screen.getByTestId('GroupFamilies-Title-header')).toHaveTextContent('Group Families (2)');
    });

    it('displays families list with correct information', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('GroupFamily-Text-name-family-1')).toHaveTextContent('Test Family');
      });

      expect(screen.getByTestId('GroupFamily-Badge-owner-family-1')).toHaveTextContent('Owner');
      expect(screen.getByTestId('GroupFamily-Text-name-family-2')).toHaveTextContent('Member Family');
      expect(screen.getByTestId('GroupFamily-Badge-member-family-2')).toHaveTextContent('Member');
    });

    it('navigates back to groups page when back button is clicked', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-backToGroups')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-backToGroups'));
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  describe('Admin Features', () => {
    it('shows admin-only features for admin users', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Title-dangerZone')).toHaveTextContent('Danger Zone');
      });

      // Should show delete group button
      expect(screen.getByTestId('ManageGroupPage-Button-deleteGroup')).toBeInTheDocument();
    });

    it('hides admin features for non-admin users', async () => {
      const nonAdminUserGroups = [
        {
          ...mockUserGroups[0],
          userRole: 'MEMBER' as const,
        },
      ];

      // Override the mock to return non-admin user groups
      mockClient.GET.mockImplementation(createStandardGetMocks(nonAdminUserGroups, mockFamilies));

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      // Should show danger zone for non-admins (with leave group)
      expect(screen.getByTestId('ManageGroupPage-Title-dangerZone')).toHaveTextContent('Danger Zone');

      // Should show leave group button for non-admins
      expect(screen.getByTestId('ManageGroupPage-Button-leaveGroup')).toBeInTheDocument();

      // Should not show delete group button
      expect(screen.queryByTestId('ManageGroupPage-Button-deleteGroup')).not.toBeInTheDocument();
    });
  });


  describe('Family Management', () => {
    it('shows family role badges correctly', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('GroupFamily-Text-name-family-1')).toHaveTextContent('Test Family');
      });

      // Check for role badges
      expect(screen.getByTestId('GroupFamily-Badge-owner-family-1')).toHaveTextContent('Owner');
      expect(screen.getByTestId('GroupFamily-Badge-member-family-2')).toHaveTextContent('Member');
    });

    it('updates family role successfully', async () => {
      // Override PATCH mock to return success message
      mockClient.PATCH.mockImplementation((path: string, options?: any) => {
        const { params, body } = options || {};

        if (path === '/groups/{groupId}/families/{familyId}/role') {
          return Promise.resolve({
            data: {
              data: { success: true, message: 'Family role updated successfully' },
              success: true
            },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('GroupFamily-Text-name-family-2')).toHaveTextContent('Member Family');
      });

      // Find the actions button for the family
      const actionsButton = screen.getByTestId('GroupFamily-Button-actions-family-2');
      await user.click(actionsButton);

      // Wait for dropdown menu to appear and click promote option
      await waitFor(() => {
        const promoteButton = screen.getByTestId('GroupFamily-Button-promote-family-2');
        expect(promoteButton).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('GroupFamily-Button-promote-family-2'));

      // Wait for confirmation dialog and confirm
      await waitFor(() => {
        expect(screen.getByText(/Change Family Role/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('ManageGroupPage-Button-confirmRoleChange');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockClient.PATCH).toHaveBeenCalledWith('/groups/{groupId}/families/{familyId}/role', {
          params: { groupId: 'group-1', familyId: 'family-2' },
          body: { role: 'ADMIN' }
        });
      });

      expect(screen.getByTestId('ManageGroupPage-Alert-successMessage')).toHaveTextContent('Family role updated successfully');
    });
  });

  describe('Group Deletion', () => {
    it('deletes group when admin confirms deletion', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-deleteGroup')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-deleteGroup'));

      // Confirm deletion in dialog
      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Text-deleteConfirmation')).toHaveTextContent(/Are you sure you want to delete/);
      });

      // First type the group name to enable the button
      const nameInput = screen.getByTestId('ManageGroupPage-Input-confirmGroupName');
      await user.type(nameInput, 'Test Group');

      await waitFor(() => {
        const confirmDeleteButton = screen.getByTestId('ManageGroupPage-Button-confirmDelete');
        expect(confirmDeleteButton).not.toBeDisabled();
        return user.click(confirmDeleteButton);
      });

      await waitFor(() => {
        expect(mockClient.DELETE).toHaveBeenCalledWith('/groups/{groupId}', {
          params: { groupId: 'group-1' }
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  describe('Leave Group Functionality', () => {
    it('shows leave group button for non-admin users', async () => {
      const nonAdminUserGroups = [
        {
          ...mockUserGroups[0],
          userRole: 'MEMBER' as const,
        },
      ];

      // Override the mock to return non-admin user groups
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        switch (path) {
          case '/groups/{groupId}':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: nonAdminUserGroups[0], success: true },
                error: undefined
              });
            }
            break;
          case '/groups/{groupId}/families':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: mockFamilies, success: true },
                error: undefined
              });
            }
            break;
          default:
            break;
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-leaveGroup')).toBeInTheDocument();
      });
    });

    it('allows non-admin user to leave group successfully', async () => {
      const nonAdminUserGroups = [
        {
          ...mockUserGroups[0],
          userRole: 'MEMBER' as const,
        },
      ];

      // Override mocks for non-admin scenario
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        switch (path) {
          case '/groups/{groupId}':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: nonAdminUserGroups[0], success: true },
                error: undefined
              });
            }
            break;
          case '/groups/{groupId}/families':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: mockFamilies, success: true },
                error: undefined
              });
            }
            break;
          default:
            break;
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-leaveGroup')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-leaveGroup'));

      // Confirm leaving in dialog
      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Text-leaveConfirmation')).toHaveTextContent(/Are you sure you want to leave/);
      });

      const confirmLeaveButton = screen.getByTestId('ManageGroupPage-Button-confirmLeave');
      await user.click(confirmLeaveButton);

      await waitFor(() => {
        expect(mockClient.POST).toHaveBeenCalledWith('/groups/{groupId}/leave', {
          params: { groupId: 'group-1' }
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });

    it('shows error when leave group fails', async () => {
      const nonAdminUserGroups = [
        {
          ...mockUserGroups[0],
          userRole: 'MEMBER' as const,
        },
      ];

      // Override mocks for non-admin scenario with error
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        switch (path) {
          case '/groups/{groupId}':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: nonAdminUserGroups[0], success: true },
                error: undefined
              });
            }
            break;
          case '/groups/{groupId}/families':
            if (params?.groupId === 'group-1') {
              return Promise.resolve({
                data: { data: mockFamilies, success: true },
                error: undefined
              });
            }
            break;
          default:
            break;
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      // Override POST mock to throw error
      mockClient.POST.mockImplementation((path: string) => {
        if (path === '/groups/{groupId}/leave') {
          return Promise.reject(new Error('Failed to leave group'));
        }
        return Promise.resolve({
          data: { data: { success: true }, success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-leaveGroup')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-leaveGroup'));

      await waitFor(() => {
        const confirmLeaveButton = screen.getByTestId('ManageGroupPage-Button-confirmLeave');
        return user.click(confirmLeaveButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Alert-errorMessage')).toHaveTextContent('Failed to leave group');
      });
    });

    it('does not show leave group button for admin users', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Title-dangerZone')).toHaveTextContent('Danger Zone');
      });

      expect(screen.queryByTestId('ManageGroupPage-Button-leaveGroup')).not.toBeInTheDocument();
    });
  });

  describe('Enhanced Delete Confirmation', () => {
    it('requires typing group name to enable delete button', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-deleteGroup')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-deleteGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Label-confirmName')).toHaveTextContent(/Type the group name to confirm/);
      });

      // Delete button should be disabled initially
      const confirmDeleteButton = screen.getByTestId('ManageGroupPage-Button-confirmDelete');
      expect(confirmDeleteButton).toBeDisabled();

      // Type group name
      const nameInput = screen.getByTestId('ManageGroupPage-Input-confirmGroupName');
      await user.type(nameInput, 'Test Group');

      // Delete button should now be enabled
      await waitFor(() => {
        expect(confirmDeleteButton).not.toBeDisabled();
      });
    });

    it('keeps delete button disabled if group name does not match', async () => {
      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Button-deleteGroup')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ManageGroupPage-Button-deleteGroup'));

      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Input-confirmGroupName')).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('ManageGroupPage-Input-confirmGroupName');
      await user.type(nameInput, 'Wrong Name');

      await waitFor(() => {
        const confirmDeleteButton = screen.getByTestId('ManageGroupPage-Button-confirmDelete');
        expect(confirmDeleteButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when families loading fails', async () => {
      // Override GET mock to throw error for families endpoint
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.reject(new Error('Failed to fetch families'));
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ErrorState-Container-error')).toBeInTheDocument();
      });
    });

  });


  describe('Invitation Management', () => {
    it('should call API to cancel invitation when cancel button is clicked', async () => {
      const mockFamilyWithInvitation: GroupFamily = {
        id: 'family-2',
        name: 'Cancel Test Family',
        role: 'PENDING',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Pending Admin', email: 'admin@pending.com' }],
        invitationId: 'invitation-123',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return families with invitation
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [mockOtherFamily, mockFamilyWithInvitation], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      // Wait for component to load and find the pending family
      await waitFor(() => {
        expect(screen.getByTestId('GroupFamily-Text-name-family-2')).toBeInTheDocument();
      });

      // Find and click the cancel invitation button in the dropdown
      const dropdownTrigger = screen.getByTestId('GroupFamily-Button-actions-family-2');
      expect(dropdownTrigger).toBeInTheDocument();

      await user.click(dropdownTrigger!);

      // Wait for dropdown menu to appear and click cancel invitation
      await waitFor(() => {
        const cancelButton = screen.getByTestId('GroupFamily-Button-cancelInvitation-family-2');
        expect(cancelButton).toBeInTheDocument();
        return user.click(cancelButton);
      });

      // Verify API call was made
      await waitFor(() => {
        expect(mockClient.DELETE).toHaveBeenCalledWith('/groups/{groupId}/invitations/{invitationId}', {
          params: { groupId: 'group-1', invitationId: 'invitation-123' }
        });
      });
    });

    it('should show success message after canceling invitation', async () => {
      const mockFamilyWithInvitation: GroupFamily = {
        id: 'family-2',
        name: 'Success Test Family',
        role: 'PENDING',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Pending Admin', email: 'admin@pending.com' }],
        invitationId: 'invitation-123',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return families with invitation
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [mockOtherFamily, mockFamilyWithInvitation], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('GroupFamily-Text-name-family-2')).toBeInTheDocument();
      });

      // Open dropdown and cancel invitation
      const dropdownTrigger = screen.getByTestId('GroupFamily-Button-actions-family-2');
      await user.click(dropdownTrigger!);

      const cancelButton = await waitFor(() => screen.getByTestId('GroupFamily-Button-cancelInvitation-family-2'));
      await user.click(cancelButton);

      // Check for success message
      await waitFor(() => {
        expect(screen.getByTestId('ManageGroupPage-Alert-successMessage')).toHaveTextContent('Invitation canceled successfully');
      });
    });
  });

  describe('AdminDisplay Component', () => {
    it('should display single admin name without tooltip', async () => {
      const familyWithSingleAdmin: GroupFamily = {
        id: 'family-single',
        name: 'Single Admin Family',
        role: 'MEMBER',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Single Admin', email: 'single@admin.com' }],
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return families with single admin
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [familyWithSingleAdmin], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        const adminDisplay = screen.getByTestId('AdminDisplay-Text-single-family-single');
        expect(adminDisplay).toBeInTheDocument();
        expect(adminDisplay).toHaveTextContent('Single Admin');
        // Should not have tooltip trigger styling
        expect(adminDisplay).not.toHaveClass('cursor-help underline decoration-dotted');
      });
    });

    it('should display multiple admins with tooltip', async () => {
      const familyWithMultipleAdmins: GroupFamily = {
        id: 'family-multiple',
        name: 'Multiple Admin Family',
        role: 'MEMBER',
        isMyFamily: false,
        canManage: true,
        admins: [
          { name: 'First Admin', email: 'first@admin.com' },
          { name: 'Second Admin', email: 'second@admin.com' },
          { name: 'Third Admin', email: 'third@admin.com' },
        ],
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 3,
        _count: {
          members: 3,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return families with multiple admins
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [familyWithMultipleAdmins], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        // Should show first admin name with count
        const adminTrigger = screen.getByTestId('AdminDisplay-Trigger-multiple-family-multiple');
        expect(adminTrigger).toBeInTheDocument();
        expect(adminTrigger).toHaveTextContent('First Admin (+2 more)');
      });

      // Hover over the admin display to show tooltip
      const adminDisplay = screen.getByTestId('AdminDisplay-Trigger-multiple-family-multiple');
      await user.hover(adminDisplay);

      await waitFor(() => {
        const headers = screen.getAllByTestId('AdminDisplay-Text-header-family-multiple');
        expect(headers.length).toBeGreaterThan(0);
        expect(headers[0]).toHaveTextContent('All Administrators:');
        // Verify all admin names are present in the tooltip content
        const tooltipContents = screen.getAllByTestId('AdminDisplay-Tooltip-content-family-multiple');
        const tooltipContent = tooltipContents[0];
        expect(tooltipContent).toHaveTextContent('First Admin');
        expect(tooltipContent).toHaveTextContent('first@admin.com');
        expect(tooltipContent).toHaveTextContent('Second Admin');
        expect(tooltipContent).toHaveTextContent('second@admin.com');
        expect(tooltipContent).toHaveTextContent('Third Admin');
        expect(tooltipContent).toHaveTextContent('third@admin.com');
      });
    });

    it('should handle missing admins array gracefully', async () => {
      const familyWithMissingAdmins: GroupFamily = {
        id: 'family-missing',
        name: 'Missing Admins Family',
        role: 'MEMBER',
        isMyFamily: false,
        canManage: true,
        admins: [], // Simulate missing admins with empty array
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 0,
        _count: {
          members: 0,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return families with missing admins
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [familyWithMissingAdmins], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        const adminDisplay = screen.getByTestId('AdminDisplay-Text-single-family-missing');
        expect(adminDisplay).toBeInTheDocument();
        expect(adminDisplay).toHaveTextContent('No admins');
      });
    });
  });

  describe('Pending Family Display', () => {
    it('should display pending families with correct styling and expiration date', async () => {
      const pendingFamily: GroupFamily = {
        id: 'family-pending',
        name: 'Display Test Family',
        role: 'PENDING',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Pending Admin', email: 'admin@pending.com' }],
        invitationId: 'invitation-123',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return pending family
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [pendingFamily], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        // Check family name is displayed
        expect(screen.getByTestId('GroupFamily-Text-name-family-pending')).toBeInTheDocument();
        expect(screen.getByTestId('GroupFamily-Text-name-family-pending')).toHaveTextContent('Display Test Family');

        // Check PENDING badge
        expect(screen.getByTestId('GroupFamily-Badge-pending-family-pending')).toBeInTheDocument();
        expect(screen.getByTestId('GroupFamily-Badge-pending-family-pending')).toHaveTextContent('Pending Invitation');

        // Check expiration date is displayed
        const expirationDate = new Date('2024-01-08T00:00:00Z').toLocaleString();
        expect(screen.getByTestId('GroupFamily-Text-expires-family-pending')).toBeInTheDocument();
        expect(screen.getByTestId('GroupFamily-Text-expires-family-pending')).toHaveTextContent(`Expires: ${expirationDate}`);

        // Check that dropdown menu button is present (cancel invitation is inside the dropdown)
        expect(screen.getByTestId('GroupFamily-Button-actions-family-pending')).toBeInTheDocument();
      });
    });

    it('should show orange border styling for pending families', async () => {
      const pendingFamily: GroupFamily = {
        id: 'family-pending',
        name: 'Styling Test Family',
        role: 'PENDING',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Pending Admin', email: 'admin@pending.com' }],
        invitationId: 'invitation-123',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return pending family
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [pendingFamily], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        // Check that the pending family card has orange border styling
        const familyCard = screen.getByTestId('GroupFamily-Card-family-pending');
        expect(familyCard).toBeInTheDocument();
        expect(familyCard).toHaveClass('border-orange-200');

        // Also verify the family name is displayed correctly
        expect(screen.getByTestId('GroupFamily-Text-name-family-pending')).toHaveTextContent('Styling Test Family');
      });
    });

    it('should use status field for pending detection with role display', async () => {
      const pendingAdminFamily: GroupFamily = {
        id: 'family-pending-admin',
        name: 'Pending Admin Family',
        role: 'ADMIN', // Role is ADMIN but status is PENDING
        status: 'PENDING',
        isMyFamily: false,
        canManage: true,
        admins: [{ name: 'Pending Admin', email: 'admin@pending.com' }],
        invitationId: 'invitation-456',
        invitedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        joinedAt: '2024-01-01T00:00:00Z',
        inviteCode: 'FAM123',
        memberCount: 1,
        _count: {
          members: 1,
          children: 0,
          vehicles: 0
        }
      };

      // Override GET mock to return pending admin family
      mockClient.GET.mockImplementation((path: string, options?: any) => {
        const { params } = options || {};

        if (path === '/groups/{groupId}/families' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: [pendingAdminFamily], success: true },
            error: undefined
          });
        }
        if (path === '/groups/{groupId}' && params?.groupId === 'group-1') {
          return Promise.resolve({
            data: { data: mockUserGroups[0], success: true },
            error: undefined
          });
        }

        return Promise.resolve({
          data: { data: [], success: true },
          error: undefined
        });
      });

      render(<ManageGroupPage />);

      await waitFor(() => {
        // Check that pending invitation badge is shown
        expect(screen.getByTestId('GroupFamily-Badge-pending-family-pending-admin')).toBeInTheDocument();
        expect(screen.getByTestId('GroupFamily-Badge-pending-family-pending-admin')).toHaveTextContent('Pending Invitation');

        // Check that role badge (Admin) is also shown
        expect(screen.getByTestId('GroupFamily-Badge-admin-family-pending-admin')).toBeInTheDocument();
        expect(screen.getByTestId('GroupFamily-Badge-admin-family-pending-admin')).toHaveTextContent('Admin');

        // Check orange border styling
        const familyCard = screen.getByTestId('GroupFamily-Card-family-pending-admin');
        expect(familyCard).toHaveClass('border-orange-200');
      });
    });
  });
});