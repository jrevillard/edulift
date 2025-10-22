import React from 'react';

// The ConnectionStatusBanner is now replaced by the ConnectionIndicator in the navigation
// and proper error states on individual pages. This component is kept for backward compatibility
// but is essentially a no-op since we handle connection status through:
// 1. ConnectionIndicator in the navigation (always visible, user-friendly)
// 2. ErrorState components on pages when queries fail due to connection issues

export const ConnectionStatusBanner: React.FC = () => {
  // No longer needed - connection status is handled in the navigation and page-level error states
  return null;
};