import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStore } from '@/stores/connectionStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    
    // If the error might be related to connectivity, update the connection store
    if (error.message.includes('fetch') || 
        error.message.includes('network') || 
        error.message.includes('ECONNREFUSED')) {
      useConnectionStore.getState().setApiStatus('error', 'A connection error occurred');
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // Force a page reload to clear any bad state
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  An unexpected error occurred. This might be due to a connection issue 
                  or a problem with the application.
                </p>
                
                {this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm opacity-70">
                      Technical details
                    </summary>
                    <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC wrapper to make it easier to use with hooks
export const ErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  return (
    <ErrorBoundaryClass fallback={fallback}>
      {children}
    </ErrorBoundaryClass>
  );
};