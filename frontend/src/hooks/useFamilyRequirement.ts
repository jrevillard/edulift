/**
 * Custom hook to determine if family wizard should be shown
 * 
 * This hook encapsulates the logic for when to show the family onboarding wizard
 * vs when to show connection/loading states.
 */

import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { useConnectionStore } from '@/stores/connectionStore';

export type FamilyRequirementState = 
  | { type: 'loading' }
  | { type: 'unauthenticated' }
  | { type: 'connection_error'; message: string }
  | { type: 'family_required' }
  | { type: 'family_satisfied' };

export const useFamilyRequirement = (): FamilyRequirementState => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { 
    requiresFamily, 
    isCheckingFamily, 
    hasFamily, 
    isLoading: familyLoading 
  } = useFamily();
  const { hasConnectionIssues, getConnectionMessage } = useConnectionStore();

  // Loading states have highest priority
  if (authLoading || isCheckingFamily || familyLoading) {
    return { type: 'loading' };
  }

  // Authentication required
  if (!isAuthenticated) {
    return { type: 'unauthenticated' };
  }

  // Connection issues - don't show wizard if we can't reach the backend
  if (hasConnectionIssues()) {
    return { 
      type: 'connection_error', 
      message: getConnectionMessage() || 'Unable to connect to server' 
    };
  }

  // Family requirement check
  if (requiresFamily || !hasFamily) {
    return { type: 'family_required' };
  }

  // All good - user has family
  return { type: 'family_satisfied' };
};