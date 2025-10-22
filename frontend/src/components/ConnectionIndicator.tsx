import React from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores/connectionStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const ConnectionIndicator: React.FC<{ className?: string; showLabel?: boolean }> = ({ 
  className, 
  showLabel = false 
}) => {
  const { wsStatus, apiStatus, hasConnectionIssues } = useConnectionStore();
  
  const getStatusInfo = () => {
    if (!hasConnectionIssues()) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        label: 'Connected',
        message: 'All systems connected and working properly'
      };
    }
    
    if (apiStatus === 'error' || apiStatus === 'disconnected') {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        label: 'Offline',
        message: 'Cannot connect to server. Please check your connection.'
      };
    }
    
    if (wsStatus === 'error' || wsStatus === 'disconnected') {
      return {
        icon: AlertCircle,
        color: 'text-amber-500',
        label: 'Limited',
        message: 'Connected but real-time updates unavailable. Some features may be limited.'
      };
    }
    
    if (apiStatus === 'connecting' || wsStatus === 'connecting') {
      return {
        icon: Wifi,
        color: 'text-blue-500',
        label: 'Connecting',
        message: 'Connecting to server...'
      };
    }
    
    return {
      icon: Wifi,
      color: 'text-green-500',
      label: 'Connected',
      message: 'All systems connected and working properly'
    };
  };
  
  const status = getStatusInfo();
  const Icon = status.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)} data-testid="ConnectionIndicator-Container-connectionIndicator">
            <Icon className={cn('h-4 w-4', status.color)} />
            {showLabel && (
              <span className={cn('text-xs font-medium', status.color)} data-testid="ConnectionIndicator-Label-connectionStatus">{status.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{status.message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};