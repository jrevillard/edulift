/**
 * FAMILY CONTEXT
 * 
 * Purpose: Manages family state for resource ownership system
 * 
 * This context handles family membership and shared resource management.
 * It is independent of the group/scheduling system - a user can be in one family
 * but participate in multiple scheduling groups using family-owned resources.
 * 
 * Responsibilities:
 * - Track current user's family membership
 * - Manage family member roles and permissions  
 * - Provide access to family-owned children and vehicles
 * - Handle family invitations and member management
 * - Coordinate with scheduling groups for resource sharing
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { 
  Family, 
  FamilyContextState,
  FamilyRole,
  FamilyInvitation
} from '../types/family';
import {
  createFamilyError,
  FAMILY_ERROR_CODES 
} from '../types/family';
import { familyApiService } from '../services/familyApiService';
import { authService } from '../services/authService';
import { useAuth } from './AuthContext';

interface FamilyContextType extends FamilyContextState {
  // Family operations
  createFamily: (name: string) => Promise<Family>;
  joinFamily: (inviteCode: string) => Promise<Family>;
  leaveFamily: () => Promise<void>;
  refreshFamily: () => Promise<void>;
  updateFamilyName: (name: string) => Promise<void>;
  
  // Member operations
  inviteMember: (email: string, role: string, personalMessage?: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  generateInviteCode: () => Promise<string>;
  
  // Invitation operations
  getPendingInvitations: () => Promise<FamilyInvitation[]>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  hasFamily: boolean;
  
  // Mandatory family requirement
  requiresFamily: boolean;
  isCheckingFamily: boolean;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};

interface FamilyProviderProps {
  children: ReactNode;
}

export const FamilyProvider: React.FC<FamilyProviderProps> = ({ children }) => {
  const [state, setState] = useState<FamilyContextState>({
    currentFamily: null,
    userPermissions: null,
    isLoading: false,
    error: null,
    requiresFamily: false,
    isCheckingFamily: false
  });

  const { user, isAuthenticated } = useAuth();

  // Initialize family data when user is authenticated
  useEffect(() => {
    const loadUserFamily = async () => {
      if (!user) return;

      // Check if user is marked as new user (for E2E tests)
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage);

          // DEBUG: Log auth storage state for troubleshooting
          console.log('🔍 DEBUG: Auth storage found:', {
            isNewUser: authData.state?.isNewUser,
            userId: authData.state?.user?.id,
            hasToken: !!authData.state?.token
          });

          if (authData.state?.isNewUser) {
            // Always try to clear stale isNewUser flag first, then check if user actually needs onboarding
            console.warn('🔍 DEBUG: Clearing potentially stale isNewUser flag');
            // Force clear stale isNewUser flag
            const updatedAuthData = { ...authData, state: { ...authData.state, isNewUser: false } };
            localStorage.setItem('auth-storage', JSON.stringify(updatedAuthData));

            // Only redirect to onboarding if we're sure this is a different user (not just stale data)
            if (authData.state?.user?.id !== user?.id) {
              console.log('🔍 DEBUG: Different user detected, may need onboarding');
              // Don't redirect immediately - let the normal family check logic handle it
              // This prevents false redirects for existing users with families
            }
          }
        } catch (error) {
          console.warn('Failed to parse auth storage for isNewUser check:', error);
        }
      }

    setState(prev => ({ ...prev, isCheckingFamily: true, error: null }));

    try {
      // Refresh authService token to ensure it has the latest token from localStorage
      authService.refreshTokenFromStorage();
      const family = await familyApiService.getCurrentFamily();
      
      if (family) {
        // User has a family - load permissions
        const permissions = await familyApiService.getUserPermissions(family.id);
        
        setState(prev => ({
          ...prev,
          currentFamily: family,
          userPermissions: permissions,
          requiresFamily: false,  // User has a family
          isCheckingFamily: false,
          isLoading: false
        }));
      } else {
        // User doesn't have a family - mandatory to create or join one
        setState(prev => ({
          ...prev,
          currentFamily: null,
          userPermissions: null,
          requiresFamily: true,   // MANDATORY: User must create or join a family
          isCheckingFamily: false,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Failed to load user family:', error);

      // Check if this is a network/connection error or server startup issue
      const isNetworkError = error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')
      );

      // Be more conservative - only require family if we're certain it's not a network/server issue
      // Also check if user previously had a family (in session) to avoid false redirects
      const hadPreviousFamily = !!state.currentFamily;

      setState(prev => ({
        ...prev,
        currentFamily: null,
        userPermissions: null,
        requiresFamily: !isNetworkError && !hadPreviousFamily,   // Don't require family on network errors or if user previously had one
        isCheckingFamily: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load family'
      }));
    }
  };

    if (isAuthenticated && user) {
      loadUserFamily();
    } else {
      // Clear family data when user logs out
      setState(prev => ({
        ...prev,
        currentFamily: null,
        userPermissions: null,
        error: null
      }));
    }
  }, [isAuthenticated, user]);

  const createFamily = useCallback(async (name: string): Promise<Family> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const family = await familyApiService.createFamily({ name });
      const permissions = await familyApiService.getUserPermissions(family.id);
      
      setState(prev => ({
        ...prev,
        currentFamily: family,
        userPermissions: permissions,
        requiresFamily: false,  // Family requirement fulfilled
        isLoading: false
      }));

      return family;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create family';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw createFamilyError(FAMILY_ERROR_CODES.INVALID_FAMILY_NAME, errorMessage);
    }
  }, []);

  const joinFamily = useCallback(async (inviteCode: string): Promise<Family> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const family = await familyApiService.joinFamily({ inviteCode });
      const permissions = await familyApiService.getUserPermissions(family.id);
      
      setState(prev => ({
        ...prev,
        currentFamily: family,
        userPermissions: permissions,
        requiresFamily: false,  // Family requirement fulfilled
        isLoading: false
      }));

      return family;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join family';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      // Determine error code based on message
      let errorCode: string = FAMILY_ERROR_CODES.INVALID_INVITE_CODE;
      if (errorMessage.includes('already in family')) {
        errorCode = FAMILY_ERROR_CODES.USER_ALREADY_IN_FAMILY;
      } else if (errorMessage.includes('full')) {
        errorCode = FAMILY_ERROR_CODES.FAMILY_FULL;
      }
      
      throw createFamilyError(errorCode, errorMessage);
    }
  }, []);

  const leaveFamily = useCallback(async (): Promise<void> => {
    if (!state.currentFamily) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await familyApiService.leaveFamily(state.currentFamily.id);
      
      setState(prev => ({
        ...prev,
        currentFamily: null,
        userPermissions: null,
        requiresFamily: true,  // Must join/create family again
        isLoading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave family';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily]);

  const refreshFamily = useCallback(async (): Promise<void> => {
    try {
      console.log('🔄 FamilyContext: Refreshing family data...');
      const family = await familyApiService.getCurrentFamily();
      if (family) {
        const permissions = await familyApiService.getUserPermissions(family.id);
        
        console.log('✅ FamilyContext: Family refresh successful:', {
          familyId: family.id,
          familyName: family.name,
          memberCount: family.members?.length || 0,
          adminCount: family.members?.filter(m => m.role === 'ADMIN').length || 0,
          currentUserRole: permissions?.canManageMembers ? 'ADMIN' : 'MEMBER'
        });
        
        setState(prev => ({
          ...prev,
          currentFamily: family,
          userPermissions: permissions,
          requiresFamily: false,
          error: null // Clear any previous errors
        }));
      } else {
        console.log('📝 FamilyContext: No family found during refresh, user needs to join/create family');
        setState(prev => ({
          ...prev,
          currentFamily: null,
          userPermissions: null,
          requiresFamily: true,
          error: null
        }));
      }
    } catch (error) {
      console.error('🚨 FamilyContext: Failed to refresh family:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to refresh family'
      }));
    }
  }, []);

  const inviteMember = useCallback(async (
    email: string, 
    role: string, 
    personalMessage?: string
  ): Promise<void> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await familyApiService.inviteMember(state.currentFamily.id, {
        email,
        role: role as FamilyRole,
        personalMessage
      });
      
      // Refresh family to get updated invitations
      await refreshFamily();
      
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite member';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily, refreshFamily]);

  const updateMemberRole = useCallback(async (
    memberId: string, 
    role: string
  ): Promise<void> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await familyApiService.updateMemberRole(state.currentFamily.id, memberId, { role: role as FamilyRole });
      
      // Refresh family to get updated member roles
      await refreshFamily();
      
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update member role';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      let errorCode: string = FAMILY_ERROR_CODES.UNAUTHORIZED;
      if (errorMessage.includes('last admin')) {
        errorCode = FAMILY_ERROR_CODES.LAST_ADMIN;
      } else if (errorMessage.includes('not found')) {
        errorCode = FAMILY_ERROR_CODES.MEMBER_NOT_FOUND;
      }
      
      throw createFamilyError(errorCode, errorMessage);
    }
  }, [state.currentFamily, refreshFamily]);

  const removeMember = useCallback(async (memberId: string): Promise<void> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await familyApiService.removeMember(state.currentFamily.id, memberId);
      
      // Refresh family to get updated member list
      await refreshFamily();
      
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove member';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      let errorCode: string = FAMILY_ERROR_CODES.UNAUTHORIZED;
      if (errorMessage.includes('cannot remove self')) {
        errorCode = FAMILY_ERROR_CODES.CANNOT_REMOVE_SELF;
      } else if (errorMessage.includes('not found')) {
        errorCode = FAMILY_ERROR_CODES.MEMBER_NOT_FOUND;
      }
      
      throw createFamilyError(errorCode, errorMessage);
    }
  }, [state.currentFamily, refreshFamily]);

  const generateInviteCode = useCallback(async (): Promise<string> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    try {
      const inviteCode = await familyApiService.generateInviteCode();
      return inviteCode;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate invite code';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily]);

  const updateFamilyName = useCallback(async (name: string): Promise<void> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updatedFamily = await familyApiService.updateFamilyName(name);
      
      setState(prev => ({
        ...prev,
        currentFamily: updatedFamily,
        isLoading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update family name';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily]);

  const getPendingInvitations = useCallback(async (): Promise<FamilyInvitation[]> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    try {
      const invitations = await familyApiService.getInvitations(state.currentFamily.id);
      return invitations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invitations';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily]);

  const cancelInvitation = useCallback(async (invitationId: string): Promise<void> => {
    if (!state.currentFamily) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await familyApiService.cancelInvitation(state.currentFamily.id, invitationId);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel invitation';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [state.currentFamily]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: FamilyContextType = {
    ...state,
    createFamily,
    joinFamily,
    leaveFamily,
    refreshFamily,
    updateFamilyName,
    inviteMember,
    updateMemberRole,
    removeMember,
    generateInviteCode,
    getPendingInvitations,
    cancelInvitation,
    clearError,
    hasFamily: !!state.currentFamily
  };

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
};