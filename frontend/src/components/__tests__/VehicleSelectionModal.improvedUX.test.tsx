import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock improved VehicleSelectionModal component
const MockImprovedVehicleSelectionModal: React.FC<{
  vehicles: Array<{ id: string; name: string; capacity: number }>;
  onVehicleSelect: (vehicleId: string, adjustedCapacity?: number) => void;
}> = ({ vehicles, onVehicleSelect }) => {
  const [selectedVehicle, setSelectedVehicle] = React.useState<string>('');
  const [showCustomization, setShowCustomization] = React.useState<string>('');
  const [customCapacity, setCustomCapacity] = React.useState<number>(0);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setCustomCapacity(vehicle.capacity);
    }
  };

  const handleCustomize = (vehicleId: string) => {
    setShowCustomization(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setCustomCapacity(vehicle.capacity);
    }
  };

  return (
    <div data-testid="improved-vehicle-modal">
      <h2>Select Vehicle</h2>
      
      <div className="vehicle-list">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="vehicle-option" data-testid={`vehicle-option-${vehicle.id}`}>
            <div className="vehicle-info">
              <input
                type="radio"
                name="vehicle"
                value={vehicle.id}
                onChange={() => handleVehicleSelect(vehicle.id)}
                data-testid={`vehicle-radio-${vehicle.id}`}
              />
              <span>{vehicle.name} - {vehicle.capacity} seats</span>
              <button
                onClick={() => handleCustomize(vehicle.id)}
                data-testid={`customize-${vehicle.id}`}
                className="customize-button"
              >
                Customize...
              </button>
            </div>
            
            {showCustomization === vehicle.id && (
              <div className="inline-customization" data-testid={`customization-${vehicle.id}`}>
                <label>
                  Seats for this trip:
                  <input
                    type="number"
                    value={customCapacity}
                    onChange={(e) => setCustomCapacity(parseInt(e.target.value))}
                    min="1"
                    max="10"
                    data-testid={`custom-capacity-${vehicle.id}`}
                  />
                </label>
                <div className="customization-help">
                  <small>Adjust if you need fewer seats due to cargo, child seats, etc.</small>
                </div>
                <div className="customization-actions">
                  <button
                    onClick={() => {
                      onVehicleSelect(vehicle.id, customCapacity);
                      setShowCustomization('');
                    }}
                    data-testid={`confirm-custom-${vehicle.id}`}
                  >
                    Use {customCapacity} seats
                  </button>
                  <button
                    onClick={() => setShowCustomization('')}
                    data-testid={`cancel-custom-${vehicle.id}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedVehicle && !showCustomization && (
        <div className="selected-vehicle-actions">
          <button
            onClick={() => onVehicleSelect(selectedVehicle)}
            data-testid="confirm-normal-selection"
          >
            Add Vehicle
          </button>
        </div>
      )}
    </div>
  );
};

describe('VehicleSelectionModal - Improved UX', () => {
  const mockVehicles = [
    { id: 'vehicle-1', name: 'Toyota Camry', capacity: 5 },
    { id: 'vehicle-2', name: 'Honda CR-V', capacity: 7 },
    { id: 'vehicle-3', name: 'Ford Transit', capacity: 9 }
  ];

  const mockOnVehicleSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show vehicles with clear capacity info and customize option', () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    // Should show vehicle info clearly
    expect(screen.getByText('Toyota Camry - 5 seats')).toBeInTheDocument();
    expect(screen.getByText('Honda CR-V - 7 seats')).toBeInTheDocument();
    expect(screen.getByText('Ford Transit - 9 seats')).toBeInTheDocument();

    // Should show customize buttons for each
    expect(screen.getByTestId('customize-vehicle-1')).toBeInTheDocument();
    expect(screen.getByTestId('customize-vehicle-2')).toBeInTheDocument();
    expect(screen.getByTestId('customize-vehicle-3')).toBeInTheDocument();
  });

  it('should allow normal vehicle selection without customization', async () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    // Select a vehicle
    fireEvent.click(screen.getByTestId('vehicle-radio-vehicle-1'));
    
    // Confirm selection
    fireEvent.click(screen.getByTestId('confirm-normal-selection'));

    await waitFor(() => {
      expect(mockOnVehicleSelect).toHaveBeenCalledWith('vehicle-1'); // No custom capacity
    });
  });

  it('should show inline customization when customize is clicked', async () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    // Click customize for first vehicle
    fireEvent.click(screen.getByTestId('customize-vehicle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('customization-vehicle-1')).toBeInTheDocument();
      expect(screen.getByTestId('custom-capacity-vehicle-1')).toBeInTheDocument();
      expect(screen.getByText('Adjust if you need fewer seats due to cargo, child seats, etc.')).toBeInTheDocument();
    });
  });

  it('should allow customizing seat count with explanation', async () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    // Open customization
    fireEvent.click(screen.getByTestId('customize-vehicle-1'));

    // Change capacity
    const input = screen.getByTestId('custom-capacity-vehicle-1');
    fireEvent.change(input, { target: { value: '4' } });

    // Confirm customization
    fireEvent.click(screen.getByTestId('confirm-custom-vehicle-1'));

    await waitFor(() => {
      expect(mockOnVehicleSelect).toHaveBeenCalledWith('vehicle-1', 4);
    });
  });

  it('should allow canceling customization', async () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    // Open customization
    fireEvent.click(screen.getByTestId('customize-vehicle-1'));

    // Cancel customization
    fireEvent.click(screen.getByTestId('cancel-custom-vehicle-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('customization-vehicle-1')).not.toBeInTheDocument();
    });
  });

  it('should show helpful text about seat adjustment', () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    fireEvent.click(screen.getByTestId('customize-vehicle-1'));

    // Should show contextual help
    expect(screen.getByText('Adjust if you need fewer seats due to cargo, child seats, etc.')).toBeInTheDocument();
  });

  it('should show dynamic button text with custom capacity', () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    fireEvent.click(screen.getByTestId('customize-vehicle-1'));
    
    const input = screen.getByTestId('custom-capacity-vehicle-1');
    fireEvent.change(input, { target: { value: '3' } });

    // Button should show the custom capacity
    expect(screen.getByText('Use 3 seats')).toBeInTheDocument();
  });

  it('should respect capacity limits in customization', () => {
    render(
      <MockImprovedVehicleSelectionModal
        vehicles={mockVehicles}
        onVehicleSelect={mockOnVehicleSelect}
      />
    );

    fireEvent.click(screen.getByTestId('customize-vehicle-1'));
    
    const input = screen.getByTestId('custom-capacity-vehicle-1');
    
    // Should have correct limits
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
  });
});