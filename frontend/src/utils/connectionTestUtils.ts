/**
 * Utility functions for testing and debugging connection issues
 */

import { useConnectionStore } from '@/stores/connectionStore';

export const connectionTestUtils = {
  /**
   * Simulate API connection failure
   */
  simulateApiError: (message = 'Cannot connect to server. Please ensure the backend is running.') => {
    useConnectionStore.getState().setApiStatus('error', message);
  },

  /**
   * Simulate WebSocket connection failure
   */
  simulateWebSocketError: (message = 'Real-time updates unavailable. Some features may not work as expected.') => {
    useConnectionStore.getState().setWsStatus('error', message);
  },

  /**
   * Simulate connecting state
   */
  simulateConnecting: () => {
    useConnectionStore.getState().setApiStatus('connecting');
    useConnectionStore.getState().setWsStatus('connecting');
  },

  /**
   * Restore normal connection
   */
  restoreConnection: () => {
    useConnectionStore.getState().setApiStatus('connected');
    useConnectionStore.getState().setWsStatus('connected');
    useConnectionStore.getState().clearErrors();
  },

  /**
   * Get current connection status for debugging
   */
  getConnectionStatus: () => {
    const store = useConnectionStore.getState();
    return {
      api: {
        status: store.apiStatus,
        error: store.apiError,
      },
      websocket: {
        status: store.wsStatus,
        error: store.wsError,
      },
      recentErrors: store.recentErrors,
      isConnected: store.isConnected(),
      hasIssues: store.hasConnectionIssues(),
      message: store.getConnectionMessage(),
    };
  },

  /**
   * Log current connection status to console
   */
  logConnectionStatus: () => {
    console.log('Connection Status:', connectionTestUtils.getConnectionStatus());
  },
};

// Extend Window interface for development
declare global {
  interface Window {
    connectionTestUtils?: typeof connectionTestUtils;
  }
}

// Make it available globally in development
if (import.meta.env.DEV) {
  window.connectionTestUtils = connectionTestUtils;
}