import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuth } from '@/contexts/AuthContext';

const BackendConnectionAlert: React.FC = () => {
  const { isConnected } = useSocket();
  const { wsStatus, getConnectionMessage } = useConnectionStore();
  const { isAuthenticated } = useAuth();
  const connectionMessage = getConnectionMessage();

  // Don't show anything if backend is connected
  if (isConnected) {
    return null;
  }

  // Only show connection issues when user is authenticated (and we're actually trying to connect)
  if (!isAuthenticated) {
    return null;
  }

  const handleRetry = () => {
    window.location.reload();
  };

  // Show error state when disconnected
  return (
    <Alert className="mb-4 border-red-200 bg-red-50">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-red-800 mb-1" data-testid="connection-error-title">
            Unable to connect to server
          </div>
          <div className="text-sm text-red-600" data-testid="connection-error-message">
            {wsStatus === 'error' ? connectionMessage : 'The backend service is not responding. Please ensure the backend is running on port 3001.'}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="ml-4 border-red-200 text-red-700 hover:bg-red-100"
          data-testid="retry-connection-button"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default BackendConnectionAlert;