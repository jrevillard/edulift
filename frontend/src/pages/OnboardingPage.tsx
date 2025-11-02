import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import { FamilyOnboardingWizard } from '../components/family/FamilyOnboardingWizard';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshFamily, hasFamily, isCheckingFamily, isLoading: familyLoading } = useFamily();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect authenticated users who already have a family to dashboard
  useEffect(() => {
    // Wait for authentication and family checks to complete
    if (authLoading || isCheckingFamily || familyLoading) {
      return;
    }

    // If user is not authenticated, ProtectedRoute will handle the redirect
    if (!isAuthenticated) {
      return;
    }

    // If user already has a family, redirect to dashboard
    if (hasFamily) {
      console.log('🔄 OnboardingPage: User already has a family, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isCheckingFamily, familyLoading, isAuthenticated, hasFamily, navigate]);

  const handleComplete = async () => {
    try {
      // Refresh family data to get updated children and vehicles
      await refreshFamily();
    } catch (error) {
      console.warn('Could not refresh family data after onboarding:', error);
    }

    // Check for returnTo parameter (e.g., group invitation after family creation)
    const returnTo = searchParams.get('returnTo');
    const code = searchParams.get('code');

    if (returnTo === 'group-invitation' && code) {
      // Return to group invitation with the invitation code
      console.log('🔄 OnboardingPage: Returning to group invitation with code:', code);
      navigate(`/groups/join?code=${code}`, { replace: true });
    } else if (returnTo) {
      // Generic returnTo handling
      navigate(returnTo, { replace: true });
    } else {
      // Default to dashboard
      navigate('/dashboard', { replace: true });
    }
  };

  // Show loading state while checking authentication and family status
  if (authLoading || isCheckingFamily || familyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <FamilyOnboardingWizard onComplete={handleComplete} />
  );
};

export default OnboardingPage;