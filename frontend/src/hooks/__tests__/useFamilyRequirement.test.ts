import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFamilyRequirement } from '../useFamilyRequirement';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { useConnectionStore } from '../../stores/connectionStore';

// Mock the dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/FamilyContext');
vi.mock('../../stores/connectionStore');

const mockUseAuth = vi.mocked(useAuth);
const mockUseFamily = vi.mocked(useFamily);
const mockUseConnectionStore = vi.mocked(useConnectionStore);

describe('useFamilyRequirement', () => {
  const defaultAuthState = {
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    verifyMagicLink: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn()
  };

  const defaultFamilyState = {
    currentFamily: null,
    userPermissions: null,
    requiresFamily: false,
    isCheckingFamily: false,
    isLoading: false,
    error: null,
    hasFamily: true,
    createFamily: vi.fn(),
    joinFamily: vi.fn(),
    leaveFamily: vi.fn(),
    refreshFamily: vi.fn(),
    updateFamilyName: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    generateInviteCode: vi.fn(),
    getPendingInvitations: vi.fn(),
    cancelInvitation: vi.fn(),
    clearError: vi.fn()
  };

  const defaultConnectionStore = {
    wsStatus: 'connected' as const,
    wsError: null,
    apiStatus: 'connected' as const,
    apiError: null,
    recentErrors: [],
    setWsStatus: vi.fn(),
    setApiStatus: vi.fn(),
    clearErrors: vi.fn(),
    isConnected: vi.fn(() => true),
    hasConnectionIssues: vi.fn(() => false),
    getConnectionMessage: vi.fn(() => null)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthState);
    mockUseFamily.mockReturnValue(defaultFamilyState);
    mockUseConnectionStore.mockReturnValue(defaultConnectionStore);
  });

  describe('Loading states', () => {
    it('should return loading when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isLoading: true
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'loading' });
    });

    it('should return loading when family is checking', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        isCheckingFamily: true
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'loading' });
    });

    it('should return loading when family is loading', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        isLoading: true
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'loading' });
    });

    it('should prioritize loading over other states', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: false,
        isLoading: true
      });

      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'loading' });
    });
  });

  describe('Authentication states', () => {
    it('should return unauthenticated when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: false,
        user: null
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'unauthenticated' });
    });

    it('should prioritize unauthenticated over family requirements', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: false,
        user: null
      });

      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'unauthenticated' });
    });
  });

  describe('Connection error states', () => {
    beforeEach(() => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => true)
      });
    });

    it('should return connection_error when there are connection issues', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => true),
        getConnectionMessage: vi.fn(() => 'Cannot connect to server')
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ 
        type: 'connection_error', 
        message: 'Cannot connect to server' 
      });
    });

    it('should use default message when getConnectionMessage returns null', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => true),
        getConnectionMessage: vi.fn(() => null)
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ 
        type: 'connection_error', 
        message: 'Unable to connect to server' 
      });
    });

    it('should prioritize connection error over family requirements', () => {
      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => true),
        getConnectionMessage: vi.fn(() => 'Network error')
      });

      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ 
        type: 'connection_error', 
        message: 'Network error' 
      });
    });
  });

  describe('Family requirement states', () => {
    it('should return family_required when requiresFamily is true', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_required' });
    });

    it('should return family_required when hasFamily is false', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: false,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_required' });
    });

    it('should return family_required when both requiresFamily is true and hasFamily is false', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_required' });
    });
  });

  describe('Family satisfied state', () => {
    it('should return family_satisfied when user has family', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: false,
        hasFamily: true
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_satisfied' });
    });

    it('should return family_satisfied even when requiresFamily is false and hasFamily is true', () => {
      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: false,
        hasFamily: true,
        currentFamily: {
          id: 'family-1',
          name: 'Test Family',
          inviteCode: 'ABC123',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          members: [],
          children: [],
          vehicles: []
        }
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_satisfied' });
    });
  });

  describe('State transitions', () => {
    it('should handle complex scenarios with proper priority order', () => {
      // All conditions set, but loading should take priority
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isLoading: true,
        isAuthenticated: false
      });

      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: true,
        hasFamily: false,
        isCheckingFamily: true
      });

      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => true)
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'loading' });
    });

    it('should handle edge case where all non-loading conditions are met', () => {
      mockUseAuth.mockReturnValue({
        ...defaultAuthState,
        isAuthenticated: true
      });

      mockUseFamily.mockReturnValue({
        ...defaultFamilyState,
        requiresFamily: false,
        hasFamily: true
      });

      mockUseConnectionStore.mockReturnValue({
        ...defaultConnectionStore,
        hasConnectionIssues: vi.fn(() => false)
      });

      const { result } = renderHook(() => useFamilyRequirement());
      expect(result.current).toEqual({ type: 'family_satisfied' });
    });
  });
});