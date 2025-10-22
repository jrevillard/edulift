import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Check, Settings } from 'lucide-react';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';

interface InlineSeatAdjusterProps {
  vehicle: {
    id: string;
    name: string;
    capacity: number;
  };
  onConfirm: (adjustedCapacity?: number, reason?: string) => void;
  onCancel?: () => void;
}

export const InlineSeatAdjuster: React.FC<InlineSeatAdjusterProps> = ({
  vehicle,
  onConfirm
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustedCapacity, setAdjustedCapacity] = useState(vehicle.capacity);
  const [reason, setReason] = useState<string>('');

  const handleUseNormalCapacity = () => {
    onConfirm();
  };

  const handleStartAdjustment = () => {
    setIsAdjusting(true);
  };

  const handleConfirmAdjustment = () => {
    onConfirm(adjustedCapacity, reason);
  };

  const handleCancelAdjustment = () => {
    setIsAdjusting(false);
    setAdjustedCapacity(vehicle.capacity);
    setReason('');
  };

  if (!isAdjusting) {
    return (
      <div 
        className="inline-seat-adjuster p-3 bg-green-50 border border-green-200 rounded-lg"
        data-testid="InlineSeatAdjuster-Container-adjuster"
      >
        <div className="vehicle-confirmation">
          <p className="text-sm text-green-800 mb-3">
            Added <strong>{vehicle.name}</strong> (normally {vehicle.capacity} seats)
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={handleUseNormalCapacity}
              variant="default"
              size="sm"
              className="flex items-center gap-2"
              data-testid="InlineSeatAdjuster-Button-useNormalCapacity"
            >
              <Check className="h-4 w-4" />
              Use normal capacity
            </Button>
            
            <Button
              onClick={handleStartAdjustment}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              data-testid="InlineSeatAdjuster-Button-adjustForTrip"
            >
              <Settings className="h-4 w-4" />
              Adjust for this trip
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="inline-seat-adjuster p-4 bg-blue-50 border border-blue-200 rounded-lg"
      data-testid="InlineSeatAdjuster-Container-adjustmentMode"
    >
      <div className="adjustment-editor" data-testid="InlineSeatAdjuster-Container-editor">
        <h4 className="text-sm font-medium text-blue-900 mb-3">
          Adjust seats for {vehicle.name}
        </h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="seat-count" className="text-sm text-blue-800">
              Seats for this trip:
            </Label>
            <Input
              id="seat-count"
              type="number"
              value={adjustedCapacity}
              onChange={(e) => setAdjustedCapacity(parseInt(e.target.value) || 1)}
              min={VEHICLE_CONSTRAINTS.MIN_CAPACITY}
              max={VEHICLE_CONSTRAINTS.MAX_CAPACITY}
              className="mt-1 w-20"
              data-testid="InlineSeatAdjuster-Input-seatCount"
            />
            <p className="text-xs text-blue-600 mt-1">
              Normal capacity: {vehicle.capacity} seats
            </p>
          </div>

          <div>
            <Label htmlFor="reason" className="text-sm text-blue-800">
              Reason (optional):
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1" data-testid="InlineSeatAdjuster-Select-reason">
                <SelectValue placeholder="Why adjust the seats?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cargo">Less cargo space</SelectItem>
                <SelectItem value="child-seat">Child seat installed</SelectItem>
                <SelectItem value="comfort">Extra comfort space</SelectItem>
                <SelectItem value="luggage">Large luggage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-100 p-2 rounded text-xs text-blue-700">
            💡 You might need fewer seats due to cargo, child seats, or other space requirements
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleConfirmAdjustment}
              size="sm"
              className="flex-1"
              data-testid="InlineSeatAdjuster-Button-confirm"
            >
              Use {adjustedCapacity} seats
            </Button>
            
            <Button
              onClick={handleCancelAdjustment}
              variant="outline"
              size="sm"
              data-testid="InlineSeatAdjuster-Button-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};