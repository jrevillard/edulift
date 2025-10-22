import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, 
  Calendar, 
  Car, 
  UserPlus, 
  Plus,
  Search,
  AlertCircle,
  WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline';
    'data-testid'?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline';
    'data-testid'?: string;
  };
  className?: string;
  'data-testid'?: string;
}

// Base empty state component with consistent styling
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  'data-testid': dataTestId
}) => (
  <Card className={cn("border-dashed", className)} data-testid={dataTestId}>
    <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <Button 
            onClick={action.onClick}
            variant={action.variant || 'default'}
            className="min-w-[140px]"
            data-testid={action['data-testid']}
          >
            <Plus className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button 
            onClick={secondaryAction.onClick}
            variant={secondaryAction.variant || 'outline'}
            className="min-w-[120px]"
            data-testid={secondaryAction['data-testid']}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

// Specific empty states for different sections
export const EmptyGroups: React.FC<{
  onCreateGroup: () => void;
  onJoinGroup: () => void;
}> = ({ onCreateGroup, onJoinGroup }) => (
  <EmptyState
    icon={Users}
    title="No groups yet"
    description="Get started by creating your first transport group or join an existing one to coordinate with other parents."
    action={{
      label: "Create Group",
      onClick: onCreateGroup,
      'data-testid': "EmptyGroups-Button-createGroup"
    }}
    secondaryAction={{
      label: "Join Group",
      onClick: onJoinGroup,
      variant: "outline",
      'data-testid': "EmptyGroups-Button-joinGroup"
    }}
    data-testid="EmptyGroups-Container-state"
  />
);

export const EmptyChildren: React.FC<{
  onAddChild: () => void;
  'data-testid'?: string;
}> = ({ onAddChild, 'data-testid': dataTestId }) => (
  <EmptyState
    icon={UserPlus}
    title="No children added"
    description="Add your children to start managing their school transport schedules and coordinate with other families."
    action={{
      label: "Add Child",
      onClick: onAddChild
    }}
    data-testid={dataTestId || "EmptyChildren-Container-state"}
  />
);

export const EmptyVehicles: React.FC<{
  onAddVehicle: () => void;
  'data-testid'?: string;
}> = ({ onAddVehicle }) => (
  <div>
    <EmptyState
      icon={Car}
      title="No vehicles registered"
      description="Register your vehicle to offer rides and participate in your transport groups' scheduling."
      action={{
        label: "Add Vehicle",
        onClick: onAddVehicle
      }}
      data-testid="EmptyVehicles-content"
    />
  </div>
);

export const EmptySchedule: React.FC<{
  onCreateTrip: () => void;
}> = ({ onCreateTrip }) => (
  <EmptyState
    icon={Calendar}
    title="No trips scheduled"
    description="Your schedule is empty. Create your first trip or join a group to see scheduled activities."
    action={{
      label: "Create Trip",
      onClick: onCreateTrip
    }}
  />
);

export const EmptySearchResults: React.FC<{
  searchTerm: string;
  onClearSearch: () => void;
}> = ({ searchTerm, onClearSearch }) => (
  <EmptyState
    icon={Search}
    title="No results found"
    description={`We couldn't find anything matching "${searchTerm}". Try adjusting your search terms or browse all items.`}
    action={{
      label: "Clear Search",
      onClick: onClearSearch,
      variant: "outline"
    }}
  />
);

// Error states
export const ErrorState: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({ 
  title = "Something went wrong",
  description = "We encountered an error while loading this content. Please try again.",
  onRetry
}) => (
  <div data-testid="ErrorState-Container-error">
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={onRetry ? {
        label: "Try Again",
        onClick: onRetry,
        variant: "outline"
      } : undefined}
      className="border-destructive/20"
    />
  </div>
);

export const OfflineState: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <EmptyState
    icon={WifiOff}
    title="You're offline"
    description="Please check your internet connection and try again. Some features may not be available while offline."
    action={onRetry ? {
      label: "Retry",
      onClick: onRetry,
      variant: "outline"
    } : undefined}
    className="border-yellow-200"
  />
);

// Loading state with better visual design
export const LoadingState: React.FC<{
  title?: string;
  description?: string;
  'data-testid'?: string;
}> = ({ 
  title = "Loading...",
  description = "Please wait while we fetch your data.",
  'data-testid': dataTestId
}) => (
  <Card className="border-dashed" data-testid={dataTestId || "LoadingState-Container-loading"}>
    <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="LoadingState-Heading-title">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {description}
      </p>
    </CardContent>
  </Card>
);