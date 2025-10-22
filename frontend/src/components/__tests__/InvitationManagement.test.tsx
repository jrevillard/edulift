import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { InvitationManagement } from '../InvitationManagement';
import type { BaseInvitation, BaseMember } from '../InvitationManagement';

// Mock UI components
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: string;
  variant?: string;
  disabled?: boolean;
}

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: ButtonProps) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
  className?: string;
}

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: BadgeProps) => (
    <span className={`badge ${variant} ${className}`}>{children}</span>
  ),
}));

interface InputProps {
  id?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputProps) => <input {...props} />,
}));

interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelProps) => <label {...props}>{children}</label>,
}));

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DialogChildProps {
  children: React.ReactNode;
}

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: DialogProps) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: DialogChildProps) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: DialogChildProps) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: DialogChildProps) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: DialogChildProps) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: DialogChildProps) => <h2 data-testid="dialog-title">{children}</h2>,
}));

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
}

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: SelectProps) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: DialogChildProps) => <>{children}</>,
  SelectItem: ({ children, value }: SelectItemProps) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: DialogChildProps) => <div>{children}</div>,
  SelectValue: () => <span>Select value</span>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  UserPlus: () => <span data-testid="user-plus-icon">UserPlus</span>,
  Mail: () => <span data-testid="mail-icon">Mail</span>,
  X: () => <span data-testid="x-icon">X</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
}));

interface TestMember extends BaseMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface TestInvitation extends BaseInvitation {
  id: string;
  email: string;
  role: string;
  personalMessage?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
}

const mockMembers: TestMember[] = [
  {
    id: '1',
    role: 'ADMIN',
    user: {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    },
  },
  {
    id: '2',
    role: 'PARENT',
    user: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  },
];

