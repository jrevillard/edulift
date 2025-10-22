import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FamilyProvider, useFamily } from '../FamilyContext';
import { useAuth } from '../AuthContext';
import { familyApiService } from '../../services/familyApiService';
import React from 'react';

// Mock dependencies
vi.mock('../AuthContext');
vi.mock('../../services/familyApiService');

const mockUseAuth = vi.mocked(useAuth);
const mockFamilyApiService = vi.mocked(familyApiService);

// Test component to access family context
const TestComponent = () => {
  const { requiresFamily, isCheckingFamily, error } = useFamily();
  return (
    <div>
      <div data-testid="requires-family">{requiresFamily.toString()}</div>
      <div data-testid="is-checking">{isCheckingFamily.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
    </div>
  );
};

describe('FamilyContext - Network Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT set requiresFamily to true on network errors', async () => {
    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn()
    });

    // Mock network error when fetching family
    mockFamilyApiService.getCurrentFamily.mockRejectedValue(
      new Error('Failed to fetch')
    );

    const { getByTestId } = render(
      <FamilyProvider>
        <TestComponent />
      </FamilyProvider>
    );

    // Should start checking
    expect(getByTestId('is-checking').textContent).toBe('true');

    // Wait for async operations
    await waitFor(() => {
      expect(getByTestId('is-checking').textContent).toBe('false');
    });

    // Should NOT require family on network error
    expect(getByTestId('requires-family').textContent).toBe('false');
    expect(getByTestId('error').textContent).toBe('Failed to fetch');
  });

  it('should NOT set requiresFamily to true on connection refused errors', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn()
    });

    // Mock connection refused error
    mockFamilyApiService.getCurrentFamily.mockRejectedValue(
      new Error('ERR_CONNECTION_REFUSED')
    );

    const { getByTestId } = render(
      <FamilyProvider>
        <TestComponent />
      </FamilyProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-checking').textContent).toBe('false');
    });

    // Should NOT require family on connection error
    expect(getByTestId('requires-family').textContent).toBe('false');
    expect(getByTestId('error').textContent).toBe('ERR_CONNECTION_REFUSED');
  });

  it('should set requiresFamily to true on non-network errors', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn()
    });

    // Mock non-network error (e.g., authentication error)
    mockFamilyApiService.getCurrentFamily.mockRejectedValue(
      new Error('Unauthorized')
    );

    const { getByTestId } = render(
      <FamilyProvider>
        <TestComponent />
      </FamilyProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-checking').textContent).toBe('false');
    });

    // SHOULD require family on non-network errors
    expect(getByTestId('requires-family').textContent).toBe('true');
    expect(getByTestId('error').textContent).toBe('Unauthorized');
  });

  it('should set requiresFamily to true when family is null (no error)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn()
    });

    // Mock successful response with no family
    mockFamilyApiService.getCurrentFamily.mockResolvedValue(null);

    const { getByTestId } = render(
      <FamilyProvider>
        <TestComponent />
      </FamilyProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-checking').textContent).toBe('false');
    });

    // SHOULD require family when user has no family
    expect(getByTestId('requires-family').textContent).toBe('true');
    expect(getByTestId('error').textContent).toBe('no-error');
  });
});