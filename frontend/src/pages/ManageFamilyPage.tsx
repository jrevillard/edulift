import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Users,
  Settings,
  MoreVertical,
  UserMinus,
  Shield,
  User,
  Edit,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { InvitationManagement } from '@/components/InvitationManagement';
import type { FamilyMember } from '../services/familyApiService';

const ManageFamilyPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Track mount/unmount and renders
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`🔄 ManageFamilyPage: RENDER #${renderCount.current}`);

  useEffect(() => {
    console.log('✅ ManageFamilyPage: MOUNTED');
    return () => {
      console.log('❌ ManageFamilyPage: UNMOUNTED');
    };
  }, []);
  const {
    currentFamily,
    userPermissions,
    isLoading,
    isCheckingFamily,
    updateMemberRole,
    removeMember,
    inviteMember,
    leaveFamily,
    updateFamilyName,
    getPendingInvitations,
    cancelInvitation,
  } = useFamily();

  // Query for pending invitations (React Query manages caching and loading)
  const invitationsQuery = useQuery({
    queryKey: ['family-invitations', currentFamily?.id],
    queryFn: async () => {
      if (!currentFamily || !userPermissions?.canManageMembers) {
        return [];
      }
      return await getPendingInvitations();
    },
    enabled: !!currentFamily && !!userPermissions?.canManageMembers,
    staleTime: 1 * 60 * 1000,  // 1 minute
    gcTime: 5 * 60 * 1000,     // 5 minutes
  });

  // State for modals and editing
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState<string | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<{
    member: FamilyMember;
    newRole: 'ADMIN' | 'MEMBER';
  } | null>(null);

  // Flag to prevent false redirects during async operations

  // State for notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');


  // State for family name editing
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [editingFamilyName, setEditingFamilyName] = useState('');

  // Derive invitation state from React Query
  const pendingInvitations = invitationsQuery.data ?? [];
  const loadingInvitations = invitationsQuery.isLoading;

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // Show loading spinner while checking family status
  if (isCheckingFamily || isLoading) {
    console.log('⏳ ManageFamilyPage: Loading family data...');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading family data...</p>
        </div>
      </div>
    );
  }

  // Show loading state if family data is temporarily unavailable
  // This prevents redirect during React Query refetch operations
  if (!currentFamily || !userPermissions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading family data...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userPermissions.canManageMembers;
  const canManageChildren = userPermissions.canModifyChildren;


  const handleInviteMember = async (data: {
    email: string;
    role: string;
    personalMessage?: string;
  }) => {
    try {
      await inviteMember(data.email, data.role, data.personalMessage);
      setSuccessMessage('Invitation sent successfully');
      setErrorMessage('');
      // Wait for invitations query to refetch (mutation invalidates it)
      await queryClient.refetchQueries({ queryKey: ['family-invitations'], type: 'active' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send invitation');
      setSuccessMessage('');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember(memberId);
      setSuccessMessage('Member removed successfully');
      setErrorMessage('');
      setShowRemoveMemberDialog(null);
      // Don't refresh family here - removeMember already does it internally
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to remove member';
      setErrorMessage(errorMsg);
      setSuccessMessage('');
    }
  };

  const handleChangeRole = async () => {
    if (memberToChangeRole) {
      try {
        await updateMemberRole(memberToChangeRole.member.id, memberToChangeRole.newRole);
        setSuccessMessage('Member role updated successfully');
        setErrorMessage('');
        setMemberToChangeRole(null);
        // Don't refresh family here - updateMemberRole already does it internally
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to update member role');
        setSuccessMessage('');
      }
    }
  };

  const handleLeaveFamily = async () => {
    try {
      await leaveFamily();
      setSuccessMessage('Left family successfully');
      setErrorMessage('');
      console.log('🚨 ManageFamilyPage [handleLeaveFamily]: REDIRECTING to dashboard');
      console.trace('Redirect call stack');
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to leave family');
      setSuccessMessage('');
    }
  };

  const handleEditFamilyName = () => {
    setEditingFamilyName(currentFamily.name);
    setShowEditNameDialog(true);
  };

  const handleSaveFamilyName = async () => {
    if (!editingFamilyName.trim()) {
      setErrorMessage('Family name cannot be empty');
      return;
    }

    if (editingFamilyName.trim() === currentFamily.name) {
      setShowEditNameDialog(false);
      return;
    }

    try {
      await updateFamilyName(editingFamilyName.trim());
      setSuccessMessage('Family name updated successfully');
      setErrorMessage('');
      setShowEditNameDialog(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update family name');
      setSuccessMessage('');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      setSuccessMessage('Invitation canceled successfully');
      setErrorMessage('');
      await queryClient.invalidateQueries({ queryKey: ['family-invitations'] }); // Refresh invitations list
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel invitation');
      setSuccessMessage('');
    }
  };

  const memberToRemove = currentFamily.members?.find(m => m.id === showRemoveMemberDialog);

  return (
    <div className="space-y-6 p-6" data-testid="ManageFamilyPage-Container-main">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="gap-2"
          data-testid="ManageFamilyPage-Button-backToDashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="ManageFamilyPage-Heading-pageTitle">Family Management</h1>
          </div>
          <p className="text-muted-foreground" data-testid="ManageFamilyPage-Text-pageDescription">
            Manage family settings and members
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <Alert
          className="border-green-200 bg-green-50 text-green-800"
          data-testid={
            successMessage.includes('copied') ? 'ManageFamilyPage-Alert-copySuccess' :
              successMessage.includes('Family name updated') ? 'ManageFamilyPage-Alert-familyNameUpdatedSuccess' :
                'ManageFamilyPage-Alert-invitationSentSuccess'
          }
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert
          className="border-red-200 bg-red-50 text-red-800"
          data-testid={
            errorMessage.toLowerCase().includes('last admin') || errorMessage.toLowerCase().includes('only admin')
              ? 'ManageFamilyPage-Alert-lastAdminError'
              : 'ManageFamilyPage-Alert-errorMessage'
          }
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Family Information Card */}
        <Card data-testid="ManageFamilyPage-Container-familyInformation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="ManageFamilyPage-Title-familyInformationTitle">
              <Users className="h-5 w-5" />
              Family Information
            </CardTitle>
            <CardDescription>
              Basic family details and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="family-name">Family Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="family-name"
                  value={currentFamily.name}
                  disabled
                  className="flex-1"
                  data-testid="ManageFamilyPage-Input-familyNameDisplay"
                />
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditFamilyName}
                    aria-label="Edit family name"
                    data-testid="ManageFamilyPage-Button-editFamily"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>


            <div className="space-y-2">
              <Label>Your Role</Label>
              <Badge variant={isAdmin ? 'default' : canManageChildren ? 'secondary' : 'outline'} data-testid="ManageFamilyPage-Badge-userRole">
                {isAdmin ? 'ADMIN' : 'MEMBER'}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Family Stats</Label>
              <div className="text-sm text-muted-foreground space-y-1" data-testid="ManageFamilyPage-Container-familyStats">
                <p data-testid="ManageFamilyPage-Text-familyMembersCount">{currentFamily.members?.length || 0} member{(currentFamily.members?.length || 0) !== 1 ? 's' : ''}</p>
                <p data-testid="ManageFamilyPage-Text-familyChildrenCount">{currentFamily.children?.length || 0} child{(currentFamily.children?.length || 0) !== 1 ? 'ren' : ''}</p>
                <p data-testid="ManageFamilyPage-Text-familyVehiclesCount">{currentFamily.vehicles?.length || 0} vehicle{(currentFamily.vehicles?.length || 0) !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="ManageFamilyPage-Title-familyMembersTitle">
              <Users className="h-5 w-5" />
              Family Members
            </CardTitle>
            <CardDescription>
              Manage family members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent data-testid="ManageFamilyPage-Container-familyMembersSection">
            <div data-testid="ManageFamilyPage-List-familyMembers">
              <InvitationManagement
                members={currentFamily.members?.map(member => ({
                  id: member.id,
                  userId: member.userId,
                  familyId: member.familyId,
                  joinedAt: member.joinedAt,
                  role: member.role,
                  user: {
                    id: member.user?.id || '',
                    name: member.user?.name || 'Unknown',
                    email: member.user?.email || 'No email',
                  },
                })) || []}
                pendingInvitations={pendingInvitations?.map(invitation => ({
                  id: invitation.id,
                  email: invitation.email,
                  role: invitation.role,
                  personalMessage: invitation.personalMessage || undefined,
                  status: invitation.status === 'DECLINED' ? 'CANCELLED' as const : invitation.status,
                  expiresAt: invitation.expiresAt,
                  createdAt: invitation.createdAt,
                })) ?? []}
                loadingInvitations={loadingInvitations}
                isAdmin={isAdmin}
                entityType="family"
                roleOptions={[
                  { value: 'MEMBER', label: 'Member' },
                  { value: 'ADMIN', label: 'Admin' },
                ]}
                onInviteMember={handleInviteMember}
                onCancelInvitation={handleCancelInvitation}
                renderMember={(member) => (
                  <div
                    key={`member-${member.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`ManageFamilyPage-Card-familyMember-${member.user?.email}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {member.role === 'ADMIN' ? (
                          <Shield className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{member.user?.name || 'Unknown User'}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email || 'No email'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={
                        member.role === 'ADMIN' ? 'default' : 'outline'
                      }>
                        {member.role}
                      </Badge>

                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`ManageFamilyPage-Button-memberMenu-${member.user.email}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setMemberToChangeRole({
                                  member,
                                  newRole: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                                })
                              }
                              data-testid={`ManageFamilyPage-Button-roleToggle-${member.user.email}`}
                              disabled={member.user.id === user?.id && member.role === 'ADMIN'}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              {member.user.id === user?.id && member.role === 'ADMIN'
                                ? 'Cannot change own role'
                                : (member.role as string) === 'ADMIN' ? 'Make Member' : 'Make Admin'
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setShowRemoveMemberDialog(member.id)}
                              className="text-red-600 focus:text-red-600"
                              data-testid={`ManageFamilyPage-Button-removeMember-${member.user.email}`}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )}
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Family Resources Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Children Card */}
        <Card data-testid="ManageFamilyPage-Card-children">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span data-testid="ManageFamilyPage-Heading-childrenCountTitle">Children ({currentFamily.children?.length || 0})</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/children')}
                data-testid="ManageFamilyPage-Button-manageChildren"
              >
                Manage
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentFamily.children && currentFamily.children.length > 0 ? (
              <div className="space-y-2">
                {currentFamily.children?.map((child) => (
                  <div key={child.id} className="flex items-center justify-between p-2 rounded border" data-testid={`ManageFamilyPage-Container-child-${child.id}`}>
                    <span className="font-medium" data-testid={`ManageFamilyPage-Text-childName-${child.id}`}>{child.name}</span>
                    {child.age !== undefined && (
                      <span className="text-sm text-muted-foreground" data-testid={`ManageFamilyPage-Text-childAge-${child.id}`}>
                        {child.age} years old
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No children registered yet</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicles Card */}
        <Card data-testid="ManageFamilyPage-Card-vehicles">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                </svg>
                <span data-testid="ManageFamilyPage-Heading-vehiclesCountTitle">Vehicles ({currentFamily.vehicles?.length || 0})</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/vehicles')}
                data-testid="ManageFamilyPage-Button-manageVehicles"
              >
                Manage
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentFamily.vehicles && currentFamily.vehicles.length > 0 ? (
              <div className="space-y-2">
                {currentFamily.vehicles?.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-2 rounded border" data-testid={`ManageFamilyPage-Container-vehicle-${vehicle.id}`}>
                    <span className="font-medium" data-testid={`ManageFamilyPage-Text-vehicleName-${vehicle.id}`}>{vehicle.name}</span>
                    <span className="text-sm text-muted-foreground" data-testid={`ManageFamilyPage-Text-vehicleCapacity-${vehicle.id}`}>{vehicle.capacity} seats</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No vehicles registered yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      {!isAdmin && (
        <Card className="border-red-500 border-2 bg-red-50/50 dark:bg-red-950/20" data-testid="ManageFamilyPage-Card-dangerZone">
          <CardHeader className="border-b border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-900/20">
            <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2" data-testid="ManageFamilyPage-Heading-dangerZoneTitle">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <Button
              variant="destructive"
              onClick={() => setShowLeaveDialog(true)}
              className="gap-2 w-full"
              data-testid="ManageFamilyPage-Button-leaveFamily"
            >
              <UserMinus className="h-4 w-4" />
              Leave Family
            </Button>

            <p className="text-xs text-gray-500 mt-2">
              As a family member, you can leave this family
            </p>
          </CardContent>
        </Card>
      )}


      {/* Leave Family Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Family</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave "{currentFamily.name}"?
              You will lose access to all family resources including children and vehicles.
              You'll need a new invite code to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveFamily}
              data-testid="ManageFamilyPage-Button-confirmLeaveFamily"
            >
              Leave Family
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={!!showRemoveMemberDialog} onOpenChange={() => setShowRemoveMemberDialog(null)}>
        <DialogContent data-testid="ManageFamilyPage-Modal-removeMemberConfirm">
          <DialogHeader>
            <DialogTitle data-testid="ManageFamilyPage-Heading-removeMemberDialogTitle">Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToRemove?.user?.name || 'this member'} from this family?
              They will lose access to all family resources and need to be re-invited to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRemoveMemberDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRemoveMemberDialog && handleRemoveMember(showRemoveMemberDialog)}
              data-testid="ManageFamilyPage-Button-confirmRemoveMember"
            >
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!memberToChangeRole} onOpenChange={() => setMemberToChangeRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="ManageFamilyPage-Heading-changeRoleDialogTitle">Change Member Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to change {memberToChangeRole?.member.user?.name || 'this member'}'s role to {memberToChangeRole?.newRole}?
              {memberToChangeRole?.newRole === 'ADMIN' && ' This will give them full administrative privileges including managing children and vehicles.'}
              {memberToChangeRole?.newRole === 'MEMBER' && ' This will limit their access to basic family features.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setMemberToChangeRole(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeRole} data-testid="ManageFamilyPage-Button-confirmRoleChange">
              Change Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Family Name Dialog */}
      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="ManageFamilyPage-Heading-editFamilyNameDialogTitle">Edit Family Name</DialogTitle>
            <DialogDescription data-testid="ManageFamilyPage-Text-editFamilyNameDialogDescription">
              Change your family name. All family members will be notified of this change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-family-name">Family Name</Label>
              <Input
                id="edit-family-name"
                placeholder="Enter new family name"
                value={editingFamilyName}
                onChange={(e) => setEditingFamilyName(e.target.value)}
                maxLength={100}
                data-testid="ManageFamilyPage-Input-familyName"
              />
              <p className="text-sm text-muted-foreground" data-testid="ManageFamilyPage-Text-characterCount">
                {editingFamilyName.length}/100 characters
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditNameDialog(false);
                setEditingFamilyName('');
              }}
              data-testid="ManageFamilyPage-Button-cancelEditFamilyName"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveFamilyName}
              disabled={!editingFamilyName.trim() || editingFamilyName.trim() === currentFamily.name}
              data-testid="ManageFamilyPage-Button-saveFamilyName"
            >
              <Edit className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ManageFamilyPage;