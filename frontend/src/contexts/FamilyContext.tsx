/**
 * FAMILY CONTEXT - React Query Architecture
 *
 * Purpose: Manages family state using React Query for optimal cache management
 *
 * **Architecture Change from useState to React Query:**
 *
 * BEFORE (useState - problematic):
 * - Manual state management with setState
 * - refreshFamily() creates new object references
 * - useEffect dependencies on currentFamily cause cascades
 * - Unstable references → component unmounts/remounts
 *
 * AFTER (React Query - optimal):
 * - Stable references (objects only change when data actually changes)
 * - Automatic cache management
 * - No manual refreshFamily() needed
 * - Predictable re-renders
 *
 * Responsibilities:
 * - Track current user's family membership
 * - Manage family member roles and permissions
 * - Provide access to family-owned children and vehicles
 * - Handle family invitations and member management
 * - Coordinate with scheduling groups for resource sharing
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Family,
  FamilyInvitation,
  FamilyPermissions,
  CreateFamilyRequest,
  JoinFamilyRequest,
  CreateFamilyInvitationRequest,
  UpdateMemberRoleRequest
} from '../services/familyApiService';
import { familyApiService } from '../services/familyApiService';
import { useAuth } from './AuthContext';

// Define types needed for FamilyContext locally
export type FamilyRole = "ADMIN" | "MEMBER";

export interface FamilyContextState {
  currentFamily: Family | null;
  userPermissions: FamilyPermissions | null;
  requiresFamily: boolean;      // User needs to create/join a family
  isCheckingFamily: boolean;    // Currently checking family status
  isLoading: boolean;
  error: string | null;
}

// Error types
export interface FamilyError extends Error {
  code: string;
  statusCode: number;
}

export const FAMILY_ERROR_CODES = {
  INVALID_FAMILY_NAME: 'INVALID_FAMILY_NAME',
  INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
  USER_ALREADY_IN_FAMILY: 'USER_ALREADY_IN_FAMILY',
  FAMILY_FULL: 'FAMILY_FULL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  LAST_ADMIN: 'LAST_ADMIN',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
} as const;

export function createFamilyError(
  code: string,
  message: string,
  statusCode: number = 400
): FamilyError {
  const error = new Error(message) as FamilyError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

interface FamilyContextType extends FamilyContextState {
  // Family operations
  createFamily: (name: string) => Promise<Family>;
  joinFamily: (inviteCode: string) => Promise<Family>;
  leaveFamily: () => Promise<void>;
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
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // ============================================================================
  // QUERIES - Stable data fetching with automatic caching
  // ============================================================================

  /**
   * Query 1: Current Family Data
   * Key: ['current-family']
   * - Stable reference, only refetches when explicitly invalidated
   * - 5 minute stale time (data is fresh for 5 minutes)
   * - Only runs when user is authenticated
   */
  const familyQuery = useQuery({
    queryKey: ['current-family'],
    queryFn: async () => {
      console.log('🔄 FamilyContext: Fetching current family...');
      const family = await familyApiService.getCurrentFamily();
      console.log('✅ FamilyContext: Family data fetched:', {
        familyId: family?.id,
        familyName: family?.name,
        memberCount: family?.members?.length || 0
      });
      return family;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
    enabled: isAuthenticated && !!user,  // Only fetch when authenticated
    retry: false,  // Disable retries - a 404 is expected for new users without a family
  });

  /**
   * Query 2: User Permissions for Current Family
   * Key: ['family-permissions', familyId]
   * - Depends on family ID (only fetches when family is loaded)
   * - Separate query allows permissions to update independently
   */
  const permissionsQuery = useQuery({
    queryKey: ['family-permissions', familyQuery.data?.id],
    queryFn: async () => {
      if (!familyQuery.data?.id) {
        return null;
      }
      console.log('🔄 FamilyContext: Fetching user permissions...');
      const permissions = await familyApiService.getUserPermissions(familyQuery.data.id);
      console.log('✅ FamilyContext: Permissions fetched:', {
        canManageMembers: permissions?.canManageMembers,
        canModifyChildren: permissions?.canModifyChildren,
        canModifyVehicles: permissions?.canModifyVehicles
      });
      return permissions;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
    enabled: isAuthenticated && !!user && !!familyQuery.data?.id,
    retry: false,  // Don't retry permission errors
  });

  // ============================================================================
  // MUTATIONS - State updates with automatic cache invalidation
  // ============================================================================

  /**
   * Mutation: Create Family
   * Invalidates: current-family, family-permissions
   */
  const createFamilyMutation = useMutation({
    mutationFn: async (name: string): Promise<Family> => {
      console.log('🔄 FamilyContext: Creating family...');
      const family = await familyApiService.createFamily({ name } as CreateFamilyRequest);
      console.log('✅ FamilyContext: Family created:', family.id);
      return family;
    },
    onSuccess: async () => {
      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
      await queryClient.invalidateQueries({ queryKey: ['family-permissions'] });
    },
  });

  /**
   * Mutation: Join Family
   * Invalidates: current-family, family-permissions
   */
  const joinFamilyMutation = useMutation({
    mutationFn: async (inviteCode: string): Promise<Family> => {
      console.log('🔄 FamilyContext: Joining family with code...');
      const family = await familyApiService.joinFamily({ inviteCode } as JoinFamilyRequest);
      console.log('✅ FamilyContext: Family joined:', family.id);
      return family;
    },
    onSuccess: async () => {
      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
      await queryClient.invalidateQueries({ queryKey: ['family-permissions'] });
    },
  });

  /**
   * Mutation: Leave Family
   * Invalidates: current-family, family-permissions
   */
  const leaveFamilyMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Leaving family...');
      await familyApiService.leaveFamily(familyQuery.data.id);
      console.log('✅ FamilyContext: Family left');
    },
    onSuccess: async () => {
      // Clear all family-related queries
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
      await queryClient.invalidateQueries({ queryKey: ['family-permissions'] });
    },
  });

  /**
   * Mutation: Update Family Name
   * Invalidates: current-family
   */
  const updateFamilyNameMutation = useMutation({
    mutationFn: async (name: string): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Updating family name...');
      await familyApiService.updateFamilyName(name);
      console.log('✅ FamilyContext: Family name updated');
    },
    onSuccess: async () => {
      // Invalidate family data to get updated name
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
    },
  });

  /**
   * Mutation: Invite Member
   * Invalidates: family-invitations (to refresh pending invitations list)
   *
   * NOTE: Does NOT invalidate current-family because sending an invitation
   * doesn't modify the family object. Invitations are separate entities.
   */
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; personalMessage?: string }): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Inviting member:', data.email);
      await familyApiService.inviteMember(familyQuery.data.id, {
        familyId: familyQuery.data.id,
        email: data.email,
        role: data.role as FamilyRole,
        personalMessage: data.personalMessage
      } as CreateFamilyInvitationRequest);
      console.log('✅ FamilyContext: Member invited');
    },
    onSuccess: async () => {
      // Only invalidate invitations list - family object is unchanged
      await queryClient.invalidateQueries({ queryKey: ['family-invitations'] });
    },
  });

  /**
   * Mutation: Update Member Role
   * Invalidates: current-family, family-permissions
   */
  const updateMemberRoleMutation = useMutation({
    mutationFn: async (data: { memberId: string; role: string }): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Updating member role:', data.memberId);
      await familyApiService.updateMemberRole(data.memberId, { role: data.role as FamilyRole } as UpdateMemberRoleRequest);
      console.log('✅ FamilyContext: Member role updated');
    },
    onSuccess: async () => {
      // Invalidate family data to get updated roles
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
      await queryClient.invalidateQueries({ queryKey: ['family-permissions'] });
    },
  });

  /**
   * Mutation: Remove Member
   * Invalidates: current-family
   */
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Removing member:', memberId);
      await familyApiService.removeMember(familyQuery.data.id, memberId);
      console.log('✅ FamilyContext: Member removed');
    },
    onSuccess: async () => {
      // Invalidate family data to get updated member list
      await queryClient.invalidateQueries({ queryKey: ['current-family'] });
      await queryClient.invalidateQueries({ queryKey: ['family-permissions'] });
    },
  });

  /**
   * Mutation: Cancel Invitation
   * Invalidates: family-invitations (to refresh pending invitations list)
   *
   * NOTE: Does NOT invalidate current-family because cancelling an invitation
   * doesn't modify the family object. Invitations are separate entities.
   */
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string): Promise<void> => {
      if (!familyQuery.data?.id) {
        throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
      }
      console.log('🔄 FamilyContext: Cancelling invitation:', invitationId);
      await familyApiService.cancelInvitation(familyQuery.data.id, invitationId);
      console.log('✅ FamilyContext: Invitation cancelled');
    },
    onSuccess: async () => {
      // Only invalidate invitations list - family object is unchanged
      await queryClient.invalidateQueries({ queryKey: ['family-invitations'] });
    },
  });

  // ============================================================================
  // UTILITY FUNCTIONS - Non-mutating operations
  // ============================================================================

  /**
   * Generate Invite Code
   * Does not invalidate cache (just returns a code)
   */
  const generateInviteCode = useCallback(async (): Promise<string> => {
    if (!familyQuery.data?.id) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }
    console.log('🔄 FamilyContext: Generating invite code...');
    const inviteCode = await familyApiService.generateInviteCode();
    console.log('✅ FamilyContext: Invite code generated');
    return inviteCode;
  }, [familyQuery.data?.id]);

  /**
   * Get Pending Invitations
   * Does not use cache (always fresh data from API)
   */
  const getPendingInvitations = useCallback(async (): Promise<FamilyInvitation[]> => {
    if (!familyQuery.data?.id) {
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, 'No family selected');
    }
    console.log('🔄 FamilyContext: Fetching pending invitations...');
    const invitations = await familyApiService.getInvitations(familyQuery.data.id);
    console.log('✅ FamilyContext: Pending invitations fetched:', invitations.length);
    return invitations;
  }, [familyQuery.data?.id]);

  // ============================================================================
  // DERIVED STATE - Computed from query results
  // ============================================================================

  const currentFamily = familyQuery.data ?? null;
  const userPermissions = permissionsQuery.data ?? null;
  const isLoading = familyQuery.isLoading || permissionsQuery.isLoading;
  const isCheckingFamily = familyQuery.isLoading || permissionsQuery.isLoading;
  const hasFamily = !!currentFamily;

  // User requires family if:
  // - Not currently loading
  // - Authenticated
  // - No family data returned
  const requiresFamily = !isLoading && isAuthenticated && !familyQuery.isError && !currentFamily;

  // ============================================================================
  // WRAPPER FUNCTIONS - Error handling and type safety
  // ============================================================================

  const createFamily = useCallback(async (name: string): Promise<Family> => {
    try {
      return await createFamilyMutation.mutateAsync(name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create family';
      throw createFamilyError(FAMILY_ERROR_CODES.INVALID_FAMILY_NAME, errorMessage);
    }
  }, [createFamilyMutation]);

  const joinFamily = useCallback(async (inviteCode: string): Promise<Family> => {
    try {
      return await joinFamilyMutation.mutateAsync(inviteCode);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join family';

      let errorCode: string = FAMILY_ERROR_CODES.INVALID_INVITE_CODE;
      if (errorMessage.includes('already in family')) {
        errorCode = FAMILY_ERROR_CODES.USER_ALREADY_IN_FAMILY;
      } else if (errorMessage.includes('full')) {
        errorCode = FAMILY_ERROR_CODES.FAMILY_FULL;
      }

      throw createFamilyError(errorCode, errorMessage);
    }
  }, [joinFamilyMutation]);

  const leaveFamily = useCallback(async (): Promise<void> => {
    try {
      await leaveFamilyMutation.mutateAsync();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave family';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [leaveFamilyMutation]);

  const updateFamilyName = useCallback(async (name: string): Promise<void> => {
    try {
      await updateFamilyNameMutation.mutateAsync(name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update family name';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [updateFamilyNameMutation]);

  const inviteMember = useCallback(async (email: string, role: string, personalMessage?: string): Promise<void> => {
    try {
      await inviteMemberMutation.mutateAsync({ email, role, personalMessage });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite member';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [inviteMemberMutation]);

  const updateMemberRole = useCallback(async (memberId: string, role: string): Promise<void> => {
    try {
      await updateMemberRoleMutation.mutateAsync({ memberId, role });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update member role';

      let errorCode: string = FAMILY_ERROR_CODES.UNAUTHORIZED;
      if (errorMessage.includes('last admin')) {
        errorCode = FAMILY_ERROR_CODES.LAST_ADMIN;
      } else if (errorMessage.includes('not found')) {
        errorCode = FAMILY_ERROR_CODES.MEMBER_NOT_FOUND;
      }

      throw createFamilyError(errorCode, errorMessage);
    }
  }, [updateMemberRoleMutation]);

  const removeMember = useCallback(async (memberId: string): Promise<void> => {
    try {
      await removeMemberMutation.mutateAsync(memberId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove member';

      let errorCode: string = FAMILY_ERROR_CODES.UNAUTHORIZED;
      if (errorMessage.includes('cannot remove self')) {
        errorCode = FAMILY_ERROR_CODES.CANNOT_REMOVE_SELF;
      } else if (errorMessage.includes('not found')) {
        errorCode = FAMILY_ERROR_CODES.MEMBER_NOT_FOUND;
      }

      throw createFamilyError(errorCode, errorMessage);
    }
  }, [removeMemberMutation]);

  const cancelInvitation = useCallback(async (invitationId: string): Promise<void> => {
    try {
      await cancelInvitationMutation.mutateAsync(invitationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel invitation';
      throw createFamilyError(FAMILY_ERROR_CODES.UNAUTHORIZED, errorMessage);
    }
  }, [cancelInvitationMutation]);

  const clearError = useCallback(() => {
    // Clear errors from queries
    queryClient.resetQueries({ queryKey: ['current-family'] });
    queryClient.resetQueries({ queryKey: ['family-permissions'] });
  }, [queryClient]);

  // ============================================================================
  // CONTEXT VALUE - Memoized for stability
  // ============================================================================

  const value: FamilyContextType = useMemo(() => ({
    currentFamily,
    userPermissions,
    isLoading,
    isCheckingFamily,
    requiresFamily,
    error: (familyQuery.error instanceof Error ? familyQuery.error.message : null) ??
            (permissionsQuery.error instanceof Error ? permissionsQuery.error.message : null) ??
            null,
    createFamily,
    joinFamily,
    leaveFamily,
    updateFamilyName,
    inviteMember,
    updateMemberRole,
    removeMember,
    generateInviteCode,
    getPendingInvitations,
    cancelInvitation,
    clearError,
    hasFamily
  }), [
    currentFamily,
    userPermissions,
    isLoading,
    isCheckingFamily,
    requiresFamily,
    familyQuery.error,
    permissionsQuery.error,
    createFamily,
    joinFamily,
    leaveFamily,
    updateFamilyName,
    inviteMember,
    updateMemberRole,
    removeMember,
    generateInviteCode,
    getPendingInvitations,
    cancelInvitation,
    clearError,
    hasFamily
  ]);

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
};
