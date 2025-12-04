import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
// import { apiService } from '../services/apiService'; // REMOVED: Migration to OpenAPI complete
import { scheduleConfigService } from '../services/scheduleConfigService';
import { GroupScheduleConfigModal } from '../components/GroupScheduleConfigModal';
// import { useSocket } from '../contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LoadingState, ErrorState } from '@/components/ui/empty-states';
import {
  ArrowLeft,
  Users,
  Settings,
  MoreVertical,
  UserMinus,
  UserPlus,
  Shield,
  User,
  Trash2,
  Edit,
  Mail,
  Clock,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { FamilySearchInvitation } from '@/components/FamilySearchInvitation';
// import { InvitationManagement } from '@/components/InvitationManagement';
import type { GroupFamily } from '../types/api';
import { transformGroupFamily } from './OpenAPIFamilyTransform';
import { useFamily } from '../contexts/FamilyContext';

// Helper function to format admin display text
const formatAdminDisplay = (admins: GroupFamily['admins']) => {
  if (!admins || admins.length === 0) return 'No admins';
  if (admins.length === 1) return admins[0].name;
  return `${admins[0].name} (+${admins.length - 1} more)`;
};

// Helper component for admin display with tooltip
const AdminDisplay: React.FC<{ family: GroupFamily }> = ({ family }) => {
  const { admins } = family;
  
  if (!admins || admins.length <= 1) {
    return <span data-testid={`AdminDisplay-Text-single-${family.id}`}>{formatAdminDisplay(admins)}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-help underline decoration-dotted" data-testid={`AdminDisplay-Trigger-multiple-${family.id}`}>
          {formatAdminDisplay(admins)}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs" data-testid={`AdminDisplay-Tooltip-content-${family.id}`}>
          <div className="space-y-1">
            <p className="font-medium text-xs text-muted-foreground" data-testid={`AdminDisplay-Text-header-${family.id}`}>All Administrators:</p>
            {admins?.map((admin, index) => (
              <div key={index} className="text-sm">
                <p className="font-medium">{admin.name}</p>
                <p className="text-xs text-muted-foreground">{admin.email}</p>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ManageGroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFamily: userFamily } = useFamily(); // Get user's family information
  // const { isConnected } = useSocket();

  // State for modals and editing
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [showRemoveFamilyDialog, setShowRemoveFamilyDialog] = useState<string | null>(null);
  const [familyToChangeRole, setFamilyToChangeRole] = useState<{
    family: GroupFamily;
    newRole: 'ADMIN' | 'MEMBER';
  } | null>(null);
  const [showScheduleConfigModal, setShowScheduleConfigModal] = useState(false);
  const [showFamilySearch, setShowFamilySearch] = useState(false);
  
  // State for group editing (modal dialog like family)
  const [showEditGroupDialog, setShowEditGroupDialog] = useState(false);
  const [editedGroupName, setEditedGroupName] = useState('');
  const [editedGroupDescription, setEditedGroupDescription] = useState('');
  
  // State for notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');


  // State for pending invitations
  // const [pendingInvitations, setPendingInvitations] = useState<GroupInvitation[]>([]);
  // const [loadingInvitations, setLoadingInvitations] = useState(false);

  // Real-time updates are now handled centrally in SocketContext
  // No need for duplicate event listeners here

  // Get group info from user groups query (already cached from GroupsPage)
  const { data: userGroups = [] } = useQuery({
    queryKey: ['user-groups'],
    // MIGRATED: Use OpenAPI client to get user groups
    queryFn: () => api.GET('/groups/my-groups').then(result => result.data?.data || []),
  });

  const currentGroup = userGroups.find(group => group.id === groupId);
  const isAdmin = currentGroup?.userRole === 'ADMIN';

  // MIGRATED: Fetch group families with OpenAPI
  const { data: families = [], isLoading: familiesLoading, error: familiesError } = useQuery({
    queryKey: ['group-families', groupId || ''],
    queryFn: () => {
      if (!groupId) return Promise.resolve([]);
      return api.GET('/groups/{groupId}/families', {
        params: { path: { groupId } }
      }).then(result => {
        const openApiFamilies = result.data?.data || [];
        // Transform OpenAPI response to match expected GroupFamily interface
        return openApiFamilies.map(family =>
          transformGroupFamily(family, userFamily?.id, currentGroup)
        );
      });
    },
    enabled: !!groupId,
  });

  // Fetch schedule configuration
  const { data: scheduleConfig } = useQuery({
    queryKey: ['group-schedule-config', groupId],
    queryFn: () => scheduleConfigService.getGroupScheduleConfig(groupId!),
    enabled: !!groupId,
  });

  // Load initial group data for editing
  useEffect(() => {
    if (currentGroup?.name) {
      setEditedGroupName(currentGroup.name);
    }
    if (currentGroup?.description) {
      setEditedGroupDescription(currentGroup.description || '');
    }
  }, [currentGroup?.name, currentGroup?.description]);

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

  // Load pending invitations when page loads or group changes
  // useEffect(() => {
  //   const loadInvitations = async () => {
  //     if (!groupId || !isAdmin) return;
  //     
  //     setLoadingInvitations(true);
  //     try {
  //       const invitations = await apiService.getGroupInvitations(groupId);
  //       setPendingInvitations(invitations);
  //     } catch (error) {
  //       console.error('Failed to load pending invitations:', error);
  //       setErrorMessage('Failed to load pending invitations');
  //     } finally {
  //       setLoadingInvitations(false);
  //     }
  //   };

  //   loadInvitations();
  // }, [groupId, isAdmin]);

  // const refreshPendingInvitations = async () => {
  //   if (!groupId) return;
  //   
  //   setLoadingInvitations(true);
  //   try {
  //     const invitations = await apiService.getGroupInvitations(groupId);
  //     setPendingInvitations(invitations);
  //   } catch (error) {
  //     console.error('Failed to load pending invitations:', error);
  //     setErrorMessage('Failed to load pending invitations');
  //   } finally {
  //     setLoadingInvitations(false);
  //   }
  // };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!groupId) return;

    try {
      // MIGRATED: Use OpenAPI client to cancel group invitation
      const result = await api.DELETE('/groups/{groupId}/invitations/{invitationId}', {
        params: {
          path: { groupId, invitationId }
        }
      });

      // Check if the operation was successful
      if (result.data?.success) {
        setSuccessMessage('Invitation canceled successfully');
        setErrorMessage('');
        // await refreshPendingInvitations(); // Refresh invitations list
        queryClient.invalidateQueries({ queryKey: ['group-families', groupId] }); // Refresh families list to remove PENDING family
      } else {
        setErrorMessage('Failed to cancel invitation');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel invitation');
    }
  };

  // Mutations

  const updateFamilyRoleMutation = useMutation({
    // MIGRATED: Use OpenAPI client to update family role
    mutationFn: ({ familyId, role }: { familyId: string; role: 'ADMIN' | 'MEMBER' }) => {
      if (!groupId) return Promise.reject('No group ID');

      return api.PATCH('/groups/{groupId}/families/{familyId}/role', {
        params: {
          path: { groupId, familyId }
        },
        body: { role }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-families', groupId] });
      setSuccessMessage('Family role updated successfully');
      setErrorMessage('');
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to update family role');
      setSuccessMessage('');
    },
  });

  const removeFamilyMutation = useMutation({
    // MIGRATED: Use OpenAPI client to remove family from group
    mutationFn: (familyId: string) => {
      if (!groupId) return Promise.reject('No group ID');

      return api.DELETE('/groups/{groupId}/families/{familyId}', {
        params: {
          path: { groupId, familyId }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-families', groupId] });
      setSuccessMessage('Family removed successfully');
      setErrorMessage('');
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to remove family');
      setSuccessMessage('');
    },
  });

  const deleteGroupMutation = useMutation({
    // MIGRATED: Use OpenAPI client to delete group
    mutationFn: () => {
      if (!groupId) return Promise.reject('No group ID');

      return api.DELETE('/groups/{groupId}', {
        params: {
          path: { groupId }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setSuccessMessage('Group deleted successfully');
      setErrorMessage('');
      navigate('/groups');
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to delete group');
      setSuccessMessage('');
    },
  });

  const leaveGroupMutation = useMutation({
    // MIGRATED: Use OpenAPI client to leave group
    mutationFn: () => {
      if (!groupId) return Promise.reject('No group ID');

      return api.POST('/groups/{groupId}/leave', {
        params: {
          path: { groupId }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setSuccessMessage('Left group successfully');
      setErrorMessage('');
      navigate('/groups');
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to leave group');
      setSuccessMessage('');
    },
  });

  const updateGroupMutation = useMutation({
    // MIGRATED: Use OpenAPI client to update group
    mutationFn: (updateData: { name?: string; description?: string }) => {
      if (!groupId) return Promise.reject('No group ID');

      // Only include fields that are being updated
      const body: any = {};
      if (updateData.name !== undefined) body.name = updateData.name;
      if (updateData.description !== undefined) body.description = updateData.description;

      return api.PATCH('/groups/{groupId}', {
        params: {
          path: { groupId }
        },
        body
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setSuccessMessage('Group updated successfully');
      setErrorMessage('');
      setShowEditGroupDialog(false);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to update group');
      setSuccessMessage('');
    },
  });


  // Early return check after all hooks
  if (!groupId) {
    navigate('/groups');
    return null;
  }


  const handleRemoveFamily = (familyId: string) => {
    removeFamilyMutation.mutate(familyId);
    setShowRemoveFamilyDialog(null);
  };

  const handleChangeRole = () => {
    if (familyToChangeRole) {
      updateFamilyRoleMutation.mutate({
        familyId: familyToChangeRole.family.id,
        role: familyToChangeRole.newRole,
      });
      setFamilyToChangeRole(null);
    }
  };

  const handleDeleteGroup = () => {
    deleteGroupMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleLeaveGroup = () => {
    leaveGroupMutation.mutate();
    setShowLeaveDialog(false);
  };


  const handleSaveGroupChanges = () => {
    if (!editedGroupName.trim()) {
      setErrorMessage('Group name is required');
      return;
    }

    const updateData: { name?: string; description?: string } = {};
    
    if (editedGroupName !== currentGroup?.name) {
      updateData.name = editedGroupName.trim();
    }
    
    if (editedGroupDescription !== (currentGroup?.description || '')) {
      updateData.description = editedGroupDescription.trim();
    }

    if (Object.keys(updateData).length === 0) {
      setShowEditGroupDialog(false);
      return;
    }

    updateGroupMutation.mutate(updateData);
  };

  const handleCancelGroupEdit = () => {
    setEditedGroupName(currentGroup?.name || '');
    setEditedGroupDescription(currentGroup?.description || '');
    setShowEditGroupDialog(false);
    setErrorMessage('');
  };

  const handleEditGroup = () => {
    setEditedGroupName(currentGroup?.name || '');
    setEditedGroupDescription(currentGroup?.description || '');
    setShowEditGroupDialog(true);
  };

  if (familiesLoading) {
    return (
      <div className="space-y-6 p-6">
        <LoadingState 
          title="Loading group details..."
          description="Please wait while we fetch the group information."
          data-testid="ManageGroupPage-Container-loading"
        />
      </div>
    );
  }

  if (familiesError || !currentGroup) {
    return (
      <div className="space-y-6 p-6">
        <ErrorState 
          title="Failed to load group"
          description="We couldn't load the group details. Please check your permissions and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const familyToRemove = families.find(f => f.id === showRemoveFamilyDialog);

  return (
    <div className="space-y-6 p-6" data-testid="ManageGroupPage-Container-main">
      {/* Header */}
      <div className="flex items-center gap-4" data-testid="ManageGroupPage-Header-pageHeader">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/groups')}
          className="gap-2"
          data-testid="ManageGroupPage-Button-backToGroups"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="ManageGroupPage-Heading-pageTitle">Manage Group</h1>
          </div>
          <p className="text-muted-foreground" data-testid="ManageGroupPage-Text-pageDescription">
            Manage group settings and members
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800" data-testid="ManageGroupPage-Alert-successMessage">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      {errorMessage && (
        <Alert className="border-red-200 bg-red-50 text-red-800" data-testid="ManageGroupPage-Alert-errorMessage">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Group Information Card */}
        <Card data-testid="ManageGroupPage-Card-groupInformation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="ManageGroupPage-Title-groupInfo">
              <Users className="h-5 w-5" />
              Group Information
            </CardTitle>
            <CardDescription>
              Basic group details and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="group-name"
                  value={currentGroup.name}
                  disabled
                  className="flex-1"
                  data-testid="ManageGroupPage-Input-groupName"
                />
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditGroup}
                    aria-label="Edit group name"
                    data-testid="ManageGroupPage-Button-editGroup"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-description">Description</Label>
              <p className="text-sm text-muted-foreground min-h-[2.5rem] p-3 rounded-md border" data-testid="ManageGroupPage-Text-groupDescription">
                {currentGroup.description || 'No description provided'}
              </p>
            </div>


            <div className="space-y-2">
              <Label data-testid="ManageGroupPage-Label-ownerFamily">Owner Family</Label>
              <p className="text-sm text-muted-foreground" data-testid="ManageGroupPage-Text-ownerFamilyName">
                {currentGroup.ownerFamily.name}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your Role</Label>
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {currentGroup.userRole}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Configuration Card */}
        {isAdmin && (
          <Card data-testid="ManageGroupPage-Card-scheduleConfig">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="ManageGroupPage-Title-scheduleConfig">
                <Clock className="h-5 w-5" />
                Schedule Configuration
              </CardTitle>
              <CardDescription>
                Configure time slots for each weekday
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Configuration</Label>
                <div className="text-sm text-muted-foreground">
                  {scheduleConfig ? (
                    <div className="space-y-1">
                      <p>Total time slots: {Object.values(scheduleConfig.scheduleHours).reduce((total, slots) => total + (slots?.length || 0), 0)}</p>
                      <p>Active weekdays: {Object.values(scheduleConfig.scheduleHours).filter(slots => slots && slots.length > 0).length}</p>
                      {scheduleConfig.isDefault && (
                        <Badge variant="secondary" className="mt-2">Using Default Configuration</Badge>
                      )}
                    </div>
                  ) : (
                    <p>No configuration found</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setShowScheduleConfigModal(true)}
                className="w-full gap-2"
                data-testid="ManageGroupPage-Button-configureSchedule"
              >
                <Settings className="h-4 w-4" />
                Configure Schedule
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Family Management Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Group Families
                </CardTitle>
                <CardDescription>
                  Manage families and their roles in the group
                </CardDescription>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => setShowFamilySearch(true)}
                  variant="outline"
                  size="sm"
                  data-testid="ManageGroupPage-Button-inviteFamily"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Family
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div data-testid="GroupFamilies-Container-list">
              <h4 className="text-sm font-medium mb-3" data-testid="GroupFamilies-Title-header">
                Group Families ({families.length})
              </h4>
              
              {families.length === 0 ? (
                <p className="text-sm text-muted-foreground">No families in this group yet.</p>
              ) : (
                <div className="space-y-3">
                  {families.map(family => {
                    // Use status field for pending check, with fallback for backward compatibility
                    const isPending = family.status === 'PENDING' || family.role === 'PENDING';

                    return (
                    <div
                      key={family.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPending
                          ? 'border-orange-200 bg-orange-50/50'
                          : 'border-border'
                      }`}
                      data-testid={`GroupFamily-Card-${family.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isPending
                            ? 'bg-orange-100'
                            : 'bg-primary/10'
                        }`}>
                          {family.role === 'OWNER' ? (
                            <Shield className="h-4 w-4 text-primary" />
                          ) : family.role === 'ADMIN' ? (
                            <Shield className="h-4 w-4 text-blue-600" />
                          ) : isPending ? (
                            <Mail className="h-4 w-4 text-orange-600" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏠</span>
                            <p className="font-medium" data-testid={`GroupFamily-Text-name-${family.id}`}>
                              {family.name}
                            </p>
                            {/* Show status badge for pending invitations */}
                            {isPending && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300" data-testid={`GroupFamily-Badge-pending-${family.id}`}>
                                Pending Invitation
                              </Badge>
                            )}
                            {/* Show role badges (OWNER always takes precedence, then actual role for non-pending) */}
                            {family.role === 'OWNER' && (
                              <Badge variant="destructive" data-testid={`GroupFamily-Badge-owner-${family.id}`}>
                                Owner
                              </Badge>
                            )}
                            {!isPending && family.role === 'ADMIN' && (
                              <Badge variant="default" data-testid={`GroupFamily-Badge-admin-${family.id}`}>
                                Admin
                              </Badge>
                            )}
                            {!isPending && family.role === 'MEMBER' && (
                              <Badge variant="secondary" data-testid={`GroupFamily-Badge-member-${family.id}`}>
                                Member
                              </Badge>
                            )}
                            {/* For pending invitations, show the invited role */}
                            {isPending && family.role === 'ADMIN' && (
                              <Badge variant="default" data-testid={`GroupFamily-Badge-admin-${family.id}`}>
                                Admin
                              </Badge>
                            )}
                            {isPending && family.role === 'MEMBER' && (
                              <Badge variant="secondary" data-testid={`GroupFamily-Badge-member-${family.id}`}>
                                Member
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`GroupFamily-Text-admin-${family.id}`}>
                            Admin: <AdminDisplay family={family} />
                          </p>
                          {family.isMyFamily && (
                            <p className="text-xs text-blue-600 font-medium">Your family</p>
                          )}
                          {isPending && family.expiresAt && (
                            <p className="text-xs text-orange-600" data-testid={`GroupFamily-Text-expires-${family.id}`}>
                              Expires: {new Date(family.expiresAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Show family link only for user's own family */}
                        {family.isMyFamily && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`GroupFamily-Link-details-${family.id}`}
                          >
                            <Link to="/family/manage">View my family</Link>
                          </Button>
                        )}
                        
                        {/* Actions for admins on other families */}
                        {isAdmin && family.canManage && (
                          <div data-testid={`GroupFamily-Actions-${family.id}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" data-testid={`GroupFamily-Button-actions-${family.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isPending && family.invitationId && (
                                  <DropdownMenuItem
                                    onClick={() => handleCancelInvitation(family.invitationId!)}
                                    className="text-red-600 focus:text-red-600"
                                    data-testid={`GroupFamily-Button-cancelInvitation-${family.id}`}
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Cancel Invitation
                                  </DropdownMenuItem>
                                )}
                                {!isPending && family.role === 'MEMBER' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setFamilyToChangeRole({
                                        family,
                                        newRole: 'ADMIN',
                                      })
                                    }
                                    data-testid={`GroupFamily-Button-promote-${family.id}`}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Promote to Admin
                                  </DropdownMenuItem>
                                )}
                                {!isPending && family.role === 'ADMIN' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setFamilyToChangeRole({
                                        family,
                                        newRole: 'MEMBER',
                                      })
                                    }
                                    data-testid={`GroupFamily-Button-demote-${family.id}`}
                                  >
                                    <User className="h-4 w-4 mr-2" />
                                    Make Member
                                  </DropdownMenuItem>
                                )}
                                {!isPending && (family.role === 'MEMBER' || family.role === 'ADMIN') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setShowRemoveFamilyDialog(family.id)}
                                      className="text-red-600 focus:text-red-600"
                                      data-testid={`GroupFamily-Button-remove-${family.id}`}
                                    >
                                      <UserMinus className="h-4 w-4 mr-2" />
                                      Remove from Group
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        {/* Leave group button for user's own family if they're not admin */}
                        {!isAdmin && family.isMyFamily && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowLeaveDialog(true)}
                            data-testid="GroupFamily-Button-leaveGroup"
                          >
                            Leave Group
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Danger Zone */}
      <Card className="border-red-500 border-2 bg-red-50/50 dark:bg-red-950/20" data-testid="ManageGroupPage-Card-dangerZone">
        <CardHeader className="border-b border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-900/20">
          <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
            <svg 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span data-testid="ManageGroupPage-Title-dangerZone">Danger Zone</span>
          </CardTitle>
          <CardDescription className="text-red-600 dark:text-red-400">
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {!isAdmin ? (
            <Button
              variant="destructive"
              onClick={() => setShowLeaveDialog(true)}
              className="gap-2 w-full"
              data-testid="ManageGroupPage-Button-leaveGroup"
            >
              <UserMinus className="h-4 w-4" />
              Leave Group
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="gap-2 w-full font-semibold"
              data-testid="ManageGroupPage-Button-deleteGroup"
            >
              <Trash2 className="h-4 w-4" />
              Delete Group
            </Button>
          )}
          
          {/* Always show which action is available based on role */}
          <p className="text-xs text-gray-500 mt-2">
            {isAdmin ? 'As group admin, you can delete this group' : 'As a member, you can leave this group'}
          </p>
        </CardContent>
      </Card>

      {/* Delete Group Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmationName('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription data-testid="ManageGroupPage-Text-deleteConfirmation">
              Are you sure you want to delete "{currentGroup.name}"? This action cannot be undone.
              All trips, schedules, and associated data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-name" data-testid="ManageGroupPage-Label-confirmName">Type the group name to confirm</Label>
              <Input
                id="confirm-name"
                placeholder="Type group name here"
                value={deleteConfirmationName}
                onChange={(e) => setDeleteConfirmationName(e.target.value)}
                data-testid="ManageGroupPage-Input-confirmGroupName"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmationName('');
              }}
              data-testid="ManageGroupPage-Button-cancelDelete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleteGroupMutation.isPending || deleteConfirmationName !== currentGroup.name}
              data-testid="ManageGroupPage-Button-confirmDelete"
            >
              {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Group</DialogTitle>
            <DialogDescription data-testid="ManageGroupPage-Text-leaveConfirmation">
              Are you sure you want to leave "{currentGroup.name}"?
              You will lose access to all group schedules and trips. You'll need a new invite code to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
              data-testid="ManageGroupPage-Button-cancelLeave"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={leaveGroupMutation.isPending}
              data-testid="ManageGroupPage-Button-confirmLeave"
            >
              {leaveGroupMutation.isPending ? 'Leaving...' : 'Leave Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Family Dialog */}
      <Dialog open={!!showRemoveFamilyDialog} onOpenChange={() => setShowRemoveFamilyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Family from Group</DialogTitle>
            <DialogDescription>
              ⚠️ Are you sure you want to remove the family "{familyToRemove?.name}" from this group?
              
              This action is irreversible. The family will lose access to all group schedules and trips, and they will need to be reinvited to rejoin the group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRemoveFamilyDialog(null)}
              data-testid="ManageGroupPage-Button-cancelRemoveFamily"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRemoveFamilyDialog && handleRemoveFamily(showRemoveFamilyDialog)}
              disabled={removeFamilyMutation.isPending}
              data-testid="ManageGroupPage-Button-confirmRemoveFamily"
            >
              {removeFamilyMutation.isPending ? 'Removing...' : 'Remove Family'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Family Role Dialog */}
      <Dialog open={!!familyToChangeRole} onOpenChange={() => setFamilyToChangeRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Family Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the family "{familyToChangeRole?.family.name}"'s role to {familyToChangeRole?.newRole}?
              
              {familyToChangeRole?.newRole === 'ADMIN' && (
                <div className="mt-2 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm">The family admins will be able to:</p>
                  <ul className="text-sm mt-1 space-y-1">
                    <li>• Manage all families in the group</li>
                    <li>• Modify group settings</li>
                    <li>• Invite new families</li>
                  </ul>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFamilyToChangeRole(null)}
              data-testid="ManageGroupPage-Button-cancelRoleChange"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={updateFamilyRoleMutation.isPending}
              data-testid="ManageGroupPage-Button-confirmRoleChange"
            >
              {updateFamilyRoleMutation.isPending ? 'Updating...' : 'Change Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={showEditGroupDialog} onOpenChange={setShowEditGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="edit-group-dialog-title">Edit Group Information</DialogTitle>
            <DialogDescription data-testid="edit-group-dialog-description">
              Update the group name and description. This information will be visible to all group members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                value={editedGroupName}
                onChange={(e) => setEditedGroupName(e.target.value)}
                placeholder="Enter group name"
                data-testid="ManageGroupPage-Input-editGroupName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-group-description">Description (Optional)</Label>
              <Textarea
                id="edit-group-description"
                value={editedGroupDescription}
                onChange={(e) => setEditedGroupDescription(e.target.value)}
                placeholder="Enter a description for this group"
                data-testid="ManageGroupPage-Textarea-editGroupDescription"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelGroupEdit}
              data-testid="ManageGroupPage-Button-cancelGroupEdit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGroupChanges}
              disabled={updateGroupMutation.isPending || !editedGroupName.trim()}
              data-testid="ManageGroupPage-Button-saveGroup"
            >
              {updateGroupMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Search Invitation Modal */}
      <FamilySearchInvitation
        groupId={groupId || ''}
        onInvitationSent={async () => {
          queryClient.invalidateQueries({ queryKey: ['group-invitations', groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-families', groupId] }); // Refresh families list to show new PENDING family
          setSuccessMessage('Family invitation sent successfully');
          setErrorMessage('');
          // await refreshPendingInvitations(); // Refresh invitations list
        }}
        isOpen={showFamilySearch}
        onClose={() => setShowFamilySearch(false)}
      />

      {/* Group Schedule Configuration Modal */}
      {currentGroup && (
        <GroupScheduleConfigModal
          isOpen={showScheduleConfigModal}
          onClose={() => setShowScheduleConfigModal(false)}
          groupId={groupId!}
          groupName={currentGroup.name}
          currentConfig={scheduleConfig || null}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

export default ManageGroupPage;