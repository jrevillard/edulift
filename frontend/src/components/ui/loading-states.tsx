import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Enhanced loading spinner with better visual design
export const LoadingSpinner: React.FC<{ 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-primary",
        sizeClasses[size]
      )} />
    </div>
  );
};

// Loading card skeleton with proper proportions
export const LoadingCard: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={className}>
    <CardHeader className="pb-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Dashboard stats loading skeleton
export const LoadingStats: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Loading table rows
export const LoadingTableRows: React.FC<{ 
  rows?: number;
  columns?: number;
}> = ({ rows = 3, columns = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 p-4 border rounded-lg">
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

// Page loading state with skeleton layout
export const PageLoadingState: React.FC<{ 
  showStats?: boolean;
  showCards?: boolean;
}> = ({ showStats = false, showCards = false }) => (
  <div className="space-y-6 p-6">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>

    {/* Stats if requested */}
    {showStats && <LoadingStats />}

    {/* Cards if requested */}
    {showCards && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingCard key={i} />
        ))}
      </div>
    )}

    {/* Main content area */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <LoadingTableRows />
        </div>
      </CardContent>
    </Card>
  </div>
);

// Inline loading state for buttons
export const ButtonLoading: React.FC<{ 
  children: React.ReactNode;
  isLoading?: boolean;
}> = ({ children, isLoading = false }) => (
  <span className="flex items-center gap-2">
    {isLoading && <LoadingSpinner size="sm" />}
    {children}
  </span>
);