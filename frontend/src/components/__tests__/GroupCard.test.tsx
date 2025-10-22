import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, it, describe, expect } from 'vitest';
import GroupCard from '../GroupCard';
import type { UserGroup } from '../../services/apiService';

const mockUserGroup: UserGroup = {
  id: '1',
  name: 'Test Group',
  inviteCode: 'invite123',
  familyId: 'family-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  userRole: 'MEMBER' as const,
  joinedAt: '2024-01-01T00:00:00Z',
  ownerFamily: {
    id: 'family-1',
    name: 'Smith Family'
  },
  familyCount: 3,
  scheduleCount: 2
};

const mockAdminUserGroup: UserGroup = {
  id: '2',
  name: 'Admin Group',
  inviteCode: 'invite456',
  familyId: 'family-2',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  userRole: 'ADMIN' as const,
  joinedAt: '2024-01-01T00:00:00Z',
  ownerFamily: {
    id: 'family-2',
    name: 'Johnson Family'
  },
  familyCount: 2,
  scheduleCount: 1
};

describe('GroupCard', () => {
  const mockOnSelect = vi.fn();
  const mockOnManage = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnManage.mockClear();
  });

  it('renders group information correctly', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    expect(screen.getByTestId('GroupCard-Heading-groupName')).toHaveTextContent('Test Group');
    expect(screen.getByTestId('GroupCard-Badge-groupRole')).toHaveTextContent('MEMBER');
    expect(screen.getByTestId('GroupCard-Text-familyCount')).toHaveTextContent('3 families');
    expect(screen.getByTestId('GroupCard-Text-groupOwner')).toHaveTextContent('Owner: Smith Family');
  });

  it('handles singular member count correctly', () => {
    const singleMemberGroup = {
      ...mockUserGroup,
      familyCount: 1
    };

    render(
      <GroupCard
        group={singleMemberGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    expect(screen.getByTestId('GroupCard-Text-familyCount')).toHaveTextContent('1 family');
  });

  it('shows View Schedule button for all users', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    expect(screen.getByTestId('GroupCard-Button-viewSchedule')).toBeInTheDocument();
  });

  it('shows Manage button only for admin users', () => {
    render(
      <GroupCard
        group={mockAdminUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    // For admin users, both buttons should be present
    expect(screen.getByTestId('GroupCard-Button-viewSchedule')).toBeInTheDocument();
    expect(screen.getByTestId('GroupCard-Button-manageGroup')).toBeInTheDocument();
  });

  it('does not show Manage button for non-admin users', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    // For non-admin users, only view button should be present
    expect(screen.getByTestId('GroupCard-Button-viewSchedule')).toBeInTheDocument();
    expect(screen.queryByTestId('GroupCard-Button-manageGroup')).not.toBeInTheDocument();
  });

  it('calls onSelect when View Schedule button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    await user.click(screen.getByTestId('GroupCard-Button-viewSchedule'));
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });

  it('calls onManage when Manage button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <GroupCard
        group={mockAdminUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    await user.click(screen.getByTestId('GroupCard-Button-manageGroup'));
    expect(mockOnManage).toHaveBeenCalledWith('2');
  });

  it('displays correct badge variant for admin role', () => {
    render(
      <GroupCard
        group={mockAdminUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    expect(screen.getByTestId('GroupCard-Badge-groupRole')).toHaveTextContent('ADMIN');
  });

  it('displays correct badge variant for member role', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    expect(screen.getByTestId('GroupCard-Badge-groupRole')).toHaveTextContent('MEMBER');
  });

  it('has accessible card structure', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    // Should have proper heading structure
    expect(screen.getByTestId('GroupCard-Heading-groupName')).toHaveTextContent('Test Group');
    expect(screen.getByTestId('GroupCard-Card-groupCard')).toBeInTheDocument();
  });

  it('applies hover effects correctly', () => {
    render(
      <GroupCard
        group={mockUserGroup}
        onSelect={mockOnSelect}
        onManage={mockOnManage}
      />
    );

    const card = screen.getByTestId('GroupCard-Card-groupCard');
    expect(card).toHaveClass('hover:shadow-md', 'transition-shadow');
  });
});