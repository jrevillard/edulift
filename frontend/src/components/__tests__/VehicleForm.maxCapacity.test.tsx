import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VEHICLE_CONSTRAINTS } from '../../constants/vehicle';

// Mock component pour tester les validations
const VehicleCapacityInput: React.FC<{
  onSubmit: (capacity: number) => void;
}> = ({ onSubmit }) => {
  const [capacity, setCapacity] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capacityNum = parseInt(capacity);
    
    if (isNaN(capacityNum)) {
      setError('Capacity must be a number');
      return;
    }
    
    if (capacityNum < VEHICLE_CONSTRAINTS.MIN_CAPACITY || capacityNum > VEHICLE_CONSTRAINTS.MAX_CAPACITY) {
      setError(`Capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`);
      return;
    }
    
    setError('');
    onSubmit(capacityNum);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCapacity(e.target.value);
    // Clear error on input change
    if (error) {
      setError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="vehicle-capacity-form">
      <input
        type="number"
        value={capacity}
        onChange={handleInputChange}
        min={VEHICLE_CONSTRAINTS.MIN_CAPACITY}
        max={VEHICLE_CONSTRAINTS.MAX_CAPACITY}
        data-testid="capacity-input"
      />
      {error && <span data-testid="error-message">{error}</span>}
      <button type="submit" data-testid="submit-button">Submit</button>
    </form>
  );
};

describe('Vehicle Capacity - Max Capacity Tests', () => {
  it('should allow vehicle with exactly 10 seats', async () => {
    const onSubmit = vi.fn();
    render(<VehicleCapacityInput onSubmit={onSubmit} />);
    
    const input = screen.getByTestId('capacity-input');
    const submitButton = screen.getByTestId('submit-button');
    
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(10);
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });
  });

  it('should reject vehicle with 11 seats', async () => {
    const onSubmit = vi.fn();
    render(<VehicleCapacityInput onSubmit={onSubmit} />);
    
    const input = screen.getByTestId('capacity-input');
    const form = screen.getByTestId('vehicle-capacity-form');
    
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        `Capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`
      );
    });
  });

  it('should reject vehicle with 50 seats (old limit)', async () => {
    const onSubmit = vi.fn();
    render(<VehicleCapacityInput onSubmit={onSubmit} />);
    
    const input = screen.getByTestId('capacity-input');
    const form = screen.getByTestId('vehicle-capacity-form');
    
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        `Capacity must be between ${VEHICLE_CONSTRAINTS.MIN_CAPACITY} and ${VEHICLE_CONSTRAINTS.MAX_CAPACITY}`
      );
    });
  });

  it('should have correct max attribute on input', () => {
    render(<VehicleCapacityInput onSubmit={vi.fn()} />);
    
    const input = screen.getByTestId('capacity-input');
    expect(input).toHaveAttribute('max', VEHICLE_CONSTRAINTS.MAX_CAPACITY.toString());
  });
});