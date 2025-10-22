import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackendConnectionAlert from '../BackendConnectionAlert';
import { useSocket } from '../../../contexts/SocketContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useConnectionStore } from '../../../stores/connectionStore';

// Mock the dependencies
vi.mock('../../../contexts/SocketContext');
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../stores/connectionStore');

const mockUseSocket = vi.mocked(useSocket);
const mockUseAuth = vi.mocked(useAuth);
const mockUseConnectionStore = vi.mocked(useConnectionStore);

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('BackendConnectionAlert', () => {
  const defaultAuthState = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    verifyMagicLink: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn()
  };

  const defaultSocketState = {
    socket: null,
    isConnected: true
  };

  const defaultConnectionStore = {
    wsStatus: 'connected' as const,
    wsError: null,
    apiStatus: 'connected' as const,
    apiError: null,
    recentErrors: [],
    setWsStatus: vi.fn(),
    setApiStatus: vi.fn(),
    clearErrors: vi.fn(),
    isConnected: vi.fn(() => true),
    hasConnectionIssues: vi.fn(() => false),
    getConnectionMessage: vi.fn(() => null)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthState);
    mockUseSocket.mockReturnValue(defaultSocketState);
    mockUseConnectionStore.mockReturnValue(defaultConnectionStore);
  });

  describe('Authenticated user scenarios', () => {
    it('should not show alert when user is authenticated and connected', () => {
      const { container } = render(<BackendConnectionAlert />);
      expect(container.firstChild).toBeNull();
    });

    it('should show alert when user is authenticated but WebSocket is disconnected', () => {
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false
      });

      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        wsStatus: 'error' as const,
        getConnectionMessage: vi.fn(() => 'WebSocket connection failed')
      });

      render(<BackendConnectionAlert />);

      expect(screen.getByTestId('connection-error-title')).toBeInTheDocument();
      expect(screen.getByTestId('connection-error-message')).toHaveTextContent('WebSocket connection failed');
    });

    it('should show retry button and handle click', () => {
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false
      });

      render(<BackendConnectionAlert />);

      const retryButton = screen.getByTestId('retry-connection-button');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unauthenticated user scenarios (login page)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: false,
        user: null
      });
    });

    it('should not show alert when user is unauthenticated and API is working', () => {
      const { container } = render(<BackendConnectionAlert />);
      expect(container.firstChild).toBeNull();
    });

    it('should not show alert when user is unauthenticated and WebSocket is disconnected (normal)', () => {
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false
      });

      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        wsStatus: 'disconnected' as const,
        apiStatus: 'connected' as const
      });

      const { container } = render(<BackendConnectionAlert />);
      expect(container.firstChild).toBeNull();
    });

    it('should not show alert when user is unauthenticated even if API has error', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        apiStatus: 'error' as const,
        getConnectionMessage: vi.fn(() => 'Cannot connect to server. Please ensure the backend is running.')
      });

      const { container } = render(<BackendConnectionAlert />);
      expect(container.firstChild).toBeNull();
    });

    it('should not show alert when user is unauthenticated even if API error with no specific message', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        wsStatus: 'disconnected' as const,
        apiStatus: 'error' as const,
        getConnectionMessage: vi.fn(() => null)
      });

      const { container } = render(<BackendConnectionAlert />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Error message display', () => {
    beforeEach(() => {
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false
      });
    });

    it('should show connection message when available', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        wsStatus: 'error' as const,
        getConnectionMessage: vi.fn(() => 'Specific connection error message')
      });

      render(<BackendConnectionAlert />);

      expect(screen.getByTestId('connection-error-message')).toHaveTextContent('Specific connection error message');
    });

    it('should show default message when no connection message available', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        wsStatus: 'connecting' as const,
        getConnectionMessage: vi.fn(() => null)
      });

      render(<BackendConnectionAlert />);

      expect(screen.getByTestId('connection-error-message')).toHaveTextContent('The backend service is not responding. Please ensure the backend is running on port 3001.');
    });
  });

  describe('Retry functionality', () => {
    beforeEach(() => {
      mockUseSocket.mockReturnValue({
        socket: null,
        isConnected: false
      });
    });

    it('should call window.location.reload when retry button is clicked', () => {
      render(<BackendConnectionAlert />);

      const retryButton = screen.getByTestId('retry-connection-button');
      fireEvent.click(retryButton);

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('should have correct button styling and icon', () => {
      render(<BackendConnectionAlert />);

      const retryButton = screen.getByTestId('retry-connection-button');
      expect(retryButton).toHaveClass('border-red-200', 'text-red-700', 'hover:bg-red-100');
    });
  });
});