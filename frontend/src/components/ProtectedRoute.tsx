import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Track authentication state changes
  const prevIsAuthenticated = React.useRef<boolean | null>(null);
  if (prevIsAuthenticated.current !== isAuthenticated) {
    console.log('🔄 ProtectedRoute: isAuthenticated changed from', prevIsAuthenticated.current, 'to', isAuthenticated);
    prevIsAuthenticated.current = isAuthenticated;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600" data-testid="protected-route-loading">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('🚫 ProtectedRoute: User NOT authenticated, navigating to login');
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('✅ ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;