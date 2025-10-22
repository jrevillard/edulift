import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionError {
  type: 'websocket' | 'api';
  message: string;
  timestamp: Date;
}

interface ConnectionStore {
  // WebSocket connection status (backend Socket.IO)
  wsStatus: ConnectionStatus;
  wsError: string | null;
  
  // API connection status
  apiStatus: ConnectionStatus;
  apiError: string | null;
  
  // Recent errors
  recentErrors: ConnectionError[];
  
  // Actions
  setWsStatus: (status: ConnectionStatus, error?: string) => void;
  setApiStatus: (status: ConnectionStatus, error?: string) => void;
  clearErrors: () => void;
  
  // Computed getters
  isConnected: () => boolean;
  hasConnectionIssues: () => boolean;
  getConnectionMessage: () => string | null;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  wsStatus: 'disconnected',
  wsError: null,
  apiStatus: 'connected',
  apiError: null,
  recentErrors: [],
  
  setWsStatus: (status, error) => set((state) => {
    const newErrors = [...state.recentErrors];
    if (error && status === 'error') {
      newErrors.push({
        type: 'websocket',
        message: error,
        timestamp: new Date()
      });
      // Keep only last 5 errors
      if (newErrors.length > 5) newErrors.shift();
    }
    
    return {
      wsStatus: status,
      wsError: error || null,
      recentErrors: newErrors
    };
  }),
  
  setApiStatus: (status, error) => set((state) => {
    const newErrors = [...state.recentErrors];
    if (error && status === 'error') {
      newErrors.push({
        type: 'api',
        message: error,
        timestamp: new Date()
      });
      // Keep only last 5 errors
      if (newErrors.length > 5) newErrors.shift();
    }
    
    return {
      apiStatus: status,
      apiError: error || null,
      recentErrors: newErrors
    };
  }),
  
  clearErrors: () => set({
    wsError: null,
    apiError: null,
    recentErrors: []
  }),
  
  isConnected: () => {
    const state = get();
    return state.wsStatus === 'connected' && state.apiStatus === 'connected';
  },
  
  hasConnectionIssues: () => {
    const state = get();
    return state.wsStatus === 'error' || state.wsStatus === 'disconnected' || state.wsStatus === 'connecting' ||
           state.apiStatus === 'error' || state.apiStatus === 'disconnected' || state.apiStatus === 'connecting';
  },
  
  getConnectionMessage: () => {
    const state = get();
    
    // Priority: API errors > WebSocket errors
    if (state.apiStatus === 'error' || state.apiStatus === 'disconnected') {
      return state.apiError || 'Unable to connect to server. Please ensure the backend is running.';
    }
    
    if (state.wsStatus === 'error' || state.wsStatus === 'disconnected') {
      return state.wsError || 'Cannot connect to real-time updates. Schedule changes may not appear immediately.';
    }
    
    if (state.wsStatus === 'connecting' || state.apiStatus === 'connecting') {
      return 'Connecting to server...';
    }
    
    return null;
  }
}));