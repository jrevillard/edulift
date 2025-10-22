import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { OnboardingBanner } from '../onboarding-banner';

// Mock the Card component
vi.mock('../card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

// Mock the Button component
vi.mock('../button', () => ({
  Button: ({ children, onClick, className, ...props }: { 
    children?: React.ReactNode; 
    onClick?: () => void; 
    className?: string; 
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} className={className} {...(props as Record<string, unknown>)}>
      {children}
    </button>
  ),
}));

describe('OnboardingBanner', () => {
  const defaultProps = {
    type: 'incomplete-setup' as const,
    title: 'Test Title',
    description: 'Test Description',
  };

  it('renders title and description', () => {
    render(<OnboardingBanner {...defaultProps} />);
    
    expect(screen.getByTestId('OnboardingBanner-Title-bannerTitle')).toHaveTextContent('Test Title');
    expect(screen.getByTestId('card')).toHaveTextContent('Test Description');
  });

  it('renders action button when actionText and onAction are provided', () => {
    const mockOnAction = vi.fn();
    
    render(
      <OnboardingBanner 
        {...defaultProps} 
        actionText="Take Action" 
        onAction={mockOnAction} 
      />
    );
    
    const actionButton = screen.getByTestId('OnboardingBanner-Button-actionButton');
    expect(actionButton).toBeInTheDocument();
    
    fireEvent.click(actionButton);
    expect(mockOnAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionText is not provided', () => {
    render(<OnboardingBanner {...defaultProps} />);
    
    expect(screen.queryByRole('button', { name: 'Take Action' })).not.toBeInTheDocument();
  });

  it('renders dismiss button when dismissible and onDismiss are provided', () => {
    const mockOnDismiss = vi.fn();
    
    render(
      <OnboardingBanner 
        {...defaultProps} 
        dismissible={true} 
        onDismiss={mockOnDismiss} 
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const dismissButton = buttons.find(btn => btn.className.includes('h-8 w-8'));
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton!);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when dismissible is false', () => {
    const mockOnDismiss = vi.fn();
    
    render(
      <OnboardingBanner 
        {...defaultProps} 
        dismissible={false} 
        onDismiss={mockOnDismiss} 
      />
    );
    
    const buttons = screen.queryAllByRole('button');
    const dismissButton = buttons.find(btn => btn.className.includes('h-8 w-8'));
    expect(dismissButton).toBeUndefined();
  });

  it('renders progress bar when progress is provided', () => {
    render(
      <OnboardingBanner 
        {...defaultProps} 
        progress={{ completed: 2, total: 5 }} 
      />
    );
    
    const banner = screen.getByTestId('card');
    expect(banner).toHaveTextContent('2/5');
  });

  it('renders custom children content', () => {
    render(
      <OnboardingBanner {...defaultProps}>
        <div data-testid="custom-content">Custom Content</div>
      </OnboardingBanner>
    );
    
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByTestId('custom-content')).toHaveTextContent('Custom Content');
  });

  it('applies correct styles for incomplete-setup type', () => {
    render(<OnboardingBanner {...defaultProps} type="incomplete-setup" />);
    
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-blue-200', 'bg-gradient-to-r', 'from-blue-50', 'to-indigo-50');
  });

  it('applies correct styles for warning type', () => {
    render(<OnboardingBanner {...defaultProps} type="warning" />);
    
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-amber-200', 'bg-gradient-to-r', 'from-amber-50', 'to-orange-50');
  });

  it('applies correct styles for info type', () => {
    render(<OnboardingBanner {...defaultProps} type="info" />);
    
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-gray-200', 'bg-gradient-to-r', 'from-gray-50', 'to-slate-50');
  });

  it('renders progress bar with correct width percentage', () => {
    const { container } = render(
      <OnboardingBanner 
        {...defaultProps} 
        progress={{ completed: 3, total: 10 }} 
      />
    );
    
    // The progress bar should have width: 30%
    const progressBar = container.querySelector('[style*="width: 30%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles zero progress correctly', () => {
    const { container } = render(
      <OnboardingBanner 
        {...defaultProps} 
        progress={{ completed: 0, total: 5 }} 
      />
    );
    
    const progressBar = container.querySelector('[style*="width: 0%"]');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByTestId('card')).toHaveTextContent('0/5');
  });

  it('handles full progress correctly', () => {
    const { container } = render(
      <OnboardingBanner 
        {...defaultProps} 
        progress={{ completed: 5, total: 5 }} 
      />
    );
    
    const progressBar = container.querySelector('[style*="width: 100%"]');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByTestId('card')).toHaveTextContent('5/5');
  });

  it('dismissible defaults to true when not specified', () => {
    const mockOnDismiss = vi.fn();
    
    render(
      <OnboardingBanner 
        {...defaultProps} 
        onDismiss={mockOnDismiss} 
      />
    );
    
    // Should render dismiss button when dismissible defaults to true
    const buttons = screen.getAllByRole('button');
    const dismissButton = buttons.find(btn => btn.className.includes('h-8 w-8'));
    expect(dismissButton).toBeInTheDocument();
  });

  it('does not render progress when not provided', () => {
    render(<OnboardingBanner {...defaultProps} />);
    
    // Should not contain progress text when progress is not provided
    const card = screen.getByTestId('card');
    expect(card.textContent).not.toMatch(/\d+\/\d+/);
  });

  it('renders accent bar for visual emphasis', () => {
    const { container } = render(<OnboardingBanner {...defaultProps} />);
    
    // Look for the accent bar div
    const accentBar = container.querySelector('.absolute.left-0.top-0.h-full.w-1');
    expect(accentBar).toBeInTheDocument();
  });
});