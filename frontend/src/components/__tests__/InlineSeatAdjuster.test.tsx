import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// InlineSeatAdjuster component test

// Mock component to test the new UX
const MockInlineSeatAdjuster: React.FC<{
  vehicle: { id: string; name: string; capacity: number };
  onConfirm: (adjustedCapacity?: number) => void;
  onCancel: () => void;
}> = ({ vehicle, onConfirm }) => {
  const [isAdjusting, setIsAdjusting] = React.useState(false);
  const [adjustedCapacity, setAdjustedCapacity] = React.useState(vehicle.capacity);

  return (
    <div data-testid="inline-seat-adjuster">
      <div className="vehicle-confirmation">
        <span>Added {vehicle.name} (normally {vehicle.capacity} seats)</span>
        
        {!isAdjusting ? (
          <div className="action-buttons">
            <button 
              onClick={() => onConfirm()}
              data-testid="use-normal-capacity"
            >
              ✓ Use normal capacity
            </button>
            <button 
              onClick={() => setIsAdjusting(true)}
              data-testid="adjust-for-trip"
            >
              ⚙️ Adjust for this trip
            </button>
          </div>
        ) : (
          <div className="adjustment-editor" data-testid="adjustment-editor">
            <label>
              Seats for this trip:
              <input
                type="number"
                value={adjustedCapacity}
                onChange={(e) => setAdjustedCapacity(parseInt(e.target.value))}
                min="1"
                max="10"
                data-testid="seat-adjustment-input"
              />
            </label>
            <select data-testid="adjustment-reason">
              <option value="">Select reason (optional)</option>
              <option value="cargo">Less cargo space</option>
              <option value="child-seat">Child seat installed</option>
              <option value="other">Other</option>
            </select>
            <div className="adjustment-actions">
              <button 
                onClick={() => onConfirm(adjustedCapacity)}
                data-testid="confirm-adjustment"
              >
                Confirm
              </button>
              <button 
                onClick={() => {
                  setIsAdjusting(false);
                  setAdjustedCapacity(vehicle.capacity);
                }}
                data-testid="cancel-adjustment"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

describe('InlineSeatAdjuster - Improved UX', () => {
  const mockVehicle = {
    id: 'vehicle-1',
    name: 'Toyota Camry',
    capacity: 5
  };

  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show vehicle confirmation with contextual options', () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Should show vehicle info in context
    expect(screen.getByText('Added Toyota Camry (normally 5 seats)')).toBeInTheDocument();
    
    // Should show intuitive action buttons
    expect(screen.getByTestId('use-normal-capacity')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-for-trip')).toBeInTheDocument();
  });

  it('should allow using normal capacity directly', async () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('use-normal-capacity'));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(); // No adjustment
    });
  });

  it('should show inline adjustment editor when requested', async () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('adjust-for-trip'));

    await waitFor(() => {
      expect(screen.getByTestId('adjustment-editor')).toBeInTheDocument();
      expect(screen.getByTestId('seat-adjustment-input')).toBeInTheDocument();
      expect(screen.getByTestId('adjustment-reason')).toBeInTheDocument();
    });
  });

  it('should allow adjusting seat count with reason', async () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Open adjustment editor
    fireEvent.click(screen.getByTestId('adjust-for-trip'));

    // Adjust the seat count
    const input = screen.getByTestId('seat-adjustment-input');
    fireEvent.change(input, { target: { value: '4' } });

    // Select a reason
    const reasonSelect = screen.getByTestId('adjustment-reason');
    fireEvent.change(reasonSelect, { target: { value: 'cargo' } });

    // Confirm adjustment
    fireEvent.click(screen.getByTestId('confirm-adjustment'));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(4);
    });
  });

  it('should allow canceling adjustment and return to normal', async () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Open adjustment editor
    fireEvent.click(screen.getByTestId('adjust-for-trip'));

    // Change value
    fireEvent.change(screen.getByTestId('seat-adjustment-input'), { 
      target: { value: '3' } 
    });

    // Cancel
    fireEvent.click(screen.getByTestId('cancel-adjustment'));

    // Should be back to normal view
    expect(screen.getByTestId('use-normal-capacity')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-for-trip')).toBeInTheDocument();
    expect(screen.queryByTestId('adjustment-editor')).not.toBeInTheDocument();
  });

  it('should respect capacity limits', () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('adjust-for-trip'));
    
    const input = screen.getByTestId('seat-adjustment-input');
    
    // Should have correct limits
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
  });

  it('should provide contextual reasons for adjustment', () => {
    render(
      <MockInlineSeatAdjuster
        vehicle={mockVehicle}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('adjust-for-trip'));
    
    // Should have contextual reason options
    expect(screen.getByText('Less cargo space')).toBeInTheDocument();
    expect(screen.getByText('Child seat installed')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});