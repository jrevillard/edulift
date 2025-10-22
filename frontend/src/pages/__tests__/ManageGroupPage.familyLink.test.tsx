import { render, screen, waitFor } from '../../test/test-utils';
import { vi } from 'vitest';
import ManageGroupPage from '../ManageGroupPage';
import * as apiService from '../../services/apiService';
import type { GroupFamily, ApiService } from '../../services/apiService';

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

// Mock apiService
vi.mock('../../services/apiService', () => ({
  apiService: {
    getUserGroups: vi.fn(),
    getGroupFamilies: vi.fn(),
    updateFamilyRole: vi.fn(),
    removeFamilyFromGroup: vi.fn(),
    regenerateInviteCode: vi.fn(),
    deleteGroup: vi.fn(),
    leaveGroup: vi.fn(),
    getGroupInvitations: vi.fn().mockResolvedValue([]),
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

const mockApiService = apiService.apiService as Partial<ApiService>;

const mockUserGroups = [
  {
    id: 'group-1',
    name: 'Test Group',
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
    familyCount: 2,
    scheduleCount: 1,
  },
];

const mockFamilies: GroupFamily[] = [
  {
    id: 'family-1',
    name: 'My Test Family',
    role: 'OWNER',
    isMyFamily: true,
    canManage: false,
    adminName: 'John Doe',
    adminEmail: 'john@test.com'
  },
  {
    id: 'family-2',
    name: 'Other Family',
    role: 'MEMBER',
    isMyFamily: false,
    canManage: true,
    adminName: 'Jane Smith',
    adminEmail: 'jane@test.com'
  },
];

describe('ManageGroupPage - Family Link', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService.getUserGroups.mockResolvedValue(mockUserGroups);
    mockApiService.getGroupFamilies.mockResolvedValue(mockFamilies);
  });

  it('should render "View my family" link for user\'s own family', async () => {
    render(<ManageGroupPage />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('ManageGroupPage-Heading-pageTitle')).toBeInTheDocument();
    });

    // Check that the family link is rendered for the user's own family
    await waitFor(() => {
      expect(screen.getByTestId('GroupFamily-Link-details-family-1')).toBeInTheDocument();
    });

    const familyLink = screen.getByTestId('GroupFamily-Link-details-family-1');
    expect(familyLink).toHaveTextContent('View my family');
  });

  it('should not render "View my family" link for other families', async () => {
    render(<ManageGroupPage />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('ManageGroupPage-Heading-pageTitle')).toBeInTheDocument();
    });

    // Check that the family link is NOT rendered for other families
    expect(screen.queryByTestId('GroupFamily-Link-details-family-2')).not.toBeInTheDocument();
  });

  it('should use React Router Link component with correct path', async () => {
    render(<ManageGroupPage />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('ManageGroupPage-Heading-pageTitle')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('GroupFamily-Link-details-family-1')).toBeInTheDocument();
    });

    const familyLink = screen.getByTestId('GroupFamily-Link-details-family-1');
    
    // Check that it's a Link component pointing to the correct route
    expect(familyLink.closest('a')).toHaveAttribute('href', '/family/manage');
  });
});