import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
// import { useSocket } from '../contexts/SocketContext';
import GroupCard from '../components/GroupCard';
import CreateGroupModal from '../components/CreateGroupModal';
import JoinGroupModal from '../components/JoinGroupModal';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingState, ErrorState, EmptyGroups } from '@/components/ui/empty-states';
import { PageLayout, PageHeader, ModernButton } from '@/components/ui/page-layout';
import { Plus, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { isApiError } from '../types/errors';

const GroupsPage: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // const { isConnected } = useSocket();

  // Real-time group updates are now handled centrally in SocketContext
  // No need for duplicate event listeners here

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => apiService.getUserGroups(),
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) => apiService.createGroup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setSuccessMessage('Group created successfully!');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (error: unknown) => {
      console.error('Error creating group:', error);
      
      // Handle specific permission errors
      if (isApiError(error) && error.response?.status === 403) {
        setErrorMessage('You do not have permission to create groups. Only family admins can create groups.');
      } else if (isApiError(error) && error.response?.status === 401) {
        setErrorMessage('You must be logged in to create groups.');
      } else {
        setErrorMessage(isApiError(error) ? error.response?.data?.error || error.message || 'Failed to create group. Please try again.' : 'Failed to create group. Please try again.');
      }
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 8000);
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: (inviteCode: string) => apiService.joinGroup(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      setSuccessMessage('Successfully joined group!');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (error: unknown) => {
      console.error('Error joining group:', error);
      
      // Handle specific errors
      if (isApiError(error) && error.response?.status === 403) {
        setErrorMessage('You do not have permission to join this group.');
      } else if (isApiError(error) && error.response?.status === 401) {
        setErrorMessage('You must be logged in to join groups.');
      } else if (isApiError(error) && error.response?.status === 404) {
        setErrorMessage('Invalid invite code. Please check the code and try again.');
      } else {
        setErrorMessage(isApiError(error) ? error.response?.data?.error || error.message || 'Failed to join group. Please try again.' : 'Failed to join group. Please try again.');
      }
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 8000);
    },
  });


  const handleCreateGroup = async (name: string) => {
    await createGroupMutation.mutateAsync(name);
  };

  const handleJoinGroup = async (inviteCode: string) => {
    await joinGroupMutation.mutateAsync(inviteCode);
  };

  const handleSelectGroup = (groupId: string) => {
    navigate(`/schedule?group=${groupId}`);
  };

  const handleManageGroup = (groupId: string) => {
    navigate(`/groups/${groupId}/manage`);
  };


  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader 
          title="Transport Groups" 
          subtitle="Loading your groups..."
          data-testid="GroupsPage-Title-pageTitle"
        />
        <LoadingState />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageHeader 
          title="Transport Groups" 
          subtitle="Coordinate school transport with other families"
          data-testid="GroupsPage-Title-pageTitle"
          subtitle-testid="GroupsPage-Description-pageDescription"
        />
        <ErrorState 
          title="Failed to load groups"
          description="We couldn't load your transport groups. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader 
        title="Transport Groups" 
        subtitle="Coordinate school transport with other families in your area"
        data-testid="GroupsPage-Title-pageTitle"
        subtitle-testid="GroupsPage-Description-pageDescription"
      >
        {groups.length > 0 && (
          <Badge variant="secondary" className="text-sm font-semibold">
            {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
          </Badge>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <ModernButton 
            variant="secondary"
            onClick={() => setIsJoinModalOpen(true)}
            icon={<UserPlus className="h-5 w-5" />}
            data-testid="GroupsPage-Button-joinGroup"
          >
            Join Group
          </ModernButton>
          <ModernButton 
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="h-5 w-5" />}
            data-testid="GroupsPage-Button-createGroup"
          >
            Create Group
          </ModernButton>
        </div>
      </PageHeader>

      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" data-testid="GroupsPage-Alert-groupCreatedSuccess">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive" data-testid="GroupsPage-Alert-groupErrorMessage">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {groups.length === 0 ? (
        <EmptyGroups 
          onCreateGroup={() => setIsCreateModalOpen(true)}
          onJoinGroup={() => setIsJoinModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onSelect={handleSelectGroup}
              onManage={handleManageGroup}
            />
          ))}
        </div>
      )}

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateGroup}
      />

      <JoinGroupModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSubmit={handleJoinGroup}
      />
    </PageLayout>
  );
};

export default GroupsPage;