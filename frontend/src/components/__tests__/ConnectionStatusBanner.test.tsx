import { render, screen } from '@testing-library/react';
import { ConnectionStatusBanner } from '../ConnectionStatusBanner';
import { describe, it, expect } from 'vitest';

describe('ConnectionStatusBanner', () => {
  it('should not render anything (deprecated component)', () => {
    render(<ConnectionStatusBanner />);
    
    // The ConnectionStatusBanner is now deprecated and returns null
    // Connection status is now handled by:
    // 1. ConnectionIndicator in navigation (always visible, user-friendly)
    // 2. ErrorState components on individual pages when queries fail
    
    expect(screen.queryByText('Server Connection Issue')).not.toBeInTheDocument();
    expect(screen.queryByText('Real-time Connection Issue')).not.toBeInTheDocument();
    expect(screen.queryByText('Connection Issue')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});