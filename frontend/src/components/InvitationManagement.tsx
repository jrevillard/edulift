import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus,
  Mail,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export interface BaseInvitation {
  id: string;
  email: string;
  role: string;
  personalMessage?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
}

export interface BaseMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface InvitationManagementProps<TInvitation extends BaseInvitation, TMember extends BaseMember> {
  // Data
  members: TMember[];
  pendingInvitations: TInvitation[];
  loadingInvitations: boolean;
  isAdmin: boolean;
  
  // Configuration
  entityType: 'family' | 'group';
  roleOptions: { value: string; label: string }[];
  
  // Actions
  onInviteMember: (data: {
    email: string;
    role: string;
    personalMessage?: string;
  }) => Promise<void>;
  onCancelInvitation: (invitationId: string) => void;
  
  // Member actions (passed through)
  memberActions?: React.ReactNode;
  
  // Render member function to handle different member structures
  renderMember: (member: TMember, index?: number) => React.ReactNode;
}

export function InvitationManagement<TInvitation extends BaseInvitation, TMember extends BaseMember>({
  members,
  pendingInvitations,
  loadingInvitations,
  isAdmin,
  entityType,
  roleOptions,
  onInviteMember,
  onCancelInvitation,
  renderMember,
}: InvitationManagementProps<TInvitation, TMember>) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(roleOptions[0]?.value || '');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError('');

    try {
      await onInviteMember({
        email: inviteEmail,
        role: inviteRole,
        personalMessage: inviteMessage || undefined,
      });

      // Only reset and close dialog on success
      setInviteEmail('');
      setInviteRole(roleOptions[0]?.value || '');
      setInviteMessage('');
      setShowInviteDialog(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const totalCount = members.length + pendingInvitations.length;
  const entityDisplayName = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return (
    <div className="space-y-4">
      {/* Header with invite button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span data-testid="InvitationManagement-Text-membersCount">Members ({totalCount})</span>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setShowInviteDialog(true)}
            className="gap-2"
            data-testid="InvitationManagement-Button-inviteMember"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        )}
      </div>

      {/* Members and Invitations List */}
      <div className="space-y-3" data-testid="InvitationManagement-Container-memberList">
        {/* Active Members */}
        {members.map((member, index) => (
          <div key={`member-${member.id}`}>
            {renderMember(member, index)}
          </div>
        ))}

        {/* Pending Invitations */}
        {isAdmin && pendingInvitations.map((invitation) => (
          <div
            key={`invitation-${invitation.id}`}
            className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Mail className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium" data-testid="InvitationManagement-Text-pendingInvitationEmail">{invitation.email}</p>
                <div className="text-sm text-muted-foreground">
                  <span>Expires: {new Date(invitation.expiresAt).toLocaleString()}</span>
                  {invitation.personalMessage && (
                    <>
                      <br />
                      <span className="text-xs italic" data-testid="InvitationManagement-Text-pendingInvitationMessage">"{invitation.personalMessage}"</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-orange-600 border-orange-300" data-testid="InvitationManagement-Badge-pendingInvitationRole">
                PENDING {invitation.role}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCancelInvitation(invitation.id)}
                aria-label="Cancel invitation"
                data-testid="InvitationManagement-Button-cancelInvitation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* Loading State */}
        {isAdmin && loadingInvitations && (
          <div className="flex items-center justify-center p-4 rounded-lg border border-dashed">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground" data-testid="InvitationManagement-Text-loadingInvitations">Loading invitations...</span>
          </div>
        )}

        {/* Empty State */}
        {members.length === 0 && pendingInvitations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="InvitationManagement-Text-noMembers">
            No members or pending invitations
          </p>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {entityDisplayName} Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your {entityType}. They will receive an email with instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                data-testid="InvitationManagement-Input-inviteEmail"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="InvitationManagement-Select-memberRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-message">Personal Message (Optional)</Label>
              <Input
                id="invite-message"
                placeholder="Add a personal message"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                data-testid="InvitationManagement-Input-invitationMessage"
              />
            </div>
            
            {/* Error display */}
            {inviteError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false);
                setInviteEmail('');
                setInviteRole(roleOptions[0]?.value || '');
                setInviteMessage('');
                setInviteError('');
              }}
              data-testid="InvitationManagement-Button-cancelInvitationDialog"
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()} data-testid="InvitationManagement-Button-sendInvitation">
              {isInviting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}