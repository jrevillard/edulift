import { render, screen } from '@testing-library/react';
import { ConnectionIndicator } from '../ConnectionIndicator';
import { useConnectionStore } from '@/stores/connectionStore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the connection store
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: vi.fn(),
}));

const mockUseConnectionStore = vi.mocked(useConnectionStore);

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show connected status when all systems are working', () => {
    mockUseConnectionStore.mockReturnValue({
      wsStatus: 'connected',
      apiStatus: 'connected',
      hasConnectionIssues: vi.fn(() => false),
      setWsStatus: vi.fn(),
      setApiStatus: vi.fn(),
      clearErrors: vi.fn(),
      getConnectionMessage: vi.fn(),
      wsError: null,
      apiError: null,
      recentErrors: [],
      isConnected: vi.fn(() => true),
    });

    render(<ConnectionIndicator showLabel={true} />);
    
    expect(screen.getByTestId('ConnectionIndicator-Label-connectionStatus')).toHaveTextContent('Connected');
  });

  it('should show offline status when API is disconnected', () => {
    mockUseConnectionStore.mockReturnValue({
      wsStatus: 'connected',
      apiStatus: 'error',
      hasConnectionIssues: vi.fn(() => true),
      setWsStatus: vi.fn(),
      setApiStatus: vi.fn(),
      clearErrors: vi.fn(),
      getConnectionMessage: vi.fn(),
      wsError: null,
      apiError: null,
      recentErrors: [],
      isConnected: vi.fn(() => false),
    });

    render(<ConnectionIndicator showLabel={true} />);
    
    expect(screen.getByTestId('ConnectionIndicator-Label-connectionStatus')).toHaveTextContent('Offline');
  });

  it('should show limited status when websocket is disconnected but API works', () => {
    mockUseConnectionStore.mockReturnValue({
      wsStatus: 'error',
      apiStatus: 'connected',
      hasConnectionIssues: vi.fn(() => true),
      setWsStatus: vi.fn(),
      setApiStatus: vi.fn(),
      clearErrors: vi.fn(),
      getConnectionMessage: vi.fn(),
      wsError: null,
      apiError: null,
      recentErrors: [],
      isConnected: vi.fn(() => false),
    });

    render(<ConnectionIndicator showLabel={true} />);
    
    expect(screen.getByTestId('ConnectionIndicator-Label-connectionStatus')).toHaveTextContent('Limited');
  });

  it('should show connecting status when reconnecting', () => {
    mockUseConnectionStore.mockReturnValue({
      wsStatus: 'connecting',
      apiStatus: 'connected',
      hasConnectionIssues: vi.fn(() => true),
      setWsStatus: vi.fn(),
      setApiStatus: vi.fn(),
      clearErrors: vi.fn(),
      getConnectionMessage: vi.fn(),
      wsError: null,
      apiError: null,
      recentErrors: [],
      isConnected: vi.fn(() => false),
    });

    render(<ConnectionIndicator showLabel={true} />);
    
    expect(screen.getByTestId('ConnectionIndicator-Label-connectionStatus')).toHaveTextContent('Connecting');
  });

  it('should not show label when showLabel is false', () => {
    mockUseConnectionStore.mockReturnValue({
      wsStatus: 'connected',
      apiStatus: 'connected',
      hasConnectionIssues: vi.fn(() => false),
      setWsStatus: vi.fn(),
      setApiStatus: vi.fn(),
      clearErrors: vi.fn(),
      getConnectionMessage: vi.fn(),
      wsError: null,
      apiError: null,
      recentErrors: [],
      isConnected: vi.fn(() => true),
    });

    render(<ConnectionIndicator showLabel={false} />);
    
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    // Should still show the icon
    expect(screen.getByTestId('ConnectionIndicator-Container-connectionIndicator')).toBeInTheDocument();
  });
});