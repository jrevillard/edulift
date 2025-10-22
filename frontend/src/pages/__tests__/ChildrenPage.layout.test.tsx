import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ChildrenPage from '../ChildrenPage';
import { useFamily } from '../../contexts/FamilyContext';
import { apiService } from '../../services/apiService';
import { createMockApiService } from '../../test/test-utils';
import type { Child } from '../../services/apiService';

// Mock dependencies
vi.mock('../../contexts/FamilyContext');
vi.mock('../../services/apiService');

const mockUseFamily = useFamily as ReturnType<typeof vi.fn>;
const mockApiService = apiService as unknown;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ChildrenPage - Layout and Spacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Apply comprehensive API service mocks
    const comprehensiveMocks = createMockApiService();
    Object.assign(mockApiService, comprehensiveMocks);
    
    mockUseFamily.mockReturnValue({
      refreshFamily: vi.fn().mockResolvedValue(undefined),
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
        children: [],
        members: [],
        vehicles: []
      }
    });

    mockApiService.getUserGroups.mockResolvedValue([]);
  });

  it('should have proper spacing between GroupMembershipWarning and children cards', async () => {
    // This test validates the fix for overlapping UI elements
    // Bug: GroupMembershipWarning was overlapping with first row of children cards
    // Fix: Added mb-6 margin bottom to warning container
    const childrenWithoutGroups: Child[] = [
      {
        id: 'child-1',
        name: 'Alice Smith',
        age: 8,
        familyId: 'family-1',
        groupMemberships: [], // No groups - will trigger warning
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockApiService.getChildren.mockResolvedValue(childrenWithoutGroups);
    mockUseFamily.mockReturnValue({
      refreshFamily: vi.fn().mockResolvedValue(undefined),
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
        children: childrenWithoutGroups,
        members: [],
        vehicles: []
      }
    });

    const { container } = render(
      <TestWrapper>
        <ChildrenPage />
      </TestWrapper>
    );

    // Wait for warning to appear and verify spacing structure
    await waitFor(() => {
      // Find the warning container with mb-6 class (line 363 in ChildrenPage.tsx)
      const warningContainer = container.querySelector('.mb-6');
      expect(warningContainer).toBeInTheDocument();
      
      // Verify warning content is shown
      expect(screen.getByTestId('OnboardingBanner-Title-bannerTitle')).toHaveTextContent('Alice Smith needs a group');
      
      // Verify children cards are rendered after the warning container
      expect(screen.getByTestId('ChildrenPage-Text-childName-child-1')).toHaveTextContent('Alice Smith');
    });
  });

  it('should not show warning container when all children have groups', () => {
    const childrenWithGroups: Child[] = [
      {
        id: 'child-1',
        name: 'Alice Smith',
        age: 8,
        familyId: 'family-1',
        groupMemberships: [
          {
            childId: 'child-1',
            groupId: 'group-1',
            group: { id: 'group-1', name: 'School Group A' },
            addedBy: 'user-1',
            addedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockApiService.getChildren.mockResolvedValue(childrenWithGroups);
    mockUseFamily.mockReturnValue({
      refreshFamily: vi.fn().mockResolvedValue(undefined),
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
        children: childrenWithGroups,
        members: [],
        vehicles: []
      }
    });

    render(
      <TestWrapper>
        <ChildrenPage />
      </TestWrapper>
    );

    // Should not show warning when all children have groups
    expect(screen.queryByTestId('OnboardingBanner-Container-banner')).not.toBeInTheDocument();
  });

  it('should maintain proper grid layout for children cards', async () => {
    const mockChildren: Child[] = [
      {
        id: 'child-1',
        name: 'Alice Smith',
        age: 8,
        familyId: 'family-1',
        groupMemberships: [
          {
            childId: 'child-1',
            groupId: 'group-1',
            group: { id: 'group-1', name: 'School Group A' },
            addedBy: 'user-1',
            addedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'child-2',
        name: 'Bob Johnson',
        age: 6,
        familyId: 'family-1',
        groupMemberships: [
          {
            childId: 'child-2',
            groupId: 'group-1',
            group: { id: 'group-1', name: 'School Group A' },
            addedBy: 'user-1',
            addedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockApiService.getChildren.mockResolvedValue(mockChildren);
    mockUseFamily.mockReturnValue({
      refreshFamily: vi.fn().mockResolvedValue(undefined),
      currentFamily: {
        id: 'family-1',
        name: 'Test Family',
        children: mockChildren,
        members: [],
        vehicles: []
      }
    });

    const { container } = render(
      <TestWrapper>
        <ChildrenPage />
      </TestWrapper>
    );

    // Wait for children to render
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Text-childName-child-1')).toHaveTextContent('Alice Smith');
      expect(screen.getByTestId('ChildrenPage-Text-childName-child-2')).toHaveTextContent('Bob Johnson');
    });

    // Verify grid layout classes are applied (line 374 in ChildrenPage.tsx)
    const gridContainer = container.querySelector('[class*="grid"][class*="grid-cols-1"][class*="gap-8"]');
    expect(gridContainer).toBeInTheDocument();
  });

  it('should show empty state when no children exist', async () => {
    mockApiService.getChildren.mockResolvedValue([]);

    render(
      <TestWrapper>
        <ChildrenPage />
      </TestWrapper>
    );

    // Should show empty state component (wait for loading to complete)
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Container-emptyState')).toBeInTheDocument();
    });
  });
});