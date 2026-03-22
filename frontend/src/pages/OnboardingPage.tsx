import React, { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import { FamilyOnboardingWizard } from '../components/family/FamilyOnboardingWizard';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasFamily, isCheckingFamily, isLoading: familyLoading } = useFamily();
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
    // UNLESS they came from /family/manage (prevent false redirects)
    const fromFamilyManage = location.state?.from?.pathname === '/family/manage';
    if (hasFamily && !fromFamilyManage) {
      console.log('🔄 OnboardingPage: User already has a family, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    } else if (hasFamily && fromFamilyManage) {
      console.log('⚠️ OnboardingPage: User has family but came from /family/manage, staying on page');
      // Redirect back to /family/manage
      navigate('/family/manage', { replace: true });
    }
  }, [authLoading, isCheckingFamily, familyLoading, isAuthenticated, hasFamily, navigate, location.state]);

  const handleComplete = async () => {
    try {
      // Invalidate family data to get updated children and vehicles (React Query manages cache)
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
    } catch (error) {
      console.warn('Could not invalidate family queries after onboarding:', error);
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