import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { GroupMembershipWarning } from '../GroupMembershipWarning';
import type { Child } from '../../services/apiService';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock OnboardingBanner component
vi.mock('../ui/onboarding-banner', () => ({
  OnboardingBanner: ({ 
    title, 
    description, 
    actionText, 
    onAction, 
    onDismiss, 
    children: bannerChildren,
    progress,
    type
  }: {
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
    onDismiss?: () => void;
    children?: React.ReactNode;
    progress?: { completed: number; total: number };
    type: string;
  }) => (
    <div data-testid="onboarding-banner" data-type={type}>
      <h3>{title}</h3>
      <p>{description}</p>
      {progress && (
        <div data-testid="progress">
          {progress.completed}/{progress.total}
        </div>
      )}
      {actionText && (
        <button onClick={onAction} data-testid="action-button">
          {actionText}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} data-testid="dismiss-button">
          Dismiss
        </button>
      )}
      {bannerChildren}
    </div>
  ),
}));

const createMockChild = (id: string, name: string, hasGroups: boolean = false): Child => ({
  id,
  name,
  age: 8,
  groupMemberships: hasGroups ? [{ 
    id: `membership-${id}`, 
    role: 'MEMBER' as const, 
    group: { 
      id: `group-${id}`, 
      name: 'Test Group' 
    } 
  }] : []
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('GroupMembershipWarning', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('does not render when all children have groups', () => {
    const childrenWithGroups = [
      createMockChild('1', 'Alice', true),
      createMockChild('2', 'Bob', true)
    ];

    const { container } = renderWithRouter(
      <GroupMembershipWarning children={childrenWithGroups} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when no children provided', () => {
    const { container } = renderWithRouter(
      <GroupMembershipWarning children={[]} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders warning for single child without group', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', true)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="dashboard" />
    );

    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('Alice needs a group');
    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('Add Alice to a group to include them in trip planning');
  });

  it('renders warning for multiple children without groups', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', false),
      createMockChild('3', 'Charlie', true)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="dashboard" />
    );

    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('2 children need groups');
    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('Add your children to groups to include them in trip planning');
  });

  it('shows correct progress information', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', true),
      createMockChild('3', 'Charlie', true)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} />
    );

    expect(screen.getByTestId('progress')).toHaveTextContent('2/3');
  });

  it('navigates to children page when dashboard variant action is clicked', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="dashboard" />
    );

    fireEvent.click(screen.getByTestId('action-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/children');
  });

  it('does not show action button for children-page variant since users are already there', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="children-page" />
    );

    expect(screen.queryByTestId('action-button')).not.toBeInTheDocument();
  });

  it('shows correct action text for dashboard variant with single child', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="dashboard" />
    );

    expect(screen.getByTestId('action-button')).toHaveTextContent('Add to group');
  });

  it('shows correct action text for dashboard variant with multiple children', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', false)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="dashboard" />
    );

    expect(screen.getByTestId('action-button')).toHaveTextContent('Manage children');
  });

  it('does not show action text for children-page variant', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="children-page" />
    );

    // Should not have any action button or text since users are already on the right page
    expect(screen.queryByTestId('action-button')).not.toBeInTheDocument();
  });

  it('can be dismissed when showDismiss is true', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} showDismiss={true} />
    );

    expect(screen.getByTestId('dismiss-button')).toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(screen.queryByTestId('onboarding-banner')).not.toBeInTheDocument();
  });

  it('does not show dismiss button when showDismiss is false', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} showDismiss={false} />
    );

    expect(screen.queryByTestId('dismiss-button')).not.toBeInTheDocument();
  });

  it('shows children without groups in children-page variant for 3 or fewer children', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', false),
      createMockChild('3', 'Charlie', true)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="children-page" />
    );

    expect(screen.getByTestId('GroupMembershipWarning-Label-childrenWithoutGroups')).toBeInTheDocument();
    expect(screen.getByTestId('child-without-group-1')).toHaveTextContent('Alice');
    expect(screen.getByTestId('child-without-group-2')).toHaveTextContent('Bob');
    expect(screen.queryByTestId('child-without-group-3')).not.toBeInTheDocument();
  });

  it('does not show individual children names when more than 3 children without groups', () => {
    const children = [
      createMockChild('1', 'Alice', false),
      createMockChild('2', 'Bob', false),
      createMockChild('3', 'Charlie', false),
      createMockChild('4', 'David', false),
      createMockChild('5', 'Eve', true)
    ];

    renderWithRouter(
      <GroupMembershipWarning children={children} variant="children-page" />
    );

    expect(screen.queryByTestId('GroupMembershipWarning-Label-childrenWithoutGroups')).not.toBeInTheDocument();
    expect(screen.queryByTestId('child-without-group-1')).not.toBeInTheDocument();
  });

  it('passes correct type to OnboardingBanner', () => {
    const children = [createMockChild('1', 'Alice', false)];

    renderWithRouter(
      <GroupMembershipWarning children={children} />
    );

    expect(screen.getByTestId('onboarding-banner')).toHaveAttribute('data-type', 'incomplete-setup');
  });

  it('handles children with undefined groupMemberships', () => {
    const childWithUndefinedGroups = {
      id: '1',
      name: 'Alice',
      age: 8,
      groupMemberships: undefined
    } as Child;

    renderWithRouter(
      <GroupMembershipWarning children={[childWithUndefinedGroups]} />
    );

    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('Alice needs a group');
  });

  it('handles children with null groupMemberships', () => {
    const childWithNullGroups = {
      id: '1',
      name: 'Alice',
      age: 8,
      groupMemberships: null
    } as unknown as Child;

    renderWithRouter(
      <GroupMembershipWarning children={[childWithNullGroups]} />
    );

    expect(screen.getByTestId('onboarding-banner')).toHaveTextContent('Alice needs a group');
  });
});