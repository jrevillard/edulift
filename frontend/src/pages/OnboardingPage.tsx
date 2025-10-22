import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import { FamilyOnboardingWizard } from '../components/family/FamilyOnboardingWizard';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshFamily } = useFamily();

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

  return (
    <FamilyOnboardingWizard onComplete={handleComplete} />
  );
};

export default OnboardingPage;