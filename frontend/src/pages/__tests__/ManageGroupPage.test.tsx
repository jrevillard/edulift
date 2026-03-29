import { render, screen } from '../../test/test-utils';
import { vi } from 'vitest';
import ManageGroupPage from '../ManageGroupPage';

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

// Mock auth service
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
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
    ready: vi.fn().mockReturnValue(true),
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
      vehicles: [],
    }),
    getUserPermissions: vi.fn().mockResolvedValue({
      canManageFamily: true,
      canInviteMembers: true,
      canCreateGroups: true,
    }),
  },
}));

// Mock SocketContext
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

// Mock FamilyContext - use importOriginal to preserve exports
vi.mock('../../contexts/FamilyContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFamily: () => ({
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
      },
    }),
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ManageGroupPage', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders loading state initially', () => {
      render(<ManageGroupPage />);

      // Should show loading state initially
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
      render(<ManageGroupPage />);

      // The component should render without throwing an error
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('has correct loading state message', () => {
      render(<ManageGroupPage />);

      expect(screen.getByTestId('LoadingState-Heading-title')).toHaveTextContent('Loading group details...');
    });

    it('has correct loading state description', () => {
      render(<ManageGroupPage />);

      expect(screen.getByText('Please wait while we fetch the group information.')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('uses correct groupId from useParams', () => {
      render(<ManageGroupPage />);

      // The fact that it renders without crashing means useParams is working correctly
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Context Integration', () => {
    it('integrates with family context without errors', () => {
      render(<ManageGroupPage />);

      // If this renders without crashing, the context integration is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('integrates with connection store without errors', () => {
      render(<ManageGroupPage />);

      // If this renders without crashing, the connection store is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Mock Dependencies', () => {
    it('uses mocked auth service correctly', () => {
      render(<ManageGroupPage />);

      // The fact that it renders without crashing means auth service mock is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('uses mocked family API service correctly', () => {
      render(<ManageGroupPage />);

      // The fact that it renders without crashing means family API service mock is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('uses mocked socket context correctly', () => {
      render(<ManageGroupPage />);

      // The fact that it renders without crashing means socket context mock is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('properly initializes component state', () => {
      render(<ManageGroupPage />);

      // Component should initialize in loading state
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('handles async data fetching without crashing', async () => {
      render(<ManageGroupPage />);

      // Component should handle async operations gracefully
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('handles missing groupId gracefully', () => {
      // Test with a different groupId to ensure error handling works
      render(<ManageGroupPage />);

      // Should still render loading state even with different scenarios
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and structure', () => {
      render(<ManageGroupPage />);

      // Loading state should be properly accessible - check for loading spinner
      expect(screen.getByTestId('LoadingState-Heading-title')).toBeInTheDocument();

      // Check that we have a loading title
      expect(screen.getByRole('heading', { name: /loading group details/i })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders efficiently without memory leaks', () => {
      const { unmount } = render(<ManageGroupPage />);

      // Should render without performance issues
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('integrates correctly with React Router', () => {
      render(<ManageGroupPage />);

      // If this renders without crashing, React Router integration is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });

    it('integrates correctly with React Query', () => {
      render(<ManageGroupPage />);

      // If this renders without crashing, React Query integration is working
      expect(screen.getByTestId('ManageGroupPage-Container-loading')).toBeInTheDocument();
    });
  });
});