const mockInvitations: TestInvitation[] = [
  {
    id: 'inv1',
    email: 'pending@example.com',
    role: 'PARENT',
    personalMessage: 'Welcome to our family!',
    status: 'PENDING',
    expiresAt: '2024-12-31T23:59:59Z',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const mockRoleOptions = [
  { value: 'PARENT', label: 'Parent' },
  { value: 'ADMIN', label: 'Admin' },
];

const defaultProps = {
  members: mockMembers,
  pendingInvitations: mockInvitations,
  loadingInvitations: false,
  isAdmin: true,
  entityType: 'family' as const,
  roleOptions: mockRoleOptions,
  onInviteMember: vi.fn(),
  onCancelInvitation: vi.fn(),
  renderMember: (member: TestMember) => (
    <div key={member.id} data-testid={`member-${member.id}`}>
      <span>{member.user.name}</span>
      <span>{member.user.email}</span>
      <span>{member.role}</span>
    </div>
  ),
};

describe('InvitationManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders members and pending invitations correctly', () => {
    render(<InvitationManagement {...defaultProps} />);

    // Check if members are rendered
    expect(screen.getByTestId('member-1')).toBeInTheDocument();
    expect(screen.getByTestId('member-2')).toBeInTheDocument();
    expect(screen.getByTestId('member-1')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('member-2')).toHaveTextContent('Jane Smith');

    // Check if pending invitation is rendered
    expect(screen.getByTestId('InvitationManagement-Text-pendingInvitationEmail')).toHaveTextContent('pending@example.com');
    expect(screen.getByText('PENDING PARENT')).toBeInTheDocument();
    expect(screen.getByTestId('InvitationManagement-Text-pendingInvitationMessage')).toHaveTextContent('"Welcome to our family!"');
  });

  it('shows invite button only for admins', () => {
    const { rerender } = render(<InvitationManagement {...defaultProps} />);

    // Admin should see invite button
    expect(screen.getByTestId('InvitationManagement-Button-inviteMember')).toBeInTheDocument();

    // Non-admin should not see invite button
    rerender(<InvitationManagement {...defaultProps} isAdmin={false} />);
    expect(screen.queryByTestId('InvitationManagement-Button-inviteMember')).not.toBeInTheDocument();
  });

  it('opens invite dialog when invite button is clicked', async () => {
    render(<InvitationManagement {...defaultProps} />);

    const inviteButton = screen.getByTestId('InvitationManagement-Button-inviteMember');
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Invite Family Member');
    });
  });

  it('calls onInviteMember with correct data when form is submitted', async () => {
    render(<InvitationManagement {...defaultProps} />);

    // Open invite dialog
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-inviteMember'));

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    // Fill form
    const emailInput = screen.getByTestId('InvitationManagement-Input-inviteEmail');
    const messageInput = screen.getByTestId('InvitationManagement-Input-invitationMessage');
    const roleSelect = screen.getByTestId('select');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Welcome aboard!' } });
    fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

    // Submit form
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-sendInvitation'));

    expect(defaultProps.onInviteMember).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      role: 'ADMIN',
      personalMessage: 'Welcome aboard!',
    });
  });

  it('calls onCancelInvitation when cancel button is clicked', () => {
    render(<InvitationManagement {...defaultProps} />);

    const cancelButton = screen.getByTestId('InvitationManagement-Button-cancelInvitation');
    fireEvent.click(cancelButton);

    expect(defaultProps.onCancelInvitation).toHaveBeenCalledWith('inv1');
  });

  it('shows loading state when loadingInvitations is true', () => {
    render(<InvitationManagement {...defaultProps} loadingInvitations={true} />);

    expect(screen.getByTestId('InvitationManagement-Text-loadingInvitations')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });

  it('shows empty state when no members or invitations', () => {
    render(
      <InvitationManagement
        {...defaultProps}
        members={[]}
        pendingInvitations={[]}
      />
    );

    expect(screen.getByTestId('InvitationManagement-Text-noMembers')).toBeInTheDocument();
  });

  it('displays correct total count in header', () => {
    render(<InvitationManagement {...defaultProps} />);

    // 2 members + 1 invitation = 3 total
    expect(screen.getByTestId('InvitationManagement-Text-membersCount')).toHaveTextContent('Members (3)');
  });

  it('formats expiry date with time correctly', () => {
    render(<InvitationManagement {...defaultProps} />);

    // Check that the invitation container contains expiry information
    const invitationElement = screen.getByTestId('InvitationManagement-Text-pendingInvitationEmail').closest('div');
    expect(invitationElement).toHaveTextContent(/Expires:/);
    // The date should be formatted correctly regardless of timezone
    // We'll check for both possible values depending on the user's timezone
    const textContent = invitationElement?.textContent;
    expect(textContent).toMatch(/Expires: (12\/31\/2024, 11:59:59 PM|1\/1\/2025, 12:59:59 AM)/);
  });

  it('handles missing personal message gracefully', () => {
    const invitationWithoutMessage: TestInvitation = {
      ...mockInvitations[0],
      personalMessage: undefined,
    };

    render(
      <InvitationManagement
        {...defaultProps}
        pendingInvitations={[invitationWithoutMessage]}
      />
    );

    expect(screen.queryByText('"Welcome to our family!"')).not.toBeInTheDocument();
  });

  it('renders with group entity type correctly', () => {
    render(<InvitationManagement {...defaultProps} entityType="group" />);

    // Open invite dialog to check title
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-inviteMember'));

    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Invite Group Member');
  });

  it('validates email before submission', async () => {
    render(<InvitationManagement {...defaultProps} />);

    // Open invite dialog
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-inviteMember'));

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    // Try to submit without email
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-sendInvitation'));

    // Should not call onInviteMember
    expect(defaultProps.onInviteMember).not.toHaveBeenCalled();
  });

  it('resets form when dialog is closed', async () => {
    render(<InvitationManagement {...defaultProps} />);

    // Open invite dialog
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-inviteMember'));

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    // Fill form
    const emailInput = screen.getByTestId('InvitationManagement-Input-inviteEmail');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Close dialog
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-cancelInvitationDialog'));

    // Reopen dialog and check if form is reset
    fireEvent.click(screen.getByTestId('InvitationManagement-Button-inviteMember'));

    await waitFor(() => {
      const emailInputReopened = screen.getByTestId('InvitationManagement-Input-inviteEmail');
      expect(emailInputReopened).toHaveValue('');
    });
  });
});