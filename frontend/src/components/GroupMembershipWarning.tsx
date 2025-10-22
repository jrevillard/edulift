import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingBanner } from './ui/onboarding-banner';
import { Users } from 'lucide-react';
import type { Child } from '../services/apiService';

interface GroupMembershipWarningProps {
  children: Child[];
  showDismiss?: boolean;
  variant?: 'dashboard' | 'children-page';
}

export const GroupMembershipWarning: React.FC<GroupMembershipWarningProps> = ({
  children,
  showDismiss = true,
  variant = 'dashboard'
}) => {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Filter children without group memberships
  const childrenWithoutGroups = children.filter(
    child => !child.groupMemberships || child.groupMemberships.length === 0
  );

  // Don't show if no children need groups or if dismissed
  if (childrenWithoutGroups.length === 0 || dismissed) {
    return null;
  }

  const handleGoToChildren = () => {
    navigate('/children');
  };

  const getTitle = () => {
    if (childrenWithoutGroups.length === 1) {
      return `${childrenWithoutGroups[0].name} needs a group`;
    }
    return `${childrenWithoutGroups.length} children need groups`;
  };

  const getDescription = () => {
    if (childrenWithoutGroups.length === 1) {
      return `Add ${childrenWithoutGroups[0].name} to a group to include them in trip planning and coordination.`;
    }
    return `Add your children to groups to include them in trip planning and coordination with other families.`;
  };

  const getActionText = () => {
    if (variant === 'dashboard') {
      return childrenWithoutGroups.length === 1 ? 'Add to group' : 'Manage children';
    }
    return null; // No action button for children-page since they're already there
  };

  const handleAction = () => {
    if (variant === 'dashboard') {
      handleGoToChildren();
    }
    // No action for children-page variant since users are already where they need to be
  };

  return (
    <OnboardingBanner
      type="incomplete-setup"
      title={getTitle()}
      description={getDescription()}
      actionText={getActionText() || undefined}
      onAction={getActionText() ? handleAction : undefined}
      onDismiss={showDismiss ? () => setDismissed(true) : undefined}
      dismissible={showDismiss}
      progress={{
        completed: children.length - childrenWithoutGroups.length,
        total: children.length
      }}
    >
      {/* Quick actions for children page */}
      {variant === 'children-page' && childrenWithoutGroups.length <= 3 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-blue-800" data-testid="GroupMembershipWarning-Label-childrenWithoutGroups">Children without groups:</p>
          <div className="flex flex-wrap gap-2">
            {childrenWithoutGroups.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-1 px-2 py-1 bg-white/70 rounded-md border border-blue-200"
              >
                <Users className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-800" data-testid={`child-without-group-${child.id}`}>{child.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </OnboardingBanner>
  );
};