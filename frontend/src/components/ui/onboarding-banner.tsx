import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';

interface OnboardingBannerProps {
  type: 'incomplete-setup' | 'warning' | 'info';
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  progress?: {
    completed: number;
    total: number;
  };
  children?: React.ReactNode;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  type,
  title,
  description,
  actionText,
  onAction,
  onDismiss,
  dismissible = true,
  progress,
  children
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'incomplete-setup':
        return {
          container: 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50',
          title: 'text-blue-900',
          description: 'text-blue-700',
          icon: 'text-blue-600',
          accent: 'bg-blue-500'
        };
      case 'warning':
        return {
          container: 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
          title: 'text-amber-900',
          description: 'text-amber-700',
          icon: 'text-amber-600',
          accent: 'bg-amber-500'
        };
      case 'info':
        return {
          container: 'border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50',
          title: 'text-gray-900',
          description: 'text-gray-700',
          icon: 'text-gray-600',
          accent: 'bg-gray-500'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <Card className={`relative overflow-hidden border ${styles.container} shadow-sm`} data-testid="OnboardingBanner-Container-banner">
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1 ${styles.accent}`} />
      
      <div className="flex items-start justify-between p-4 pl-6">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${styles.title}`} data-testid="OnboardingBanner-Title-bannerTitle">{title}</h3>
              {progress && (
                <div className="flex items-center gap-2">
                  <div className="flex h-2 w-16 overflow-hidden rounded-full bg-white/50">
                    <div 
                      className={`h-full transition-all duration-300 ${styles.accent}`}
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${styles.description}`}>
                    {progress.completed}/{progress.total}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <p className={`text-sm ${styles.description}`}>
            {description}
          </p>

          {/* Custom content */}
          {children}

          {/* Action */}
          {actionText && onAction && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={onAction}
                size="sm"
                className="gap-2 bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 shadow-sm"
                data-testid="OnboardingBanner-Button-actionButton"
              >
                {actionText}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};