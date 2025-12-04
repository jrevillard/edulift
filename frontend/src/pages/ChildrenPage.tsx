import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { usePageState } from '../hooks/usePageState';
import { useFamily } from '../contexts/FamilyContext';
import { ChildGroupManagement } from '../components/ChildGroupManagement';
import type { Child } from '@/types/api';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GroupMembershipWarning } from '../components/GroupMembershipWarning';
import { LoadingState, ErrorState, EmptyChildren } from '@/components/ui/empty-states';
import { PageLayout, PageHeader, ModernButton, ModernCard } from '@/components/ui/page-layout';
import { Plus, Edit2, Trash2, Users, Baby, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ChildrenPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [formData, setFormData] = useState({ name: '', age: '' });
  const [selectedGroupForAdding, setSelectedGroupForAdding] = useState<string>('');
  const [assignedGroups, setAssignedGroups] = useState<string[]>([]); // Groups to assign after creation
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [formError, setFormError] = useState<string>('');
  const queryClient = useQueryClient();
  const { refreshFamily } = useFamily();

  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const result = await api.GET('/children', {});
      const apiChildren = result.data?.data || [];

      // Convert API response format to match expected types
      return apiChildren.map(child => ({
        id: child.id,
        name: child.name,
        age: child.age === null ? undefined : child.age,
        familyId: child.familyId,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
        groupMemberships: child.groupMemberships?.map(membership => ({
          childId: membership.childId,
          groupId: membership.groupId,
          addedBy: '', // This field is not available in the API response
          addedAt: membership.joinedAt, // Map joinedAt to addedAt
          group: membership.group
        }))
      }));
    },
  });
  
  const { data: children, shouldShowLoading, shouldShowError, shouldShowEmpty } = usePageState(childrenQuery);

  // Fetch user's groups for group assignment during child creation
  const { data: groupsData = { data: [] } } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => {
      const result = await api.GET('/groups/my-groups', {});
      return result.data;
    },
  });

  const groups = groupsData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; age?: number; groupIds: string[] }) => {
      // First create the child
      const createResult = await api.POST('/children', {
        body: { name: data.name, age: data.age }
      });
      const child = createResult.data?.data;

      if (!child) {
        throw new Error('Failed to create child');
      }

      // Then assign to all selected groups
      if (data.groupIds.length > 0) {
        await Promise.all(
          data.groupIds.map(groupId =>
            api.POST('/children/{childId}/groups/{groupId}', {
              params: { path: { childId: child.id, groupId } }
            })
          )
        );
      }

      return child;
    },
    retry: false, // Disable automatic retries to prevent duplicates
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      // Invalidate schedule-related queries since child data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
      setIsFormOpen(false);
      setFormData({ name: '', age: '' });
      setAssignedGroups([]);
      setSelectedGroupForAdding('');
      setFormError('');
    },
    onError: (error: unknown) => {
      console.error('Error creating child:', error);

      // Handle specific permission errors for OpenAPI client
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; message?: string };
        if (apiError.status === 403) {
          setFormError('You do not have permission to add children. Only family admins can add children.');
        } else if (apiError.status === 401) {
          setFormError('You must be logged in to add children.');
        } else {
          setFormError(apiError.message || 'Failed to add child. Please try again.');
        }
      } else {
        setFormError('Failed to add child. Please try again.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; age?: number } }) => {
      const result = await api.PATCH('/children/{childId}', {
        params: { path: { childId: id } },
        body: data
      });
      const child = result.data?.data;

      if (!child) {
        throw new Error('Failed to update child');
      }

      return child;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      // Invalidate schedule-related queries since child data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
      setIsFormOpen(false);
      setEditingChild(null);
      setFormData({ name: '', age: '' });
      setFormError('');
    },
    onError: (error: unknown) => {
      console.error('Error updating child:', error);

      // Handle specific permission errors for OpenAPI client
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; message?: string };
        if (apiError.status === 403) {
          setFormError('You do not have permission to edit children. Only family admins can edit children.');
        } else if (apiError.status === 401) {
          setFormError('You must be logged in to edit children.');
        } else {
          setFormError(apiError.message || 'Failed to update child. Please try again.');
        }
      } else {
        setFormError('Failed to update child. Please try again.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE('/children/{childId}', {
        params: { path: { childId: id } }
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      // Invalidate schedule-related queries since child data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }
    
    const age = formData.age ? parseInt(formData.age) : undefined;
    
    if (editingChild) {
      await updateMutation.mutateAsync({
        id: editingChild.id,
        data: { name: formData.name, age }
      });
    } else {
      await createMutation.mutateAsync({ 
        name: formData.name, 
        age, 
        groupIds: assignedGroups // All assigned groups
      });
    }
  };

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setFormData({ 
      name: child.name, 
      age: child.age?.toString() || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = (child: Child) => {
    setChildToDelete(child);
  };

  const confirmDelete = async () => {
    if (childToDelete) {
      await deleteMutation.mutateAsync(childToDelete.id);
      setChildToDelete(null);
    }
  };

  const handleAddGroupToAssigned = () => {
    if (!selectedGroupForAdding || assignedGroups.includes(selectedGroupForAdding)) return;
    
    setAssignedGroups([...assignedGroups, selectedGroupForAdding]);
    setSelectedGroupForAdding('');
  };

  const handleRemoveGroupFromAssigned = (groupId: string) => {
    setAssignedGroups(assignedGroups.filter(id => id !== groupId));
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingChild(null);
    setFormData({ name: '', age: '' });
    setAssignedGroups([]);
    setSelectedGroupForAdding('');
    setFormError('');
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      // Dialog is closing, reset form
      setEditingChild(null);
      setFormData({ name: '', age: '' });
      setAssignedGroups([]);
      setSelectedGroupForAdding('');
    }
  };

  if (shouldShowLoading) {
    return (
      <PageLayout>
        <PageHeader 
          title="Children" 
          subtitle="Loading your children..."
          data-testid="ChildrenPage-Header-pageHeader"
          subtitle-testid="ChildrenPage-Description-pageDescription"
        />
        <LoadingState data-testid="ChildrenPage-Container-loading" />
      </PageLayout>
    );
  }

  if (shouldShowError) {
    return (
      <PageLayout>
        <PageHeader 
          title="Children" 
          subtitle="Manage your children's information for school transport"
          data-testid="ChildrenPage-Header-pageHeader"
          subtitle-testid="ChildrenPage-Description-pageDescription"
        />
        <ErrorState
          title="Failed to load children"
          description="We couldn't load your children. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/family/manage')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader 
            title="Children" 
            subtitle="Manage your children's information for school transport coordination"
            data-testid="ChildrenPage-Title-pageTitle"
            subtitle-testid="ChildrenPage-Description-pageDescription"
          >
        <ModernButton 
          icon={<Plus className="h-5 w-5" />}
          onClick={() => {
            setEditingChild(null);
            setFormData({ name: '', age: '' });
            setAssignedGroups([]);
            setSelectedGroupForAdding('');
            setIsFormOpen(true);
          }}
          data-testid="ChildrenPage-Button-addChild"
        >
          Add Child
        </ModernButton>
      </PageHeader>
        </div>
      </div>

      {/* Separate Dialog without DialogTrigger */}
      <Dialog open={isFormOpen} onOpenChange={handleDialogOpenChange} data-testid="ChildrenPage-Dialog-childForm">
        <DialogContent className="sm:max-w-[425px]" data-testid="ChildrenPage-Container-dialogContainer">
              <DialogHeader>
                <DialogTitle data-testid="ChildrenPage-Title-childModalTitle">{editingChild ? 'Edit Child' : 'Add New Child'}</DialogTitle>
                <DialogDescription>
                  {editingChild ? 'Update your child\'s information.' : 'Add a new child to your family.'}
                </DialogDescription>
              </DialogHeader>
              
              {/* Error Message */}
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {formError}
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name">Name</Label>
                  <Input
                    id="child-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="ChildrenPage-Input-childName"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="child-age">Age (optional)</Label>
                  <Input
                    id="child-age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    min="0"
                    max="18"
                    data-testid="ChildrenPage-Input-childAge"
                  />
                </div>

                {/* Group Assignment - Only show for new children */}
                {!editingChild && groups.length > 0 && (
                  <div className="space-y-4">
                    <Label className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Assign to Groups (optional)</span>
                    </Label>
                    
                    {/* Currently Assigned Groups */}
                    {assignedGroups.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Will be assigned to</h4>
                        <div className="space-y-2">
                          {assignedGroups.map((groupId) => {
                            const group = groups.find(g => g.id === groupId);
                            if (!group) return null;
                            
                            return (
                              <div key={groupId} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-sm">
                                <div className="flex items-center space-x-2">
                                  <span className="text-green-600">👥</span>
                                  <span className="font-medium text-green-800">{group.name}</span>
                                  <span className="text-xs text-green-600">({group._count?.familyMembers || 0} families)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGroupFromAssigned(groupId)}
                                  className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-100 rounded hover:bg-red-200"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Add Group Section */}
                    {(() => {
                      const availableGroups = groups.filter(g => !assignedGroups.includes(g.id));
                      return availableGroups.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Add to Group</h4>
                          <div className="space-y-2">
                            <Select
                              value={selectedGroupForAdding}
                              onValueChange={setSelectedGroupForAdding}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a group to add to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableGroups.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    👥 {group.name} ({group._count?.familyMembers || 0} families)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Button
                              type="button"
                              onClick={handleAddGroupToAssigned}
                              disabled={!selectedGroupForAdding}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              Add to Group
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={resetForm} data-testid="ChildrenPage-Button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="ChildrenPage-Button-submitChild"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingChild ? 'Update' : 'Add'} Child
                  </Button>
                </div>
              </form>
        </DialogContent>
      </Dialog>

        {/* Warning for children without groups */}
        <div className="mb-6">
          <GroupMembershipWarning 
            children={children} 
            variant="children-page" 
            showDismiss={false} 
          />
        </div>

        {shouldShowEmpty ? (
          <EmptyChildren onAddChild={() => setIsFormOpen(true)} data-testid="ChildrenPage-Container-emptyState" />
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="ChildrenPage-List-childrenList">
            {children.map((child) => (
              <ModernCard key={child.id} data-testid={`child-card-${child.id}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Baby className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100" data-testid={`ChildrenPage-Text-childName-${child.id}`}>{child.name}</CardTitle>
                      {child.age && (
                        <CardDescription className="font-medium" data-testid={`ChildrenPage-Text-childAge-${child.id}`}>Age: {child.age}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(child)}
                      aria-label="Edit"
                      className="hover:bg-primary/10"
                      data-testid={`ChildrenPage-Button-editChild-${child.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(child)}
                      aria-label="Delete"
                      className="hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`ChildrenPage-Button-deleteChild-${child.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <div className="px-6 pb-4">
                  <ChildGroupManagement child={child} />
                </div>
              </ModernCard>
            ))}
          </div>
        )}

        <ConfirmationDialog
          open={!!childToDelete}
          onOpenChange={(open) => !open && setChildToDelete(null)}
          title="Delete Child"
          description={`Are you sure you want to delete ${childToDelete?.name}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </PageLayout>
  );
};

export default ChildrenPage;