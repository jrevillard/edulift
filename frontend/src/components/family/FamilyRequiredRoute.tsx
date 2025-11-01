/**
 * FAMILY REQUIRED ROUTE
 * 
 * Protected route component that enforces family membership requirement.
 * Shows the family onboarding wizard when user doesn't belong to a family.
 * 
 * This component acts as a guard to ensure users have completed the mandatory
 * family setup before accessing family-dependent features of the application.
 * 
 * Features:
 * - Checks family membership status
 * - Shows loading state during family verification  
 * - Displays onboarding wizard when family is required
 * - Renders children components when family requirement is met
 * - Handles authentication state properly
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectionStore } from '../../stores/connectionStore';

interface FamilyRequiredRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FamilyRequiredRoute: React.FC<FamilyRequiredRouteProps> = ({
  children,
  fallback
}) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    requiresFamily,
    isCheckingFamily,
    hasFamily,
    isLoading: familyLoading
  } = useFamily();
  const apiStatus = useConnectionStore((state) => state.apiStatus);

  // Show loading state while checking authentication or family status
  if (authLoading || isCheckingFamily || familyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600" data-testid="FamilyRequiredRoute-Text-familyStatusLoading">Checking family status...</p>
        </div>
      </div>
    );
  }

  // If API backend is not connected, don't show wizard - let BackendConnectionAlert handle the UI
  if (apiStatus === 'disconnected' || apiStatus === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin mx-auto mb-4"></div>
            <span data-testid="FamilyRequiredRoute-Text-serverConnectionWaiting">Waiting for server connection...</span>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, return fallback or null (auth routes should handle this)
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }

  // If user requires family setup, redirect to onboarding
  if (requiresFamily || !hasFamily) {
    return <Navigate to="/onboarding" replace />;
  }

  // User has a family - render the protected content
  return <>{children}</>;
};

/**
 * Higher-order component version for easier usage
 */
export const withFamilyRequired = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const FamilyRequiredComponent = (props: P) => (
    <FamilyRequiredRoute>
      <Component {...props} />
    </FamilyRequiredRoute>
  );
  
  FamilyRequiredComponent.displayName = `withFamilyRequired(${Component.displayName || Component.name})`;
  
  return FamilyRequiredComponent;
};

export default FamilyRequiredRoute;