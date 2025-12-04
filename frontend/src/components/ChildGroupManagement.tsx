import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Child, UserGroup } from '@/types/api';

/*
  MIGRATION STATUS: ✅ FULLY MIGRATED TO OPENAPI
  ==============================================
  Previous apiService methods replaced with OpenAPI client equivalents:

  1. apiService.getChildGroupMemberships(childId)
     → api.GET('/children/{childId}/groups', { params: { path: { childId } } })

  2. apiService.getUserGroups()
     → api.GET('/groups/my-groups')

  3. apiService.addChildToGroup(childId, groupId)
     → api.POST('/children/{childId}/groups/{groupId}', { params: { path: { childId, groupId } } })

  4. apiService.removeChildFromGroup(childId, groupId)
     → api.DELETE('/children/{childId}/groups/{groupId}', { params: { path: { childId, groupId } } })

  All functionality preserved with improved type safety.
*/
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

interface ChildGroupManagementProps {
  child: Child;
}

export const ChildGroupManagement: React.FC<ChildGroupManagementProps> = ({ child }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [groupToRemove, setGroupToRemove] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const queryClient = useQueryClient();

  // Get child's current group memberships
  const { data: childGroupsResponse, isLoading: loadingChildGroups } = useQuery({
    queryKey: ['child-groups', child.id],
    queryFn: async () => {
      const result = await api.GET('/children/{childId}/groups', {
        params: { path: { childId: child.id } }
      });
      return result.data;
    },
    enabled: isOpen,
  });

  // Get user's groups (to add child to)
  const { data: userGroupsResponse, isLoading: loadingUserGroups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const result = await api.GET('/groups/my-groups');
      return result.data;
    },
    enabled: isOpen,
  });

  // Extract data from responses
  const childGroups = childGroupsResponse?.data || [];
  const userGroups = userGroupsResponse?.data || [];

  // Filter out groups child is already a member of
  const availableGroups = userGroups.filter(
    (userGroup: UserGroup) => !childGroups.some(childGroup => childGroup.groupId === userGroup.id)
  );

  // Mutations
  const addToGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const result = await api.POST('/children/{childId}/groups/{groupId}', {
        params: { path: { childId: child.id, groupId } }
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-groups', child.id] });
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setSelectedGroup('');
    },
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const result = await api.DELETE('/children/{childId}/groups/{groupId}', {
        params: { path: { childId: child.id, groupId } }
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-groups', child.id] });
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  const handleAddToGroup = async () => {
    if (!selectedGroup) return;

    try {
      await addToGroupMutation.mutateAsync(selectedGroup);
    } catch (error) {
      console.error('Failed to add child to group:', error);
    }
  };

  const handleRemoveFromGroup = (groupId: string) => {
    setGroupToRemove(groupId);
  };

  const confirmRemoveFromGroup = async () => {
    if (groupToRemove) {
      await removeFromGroupMutation.mutateAsync(groupToRemove);
      setGroupToRemove(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Groups ({isOpen ? childGroups.length : (child.groupMemberships?.length || 0)})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Groups for {child.name}</DialogTitle>
          <DialogDescription>
            Add or remove {child.name} from your groups to include them in trip planning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loading indicator */}
          {(loadingChildGroups || loadingUserGroups) && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-3 text-sm text-muted-foreground">Loading groups...</span>
            </div>
          )}

          {!loadingChildGroups && !loadingUserGroups && (
            <>
              {/* Currently Assigned Groups */}
              {childGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Currently Assigned Groups</h4>
                  <div className="space-y-2">
                    {childGroups.map((membership) => (
                      <div key={membership.groupId} className="flex items-center justify-between p-3 bg-success-muted border border-success-muted/60 rounded-xl transition-all duration-200">
                        <div className="flex items-center space-x-3">
                          <span className="text-success">👥</span>
                          <div>
                            <div className="font-medium text-success-muted-foreground">{membership.group?.name || 'Unknown Group'}</div>
                            <div className="text-xs text-success">
                              Added {new Date(membership.joinedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveFromGroup(membership.groupId)}
                          disabled={removeFromGroupMutation.isPending}
                          variant="destructive"
                          size="sm"
                        >
                          {removeFromGroupMutation.isPending ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Group Section */}
              {availableGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Add to Group</h4>
                  <div className="space-y-3">
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="w-full p-2 border border-input rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Select a group to add to...</option>
                      {availableGroups.map((userGroup: UserGroup) => (
                        <option key={userGroup.id} value={userGroup.id}>
                          👥 {userGroup.name}
                        </option>
                      ))}
                    </select>
                    
                    <Button
                      onClick={handleAddToGroup}
                      disabled={!selectedGroup || addToGroupMutation.isPending}
                      className="w-full"
                    >
                      {addToGroupMutation.isPending ? 'Adding to Group...' : 'Add to Group'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty States */}
              {childGroups.length === 0 && availableGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {userGroups.length === 0 ? (
                    <div>
                      <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p className="mb-2">You haven't joined any groups yet.</p>
                      <p className="text-sm">Join or create groups to organize trips.</p>
                    </div>
                  ) : (
                    <div>
                      <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p>{child.name} is already a member of all your groups.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={!!groupToRemove}
        onOpenChange={(open) => !open && setGroupToRemove(null)}
        title="Remove from Group"
        description={`Remove ${child.name} from this group? He/she will no longer be included in this group's trips.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmRemoveFromGroup}
      />
    </Dialog>
  );
};