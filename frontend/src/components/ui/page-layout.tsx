import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'full-width' | 'schedule';
}

export const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  className,
  variant = 'default',
  ...props
}) => {
  const baseClasses = "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800";
  
  const containerClasses = {
    default: "container mx-auto px-4 py-6 sm:py-8 max-w-7xl",
    centered: "container mx-auto px-4 py-8 sm:py-12 max-w-4xl",
    'full-width': "px-4 py-6 sm:py-8",
    schedule: "px-2 sm:px-4 py-6 sm:py-8"
  };

  return (
    <div className={cn(baseClasses, className)} {...props}>
      <div className={containerClasses[variant]}>
        {children}
      </div>
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  'subtitle-testid'?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  children,
  className,
  'data-testid': dataTestId,
  'subtitle-testid': subtitleTestId
}) => {
  return (
    <header className={cn("mb-8 md:mb-12", className)} data-testid={dataTestId}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
        <div className="flex items-center space-y-2 lg:space-y-0 lg:space-x-4">
          {/* EduLift Logo */}
          <img
            src="/logo-64.png"
            alt="EduLift"
            className="h-12 w-12 lg:h-14 lg:w-14 object-contain"
            data-testid="edu-lift-logo"
          />
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent" data-testid={dataTestId ? `${dataTestId}-title` : undefined}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-base sm:text-lg text-muted-foreground font-medium" data-testid={subtitleTestId}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {children}
          </div>
        )}
      </div>
    </header>
  );
};

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  children,
  className,
  hover = true,
  onClick
}) => {
  return (
    <div 
      className={cn(
        "border-0 shadow-lg bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl overflow-hidden",
        hover && "hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  icon,
  disabled = false,
  ...props
}) => {
  const baseClasses = "group inline-flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-primary/5 hover:border-primary/20 border border-transparent"
  };
  
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {icon && (
        <div className="p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
          {icon}
        </div>
      )}
      {children}
    </button>
  );
};

export const LoadingState: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="h-12 sm:h-16 w-12 sm:w-16 bg-muted animate-pulse rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="h-6 sm:h-8 w-48 sm:w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 sm:w-96 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 sm:h-32 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
};